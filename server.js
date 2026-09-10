const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USERNAME = 'kimsiwon';
const COOP_INTERVAL_MS = 5 * 60 * 1000;
const ARENA_INTERVAL_MS = 30 * 60 * 1000;
const MATCH_WAIT_MS = 30 * 1000;

const DEFAULT_STATE = {
  profile: { nickname: '', avatar: '🎲' },
  currencies: { coin: 100, dice: 0, diamond: 0, arenaTicket: 1, coopTicket: 5 },
  deck: ['blue','blue','blue','blue','blue'],
  unlocked: [], treeUnlocked: [], diceLevels: {},
  passXP: 0, passRewardsClaimed: [], lucky: 0,
  quests: [0,0,0], difficulty: 'normal'
};

const PASS_REWARDS = [
  {xp:10,label:'코인 200',field:'coin',amount:200},
  {xp:20,label:'주사위 50',field:'dice',amount:50},
  {xp:30,label:'보석 10',field:'diamond',amount:10},
  {xp:40,label:'행운의 주사위 1',field:'lucky',amount:1},
  {xp:50,label:'협동전 티켓 1',field:'coopTicket',amount:1},
  {xp:60,label:'코인 500',field:'coin',amount:500},
  {xp:70,label:'주사위 100',field:'dice',amount:100},
  {xp:80,label:'보석 20',field:'diamond',amount:20},
  {xp:90,label:'행운의 주사위 2',field:'lucky',amount:2},
  {xp:100,label:'코인 1000',field:'coin',amount:1000}
];

function clone(v){return JSON.parse(JSON.stringify(v));}
function tokenFor(user){return jwt.sign({id:user.id,username:user.username},JWT_SECRET,{expiresIn:'30d'});}
function auth(req,res,next){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({error:'로그인이 필요합니다.'});
  try{req.auth=jwt.verify(h.slice(7),JWT_SECRET);next();}
  catch{return res.status(401).json({error:'로그인이 만료되었습니다.'});}
}

function cleanState(raw){
  const s=raw||{};
  return {
    profile:{nickname:String(s.profile?.nickname||''),avatar:String(s.profile?.avatar||'🎲').slice(0,8)},
    currencies:{
      coin:Math.max(0,Math.floor(Number(s.currencies?.coin??DEFAULT_STATE.currencies.coin))),
      dice:Math.max(0,Math.floor(Number(s.currencies?.dice??DEFAULT_STATE.currencies.dice))),
      diamond:Math.max(0,Math.floor(Number(s.currencies?.diamond??DEFAULT_STATE.currencies.diamond))),
      arenaTicket:Math.max(0,Math.floor(Number(s.currencies?.arenaTicket??DEFAULT_STATE.currencies.arenaTicket))),
      coopTicket:Math.max(0,Math.floor(Number(s.currencies?.coopTicket??DEFAULT_STATE.currencies.coopTicket)))
    },
    deck:Array.isArray(s.deck)?s.deck.slice(0,5):clone(DEFAULT_STATE.deck),
    unlocked:Array.isArray(s.unlocked)?[...new Set(s.unlocked)].slice(0,100):[],
    treeUnlocked:Array.isArray(s.treeUnlocked)?[...new Set(s.treeUnlocked)].slice(0,100):[],
    diceLevels:s.diceLevels&&typeof s.diceLevels==='object'?s.diceLevels:{},
    passXP:Math.max(0,Math.min(100,Math.floor(Number(s.passXP??0)))),
    passRewardsClaimed:Array.isArray(s.passRewardsClaimed)?[...new Set(s.passRewardsClaimed.map(Number).filter(Number.isInteger))]:[],
    lucky:Math.max(0,Math.floor(Number(s.lucky??0))),
    quests:Array.isArray(s.quests)?s.quests.slice(0,20).map(Number):[0,0,0],
    difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:'normal'
  };
}
function isAdminRow(row){return Boolean(row && (row.is_admin || row.username===ADMIN_USERNAME));}
async function rowForUser(id){
  const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[id]);
  return rows[0];
}
function publicUser(row){return {id:row.id,username:row.username,nickname:row.nickname,avatar:row.avatar,isAdmin:isAdminRow(row)};}

