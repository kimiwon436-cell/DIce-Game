
const A=localStorage;
const API_BASE='';
let serverToken=A.getItem('rd2_token')||'';
const DEFAULT_CLIENT_STATE={
 user:null,page:'lobby',mode:'coop',matching:false,matchSec:0,matchTimer:null,
 sp:0,wave:1,gameSec:20,speed:1,kills:0,diceGrid:[],selected:null,enemies:[],
 currencies:{coin:100,dice:0,diamond:0,arenaTicket:0,coopTicket:0},
 profile:{nickname:'',avatar:'🎲'},deck:['blue','blue','blue','blue','blue'],unlocked:[],treeUnlocked:[],diceLevels:{},
 passXP:0,lucky:0,quests:[0,0,0],difficulty:'normal',room:null
};
const appState=DEFAULT_CLIENT_STATE;
const D={
 blue:{name:'바람',icon:'🌀',cls:'d-blue',damage:85,rate:750},
 cyan:{name:'얼음',icon:'❄',cls:'d-cyan',damage:50,rate:1000},
 red:{name:'화염',icon:'🔥',cls:'d-red',damage:70,rate:820},
 green:{name:'독',icon:'☠',cls:'d-green',damage:45,rate:1100},
 yellow:{name:'빛',icon:'☀',cls:'d-yellow',damage:55,rate:900},
 pink:{name:'분열',icon:'✿',cls:'d-pink',damage:40,rate:950},
 purple:{name:'성장',icon:'✦',cls:'d-purple',damage:50,rate:1000}
};
async function api(path, options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 if(serverToken)headers.Authorization='Bearer '+serverToken;
 const res=await fetch(API_BASE+path,{...options,headers});
 let data={}; try{data=await res.json()}catch{}
 if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
 return data;
}
function snapshot(){return {user:appState.user,profile:appState.profile,currencies:appState.currencies,deck:appState.deck,unlocked:appState.unlocked,treeUnlocked:appState.treeUnlocked,diceLevels:appState.diceLevels,passXP:appState.passXP,lucky:appState.lucky,quests:appState.quests,difficulty:appState.difficulty}}
function saveLocal(){try{A.setItem('rd2_local_cache',JSON.stringify(snapshot()))}catch{}}
function save(){saveLocal();if(!serverToken)return Promise.resolve();return api('/api/me/state',{method:'PUT',body:JSON.stringify(snapshot())}).catch(e=>console.warn('server save failed',e))}
function loadLocal(){
 try{
  const s=JSON.parse(A.getItem('rd2_local_cache')||'null');
  if(s&&s.profile&&s.currencies&&Array.isArray(s.deck)){
   Object.assign(appState,s);
  }
 }catch{}
 if(!appState.currencies)appState.currencies={coin:100,dice:0,diamond:0,arenaTicket:0,coopTicket:0};
 if(!Array.isArray(appState.deck))appState.deck=['blue','blue','blue','blue','blue'];
 if(!Array.isArray(appState.unlocked))appState.unlocked=[];
 if(!Array.isArray(appState.treeUnlocked))appState.treeUnlocked=[];
 if(!appState.diceLevels)appState.diceLevels={};
}
function clearSession(){serverToken='';A.removeItem('rd2_token');A.removeItem('rd2_local_cache');appState.user=null;}
function mountShell(){
 const root=document.getElementById('root');
 root.innerHTML=appState.user?renderGame():renderAuth();
 if(appState.user){drawLobby();updateRes();}
 bindAuth();
}
async function bootClient(){
 loadLocal();
 if(!serverToken){appState.user=null;mountShell();return;}
 try{
  const r=await api('/api/me');
  Object.assign(appState,r.state||{});appState.user=r.user.username;
  mountShell();
 }catch(e){
  console.warn('session invalid',e);clearSession();mountShell();
 }
}
function userKey(){return 'server'}
function accounts(){return {}}
function setAccounts(x){}
function bindAuth(){
 const tabs=document.querySelectorAll('[data-auth]');if(!tabs.length)return;
 tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');drawAuthForm(b.dataset.auth)});
 drawAuthForm('login');
}
function renderAuth(){
 return `<div class="auth"><div class="authbox">
  <div class="muted">RANDOM DICE 2 WEB</div><h1>온라인 계정</h1>
  <div class="authTabs"><button data-auth="login" class="active">로그인</button><button data-auth="signup">회원가입</button></div>
  <div id="authForm"></div>
  <div class="muted" style="margin-top:10px">계정·재화·덱·다이스 트리 진행도는 서버 DB에 저장됩니다.</div>
 </div></div>`
}
function bindAuth(){
 const tabs=document.querySelectorAll('[data-auth]');if(!tabs.length)return;
 tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');drawAuthForm(b.dataset.auth)});
 drawAuthForm('login');
}
{
 const tabs=document.querySelectorAll('[data-auth]');if(!tabs.length)return;
 tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');drawAuthForm(b.dataset.auth)});
 drawAuthForm('login');
}
function drawAuthForm(type){
 const f=document.getElementById('authForm');
 f.innerHTML=type==='login'?`<div class="field"><label>아이디</label><input class="input" id="aid" autocomplete="username"></div>
 <div class="field"><label>비밀번호</label><input class="input" id="apw" type="password" autocomplete="current-password"></div>
 <button class="primary submit" id="go">로그인</button>`:
 `<div class="field"><label>아이디</label><input class="input" id="aid"></div>
 <div class="field"><label>비밀번호</label><input class="input" id="apw" type="password"></div>
 <div class="field"><label>닉네임</label><input class="input" id="anick" maxlength="12" placeholder="게임에서 표시할 닉네임"></div>
 <button class="primary submit" id="go">계정 만들기</button>`;
 document.getElementById('go').onclick=async()=>{
  try{
   const id=document.getElementById('aid').value.trim(),pw=document.getElementById('apw').value,n=type==='signup'?document.getElementById('anick').value.trim():'';
   if(!id||!pw||type==='signup'&&!n)return alert('모든 항목을 입력하세요.');
   if(type==='signup'){
     const r=await api('/api/auth/register',{method:'POST',body:JSON.stringify({username:id,password:pw,nickname:n})});
     serverToken=r.token;A.setItem('rd2_token',serverToken);Object.assign(appState,r.state);appState.user=r.user.username;save();mountShell();
   }else{
     const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:id,password:pw})});
     serverToken=r.token;A.setItem('rd2_token',serverToken);Object.assign(appState,r.state);appState.user=r.user.username;save();mountShell();
   }
  }catch(e){alert(e.message)}
 };
}function nav(page){appState.page=page;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+page)?.classList.add('active');if(page==='lobby')drawLobby();if(page==='deck')drawDeck();if(page==='tree')drawTree();if(page==='style')drawStyle();if(page==='pass')drawPass();if(page==='quests')drawQuests();if(page==='profile')drawProfile();if(page==='bounty')drawBounty();}
function renderGame(){
 return `<div class="app">
  <div id="pages">${pageShell()}</div>
  <div id="modalRoot"></div>
  <div id="loading" class="loading"><div style="font-size:28px;font-weight:1000">전투 준비 중</div><div class="muted" id="loadText" style="margin:7px 0 16px">플레이어 정보를 불러오는 중...</div><div class="bar"><i id="loadBar"></i></div></div>
 </div>`
}
function pageShell(){
 return `<section id="page-lobby" class="view active"><div class="top">${topbar()}</div><div class="body"><aside class="side">${sidebar()}</aside><main class="main" id="main"></main></div></section>
 <section id="page-battle" class="view"></section>`
}
function topbar(){return `<div class="brand">RANDOM DICE 2<small>ONLINE PROTOTYPE</small></div><div class="res">
 <div class="chip">🪙 <b id="coin">${appState.currencies.coin}</b></div><div class="chip">🎲 <b id="dice">${appState.currencies.dice}</b></div><div class="chip">💎 <b id="diamond">${appState.currencies.diamond}</b></div><div class="chip">🏟️ <b id="arenaTicket">${appState.currencies.arenaTicket}</b></div><div class="chip">🤝 <b id="coopTicket">${appState.currencies.coopTicket}</b></div></div><div class="topsp"></div><button class="topbtn profileBtn" onclick="nav('profile')"><span class="avatar">${appState.profile.avatar}</span>${esc(appState.profile.nickname)}</button>`}
