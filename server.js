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
  deck: ['blue','cyan','red','green','yellow'],
  unlocked: ['blue','cyan','red','green','yellow'], treeUnlocked: [], diceLevels: {blue:1,cyan:1,red:1,green:1,yellow:1}, traitLevels: {}, treeLevels: {allDamage:1,attackSpeed:1,spGain:1},
  passXP: 0, passRewardsClaimed: [], lucky: 0, bountyClaimed: 0, bountyBestKills: 0,
  quests: [0,0,0], difficulty: 'normal'
};

const PASS_REWARDS = Array.from({length:50},(_,i)=>({xp:(i+1)*10,label:i%5===4?`주사위 ${20+i*5}`:(i%3===0?`코인 ${(i+1)*100}`:`협동전 티켓 1`),field:i%5===4?'dice':(i%3===0?'coin':'coopTicket'),amount:i%5===4?20+i*5:(i%3===0?(i+1)*100:1)}));

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
    deck:(()=>{const src=Array.isArray(s.deck)?s.deck:[];const out=[];for(const x of src){if(typeof x==='string'&&!out.includes(x))out.push(x);if(out.length>=5)break;}for(const x of DEFAULT_STATE.deck)if(!out.includes(x)&&out.length<5)out.push(x);return out;})(),
    unlocked:(()=>{const src=Array.isArray(s.unlocked)?s.unlocked:[];const out=[];for(const x of src){if(typeof x==='string'&&!out.includes(x))out.push(x);if(out.length>=20)break;}for(const x of DEFAULT_STATE.unlocked)if(!out.includes(x)&&out.length<20)out.push(x);return out;})(),
    treeUnlocked:Array.isArray(s.treeUnlocked)?[...new Set(s.treeUnlocked)].slice(0,100):[],
    diceLevels:s.diceLevels&&typeof s.diceLevels==='object'?s.diceLevels:{blue:1,cyan:1,red:1,green:1,yellow:1},
    traitLevels:s.traitLevels&&typeof s.traitLevels==='object'?s.traitLevels:{},
    treeLevels:s.treeLevels&&typeof s.treeLevels==='object'?{allDamage:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.allDamage||1)))),attackSpeed:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.attackSpeed||1)))),spGain:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.spGain||1))))}:{allDamage:1,attackSpeed:1,spGain:1},
    passXP:Math.max(0,Math.min(500,Math.floor(Number(s.passXP??0)))),
    passRewardsClaimed:Array.isArray(s.passRewardsClaimed)?[...new Set(s.passRewardsClaimed.map(Number).filter(Number.isInteger))]:[],
    lucky:Math.max(0,Math.floor(Number(s.lucky??0))),
    quests:Array.isArray(s.quests)?s.quests.slice(0,20).map(Number):[0,0,0],
    bountyClaimed:Math.max(0,Math.floor(Number(s.bountyClaimed??0))),
    bountyBestKills:Math.max(0,Math.floor(Number(s.bountyBestKills??0))),
    difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:'normal'
  };
}
function isAdminRow(row){return Boolean(row && (row.is_admin || String(row.username||'').toLowerCase()===ADMIN_USERNAME.toLowerCase()));}
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

