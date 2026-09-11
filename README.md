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


## v19
- Lobby content is scrollable again.
- Gameplay remains fixed with no page scroll.
- Mobile logical canvas reduced from 430px to 412px wide with extra viewport margin to prevent right-edge clipping.
- Mobile lobby supports vertical scrolling while hiding horizontal overflow.


## v20 mobile overflow fix
- Mobile no longer uses a CSS transform for the entire app; it uses the actual viewport width.
- Horizontal clipping is prevented with 100vw/max-width and hidden x-overflow.
- Lobby keeps vertical scrolling; gameplay stays fixed.
- Lobby cards/buttons and top controls are compacted for narrow screens.


## v21 browser viewport responsive sizing
- UI sizing is based on the current browser viewport (`visualViewport`/layout viewport), not physical monitor/screen size.
- Resizing Chrome/Edge, opening DevTools, changing mobile orientation, and browser viewport changes refit the whole UI.
- Desktop keeps one landscape layout; mobile keeps one portrait layout.
- Mobile lobby remains vertically scrollable and horizontally clipped content is prevented.


## v22 PC lobby visibility
- PC lobby main content is vertically scrollable.
- Lower lobby sections no longer get clipped by a short browser viewport.
- Mobile behavior is preserved.


## v23 viewport update
- Added ResizeObserver and fullscreen/pageshow/visibility/orientation listeners.
- Refit also runs shortly after initial page load to catch browser UI/fullscreen viewport changes.
- Browser viewport dimensions are recalculated every time before fitting.


## v24
- Cleaned viewport fitting so there is exactly one fitStage definition.
- Uses ResizeObserver plus browser viewport/fullscreen/orientation/page visibility events.
- Desktop fits a landscape canvas; mobile uses the real browser viewport with portrait layout.


## v25 Kill/Boss/Reward rules
- Coop completion is 5000 total kills, not waves.
- A boss spawns every 150 kills.
- Boss count increases as the kill count gets higher.
- Bosses have distinct skills: charge, absorb, split, freeze, bombard, enrage.
- Coop bounty rewards are claimable every 100 kills.
- Kill progress is shown in the coop HUD.


## v26
- Viewport fitting is recalculated automatically on browser resize, fullscreen changes, visibility, pageshow, orientation changes, visualViewport resize/scroll, and ResizeObserver changes.
- Initial load performs delayed refits so Chrome/Edge browser chrome settling does not require toggling fullscreen.
- Added a Back button to lobby sub-pages.
