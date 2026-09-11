from pathlib import Path

root=Path('/mnt/data/v40work')

client=root/'public/client.js'
s=client.read_text()
old="""function summonBattleDice(){if(appState.sp<50)return toast('SP가 부족합니다.');appState.diceGrid=ensureBattleGrid(appState.diceGrid,'me');const empty=[];for(let i=0;i<15;i++)if(!appState.diceGrid[i])empty.push(i);if(!empty.length)return toast('칸이 가득 차서 소환할 수 없습니다.');appState.sp-=50;const idx=empty[Math.floor(Math.random()*empty.length)];const spawned=randomBattleDie('summon');appState.diceGrid[idx]=spawned;appState.selected=null;renderBattleDice();sendBattle({type:'summon',slot:idx,die:spawned});updateBattleHUD();toast(`${D[spawned.type]?.name||'주사위'} 1성 소환`);}\n"""
new="""function getEmptyBattleSlots(){const grid=ensureBattleGrid(appState.diceGrid,'me');const empty=[];for(let i=0;i<15;i++)if(grid[i]==null)empty.push(i);return empty;}\nfunction summonBattleDice(){\n if(appState.sp<50)return toast('SP가 부족합니다.');\n appState.diceGrid=ensureBattleGrid(appState.diceGrid,'me');\n const empty=getEmptyBattleSlots();\n if(!empty.length)return toast('칸이 가득 차서 소환할 수 없습니다.');\n appState.sp-=50;\n const idx=empty[Math.floor(Math.random()*empty.length)];\n const spawned=randomBattleDie('summon');\n appState.diceGrid[idx]=spawned;\n appState.selected=null;\n renderBattleDice();\n sendBattle({type:'summon',slot:idx,die:spawned});\n updateBattleHUD();\n toast(`${D[spawned.type]?.name||'주사위'} 1성 소환`);\n}\n"""
if old not in s: print('client summon pattern not found')
else: s=s.replace(old,new)

old2="""function tryBattleMerge(a,b){if(a===b)return toast('서로 다른 칸으로 옮겨주세요.');const A=appState.diceGrid[a],B=appState.diceGrid[b];if(!A||!B)return toast('두 칸 모두 주사위가 있어야 합니다.');if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');const merged={type:B.type,rank:Math.min(7,B.rank+1),id:'merge-'+Date.now()+'-'+Math.random().toString(36).slice(2)};appState.diceGrid[a]=null;appState.diceGrid[b]=merged;appState.selected=null;renderBattleDice();sendBattle({type:'merge',from:a,to:b,die:merged});}\n"""
new2="""function tryBattleMerge(a,b){\n if(a===b)return toast('서로 다른 칸으로 옮겨주세요.');\n const A=appState.diceGrid[a],B=appState.diceGrid[b];\n if(!A||!B)return toast('두 칸 모두 주사위가 있어야 합니다.');\n if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');\n if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');\n const merged={type:B.type,rank:Math.min(7,B.rank+1),id:'merge-'+Date.now()+'-'+Math.random().toString(36).slice(2)};\n // 합성은 빈칸을 자동 보충하지 않습니다. 출발 칸은 반드시 비워둡니다.\n appState.diceGrid[a]=null;\n appState.diceGrid[b]=merged;\n appState.selected=null;\n renderBattleDice();\n sendBattle({type:'merge',from:a,to:b,die:merged});\n}\n"""
if old2 not in s: print('client merge pattern not found')
else: s=s.replace(old2,new2)
client.write_text(s)

idx=root/'public/index.html'
s=idx.read_text()
old="""function tryBattleMerge(a,b){if(a===b)return toast('서로 다른 칸으로 옮겨주세요');const A=appState.diceGrid[a],B=appState.diceGrid[b];if(!A||!B)return toast('주사위가 있는 두 칸을 사용하세요');if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');const merged={type:B.type,rank:Math.min(7,B.rank+1),id:'merge-'+Date.now()+'-'+Math.random().toString(36).slice(2)};appState.diceGrid[a]=null;appState.diceGrid[b]=merged;appState.selected=null;renderBattleDice();sendBattle({type:'merge',from:a,to:b,die:merged);}\n"""
# actual line has proper brace, use direct surrounding slice replacement
old="""function tryBattleMerge(a,b){if(a===b)return toast('서로 다른 칸으로 옮겨주세요');const A=appState.diceGrid[a],B=appState.diceGrid[b];if(!A||!B)return toast('주사위가 있는 두 칸을 사용하세요');if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');const merged={type:B.type,rank:Math.min(7,B.rank+1),id:'merge-'+Date.now()+'-'+Math.random().toString(36).slice(2)};appState.diceGrid[a]=null;appState.diceGrid[b]=merged;appState.selected=null;renderBattleDice();sendBattle({type:'merge',from:a,to:b,die:merged});}\n"""
new="""function tryBattleMerge(a,b){\n if(a===b)return toast('서로 다른 칸으로 옮겨주세요');\n const A=appState.diceGrid[a],B=appState.diceGrid[b];\n if(!A||!B)return toast('주사위가 있는 두 칸을 사용하세요');\n if(A.type!==B.type||A.rank!==B.rank)return toast('같은 주사위 + 같은 성끼리만 합칠 수 있습니다.');\n if(A.rank>=7)return toast('7성은 더 합칠 수 없습니다.');\n const merged={type:B.type,rank:Math.min(7,B.rank+1),id:'merge-'+Date.now()+'-'+Math.random().toString(36).slice(2)};\n // 합성 후 빈칸은 그대로 둡니다. 소환 버튼을 눌렀을 때만 빈칸을 채웁니다.\n appState.diceGrid[a]=null;\n appState.diceGrid[b]=merged;\n appState.selected=null;\n renderBattleDice();\n sendBattle({type:'merge',from:a,to:b,die:merged});\n}\n"""
if old not in s: print('index merge pattern not found')
else: s=s.replace(old,new)

# Replace the index summon with an explicit empty-slot helper for consistency.
old="""function summonBattleDice(){if(appState.sp<50)return toast('SP가 부족합니다.');const empty=[];for(let i=0;i<15;i++)if(!appState.diceGrid?.[i])empty.push(i);if(!empty.length)return toast('설치 칸이 모두 찼습니다. 소환할 수 없습니다.');appState.sp-=50;const idx=empty[Math.floor(Math.random()*empty.length)];appState.diceGrid[idx]=randomBattleDie('summon');appState.selected=null;renderBattleDice();sendBattle({type:'summon',slot:idx,die:appState.diceGrid[idx]});updateBattleHUD();}\n"""
new="""function getEmptyBattleSlots(){const grid=ensureBattleGrid(appState.diceGrid,'me');const empty=[];for(let i=0;i<15;i++)if(grid[i]==null)empty.push(i);return empty;}\nfunction summonBattleDice(){\n if(appState.sp<50)return toast('SP가 부족합니다.');\n appState.diceGrid=ensureBattleGrid(appState.diceGrid,'me');\n const empty=getEmptyBattleSlots();\n if(!empty.length)return toast('설치 칸이 모두 찼습니다. 소환할 수 없습니다.');\n appState.sp-=50;\n const idx=empty[Math.floor(Math.random()*empty.length)];\n appState.diceGrid[idx]=randomBattleDie('summon');\n appState.selected=null;\n renderBattleDice();\n sendBattle({type:'summon',slot:idx,die:appState.diceGrid[idx]});\n updateBattleHUD();\n}\n"""
if old not in s: print('index summon pattern not found')
else: s=s.replace(old,new)
idx.write_text(s)