async function consumeModeTicket(userId, mode){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const t=await accrueTicketsTx(client,userId);
    if(!t) throw new Error('계정을 찾을 수 없습니다.');
    const state=cleanState(t.state);
    const field=mode==='battle'?'arenaTicket':'coopTicket';
    if(Number(state.currencies[field]||0)<=0){
      throw new Error(mode==='battle'?'아레나 티켓이 부족합니다.':'협동전 티켓이 부족합니다.');
    }
    state.currencies[field]-=1;
    const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[userId])).rows[0];
    await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),userId]);
    const fresh=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[userId])).rows[0];
    await client.query('COMMIT');
    const extra={coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext};
    broadcast(userId,stateMessage(fresh,state,extra));
    broadcastAdmins({type:'admin_state_update',username:fresh.username});
    return {row:fresh,state,coopNext:t.coopNext,arenaNext:t.arenaNext};
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
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
const TREE_NODES=[{id:0,next:[1,2]},{id:1,type:'blue',next:[3,4]},{id:2,type:'cyan',next:[5,6]},{id:3,type:'red',next:[7,8]},{id:4,type:'green',next:[8,9]},{id:5,type:'yellow',next:[9,10]},{id:6,type:'pink',next:[10,11]},{id:7,type:'purple',next:[11,12]},{id:8,type:'orange',next:[13]},{id:9,type:'black',next:[13,14]},{id:10,type:'white',next:[14,15]},{id:11,type:'silver',next:[15,16]},{id:12,type:'gold',next:[16,17]},{id:13,type:'aqua',next:[17]},{id:14,type:'violet',next:[18]},{id:15,type:'lime',next:[18]},{id:16,type:'navy',next:[19]},{id:17,type:'coral',next:[19]},{id:18,type:'mint',next:[20]},{id:19,type:'rose',next:[21]},{id:20,type:'prism',next:[21]},{id:21,type:'cosmic',next:[]}];
const TREE_TYPES = new Set(['blue','cyan','red','green','yellow','pink','purple','orange','black','white','silver','gold','aqua','violet','lime','navy','coral','mint','rose','prism','cosmic']);
const TREE_UPGRADES = new Set(['allDamage','attackSpeed','spGain']);
function treeNodeById(id){return TREE_NODES.find(n=>n.id===Number(id));}
function treeParentFor(id){return TREE_NODES.find(n=>n.next.includes(Number(id)));}
function treeUpgradeCostServer(level){const lv=Math.max(1,Number(level)||1);if(lv>=50)return {coin:0,dice:0};const next=lv+1;return next%5===0?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};}
function treeStatePayload(state){const clean=cleanState(state);if(!Array.isArray(clean.treeUnlocked))clean.treeUnlocked=[];if(!Array.isArray(clean.unlocked))clean.unlocked=[];if(!clean.diceLevels)clean.diceLevels={};if(!clean.treeLevels)clean.treeLevels={allDamage:1,attackSpeed:1,spGain:1};for(const id of clean.treeUnlocked){const node=treeNodeById(id);if(node?.type&&!clean.unlocked.includes(node.type)){clean.unlocked.push(node.type);if(!clean.diceLevels[node.type])clean.diceLevels[node.type]=1;}}return clean;}
app.post('/api/tree/unlock',auth,async(req,res)=>{const nodeId=Number(req.body.nodeId),node=treeNodeById(nodeId);if(!node||node.id===0)return res.status(400).json({error:'해금할 수 없는 트리 노드입니다.'});const client=await pool.connect();try{await client.query('BEGIN');const ticketed=await accrueTicketsTx(client,req.auth.id);if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');const state=treeStatePayload(ticketed.state);if(state.treeUnlocked.includes(nodeId))throw new Error('이미 해금된 노드입니다.');const parent=treeParentFor(nodeId);if(!parent||(parent.id!==0&&!state.treeUnlocked.includes(parent.id)))throw new Error('먼저 연결된 앞의 노드를 해금하세요.');if(state.currencies.dice<8)throw new Error('주사위 재화가 부족합니다. 해금에는 8개가 필요합니다.');state.currencies.dice-=8;state.treeUnlocked.push(nodeId);if(node.type&&TREE_TYPES.has(node.type)){if(!state.unlocked.includes(node.type))state.unlocked.push(node.type);if(!state.diceLevels[node.type])state.diceLevels[node.type]=1;}if(node.upgrade&&!state.treeLevels[node.upgrade])state.treeLevels[node.upgrade]=1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};broadcast(req.auth.id,stateMessage(row,state,extra));broadcastAdmins({type:'admin_state_update',username:row.username});res.json({ok:true,state,coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 트리 해금 실패'});}finally{client.release();}});
app.post('/api/dice/trait',auth,async(req,res)=>{const type=String(req.body.type||'');const TRAITS={blue:'공격력 강화',cyan:'빙결 강화',red:'치명타 강화',green:'독 피해 강화',yellow:'공격 범위 강화',pink:'분열 강화',purple:'성장 강화',orange:'연쇄 번개 강화',black:'암흑 피해 강화',white:'성스러운 방어',silver:'철벽 생존',gold:'코인 획득 강화',aqua:'파동 범위 강화',violet:'공허 피해 강화',lime:'회복 강화',navy:'폭격 강화',coral:'산호 피해 강화',mint:'지속 피해 강화',rose:'치명타 강화 II',prism:'무지개 피해 강화',cosmic:'우주 피해 강화'};if(!TRAITS[type])return res.status(400).json({error:'지원하지 않는 주사위입니다.'});const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,req.auth.id);if(!t)throw new Error('계정을 찾을 수 없습니다.');const state=cleanState(t.state);const lv=Math.max(0,Math.floor(Number(state.diceLevels[type]||0)));if(!state.unlocked.includes(type))throw new Error('먼저 주사위를 해금하세요.');if(lv<10)throw new Error('다이스 트리에서 이 주사위를 10레벨까지 올려야 특성을 구매할 수 있습니다.');const current=Math.max(0,Math.floor(Number(state.traitLevels?.[type]||0)));if(current>=5)throw new Error('특성은 최대 5단계입니다.');const TRAIT_COSTS=[20000,50000,100000,200000,500000];const cost=TRAIT_COSTS[current]||500000;if(state.currencies.coin<cost)throw new Error(`특성 구매에는 코인 ${cost.toLocaleString()}개가 필요합니다.`);state.currencies.coin-=cost;state.traitLevels[type]=current+1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');broadcast(req.auth.id,stateMessage(row,state,{coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext}));res.json({ok:true,state,trait:{type,label:TRAITS[type],level:current+1},coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'특성 구매 실패'});}finally{client.release();}});

app.post('/api/tree/upgrade',auth,async(req,res)=>{const key=String(req.body.type||'');if(!TREE_TYPES.has(key)&&!TREE_UPGRADES.has(key))return res.status(400).json({error:'지원하지 않는 업그레이드입니다.'});const client=await pool.connect();try{await client.query('BEGIN');const ticketed=await accrueTicketsTx(client,req.auth.id);if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');const state=treeStatePayload(ticketed.state);let level; if(TREE_TYPES.has(key)){const node=state.treeUnlocked.map(treeNodeById).find(n=>n&&n.type===key);if(!state.unlocked.includes(key)&&!node)throw new Error('먼저 다이스 트리에서 이 주사위를 해금하세요.');if(node&&!state.unlocked.includes(key)){state.unlocked.push(key);if(!state.diceLevels[key])state.diceLevels[key]=1;}level=Math.max(1,Math.floor(Number(state.diceLevels[key]||1)));}else{const node=state.treeUnlocked.map(treeNodeById).find(n=>n&&n.upgrade===key);if(!node)throw new Error('먼저 다이스 트리에서 이 업그레이드를 해금하세요.');level=Math.max(1,Math.floor(Number(state.treeLevels[key]||1)));}if(level>=50)throw new Error('이미 50레벨입니다.');const cost=treeUpgradeCostServer(level);if(cost.dice&&state.currencies.dice<cost.dice)throw new Error(`레벨 ${level+1} 업그레이드에는 주사위 재화 ${cost.dice}개가 필요합니다.`);if(cost.coin&&state.currencies.coin<cost.coin)throw new Error(`레벨 ${level+1} 업그레이드에는 코인 ${cost.coin}개가 필요합니다.`);if(cost.dice)state.currencies.dice-=cost.dice;if(cost.coin)state.currencies.coin-=cost.coin;if(TREE_TYPES.has(key))state.diceLevels[key]=level+1;else state.treeLevels[key]=level+1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};broadcast(req.auth.id,stateMessage(row,state,extra));broadcastAdmins({type:'admin_state_update',username:row.username});res.json({ok:true,state,upgrade:{type:key,fromLevel:level,toLevel:level+1,label:TREE_UPGRADES.has(key)?'전역 업그레이드 레벨 '+(level+1):(key+' 레벨 '+(level+1))},coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 업그레이드 실패'});}finally{client.release();}});

