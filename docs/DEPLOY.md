# 웹 빌드 배포 안내 (006)

## 현재 배포 방식
- 지금은 개발 담당(Claude)이 클라우드에서 빌드·검사한 뒤 `gh-pages` 브랜치에 **일반 커밋**으로 직접 올립니다. 1~3분 뒤 사이트에 반영됩니다.
- 2026-11-25 확인 결과, 저장소에 비밀값 `ASSETS_TOKEN`이 **등록되어 있지 않아** 자동 배포는 빌드를 건너뜁니다(오류 없이 종료). 아래 C를 하면 자동 배포가 켜집니다. 하지 않아도 지금 방식으로 계속 배포됩니다.

## (선택) 자동 배포
- 등록되면 `main` 브랜치의 `web/`, `tools/`, 워크플로 파일이 바뀔 때마다 GitHub Actions(**Deploy web build (006)**)가 자동으로:
  1. 비공개 저장소에서 `QUEST_FACTORY_DEV_RESTART_006.zip`을 받아 SHA-256 검증 → 아틀라스 생성
  2. 물류 시뮬레이션 시험 → 빌드 → 이전 임시 에셋 포함 0건 검사
  3. `gh-pages` 브랜치에 **일반 커밋**으로 올림 (강제 덮어쓰기 없음 → 이전 배포본 복구 가능)
- 1~3분 뒤 https://dokyun1001.github.io/quest-factory/ 에 반영됩니다. 이전 화면이 보이면 Ctrl+F5.

### C. ASSETS_TOKEN 등록 (최초 1회, 약 3분)
1. https://github.com/settings/personal-access-tokens/new 접속
   - Token name: `quest-factory-assets-read` · Repository access: **Only select repositories** → `quest-factory-assets`
   - Permissions → Repository permissions → **Contents: Read-only** → **Generate token** → 복사 (채팅에는 절대 붙여넣지 않습니다)
2. https://github.com/dokyun1001/quest-factory/settings/secrets/actions/new 접속
   - Name: `ASSETS_TOKEN` · Secret: 복사한 토큰 → **Add secret**

## 되돌리기
- 이전 체험판 코드: 브랜치 `backup/pre-006-main`
- 이전 공개 페이지: 브랜치 `backup/pre-006-gh-pages`
- 되돌리려면 개발 담당에게 "006 이전 배포로 되돌려 달라"고 요청하면 됩니다.

## 저장 데이터
- 새 게임은 브라우저 저장소의 새 키(`qf006.main.v1`, 테스트 배치 `qf006.test.v1`, 설정 `qf006.settings.v1`)를 씁니다.
- 이전 체험판의 저장 데이터(`questfactory.save.v1`)는 읽지도, 지우지도 않습니다.
- 진행은 **그 브라우저에** 저장됩니다. 30초마다, 창을 닫거나 탭을 바꿀 때 자동 저장됩니다.