function sidebar(){return `<button class="nav active" onclick="nav('lobby')"><i>🏠</i> 로비</button>
 <button class="nav" onclick="nav('deck')"><i>🎴</i> 덱</button><button class="nav" onclick="nav('tree')"><i>🌳</i> 다이스 트리</button><button class="nav" onclick="nav('style')"><i>🎨</i> 꾸미기</button>
 <button class="nav" onclick="nav('quests')"><i>📜</i> 퀘스트 <span class="badge">3</span></button><button class="nav" onclick="nav('pass')"><i>🎫</i> 다이스 패스</button><button class="nav" onclick="openLucky()"><i>🍀</i> 행운의 주사위</button><button class="nav" onclick="nav('bounty')"><i>⚔️</i> 토벌 보상</button>
 <div class="sideBottom"><div class="mini">현재 로그인: <b>${esc(appState.profile.nickname)}</b><br>온라인 기능은 이 프로토타입에서 방 코드 기반으로 구성되어 있습니다.</div></div>`}
function drawLobby(){
 const m=document.getElementById('main');if(!m)return;
 m.innerHTML=`<div class="hero"><div class="heroCard"><div class="muted">협동전</div><div class="bigLogo">함께 막아내자</div><div class="sub">플레이를 누르면 온라인 매칭을 시작합니다.</div><button class="play" onclick="startMatch()">▶ 플레이</button><div class="smallHint">모드 입장 시 협동전 티켓 1장 사용 · 매칭 → 로딩 → 전투 시작</div></div>
 <div class="modeCard"><h3>게임 모드</h3><div class="mode sel"><div><b>🤝 협동전</b><span>다른 플레이어와 몬스터를 함께 막는 모드</span></div><button onclick="startMatch()">플레이</button></div><div class="mode"><div><b>🎟️ 아레나</b><span>아레나 티켓을 사용하는 경쟁 모드</span></div><button onclick="toast('아레나 모드는 다음 버전에서 연결됩니다')">준비</button></div><div class="mode"><div><b>👥 친구와 하기</b><span>방 생성 / 코드 참가 / 준비</span></div><button onclick="openFriends()">열기</button></div></div></div>
 <div class="section"><div class="sectionHead"><h2>로비 바로가기</h2><span>전투 밖에서 관리하는 메뉴</span></div><div class="cardgrid">
  <div class="tile"><h3>🎴 덱</h3><p>전투에 가져갈 주사위 5개를 선택합니다.</p><button onclick="nav('deck')">덱 관리</button></div>
  <div class="tile"><h3>🌳 다이스 트리</h3><p>보유한 다이스로 노드를 해금하고 새로운 주사위를 얻습니다.</p><button onclick="nav('tree')">트리 열기</button></div>
  <div class="tile"><h3>🎨 꾸미기</h3><p>프로필 아이콘과 보드 스킨을 관리합니다.</p><button onclick="nav('style')">꾸미기</button></div>
  <div class="tile"><h3>📜 퀘스트</h3><p>로비에서 진행도를 확인하고 보상을 수령합니다.</p><button onclick="nav('quests')">퀘스트</button></div>
  <div class="tile"><h3>🎫 다이스 패스</h3><p>경험치를 모아 단계별 무료 보상을 받습니다.</p><button onclick="nav('pass')">패스 보기</button></div>
  <div class="tile"><h3>🍀 행운의 주사위</h3><p>주사위 재화를 소모해 랜덤 보너스를 뽑습니다.</p><button onclick="openLucky()">행운 사용</button></div>
 </div></div>
 <div class="section"><div class="sectionHead"><h2>내 덱</h2><span>전투에서 사용 · SP는 인게임 전용</span></div><div class="deck">${appState.deck.map((x,i)=>diceHTML(x,i+1)).join('')}</div></div>`;
}
function diceHTML(type,lvl=1){const d=D[type]||D.blue;return `<div class="dice ${d.cls}">${d.icon}<small>${lvl}</small></div>`}
function upgradeCost(level){
 return (level%5===0)?{coin:0,dice:8}:{coin:Math.max(50,level*50),dice:0};
}
function upgradeDice(type){
 const level=appState.diceLevels?.[type]||1;
 const c=upgradeCost(level);
 if(c.dice && appState.currencies.dice<c.dice)return toast(`레벨 ${level+1} 업그레이드에는 🎲 ${c.dice}개가 필요합니다`);
 if(c.coin && appState.currencies.coin<c.coin)return toast(`코인이 부족합니다 · 필요 🪙 ${c.coin}`);
 if(c.dice)appState.currencies.dice-=c.dice;
 if(c.coin)appState.currencies.coin-=c.coin;
 if(!appState.diceLevels)appState.diceLevels={};
 appState.diceLevels[type]=level+1;
 save();updateRes();drawDeck();toast(`${D[type].name} 레벨 ${level+1} 업그레이드 완료`);
}
function drawDeck(){
 if(!appState.diceLevels)appState.diceLevels={};
 document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>덱</h2><span>로비 메뉴</span></div>
 <div class="tile" style="margin-bottom:12px"><b>전투 덱</b><p>전투 시작 전에만 변경됩니다.</p></div>
 <div class="deck" style="max-width:600px">${appState.deck.map((x,i)=>`<div class="slot" style="background:#1f1531;min-height:100px"><div onclick="cycleDeck(${i})" style="width:76%;cursor:pointer">${diceHTML(x,1)}</div></div>`).join('')}</div>
 <div class="section"><div class="sectionHead"><h2>보유 주사위</h2><span>${appState.unlocked.length} / 40</span></div>
 <div class="cardgrid">${appState.unlocked.map((x,i)=>{const d=D[x];const lv=appState.diceLevels[x]||1;const c=upgradeCost(lv);const costText=c.dice?`🎲 ${c.dice}`:`🪙 ${c.coin}`;return `<div class="tile"><div class="row"><div style="width:48px;height:48px">${diceHTML(x,lv)}</div><div><b>${d.name}</b><div class="muted">레벨 ${lv}</div></div></div><button onclick="addDeck('${x}')">${appState.deck.includes(x)?'덱에 있음':'덱에 추가'}</button><button class="primary" onclick="upgradeDice('${x}')">업그레이드 · ${costText}</button></div>`}).join('')}</div>
 <div class="tile" style="margin-top:12px"><b>업그레이드 규칙</b><p>일반 레벨업은 코인으로 진행하고, <b>5 / 10 / 15 / ...</b>처럼 5의 배수 레벨로 넘어갈 때는 코인 대신 <b>🎲 주사위 재화 8개</b>가 들어갑니다.</p></div>`;
}
function cycleDeck(i){const choices=appState.unlocked;const idx=Math.max(0,choices.indexOf(appState.deck[i]));appState.deck[i]=choices[(idx+1)%choices.length];save();drawDeck()}
function addDeck(x){const idx=appState.deck.findIndex((d,i)=>!appState.unlocked.includes(d)||!d);if(idx>=0)appState.deck[idx]=x;else appState.deck[appState.deck.length-1]=x;save();drawDeck();toast('덱이 저장되었습니다')}
const treeNodes=[
 {id:0,x:48,y:48,icon:'🎲',label:'시작',cost:0,coin:0,next:[1,2]},
 {id:1,x:37,y:39,icon:'🌀',label:'바람 주사위',cost:8,coin:0,next:[3,4]},
 {id:2,x:59,y:39,icon:'❄️',label:'얼음 주사위',cost:8,coin:0,next:[4,5]},
 {id:3,x:27,y:30,icon:'🔥',label:'화염 주사위',cost:8,coin:0,next:[6]},
 {id:4,x:48,y:29,icon:'☀️',label:'빛 주사위',cost:8,coin:0,next:[6,7]},
 {id:5,x:68,y:30,icon:'☘️',label:'독 주사위',cost:8,coin:0,next:[7]},
 {id:6,x:36,y:19,icon:'✿',label:'분열 주사위',cost:8,coin:0,next:[8]},
 {id:7,x:60,y:19,icon:'✦',label:'성장 주사위',cost:8,coin:0,next:[8]},
 {id:8,x:48,y:9,icon:'👑',label:'왕관 주사위',cost:8,coin:0,next:[]}
];
function treeUnlocked(id){
 if(id===0)return true;
 if(id===1||id===2)return true;
 return appState.treeUnlocked?.includes(id) || false;
}
function nextTreeName(id){
 const n=treeNodes.find(x=>x.id===id); return n?n.label:'다음 주사위';
}
function ensureTreeState(){
 if(!Array.isArray(appState.treeUnlocked)) appState.treeUnlocked=[];
 if(!treeUnlocked(0)) appState.treeUnlocked.push(0);
}
function drawTree(){
 ensureTreeState();
 const edges=[];
 treeNodes.forEach(n=>n.next.forEach(to=>{
   const t=treeNodes.find(x=>x.id===to);
   if(t) edges.push(`<div class="treeEdge" style="left:${n.x}%;top:${n.y}%;width:${Math.hypot((t.x-n.x)*10,(t.y-n.y)*10)}px;transform:rotate(${Math.atan2((t.y-n.y),(t.x-n.x))*180/Math.PI}deg)"></div>`);
 }));
 const nodes=treeNodes.map(n=>{
   const open=treeUnlocked(n.id);
   const reachable=n.id===0 || n.id===1 || n.id===2 || n.next.length===0
     ? open
     : n.next.some(p=>treeUnlocked(p)) || treeNodes.some(p=>p.next.includes(n.id)&&treeUnlocked(p.id));
   const isNext=!open && treeNodes.some(p=>p.next.includes(n.id)&&treeUnlocked(p.id));
   const status=open?'해금됨':isNext?'다음 해금':'잠김';
   return `<div class="treeNode ${open?'treeOpen':isNext?'treeNext':'treeLocked'}" style="left:${n.x}%;top:${n.y}%" onclick="buyTree(${n.id})">
     <div class="treeIcon">${n.icon}</div><div class="treeLevel">${status}</div><div class="treeLabel">${n.label}</div>
     ${open&&n.id>0?'<div class="treeCheck">✓</div>':''}
     ${!open?`<div class="treeCost">🎲 ${n.cost}</div>`:''}
   </div>`;
 }).join('');
 document.getElementById('main').innerHTML=`
 <div class="sectionHead"><h2>다이스 트리</h2><span>노드 하나를 해금하면 연결된 다음 노드가 표시됩니다</span></div>
 <div class="treeWide"><div class="treeCanvas">${edges.join('')}${nodes}</div>
   <div class="treeLegend"><span>🟢 해금</span><span>🟡 다음 해금</span><span>⚫ 잠김</span></div>
 </div>
 <div class="section"><div class="tile"><b>다이스 트리 규칙</b>
 <p>주사위 1개 해금 비용은 <b>🎲 8개</b>입니다. 현재 선택 가능한 다음 노드를 누르면 해금할 수 있고, 해금하면 그 뒤에 연결된 다음 주사위가 공개됩니다.</p>
 <p style="margin-top:7px">현재 주사위 재화: <b>${appState.currencies.dice.toLocaleString()}</b></p>
 </div></div>`;
}
function buyTree(id){
 ensureTreeState();
 if(treeUnlocked(id)){toast('이미 해금된 주사위입니다');return;}
 const node=treeNodes.find(n=>n.id===id);
 if(!node)return;
 const parent=treeNodes.find(p=>p.next.includes(id));
 if(!parent || !treeUnlocked(parent.id)){
   toast('먼저 앞의 주사위를 해금하세요');
   return;
 }
 if(appState.currencies.dice<8){
   toast('주사위 재화가 부족합니다 · 필요 8');
   return;
 }
 appState.currencies.dice-=8;
 appState.treeUnlocked.push(id);
 // 새로 해금된 주사위를 보유 목록에 추가
 const typeMap={1:'blue',2:'cyan',3:'red',4:'yellow',5:'green',6:'pink',7:'purple',8:'blue'};
 const type=typeMap[id];
 if(type && !appState.unlocked.includes(type))appState.unlocked.push(type);
 save();updateRes();drawTree();
 const next=node.next.length?` 다음 해금: ${node.next.map(nextTreeName).join(', ')}`:' 모든 트리 노드를 확인했습니다.';
 toast(`${node.label} 해금! 🎲 -8${next}`);
}
function buyTree(i){if(i<appState.unlocked.length)return toast('이미 해금된 노드입니다');if(appState.currencies.dice<800)return toast('주사위가 부족합니다');appState.currencies.dice-=800;const x=Object.keys(D)[i%Object.keys(D).length];if(!appState.unlocked.includes(x))appState.unlocked.push(x);save();drawTree();updateRes();toast('다이스 트리 노드를 해금했습니다')}
function drawStyle(){document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>꾸미기</h2><span>로비에서만 변경 가능</span></div><div class="skinGrid">
 ${['🎲','🌀','❄️','🔥','🌈','🧊','⚡','🌸'].map((a,i)=>`<div class="skin"><div class="art" style="background:hsl(${i*42},55%,35%)">${a}</div><b>${i===0?'기본':`스킨 ${i}`}</b><button class="topbtn" style="margin-top:8px;width:100%" onclick="toast('${i===0?'기본 꾸미기 적용':'꾸미기를 적용했습니다'}')">사용</button></div>`).join('')}
 </div>`}
