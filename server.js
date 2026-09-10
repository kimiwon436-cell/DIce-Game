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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_STATE = {
  profile: { nickname: '', avatar: '🎲' },
  currencies: { coin: 100, dice: 0, diamond: 0, arenaTicket: 0, coopTicket: 0 },
  deck: ['blue','blue','blue','blue','blue'],
  unlocked: [],
  treeUnlocked: [],
  diceLevels: {},
  passXP: 0,
  lucky: 0,
  quests: [0,0,0],
  difficulty: 'normal'
};

function tokenFor(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req,res,next){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({error:'로그인이 필요합니다.'});
  try { req.auth=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch { return res.status(401).json({error:'로그인이 만료되었습니다.'}); }
}

function cleanState(raw){
  const s = raw || {};
  return {
    profile: { nickname: String(s.profile?.nickname || ''), avatar: String(s.profile?.avatar || '🎲').slice(0,8) },
    currencies: {
      coin: Math.max(0, Number(s.currencies?.coin ?? DEFAULT_STATE.currencies.coin)),
      dice: Math.max(0, Number(s.currencies?.dice ?? DEFAULT_STATE.currencies.dice)),
      diamond: Math.max(0, Number(s.currencies?.diamond ?? 0)),
      arenaTicket: Math.max(0, Number(s.currencies?.arenaTicket ?? 0)),
      coopTicket: Math.max(0, Number(s.currencies?.coopTicket ?? 0))
    },
    deck: Array.isArray(s.deck) ? s.deck.slice(0,5) : [...DEFAULT_STATE.deck],
    unlocked: Array.isArray(s.unlocked) ? [...new Set(s.unlocked)].slice(0,100) : [],
    treeUnlocked: Array.isArray(s.treeUnlocked) ? [...new Set(s.treeUnlocked)].slice(0,100) : [],
    diceLevels: s.diceLevels && typeof s.diceLevels==='object' ? s.diceLevels : {},
    passXP: Math.max(0, Math.min(100, Number(s.passXP ?? 0))),
    lucky: Math.max(0, Number(s.lucky ?? 0)),
    quests: Array.isArray(s.quests) ? s.quests.slice(0,20).map(Number) : [0,0,0],
    difficulty: ['easy','normal','hard'].includes(s.difficulty) ? s.difficulty : 'normal'
  };
}

const ADMIN_USERNAME = 'kimsiwon';
const COOP_TICKET_INTERVAL_MS = 5 * 60 * 1000;

async function rowForUser(id){
  const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at FROM users WHERE id=$1',[id]);
  return rows[0];
}

async function publicUser(row){
  return { id: row.id, username: row.username, nickname: row.nickname, avatar: row.avatar, isAdmin: Boolean(row.is_admin || row.username === ADMIN_USERNAME) };
}

function ticketInfoFromRow(row){
  const last = row.coop_ticket_at ? new Date(row.coop_ticket_at).getTime() : Date.now();
  const elapsed = Math.max(0, Date.now() - last);
  const cycles = Math.floor(elapsed / COOP_TICKET_INTERVAL_MS);
  const nextIn = COOP_TICKET_INTERVAL_MS - (elapsed % COOP_TICKET_INTERVAL_MS);
  return {cycles, nextIn};
}

async function accrueCoopTickets(userId){
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at FROM users WHERE id=$1 FOR UPDATE',[userId]);
    const row=rows[0];
    if(!row){await client.query('ROLLBACK');return null;}
    const {cycles,nextIn}=ticketInfoFromRow(row);
    let state=cleanState(row.state);
    let ticketAt=row.coop_ticket_at ? new Date(row.coop_ticket_at).getTime() : Date.now();
    if(cycles>0){
      state.currencies.coopTicket += cycles;
      ticketAt += cycles * COOP_TICKET_INTERVAL_MS;
      await client.query('UPDATE users SET state=$1::jsonb, coop_ticket_at=to_timestamp($2/1000.0), updated_at=NOW() WHERE id=$3',[JSON.stringify(state),ticketAt,userId]);
    }
    await client.query('COMMIT');
    return {state,nextIn:COOP_TICKET_INTERVAL_MS-(Math.max(0,Date.now()-ticketAt)%COOP_TICKET_INTERVAL_MS)};
  }catch(e){
    await client.query('ROLLBACK'); throw e;
  }finally{client.release();}
}

