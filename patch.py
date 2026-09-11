from pathlib import Path
p=Path('/mnt/data/v26work/public/index.html')
s=p.read_text()
# state additions
s=s.replace("selectedTreeNode:0,\n profile", "selectedTreeNode:0,\n treeLevels:{allDamage:1,attackSpeed:1,spGain:1},\n profile")
s=s.replace("function snapshot(){return {user:appState.user,profile:appState.profile,currencies:appState.currencies,deck:appState.deck,unlocked:appState.unlocked,treeUnlocked:appState.treeUnlocked,diceLevels:appState.diceLevels,passXP", "function snapshot(){return {user:appState.user,profile:appState.profile,currencies:appState.currencies,deck:appState.deck,unlocked:appState.unlocked,treeUnlocked:appState.treeUnlocked,diceLevels:appState.diceLevels,treeLevels:appState.treeLevels,passXP")
s=s.replace("if(!appState.diceLevels)appState.diceLevels={};\n if(!appState.selectedTreeNode", "if(!appState.diceLevels)appState.diceLevels={};\n if(!appState.treeLevels)appState.treeLevels={allDamage:1,attackSpeed:1,spGain:1};\n if(!appState.treeLevels.allDamage)appState.treeLevels.allDamage=1;\n if(!appState.treeLevels.attackSpeed)appState.treeLevels.attackSpeed=1;\n if(!appState.treeLevels.spGain)appState.treeLevels.spGain=1;\n if(!appState.selectedTreeNode")
# dice rendering
start=s.index("}function diceHTML(type,lvl=1){")
end=s.index("function drawDeck(){", start)
new=r'''function battlePips(rank){
 const r=Math.max(1,Math.min(6,Number(rank)||1));
 const pos={1:['c'],2:['tl','br'],3:['tl','c','br'],4:['tl','tr','bl','br'],5:['tl','tr','c','bl','br'],6:['tl','tr','ml','mr','bl','br']}[r];
 return `<div class="pips">${pos.map(x=>`<i class="pip ${x}"></i>`).join('')}</div>`;
}
function diceHTML(type,lvl=1){
 const d=D[type]||D.blue;
 return `<div class="dice ${d.cls}">${d.icon}<small>Lv.${Math.max(1,Math.min(50,Number(lvl)||1))}</small></div>`;
}
function battleDiceHTML(die,selected=false){
 const d=D[die.type]||D.blue, r=Math.max(1,Math.min(7,Number(die.rank)||1));
 if(r>=7)return `<div class="dice battleDie ${d.cls} ${selected?'battleSelected':''}" title="7성 · 합성 불가"><div class="starMark">★</div></div>`;
 return `<div class="dice battleDie ${d.cls} ${selected?'battleSelected':''}" title="${d.name} · ${r}성">${battlePips(r)}</div>`;
}
function upgradeCost(level){
 const lv=Math.max(1,Number(level)||1),next=lv+1;
 if(lv>=50)return {coin:0,dice:0};
 return (next%5===0)?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};
}
function upgradeCostText(level){const c=upgradeCost(level);return c.dice?`🎲 ${c.dice}`:`🪙 ${c.coin}`;}
function battleUpgradeCost(level){return 50+Math.max(0,level)*50;}
'''
s=s[:start]+new+s[end:]
# Replace tree block from const treeNodes to drawStyle
start=s.index("const treeNodes=[")
end=s.index("function drawStyle(){",start)
new=r'''const treeNodes=[
 {id:0,x:50,y:88,icon:'🎲',label:'시작',cost:0,next:[1,2],type:null},
 {id:1,x:25,y:74,icon:'🌀',label:'바람 주사위',cost:8,next:[3,4],type:'blue'},
 {id:2,x:75,y:74,icon:'❄️',label:'얼음 주사위',cost:8,next:[5,6],type:'cyan'},
 {id:3,x:12,y:59,icon:'🔥',label:'화염 주사위',cost:8,next:[7],type:'red'},
 {id:4,x:38,y:59,icon:'⚔️',label:'모든 주사위 공격력',cost:8,next:[7,8],upgrade:'allDamage'},
 {id:5,x:62,y:59,icon:'☠️',label:'독 주사위',cost:8,next:[8],type:'green'},
 {id:6,x:88,y:59,icon:'☀️',label:'빛 주사위',cost:8,next:[9],type:'yellow'},
 {id:7,x:22,y:43,icon:'✿',label:'분열 주사위',cost:8,next:[10],type:'pink'},
 {id:8,x:50,y:43,icon:'⚡',label:'모든 주사위 공격속도',cost:8,next:[10,11],upgrade:'attackSpeed'},
 {id:9,x:78,y:43,icon:'✦',label:'성장 주사위',cost:8,next:[11],type:'purple'},
 {id:10,x:31,y:27,icon:'💥',label:'모든 주사위 공격력 II',cost:8,next:[12],upgrade:'allDamage'},
 {id:11,x:69,y:27,icon:'✚',label:'SP 획득량 증가',cost:8,next:[12],upgrade:'spGain'},
 {id:12,x:50,y:12,icon:'👑',label:'왕관 주사위',cost:8,next:[13],type:'yellow'},
 {id:13,x:50,y:1,icon:'🌟',label:'최종 성장',cost:8,next:[],upgrade:'allDamage'}
];
function treeUnlocked(id){return id===0 || appState.treeUnlocked?.includes(id);}
function treeNode(id){return treeNodes.find(x=>x.id===id);}
function treeParentFor(id){return treeNodes.filter(n=>n.next.includes(Number(id)))[0];}
function treeIsNext(id){return !treeUnlocked(id)&&treeParentFor(id)&&treeUnlocked(treeParentFor(id).id);}
function ensureTreeState(){if(!Array.isArray(appState.treeUnlocked))appState.treeUnlocked=[];if(!Array.isArray(appState.unlocked))appState.unlocked=[];if(!appState.diceLevels)appState.diceLevels={};if(!appState.treeLevels)appState.treeLevels={allDamage:1,attackSpeed:1,spGain:1};}
function treeUpgradeCost(level){
 const lv=Math.max(1,Number(level)||1); if(lv>=50)return {coin:0,dice:0};
 const next=lv+1; return next%5===0?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};
}
function selectedTreeLevel(node){return node?.upgrade?(appState.treeLevels?.[node.upgrade]||1):(appState.diceLevels?.[node?.type]||1);}
function treeUpgradeKey(node){return node?.upgrade||node?.type||'';}
async function upgradeTreeDice(type){
 try{const r=await api('/api/tree/upgrade',{method:'POST',body:JSON.stringify({type})});applyServerResponse(r);drawTree();updateRes();toast((r.upgrade?.label||`${D[type]?.name||'업그레이드'} 레벨 ${r.upgrade?.toLevel||''} 완료`));}catch(e){toast(e.message)}
}
async function buyTree(id){
 ensureTreeState(); const node=treeNode(id); if(!node)return;
 if(treeUnlocked(id)){appState.selectedTreeNode=id;drawTree();return;}
 if(!treeIsNext(id)){toast('먼저 연결된 앞의 노드를 해금하세요');return;}
 try{const r=await api('/api/tree/unlock',{method:'POST',body:JSON.stringify({nodeId:id})});applyServerResponse(r);appState.selectedTreeNode=id;drawTree();updateRes();toast(`${node.label} 해금 완료 · 🎲 -8`)}catch(e){toast(e.message)}
}
function treeDetails(node){
 if(!node||node.id===0)return `<div class="tile"><b>다이스 트리</b><p>노드 간격을 넓혀 길을 따라 성장할 수 있게 구성했습니다.</p><p style="margin-top:7px">주사위 해금은 <b>🎲 8개</b>, 업그레이드는 <b>최대 50레벨</b>입니다.</p></div>`;
 const unlocked=treeUnlocked(node.id), key=treeUpgradeKey(node), lv=selectedTreeLevel(node), c=treeUpgradeCost(lv);
 const isPassive=!!node.upgrade;
 if(!unlocked)return `<div class="tile"><div class="row"><div style="width:64px">${node.icon}</div><div class="grow"><h3 style="margin:0">${node.label}</h3><div class="muted">아직 잠기지 않은 노드</div></div></div><p style="margin-top:10px">연결된 노드를 해금하면 다음 성장 포인트가 열립니다.</p><button class="primary" style="width:100%" onclick="buyTree(${node.id})">🎲 8개로 해금</button></div>`;
 const effect=isPassive?(key==='allDamage'?`모든 주사위 공격력 +${(lv-1)*5}%`:(key==='attackSpeed'?`모든 주사위 공격속도 +${(lv-1)*2}%`:`SP 획득량 +${(lv-1)*3}%`)):`기본 공격력 강화 · 1성~7성은 전투에서 별도로 판정`;
 return `<div class="tile"><div class="row"><div style="width:64px">${isPassive?node.icon:diceHTML(node.type,lv)}</div><div class="grow"><h3 style="margin:0">${node.label}</h3><div class="muted">현재 레벨 ${lv} / 50</div></div></div><p style="margin-top:10px">${effect}</p>${lv>=50?'<div class="tile">MAX · 50레벨</div>':`<p>다음 레벨 <b>${lv+1}</b> · 비용 <b>${c.dice?`🎲 ${c.dice}`:`🪙 ${c.coin}`}</b></p><button class="primary" style="width:100%" onclick="upgradeTreeDice('${key}')">레벨 ${lv+1}로 업그레이드</button><p class="muted" style="margin-top:8px">5·10·15·… 레벨에 도달할 때만 🎲 8개, 나머지는 코인을 사용합니다.</p>`}</div>`;
}
function drawTree(){
 ensureTreeState();if(!appState.selectedTreeNode&&appState.selectedTreeNode!==0)appState.selectedTreeNode=0;
 const edges=[]; treeNodes.forEach(n=>n.next.forEach(to=>{const t=treeNode(to);if(t){const dx=(t.x-n.x)*7,dy=(t.y-n.y)*4;edges.push(`<div class="treeEdge" style="left:${n.x}%;top:${n.y}%;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)"></div>`)}}));
 const nodes=treeNodes.map(n=>{const open=treeUnlocked(n.id),next=treeIsNext(n.id),selected=appState.selectedTreeNode===n.id;return `<div class="treeNode ${open?'treeOpen':next?'treeNext':'treeLocked'} ${selected?'treeSelected':''}" style="left:${n.x}%;top:${n.y}%;" onclick="selectTreeNode(${n.id})"><div class="treeIcon">${n.icon}</div><div class="treeLevel">${open?'해금됨':next?'다음 해금':'잠김'}</div><div class="treeLabel">${n.label}</div>${open&&n.id>0?'<div class="treeCheck">✓</div>':''}${!open?`<div class="treeCost">🎲 ${n.cost}</div>`:''}</div>`}).join('');
 document.getElementById('main').innerHTML=`<div class="sectionHead"><h2>다이스 트리</h2><span>노드 간격 확대 · 해금 → 50레벨 성장</span></div><div class="treeLayout"><div class="treeWide"><div class="treeCanvas">${edges.join('')}${nodes}</div><div class="treeLegend"><span>🟢 해금</span><span>🟡 다음 해금</span><span>⚫ 잠김</span></div></div><div class="treeDetails">${treeDetails(treeNode(appState.selectedTreeNode))}</div></div><div class="section"><div class="tile"><b>트리 핵심</b><p>전투에서 사용하는 1~7성은 <b>로비 레벨과 완전히 별개</b>입니다. 같은 주사위 + 같은 성을 합치면 대상 칸이 1성 높은 주사위로 바뀌고, 빈 칸은 덱에서 무작위 1성 주사위로 즉시 보충됩니다.</p></div></div>`;
}
'''
s=s[:start]+new+s[end:]
# apply server state treeLevels
s=s.replace("appState.diceLevels=r.state.diceLevels||appState.diceLevels;\n   appState.passXP", "appState.diceLevels=r.state.diceLevels||appState.diceLevels;\n   appState.treeLevels=r.state.treeLevels||appState.treeLevels;\n   appState.passXP")
# mode buttons
s=s.replace("<div class=\"mode sel\"><div><b>🤝 협동전</b><span>다른 플레이어와 함께</span></div><button onclick=\"startMatch()\">플레이</button></div>", "<div class=\"mode sel\"><div><b>🤝 협동전</b><span>다른 플레이어와 함께</span></div><button onclick=\"startMatch(false,'coop')\">플레이</button></div>")
s=s.replace("<div class=\"mode\"><div><b>⚔️ 대전</b><span>각자의 길 · 먼저 파괴되면 패배</span></div><button onclick=\"startMatch()\">플레이</button></div>", "<div class=\"mode\"><div><b>⚔️ 대전</b><span>각자의 길 · 먼저 기지가 파괴되면 패배</span></div><button onclick=\"startMatch(false,'battle')\">플레이</button></div>")
# startMatch API mode
s=s.replace("const r=await api('/api/match/join',{method:'POST',body:'{}'});", "const r=await api('/api/match/join',{method:'POST',body:JSON.stringify({mode:appState.battleMode||mode})});")
# Replace startBattle through navBattle block
start=s.index("function startBattle(){")
end=s.index("function setupBattle(){", start)
new=r'''function startBattle(){
 const mode=appState.battleMode||'coop', opponentType=appState.opponentType||'ai', opponentName=appState.opponentNickname||(opponentType==='player'?'플레이어':'AI 플레이어'), playerName=appState.profile.nickname||appState.user||'플레이어';
 appState.battle={mode,matchId:appState.matchId||null,opponentType,playerName,opponentName,opponentDice:[],opponentSpeed:1,opponentBase:150,myBase:150,sharedBase:150};appState.coopEnded=false;
 const title=mode==='battle'?'⚔️ 아레나':'🤝 협동전';
 const sub=mode==='battle'?'각자의 길 · 먼저 기지 HP가 0이 되면 패배':'가운데 하나의 길을 함께 방어 · 5000킬 클리어';
 const middle=mode==='battle'?`<div class="battleSplitPath topLane"><div id="oppEnemies"></div></div><div class="battleSplitPath bottomLane"><div id="myEnemies"></div></div>`:`<div class="battleSharedPath"><div id="sharedEnemies"></div></div>`;
 const baseTop=mode==='battle'?'<span id="oppBaseLabel" class="base">❤️ 150</span>':'<span id="oppBaseLabel" class="base">🤝 공동</span>'; const baseBottom=mode==='battle'?'<span id="myBaseLabel" class="base">❤️ 150</span>':'<span id="myBaseLabel" class="base">🤝 공동</span>';
 document.getElementById('page-battle').innerHTML=`<div class="battle"><div class="battleTop"><button class="topbtn" onclick="leaveBattle()">‹</button><div style="min-width:72px"><b id="bwave">0</b><div style="font-size:8px;color:#b9adca">${mode==='coop'?'KILL':'HP'}</div></div><div class="pill">${title}</div><div class="pill">상대: ${esc(opponentName)}</div><div class="pill" id="btime">5000</div><div class="pill right">SP <span id="bsp">100</span></div><div class="pill" id="bkills">처치 0</div></div>`+
 `<div class="coopArena"><div class="killProgress">${mode==='coop'?'협동 처치':'내 전투'} <b id="killCount">0</b> ${mode==='coop'?'/ 5000':''}<i id="killBar" style="width:${mode==='coop'?0:100}%"></i></div><div class="bossBadge" id="bossBadge">BOSS</div>`+
 `<div class="coopPlayer opponent"><div class="coopHeader"><span class="who">상대 · ${esc(opponentName)}</span><span id="oppSpeedLabel" class="who">1.0x</span><span class="who">${opponentType==='player'?'온라인':'AI'}</span>${baseTop}</div><div class="coopField"><div class="coopGrid" id="opponentDiceGrid"></div></div></div>`+
 middle+
 `<div class="coopPlayer me"><div class="coopHeader"><span class="who">나 · ${esc(playerName)}</span><span id="mySpeedLabel" class="who">1.0x</span><span class="who">SP <span id="miniSp">100</span></span>${baseBottom}</div><div class="coopField"><div class="coopGrid" id="myDiceGrid"></div></div></div>`+
 `<div class="battleUpgrade" id="battleUpgrade"><div><b>이번 판 업그레이드</b><span id="battleUpgradeText">전체 주사위 공격력 +0%</span></div><button onclick="buyBattleDamageUpgrade()">SP <span id="battleUpgradeCost">50</span></button></div></div>`+
 `<div class="battlebar"><div class="sp">✦ <span id="sp">100</span></div><button class="spawn" onclick="summonBattleDice()">소환 · SP 50</button><button class="speed" id="speedButton" onclick="toggleSpeed()">1.0x</button></div><div class="battleBottom">${sub}</div></div>`;
 navBattle();setupBattle();
}
function navBattle(){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById('page-battle').classList.add('active');fitStage('battle')}
'''
s=s[:start]+new+s[end:]
# Replace setupBattle through before updateBattleHUD
start=s.index("function setupBattle(){")
end=s.index("function updateBattleHUD(){", start)
new=r'''function setupBattle(){
 appState.sp=100;appState.kills=0;appState.gameSec=0;appState.speed=1;appState.selected=null;appState.coopEnded=false;appState.killGoal=5000;appState.nextBossKill=150;appState.bossIndex=0;appState.myBossCount=0;appState.oppBossCount=0;
 appState.battleUpgradeLevel=0;appState.battleUpgradeDamage=0;
 appState.enemies=[];appState.oppEnemies=[];appState.sharedEnemies=[];
 appState.diceGrid=makeFullGrid(appState.deck||['blue'],'me');
 appState.battle.myBase=150;appState.battle.opponentBase=150;appState.battle.sharedBase=150;appState.battle.opponentSpeed=1;
 appState.battle.opponentDice=(appState.opponentType==='ai')?makeFullGrid(appState.deck||['blue'],'ai'):[];
 last=0;lastAttack=0;lastOpponentAttack=0;renderBattleDice();updateBattleHUD();
 for(let i=0;i<6;i++){setTimeout(()=>addEnemyFor('me'),i*260);setTimeout(()=>{if(appState.battle.mode==='battle')addEnemyFor('opp');else addEnemyFor('shared')},i*260)}
 if(appState.opponentType==='player'&&appState.matchId)sendBattle({type:'battle_join',matchId:appState.matchId,grid:appState.diceGrid,speed:appState.speed,mode:appState.battle.mode});
 window.rd2BattleRaf=requestAnimationFrame(battleLoop);
}
let last=0,lastAttack=0,lastOpponentAttack=0;
function makeFullGrid(deck,prefix='die'){
 const source=(Array.isArray(deck)&&deck.length?deck:['blue']); return Array.from({length:15},(_,i)=>({type:source[Math.floor(Math.random()*source.length)]||'blue',rank:1,id:prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)+i}));
}
function randomBattleDie(prefix='refill'){
 const deck=appState.deck?.length?appState.deck:['blue']; return {type:deck[Math.floor(Math.random()*deck.length)]||'blue',rank:1,id:prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)};
}
function renderBattleDice(){
 const draw=(id,grid,clickable)=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=(grid||[]).map((die,i)=>`<div class="slot"><div onclick="${clickable?`battleSelect(${i})`:''}">${battleDiceHTML(die,clickable&&appState.selected===i)}</div></div>`).join('')};
 draw('myDiceGrid',appState.diceGrid,true);draw('opponentDiceGrid',appState.battle?.opponentDice||[],false);
}
function battleSelect(i){const die=appState.diceGrid?.[i];if(!die)return;appState.selected=appState.selected===i?null:i;renderBattleDice();}
function tryBattleMerge(a,b){
 if(a===b)return toast('서로 다른 칸을 선택하세요'); const A=appState.diceGrid[a],B=appState.diceGrid[b];if(!A||!B)return toast('주사위를 선택하세요');
 if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.'); if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');
 B.rank=Math.min(7,B.rank+1);appState.diceGrid[a]=randomBattleDie('merge');appState.selected=null;renderBattleDice();sendBattle({type:'merge',from:a,to:b,die:B});
}
function summonBattleDice(){
 if(appState.sp<50)return toast('SP가 부족합니다.');appState.sp-=50;
 let idx=0,min=99;appState.diceGrid.forEach((d,i)=>{if((d?.rank||1)<min){min=d.rank;idx=i}});appState.diceGrid[idx]=randomBattleDie('summon');appState.selected=null;renderBattleDice();sendBattle({type:'summon',slot:idx,die:appState.diceGrid[idx]});updateBattleHUD();
}
function toggleSpeed(){appState.speed=appState.speed>=2?1:appState.speed+0.5;sendBattle({type:'speed',speed:appState.speed});updateBattleHUD()}
function buyBattleDamageUpgrade(){
 const cost=battleUpgradeCost(appState.battleUpgradeLevel);if(appState.battleUpgradeLevel>=10)return toast('이번 판 공격력 업그레이드는 최대 레벨입니다.');if(appState.sp<cost)return toast('SP가 부족합니다.');appState.sp-=cost;appState.battleUpgradeLevel++;appState.battleUpgradeDamage=appState.battleUpgradeLevel*25;updateBattleHUD();toast(`이번 판 전체 주사위 공격력 +${appState.battleUpgradeDamage}%`)
}
function countKill(side,e){if(e._counted)return;e._counted=true;if(appState.battle.mode==='coop'&&side!=='shared')return;if(side==='me'||side==='shared'){
 appState.kills++;appState.sp=Math.min(9999,appState.sp+(e.boss?35:5)*(1+((appState.treeLevels?.spGain||1)-1)*0.03));
 if(appState.kills>=appState.killGoal){endCoop('클리어','5000킬을 달성했습니다!');return}
 if(appState.kills>=appState.nextBossKill){spawnBossSet('shared');appState.nextBossKill+=150;}
}}
function spawnBossSet(side){appState.bossIndex++;const count=Math.max(1,Math.min(1+Math.floor(appState.kills/750),6));for(let i=0;i<count;i++)setTimeout(()=>addEnemyFor(side,true),i*260);const badge=document.getElementById('bossBadge');if(badge){const names=['돌진형','흡수형','분열형','빙결형','폭격형','광폭형'];badge.textContent='BOSS · '+names[(appState.bossIndex-1)%names.length]+' × '+count;badge.style.display='block';clearTimeout(window.__bossBadgeTimer);window.__bossBadgeTimer=setTimeout(()=>badge.style.display='none',1800)}}
function addEnemyFor(side,boss=false){
 const id=side==='shared'?'sharedEnemies':side==='me'?'myEnemies':'oppEnemies';const layer=document.getElementById(id);if(!layer)return;const names=['돌진형','흡수형','분열형','빙결형','폭격형','광폭형'];const skill=boss?names[(appState.bossIndex-1)%names.length]:'';const el=document.createElement('div');el.className='coopEnemy'+(boss?' boss':'');el.textContent=boss?'B':'●';el.style.top=(35+Math.random()*25)+'%';el.title=skill;layer.appendChild(el);
 const e={el,x:-18,y:35+Math.random()*25,hp:boss?900:190+Math.min(1400,appState.kills*0.35),max:boss?900:190+Math.min(1400,appState.kills*0.35),speed:17+Math.min(18,appState.kills*0.004)+(boss?-4:0),boss,side,skill,stunned:false};(side==='shared'?appState.sharedEnemies:side==='me'?appState.enemies:appState.oppEnemies).push(e)
}
function useBossSkill(e){if(!e.boss||e._skillUsed)return;if(e.x>10&&e.x<18){e._skillUsed=true;switch(e.skill){case '돌진형':e.speed*=2.7;break;case '흡수형':e.hp=Math.min(e.max,e.hp+e.max*.45);break;case '분열형':addEnemyFor(e.side,false);break;case '빙결형':appState.speed=Math.max(.7,appState.speed-.3);break;case '폭격형':appState.battle.myBase=Math.max(0,appState.battle.myBase-8);break;case '광폭형':e.speed*=1.8;break}}}
function damageSideEnemy(e,dmg){e.hp-=dmg;if(e.hp<=0){e.el.remove();const arr=e.side==='shared'?appState.sharedEnemies:e.side==='me'?appState.enemies:appState.oppEnemies;const idx=arr.indexOf(e);if(idx>=0)arr.splice(idx,1);countKill(e.side,e)}}
function moveSide(side,dt){const arr=side==='shared'?appState.sharedEnemies:side==='me'?appState.enemies:appState.oppEnemies;const layer=document.getElementById(side==='shared'?'sharedEnemies':side==='me'?'myEnemies':'oppEnemies');const width=layer?.clientWidth||380;arr.slice().forEach(e=>{useBossSkill(e);e.x+=e.speed*dt*(side==='me'?appState.speed:side==='opp'?appState.battle.opponentSpeed:Math.max(appState.speed,.8));e.el.style.left=e.x+'px';if(e.x>width-4){e.el.remove();const idx=arr.indexOf(e);if(idx>=0)arr.splice(idx,1);if(appState.battle.mode==='coop'){appState.battle.sharedBase=Math.max(0,appState.battle.sharedBase-(e.boss?25:3));}else if(side==='me'){appState.battle.myBase=Math.max(0,appState.battle.myBase-(e.boss?25:3))}else{appState.battle.opponentBase=Math.max(0,appState.battle.opponentBase-(e.boss?25:3))}if(appState.battle.mode==='battle'&&(appState.battle.myBase<=0||appState.battle.opponentBase<=0)&&!appState.coopEnded)endCoop(appState.battle.myBase<=0?'패배':'승리',appState.battle.myBase<=0?'내 기지가 먼저 파괴되었습니다.':'상대 기지가 먼저 파괴되었습니다.')}})}
function loopBattleBots(dt){if(appState.opponentType==='ai'){if(!appState.battle.opponentDice.length){appState.battle.opponentDice=makeFullGrid(appState.deck||['blue'],'ai');renderBattleDice()}appState.battle.opponentSpeed=appState.speed;const target=6+Math.floor(appState.kills/350);const arr=appState.battle.mode==='coop'?appState.sharedEnemies:appState.oppEnemies;if(arr.length<Math.min(target,18)&&Math.random()<dt*(1+appState.kills/1800))addEnemyFor(appState.battle.mode==='coop'?'shared':'opp');if(appState.battle.mode==='coop'){const bossTarget=Math.floor(appState.kills/150);if(bossTarget>appState.oppBossCount){appState.oppBossCount=bossTarget;const count=Math.max(1,Math.min(1+Math.floor(appState.kills/750),6));for(let i=0;i<count;i++)setTimeout(()=>addEnemyFor('shared',true),i*260)}}}}
function dieDamage(die){const lobbyLv=Math.max(1,Math.min(50,Number(appState.diceLevels?.[die.type]||1)));const rank=Math.max(1,Math.min(7,Number(die.rank)||1));const permanent=1+(lobbyLv-1)*0.08;const global=1+((appState.treeLevels?.allDamage||1)-1)*0.05;const battle=1+(appState.battleUpgradeDamage||0)/100;return (D[die.type]?.damage||50)*permanent*(1+(rank-1)*0.75)*global*battle;}
function attackSide(side,ts){if(side==='me'&&(!appState.diceGrid?.length))return;const grid=side==='me'?appState.diceGrid:appState.battle.opponentDice;if(!grid?.length)return;const targetArr=appState.battle.mode==='coop'?appState.sharedEnemies:(side==='me'?appState.enemies:appState.oppEnemies);const now=ts;if(!targetArr.length)return;const speedGlobal=1+((appState.treeLevels?.attackSpeed||1)-1)*0.02;const intervalBase=side==='me'?460:520;grid.forEach((die)=>{if(!die)return;const key=die.id+'-'+side;appState._atk=appState._atk||{};const rate=Math.max(120,intervalBase/(speedGlobal*(1+(appState.battleUpgradeLevel*0.02))));if(now-(appState._atk[key]||0)>=rate){appState._atk[key]=now;const target=targetArr[0];if(target)damageSideEnemy(target,dieDamage(die)*(side==='opp'?0.62:1))}})}
function battleLoop(ts){if(!document.getElementById('page-battle').classList.contains('active'))return;const dt=Math.min(.06,(ts-(last||ts))/1000);last=ts;if(!appState.coopEnded&&!appState.paused){const spGain=7*(1+((appState.treeLevels?.spGain||1)-1)*0.03);appState.sp=Math.min(9999,appState.sp+dt*spGain*appState.speed);loopBattleBots(dt);moveSide(appState.battle.mode==='coop'?'shared':'me',dt);if(appState.battle.mode==='battle')moveSide('opp',dt);attackSide('me',ts);if(appState.battle.mode==='battle')attackSide('opp',ts);if((appState.battle.mode==='battle'?appState.enemies:appState.sharedEnemies).length<Math.min(7+Math.floor(appState.kills/400),18)&&Math.random()<dt*(.8+appState.kills/2500)*appState.speed)addEnemyFor(appState.battle.mode==='battle'?'me':'shared');updateBattleHUD()}window.rd2BattleRaf=requestAnimationFrame(battleLoop)}
'''
s=s[:start]+new+s[end:]
# Update HUD and leaveBattle
old="function updateBattleHUD(){\n const sp=document.getElementById('sp');if(sp)sp.textContent=Math.floor(appState.sp);\n const mini=document.getElementById('miniSp');if(mini)mini.textContent=Math.floor(appState.sp);\n const s=document.getElementById('bsp');if(s)s.textContent=Math.floor(appState.sp);\n const w=document.getElementById('bwave');if(w)w.textContent=appState.kills;\n const t=document.getElementById('btime');if(t)t.textContent=(appState.killGoal||5000);\n const k=document.getElementById('bkills');if(k)k.textContent='처치 '+appState.kills;\n const kc=document.getElementById('killCount');if(kc)kc.textContent=appState.kills;\n const kb=document.getElementById('killBar');if(kb)kb.style.width=Math.min(100,appState.kills/(appState.killGoal||5000)*100)+'%';\n const mb=document.getElementById('myBaseLabel'),ob=document.getElementById('oppBaseLabel');\n if(mb)mb.textContent='❤️ '+(appState.battle?.myBase??150);\n if(ob)ob.textContent='❤️ '+(appState.battle?.opponentBase??150);\n const ml=document.getElementById('mySpeedLabel'),ol=document.getElementById('oppSpeedLabel');\n if(ml)ml.textContent=appState.speed.toFixed(1)+'x';\n if(ol)ol.textContent=(appState.battle?.opponentSpeed??1).toFixed(1)+'x';\n const sb=document.getElementById('speedButton');if(sb)sb.textContent=appState.speed.toFixed(1)+'x';\n}\nfunction leaveBattle(){document.getElementById('page-battle').classList.remove('active');cancelAnimationFrame(window.rd2BattleRaf||0);clearInterval(appState.matchTimer);appState.matchTimer=null;appState.matching=false;appState.diceGrid=[];appState.enemies=[];appState.oppEnemies=[];appState.selected=null;appState.coopEnded=false;appState.page='lobby';document.getElementById('page-lobby').classList.add('active');drawLobby();updateRes();fitStage('lobby');toast('전투를 종료하고 로비로 돌아왔습니다')}"
new="function updateBattleHUD(){const sp=document.getElementById('sp');if(sp)sp.textContent=Math.floor(appState.sp);const mini=document.getElementById('miniSp');if(mini)mini.textContent=Math.floor(appState.sp);const s=document.getElementById('bsp');if(s)s.textContent=Math.floor(appState.sp);const w=document.getElementById('bwave');if(w)w.textContent=appState.battle?.mode==='coop'?appState.kills:Math.max(0,appState.battle?.myBase??150);const t=document.getElementById('btime');if(t)t.textContent=appState.battle?.mode==='coop'?5000:'기지';const k=document.getElementById('bkills');if(k)k.textContent='처치 '+appState.kills;const kc=document.getElementById('killCount');if(kc)kc.textContent=appState.battle?.mode==='coop'?appState.kills:(appState.battle?.myBase??150);const kb=document.getElementById('killBar');if(kb)kb.style.width=appState.battle?.mode==='coop'?Math.min(100,appState.kills/5000*100):Math.min(100,(appState.battle?.myBase??0)/150*100)+'%';const mb=document.getElementById('myBaseLabel'),ob=document.getElementById('oppBaseLabel');if(mb)mb.textContent=appState.battle?.mode==='battle'?'❤️ '+(appState.battle?.myBase??150):'🤝 공동 '+(appState.battle?.sharedBase??150);if(ob)ob.textContent=appState.battle?.mode==='battle'?'❤️ '+(appState.battle?.opponentBase??150):'🤝 공동 '+(appState.battle?.sharedBase??150);const ml=document.getElementById('mySpeedLabel'),ol=document.getElementById('oppSpeedLabel');if(ml)ml.textContent=appState.speed.toFixed(1)+'x';if(ol)ol.textContent=(appState.battle?.opponentSpeed??1).toFixed(1)+'x';const sb=document.getElementById('speedButton');if(sb)sb.textContent=appState.speed.toFixed(1)+'x';const bc=document.getElementById('battleUpgradeCost');if(bc)bc.textContent=battleUpgradeCost(appState.battleUpgradeLevel||0);const bt=document.getElementById('battleUpgradeText');if(bt)bt.textContent=`이번 판 전체 주사위 공격력 +${appState.battleUpgradeDamage||0}%`;}
function leaveBattle(){document.getElementById('page-battle').classList.remove('active');cancelAnimationFrame(window.rd2BattleRaf||0);clearInterval(appState.matchTimer);appState.matchTimer=null;appState.matching=false;appState.diceGrid=[];appState.enemies=[];appState.oppEnemies=[];appState.sharedEnemies=[];appState.selected=null;appState.coopEnded=false;appState.page='lobby';document.getElementById('page-lobby').classList.add('active');drawLobby();updateRes();fitStage('lobby');toast('전투를 종료하고 로비로 돌아왔습니다')}"
if old not in s:
    print('HUD old block not found')
