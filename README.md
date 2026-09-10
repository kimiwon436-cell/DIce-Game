# Random Dice 2 Render v5

수정 사항:
- `D is not defined` 오류 수정: `public/index.html` 및 `client.js`에 주사위 정의(`D`) 포함.
- 기존 Render/PostgreSQL/JWT 서버 구조 유지.
- `public/index.html`이 루트에서 정상 서빙되도록 Express 라우트 유지.

Render:
- Build: `npm install`
- Start: `npm start`
- Environment: `JWT_SECRET`, `DATABASE_URL`