async function mutateCurrency(userId,currency,delta){
  const allowed=['coin','dice','diamond','arenaTicket','coopTicket','lucky'];
  if(!allowed.includes(currency)) throw new Error('지원하지 않는 재화입니다.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT id,state,coop_ticket_at FROM users WHERE id=$1 FOR UPDATE',[userId]);
    if(!rows[0]) throw new Error('계정을 찾을 수 없습니다.');
    const row=rows[0];
    let state=cleanState(row.state);
    const {cycles}=ticketInfoFromRow(row);
    let ticketAt=row.coop_ticket_at ? new Date(row.coop_ticket_at).getTime() : Date.now();
    if(cycles>0){
      state.currencies.coopTicket += cycles;
      ticketAt += cycles*COOP_TICKET_INTERVAL_MS;
    }
    const current=Number(state.currencies[currency]||0);
    const next=current+Number(delta);
    if(!Number.isFinite(next) || next<0) throw new Error('재화는 0보다 작아질 수 없습니다.');
    state.currencies[currency]=Math.floor(next);
    await client.query('UPDATE users SET state=$1::jsonb,coop_ticket_at=to_timestamp($2/1000.0),updated_at=NOW() WHERE id=$3',[JSON.stringify(state),ticketAt,userId]);
    await client.query('COMMIT');
    return state;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function mutatePassXP(userId,delta){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT state FROM users WHERE id=$1 FOR UPDATE',[userId]);
    if(!rows[0]) throw new Error('계정을 찾을 수 없습니다.');
    const state=cleanState(rows[0].state); state.passXP=Math.max(0,Math.min(100,state.passXP+Number(delta)));
    await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),userId]);
    await client.query('COMMIT');
    return state;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function requireAdmin(req,res,next){
  try{
    const row=await rowForUser(req.auth.id);
    if(!row || !(row.is_admin || row.username===ADMIN_USERNAME)) return res.status(403).json({error:'관리자 권한이 없습니다.'});
    req.adminRow=row; next();
  }catch(e){console.error(e);res.status(500).json({error:'관리자 권한 확인 실패'});}
}

app.get('/health', async (_req,res)=>{
  try { await pool.query('SELECT 1'); res.json({ok:true, db:true}); }
  catch(e){ res.status(503).json({ok:false, db:false}); }
});

app.post('/api/auth/register', async (req,res)=>{
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const nickname=String(req.body.nickname||'').trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({error:'아이디는 영문, 숫자, _ 3~20자여야 합니다.'});
  if(password.length<6) return res.status(400).json({error:'비밀번호는 6자 이상이어야 합니다.'});
  if(nickname.length<1 || nickname.length>12) return res.status(400).json({error:'닉네임은 1~12자여야 합니다.'});
  const hash=await bcrypt.hash(password,12);
  const state=cleanState({ ...DEFAULT_STATE, profile:{nickname,avatar:'🎲'} });
  try{
    const {rows}=await pool.query(
      'INSERT INTO users(username,password_hash,nickname,avatar,state,is_admin,coop_ticket_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,NOW()) RETURNING id,username,nickname,avatar,state,is_admin,coop_ticket_at',
      [username,hash,nickname,'🎲',JSON.stringify(state),username===ADMIN_USERNAME]
    );
    const user=rows[0];
    res.json({token:tokenFor(user),user:await publicUser(user),state:cleanState(user.state),coopTicketNextIn:COOP_TICKET_INTERVAL_MS});
  }catch(e){
    if(e.code==='23505') return res.status(409).json({error:'이미 사용 중인 아이디입니다.'});
    console.error(e); res.status(500).json({error:'회원가입 실패'});
  }
});

app.post('/api/auth/login', async (req,res)=>{
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const {rows}=await pool.query('SELECT id,username,password_hash,nickname,avatar,state,is_admin,coop_ticket_at FROM users WHERE username=$1',[username]);
  const user=rows[0];
  if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'아이디 또는 비밀번호가 올바르지 않습니다.'});
  const accrued=await accrueCoopTickets(user.id);
  const fresh=await rowForUser(user.id);
  res.json({token:tokenFor(user),user:await publicUser(fresh),state:accrued?.state||cleanState(fresh.state),coopTicketNextIn:accrued?.nextIn??COOP_TICKET_INTERVAL_MS});
});

app.post('/api/auth/logout', auth, (_req,res)=>res.json({ok:true}));