// ---------------- Battle result persistence ----------------
app.post('/api/battle/finish',auth,async(req,res)=>{
 try{
   const mode=req.body?.mode==='battle'?'battle':'coop';
   const matchId=String(req.body?.matchId||'');
   const kills=Math.max(0,Math.floor(Number(req.body?.kills||0)));
   if(mode!=='coop'||!matchId)return res.json({ok:true,rewardCoins:0,state:undefined});
   const client=await pool.connect();
   try{await client.query('BEGIN');
     const row=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.auth.id])).rows[0];
     if(!row)throw new Error('계정을 찾을 수 없습니다.');
     const state=cleanState(row.state);
     const previousBest=Math.max(0,Math.floor(Number(state.bountyBestKills||0)));
     state.bountyBestKills=Math.max(previousBest,kills);
     await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);
     const fresh=(await client.query('SELECT * FROM users WHERE id=$1',[req.auth.id])).rows[0];
     await client.query('COMMIT');
     broadcast(req.auth.id,stateMessage(fresh,state,{battleBestKills:state.bountyBestKills,reason:req.body?.reason||'finished'}));
     res.json({ok:true,rewardCoins:0,bestKills:state.bountyBestKills,state});
   } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
 }catch(e){res.status(400).json({error:e.message||'전투 결과 저장 실패'});}
});

