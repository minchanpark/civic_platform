# CivicPin

CivicPin은 타오위안 시민이 지도에 민원 PIN을 제출하고, 관리자가 처리 상태를 갱신하며, 시민이 자기 티켓의 진행 상황을 확인하는 독립 MVP입니다.

제품 범위와 승인된 Fast-MVP 경계는 [PRD](docs/civic-pin/PRD.md)를 기준으로 합니다.

## 로컬 실행

```bash
npm install
supabase start
supabase db reset
cp .env.example .env.local
npm run dev
```

Supabase가 출력한 publishable key를 `.env.local`에 입력한 뒤 `http://localhost:3000`을 엽니다. 로컬 인증 이메일은 Supabase Mailpit에서 확인합니다.

## 1차 수직 흐름

- 시민: 카테고리 → 지도 PIN → 제목·본문·사진 → 이메일 OTP → 티켓
- 관리자: 지도 PIN → 최초 열람 → 처리 시작 → 최종 답변·완료
- 시민: 상태 이력과 완료 답변 확인, 완료 이메일 수신

음성·AI·공개 승인·QR 플레이어는 같은 PRD의 다음 증분입니다.