function ticketCalc(row, now=Date.now()){
  let coopAt=row.coop_ticket_at?new Date(row.coop_ticket_at).getTime():now;
  let arenaAt=row.arena_ticket_at?new Date(row.arena_ticket_at).getTime():now;
  const coopElapsed=Math.max(0,now-coopAt), arenaElapsed=Math.max(0,now-arenaAt);
  const coopCycles=Math.floor(coopElapsed/COOP_INTERVAL_MS), arenaCycles=Math.floor(arenaElapsed/ARENA_INTERVAL_MS);
  return {
    coopAt,arenaAt,coopCycles,arenaCycles,
    coopNext:COOP_INTERVAL_MS-((coopElapsed)%COOP_INTERVAL_MS),
    arenaNext:ARENA_INTERVAL_MS-((arenaElapsed)%ARENA_INTERVAL_MS)
  };
}

async function accrueTicketsTx(client,userId){
  const {rows}=await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const row=rows[0]; if(!row) return null;
  let state=cleanState(row.state); const now=Date.now(); let c=ticketCalc(row,now); let changed=false;
  let coopAt=c.coopAt, arenaAt=c.arenaAt;
  if(!row.starter_granted){
    state.currencies.coopTicket += 5;
    state.currencies.arenaTicket += 1;
    coopAt=now; arenaAt=now; changed=true;
    await client.query('UPDATE users SET starter_granted=TRUE WHERE id=$1',[userId]);
  }
  if(c.coopCycles>0){state.currencies.coopTicket+=c.coopCycles;coopAt+=c.coopCycles*COOP_INTERVAL_MS;changed=true;}
  if(c.arenaCycles>0){state.currencies.arenaTicket+=c.arenaCycles;arenaAt+=c.arenaCycles*ARENA_INTERVAL_MS;changed=true;}
  if(changed){
    await client.query('UPDATE users SET state=$1::jsonb,coop_ticket_at=to_timestamp($2/1000.0),arena_ticket_at=to_timestamp($3/1000.0),updated_at=NOW() WHERE id=$4',[JSON.stringify(state),coopAt,arenaAt,userId]);
  }
  const now2=Date.now();
  return {state,coopNext:COOP_INTERVAL_MS-((now2-coopAt)%COOP_INTERVAL_MS),arenaNext:ARENA_INTERVAL_MS-((now2-arenaAt)%ARENA_INTERVAL_MS)};
}
async function accrueTickets(userId){
  const client=await pool.connect();
  try{await client.query('BEGIN');const out=await accrueTicketsTx(client,userId);await client.query('COMMIT');return out;}
  catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

function broadcast(userId,message){
  const set=sockets.get(String(userId)); if(!set)return;
  const text=JSON.stringify(message);
  for(const ws of set) if(ws.readyState===1) ws.send(text);
}
function broadcastAdmins(message){
  const text=JSON.stringify(message);
  for(const [uid,set] of sockets){const info=socketMeta.get(uid);if(!info?.isAdmin)continue;for(const ws of set)if(ws.readyState===1)ws.send(text);}
}
function stateMessage(row,state,extra={}){return {type:'state_update',state:cleanState(state),user:publicUser(row),...extra};}

async function getFresh(userId){
  const accrued=await accrueTickets(userId); const row=await rowForUser(userId);
  return {row,state:accrued?.state||cleanState(row.state),coopNext:accrued?.coopNext??COOP_INTERVAL_MS,arenaNext:accrued?.arenaNext??ARENA_INTERVAL_MS};
}

async function updateFullState(userId,incoming){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticketed=await accrueTicketsTx(client,userId); if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');
    const current=ticketed.state; const next=cleanState(incoming);
    // Client-owned progression only. Ticket counters use the ticketed server state so accrual cannot be lost.
    next.currencies.coopTicket=current.currencies.coopTicket;
    next.currencies.arenaTicket=current.currencies.arenaTicket;
    next.passRewardsClaimed=current.passRewardsClaimed;
    await client.query('UPDATE users SET state=$1::jsonb,nickname=$2,avatar=$3,updated_at=NOW() WHERE id=$4',[JSON.stringify(next),next.profile.nickname,next.profile.avatar,userId]);
    const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[userId])).rows[0];
    await client.query('COMMIT');
    return {row,state:next,coopNext:ticketed.coopNext,arenaNext:ticketed.arenaNext};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,db:true});}catch(e){res.status(503).json({ok:false,db:false});}});

