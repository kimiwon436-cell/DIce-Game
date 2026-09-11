
window.addEventListener('error',e=>{
 const root=document.getElementById('root');
 if(root && !root.dataset.fatal){root.dataset.fatal='1';root.innerHTML=`<div class=\"auth\"><div class=\"authbox\"><h1>페이지 오류</h1><div class=\"muted\">게임 화면을 불러오지 못했습니다.</div><div class=\"tile\" style=\"margin-top:14px\"><small>${String(e.message||'알 수 없는 오류')}</small></div><button class=\"primary\" style=\"width:100%;margin-top:12px\" onclick=\"location.reload()\">새로고침</button></div></div>`}
});
const A=localStorage;
const API_BASE='';
let serverToken=A.getItem('rd2_token')||'';
const DEFAULT_CLIENT_STATE={
 user:null,page:'lobby',mode:'coop',matching:false,matchSec:0,matchTimer:null,
 sp:0,wave:1,gameSec:20,speed:1,kills:0,diceGrid:[],selected:null,enemies:[],battleDiceUpgrades:{},
 currencies:{coin:100,dice:0,diamond:0,arenaTicket:1,coopTicket:5},
 selectedTreeNode:0,
 traitLevels:{},
 treeLevels:{allDamage:1,attackSpeed:1,spGain:1},
 profile:{nickname:'',avatar:'🎲'},deck:['blue','cyan','red','green','yellow'],unlocked:['blue','cyan','red','green','yellow'],treeUnlocked:[],diceLevels:{blue:1,cyan:1,red:1,green:1,yellow:1},traitLevels:{},
 passXP:0,passRewardsClaimed:[],lucky:0,quests:[0,0,0],difficulty:'normal',room:null,isAdmin:false,coopTicketNextIn:300000,arenaTicketNextIn:1800000,matchQueueId:null,opponentType:null,opponentNickname:''
};
const appState=DEFAULT_CLIENT_STATE;




function getBrowserViewport(){
  const vv=window.visualViewport;
  const doc=document.documentElement;
  return {
    w:Math.max(1,Math.floor(vv?.width || doc.clientWidth || window.innerWidth)),
    h:Math.max(1,Math.floor(vv?.height || doc.clientHeight || window.innerHeight))
  };
}
function currentPageMode(){
  return document.getElementById('page-battle')?.classList.contains('active')?'battle':'lobby';
}
function fitStage(mode){
  const app=document.querySelector('.app');
  if(!app)return;
  const vp=getBrowserViewport();
  const mobile=vp.w<=700;
  const battle=(mode==='battle');

  app.classList.toggle('stageBattle',battle);
  app.classList.toggle('stageLobby',!battle);

  if(mobile){
    // Mobile: render against the actual browser viewport, so changing
    // Chrome/Edge size never needs fullscreen toggling.
    app.style.width='100%';
    app.style.height='100%';
    app.style.minWidth='0';
    app.style.minHeight='0';
    app.style.maxWidth='100%';
    app.style.maxHeight='100%';
    app.style.margin='0';
    app.style.transform='none';
  }else{
    const logicalW=1200,logicalH=700,margin=8;
    const scale=Math.min((vp.w-margin*2)/logicalW,(vp.h-margin*2)/logicalH);
    app.style.width=logicalW+'px';
    app.style.height=logicalH+'px';
    app.style.minWidth=logicalW+'px';
    app.style.minHeight=logicalH+'px';
    app.style.maxWidth='none';
    app.style.maxHeight='none';
    app.style.margin='0';
    app.style.transformOrigin='center center';
    app.style.transform='scale('+Math.max(.15,scale)+')';
  }
}
function refitCurrentViewport(){fitStage(currentPageMode())}
window.addEventListener('resize',refitCurrentViewport,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(refitCurrentViewport,50),{passive:true});
window.addEventListener('fullscreenchange',()=>setTimeout(refitCurrentViewport,50));
window.addEventListener('pageshow',()=>setTimeout(refitCurrentViewport,50));
window.addEventListener('visibilitychange',()=>setTimeout(refitCurrentViewport,50));
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',refitCurrentViewport,{passive:true});
  window.visualViewport.addEventListener('scroll',refitCurrentViewport,{passive:true});
}
if(window.ResizeObserver){
  const viewportObserver=new ResizeObserver(()=>refitCurrentViewport());
  viewportObserver.observe(document.documentElement);
  viewportObserver.observe(document.body);
}

const D={
 blue:{name:'바람',icon:'🌀',cls:'d-blue',damage:85,rate:750},cyan:{name:'얼음',icon:'❄',cls:'d-cyan',damage:50,rate:1000},red:{name:'화염',icon:'🔥',cls:'d-red',damage:70,rate:820},green:{name:'독',icon:'☠',cls:'d-green',damage:45,rate:1100},yellow:{name:'빛',icon:'☀',cls:'d-yellow',damage:55,rate:900},pink:{name:'분열',icon:'✿',cls:'d-pink',damage:40,rate:950},purple:{name:'성장',icon:'✦',cls:'d-purple',damage:50,rate:1000},
 orange:{name:'번개',icon:'⚡',cls:'d-yellow',damage:95,rate:720},black:{name:'암흑',icon:'🌑',cls:'d-purple',damage:115,rate:1200},white:{name:'성스러움',icon:'✧',cls:'d-cyan',damage:80,rate:880},silver:{name:'철벽',icon:'🛡️',cls:'d-blue',damage:35,rate:1300},gold:{name:'금빛',icon:'💰',cls:'d-yellow',damage:60,rate:980},aqua:{name:'파동',icon:'🌊',cls:'d-cyan',damage:70,rate:920},violet:{name:'공허',icon:'🕳️',cls:'d-purple',damage:130,rate:1400},lime:{name:'회복',icon:'💚',cls:'d-green',damage:25,rate:1500},navy:{name:'폭격',icon:'💣',cls:'d-blue',damage:120,rate:1150},coral:{name:'산호',icon:'🪸',cls:'d-pink',damage:65,rate:860},mint:{name:'민트',icon:'🌿',cls:'d-green',damage:45,rate:780},rose:{name:'장미',icon:'🌹',cls:'d-pink',damage:90,rate:930},prism:{name:'무지개',icon:'🌈',cls:'d-cyan',damage:100,rate:800},cosmic:{name:'우주',icon:'🌌',cls:'d-purple',damage:150,rate:1600}
};
async function api(path, options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 if(serverToken)headers.Authorization='Bearer '+serverToken;
 const res=await fetch(API_BASE+path,{...options,headers});
 let data={}; try{data=await res.json()}catch{}
 if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
 return data;
}
function snapshot(){return {user:appState.user,userId:appState.userId,battleMode:appState.battleMode||'coop',profile:appState.profile,currencies:appState.currencies,deck:appState.deck,unlocked:appState.unlocked,treeUnlocked:appState.treeUnlocked,diceLevels:appState.diceLevels,treeLevels:appState.treeLevels,passXP:appState.passXP,passRewardsClaimed:appState.passRewardsClaimed,lucky:appState.lucky,quests:appState.quests,difficulty:appState.difficulty,selectedTreeNode:appState.selectedTreeNode||0,traitLevels:appState.traitLevels||{}}}
function saveLocal(){try{A.setItem('rd2_local_cache',JSON.stringify(snapshot()))}catch{}}
function save(){saveLocal();if(!serverToken)return Promise.resolve();return api('/api/me/state',{method:'PUT',body:JSON.stringify(snapshot())}).catch(e=>console.warn('server save failed',e))}
function loadLocal(){
 try{
  const s=JSON.parse(A.getItem('rd2_local_cache')||'null');
  if(s&&s.profile&&s.currencies&&Array.isArray(s.deck)){
   Object.assign(appState,s);
  }
 }catch{}
 if(!appState.currencies)appState.currencies={coin:100,dice:0,diamond:0,arenaTicket:1,coopTicket:5};
 if(!Array.isArray(appState.deck))appState.deck=['blue','blue','blue','blue','blue'];
 if(!Array.isArray(appState.unlocked))appState.unlocked=[];
 if(!Array.isArray(appState.treeUnlocked))appState.treeUnlocked=[];
 if(!appState.diceLevels)appState.diceLevels={};
 if(!appState.treeLevels)appState.treeLevels={allDamage:1,attackSpeed:1,spGain:1};
 if(!appState.treeLevels.allDamage)appState.treeLevels.allDamage=1;
 if(!appState.treeLevels.attackSpeed)appState.treeLevels.attackSpeed=1;
 if(!appState.treeLevels.spGain)appState.treeLevels.spGain=1;
 if(!appState.selectedTreeNode && appState.selectedTreeNode!==0)appState.selectedTreeNode=0;
 if(!Array.isArray(appState.passRewardsClaimed))appState.passRewardsClaimed=[];
 if(!appState.arenaTicketNextIn)appState.arenaTicketNextIn=1800000;
 if(!appState.coopTicketNextIn)appState.coopTicketNextIn=300000;
}
function clearSession(){serverToken='';A.removeItem('rd2_token');A.removeItem('rd2_local_cache');appState.user=null;}
function mountShell(){
 const root=document.getElementById('root');
 root.innerHTML=appState.user?renderGame():renderAuth();
 if(appState.user){drawLobby();updateRes();}
 bindAuth();
 requestAnimationFrame(()=>{
   refitCurrentViewport();
   setTimeout(refitCurrentViewport,50);
   setTimeout(refitCurrentViewport,150);
   setTimeout(refitCurrentViewport,400);
 });
}
async function bootClient(){
 loadLocal();
 if(!serverToken){appState.user=null;mountShell();return;}
 try{
  const r=await api('/api/me');
  Object.assign(appState,r.state||{});appState.user=r.user.username;appState.isAdmin=Boolean(r.user.isAdmin || String(r.user.username||'').toLowerCase()==='kimsiwon');appState.coopTicketNextIn=r.coopTicketNextIn||300000;
  mountShell();startServerSync();startLiveSocket();
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
     serverToken=r.token;A.setItem('rd2_token',serverToken);Object.assign(appState,r.state);appState.userId=r.user.id;appState.user=r.user.username;appState.isAdmin=Boolean(r.user.isAdmin || String(r.user.username||'').toLowerCase()==='kimsiwon');appState.coopTicketNextIn=r.coopTicketNextIn||300000;appState.arenaTicketNextIn=r.arenaTicketNextIn||1800000;save();mountShell();startServerSync();startLiveSocket();
   }else{
     const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:id,password:pw})});
     serverToken=r.token;A.setItem('rd2_token',serverToken);Object.assign(appState,r.state);appState.userId=r.user.id;appState.user=r.user.username;appState.isAdmin=Boolean(r.user.isAdmin || String(r.user.username||'').toLowerCase()==='kimsiwon');appState.coopTicketNextIn=r.coopTicketNextIn||300000;appState.arenaTicketNextIn=r.arenaTicketNextIn||1800000;save();mountShell();startServerSync();startLiveSocket();
   }
  }catch(e){alert(e.message)}
 };
}function ensureBackButton(page){
 const main=document.getElementById('main');if(!main)return;
 const old=main.querySelector('.pageBack');if(old)old.remove();
 if(page==='lobby')return;
 const b=document.createElement('button');
 b.className='pageBack';b.type='button';b.textContent='← 뒤로가기';
 b.onclick=function(){nav('lobby')};
 main.insertBefore(b,main.firstChild);
}
function nav(page){
 appState.page=page;
 document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
 document.getElementById('page-'+page)?.classList.add('active');
 if(page==='lobby')drawLobby();
 if(page==='deck')drawDeck();
 if(page==='tree')drawTree();
 if(page==='style')drawStyle();
 if(page==='pass')drawPass();
 if(page==='quests')drawQuests();
 if(page==='profile')drawProfile();
 if(page==='bounty')drawBounty();
 if(page==='admin'&&appState.isAdmin)drawAdmin();
 ensureBackButton(page);
 fitStage('lobby');
}
function renderGame(){
 return `<div class="app stageLobby">
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
 <div class="chip">🪙 <b id="coin">${appState.currencies.coin}</b></div><div class="chip">🎲 <b id="dice">${appState.currencies.dice}</b></div><div class="chip">💎 <b id="diamond">${appState.currencies.diamond}</b></div><div class="chip">🏟️ <b id="arenaTicket">${appState.currencies.arenaTicket}</b> <span id="arenaTicketTimer" style="font-size:9px;color:#a99dbf"></span></div><div class="chip">🤝 <b id="coopTicket">${appState.currencies.coopTicket}</b> <span id="coopTicketTimer" style="font-size:9px;color:#a99dbf"></span></div></div><div class="topsp"></div>${appState.isAdmin?'<button class="topbtn" onclick="nav(&quot;admin&quot;)">🛠️</button>':''}<button class="topbtn profileBtn" onclick="nav('profile')"><span class="avatar">${appState.profile.avatar}</span>${esc(appState.profile.nickname)}</button>`}
