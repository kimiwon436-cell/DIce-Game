# Random Dice 2 — Render/GitHub server v6

## 이번 버전
- 협동전 티켓: 서버 DB의 지급 시각을 기준으로 **5분마다 +1**. 브라우저를 닫아도 경과 시간이 유지됩니다.
- 협동전 매칭: 서버 큐에서 **최대 30초** 동안 다른 플레이어를 기다립니다. 30초 안에 플레이어가 들어오면 그 플레이어와 매칭하고, 없으면 AI로 시작합니다.
- 로그인 유지: JWT를 localStorage에 보관하며, 다시 사이트에 들어오면 `/api/me`로 서버 세션을 확인합니다. 기본 토큰 유효기간은 30일입니다.
- 관리자: 서버가 username `kimsiwon`을 관리자 대상으로 인식합니다. 관리자 UI 버튼은 이 계정에만 표시되고, `/api/admin/*`에서도 서버 권한 검사를 다시 합니다.
- 관리자 재화 관리: 사용자별 코인/주사위/보석/아레나 티켓/협동전 티켓/행운의 주사위/pass XP를 추가, 차감, 값 설정할 수 있습니다.

## 폴더 구조
```text
프로젝트/
├─ public/
│  └─ index.html
├─ server.js
├─ package.json
├─ render.yaml
├─ README.md
└─ .gitignore
```

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: `DATABASE_URL`, `JWT_SECRET`

현재 사용 중인 Render PostgreSQL이 있다면 Database의 Internal Database URL을 `DATABASE_URL`에 넣으세요.