app.post('/api/auth/register',async(req,res)=>{
  const username=String(req.body.username||'').trim(),password=String(req.body.password||''),nickname=String(req.body.nickname||'').trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:'아이디는 영문, 숫자, _ 3~20자여야 합니다.'});
  if(password.length<6)return res.status(400).json({error:'비밀번호는 6자 이상이어야 합니다.'});
  if(nickname.length<1||nickname.length>12)return res.status(400).json({error:'닉네임은 1~12자여야 합니다.'});
  try{
    const hash=await bcrypt.hash(password,12);const state=cleanState({...DEFAULT_STATE,profile:{nickname,avatar:'🎲'}});
    const {rows}=await pool.query('INSERT INTO users(username,password_hash,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted) VALUES($1,$2,$3,$4,$5::jsonb,$6,NOW(),NOW(),TRUE) RETURNING id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted',[username,hash,nickname,'🎲',JSON.stringify(state),username===ADMIN_USERNAME]);
    const row=rows[0];res.json({token:tokenFor(row),user:publicUser(row),state:state,coopTicketNextIn:COOP_INTERVAL_MS,arenaTicketNextIn:ARENA_INTERVAL_MS});
  }catch(e){if(e.code==='23505')return res.status(409).json({error:'이미 사용 중인 아이디입니다.'});console.error(e);res.status(500).json({error:'회원가입 실패'});}
});