else:s=s.replace(old,new)
# CSS additions
s=s.replace('.dice small{position:absolute;right:6px;top:5px;background:#0009;border-radius:8px;padding:1px 5px;font-size:10px}', '.dice small{position:absolute;right:6px;top:5px;background:#0009;border-radius:8px;padding:1px 5px;font-size:10px}.pips{position:relative;width:68%;height:68%}.pip{position:absolute;width:16%;height:16%;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0006}.pip.c{left:42%;top:42%}.pip.tl{left:10%;top:10%}.pip.tr{right:10%;top:10%}.pip.ml{left:10%;top:42%}.pip.mr{right:10%;top:42%}.pip.bl{left:10%;bottom:10%}.pip.br{right:10%;bottom:10%}.starMark{font-size:42px;filter:drop-shadow(0 2px 4px #0006)}.battleSelected{outline:4px solid #fff17a;transform:translateY(-4px) scale(1.06)}.battleUpgrade{position:absolute;left:12px;right:12px;bottom:122px;display:flex;align-items:center;gap:10px;justify-content:space-between;background:#241735e8;border:1px solid #72598e;border-radius:12px;padding:8px 10px;z-index:11;font-size:11px}.battleUpgrade span{display:block;color:#cbbddd;font-size:9px;margin-top:2px}.battleUpgrade button{border:0;border-radius:9px;background:#ffd65a;padding:7px 10px;font-weight:1000}.battleSharedPath,.battleSplitPath{position:absolute;left:0;right:0;top:36%;height:92px;background:linear-gradient(#ecd09c,#d4ae73);border-top:2px solid #b58e5b77;border-bottom:2px solid #b58e5b77}.battleSplitPath.topLane{top:26%}.battleSplitPath.bottomLane{top:58%}.battleSharedPath #sharedEnemies,.battleSplitPath>div{position:absolute;inset:0}')
# tree CSS height
s=s.replace('.treeCanvas{position:relative;height:560px;', '.treeCanvas{position:relative;height:650px;')
# mobile tree height
s=s.replace('.treeWide{height:535px;overflow:hidden}', '.treeWide{height:625px;overflow:hidden}')
# server state apply / extra
p.write_text(s)