function sidebar(){return `<button class="nav active" onclick="nav('lobby')"><i>🏠</i> 로비</button>
 <button class="nav" onclick="nav('deck')"><i>🎴</i> 덱</button><button class="nav" onclick="nav('tree')"><i>🌳</i> 다이스 트리</button><button class="nav" onclick="nav('style')"><i>🎨</i> 꾸미기</button>
 <button class="nav" onclick="nav('quests')"><i>📜</i> 퀘스트 <span class="badge">3</span></button><button class="nav" onclick="nav('pass')"><i>🎫</i> 다이스 패스</button><button class="nav" onclick="openLucky()"><i>🍀</i> 행운의 주사위</button><button class="nav" onclick="nav('bounty')"><i>⚔️</i> 토벌 보상</button>
 ${appState.isAdmin?'<button class="nav" onclick="nav(&quot;admin&quot;)"><i>🛠️</i> 관리자</button>':''}
 <div class="sideBottom"><div class="mini">현재 로그인: <b>${esc(appState.profile.nickname)}</b><br>협동전 티켓은 서버에서 <b>5분마다 +1</b>, 아레나 티켓은 <b>30분마다 +1</b> 지급됩니다.<br><span id="sideTicketTimer"></span><br><span id="sideArenaTimer"></span></div></div>`}