app.post('/api/auth/login',async(req,res)=>{
  const username=String(req.body.username||'').trim(),password=String(req.body.password||'');
  const {rows}=await pool.query('SELECT id,username,password_hash,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE username=$1',[username]); const user=rows[0];
  if(!user||!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({error:'아이디 또는 비밀번호가 올바르지 않습니다.'});
  const fresh=await getFresh(user.id);res.json({token:tokenFor(fresh.row),user:publicUser(fresh.row),state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});
});
app.post('/api/auth/logout',auth,(_req,res)=>res.json({ok:true}));

app.get('/api/me',auth,async(req,res)=>{try{const fresh=await getFresh(req.auth.id);if(!fresh.row)return res.status(404).json({error:'계정을 찾을 수 없습니다.'});res.json({user:publicUser(fresh.row),state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});}catch(e){console.error(e);res.status(500).json({error:'계정 정보를 불러오지 못했습니다.'});}});

app.put('/api/me/state',auth,async(req,res)=>{try{const fresh=await updateFullState(req.auth.id,req.body);res.json({ok:true,state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});broadcast(req.auth.id,stateMessage(fresh.row,fresh.state,{coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext}));broadcastAdmins({type:'admin_state_update',username:fresh.row.username});}catch(e){console.error(e);res.status(500).json({error:'저장 실패'});}});

app.put('/api/me/profile',auth,async(req,res)=>{const nickname=String(req.body.nickname||'').trim();if(nickname.length<1||nickname.length>12)return res.status(400).json({error:'닉네임은 1~12자여야 합니다.'});try{await pool.query("UPDATE users SET nickname=$1,state=jsonb_set(state,ARRAY['profile','nickname']::text[],$2::jsonb),updated_at=NOW() WHERE id=$3",[nickname,JSON.stringify(nickname),req.auth.id]);const fresh=await getFresh(req.auth.id);res.json({ok:true,nickname,state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});broadcast(req.auth.id,stateMessage(fresh.row,fresh.state,{coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext}));broadcastAdmins({type:'admin_state_update',username:fresh.row.username});}catch(e){console.error(e);res.status(500).json({error:'닉네임 변경 실패'});}});


// ---------------- Dice Tree ----------------
const TREE_NODES = [
  {id:0,type:null,next:[1,2]},
  {id:1,type:'blue',next:[3,4]},
  {id:2,type:'cyan',next:[4,5]},
  {id:3,type:'red',next:[6]},
  {id:4,type:'yellow',next:[6,7]},
  {id:5,type:'green',next:[7]},
  {id:6,type:'pink',next:[8]},
  {id:7,type:'purple',next:[8]},
  {id:8,type:'yellow',next:[]}
];
const TREE_TYPES = new Set(['blue','cyan','red','green','yellow','pink','purple']);
function treeNodeById(id){return TREE_NODES.find(n=>n.id===Number(id));}
function treeParentFor(id){return TREE_NODES.find(n=>n.next.includes(Number(id)));}
function treeUpgradeCostServer(level){
  const next = Number(level)+1;
  return next%5===0 ? {coin:0,dice:8} : {coin:Math.max(50,Number(level)*50),dice:0};
}
function treeStatePayload(state){
  const clean=cleanState(state);if(!Array.isArray(clean.treeUnlocked))clean.treeUnlocked=[];if(!clean.diceLevels)clean.diceLevels={};return clean;
}

app.post('/api/tree/unlock',auth,async(req,res)=>{
  const nodeId=Number(req.body.nodeId);
  const node=treeNodeById(nodeId);
  if(!node || node.id===0)return res.status(400).json({error:'해금할 수 없는 트리 노드입니다.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticketed=await accrueTicketsTx(client,req.auth.id);
    if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');
    const state=treeStatePayload(ticketed.state);
    if(state.treeUnlocked.includes(nodeId))throw new Error('이미 해금된 주사위입니다.');
    const parent=treeParentFor(nodeId);
    if(!parent || (parent.id!==0 && !state.treeUnlocked.includes(parent.id)))throw new Error('먼저 연결된 앞의 주사위를 해금하세요.');
    if(state.currencies.dice<8)throw new Error('주사위 재화가 부족합니다. 해금에는 8개가 필요합니다.');
    state.currencies.dice-=8;
    state.treeUnlocked.push(nodeId);
    if(node.type && TREE_TYPES.has(node.type) && !state.unlocked.includes(node.type))state.unlocked.push(node.type);
    // Unlocking a dice starts it at level 1.
    if(node.type && !state.diceLevels[node.type])state.diceLevels[node.type]=1;
    await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);
    const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];
    await client.query('COMMIT');
    const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};
    broadcast(req.auth.id,stateMessage(row,state,extra));
    broadcastAdmins({type:'admin_state_update',username:row.username});
    res.json({ok:true,state,coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 트리 해금 실패'});}finally{client.release();}
});

app.post('/api/tree/upgrade',auth,async(req,res)=>{
  const type=String(req.body.type||'');
  if(!TREE_TYPES.has(type))return res.status(400).json({error:'지원하지 않는 주사위입니다.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ticketed=await accrueTicketsTx(client,req.auth.id);
    if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');
    const state=treeStatePayload(ticketed.state);
    if(!state.unlocked.includes(type))throw new Error('먼저 다이스 트리에서 이 주사위를 해금하세요.');
    const level=Math.max(1,Math.floor(Number(state.diceLevels[type]||1)));
    const cost=treeUpgradeCostServer(level);
    if(cost.dice && state.currencies.dice<cost.dice)throw new Error(`레벨 ${level+1} 업그레이드에는 주사위 재화 ${cost.dice}개가 필요합니다.`);
    if(cost.coin && state.currencies.coin<cost.coin)throw new Error(`레벨 ${level+1} 업그레이드에는 코인 ${cost.coin}개가 필요합니다.`);
    if(cost.dice)state.currencies.dice-=cost.dice;
    if(cost.coin)state.currencies.coin-=cost.coin;
    state.diceLevels[type]=level+1;
    await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);
    const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];
    await client.query('COMMIT');
    const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};
    broadcast(req.auth.id,stateMessage(row,state,extra));
    broadcastAdmins({type:'admin_state_update',username:row.username});
    res.json({ok:true,state,upgrade:{type,fromLevel:level,toLevel:level+1,cost},coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 업그레이드 실패'});}finally{client.release();}
});

// ---------------- Matchmaking ----------------
const waitingQueue=[];const queueEntries=new Map();const matches=new Map();
function removeWaiting(id){const i=waitingQueue.indexOf(id);if(i>=0)waitingQueue.splice(i,1);}
function expireWaitingEntries(){const now=Date.now();for(const id of [...waitingQueue]){const q=queueEntries.get(id);if(!q){removeWaiting(id);continue;}if(q.status==='waiting'&&now-q.createdAt>=MATCH_WAIT_MS){q.status='ai';q.updatedAt=now;removeWaiting(q.id);}}}
async function consumeCoopTicket(userId){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');if(t.state.currencies.coopTicket<1)throw new Error('협동전 티켓이 부족합니다.');t.state.currencies.coopTicket-=1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(t.state),userId]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');return {state:t.state,row,coopNext:t.coopNext,arenaNext:t.arenaNext};}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function refundCoopTicket(userId){return adminOrSystemAdjust(userId,'coopTicket',1,false);}

app.post('/api/match/join',auth,async(req,res)=>{
 try{
   expireWaitingEntries();
   const existing=[...queueEntries.values()].find(q=>q.userId===req.auth.id&&q.status==='waiting');
   if(existing){
     if(Date.now()-existing.createdAt>=MATCH_WAIT_MS){existing.status='ai';removeWaiting(existing.id);return res.json({status:'ai',queueId:existing.id,opponentType:'ai',opponentNickname:'AI 플레이어'});}
     return res.json({status:'waiting',queueId:existing.id,elapsed:Math.floor((Date.now()-existing.createdAt)/1000)});
   }
   const charged=await consumeCoopTicket(req.auth.id);
   const opponent=waitingQueue.map(id=>queueEntries.get(id)).find(q=>q&&q.status==='waiting'&&q.userId!==req.auth.id);
   const queueId=crypto.randomUUID();
   if(opponent){
     removeWaiting(opponent.id);const matchId=crypto.randomUUID();const now=Date.now();
     const match={id:matchId,players:[opponent.userId,req.auth.id],createdAt:now,status:'matched',opponentType:'player'};matches.set(matchId,match);
     opponent.status='matched';opponent.matchId=matchId;opponent.updatedAt=now;
     queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:now,status:'matched',matchId});
     const oppRow=await rowForUser(opponent.userId);const nickname=oppRow?.nickname||'플레이어';
     const result={status:'matched',queueId,matchId,opponentType:'player',opponentNickname:nickname,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext};
     broadcast(opponent.userId,{type:'matched',queueId:opponent.id,matchId,opponentType:'player',opponentNickname:charged.row.nickname||'플레이어'});
     return res.json(result);
   }
   queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:Date.now(),status:'waiting'});waitingQueue.push(queueId);
   res.json({status:'waiting',queueId,elapsed:0,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext});
 }catch(e){console.error(e);res.status(400).json({error:e.message||'매칭을 시작할 수 없습니다.'});}
});

