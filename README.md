# CivicPin

CivicPin은 타오위안 시민이 지도에 민원 PIN을 제출하고, 관리자가 처리 상태를 갱신하며, 시민이 자기 티켓의 진행 상황을 확인하는 독립 MVP입니다. 제품 범위와 승인된 Fast-MVP 경계는 [PRD](docs/civic-pin/PRD.md)를 기준으로 합니다.

## 현재 연결 범위

- 시민(`/`): 카테고리 → 행정구 이동·현재 위치·지도 PIN → 제목·본문·이미지 선택 또는 촬영 → 휴대전화 SMS OTP → 티켓 조회
- 관리자(`/admin`): 행정구 이동·현재 위치·viewport 지도 PIN·공통 필터 → 최초 열람 → AI 보조/처리/보류/재개 → 최종 답변·완료
- 현장 확인: 처리 후 사진·점검 기록으로 해결 확인, 현재 위치·5분·앱 카메라 토큰으로 재발 후보 생성
- AI 지원: 선택적 위험도 제공자 → 검증된 1~5 제안 또는 평가 필요 → 관리자 사유 포함 수정 이력, 저장·재시도되는 요약·답변 초안
- 시민: 3초 이내 상태 이력·완료 답변 확인, 완료 이메일 수신
- 공개 플레이어: 13개 행정구의 5분 집계 snapshot, 억제·일반화된 문제지점, 자동 순환과 행정구 고정 QR
- 데이터: Supabase Auth, PostgreSQL RLS/RPC, private Storage, SMTP outbox, 보호된 자동 작업

## 로컬 실행

Docker가 실행 중인 환경이 필요합니다.

```bash
npm install
npm run db:start
npm run db:reset
cp .env.example .env.local
npm run dev
```

`supabase start`가 출력한 publishable key와 secret key를 `.env.local`에 입력합니다. 앱은 `http://localhost:3000`에서 열립니다. 로컬 시민 인증은 `0900-000-001` 또는 `0900-000-002`와 고정 코드 `123456`을 사용하며, 완료 메일은 Mailpit `http://127.0.0.1:54324`에서 확인합니다.

### 첫 관리자 등록

1. Supabase Dashboard의 Authentication > Users에서 관리자 이메일 사용자를 만들고 이메일을 확인 처리합니다.
2. 로컬 Supabase SQL editor에서 이메일과 개인 관리자 번호를 바꿔 아래 쿼리를 실행합니다.

```sql
select public.provision_staff(
  (select id from auth.users where lower(email) = lower('admin@example.com')),
  'CP-ADMIN-0001'
);
```

번호는 8~24자의 영문 대문자·숫자·하이픈만 허용되며 DB에는 bcrypt hash만 저장됩니다. 관리자 페이지에서 이메일 OTP → 개인 관리자 번호를 모두 통과해야 합니다. 관리자 권한은 이메일 도메인이나 OAuth 로그인만으로 자동 부여되지 않습니다.

### 선택적 AI 위험도 제공자

AI 제공자가 없어도 티켓은 정상 접수되고 `평가 필요`로 남습니다. 연결할 때는 `.env.local`에 `AI_RISK_ENDPOINT`, `AI_RISK_API_KEY`, `AI_RISK_MODEL`, `AI_RISK_MODEL_VERSION`을 설정합니다. endpoint에는 이메일·사진·좌표 없이 아래 JSON만 전달합니다.

```json
{ "title": "...", "body": "...", "category": "road_sidewalk" }
```

응답은 `riskLevel` 1~5, 허용된 `riskReasonCodes`, `filterReasonCodes` 배열이어야 합니다. 모델명·버전은 서버 설정을 정본으로 사용하고, 잘못된 응답·timeout·저장 실패는 티켓 상태를 바꾸지 않습니다. 허용 코드와 계약은 `lib/ai-risk.ts` 및 단위 테스트에 고정되어 있습니다.

관리자 요약·답변 초안은 `AI_ASSIST_ENDPOINT`, `AI_ASSIST_API_KEY`, `AI_ASSIST_MODEL`, `AI_ASSIST_MODEL_VERSION`으로 별도 연결합니다. 작업은 먼저 DB에 저장되고 실패 시 자동 재시도되며, 결과가 행정 완료·현장 해결·부서 전달·공개 통계를 확정하지 않습니다.

### 자동 작업과 복구

배포 스케줄러는 `CRON_SECRET` Bearer 인증으로 매분 `POST /api/jobs/run`을 호출합니다. 이 경로가 이메일, AI 작업, 5분 집계 snapshot과 연결되지 않은 사진 정리를 수행합니다. 백업·격리 복원과 장애 대응 절차는 [운영 문서](docs/civic-pin/OPERATIONS.md)에 있습니다.

### 현장 상태와 재발 증빙

행정 완료만으로 현장 상태를 해결로 바꾸지 않습니다. 관리자가 진행 중인 민원에 처리 후 사진과 10자 이상의 점검 기록을 함께 저장하면 `resolved_confirmed`가 기록되고, 증빙이 없으면 완료 뒤에도 `verification_pending`으로 남습니다.

시민의 현장 재발 증빙은 자기 완료·현장 미해결 티켓에서 시작합니다. 서버가 현재 위치와 원본 PIN의 거리가 500m 이내인지 승인한 뒤에만 5분짜리 1회 토큰과 앱 내 카메라를 열며, 촬영 후 제목·설명을 입력해 새 티켓으로 제출합니다. 거리 초과, 다른 시민의 원본 티켓, 만료·재사용 토큰은 거부됩니다. 일반 사진은 근접 후보가 될 수 있어도 관리자가 재발로 확정할 수 없습니다.

## 검증

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:db
npm run lint:db
```

DB와 브라우저 검증은 로컬 Supabase가 실행 중이어야 합니다. 개발 완료와 파일럿 출시는 구분합니다. 별도 Supabase 프로젝트, 운영 SMS provider와 SMS abuse 방지용 CAPTCHA/rate limit, 운영 SMTP·AI provider, 관리자 계정 복구·권한 회수, 실제 운영 백업 저장소, 실기기·스크린리더와 법률 검토를 통과하기 전에는 `pilot-ready`로 보지 않습니다.