function selectGameMode(mode){appState.battleMode=mode==='battle'?'battle':'coop';saveLocal();drawLobby();toast(appState.battleMode==='battle'?'⚔️ 아레나 모드 선택':'🤝 협동전 모드 선택');}
function drawLobby(){
 const m=document.getElementById('main');if(!m)return;
 m.innerHTML=`
 <div class="hero">
   <div class="heroCard">
     <div class="muted">${appState.battleMode==='battle'?'아레나':'협동전'}</div>
     <div class="bigLogo">${appState.battleMode==='battle'?'승부를 가르자':'함께 막아내자'}</div>
     <div class="sub">게임 모드에서 모드를 선택한 뒤 여기의 플레이로 시작합니다.</div>
     <button class="play" onclick="startMatch(false,appState.battleMode||'coop')">▶ 플레이</button>
     <div class="smallHint">현재 선택: ${appState.battleMode==='battle'?'⚔️ 아레나':'🤝 협동전'} · 티켓 1장 · 매칭 → 로딩 → 전투</div>
   </div>
   <div class="modeCard">
     <h3>게임 모드</h3>
     <div class="mode ${appState.battleMode==='coop'?'sel':''}" onclick="selectGameMode('coop')"><div><b>🤝 협동전</b><span>다른 플레이어와 함께</span></div><strong>${appState.battleMode==='coop'?'선택됨':'선택'}</strong></div>
     <div class="mode ${appState.battleMode==='battle'?'sel':''}" onclick="selectGameMode('battle')"><div><b>⚔️ 아레나</b><span>각자의 길 · 먼저 기지가 파괴되면 패배</span></div><strong>${appState.battleMode==='battle'?'선택됨':'선택'}</strong></div>
     <div class="mode" onclick="openFriends()"><div><b>👥 친구와 하기</b><span>방 생성 / 코드 참가</span></div><strong>열기</strong></div>
   </div>
 </div>
 <div class="section">
   <div class="sectionHead"><h2>로비 메뉴</h2><span>아이콘 + 텍스트</span></div>
   <div class="quickNav">
     <button onclick="nav('deck')"><span class="qicon">🎴</span><span class="qtext">덱</span></button>
     <button onclick="nav('tree')"><span class="qicon">🌳</span><span class="qtext">다이스 트리</span></button>
     <button onclick="nav('style')"><span class="qicon">🎨</span><span class="qtext">꾸미기</span></button>
     <button onclick="nav('quests')"><span class="qicon">📜</span><span class="qtext">퀘스트</span></button>
     <button onclick="nav('pass')"><span class="qicon">🎫</span><span class="qtext">다이스 패스</span></button>
     <button onclick="openLucky()"><span class="qicon">🍀</span><span class="qtext">행운의 주사위</span></button>
     <button onclick="nav('bounty')"><span class="qicon">⚔️</span><span class="qtext">토벌 보상</span></button>
   </div>
 </div>
 <div class="section">
   <div class="sectionHead"><h2>내 덱</h2><span>전투에 가져갈 5개</span></div>
   <div class="deckStrip">${appState.deck.map((x,i)=>diceHTML(x,appState.diceLevels?.[x]||1)).join('')}</div>
 </div>
 <div class="section">
   <div class="sectionHead"><h2>재화</h2><span>SP는 전투 전용</span></div>
   <div class="resourceBar">
     <div class="chip">🪙 <b>${appState.currencies.coin.toLocaleString()}</b></div>
     <div class="chip">🎲 <b>${appState.currencies.dice.toLocaleString()}</b></div>
     <div class="chip">💎 <b>${appState.currencies.diamond.toLocaleString()}</b></div>
     <div class="chip">🏟️ <b>${appState.currencies.arenaTicket.toLocaleString()}</b></div>
     <div class="chip">🤝 <b>${appState.currencies.coopTicket.toLocaleString()}</b></div>
   </div>
 </div>`;
}function battlePips(rank){
 const r=Math.max(1,Math.min(6,Number(rank)||1));
 const pos={1:['c'],2:['tl','br'],3:['tl','c','br'],4:['tl','tr','bl','br'],5:['tl','tr','c','bl','br'],6:['tl','tr','ml','mr','bl','br']}[r];
 return `<div class="pips">${pos.map(x=>`<i class="pip ${x}"></i>`).join('')}</div>`;
}
function diceHTML(type,lvl=1){const d=D[type]||D.blue;return `<div class="dice ${d.cls}">${d.icon}<small>Lv.${Math.max(1,Math.min(50,Number(lvl)||1))}</small></div>`;}
function battleDiceHTML(die,selected=false){const d=D[die.type]||D.blue,r=Math.max(1,Math.min(7,Number(die.rank)||1));if(r>=7)return `<div class="dice battleDie ${d.cls} ${selected?'battleSelected':''}" title="7성 · 합성 불가"><div class="starMark">★</div></div>`;return `<div class="dice battleDie ${d.cls} ${selected?'battleSelected':''}" title="${d.name} · ${r}성">${battlePips(r)}</div>`;}
function upgradeCost(level){const lv=Math.max(1,Number(level)||1);if(lv>=50)return {coin:0,dice:0};const next=lv+1;return next%5===0?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};}
function upgradeCostText(level){const c=upgradeCost(level);return c.dice?`🎲 ${c.dice}`:`🪙 ${c.coin}`;}
function battleUpgradeCost(level){return 50+Math.max(0,level)*50;}
function drawDeck(){
 if(!appState.diceLevels)appState.diceLevels={};
 const names=appState.unlocked.map(x=>D[x]?.name||x);
 document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>덱</h2><span>${appState.deck.length}/5 장착</span></div>
 <div class="tile" style="margin-bottom:12px"><b>전투 덱</b><p>슬롯을 누르면 교체할 주사위가 열립니다. 같은 주사위는 <b>중복 장착할 수 없습니다.</b></p></div>
 <div class="deck" style="max-width:600px">${appState.deck.map((x,i)=>`<div class="slot" style="background:#1f1531;min-height:100px"><div onclick="openDeckPicker(${i})" style="width:76%;cursor:pointer">${diceHTML(x,appState.diceLevels?.[x]||1)}<div class="muted" style="text-align:center;margin-top:4px">${D[x]?.name||x}</div></div></div>`).join('')}</div>
 <div class="section"><div class="sectionHead"><h2>보유 주사위</h2><span>${appState.unlocked.length} / 20</span></div>
 <div class="cardgrid">${appState.unlocked.map((x)=>{const d=D[x];const lv=appState.diceLevels[x]||1;return `<div class="tile"><div class="row"><div style="width:48px;height:48px">${diceHTML(x,lv)}</div><div><b>${d.name}</b><div class="muted">트리 레벨 ${lv}</div></div></div><div class="muted" style="margin-top:7px">${appState.deck.includes(x)?'현재 덱 장착 중':'장착 가능'}</div><button style="margin-top:8px" onclick="openDeckPickerForDice('${x}')">덱에 장착</button></div>`}).join('')}</div>`;
 ensureBackButton('deck');
}
function deckPickerHtml(slot){const equipped=new Set(appState.deck);return `<div class="overlay"><div class="modal" style="max-width:760px"><button class="close" onclick="closeModal()">✕</button><h2>🎴 덱 주사위 교체</h2><p class="muted">슬롯 ${slot+1}에 넣을 주사위를 선택하세요.</p><div class="cardgrid">${appState.unlocked.map(x=>{const d=D[x],used=equipped.has(x)&&appState.deck[slot]!==x;return `<button class="tile" ${used?'disabled':''} onclick="setDeckSlot(${slot},'${x}')" style="text-align:left;opacity:${used?.45:1}"><div class="row"><div style="width:52px">${diceHTML(x,appState.diceLevels?.[x]||1)}</div><div><b>${d.name}</b><div class="muted">${used?'이미 장착됨':`트리 Lv.${appState.diceLevels?.[x]||1}`}</div></div></div></button>`}).join('')}</div></div></div>`}
function openDeckPicker(slot){document.getElementById('modalRoot').innerHTML=deckPickerHtml(slot)}
function openDeckPickerForDice(type){const slot=appState.deck.indexOf(type)>=0?appState.deck.indexOf(type):0;openDeckPicker(slot)}
function setDeckSlot(slot,type){if(appState.deck.some((x,i)=>x===type&&i!==slot)){toast('같은 주사위는 중복 장착할 수 없습니다');return;}appState.deck[slot]=type;save();closeModal();drawDeck();toast(`${D[type]?.name||type} 장착 완료`)}
const treeNodes=[{id:0,x:50,y:96,icon:'🎲',label:'시작',cost:0,next:[1,2],type:null},{id:1,x:7,y:84,icon:'🌀',label:'바람 주사위',cost:8,next:[3,4],type:'blue'},{id:2,x:19,y:84,icon:'❄️',label:'얼음 주사위',cost:8,next:[5,6],type:'cyan'},{id:3,x:31,y:84,icon:'🔥',label:'화염 주사위',cost:8,next:[7,8],type:'red'},{id:4,x:43,y:84,icon:'☠️',label:'독 주사위',cost:8,next:[8,9],type:'green'},{id:5,x:55,y:84,icon:'☀️',label:'빛 주사위',cost:8,next:[9,10],type:'yellow'},{id:6,x:67,y:84,icon:'✿',label:'분열 주사위',cost:8,next:[10,11],type:'pink'},{id:7,x:79,y:84,icon:'✦',label:'성장 주사위',cost:8,next:[11,12],type:'purple'},{id:8,x:8,y:64,icon:'⚡',label:'번개 주사위',cost:8,next:[13],type:'orange'},{id:9,x:20,y:64,icon:'🌑',label:'암흑 주사위',cost:8,next:[13,14],type:'black'},{id:10,x:32,y:64,icon:'✧',label:'성스러움 주사위',cost:8,next:[14,15],type:'white'},{id:11,x:44,y:64,icon:'🛡️',label:'철벽 주사위',cost:8,next:[15,16],type:'silver'},{id:12,x:56,y:64,icon:'💰',label:'금빛 주사위',cost:8,next:[16,17],type:'gold'},{id:13,x:68,y:64,icon:'🌊',label:'파동 주사위',cost:8,next:[17],type:'aqua'},{id:14,x:80,y:64,icon:'🕳️',label:'공허 주사위',cost:8,next:[18],type:'violet'},{id:15,x:25,y:42,icon:'💚',label:'회복 주사위',cost:8,next:[18],type:'lime'},{id:16,x:40,y:42,icon:'💣',label:'폭격 주사위',cost:8,next:[19],type:'navy'},{id:17,x:60,y:42,icon:'🪸',label:'산호 주사위',cost:8,next:[19],type:'coral'},{id:18,x:75,y:42,icon:'🌿',label:'민트 주사위',cost:8,next:[20],type:'mint'},{id:19,x:35,y:20,icon:'🌹',label:'장미 주사위',cost:8,next:[21],type:'rose'},{id:20,x:65,y:20,icon:'🌈',label:'무지개 주사위',cost:8,next:[21],type:'prism'},{id:21,x:50,y:5,icon:'🌌',label:'우주 주사위',cost:8,next:[],type:'cosmic'}];
function treeUnlocked(id){return id===0||appState.treeUnlocked?.includes(id);}
function treeNode(id){return treeNodes.find(x=>x.id===id);}
function treeParentFor(id){return treeNodes.filter(n=>n.next.includes(Number(id)))[0];}
function treeIsNext(id){return !treeUnlocked(id)&&treeParentFor(id)&&treeUnlocked(treeParentFor(id).id);}
function ensureTreeState(){if(!Array.isArray(appState.treeUnlocked))appState.treeUnlocked=[];if(!Array.isArray(appState.unlocked))appState.unlocked=[];if(!appState.diceLevels)appState.diceLevels={};if(!appState.treeLevels)appState.treeLevels={allDamage:1,attackSpeed:1,spGain:1};}
function treeUpgradeCost(level){const lv=Math.max(1,Number(level)||1);if(lv>=50)return {coin:0,dice:0};const next=lv+1;return next%5===0?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};}
function selectedTreeLevel(node){return node?.upgrade?(appState.treeLevels?.[node.upgrade]||1):(appState.diceLevels?.[node?.type]||1);}
function treeUpgradeKey(node){return node?.upgrade||node?.type||'';}
function openTraitShop(type){const d=D[type]||D.blue,lv=Math.max(0,Number(appState.traitLevels?.[type]||0));document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><button class="close" onclick="closeModal()">✕</button><h2>⭐ ${d.name} 특성</h2><p class="muted">다이스 트리 Lv.10에서 구매창이 열립니다.</p><div class="tile"><b>현재 특성 ${lv}/5</b><p>각 단계마다 해당 주사위의 고유 특성이 강화됩니다.</p><p>다음 구매 비용: 🪙 ${500*(lv+1)}</p></div>${lv<5?`<button class="primary" style="width:100%" onclick="buyTrait('${type}')">특성 Lv.${lv+1} 구매</button>`:'<div class="tile">MAX · 특성 5단계</div>'}</div></div>`}
async function buyTrait(type){try{const r=await api('/api/dice/trait',{method:'POST',body:JSON.stringify({type})});applyServerResponse(r);closeModal();drawTree();updateRes();toast(`${r.trait?.label||'특성'} Lv.${r.trait?.level} 구매 완료`)}catch(e){toast(e.message)}}
function selectTreeNode(id){const n=Number(id);if(!treeNode(n))return;appState.selectedTreeNode=n;saveLocal();drawTree();}
async function upgradeTreeDice(type){try{const r=await api('/api/tree/upgrade',{method:'POST',body:JSON.stringify({type})});applyServerResponse(r);drawTree();updateRes();toast(r.upgrade?.label||`${D[type]?.name||'업그레이드'} 업그레이드 완료`);}catch(e){toast(e.message)}}
async function buyTree(id){ensureTreeState();const node=treeNode(id);if(!node)return;if(treeUnlocked(id)){appState.selectedTreeNode=id;drawTree();return;}if(!treeIsNext(id)){toast('먼저 연결된 앞의 노드를 해금하세요');return;}try{const r=await api('/api/tree/unlock',{method:'POST',body:JSON.stringify({nodeId:id})});applyServerResponse(r);appState.selectedTreeNode=id;drawTree();updateRes();toast(`${node.label} 해금 완료 · 🎲 -8`);}catch(e){toast(e.message)}}
function treeDetails(node){if(!node||node.id===0)return `<div class="tile"><b>다이스 트리</b><p>노드 간격을 넓혀 성장 경로를 길게 구성했습니다.</p><p style="margin-top:7px">주사위 해금은 <b>🎲 8개</b>, 업그레이드는 <b>최대 50레벨</b>입니다.</p></div>`;const unlocked=treeUnlocked(node.id),key=treeUpgradeKey(node),lv=selectedTreeLevel(node),c=treeUpgradeCost(lv),isPassive=!!node.upgrade;if(!unlocked)return `<div class="tile"><div class="row"><div style="width:64px;font-size:36px">${node.icon}</div><div class="grow"><h3 style="margin:0">${node.label}</h3><div class="muted">잠긴 노드</div></div></div><p style="margin-top:10px">앞의 연결 노드를 해금하면 이 노드를 구매할 수 있습니다.</p><button class="primary" style="width:100%" onclick="buyTree(${node.id})">🎲 8개로 해금</button></div>`;const effect=isPassive?(key==='allDamage'?`모든 주사위 공격력 +${(lv-1)*5}%`:(key==='attackSpeed'?`모든 주사위 공격속도 +${(lv-1)*2}%`:`SP 획득량 +${(lv-1)*3}%`)):`주사위 자체 성장 레벨 · 전투 성급과는 별개`;return `<div class="tile"><div class="row"><div style="width:64px">${isPassive?node.icon:diceHTML(node.type,lv)}</div><div class="grow"><h3 style="margin:0">${node.label}</h3><div class="muted">현재 레벨 ${lv} / 50</div></div></div><p style="margin-top:10px">${effect}</p>${node.type&&lv>=10?`<button class="primary" style="width:100%;margin:8px 0" onclick="openTraitShop('${node.type}')">⭐ 특성 업그레이드 구매</button>`:''}${lv>=50?'<div class="tile">MAX · 50레벨</div>':`<p>다음 레벨 <b>${lv+1}</b> · 비용 <b>${c.dice?`🎲 ${c.dice}`:`🪙 ${c.coin}`}</b></p><button class="primary" style="width:100%" onclick="upgradeTreeDice('${key}')">레벨 ${lv+1}로 업그레이드</button><p class="muted" style="margin-top:8px">5·10·15·… 레벨에 도달할 때만 🎲 8개, 나머지는 코인을 사용합니다.</p>`}</div>`;}
function drawTree(){ensureTreeState();if(!appState.selectedTreeNode&&appState.selectedTreeNode!==0)appState.selectedTreeNode=0;const edges=[];treeNodes.forEach(n=>n.next.forEach(to=>{const t=treeNode(to);if(t){const dx=(t.x-n.x)*7,dy=(t.y-n.y)*4;edges.push(`<div class="treeEdge" style="left:${n.x}%;top:${n.y}%;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)"></div>`)}}));const nodes=treeNodes.map(n=>{const open=treeUnlocked(n.id),next=treeIsNext(n.id),selected=appState.selectedTreeNode===n.id;return `<div class="treeNode ${open?'treeOpen':next?'treeNext':'treeLocked'} ${selected?'treeSelected':''}" style="left:${n.x}%;top:${n.y}%" onclick="selectTreeNode(${n.id})"><div class="treeIcon">${n.icon}</div><div class="treeLevel">${open?'해금됨':next?'다음 해금':'잠김'}</div><div class="treeLabel">${n.label}</div>${open&&n.id>0?'<div class="treeCheck">✓</div>':''}${!open?`<div class="treeCost">🎲 ${n.cost}</div>`:''}</div>`}).join('');document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>다이스 트리</h2><span>노드 간격 확대 · 50레벨</span></div><div class="treeLayout"><div class="treeWide"><div class="treeCanvas">${edges.join('')}${nodes}</div><div class="treeLegend"><span>🟢 해금</span><span>🟡 다음 해금</span><span>⚫ 잠김</span></div></div><div class="treeDetails">${treeDetails(treeNode(appState.selectedTreeNode))}</div></div><div class="section"><div class="tile"><b>중요</b><p>협동/아레나에서 보이는 <b>1~7성은 이 로비 레벨과 완전히 별개</b>입니다. 같은 주사위 + 같은 성만 합성할 수 있고, 합성된 칸이 한 단계 높은 성으로 바뀌며 비워진 칸은 덱에서 1성으로 즉시 보충됩니다.</p></div></div>`;}
function drawStyle(){document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>꾸미기</h2><span>로비에서만 변경 가능</span></div><div class="skinGrid">
 ${['🎲','🌀','❄️','🔥','🌈','🧊','⚡','🌸'].map((a,i)=>`<div class="skin"><div class="art" style="background:hsl(${i*42},55%,35%)">${a}</div><b>${['기본','바람 테마','얼음 테마','화염 테마','무지개 테마','빙하 테마','번개 테마','벚꽃 테마'][i]}</b><button class="topbtn" style="margin-top:8px;width:100%" onclick="toast('${i===0?'기본 꾸미기 적용':'꾸미기를 적용했습니다'}')">사용</button></div>`).join('')}
 </div>`}