app.get('/api/match/status/:queueId',auth,async(req,res)=>{
 const q=queueEntries.get(req.params.queueId);if(!q||q.userId!==req.auth.id)return res.status(404).json({error:'매칭 정보를 찾을 수 없습니다.'});
 if(q.status==='waiting'&&Date.now()-q.createdAt>=MATCH_WAIT_MS){q.status='ai';q.updatedAt=Date.now();removeWaiting(q.id);}
 if(q.status==='matched'){const match=matches.get(q.matchId);const other=match?.players?.find(x=>String(x)!==String(q.userId));let nickname='플레이어';if(other){const r=await rowForUser(other);if(r)nickname=r.nickname;}return res.json({status:'matched',queueId:q.id,matchId:q.matchId,opponentType:'player',opponentNickname:nickname});}
 if(q.status==='ai')return res.json({status:'ai',queueId:q.id,opponentType:'ai',opponentNickname:'AI 플레이어'});
 const elapsed=Math.floor((Date.now()-q.createdAt)/1000);return res.json({status:'waiting',queueId:q.id,elapsed,remaining:Math.max(0,Math.ceil((MATCH_WAIT_MS-(Date.now()-q.createdAt))/1000))});
});
app.get('/api/match/current',auth,async(req,res)=>{expireWaitingEntries();const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id&&['waiting','matched','ai'].includes(x.status));if(!q)return res.json({status:'none'});res.json({status:q.status,queueId:q.id,matchId:q.matchId||null,elapsed:Math.floor((Date.now()-q.createdAt)/1000)});});
app.post('/api/match/cancel',auth,async(req,res)=>{const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id&&x.status==='waiting');if(!q)return res.json({ok:true,refunded:false});q.status='cancelled';removeWaiting(q.id);queueEntries.delete(q.id);const out=await refundCoopTicket(req.auth.id);const fresh=await getFresh(req.auth.id);res.json({ok:true,refunded:true,state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});});