# server patch
sp=Path('/mnt/data/v26work/server.js')
s=sp.read_text()
s=s.replace("unlocked: [], treeUnlocked: [], diceLevels: {},", "unlocked: [], treeUnlocked: [], diceLevels: {}, treeLevels: {allDamage:1,attackSpeed:1,spGain:1},")
s=s.replace("    diceLevels:s.diceLevels&&typeof s.diceLevels==='object'?s.diceLevels:{},", "    diceLevels:s.diceLevels&&typeof s.diceLevels==='object'?s.diceLevels:{},\n    treeLevels:s.treeLevels&&typeof s.treeLevels==='object'?{allDamage:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.allDamage||1)))),attackSpeed:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.attackSpeed||1)))),spGain:Math.max(1,Math.min(50,Math.floor(Number(s.treeLevels.spGain||1))))}:{allDamage:1,attackSpeed:1,spGain:1},")
# Replace tree section
st= s.index('// ---------------- Dice Tree ----------------')
en= s.index('// ---------------- Matchmaking ----------------', st)
new=r'''// ---------------- Dice Tree ----------------
const TREE_NODES = [
 {id:0,next:[1,2]},
 {id:1,type:'blue',next:[3,4]}, {id:2,type:'cyan',next:[5,6]},
 {id:3,type:'red',next:[7]}, {id:4,upgrade:'allDamage',next:[7,8]},
 {id:5,type:'green',next:[8]}, {id:6,type:'yellow',next:[9]},
 {id:7,type:'pink',next:[10]}, {id:8,upgrade:'attackSpeed',next:[10,11]},
 {id:9,type:'purple',next:[11]}, {id:10,upgrade:'allDamage',next:[12]},
 {id:11,upgrade:'spGain',next:[12]}, {id:12,type:'yellow',next:[13]},
 {id:13,upgrade:'allDamage',next:[]}
];
const TREE_TYPES = new Set(['blue','cyan','red','green','yellow','pink','purple']);
const TREE_UPGRADES = new Set(['allDamage','attackSpeed','spGain']);
function treeNodeById(id){return TREE_NODES.find(n=>n.id===Number(id));}
function treeParentFor(id){return TREE_NODES.find(n=>n.next.includes(Number(id)));}
function treeUpgradeCostServer(level){const lv=Math.max(1,Number(level)||1);if(lv>=50)return {coin:0,dice:0};const next=lv+1;return next%5===0?{coin:0,dice:8}:{coin:Math.max(100,Math.floor(75*lv*1.15)),dice:0};}
function treeStatePayload(state){const clean=cleanState(state);if(!Array.isArray(clean.treeUnlocked))clean.treeUnlocked=[];if(!clean.diceLevels)clean.diceLevels={};if(!clean.treeLevels)clean.treeLevels={allDamage:1,attackSpeed:1,spGain:1};return clean;}
app.post('/api/tree/unlock',auth,async(req,res)=>{const nodeId=Number(req.body.nodeId),node=treeNodeById(nodeId);if(!node||node.id===0)return res.status(400).json({error:'해금할 수 없는 트리 노드입니다.'});const client=await pool.connect();try{await client.query('BEGIN');const ticketed=await accrueTicketsTx(client,req.auth.id);if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');const state=treeStatePayload(ticketed.state);if(state.treeUnlocked.includes(nodeId))throw new Error('이미 해금된 노드입니다.');const parent=treeParentFor(nodeId);if(!parent||(parent.id!==0&&!state.treeUnlocked.includes(parent.id)))throw new Error('먼저 연결된 앞의 노드를 해금하세요.');if(state.currencies.dice<8)throw new Error('주사위 재화가 부족합니다. 해금에는 8개가 필요합니다.');state.currencies.dice-=8;state.treeUnlocked.push(nodeId);if(node.type&&TREE_TYPES.has(node.type)){if(!state.unlocked.includes(node.type))state.unlocked.push(node.type);if(!state.diceLevels[node.type])state.diceLevels[node.type]=1;}if(node.upgrade&&!state.treeLevels[node.upgrade])state.treeLevels[node.upgrade]=1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};broadcast(req.auth.id,stateMessage(row,state,extra));broadcastAdmins({type:'admin_state_update',username:row.username});res.json({ok:true,state,coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 트리 해금 실패'});}finally{client.release();}});
app.post('/api/tree/upgrade',auth,async(req,res)=>{const key=String(req.body.type||'');if(!TREE_TYPES.has(key)&&!TREE_UPGRADES.has(key))return res.status(400).json({error:'지원하지 않는 업그레이드입니다.'});const client=await pool.connect();try{await client.query('BEGIN');const ticketed=await accrueTicketsTx(client,req.auth.id);if(!ticketed)throw new Error('계정을 찾을 수 없습니다.');const state=treeStatePayload(ticketed.state);if(TREE_TYPES.has(key)){if(!state.unlocked.includes(key))throw new Error('먼저 다이스 트리에서 이 주사위를 해금하세요.');const level=Math.max(1,Math.floor(Number(state.diceLevels[key]||1)));if(level>=50)throw new Error('이미 50레벨입니다.');const cost=treeUpgradeCostServer(level);if(cost.dice&&state.currencies.dice<cost.dice)throw new Error(`레벨 ${level+1} 업그레이드에는 주사위 재화 ${cost.dice}개가 필요합니다.`);if(cost.coin&&state.currencies.coin<cost.coin)throw new Error(`레벨 ${level+1} 업그레이드에는 코인 ${cost.coin}개가 필요합니다.`);if(cost.dice)state.currencies.dice-=cost.dice;if(cost.coin)state.currencies.coin-=cost.coin;state.diceLevels[key]=level+1;}
else{const unlockedNode=state.treeUnlocked.map(treeNodeById).find(n=>n&&n.upgrade===key);if(!unlockedNode)throw new Error('먼저 다이스 트리에서 이 업그레이드를 해금하세요.');const level=Math.max(1,Math.floor(Number(state.treeLevels[key]||1)));if(level>=50)throw new Error('이미 50레벨입니다.');const cost=treeUpgradeCostServer(level);if(cost.dice&&state.currencies.dice<cost.dice)throw new Error(`레벨 ${level+1} 업그레이드에는 주사위 재화 ${cost.dice}개가 필요합니다.`);if(cost.coin&&state.currencies.coin<cost.coin)throw new Error(`레벨 ${level+1} 업그레이드에는 코인 ${cost.coin}개가 필요합니다.`);if(cost.dice)state.currencies.dice-=cost.dice;if(cost.coin)state.currencies.coin-=cost.coin;state.treeLevels[key]=level+1;}
await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(state),req.auth.id]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[req.auth.id])).rows[0];await client.query('COMMIT');const extra={coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext};broadcast(req.auth.id,stateMessage(row,state,extra));broadcastAdmins({type:'admin_state_update',username:row.username});const toLevel=key in state.diceLevels?state.diceLevels[key]:state.treeLevels[key];res.json({ok:true,state,upgrade:{type:key,toLevel,label:TREE_UPGRADES.has(key)?'전역 업그레이드 레벨 '+toLevel:(key+' 레벨 '+toLevel)},coopTicketNextIn:ticketed.coopNext,arenaTicketNextIn:ticketed.arenaNext});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'다이스 업그레이드 실패'});}finally{client.release();}});

'''
s=s[:st]+new+s[en:]
# match join mode / ticket helpers
s=s.replace("async function consumeCoopTicket(userId)", "async function consumeCoopTicket(userId)")
# locate function and add arena helper by replacing consume function area
needle="async function consumeCoopTicket(userId){"
idx=s.index(needle)
endfn=s.index("// ---------------- Admin ----------------", idx)
chunk=s[idx:endfn]
# If already contains function, make a generalized helper by replacing whole chunk
newchunk=r'''async function consumeModeTicket(userId,mode){
 const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);if(!t)throw new Error('계정을 찾을 수 없습니다.');const field=mode==='battle'?'arenaTicket':'coopTicket';if(t.state.currencies[field]<=0)throw new Error(mode==='battle'?'아레나 티켓이 없습니다.':'협동전 티켓이 없습니다.');t.state.currencies[field]-=1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(t.state),userId]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');broadcast(userId,stateMessage(row,t.state,{coopTicketNextIn:t.coopNext,arenaTicketNextIn:t.arenaNext}));return {state:t.state,row,coopNext:t.coopNext,arenaNext:t.arenaNext};}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
async function consumeCoopTicket(userId){return consumeModeTicket(userId,'coop')}
async function refundModeTicket(userId,mode){const client=await pool.connect();try{await client.query('BEGIN');const t=await accrueTicketsTx(client,userId);const field=mode==='battle'?'arenaTicket':'coopTicket';t.state.currencies[field]+=1;await client.query('UPDATE users SET state=$1::jsonb,updated_at=NOW() WHERE id=$2',[JSON.stringify(t.state),userId]);const row=(await client.query('SELECT id,username,nickname,avatar,state,is_admin,coop_ticket_at,arena_ticket_at,starter_granted FROM users WHERE id=$1',[userId])).rows[0];await client.query('COMMIT');return {state:t.state,coopNext:t.coopNext,arenaNext:t.arenaNext,row};}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
async function refundCoopTicket(userId){return refundModeTicket(userId,'coop')}

'''
s=s[:idx]+newchunk+s[endfn:]
# join block
s=s.replace("const charged=await consumeCoopTicket(req.auth.id);", "const mode=req.body?.mode==='battle'?'battle':'coop';\n   const charged=await consumeModeTicket(req.auth.id,mode);")
s=s.replace("const match={id:matchId,players:[opponent.userId,req.auth.id],createdAt:now,status:'matched',opponentType:'player'};", "const match={id:matchId,players:[opponent.userId,req.auth.id],createdAt:now,status:'matched',opponentType:'player',mode};")
s=s.replace("const result={status:'matched',queueId,matchId,opponentType:'player',opponentNickname:nickname,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext};", "const result={status:'matched',queueId,matchId,opponentType:'player',opponentNickname:nickname,mode,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext};")
s=s.replace("broadcast(opponent.userId,{type:'matched',queueId:opponent.id,matchId,opponentType:'player',opponentNickname:charged.row.nickname||'플레이어'});", "broadcast(opponent.userId,{type:'matched',queueId:opponent.id,matchId,opponentType:'player',opponentNickname:charged.row.nickname||'플레이어',mode});")
s=s.replace("queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:Date.now(),status:'waiting'});", "queueEntries.set(queueId,{id:queueId,userId:req.auth.id,username:req.auth.username,createdAt:Date.now(),status:'waiting',mode});")
s=s.replace("res.json({status:'waiting',queueId,elapsed:0,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext});", "res.json({status:'waiting',queueId,elapsed:0,mode,state:charged.state,coopTicketNextIn:charged.coopNext,arenaTicketNextIn:charged.arenaNext});")
s=s.replace("if(q.status==='matched'){const match=matches.get(q.matchId);const other=match?.players?.find(x=>String(x)!==String(q.userId));let nickname='플레이어';if(other){const r=await rowForUser(other);if(r)nickname=r.nickname;}return res.json({status:'matched',queueId:q.id,matchId:q.matchId,opponentType:'player',opponentNickname:nickname});}", "if(q.status==='matched'){const match=matches.get(q.matchId);const other=match?.players?.find(x=>String(x)!==String(q.userId));let nickname='플레이어';if(other){const r=await rowForUser(other);if(r)nickname=r.nickname;}return res.json({status:'matched',queueId:q.id,matchId:q.matchId,opponentType:'player',opponentNickname:nickname,mode:q.mode||match?.mode||'coop'});}")
s=s.replace("if(q.status==='ai')return res.json({status:'ai',queueId:q.id,opponentType:'ai',opponentNickname:'AI 플레이어'});", "if(q.status==='ai')return res.json({status:'ai',queueId:q.id,opponentType:'ai',opponentNickname:'AI 플레이어',mode:q.mode||'coop'});")
s=s.replace("const out=await refundCoopTicket(req.auth.id);", "const out=await refundModeTicket(req.auth.id,q.mode||'coop');")
sp.write_text(s)