const PASS_REWARDS_CLIENT=Array.from({length:50},(_,i)=>({xp:(i+1)*10,label:i%5===4?`🎲 주사위 ${20+i*5}`:(i%3===0?`🪙 코인 ${(i+1)*100}`:`🎫 티켓 1`),icon:i%5===4?'🎲':(i%3===0?'🪙':'🎫'),kind:i%5===4?'dice':(i%3===0?'coin':'coopTicket'),value:i%5===4?20+i*5:(i%3===0?(i+1)*100:1)}));
function drawPass(){
 const xp=appState.passXP;const claimed=appState.passRewardsClaimed||[];const level=Math.min(50,Math.floor(xp/10));const next=PASS_REWARDS_CLIENT.find(r=>xp>=r.xp&&!claimed.includes(r.xp));
 document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>다이스 패스</h2><span>최대 50레벨</span></div><div class="pass"><div class="passHero"><div class="muted">무료 패스</div><h2 style="margin:5px 0 12px">시즌 보상</h2><div class="progress"><i style="width:${Math.min(100,(level/50)*100)}%"></i></div><div class="row" style="margin-top:8px"><b>Lv.${level}/50</b><span class="muted grow">${next?`다음 보상 Lv.${next.xp/10}`:'모든 보상 수령 완료'}</span></div>${next&&xp>=next.xp?`<button class="primary" style="margin-top:12px" onclick="claimPass()">${next.icon} ${next.label} 받기</button>`:''}</div><div>${PASS_REWARDS_CLIENT.map(r=>`<div class="tile" style="margin-bottom:6px"><b>Lv.${r.xp/10}</b> · ${r.label} ${claimed.includes(r.xp)?'✅':''}</div>`).join('')}</div></div>`;
 ensureBackButton('pass');
}
async function claimPass(){try{const r=await api('/api/pass/claim-next',{method:'POST'});applyServerResponse(r);drawPass();toast(r.reward?.label||'다이스 패스 보상을 받았습니다')}catch(e){toast(e.message)}}
function openLucky(){document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><button class="close" onclick="closeModal()">✕</button><h2>🍀 행운의 주사위</h2><div class="muted">서버에서 보유량과 보상을 판정합니다.</div><div style="margin:20px 0;text-align:center;font-size:58px">🎲</div><div class="tile"><b>보유 행운의 주사위 ${appState.lucky}개</b><p>사용할 때마다 서버에서 코인, 주사위, 패스 XP 중 하나의 보너스를 확정합니다.</p></div><button class="primary" style="width:100%;margin-top:12px" onclick="useLucky()">행운의 주사위 1개 사용</button></div></div>`}
async function useLucky(){
 try{const r=await api('/api/lucky/use',{method:'POST'});applyServerResponse(r);closeModal();toast(r.reward?.label||'🍀 행운의 보상을 받았습니다');}
 catch(e){toast(e.message)}
}
function drawBounty(){
 const reached=Math.floor((appState.kills||0)/100);
 const claimed=appState.bountyClaimed||0;
 const reward=reached>claimed?`보상 ${reached*100}킬 달성`:'다음 보상까지 '+((claimed+1)*100-(appState.kills||0))+'킬';
 document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>토벌 보상</h2><span>협동전 100킬마다 획득</span></div>
 <div class="tile"><h3>현재 처치 수 · ${appState.kills||0} / 5000</h3><p>${reward}</p>
 <button class="primary" onclick="claimBountyMilestone()">토벌 보상 받기</button></div>`;
}
function claimBountyMilestone(){
 const reached=Math.floor((appState.kills||0)/100);
 const claimed=appState.bountyClaimed||0;
 if(reached<=claimed)return toast('아직 받을 토벌 보상이 없습니다');
 const count=reached-claimed;
 appState.bountyClaimed=reached;
 appState.currencies.coin+=count*500;
 save();updateRes();drawBounty();toast('토벌 보상 '+(count*500).toLocaleString()+' 코인 획득!');
}
async function logout(){
 try{if(serverToken)await api('/api/auth/logout',{method:'POST'})}catch{}
 serverToken='';clearSession();mountShell()
}
function openFriends(){document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><button class="close" onclick="closeModal()">닫기</button><h2>👥 친구와 하기</h2><p class="muted">방을 만들거나 다른 플레이어가 알려준 방 코드로 참가합니다.</p><div class="row" style="margin-top:16px"><button class="primary grow" onclick="createRoom()">방 만들기</button><button class="topbtn grow" onclick="joinRoom()">코드 참가</button></div><div id="friendArea" style="margin-top:15px"></div></div></div>`}
function createRoom(){appState.room=Math.random().toString(36).slice(2,8).toUpperCase();document.getElementById('friendArea').innerHTML=`<div class="tile"><div class="muted">내 방 코드</div><div style="font-size:34px;font-weight:1000;letter-spacing:5px;text-align:center;margin:10px">${appState.room}</div><div class="row"><button class="topbtn grow" onclick="navigator.clipboard?.writeText('${appState.room}');toast('방 코드 복사')">코드 복사</button><button class="primary grow" onclick="startMatch(true)">준비 / 시작</button></div></div>`}
function joinRoom(){const area=document.getElementById('friendArea');area.innerHTML=`<div class="row"><input class="input grow" id="roomInput" placeholder="6자리 방 코드"><button class="primary" onclick="joinConfirm()">참가</button></div>`}
function joinConfirm(){const x=(document.getElementById('roomInput').value||'').trim().toUpperCase();if(x.length<4)return toast('방 코드를 확인하세요');appState.room=x;document.getElementById('friendArea').innerHTML=`<div class="tile"><b>방 ${x}</b><p>호스트가 시작할 때까지 준비 상태로 대기합니다.</p><button class="primary" style="width:100%" onclick="startMatch(true)">준비 완료</button></div>`}
async function startMatch(fromFriend=false,mode='coop'){
 if(appState.matching)return;
 appState.battleMode=mode;appState.matching=true;appState.matchSec=0;appState.matchQueueId=null;appState.opponentType=null;appState.opponentNickname='';
 document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="match"><div class="muted">협동전 온라인 매칭</div><h1>플레이어 찾는 중</h1><div class="spinner"></div><div class="matchtime" id="matchTime">0:00</div><div class="matchstate" id="matchState">매칭 서버에 연결 중...</div><div class="muted" id="matchRule">30초 동안 다른 플레이어를 찾습니다. 찾지 못하면 AI와 시작합니다.</div><button class="cancel" onclick="cancelMatch()">취소</button></div></div>`;
 try{
   const r=await api('/api/match/join',{method:'POST',body:JSON.stringify({mode:appState.battleMode||mode})});
   appState.matchQueueId=r.queueId||null;
   if(r.state){appState.currencies=r.state.currencies;}
   if(r.coopTicketNextIn!=null)appState.coopTicketNextIn=Number(r.coopTicketNextIn);
 if(r.arenaTicketNextIn!=null)appState.arenaTicketNextIn=Number(r.arenaTicketNextIn);
   updateRes();
   if(r.status==='matched')handleMatchResult(r);else pollMatchStatus();
 }catch(e){appState.matching=false;closeModal();toast(e.message)}
}
function pollMatchStatus(){
 clearInterval(appState.matchTimer);
 appState.matchTimer=setInterval(async()=>{
   if(!appState.matching||!appState.matchQueueId)return;
   try{
     const r=await api('/api/match/status/'+encodeURIComponent(appState.matchQueueId));
     appState.matchSec=Number(r.elapsed||appState.matchSec);
     const mt=document.getElementById('matchTime'),st=document.getElementById('matchState');
     if(mt){const sec=Math.min(30,appState.matchSec);mt.textContent=`0:${String(sec).padStart(2,'0')}`}
     if(st){st.textContent=r.status==='waiting'?`상대 플레이어 검색 중... ${Math.max(0,Number(r.remaining||0))}초`:'매칭 완료 · 게임 준비 중...'}
     if(r.status==='matched'||r.status==='ai')handleMatchResult(r);
   }catch(e){
     console.warn('match poll',e);
     if(appState.matchSec>=30){
       clearInterval(appState.matchTimer);
       appState.matchTimer=null;
       appState.matching=false;
       appState.opponentType='ai';
       appState.opponentNickname='AI 플레이어';
       toast('30초 동안 플레이어가 없어 AI로 시작합니다');
       beginLoading('ai','AI 플레이어');
     }
   }
 },1000);
}
function handleMatchResult(r){
 clearInterval(appState.matchTimer);appState.matchTimer=null;appState.matching=false;
 appState.opponentType=r.opponentType||'ai';appState.opponentNickname=r.opponentNickname|| (r.opponentType==='player'?'플레이어':'AI 플레이어');appState.matchId=r.matchId||null;appState.battleMode=r.mode||appState.battleMode||'coop';
 beginLoading(appState.opponentType,appState.opponentNickname);
}
async function cancelMatch(){
 clearInterval(appState.matchTimer);appState.matchTimer=null;
 try{const r=await api('/api/match/cancel',{method:'POST'});if(r.state)appState.currencies=r.state.currencies;updateRes()}catch(e){console.warn(e)}
 appState.matching=false;appState.matchQueueId=null;closeModal();
} 
function beginLoading(opponentType='ai',opponentNickname='AI 플레이어'){
 closeModal();const l=document.getElementById('loading');l.classList.add('active');let p=0;const bar=document.getElementById('loadBar'),txt=document.getElementById('loadText');
 const iv=setInterval(()=>{p+=10;bar.style.width=p+'%';txt.textContent=p<30?`${opponentType==='player'?'플레이어':'AI'} 정보를 불러오는 중...`:p<70?'전투 덱을 준비하는 중...':p<100?'맵과 적을 준비하는 중...':'전투 시작!';if(p>=100){clearInterval(iv);setTimeout(()=>{l.classList.remove('active');startBattle()},400)}},180)
}
function startBattle(){
 const mode=appState.battleMode||'coop',opponentType=appState.opponentType||'ai',opponentName=appState.opponentNickname||(opponentType==='player'?'플레이어':'AI 플레이어'),playerName=appState.profile.nickname||appState.user||'플레이어';
 appState.battle={mode,matchId:appState.matchId||null,opponentType,playerName,opponentName,opponentDice:[],opponentSpeed:1,opponentBase:150,myBase:150,sharedBase:150};appState.coopEnded=false;
 const title=mode==='battle'?'⚔️ 아레나':'🤝 협동전',sub=mode==='battle'?'각자의 길 · 먼저 기지 HP가 0이 되면 패배':'가운데 하나의 길을 함께 방어 · 5000킬 클리어';
 const middle=mode==='battle'?`<div class="battleSplitPath topLane"><div id="oppEnemies"></div></div><div class="battleSplitPath bottomLane"><div id="myEnemies"></div></div>`:`<div class="battleSharedPath"><div id="sharedEnemies"></div></div>`;
 const baseTop=mode==='battle'?'<span id="oppBaseLabel" class="base">❤️ 150</span>':'<span id="oppBaseLabel" class="base">🤝 공동</span>',baseBottom=mode==='battle'?'<span id="myBaseLabel" class="base">❤️ 150</span>':'<span id="myBaseLabel" class="base">🤝 공동</span>';
 document.getElementById('page-battle').innerHTML=`<div class="battle"><div class="battleTop"><button class="topbtn" onclick="leaveBattle()">‹</button><div style="min-width:72px"><b id="bwave">0</b><div style="font-size:8px;color:#b9adca">${mode==='coop'?'KILL':'BASE'}</div></div><div class="pill">${title}</div><div class="pill">상대: ${esc(opponentName)}</div><div class="pill" id="btime">${mode==='coop'?'5000':'HP'}</div><div class="pill right">SP <span id="bsp">100</span></div><div class="pill" id="bkills">처치 0</div></div><div class="coopArena"><div class="killProgress">${mode==='coop'?'협동 처치':'기지 상태'} <b id="killCount">${mode==='coop'?0:150}</b> ${mode==='coop'?'/ 5000':'HP'}<i id="killBar" style="width:100%"></i></div><div class="bossBadge" id="bossBadge">BOSS</div><div class="coopPlayer opponent"><div class="coopHeader"><span class="who">상대 · ${esc(opponentName)}</span><span id="oppSpeedLabel" class="who">1.0x</span><span class="who">${opponentType==='player'?'온라인':'AI'}</span>${baseTop}</div><div class="coopField"><div class="coopGrid" id="opponentDiceGrid"></div></div></div>${middle}<div class="coopPlayer me"><div class="coopHeader"><span class="who">나 · ${esc(playerName)}</span><span id="mySpeedLabel" class="who">1.0x</span><span class="who">SP <span id="miniSp">100</span></span>${baseBottom}</div><div class="coopField"><div class="coopGrid" id="myDiceGrid"></div></div></div></div><div class="battlebar"><div class="battleControlsRow"><div class="sp">✦ <span id="sp">100</span></div><button class="spawn" onclick="summonBattleDice()">소환 · SP 50</button><button class="speed" id="speedButton" onclick="toggleSpeed()">1.0x</button></div><div class="battleUpgrade" id="battleUpgrade"><div class="battleUpgradeTitle"><b>주사위 업그레이드</b><span>이번 판에서만 적용</span></div><div class="battleDieUpgradeList" id="battleDieUpgradeList">${battleUpgradeHTML()}</div></div></div><div class="battleBottom">${sub}</div></div>`;
 navBattle();setupBattle();
}
function navBattle(){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById('page-battle').classList.add('active');fitStage('battle');}
function makeFullGrid(deck,prefix='die'){const source=(Array.isArray(deck)&&deck.length?deck:['blue']);return Array.from({length:15},(_,i)=>({type:source[Math.floor(Math.random()*source.length)]||'blue',rank:1,id:prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)+i}));}
function randomBattleDie(prefix='refill'){const deck=appState.deck?.length?appState.deck:['blue'];return {type:deck[Math.floor(Math.random()*deck.length)]||'blue',rank:1,id:prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)};}
function renderBattleDice(){const draw=(id,grid,clickable)=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=(grid||[]).map((die,i)=>`<div class="slot"><div onclick="${clickable?`battleSelect(${i})`:''}">${battleDiceHTML(die,clickable&&appState.selected===i)}</div></div>`).join('')};draw('myDiceGrid',appState.diceGrid,true);draw('opponentDiceGrid',appState.battle?.opponentDice||[],false);}
function battleSelect(i){if(!appState.diceGrid?.[i])return;if(appState.selected!=null&&appState.selected!==i){const a=appState.selected,b=i;const A=appState.diceGrid[a],B=appState.diceGrid[b];if(A&&B&&A.type===B.type&&A.rank===B.rank){tryBattleMerge(a,b);return;}toast('같은 주사위 + 같은 성을 선택하면 합성됩니다.');return;}appState.selected=appState.selected===i?null:i;renderBattleDice();}
function tryBattleMerge(a,b){if(a===b)return toast('서로 다른 칸을 선택하세요');const A=appState.diceGrid[a],B=appState.diceGrid[b];if(!A||!B)return toast('주사위를 선택하세요');if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');B.rank=Math.min(7,B.rank+1);appState.diceGrid[a]=randomBattleDie('merge');appState.selected=null;renderBattleDice();sendBattle({type:'merge',from:a,to:b,die:B});}
function summonBattleDice(){if(appState.sp<50)return toast('SP가 부족합니다.');appState.sp-=50;let idx=0,min=99;appState.diceGrid.forEach((d,i)=>{if((d?.rank||1)<min){min=d.rank;idx=i;}});appState.diceGrid[idx]=randomBattleDie('summon');appState.selected=null;renderBattleDice();sendBattle({type:'summon',slot:idx,die:appState.diceGrid[idx]});updateBattleHUD();}
function toggleSpeed(){appState.speed=appState.speed>=2?1:appState.speed+0.5;sendBattle({type:'speed',speed:appState.speed});updateBattleHUD();}
function battleDieUpgradeCost(type){const lv=Number(appState.battleDiceUpgrades?.[type]||0);return 40+(lv*35);}
function upgradeBattleDie(type){if(!D[type])return;const lv=Number(appState.battleDiceUpgrades?.[type]||0);if(lv>=10)return toast('이 주사위는 이번 판 업그레이드가 최대 레벨입니다.');const cost=battleDieUpgradeCost(type);if(appState.sp<cost)return toast('SP가 부족합니다.');appState.sp-=cost;appState.battleDiceUpgrades[type]=lv+1;updateBattleHUD();toast(`${D[type].name} 주사위 · 이번 판 공격력 +${(lv+1)*15}%`);}
function battleUpgradeHTML(){const types=[...new Set(appState.deck||[])].filter(Boolean);return types.map(type=>{const lv=Number(appState.battleDiceUpgrades?.[type]||0),cost=battleDieUpgradeCost(type),d=D[type]||D.blue;return `<button class="battleDieUpgradeBtn" onclick="upgradeBattleDie('${type}')"><span class="upgradeDieIcon ${d.cls}">${d.icon}</span><span class="upgradeDieText"><b>${d.name}</b><small>Lv.${lv}/10 · +${lv*15}%</small></span><strong>SP ${cost}</strong></button>`}).join('');}
function setupBattle(){appState.sp=100;appState.battleDiceUpgrades={};appState.kills=0;appState.gameSec=0;appState.speed=1;appState.selected=null;appState.coopEnded=false;appState.killGoal=5000;appState.nextBossKill=150;appState.bossIndex=0;appState.myBossCount=0;appState.oppBossCount=0;appState.battleUpgradeLevel=0;appState.battleUpgradeDamage=0;appState.enemies=[];appState.oppEnemies=[];appState.sharedEnemies=[];appState.diceGrid=makeFullGrid(appState.deck||['blue'],'me');appState.battle.myBase=150;appState.battle.opponentBase=150;appState.battle.sharedBase=150;appState.battle.opponentSpeed=1;appState.battle.opponentDice=appState.opponentType==='ai'?makeFullGrid(appState.deck||['blue'],'ai'):[];last=0;lastAttack=0;lastOpponentAttack=0;appState._atk={};renderBattleDice();updateBattleHUD();for(let i=0;i<6;i++){setTimeout(()=>addEnemyFor('me'),i*260);setTimeout(()=>addEnemyFor(appState.battle.mode==='coop'?'shared':'opp'),i*260);}if(appState.opponentType==='player'&&appState.matchId)sendBattle({type:'battle_join',matchId:appState.matchId,grid:appState.diceGrid,speed:appState.speed,mode:appState.battle.mode});window.rd2BattleRaf=requestAnimationFrame(battleLoop);}
let last=0,lastAttack=0,lastOpponentAttack=0;
function countKill(side,e){if(e._counted)return;e._counted=true;if(appState.battle.mode==='coop'&&side!=='shared')return;if(side==='me'||side==='shared'){appState.kills++;appState.sp=Math.min(9999,appState.sp+(e.boss?35:5)*(1+((appState.treeLevels?.spGain||1)-1)*0.03));if(appState.kills>=5000){endCoop('클리어','5000킬을 달성했습니다!');return;}if(appState.kills>=appState.nextBossKill){spawnBossSet('shared');appState.nextBossKill+=150;}}}
function spawnBossSet(side){appState.bossIndex++;const count=Math.max(1,Math.min(1+Math.floor(appState.kills/750),6));for(let i=0;i<count;i++)setTimeout(()=>addEnemyFor(side,true),i*260);const badge=document.getElementById('bossBadge');if(badge){const names=['돌진형','흡수형','분열형','빙결형','폭격형','광폭형'];badge.textContent='BOSS · '+names[(appState.bossIndex-1)%names.length]+' × '+count;badge.style.display='block';clearTimeout(window.__bossBadgeTimer);window.__bossBadgeTimer=setTimeout(()=>badge.style.display='none',1800);}}
function addEnemyFor(side,boss=false){const id=side==='shared'?'sharedEnemies':side==='me'?'myEnemies':'oppEnemies',layer=document.getElementById(id);if(!layer)return;const names=['돌진형','흡수형','분열형','빙결형','폭격형','광폭형'],skill=boss?names[(appState.bossIndex-1)%names.length]:'';const el=document.createElement('div');el.className='coopEnemy'+(boss?' boss':'');el.textContent=boss?'B':'●';el.style.top=(35+Math.random()*25)+'%';el.title=skill;layer.appendChild(el);const e={el,x:-18,y:35+Math.random()*25,hp:boss?900:190+Math.min(1400,appState.kills*.35),max:boss?900:190+Math.min(1400,appState.kills*.35),speed:17+Math.min(18,appState.kills*.004)+(boss?-4:0),boss,side,skill,stunned:false};(side==='shared'?appState.sharedEnemies:side==='me'?appState.enemies:appState.oppEnemies).push(e);}
function useBossSkill(e){if(!e.boss||e._skillUsed)return;if(e.x>10&&e.x<18){e._skillUsed=true;switch(e.skill){case '돌진형':e.speed*=2.7;break;case '흡수형':e.hp=Math.min(e.max,e.hp+e.max*.45);break;case '분열형':addEnemyFor(e.side,false);break;case '빙결형':appState.speed=Math.max(.7,appState.speed-.3);break;case '폭격형':appState.battle.sharedBase=Math.max(0,appState.battle.sharedBase-8);break;case '광폭형':e.speed*=1.8;break;}}}
function damageSideEnemy(e,dmg){e.hp-=dmg;if(e.hp<=0){e.el.remove();const arr=e.side==='shared'?appState.sharedEnemies:e.side==='me'?appState.enemies:appState.oppEnemies,idx=arr.indexOf(e);if(idx>=0)arr.splice(idx,1);countKill(e.side,e);}}
function moveSide(side,dt){const arr=side==='shared'?appState.sharedEnemies:side==='me'?appState.enemies:appState.oppEnemies,layer=document.getElementById(side==='shared'?'sharedEnemies':side==='me'?'myEnemies':'oppEnemies'),width=layer?.clientWidth||380;arr.slice().forEach(e=>{useBossSkill(e);e.x+=e.speed*dt*(side==='me'?appState.speed:side==='opp'?appState.battle.opponentSpeed:Math.max(appState.speed,.8));e.el.style.left=e.x+'px';if(e.x>width-4){e.el.remove();const idx=arr.indexOf(e);if(idx>=0)arr.splice(idx,1);if(appState.battle.mode==='coop')appState.battle.sharedBase=Math.max(0,appState.battle.sharedBase-(e.boss?25:3));else if(side==='me')appState.battle.myBase=Math.max(0,appState.battle.myBase-(e.boss?25:3));else appState.battle.opponentBase=Math.max(0,appState.battle.opponentBase-(e.boss?25:3));if(appState.battle.mode==='battle'&&(appState.battle.myBase<=0||appState.battle.opponentBase<=0)&&!appState.coopEnded)endCoop(appState.battle.myBase<=0?'패배':'승리',appState.battle.myBase<=0?'내 기지가 먼저 파괴되었습니다.':'상대 기지가 먼저 파괴되었습니다.');}});}
function loopBattleBots(dt){if(appState.opponentType==='ai'){if(!appState.battle.opponentDice.length){appState.battle.opponentDice=makeFullGrid(appState.deck||['blue'],'ai');renderBattleDice();}appState.battle.opponentSpeed=appState.speed;const arr=appState.battle.mode==='coop'?appState.sharedEnemies:appState.oppEnemies;if(arr.length<Math.min(6+Math.floor(appState.kills/350),18)&&Math.random()<dt*(1+appState.kills/1800))addEnemyFor(appState.battle.mode==='coop'?'shared':'opp');if(appState.battle.mode==='coop'){const bossTarget=Math.floor(appState.kills/150);if(bossTarget>appState.oppBossCount){appState.oppBossCount=bossTarget;const count=Math.max(1,Math.min(1+Math.floor(appState.kills/750),6));for(let i=0;i<count;i++)setTimeout(()=>addEnemyFor('shared',true),i*260);}}}}
function dieDamage(die){const lobbyLv=Math.max(1,Math.min(50,Number(appState.diceLevels?.[die.type]||1))),rank=Math.max(1,Math.min(7,Number(die.rank)||1)),permanent=1+(lobbyLv-1)*.08,global=1+((appState.treeLevels?.allDamage||1)-1)*.05,battle=1+(Number(appState.battleDiceUpgrades?.[die.type]||0))/100;return (D[die.type]?.damage||50)*permanent*(1+(rank-1)*.75)*global*battle;}
function attackSide(side,ts){const grid=side==='me'?appState.diceGrid:appState.battle.opponentDice;if(!grid?.length)return;const targetArr=appState.battle.mode==='coop'?appState.sharedEnemies:(side==='me'?appState.enemies:appState.oppEnemies);if(!targetArr.length)return;const speedGlobal=1+((appState.treeLevels?.attackSpeed||1)-1)*.02,intervalBase=side==='me'?460:520;grid.forEach(die=>{if(!die)return;const key=die.id+'-'+side,rate=Math.max(120,intervalBase/speedGlobal),lastAtk=appState._atk[key]||0;if(ts-lastAtk>=rate){appState._atk[key]=ts;const t=targetArr[0];if(t)damageSideEnemy(t,dieDamage(die)*(side==='opp'?.62:1));}})}
function battleLoop(ts){if(!document.getElementById('page-battle').classList.contains('active'))return;const dt=Math.min(.06,(ts-(last||ts))/1000);last=ts;if(!appState.coopEnded&&!appState.paused){const spGain=7*(1+((appState.treeLevels?.spGain||1)-1)*.03);appState.sp=Math.min(9999,appState.sp+dt*spGain*appState.speed);loopBattleBots(dt);moveSide(appState.battle.mode==='coop'?'shared':'me',dt);if(appState.battle.mode==='battle')moveSide('opp',dt);attackSide('me',ts);if(appState.battle.mode==='battle')attackSide('opp',ts);const arr=appState.battle.mode==='coop'?appState.sharedEnemies:appState.enemies;if(arr.length<Math.min(7+Math.floor(appState.kills/400),18)&&Math.random()<dt*(.8+appState.kills/2500)*appState.speed)addEnemyFor(appState.battle.mode==='coop'?'shared':'me');updateBattleHUD();}window.rd2BattleRaf=requestAnimationFrame(battleLoop);}
function sendBattle(msg){if(!liveSocket||liveSocket.readyState!==WebSocket.OPEN||!appState.matchId)return;try{liveSocket.send(JSON.stringify({...msg,matchId:appState.matchId}));}catch(e){console.warn('battle send',e)}}
function handleRemoteBattle(m){if(!appState.battle||m.matchId!==appState.matchId)return;if(m.type==='battle_join'){appState.battle.opponentType='player';appState.battle.opponentDice=m.grid||[];appState.battle.opponentSpeed=Number(m.speed||1);renderBattleDice();}else if(m.type==='summon'){if(Number.isInteger(m.slot)&&m.die){appState.battle.opponentDice[m.slot]=m.die;renderBattleDice();}}else if(m.type==='merge'){if(Number.isInteger(m.from)&&Number.isInteger(m.to)&&m.die){appState.battle.opponentDice[m.from]=randomBattleDie('remote');appState.battle.opponentDice[m.to]=m.die;renderBattleDice();}}else if(m.type==='speed'){appState.battle.opponentSpeed=Math.max(1,Math.min(2,Number(m.speed)||1));updateBattleHUD();}else if(m.type==='battle_game_over'){appState.coopEnded=true;toast('상대가 전투를 종료했습니다.');}}
function endCoop(title,msg){if(appState.coopEnded)return;appState.coopEnded=true;cancelAnimationFrame(window.rd2BattleRaf||0);sendBattle({type:'battle_game_over',title});document.getElementById('modalRoot').innerHTML=`<div class="overlay"><div class="modal"><h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p><div class="tile"><b>${appState.battle?.mode==='coop'?'처치':'기지 상태'}: ${appState.battle?.mode==='coop'?appState.kills:(appState.battle?.myBase??0)}</b><p style="margin-top:6px">이번 판 업그레이드: 공격력 +${appState.battleUpgradeDamage||0}%</p></div><button class="primary" style="width:100%" onclick="closeModal();leaveBattle()">로비로</button></div></div>`;}
function updateBattleHUD(){const sp=document.getElementById('sp');if(sp)sp.textContent=Math.floor(appState.sp);const mini=document.getElementById('miniSp');if(mini)mini.textContent=Math.floor(appState.sp);const s=document.getElementById('bsp');if(s)s.textContent=Math.floor(appState.sp);const w=document.getElementById('bwave');if(w)w.textContent=appState.battle?.mode==='coop'?appState.kills:Math.max(0,appState.battle?.myBase??150);const k=document.getElementById('bkills');if(k)k.textContent='처치 '+appState.kills;const kc=document.getElementById('killCount');if(kc)kc.textContent=appState.battle?.mode==='coop'?appState.kills:(appState.battle?.myBase??150);const kb=document.getElementById('killBar');if(kb)kb.style.width=(appState.battle?.mode==='coop'?Math.min(100,appState.kills/5000*100):Math.min(100,(appState.battle?.myBase??0)/150*100))+'%';const mb=document.getElementById('myBaseLabel'),ob=document.getElementById('oppBaseLabel');if(mb)mb.textContent=appState.battle?.mode==='battle'?'❤️ '+(appState.battle?.myBase??150):'🤝 공동 '+(appState.battle?.sharedBase??150);if(ob)ob.textContent=appState.battle?.mode==='battle'?'❤️ '+(appState.battle?.opponentBase??150):'🤝 공동 '+(appState.battle?.sharedBase??150);const ml=document.getElementById('mySpeedLabel'),ol=document.getElementById('oppSpeedLabel');if(ml)ml.textContent=appState.speed.toFixed(1)+'x';if(ol)ol.textContent=(appState.battle?.opponentSpeed??1).toFixed(1)+'x';const sb=document.getElementById('speedButton');if(sb)sb.textContent=appState.speed.toFixed(1)+'x';const list=document.getElementById('battleDieUpgradeList');if(list)list.innerHTML=battleUpgradeHTML();}
function leaveBattle(){document.getElementById('page-battle').classList.remove('active');cancelAnimationFrame(window.rd2BattleRaf||0);clearInterval(appState.matchTimer);appState.matchTimer=null;appState.matching=false;appState.diceGrid=[];appState.enemies=[];appState.oppEnemies=[];appState.sharedEnemies=[];appState.selected=null;appState.coopEnded=false;appState.page='lobby';document.getElementById('page-lobby').classList.add('active');drawLobby();updateRes();fitStage('lobby');toast('전투를 종료하고 로비로 돌아왔습니다');}
function updateRes(){['coin','dice','diamond','arenaTicket','coopTicket'].forEach(k=>{const el=document.getElementById(k);if(el)el.textContent=appState.currencies[k].toLocaleString()})}
function closeModal(){document.getElementById('modalRoot').innerHTML=''}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:absolute;z-index:300;left:50%;top:78px;transform:translateX(-50%);background:#25183a;border:1px solid #694f90;border-radius:12px;padding:10px 14px;font-weight:900;opacity:0;transition:.2s';document.body.appendChild(t)}t.textContent=msg;t.style.opacity=1;clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.opacity=0,1500)}
function esc(x){return String(x||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function applyServerResponse(r){
 if(r.state){
   appState.profile=r.state.profile||appState.profile;
   appState.currencies=r.state.currencies||appState.currencies;
   appState.deck=r.state.deck||appState.deck;
   appState.unlocked=r.state.unlocked||appState.unlocked;
   appState.treeUnlocked=r.state.treeUnlocked||appState.treeUnlocked;
   appState.diceLevels=r.state.diceLevels||appState.diceLevels;
   appState.traitLevels=r.state.traitLevels||appState.traitLevels||{};
   appState.treeLevels=r.state.treeLevels||appState.treeLevels;
   appState.passXP=Number(r.state.passXP??appState.passXP);
   appState.passRewardsClaimed=Array.isArray(r.state.passRewardsClaimed)?r.state.passRewardsClaimed:appState.passRewardsClaimed;
   appState.lucky=Number(r.state.lucky??appState.lucky);
   appState.quests=r.state.quests||appState.quests;
   appState.difficulty=r.state.difficulty||appState.difficulty;
 }
 if(r.user){appState.userId=r.user.id;appState.user=r.user.username;appState.isAdmin=Boolean(r.user.isAdmin || String(r.user.username||'').toLowerCase()==='kimsiwon')}
 if(r.coopTicketNextIn!=null)appState.coopTicketNextIn=Number(r.coopTicketNextIn);
 if(r.arenaTicketNextIn!=null)appState.arenaTicketNextIn=Number(r.arenaTicketNextIn);
 updateRes();
 if(document.getElementById('coopTicketTimer'))updateTicketTimer();
}
async function syncMe(){
 if(!serverToken)return;
 try{const r=await api('/api/me');applyServerResponse(r);if(appState.page==='admin'&&appState.isAdmin)drawAdmin();}
 catch(e){console.warn('sync',e)}
}
function startServerSync(){
 clearInterval(window.rd2ServerSync);
 window.rd2ServerSync=setInterval(syncMe,20000);
 syncMe();
}
function formatCountdown(ms){const sec=Math.max(0,Math.ceil(Number(ms||0)/1000));return `+1 ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function updateTicketTimer(){
 const coopMs=Math.max(0,Number(appState.coopTicketNextIn||300000));
 const arenaMs=Math.max(0,Number(appState.arenaTicketNextIn||1800000));
 const coopText=formatCountdown(coopMs), arenaText=formatCountdown(arenaMs);
 const t=document.getElementById('coopTicketTimer');if(t)t.textContent=coopText;
 const a=document.getElementById('arenaTicketTimer');if(a)a.textContent=arenaText;
 const s=document.getElementById('sideTicketTimer');if(s)s.textContent=`다음 협동전 티켓 ${coopText}`;
 const sa=document.getElementById('sideArenaTimer');if(sa)sa.textContent=`다음 아레나 티켓 ${arenaText}`;
 appState.coopTicketNextIn=Math.max(0,coopMs-1000);
 appState.arenaTicketNextIn=Math.max(0,arenaMs-1000);
}
let liveSocket=null,liveSocketRetry=null;
function startLiveSocket(){
 if(!serverToken)return;
 if(liveSocket && (liveSocket.readyState===WebSocket.OPEN||liveSocket.readyState===WebSocket.CONNECTING))return;
 const proto=location.protocol==='https:'?'wss':'ws';
 try{
   liveSocket=new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(serverToken)}`);
   liveSocket.onopen=()=>{if(liveSocketRetry){clearTimeout(liveSocketRetry);liveSocketRetry=null} };
   liveSocket.onmessage=(ev)=>{
     try{const m=JSON.parse(ev.data||'{}');
       if(m.type==='state_update'){
         if(m.targetUserId && appState.userId && String(m.targetUserId)!==String(appState.userId)) return;
         applyServerResponse(m);
         if(appState.page==='pass')drawPass();
         else if(appState.page==='admin'&&appState.isAdmin)drawAdmin();
         else if(appState.page==='lobby')drawLobby();
         else if(appState.page==='deck')drawDeck();
         else if(appState.page==='tree')drawTree();
         } else if(m.type==='admin_state_update'&&appState.isAdmin&&appState.page==='admin'){drawAdmin();}
       else if(m.type==='matched'&&appState.matching){handleMatchResult(m);}
       else if(['battle_join','summon','merge','speed','battle_game_over'].includes(m.type)){handleRemoteBattle(m);}
     }catch(e){console.warn('live socket message',e)}
   };
   liveSocket.onclose=()=>{liveSocket=null;if(serverToken&&!liveSocketRetry)liveSocketRetry=setTimeout(startLiveSocket,2000)};
   liveSocket.onerror=()=>{};
 }catch(e){console.warn('live socket',e)}
}
setInterval(updateTicketTimer,1000);
window.addEventListener('focus',()=>{syncMe();startLiveSocket()});

async function drawAdmin(){
 const main=document.getElementById('main');if(!main)return;
 if(!appState.isAdmin){toast('관리자 권한이 없습니다');return nav('lobby')}
 main.innerHTML=`<div class="sectionHead"><h2>관리자</h2><span>kimsiwon 전용</span></div><div class="tile"><b>재화 관리</b><p>서버 DB에 저장된 사용자의 재화를 추가/차감하거나 원하는 값으로 설정할 수 있습니다. 서버에서도 관리자 권한을 다시 확인합니다.</p></div><div id="adminList" class="section"><div class="muted">사용자 목록을 불러오는 중...</div></div>`;
 try{
   const r=await api('/api/admin/users');
   const list=document.getElementById('adminList');
   list.innerHTML=`<table class="table"><tbody>${r.users.map(u=>{
     const safe=encodeURIComponent(u.username);const s=u.state||{};const c=s.currencies||{};
     return `<tr><td><b>${esc(u.nickname||u.username)}</b><div class="muted">${esc(u.username)} ${u.isAdmin?'· 관리자':''}</div></td><td><div>🪙 ${c.coin??0} · 🎲 ${c.dice??0} · 💎 ${c.diamond??0}</div><div>🏟️ ${c.arenaTicket??0} · 🤝 ${c.coopTicket??0} · 🍀 ${c.lucky??0} · PASS ${s.passXP??0}</div><div class="row" style="margin-top:7px;flex-wrap:wrap"><select class="input" id="acur-${safe}" style="max-width:150px"><option value="coin">코인</option><option value="dice">주사위</option><option value="diamond">보석</option><option value="arenaTicket">아레나 티켓</option><option value="coopTicket">협동전 티켓</option><option value="lucky">행운의 주사위</option><option value="passXP">패스 XP</option></select><input class="input" id="aamt-${safe}" value="100" type="number" style="max-width:120px"><button class="primary" onclick="adminAdjust('${safe}',1)">+ 추가</button><button class="danger" onclick="adminAdjust('${safe}',-1)">− 차감</button><button class="topbtn" onclick="adminSet('${safe}')">값 설정</button></div></td></tr>`;
   }).join('')}</tbody></table>`;
 }catch(e){document.getElementById('adminList').innerHTML=`<div class="tile">관리자 데이터를 불러오지 못했습니다.<br><small>${esc(e.message)}</small></div>`}
}
async function adminAdjust(encoded,sign){
 const username=decodeURIComponent(encoded);const currency=document.getElementById('acur-'+encoded).value;const amount=Math.abs(Number(document.getElementById('aamt-'+encoded).value||0));if(!Number.isInteger(amount))return toast('정수를 입력하세요');
 try{const r=await api('/api/admin/users/'+encodeURIComponent(username)+'/adjust',{method:'POST',body:JSON.stringify({currency,delta:sign*amount})});if(username===appState.user)applyServerResponse({state:r.state,user:{username:appState.user,isAdmin:true}});toast('재화를 변경했습니다');drawAdmin();}catch(e){toast(e.message)}
}
async function adminSet(encoded){
 const username=decodeURIComponent(encoded);const currency=document.getElementById('acur-'+encoded).value;const value=Number(document.getElementById('aamt-'+encoded).value||0);if(!Number.isInteger(value)||value<0)return toast('0 이상의 정수를 입력하세요');
 try{const r=await api('/api/admin/users/'+encodeURIComponent(username)+'/set-currency',{method:'POST',body:JSON.stringify({currency,value})});if(username===appState.user)applyServerResponse({state:r.state,user:{username:appState.user,isAdmin:true}});toast('재화 값을 설정했습니다');drawAdmin();}catch(e){toast(e.message)}
}
bootClient();