// ---------------- Admin ----------------
async function requireAdmin(req,res,next){try{const row=await rowForUser(req.auth.id);if(!isAdminRow(row))return res.status(403).json({error:'관리자 권한이 없습니다.'});req.adminRow=row;next();}catch(e){console.error(e);res.status(500).json({error:'관리자 권한 확인 실패'});}}
async function adminTarget(username){const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE username=$1',[username]);return rows[0];}

async function adminOrSystemAdjust(userId,field,delta,notify=true){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);
   const isPass=field==='passXP', isLucky=field==='lucky';
   if(isPass)s.passXP=Math.max(0,Math.min(100,s.passXP+Math.floor(Number(delta))));
   else if(isLucky)s.lucky=Math.max(0,s.lucky+Math.floor(Number(delta)));
   else if(['coin','dice','diamond','arenaTicket','coopTicket'].includes(field)){const v=s.currencies[field]+Math.floor(Number(delta));if(v<0)throw new Error('재화는 0보다 작아질 수 없습니다.');s.currencies[field]=v;}
   else throw new Error('지원하지 않는 재화입니다.');
   await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(s),userId]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');
   if(notify){const extra={coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext};broadcast(userId,stateMessage(row,s,extra));broadcastAdmins({type:'admin_state_update',username:row.username});}
   return s;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function adminSetValue(userId,field,value){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);const v=Math.floor(Number(value));if(v<0||!Number.isFinite(v))throw new Error('설정값은 0 이상의 정수여야 합니다.');
   if(field==='passXP')s.passXP=Math.min(100,v);
   else if(field==='lucky')s.lucky=v;
   else if(['coin','dice','diamond','arenaTicket','coopTicket'].includes(field))s.currencies[field]=v;
   else throw new Error('지원하지 않는 재화입니다.');
   await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(s),userId]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');
   const extra={coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext};broadcast(userId,stateMessage(row,s,extra));broadcastAdmins({type:'admin_state_update',username:row.username});return s;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}