app.get('/api/me', auth, async (req,res)=>{
  const accrued=await accrueCoopTickets(req.auth.id);
  const user=await rowForUser(req.auth.id);
  if(!user) return res.status(404).json({error:'계정을 찾을 수 없습니다.'});
  res.json({user:await publicUser(user),state:accrued?.state||cleanState(user.state),coopTicketNextIn:accrued?.nextIn??COOP_TICKET_INTERVAL_MS});
});

app.put('/api/me/state', auth, async (req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT state,coop_ticket_at FROM users WHERE id=$1 FOR UPDATE',[req.auth.id]);
    if(!rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'계정을 찾을 수 없습니다.'});}
    const current=cleanState(rows[0].state);
    const incoming=cleanState(req.body);
    const {cycles}=ticketInfoFromRow(rows[0]);
    let ticketAt=rows[0].coop_ticket_at ? new Date(rows[0].coop_ticket_at).getTime() : Date.now();
    current.currencies={...incoming.currencies};
    current.currencies.coopTicket = current.currencies.coopTicket + cycles;
    if(cycles>0) ticketAt += cycles*COOP_TICKET_INTERVAL_MS;
    current.profile=incoming.profile; current.deck=incoming.deck; current.unlocked=incoming.unlocked; current.treeUnlocked=incoming.treeUnlocked;
    current.diceLevels=incoming.diceLevels; current.passXP=incoming.passXP; current.lucky=incoming.lucky; current.quests=incoming.quests; current.difficulty=incoming.difficulty;
    await client.query('UPDATE users SET state=$1::jsonb,nickname=$2,avatar=$3,coop_ticket_at=to_timestamp($4/1000.0),updated_at=NOW() WHERE id=$5',
      [JSON.stringify(current),current.profile.nickname,current.profile.avatar,ticketAt,req.auth.id]);
    await client.query('COMMIT');
    res.json({ok:true,state:current,coopTicketNextIn:COOP_TICKET_INTERVAL_MS-(Math.max(0,Date.now()-ticketAt)%COOP_TICKET_INTERVAL_MS)});
  }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'저장 실패'});}finally{client.release();}
});

app.put('/api/me/profile', auth, async (req,res)=>{
  const nickname=String(req.body.nickname||'').trim();
  if(nickname.length<1 || nickname.length>12) return res.status(400).json({error:'닉네임은 1~12자여야 합니다.'});
  await pool.query(
    "UPDATE users SET nickname=$1, state=jsonb_set(state, ARRAY['profile','nickname']::text[], $2::jsonb), updated_at=NOW() WHERE id=$3",
    [nickname, JSON.stringify(nickname), req.auth.id]
  );
  res.json({ok:true,nickname});
});

// Server-side matchmaking queue with a 30-second AI fallback.
const WAIT_MS=30_000;
const waitingQueue=[];
const queueEntries=new Map();
const matches=new Map();

function removeFromWaiting(queueId){
  const i=waitingQueue.indexOf(queueId);
  if(i>=0) waitingQueue.splice(i,1);
}

function findActiveWaitingEntry(excludeUserId){
  const now=Date.now();
  for(let i=0;i<waitingQueue.length;i++){
    const q=queueEntries.get(waitingQueue[i]);
    if(!q) {waitingQueue.splice(i,1); i--; continue;}
    if(now-q.createdAt>=WAIT_MS){
      q.status='ai'; q.updatedAt=now; removeFromWaiting(q.id); i--; continue;
    }
    if(q.userId!==excludeUserId) return q;
  }
  return null;
}