app.post('/api/bounty/claim',auth,async(req,res)=>{
 try{
   const client=await pool.connect();
   try{await client.query('BEGIN');
     const row=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.auth.id])).rows[0];
     if(!row)throw new Error('계정을 찾을 수 없습니다.');
     const state=cleanState(row.state);
     const best=Math.max(0,Math.floor(Number(state.bountyBestKills||0)));
     const reached=Math.floor(best/100);
     const claimed=Math.max(0,Math.floor(Number(state.bountyClaimed||0)));
     if(reached<=claimed)throw new Error('아직 받을 토벌 보상이 없습니다.');
     const count=reached-claimed;
     const reward=count*500;
     state.currencies.coin+=reward;
     state.bountyClaimed=reached;
     await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);
     const fresh=(await client.query('SELECT * FROM users WHERE id=$1',[req.auth.id])).rows[0];
     await client.query('COMMIT');
     broadcast(req.auth.id,stateMessage(fresh,state,{battleRewardCoins:reward,reason:'bounty_claim'}));
     res.json({ok:true,rewardCoins:reward,bestKills:best,state});
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }catch(e){res.status(400).json({error:e.message||'토벌 보상 수령 실패'});}
});

// ---------------- Matchmaking ----------------
const waitingQueue=[];const queueEntries=new Map();const matches=new Map();
function matchPlayerKey(id){return String(id);}
function publicMatchForUser(match,uid){
  const me=matchPlayerKey(uid);
  const otherId=match.players.map(matchPlayerKey).find(x=>x!==me);
  return {matchId:match.id,mode:match.mode,opponentType:match.opponentType||'player',opponentNickname:match.playerNames?.[otherId]||'플레이어',state:match.playerStates?.[me]||null,opponentState:match.playerStates?.[otherId]||null,startedAt:match.startedAt||match.createdAt,status:match.status};
}
async function finalizeMatchRewards(match,reason='finished'){
 if(!match||match.rewardsFinalized)return;
 match.rewardsFinalized=true;
 for(const pid of match.players){
   try{
     const uid=String(pid), st=match.playerStates?.[uid];
     if(!st||match.mode!=='coop')continue;
     const kills=Math.max(0,Math.floor(Number(st.kills||0)));
     const client=await pool.connect();
     try{await client.query('BEGIN');
       const row=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[pid])).rows[0];
       if(!row){await client.query('ROLLBACK');continue;}
       const state=cleanState(row.state);
       state.bountyBestKills=Math.max(Math.floor(Number(state.bountyBestKills||0)),kills);
       await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),pid]);
       const fresh=(await client.query('SELECT * FROM users WHERE id=$1',[pid])).rows[0];
       await client.query('COMMIT');
       broadcast(pid,stateMessage(fresh,state,{battleBestKills:state.bountyBestKills,reason}));
     }catch(e){await client.query('ROLLBACK');console.warn('save best bounty',e.message)}finally{client.release();}
   }catch(e){console.warn('finalize player bounty',e.message)}
 }
}

