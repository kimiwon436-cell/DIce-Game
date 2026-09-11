# Random Dice 2 Web v8

## 이번 버전
- 다이스 트리 해금 기능을 서버에서 처리
- 다이스 트리에서 주사위 업그레이드까지 처리
- 기존 덱 화면에서는 업그레이드를 제거하고 다이스 트리로 이동
- 해금 가능한 다음 노드를 항상 표시
- 다이스 해금 비용: 주사위 재화 8개
- 업그레이드 비용: 다음 레벨이 5/10/15/...가 되는 경우 주사위 재화 8개, 그 외 코인
- 트리 해금/업그레이드 결과를 PostgreSQL에 저장하고 WebSocket으로 관리자 화면에도 반영

## Render
Build Command: npm install
Start Command: npm start

Environment Variables:
- DATABASE_URL
- JWT_SECRET

## GitHub 구조
```text
DIce-Game/
├── package.json
├── server.js
├── render.yaml
└── public/
    └── index.html
```


## v10
협동전은 상대/내 5x3 소환 공간을 동시에 표시하고, 각자 별도의 적 경로/기지를 사용합니다. 사람 매칭 시 주사위 소환·합성·배속을 WebSocket으로 상대에게 중계하며 어느 한쪽 기지가 먼저 파괴되면 양쪽 전투가 종료됩니다.


## v12 UI / dice changes
- Lobby uses a fixed 1200x700 landscape logical canvas.
- Gameplay uses a fixed 400x900 portrait logical canvas.
- The canvas is uniformly scaled to the viewport so UI positions/proportions remain stable across devices.
- All 15 battle cells are populated.
- Summon picks a random die from the current deck; when the board is full it replaces a lowest-rank slot so the board remains full.
- Dragging one die onto another merges only when type and rank match.
- Merging is allowed through 6-star; 6-star + 6-star creates a 7-star ★.
- 7-star cannot be merged further.


## v13
- Fixed `fitStage is not defined` by defining it before any UI code can use it.
- Lobby remains a 1200×700 logical landscape canvas.
- Gameplay remains a 400×900 logical portrait canvas.
- Both are uniformly scaled to fit the viewport on desktop, tablet and mobile.
- Device orientation changes re-run the fitting calculation.


v14: fitStage is defined before all callers and mobile/desktop view fitting uses fixed logical canvases.


v15: fixed missing fitStage declaration order and enforced desktop/mobile fixed logical canvases with uniform scaling; battle portrait and lobby landscape.


## v16 mobile fit
- Mobile uses the same logical canvas as desktop, but scales the entire canvas uniformly to the viewport.
- No horizontal clipping and no document/page scrolling.
- A small safety margin prevents edge clipping on phones with browser UI/safe areas.
- Lobby and gameplay retain their logical layouts; only the scale changes per viewport.


## v17 compact navigation
- Navigation buttons are now icon + text only, without large card-style button boxes.
- On mobile the navigation becomes a compact bottom icon/text bar so all major lobby menus stay on screen.
- Lobby content remains non-scrollable; the logical canvas scales as a whole.
- Top resource indicators are reduced to prevent clipping.


## v18 layout
- PC: every screen uses a landscape logical canvas.
- Mobile: every screen uses a portrait logical canvas.
- The entire canvas scales uniformly to fit both width and height; no page scrolling.
- Lobby quick-access menus use compact icon + text buttons instead of large cards.