function drawPass(){const xp=appState.passXP;document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>다이스 패스</h2><span>시즌 진행도</span></div><div class="pass"><div class="passHero"><div class="muted">무료 패스</div><h2 style="margin:5px 0 12px">7일간의 여정</h2><div class="progress"><i style="width:${xp}%"></i></div><div class="row" style="margin-top:8px"><b>${xp}/100</b><span class="muted grow">다음 보상까지 ${100-xp} XP</span></div><button class="primary" style="margin-top:14px;width:100%" onclick="claimPass()">보상 받기</button></div><div class="tile"><h3>보상 트랙</h3><div class="passTrack">${['🪙1000','🎲500','💎50','🍀1','🤝2','🎁'].map((r,i)=>`<div class="rewardBox"><b>${r.split(/(?=\\d|$)/)[0]}</b><span>단계 ${i+1}</span></div>`).join('')}</div><p>협동전, 퀘스트 등 로비 활동으로 패스 XP를 획득하고 단계별 보상을 받습니다.</p></div></div>`}
function claimPass(){if(appState.passXP<50)return toast('아직 받을 수 있는 패스 보상이 없습니다');appState.currencies.coin+=1000;appState.passXP=Math.min(100,appState.passXP+10);save();updateRes();drawPass();toast('다이스 패스 보상을 받았습니다')}
function drawQuests(){const qs=[['협동전 1회 완료',0,1,'🤝'],['적 50마리 처치',appState.quests[1],50,'⚔️'],['주사위 10회 합성',appState.quests[2],10,'🎲']];document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>퀘스트</h2><span>로비에서 진행 / 보상 수령</span></div><div class="quest">${qs.map((q,i)=>`<div class="q"><div style="font-size:22px">${q[3]}</div><div class="grow"><b>${q[0]}</b><div class="muted" style="margin:3px 0">${q[1]} / ${q[2]}</div><div class="qbar"><i style="width:${Math.min(100,q[1]/q[2]*100)}%"></i></div></div><button class="primary" onclick="claimQuest(${i})">${q[1]>=q[2]?'받기':'진행'}</button></div>`).join('')}</div>`}
function claimQuest(i){if(i===0){appState.currencies.coopTicket+=2;appState.quests[0]=1}else if(i===1&&appState.quests[1]>=50){appState.currencies.coin+=1500}else if(i===2&&appState.quests[2]>=10){appState.currencies.dice+=700}else return toast('아직 완료되지 않은 퀘스트입니다');save();updateRes();drawQuests();toast('퀘스트 보상을 받았습니다')}
function openLucky(){document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><button class="close" onclick="closeModal()">닫기</button><h2>🍀 행운의 주사위</h2><div class="muted">로비에서만 사용하는 랜덤 보너스입니다.</div><div style="margin:20px 0;text-align:center;font-size:58px">🎲</div><div class="tile"><b>보유 행운의 주사위 ${appState.lucky}개</b><p>1개를 사용하면 코인, 다이스, 패스 XP 중 하나를 랜덤으로 획득합니다.</p></div><button class="primary" style="width:100%;margin-top:12px" onclick="useLucky()">행운의 주사위 1개 사용</button></div></div>`}
function useLucky(){if(appState.lucky<=0)return toast('행운의 주사위가 없습니다');appState.lucky--;const r=Math.floor(Math.random()*3);if(r===0){appState.currencies.coin+=2000;toast('🍀 코인 2,000 획득!')}else if(r===1){appState.currencies.dice+=1200;toast('🍀 주사위 1,200 획득!')}else{appState.passXP=Math.min(100,appState.passXP+10);toast('🍀 다이스 패스 XP +10!')}save();closeModal();updateRes()}
function drawBounty(){const rewards={easy:['🪙 800','🎲 300'],normal:['🪙 1600','🎲 800','🍀 1'],hard:['🪙 3200','🎲 1500','🤝 3']};document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>토벌 보상</h2><span>난이도 선택 → 보상 획득</span></div><div class="cardgrid">${[['easy','쉬움'],['normal','보통'],['hard','어려움']].map(x=>`<div class="tile" style="${appState.difficulty===x[0]?'outline:3px solid #ffd83b55':''}"><h3>${x[1]}</h3><p>토벌 난이도 ${x[1]} · 완료 시 보상이 증가합니다.</p><div style="margin:8px 0">${rewards[x[0]].map(r=>`<span class="chip" style="display:inline-block;margin:3px">${r}</span>`).join('')}</div><button class="${appState.difficulty===x[0]?'primary':'topbtn'}" onclick="selectBounty('${x[0]}')">${appState.difficulty===x[0]?'선택됨':'선택'}</button></div>`).join('')}</div><div class="section"><div class="tile"><h3>선택 난이도: ${appState.difficulty}</h3><p>토벌 보상은 전투가 아니라 로비에서 난이도를 선택하고 받을 수 있도록 구성되어 있습니다.</p><button class="primary" onclick="claimBounty()">보상 받기</button></div></div>`}
function selectBounty(x){appState.difficulty=x;drawBounty()}
function claimBounty(){const amt={easy:800,normal:1600,hard:3200}[appState.difficulty];if(appState.currencies.coin<0)return;appState.currencies.coin+=amt;save();updateRes();toast('토벌 보상으로 코인 '+amt.toLocaleString()+' 획득!')}
function drawProfile(){document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>프로필</h2><span>계정 / 닉네임</span></div><div class="tile" style="max-width:620px"><div class="row"><div class="avatar" style="width:64px;height:64px;font-size:30px">${appState.profile.avatar}</div><div><h2 style="margin:0">${esc(appState.profile.nickname)}</h2><div class="muted">아이디: ${esc(appState.user)}</div></div></div><div class="section"><label class="muted">닉네임 변경</label><div class="row" style="margin-top:6px"><input class="input grow" id="nick" value="${esc(appState.profile.nickname)}" maxlength="12"><button class="primary" onclick="changeNick()">변경</button></div></div><div class="shoplessNav"><button class="quick" onclick="toast('프로필 프레임 메뉴')">프로필 꾸미기</button><button class="quick" onclick="logout()">로그아웃</button></div></div>`}
async function changeNick(){
 const n=document.getElementById('nick').value.trim();
 if(!n)return toast('닉네임을 입력하세요');
 try{await api('/api/me/profile',{method:'PUT',body:JSON.stringify({nickname:n})});appState.profile.nickname=n;save();mountShell()}
 catch(e){toast(e.message)}
}
async function logout(){
 try{if(serverToken)await api('/api/auth/logout',{method:'POST'})}catch{}
 serverToken='';clearSession();mountShell()
}
function openFriends(){document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><button class="close" onclick="closeModal()">닫기</button><h2>👥 친구와 하기</h2><p class="muted">방을 만들거나 다른 플레이어가 알려준 방 코드로 참가합니다.</p><div class="row" style="margin-top:16px"><button class="primary grow" onclick="createRoom()">방 만들기</button><button class="topbtn grow" onclick="joinRoom()">코드 참가</button></div><div id="friendArea" style="margin-top:15px"></div></div></div>`}
function createRoom(){appState.room=Math.random().toString(36).slice(2,8).toUpperCase();document.getElementById('friendArea').innerHTML=`<div class="tile"><div class="muted">내 방 코드</div><div style="font-size:34px;font-weight:1000;letter-spacing:5px;text-align:center;margin:10px">${appState.room}</div><div class="row"><button class="topbtn grow" onclick="navigator.clipboard?.writeText('${appState.room}');toast('방 코드 복사')">코드 복사</button><button class="primary grow" onclick="startMatch(true)">준비 / 시작</button></div></div>`}
function joinRoom(){const area=document.getElementById('friendArea');area.innerHTML=`<div class="row"><input class="input grow" id="roomInput" placeholder="6자리 방 코드"><button class="primary" onclick="joinConfirm()">참가</button></div>`}
function joinConfirm(){const x=(document.getElementById('roomInput').value||'').trim().toUpperCase();if(x.length<4)return toast('방 코드를 확인하세요');appState.room=x;document.getElementById('friendArea').innerHTML=`<div class="tile"><b>방 ${x}</b><p>호스트가 시작할 때까지 준비 상태로 대기합니다.</p><button class="primary" style="width:100%" onclick="startMatch(true)">준비 완료</button></div>`}
function startMatch(fromFriend=false){if(appState.currencies.coopTicket<=0)return toast('협동전 티켓이 부족합니다');appState.currencies.coopTicket--;save();document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="match"><div class="muted">협동전 온라인 매칭</div><h1>플레이어 찾는 중</h1><div class="spinner"></div><div class="matchtime" id="matchTime">0:00</div><div class="matchstate" id="matchState">매칭 서버에 연결 중...</div><button class="cancel" onclick="cancelMatch()">취소</button></div></div>`;
 appState.matching=true;appState.matchSec=0;clearInterval(appState.matchTimer);appState.matchTimer=setInterval(()=>{appState.matchSec++;const mt=document.getElementById('matchTime');const st=document.getElementById('matchState');if(mt)mt.textContent=`0:${String(appState.matchSec).padStart(2,'0')}`;if(st)st.textContent=appState.matchSec<3?'상대 플레이어 검색 중...':appState.matchSec<6?'상대 발견 · 연결 중...':'매칭 완료 · 게임 준비 중...';if(appState.matchSec>=7){clearInterval(appState.matchTimer);beginLoading()}},1000)}
function cancelMatch(){clearInterval(appState.matchTimer);appState.matching=false;closeModal();appState.currencies.coopTicket++;save();updateRes()}
function beginLoading(){closeModal();const l=document.getElementById('loading');l.classList.add('active');let p=0;const bar=document.getElementById('loadBar'),txt=document.getElementById('loadText');const iv=setInterval(()=>{p+=10;bar.style.width=p+'%';txt.textContent=p<30?'상대 플레이어 정보를 불러오는 중...':p<70?'전투 덱을 준비하는 중...':p<100?'맵과 적을 준비하는 중...':'전투 시작!';if(p>=100){clearInterval(iv);setTimeout(()=>{l.classList.remove('active');startBattle()},400)}},180)}
function startBattle(){
  document.getElementById('page-battle').innerHTML=`<div class="battle"><div class="battleTop"><button class="topbtn" onclick="leaveBattle()">‹</button><b id="bwave">1</b><div class="pill">🤝 협동전</div><div class="pill" id="btime">20s</div><div class="pill">SP <span id="bsp">100</span></div><div class="pill right" id="bkills">처치 0</div></div><div class="arena"><div class="hp">적 기지 HP <span id="basehp">150</span><i id="hpbar" style="width:100%"></i></div><div class="lane"></div><div class="gate">⚡<small>150</small></div><div id="enemyLayer"></div><div id="battleDice" class="battleDice"></div></div><div class="battlebar"><div class="sp">✦ <span id="sp">100</span></div><button class="spawn" onclick="summonBattleDice()">소환 · SP 50</button><button class="speed" onclick="toggleSpeed()">1.0x</button></div><div class="battleBottom">게임 내 재화는 <b style="color:#65e5ff;margin-left:4px">SP만 사용</b> · 덱/다이스 트리/꾸미기는 전투 종료 후 로비에서 관리</div></div>`;
  navBattle();setupBattle()
}
function navBattle(){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById('page-battle').classList.add('active')}
function setupBattle(){appState.sp=100;appState.wave=1;appState.gameSec=20;appState.speed=1;appState.kills=0;appState.enemies=[];appState.diceGrid=appState.deck.map((type,i)=>({type:type,lvl:1,id:i+1}));renderBattleDice();for(let i=0;i<8;i++)setTimeout(addEnemy,i*320);requestAnimationFrame(battleLoop)}
let last=0,lastAttack=0;
function renderBattleDice(){const el=document.getElementById('battleDice');if(!el)return;el.innerHTML='';for(let i=0;i<15;i++){const s=document.createElement('div');s.className='slot';const d=appState.diceGrid[i]||((i<5)?{type:appState.deck[i],lvl:1}:null);if(d){const div=document.createElement('div');div.innerHTML=diceHTML(d,1);div.firstChild.style.cursor='pointer';div.onclick=()=>battleDieClick(i);s.appendChild(div)}else{s.onclick=()=>summonBattleDice()};el.appendChild(s)}}
function battleDieClick(i){
  const d=appState.diceGrid[i];
  if(!d)return;
  if(appState.selected===null){appState.selected=i;renderBattleDice();return}
  if(appState.selected===i){appState.selected=null;renderBattleDice();return}
  const a=appState.diceGrid[appState.selected],b=appState.diceGrid[i];
  if(a&&b&&a.type===b.type&&a.lvl===b.lvl){
    appState.diceGrid[appState.selected]={type:a.type,lvl:Math.min(7,a.lvl+1),id:Date.now()};
    appState.diceGrid[i]=null;
    appState.selected=null;
    appState.sp+=15;
    renderBattleDice();
    updateBattleHUD();
    toast('같은 주사위 합성!');
  }else{
    appState.selected=i;
    renderBattleDice();
    toast('같은 종류 · 같은 레벨의 주사위를 선택하세요');
  }
}
function summonBattleDice(){if(appState.sp<50)return toast('SP가 부족합니다');const empty=[...Array(15).keys()].find(i=>!appState.diceGrid[i]);if(empty===undefined)return toast('빈 칸이 없습니다');appState.sp-=50;appState.diceGrid[empty]={type:appState.deck[Math.floor(Math.random()*appState.deck.length)],lvl:1,id:Date.now()+empty};renderBattleDice();updateBattleHUD()}
function addEnemy(boss=false){const layer=document.getElementById('enemyLayer');if(!layer)return;const e=document.createElement('div');e.className='enemy'+(boss?' boss':'');e.textContent=boss?'B':'●';e.style.left='-45px';e.style.top=(37+Math.random()*5)+'%';e.dataset.hp=boss?'1200':'220';layer.appendChild(e);appState.enemies.push({el:e,x:-45,hp:+e.dataset.hp,speed:20+(appState.wave*0.4)+(boss?-6:0),boss});}
function damageEnemy(target,dmg){target.hp-=dmg;if(target.hp<=0){target.el.remove();appState.enemies=appState.enemies.filter(e=>e!==target);appState.kills++;appState.sp+=bossReward(target)}}
function bossReward(e){return e.boss?25:5}
function battleLoop(ts){if(!document.getElementById('page-battle').classList.contains('active'))return;const dt=Math.min(.06,(ts-(last||ts))/1000);last=ts;appState.gameSec-=dt*appState.speed;if(appState.gameSec<=0){appState.wave++;appState.gameSec=20;addEnemy(appState.wave%5===0)}const layer=document.getElementById('enemyLayer'),width=layer?layer.clientWidth:0;
 appState.enemies.slice().forEach(e=>{e.x+=e.speed*dt*appState.speed;e.el.style.left=e.x+'px';if(e.x>width-40){e.el.remove();appState.enemies=appState.enemies.filter(x=>x!==e);document.getElementById('basehp').textContent=Math.max(0,(+document.getElementById('basehp').textContent||150)-(e.boss?25:3))}});
 if(ts-lastAttack>400/appState.speed){lastAttack=ts;const all=Object.values(D);const types=appState.diceGrid.filter(Boolean).concat(appState.deck);types.forEach(t=>{const target=appState.enemies.find(e=>e.x>0&&e.x<width-70);if(target){const def=D[t]||D.blue;damageEnemy(target,def.damage);}})}
 updateBattleHUD();requestAnimationFrame(battleLoop)}
function updateBattleHUD(){const sp=document.getElementById('sp');if(sp)sp.textContent=Math.floor(appState.sp);const s=document.getElementById('bsp');if(s)s.textContent=Math.floor(appState.sp);const w=document.getElementById('bwave');if(w)w.textContent=appState.wave;const t=document.getElementById('btime');if(t)t.textContent=Math.max(0,Math.ceil(appState.gameSec))+'s';const k=document.getElementById('bkills');if(k)k.textContent='처치 '+appState.kills}
function toggleSpeed(){appState.speed=appState.speed===1?1.5:appState.speed===1.5?2:1;toast('게임 속도 '+appState.speed+'x')}
function leaveBattle(){document.getElementById('page-battle').classList.remove('active');clearInterval(appState.matchTimer);appState.diceGrid=[];appState.page='lobby';document.getElementById('page-lobby').classList.add('active');drawLobby();updateRes();toast('전투를 종료하고 로비로 돌아왔습니다')}
function updateRes(){['coin','dice','diamond','arenaTicket','coopTicket'].forEach(k=>{const el=document.getElementById(k);if(el)el.textContent=appState.currencies[k].toLocaleString()})}
function closeModal(){document.getElementById('modalRoot').innerHTML=''}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:absolute;z-index:300;left:50%;top:78px;transform:translateX(-50%);background:#25183a;border:1px solid #694f90;border-radius:12px;padding:10px 14px;font-weight:900;opacity:0;transition:.2s';document.body.appendChild(t)}t.textContent=msg;t.style.opacity=1;clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.opacity=0,1500)}
function esc(x){return String(x||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
bootClient();