async function leaveUserFromMatch(uid,explicit=false){
  const id=matchPlayerKey(uid);
  for(const match of matches.values()){
    if(match.status!=='active'&&match.status!=='matched')continue;
    if(!match.players.map(matchPlayerKey).includes(id))continue;
    match.status='active';
    match.disconnected=match.disconnected||new Set();
    match.disconnected.add(id);
    if(explicit)match.explicitLeft=match.explicitLeft||new Set(),match.explicitLeft.add(id);
    if(match.players.every(x=>match.disconnected.has(matchPlayerKey(x)))){
      match.status='ended';match.endedAt=Date.now();
      await finalizeMatchRewards(match,'both_left');
      for(const q of queueEntries.values())if(q.matchId===match.id)q.status='ended',q.updatedAt=Date.now();
      return {ended:true,match};
    }
    return {ended:false,match};
  }
  return null;
}
function removeWaiting(id){const i=waitingQueue.indexOf(id);if(i>=0)waitingQueue.splice(i,1);}
function expireWaitingEntries(){const now=Date.now();for(const id of [...waitingQueue]){const q=queueEntries.get(id);if(!q){removeWaiting(id);continue;}if(q.status==='waiting'&&now-q.createdAt>=MATCH_WAIT_MS){q.status='ai';q.updatedAt=now;removeWaiting(q.id);}}}
app.post('/api/match/join',auth,async(req,res)=>{try{expireWaitingEntries();const mode=req.body?.mode==='battle'?'battle':'coop';const existing=[...queueEntries.values()].find(q=>q.userId===req.auth.id&&q.status==='waiting'&&q.mode===mode);if(existing){if(Date.now()-existing.createdAt>=MATCH_WAIT_MS){existing.status='ai';removeWaiting(existing.id);return res.json({status:'ai',queueId:existing.id,opponentType:'ai',opponentNickname:'AI 플레이어',mode});}return res.json({status:'waiting',queueId:existing.id,elapsed:Math.floor((Date.now()-existing.createdAt)/1000),mode});}const charged=await consumeModeTicket(req.auth.id,mode);const opponent=waitingQueue.map(id=>queueEntries.get(id)).find(q=>q&&q.status==='waiting'&&q.userId!==req.auth.id&&q.mode===mode);const queueId=crypto.randomUUID();if(opponent){removeWaiting(opponent.id);const matchId=crypto.randomUUID(),now=Date.now();const match={id:matchId,players:[opponent.userId,req.auth.id],createdAt:now,startedAt:now,status:'active',opponentType:'player',mode,disconnected:new Set(),explicitLeft:new Set(),playerNames:{[String(opponent.userId)]:opponent.username||'플레이어',[String(req.auth.id)]:req.auth.username||'플레이어'},playerStates:{}};matches.set(matchId,match);opponent.status='matched';opponent.matchId=matchId;opponent.updatedAt=now;queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:now,status:'matched',matchId,mode});const oppRow=await rowForUser(opponent.userId),nickname=oppRow?.nickname||'플레이어';const result={status:'matched',queueId,matchId,opponentType:'player',opponentNickname:nickname,mode,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext};broadcast(opponent.userId,{type:'matched',queueId:opponent.id,matchId,opponentType:'player',opponentNickname:charged.row.nickname||'플레이어',mode});return res.json(result);}queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:Date.now(),status:'waiting',mode});waitingQueue.push(queueId);res.json({status:'waiting',queueId,elapsed:0,mode,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext});}catch(e){console.error(e);res.status(400).json({error:e.message||'매칭을 시작할 수 없습니다.'});}});
app.get('/api/match/status/:queueId',auth,async(req,res)=>{const q=queueEntries.get(req.params.queueId);if(!q||q.userId!==req.auth.id)return res.status(404).json({error:'매칭 정보를 찾을 수 없습니다.'});if(q.status==='waiting'&&Date.now()-q.createdAt>=MATCH_WAIT_MS){q.status='ai';q.updatedAt=Date.now();removeWaiting(q.id);}if(q.status==='matched'){const match=matches.get(q.matchId),other=match?.players?.find(x=>String(x)!==String(q.userId));let nickname='플레이어';if(other){const r=await rowForUser(other);if(r)nickname=r.nickname;}return res.json({status:'matched',queueId:q.id,matchId:q.matchId,opponentType:'player',opponentNickname:nickname,mode:q.mode||match?.mode||'coop'});}if(q.status==='ai')return res.json({status:'ai',queueId:q.id,opponentType:'ai',opponentNickname:'AI 플레이어',mode:q.mode||'coop'});const elapsed=Math.floor((Date.now()-q.createdAt)/1000);res.json({status:'waiting',queueId:q.id,elapsed,remaining:Math.max(0,Math.ceil((MATCH_WAIT_MS-(Date.now()-q.createdAt))/1000)),mode:q.mode||'coop'});});
app.get('/api/match/current',auth,async(req,res)=>{expireWaitingEntries();const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id&&['waiting','matched','ai'].includes(x.status));if(!q)return res.json({status:'none'});res.json({status:q.status,queueId:q.id,matchId:q.matchId||null,elapsed:Math.floor((Date.now()-q.createdAt)/1000),mode:q.mode||'coop'});});
app.get('/api/match/active',auth,async(req,res)=>{
  const uid=String(req.auth.id);
  for(const match of matches.values()){
    if(match.status==='ended')continue;
    const anyConnected=match.players.some(pid=>Boolean(sockets?.get(String(pid))?.size));
    if(!anyConnected){match.status='ended';match.endedAt=Date.now();await finalizeMatchRewards(match,'both_disconnected');continue;}
    if(!match.players.map(String).includes(uid))continue;
    match.disconnected=match.disconnected||new Set();
    match.disconnected.delete(uid);
    match.explicitLeft?.delete(uid);
    const payload=publicMatchForUser(match,uid);
    res.json({ok:true,active:true,...payload});
    // Notify the remaining player that this user has returned.
    const otherId=match.players.map(String).find(x=>x!==uid);
    const set=sockets?.get(otherId);
    if(set){for(const ws of set)if(ws.readyState===1)ws.send(JSON.stringify({type:'match_reconnected',matchId:match.id,userId:uid,state:match.playerStates?.[uid]||null}));}
    return;
  }
  res.json({ok:true,active:false});
});
app.post('/api/match/leave',auth,async(req,res)=>{
  try{
    const out=await leaveUserFromMatch(req.auth.id,true);
    res.json({ok:true,active:Boolean(out&&!out.ended),ended:Boolean(out?.ended)});
  }catch(e){res.status(400).json({error:e.message||'전투에서 나갈 수 없습니다.'});}
});

