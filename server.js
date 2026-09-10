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

async function rowForUser(id){
  const {rows}=await pool.query('SELECT id,username,nickname,avatar,state FROM users WHERE id=$1',[id]);
  return rows[0];
}

async function publicUser(row){
  return { id: row.id, username: row.username, nickname: row.nickname, avatar: row.avatar };
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
      'INSERT INTO users(username,password_hash,nickname,avatar,state) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id,username,nickname,avatar,state',
      [username,hash,nickname,'🎲',JSON.stringify(state)]
    );
    const user=rows[0];
    res.json({token:tokenFor(user),user:await publicUser(user),state:cleanState(user.state)});
  }catch(e){
    if(e.code==='23505') return res.status(409).json({error:'이미 사용 중인 아이디입니다.'});
    console.error(e); res.status(500).json({error:'회원가입 실패'});
  }
});

app.post('/api/auth/login', async (req,res)=>{
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const {rows}=await pool.query('SELECT id,username,password_hash,nickname,avatar,state FROM users WHERE username=$1',[username]);
  const user=rows[0];
  if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'아이디 또는 비밀번호가 올바르지 않습니다.'});
  res.json({token:tokenFor(user),user:await publicUser(user),state:cleanState(user.state)});
});

app.post('/api/auth/logout', auth, (_req,res)=>res.json({ok:true}));

app.get('/api/me', auth, async (req,res)=>{
  const user=await rowForUser(req.auth.id);
  if(!user) return res.status(404).json({error:'계정을 찾을 수 없습니다.'});
  res.json({user:await publicUser(user),state:cleanState(user.state)});
});

app.put('/api/me/state', auth, async (req,res)=>{
  const state=cleanState(req.body);
  await pool.query('UPDATE users SET state=$1::jsonb,nickname=$2,avatar=$3,updated_at=NOW() WHERE id=$4',
    [JSON.stringify(state),state.profile.nickname,state.profile.avatar,req.auth.id]);
  res.json({ok:true,state});
});

app.put('/api/me/profile', auth, async (req,res)=>{
  const nickname=String(req.body.nickname||'').trim();
  if(nickname.length<1 || nickname.length>12) return res.status(400).json({error:'닉네임은 1~12자여야 합니다.'});
  await pool.query('UPDATE users SET nickname=$1,state=jsonb_set(state,ARRAY[''profile'',''nickname'']::text[],$2::jsonb),updated_at=NOW() WHERE id=$3',
    [nickname,JSON.stringify(nickname),req.auth.id]);
  res.json({ok:true,nickname});
});

// Simple server-side matchmaking queue.
// It pairs two authenticated users and returns a match id. Game state remains owned by each account.
const queue=[];
const matches=new Map();

app.post('/api/match/queue', auth, (req,res)=>{
  const idx=queue.findIndex(x=>x.userId===req.auth.id);
  if(idx>=0) return res.json({queued:true});
  const other=queue.shift();
  if(!other){queue.push({userId:req.auth.id,username:req.auth.username,at:Date.now()});return res.json({queued:true})}
  const matchId=crypto.randomUUID();
  const match={id:matchId,players:[other.userId,req.auth.id],createdAt:Date.now(),status:'matched'};
  matches.set(matchId,match);
  broadcastMatch(match);
  res.json({queued:false,matched:true,matchId,players:match.players});
});

app.post('/api/match/cancel', auth, (req,res)=>{
  for(let i=queue.length-1;i>=0;i--) if(queue[i].userId===req.auth.id) queue.splice(i,1);
  res.json({ok:true});
});

const wss=new WebSocketServer({server,path:'/ws'});
const sockets=new Map(); // userId -> Set(ws)
function broadcastMatch(match){
  for(const uid of match.players){
    const set=sockets.get(String(uid)); if(!set)continue;
    for(const ws of set) if(ws.readyState===1) ws.send(JSON.stringify({type:'matched',matchId:match.id,players:match.players}));
  }
}
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

app.get('*',(req,res)=>{
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
  server.listen(PORT,'0.0.0.0',()=>console.log(`RD2 server listening on ${PORT}`));
}
boot().catch(err=>{console.error(err);process.exit(1)});
