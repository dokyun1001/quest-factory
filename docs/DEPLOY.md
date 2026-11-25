# 웹 빌드 배포 안내 (006)

## 자동 배포 (현재 설정)
- `main` 브랜치의 `web/`, `tools/`, 워크플로 파일이 바뀌면 GitHub Actions(**Deploy web build (006)**)가 자동으로:
  1. 비공개 저장소에서 `QUEST_FACTORY_DEV_RESTART_006.zip`을 받아 SHA-256 검증 → 아틀라스 생성
  2. 물류 시뮬레이션 시험 → 빌드 → 이전 임시 에셋 포함 0건 검사
  3. `gh-pages` 브랜치에 **일반 커밋**으로 올림 (강제 덮어쓰기 없음 → 이전 배포본 복구 가능)
- 1~3분 뒤 https://dokyun1001.github.io/quest-factory/ 에 반영됩니다. 이전 화면이 보이면 Ctrl+F5.
- 비공개 저장소 읽기용 비밀값 `ASSETS_TOKEN`은 이미 등록되어 있습니다. 만료되면 저장소 **Settings → Secrets and variables → Actions**에서 같은 이름으로 새로 등록합니다(채팅에 붙여넣지 않습니다).

## 되돌리기
- 이전 체험판 코드: 브랜치 `backup/pre-006-main`
- 이전 공개 페이지: 브랜치 `backup/pre-006-gh-pages`
- 되돌리려면 개발 담당에게 "006 이전 배포로 되돌려 달라"고 요청하면 됩니다.

## 저장 데이터
- 새 게임은 브라우저 저장소의 새 키(`qf006.main.v1`, 테스트 배치 `qf006.test.v1`, 설정 `qf006.settings.v1`)를 씁니다.
- 이전 체험판의 저장 데이터(`questfactory.save.v1`)는 읽지도, 지우지도 않습니다.
- 진행은 **그 브라우저에** 저장됩니다. 30초마다, 창을 닫거나 탭을 바꿀 때 자동 저장됩니다.