app.post('/api/match/cancel',auth,async(req,res)=>{const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id&&x.status==='waiting');if(!q)return res.json({ok:true,refunded:false});q.status='cancelled';removeWaiting(q.id);queueEntries.delete(q.id);const out=await refundModeTicket(req.auth.id,q.mode||'coop');const fresh=await getFresh(req.auth.id);res.json({ok:true,refunded:true,state:fresh.state,coopTicketNextIn:fresh.coopNext,arenaTicketNextIn:fresh.arenaNext});});

// ---------------- Admin ----------------
async function requireAdmin(req,res,next){try{const row=await rowForUser(req.auth.id);if(!isAdminRow(row))return res.status(403).json({error:'관리자 권한이 없습니다.'});req.adminRow=row;next();}catch(e){console.error(e);res.status(500).json({error:'관리자 권한 확인 실패'});}}
async function adminTarget(username){const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE username=$1',[username]);return rows[0];}

async function adminOrSystemAdjust(userId,field,delta,notify=true){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);
   const isPass=field==='passXP', isLucky=field==='lucky';
   if(isPass)s.passXP=Math.max(0,Math.min(500,s.passXP+Math.floor(Number(delta))));
   else if(isLucky)s.lucky=Math.max(0,s.lucky+Math.floor(Number(delta)));
   else if(['coin','dice','diamond','arenaTicket','coopTicket'].includes(field)){const v=s.currencies[field]+Math.floor(Number(delta));if(v<0)throw new Error('재화는 0보다 작아질 수 없습니다.');s.currencies[field]=v;}
   else throw new Error('지원하지 않는 재화입니다.');
   await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(s),userId]);const row=(await client.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');
   if(notify){const extra={coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext};broadcast(userId,stateMessage(row,s,extra));broadcastAdmins({type:'admin_state_update',username:row.username});}
   return s;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function adminSetValue(userId,field,value){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);const v=Math.floor(Number(value));if(v<0||!Number.isFinite(v))throw new Error('설정값은 0 이상의 정수여야 합니다.');
   if(field==='passXP')s.passXP=Math.min(500,v);
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
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,req.auth.id);if(!t)throw new Error('계정을 찾을 수 없습니다.');const s=cleanState(t.state);if(s.lucky<1)throw new Error('행운의 주사위가 없습니다.');s.lucky-=1;const r=Math.floor(Math.random()*3);let reward;if(r===0){s.currencies.coin+=2000;reward={label:'🍀 코인 2,000 획득!'};}else if(r===1){const diceReward=1+Math.floor(Math.random()*3);s.currencies.dice+=diceReward;reward={label:`🍀 주사위 재화 ${diceReward}개 획득!`};}else{s.passXP=Math.min(500,s.passXP+10);reward={label:'🍀 다이스 패스 XP +10!'};}
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
  ws.send(JSON.stringify({type:'connected'}));
  ws.on('message',raw=>{
    try{
      const m=JSON.parse(String(raw||'{}'));
      if(!m||!['battle_join','summon','merge','speed','battle_progress','battle_game_over'].includes(m.type))return;
      const match=matches.get(String(m.matchId||''));
      if(!match||!match.players.map(String).includes(uid))return;
      match.disconnected=match.disconnected||new Set();
      match.disconnected.delete(uid);
      if(m.type==='battle_join' || m.type==='battle_progress'){
        match.playerStates=match.playerStates||{};
        match.playerStates[uid]={...(match.playerStates[uid]||{}),...m.stateSnapshot};
      }
      if(m.type==='battle_game_over'){match.status='ended';match.endedAt=Date.now();match.playerStates=match.playerStates||{};match.playerStates[uid]={...(match.playerStates[uid]||{}),...(m.stateSnapshot||{})};finalizeMatchRewards(match,'finished');}
      const payload=JSON.stringify({...m,fromUserId:uid});
      for(const pid of match.players.map(String)){
        if(pid===uid)continue;
        const set=sockets.get(pid);if(!set)continue;
        for(const client of set)if(client.readyState===1)client.send(payload);
      }
    }catch(e){console.warn('ws battle relay',e.message)}
  });
  ws.on('close',async()=>{
    sockets.get(uid)?.delete(ws);
    if(!sockets.get(uid)?.size){
      sockets.delete(uid);socketMeta.delete(uid);
      const out=await leaveUserFromMatch(uid,false);
      if(out?.ended){
        const payload=JSON.stringify({type:'battle_game_over',matchId:out.match.id,title:'전투 종료',reason:'both_left'});
        for(const pid of out.match.players.map(String)){const set=sockets.get(pid);if(set)for(const c of set)if(c.readyState===1)c.send(payload);}
      }
    }
  });
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
 await pool.query('UPDATE users SET is_admin=TRUE WHERE LOWER(username)=LOWER($1)',[ADMIN_USERNAME]);
 server.listen(PORT,'0.0.0.0',()=>console.log(`RD2 server listening on ${PORT}`));
}
boot().catch(err=>{console.error(err);process.exit(1)});