async function consumeCoopTicket(userId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query('SELECT state,coop_ticket_at FROM users WHERE id=$1 FOR UPDATE',[userId]);
    if(!rows[0]) throw new Error('계정을 찾을 수 없습니다.');
    const row=rows[0]; let state=cleanState(row.state);
    const {cycles}=ticketInfoFromRow(row);
    let ticketAt=row.coop_ticket_at ? new Date(row.coop_ticket_at).getTime() : Date.now();
    if(cycles>0){state.currencies.coopTicket+=cycles;ticketAt+=cycles*COOP_TICKET_INTERVAL_MS;}
    if(state.currencies.coopTicket<1) throw new Error('협동전 티켓이 부족합니다.');
    state.currencies.coopTicket-=1;
    await client.query('UPDATE users SET state=$1::jsonb,coop_ticket_at=to_timestamp($2/1000.0),updated_at=NOW() WHERE id=$3',[JSON.stringify(state),ticketAt,userId]);
    await client.query('COMMIT');
    return {state,nextIn:COOP_TICKET_INTERVAL_MS-(Math.max(0,Date.now()-ticketAt)%COOP_TICKET_INTERVAL_MS)};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function refundCoopTicket(userId){return mutateCurrency(userId,'coopTicket',1)}

app.post('/api/match/join', auth, async (req,res)=>{
  try{
    const existing=[...queueEntries.values()].find(q=>q.userId===req.auth.id && q.status==='waiting');
    if(existing){return res.json({status:'waiting',queueId:existing.id,elapsed:Math.floor((Date.now()-existing.createdAt)/1000)});}
    const charged=await consumeCoopTicket(req.auth.id);
    const opponent=findActiveWaitingEntry(req.auth.id);
    const queueId=crypto.randomUUID();
    if(opponent){
      removeFromWaiting(opponent.id);
      const matchId=crypto.randomUUID();
      const match={id:matchId,players:[opponent.userId,req.auth.id],createdAt:Date.now(),status:'matched',opponentType:'player'};
      matches.set(matchId,match);
      opponent.status='matched';opponent.matchId=matchId;opponent.updatedAt=Date.now();
      queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:Date.now(),status:'matched',matchId});
      return res.json({status:'matched',queueId,matchId,opponentType:'player',opponentNickname:opponent.nickname||'플레이어',state:charged.state,coopTicketNextIn:charged.nextIn});
    }
    queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,nickname:'',createdAt:Date.now(),status:'waiting'});
    waitingQueue.push(queueId);
    return res.json({status:'waiting',queueId,elapsed:0,state:charged.state,coopTicketNextIn:charged.nextIn});
  }catch(e){res.status(400).json({error:e.message||'매칭을 시작할 수 없습니다.'});}
});

app.get('/api/match/status/:queueId', auth, async (req,res)=>{
  const q=queueEntries.get(req.params.queueId);
  if(!q || q.userId!==req.auth.id) return res.status(404).json({error:'매칭 정보를 찾을 수 없습니다.'});
  if(q.status==='waiting' && Date.now()-q.createdAt>=WAIT_MS){q.status='ai';q.updatedAt=Date.now();removeFromWaiting(q.id);}
  if(q.status==='matched'){
    const match=matches.get(q.matchId);
    const other=match?.players?.find(x=>String(x)!==String(q.userId));
    let nickname='플레이어';
    if(other){const row=await rowForUser(other);if(row)nickname=row.nickname;}
    return res.json({status:'matched',queueId:q.id,matchId:q.matchId,opponentType:'player',opponentNickname:nickname});
  }
  if(q.status==='ai') return res.json({status:'ai',queueId:q.id,opponentType:'ai',opponentNickname:'AI 플레이어'});
  res.json({status:'waiting',queueId:q.id,elapsed:Math.floor((Date.now()-q.createdAt)/1000),remaining:Math.max(0,Math.ceil((WAIT_MS-(Date.now()-q.createdAt))/1000))});
});

app.get('/api/match/current', auth, async (req,res)=>{
  const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id && ['waiting','matched','ai'].includes(x.status));
  if(!q)return res.json({status:'none'});
  if(q.status==='waiting' && Date.now()-q.createdAt>=WAIT_MS){q.status='ai';removeFromWaiting(q.id);}
  res.json({status:q.status,queueId:q.id,matchId:q.matchId||null,elapsed:Math.floor((Date.now()-q.createdAt)/1000)});
});

app.post('/api/match/cancel', auth, async (req,res)=>{
  const q=[...queueEntries.values()].find(x=>x.userId===req.auth.id && x.status==='waiting');
  if(!q)return res.json({ok:true,refunded:false});
  q.status='cancelled';removeFromWaiting(q.id);queueEntries.delete(q.id);
  const state=await refundCoopTicket(req.auth.id);
  res.json({ok:true,refunded:true,state});
});

app.get('/api/admin/users', auth, requireAdmin, async (_req,res)=>{
  try{
    const {rows}=await pool.query('SELECT id,username,nickname,avatar,state,is_admin FROM users ORDER BY id ASC');
    res.json({users:rows.map(r=>({id:r.id,username:r.username,nickname:r.nickname,avatar:r.avatar,isAdmin:Boolean(r.is_admin || r.username===ADMIN_USERNAME),state:cleanState(r.state)}))});
  }catch(e){console.error(e);res.status(500).json({error:'관리자 사용자 목록을 불러오지 못했습니다.'});}
});