app.get('/api/admin/users',auth,requireAdmin,async(_req,res)=>{try{const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin FROM users ORDER BY id ASC');res.json({users:rows.map(r=>({id:r.id,username:r.username,nickname:r.nickname,avatar:r.avatar,isAdmin:isAdminRow(r),state:cleanState(r.state)}))});}catch(e){console.error(e);res.status(500).json({error:'관리자 사용자 목록을 불러오지 못했습니다.'});}});
app.post('/api/admin/users/:username/adjust',auth,requireAdmin,async(req,res)=>{const username=String(req.params.username||'').trim(),field=String(req.body.currency||''),delta=Number(req.body.delta);if(!Number.isInteger(delta))return res.status(400).json({error:'변경량은 정수여야 합니다.'});try{const row=await adminTarget(username);if(!row)return res.status(404).json({error:'사용자를 찾을 수 없습니다.'});const state=await adminOrSystemAdjust(row.id,field,delta,true);res.json({ok:true,username,state});}catch(e){res.status(400).json({error:e.message||'관리자 변경 실패'});}});
app.post('/api/admin/users/:username/set-currency',auth,requireAdmin,async(req,res)=>{const username=String(req.params.username||'').trim(),field=String(req.body.currency||''),value=Number(req.body.value);if(!Number.isInteger(value)||value<0)return res.status(400).json({error:'설정값은 0 이상의 정수여야 합니다.'});try{const row=await adminTarget(username);if(!row)return res.status(404).json({error:'사용자를 찾을 수 없습니다.'});const state=await adminSetValue(row.id,field,value);res.json({ok:true,username,state});}catch(e){res.status(400).json({error:e.message||'관리자 설정 실패'});}});

// ---------------- Lucky + Dice Pass ----------------
app.post('/api/lucky/use',auth,async(req,res)=>{
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,req.auth.id);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);if(s.lucky<1)throw new Error('행운의 주사위가 없습니다.');s.lucky-=1;const r=Math.floor(Math.random()*3);let reward;if(r===0){s.currencies.coin+=2000;reward={label:'🍀 코인 2,000 획득!'};}else if(r===1){s.currencies.dice+=1200;reward={label:'🍀 주사위 1,200 획득!'};}else{s.passXP=Math.min(100,s.passXP+10);reward={label:'🍀 다이스 패스 XP +10!'};}
 await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(s),req.auth.id]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');broadcast(req.auth.id,stateMessage(row,s,{coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext}));broadcastAdmins({type:'admin_state_update',username:row.username});res.json({ok:true,state:s,reward,coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'사용 실패'});}finally{client.release();}}
);

app.post('/api/pass/claim-next',auth,async(req,res)=>{
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,req.auth.id);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);const claimed=new Set(s.passRewardsClaimed);const reward=PASS_REWARDS.find(x=>s.passXP>=x.xp&&!claimed.has(x.xp));if(!reward)throw new Error('받을 수 있는 다음 패스 보상이 없습니다.');
   if(reward.field==='lucky')s.lucky+=reward.amount;else s.currencies[reward.field]+=reward.amount;claimed.add(reward.xp);s.passRewardsClaimed=[...claimed].sort((a,b)=>a-b);
   await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(s),req.auth.id]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');broadcast(req.auth.id,stateMessage(row,s,{coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext}));broadcastAdmins({type:'admin_state_update',username:row.username});res.json({ok:true,state:s,reward,coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'패스 보상 수령 실패'});}finally{client.release();}}
);

// ---------------- WebSocket ----------------
const wss=new WebSocketServer({server,path:'/ws'});const sockets=new Map();const socketMeta=new Map();
wss.on('connection',async(ws,req)=>{
 try{
  const u=new URL(req.url,'http://localhost');const token=u.searchParams.get('token');const p=jwt.verify(token,JWT_SECRET);const row=await rowForUser(p.id);if(!row)throw new Error('no user');
  const uid=String(p.id);if(!sockets.has(uid))sockets.set(uid,new Set());sockets.get(uid).add(ws);socketMeta.set(uid,{isAdmin:isAdminRow(row)});ws.userId=uid;
  ws.send(JSON.stringify({type:'connected'}));ws.on('close',()=>{sockets.get(uid)?.delete(ws);if(!sockets.get(uid)?.size){sockets.delete(uid);socketMeta.delete(uid)}});
 }catch{ws.close(1008,'Unauthorized');}
});
setInterval(expireWaitingEntries,1000);
setInterval(()=>{const cutoff=Date.now()-10*60*1000;for(const [id,q] of queueEntries){if(q.status!=='waiting'&&q.updatedAt&&q.updatedAt<cutoff)queueEntries.delete(id);}},60*1000);

app.get('/',(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/{*splat}',(req,res)=>{if(req.path.startsWith('/api/')||req.path==='/health')return res.status(404).json({error:'Not found'});res.sendFile(path.join(__dirname,'public','index.html'));});

async function boot(){
 await pool.query(`
  CREATE TABLE IF NOT EXISTS users(
   id BIGSERIAL PRIMARY KEY,username VARCHAR(20) UNIQUE NOT NULL,password_hash TEXT NOT NULL,nickname VARCHAR(12) NOT NULL,
   avatar VARCHAR(32) NOT NULL DEFAULT '🎲',state JSONB NOT NULL,is_admin BOOLEAN NOT NULL DEFAULT FALSE,
   coop_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),arena_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),starter_granted BOOLEAN NOT NULL DEFAULT FALSE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS coop_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS arena_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS starter_granted BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
 `);
 await pool.query('UPDATE users SET is_admin=TRUE WHERE username=$1',[ADMIN_USERNAME]);
 server.listen(PORT,'0.0.0.0',()=>console.log(`RD2 server listening on ${PORT}`));
}
boot().catch(err=>{console.error(err);process.exit(1)});
