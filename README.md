# Random Dice 2 Web — Render + GitHub 서버 버전

## 구조

- `public/index.html`: 현재 게임/로비 프론트엔드
- `server.js`: Express API + 간단한 온라인 매칭 큐 + WebSocket
- PostgreSQL: 계정/닉네임/재화/덱/다이스 트리/패스/퀘스트 등의 영구 저장
- `render.yaml`: Render Web Service + Postgres 자동 구성

## 데이터 저장

신규 계정은 아래 값으로 시작합니다.

- 코인: 100
- 주사위: 0
- 보석: 0
- 아레나 티켓: 0
- 협동전 티켓: 0
- 패스 XP: 0
- 행운의 주사위: 0
- 덱: 빈/초기 슬롯 상태
- 해금 주사위: 없음

게임 중 사용하는 SP는 전투 세션 데이터라 로비 영구 재화와 분리해서 프론트엔드에서 관리합니다.

## Render 배포

Render에서 GitHub 저장소를 연결한 뒤 `render.yaml`을 적용하면 Web Service와 Postgres 구성을 만들 수 있습니다. Render는 연결된 저장소의 선택 브랜치에 푸시될 때 자동 배포할 수 있습니다.

필요한 비밀 값:
- `JWT_SECRET`는 Render에서 generateValue로 생성됩니다.
- `DATABASE_URL`은 Render Postgres의 connectionString에서 주입됩니다.

## 로컬 실행

Node.js 20+ 권장.

1. `npm install`
2. PostgreSQL을 준비하고 `DATABASE_URL` 환경변수를 설정
3. `JWT_SECRET` 환경변수를 설정
4. `npm start`
5. `http://localhost:10000`

## 주의

이 버전은 실제 계정/데이터를 서버 DB에 보관하도록 만든 프로토타입입니다.
비밀번호는 bcrypt 해시로 저장하며, JWT를 사용합니다.

실제 상용 서비스 수준에서는:
- refresh token rotation
- rate limiting
- CSRF/CORS 정책
- 관리자 인증/권한
- 서버 authoritative 전투 판정
- 매칭 취소/재접속/타임아웃 처리
- Redis 기반 분산 매칭
등을 추가하는 것을 권장합니다.
