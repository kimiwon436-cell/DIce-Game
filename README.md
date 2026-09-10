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
