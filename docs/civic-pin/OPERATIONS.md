# CivicPin 운영 절차

## 자동 작업

배포 환경의 스케줄러가 매분 `POST /api/jobs/run`을 호출한다. 요청에는 최소 32자의 무작위 `CRON_SECRET`을 `Authorization: Bearer …`로 전달한다. 한 번의 호출은 다음 작업을 좁은 service-role RPC로 실행한다.

- 완료·보류 이메일 outbox 발송 및 지수형 재시도
- 실패한 AI 위험도와 AI 요약·답변 초안 재시도
- 최대 5분 간격으로 최근 90일 공개 집계 snapshot 생성
- 24시간 넘게 티켓 또는 처리 증빙에 연결되지 않은 비공개 사진 제거

응답의 `ok`가 `false`이거나 관리자 화면의 재시도 소진 건수가 0보다 크면 운영자가 provider·SMTP 설정과 작업 로그를 확인한다. 스케줄러와 애플리케이션 로그에는 요청 본문, 이메일, 사진 경로, 토큰을 기록하지 않는다.

운영 Supabase Auth의 Site URL은 공식 서비스 주소로 설정하고, 시민 매직 링크가 돌아올 `/`, `/tickets`, `/tickets/**`의 HTTPS 주소만 Redirect URL 허용 목록에 등록한다. 로컬의 `http://localhost:3000/**` 와일드카드를 운영 환경에 복사하지 않는다.

## 주소 역지오코딩

서버는 PIN 좌표를 `NOMINATIM_URL`의 Nominatim 호환 역지오코딩 서비스로 전송한다. 공개 OpenStreetMap Nominatim은 소규모 MVP 기본값이며, `NOMINATIM_USER_AGENT`에 실제 서비스 연락처를 넣고 초당 1회 제한·캐시·화면 출처 표기를 유지한다. 파일럿 전에는 예상 트래픽과 개인정보 조건을 검토해 TGOS 또는 계약된 전용 공급자로 교체한다.

## 백업과 격리 복원 시험

실제 시민 데이터 수집 전과 마이그레이션 전에는 DB와 비공개 Storage를 같은 시점에 백업한다. 로컬 검증 명령은 다음과 같다.

```bash
scripts/backup-local.sh /an/encrypted/location/civicpin-YYYYMMDD-HHMMSS
scripts/verify-backup.sh /an/encrypted/location/civicpin-YYYYMMDD-HHMMSS
```

백업 스크립트는 기존 디렉터리를 덮어쓰지 않고 권한을 제한하며 DB custom dump, Storage archive와 SHA-256 checksum을 만든다. 검증 스크립트는 운영 DB를 변경하지 않고 Docker 내부의 임시 DB와 로컬 임시 Storage 디렉터리에 복원한 뒤 핵심 스키마와 archive 무결성을 확인하고 임시 자원을 제거한다.

운영 복구에서는 먼저 쓰기를 중단하고 새 Supabase 환경에 동일 migration 버전을 적용한다. 검증된 dump와 Storage archive를 새 환경에 복원한 뒤 티켓·연락처·사진 메타데이터 건수와 표본 사진 다운로드를 대조한다. 대조가 끝나기 전 DNS나 클라이언트를 새 환경으로 전환하지 않는다. 백업은 개인정보이므로 암호화된 저장소, 최소 권한, 승인된 보존기간을 사용한다.

## 브라우저 현장 증빙 한계

재발 증빙은 브라우저가 제공하는 실시간 카메라·위치 권한, 서버 발급 5분 토큰, PIN 반경 500m와 1회 사용을 검증한다. 웹 브라우저만으로 기기 센서나 촬영 원본의 포렌식 진위를 완전히 증명할 수는 없다. 이 결과는 자동 확정이 아니라 관리자 판정의 증거이며, 지원하지 않는 기기에서는 일반 신고로만 접수한다.

## 파일럿 전 외부 게이트

- 대만 개인정보·보존기간·동의 문구 법률 검토
- 운영 SMTP와 AI provider의 계약·장애·비용 검증
- 운영 역지오코딩 공급자와 좌표 처리·보존 조건 검증
- CAPTCHA와 관리자 계정·번호 복구 및 퇴사자 권한 회수 절차
- 운영 백업 저장소에서의 실제 복원 훈련
- iOS/Android 실기기와 정식 스크린리더 검증