app.post('/api/admin/users/:username/adjust', auth, requireAdmin, async (req,res)=>{
  const username=String(req.params.username||'').trim();
  const currency=String(req.body.currency||'');
  const delta=Number(req.body.delta);
  if(!Number.isFinite(delta) || !Number.isInteger(delta)) return res.status(400).json({error:'변경량은 정수여야 합니다.'});
  try{
    const {rows}=await pool.query('SELECT id FROM users WHERE username=$1',[username]);
    if(!rows[0]) return res.status(404).json({error:'사용자를 찾을 수 없습니다.'});
    let state;
    if(currency==='passXP') state=await mutatePassXP(rows[0].id,delta);
    else state=await mutateCurrency(rows[0].id,currency,delta);
    res.json({ok:true,username,state});
  }catch(e){res.status(400).json({error:e.message||'관리자 변경 실패'});}
});

app.post('/api/admin/users/:username/set-currency', auth, requireAdmin, async (req,res)=>{
  const username=String(req.params.username||'').trim();
  const currency=String(req.body.currency||'');
  const value=Number(req.body.value);
  if(!Number.isFinite(value) || !Number.isInteger(value) || value<0) return res.status(400).json({error:'설정값은 0 이상의 정수여야 합니다.'});
  try{
    const {rows}=await pool.query('SELECT id FROM users WHERE username=$1',[username]);
    if(!rows[0]) return res.status(404).json({error:'사용자를 찾을 수 없습니다.'});
    const current=await rowForUser(rows[0].id); const state=cleanState(current.state);
    let next;
    if(currency==='passXP'){
      state.passXP=Math.min(100,value);
      await pool.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),rows[0].id]);
      next=state;
    }else{
      const allowed=['coin','dice','diamond','arenaTicket','coopTicket','lucky'];
      if(!allowed.includes(currency))return res.status(400).json({error:'지원하지 않는 재화입니다.'});
      const delta=value-Number(state.currencies[currency]||0);
      next=await mutateCurrency(rows[0].id,currency,delta);
    }
    res.json({ok:true,username,state:next});
  }catch(e){res.status(400).json({error:e.message||'관리자 설정 실패'});}
});

const wss=new WebSocketServer({server,path:'/ws'});
const sockets=new Map(); // userId -> Set(ws)
function broadcastMatch(match){
  for(const uid of match.players){
    const set=sockets.get(String(uid)); if(!set)continue;
    for(const ws of set) if(ws.readyState===1) ws.send(JSON.stringify({type:'matched',matchId:match.id,players:match.players}));
  }
}
setInterval(()=>{
  const cutoff=Date.now()-5*60*1000;
  for(const [id,q] of queueEntries){ if(q.updatedAt && q.updatedAt<cutoff && q.status!=='waiting') queueEntries.delete(id); }
},60*1000);

wss.on('connection',(ws,req)=>{
  try{
    const u=new URL(req.url,'http://localhost');
    const token=u.searchParams.get('token');
    const p=jwt.verify(token,JWT_SECRET);
    const uid=String(p.id);
    if(!sockets.has(uid)) sockets.set(uid,new Set());
    sockets.get(uid).add(ws);
    ws.send(JSON.stringify({type:'connected'}));
    ws.on('close',()=>sockets.get(uid)?.delete(ws));
  }catch{ws.close(1008,'Unauthorized')}
});

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/{*splat}',(req,res)=>{
  if(req.path.startsWith('/api/')||req.path==='/health') return res.status(404).json({error:'Not found'});
  res.sendFile(path.join(__dirname,'public','index.html'));
});

async function boot(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname VARCHAR(12) NOT NULL,
      avatar VARCHAR(32) NOT NULL DEFAULT '🎲',
      state JSONB NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      coop_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS coop_ticket_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
  await pool.query('UPDATE users SET is_admin=TRUE WHERE username=$1',[ADMIN_USERNAME]);
  server.listen(PORT,'0.0.0.0',()=>console.log(`RD2 server listening on ${PORT}`));
}
boot().catch(err=>{console.error(err);process.exit(1)});
