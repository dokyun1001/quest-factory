# 웹 체험판 배포 안내 (비개발자용)

## A. GitHub Pages 켜기 (최초 1회, 1분)
1. https://github.com/dokyun1001/quest-factory/settings/pages 에 접속한다.
2. **Build and deployment → Source**를 `Deploy from a branch`로 둔다.
3. **Branch**를 `gh-pages`, 폴더를 `/ (root)`로 고르고 **Save**를 누른다.
4. 1~3분 뒤 https://dokyun1001.github.io/quest-factory/ 에 접속한다.

## B. 업데이트가 반영되는 방식
- 지금은 개발 담당(Claude)이 클라우드에서 빌드해 `gh-pages` 브랜치에 직접 올린다. 올라가면 1~3분 안에 사이트에 반영된다.
- 반영이 안 보이면 Ctrl+F5(강력 새로고침)를 누른다.

## C. (선택) 완전 자동 배포 설정
`main` 브랜치에 코드가 올라올 때마다 GitHub Actions가 알아서 빌드하고 배포하게 할 수 있다. 공개 저장소이므로 무료다.
그림은 비공개 저장소에 있으므로, 읽기 전용 열쇠(토큰)를 하나 등록해야 한다.

1. https://github.com/settings/personal-access-tokens/new 에 접속한다.
   - Token name: `quest-factory-assets-read`
   - Expiration: 원하는 기간
   - Repository access: **Only select repositories** → `quest-factory-assets`
   - Permissions → Repository permissions → **Contents: Read-only**
   - **Generate token**을 누르고 토큰을 복사한다. (채팅에는 절대 붙여넣지 않는다.)
2. https://github.com/dokyun1001/quest-factory/settings/secrets/actions/new 에 접속한다.
   - Name: `ASSETS_TOKEN`
   - Secret: 복사한 토큰
   - **Add secret**을 누른다.
3. 이후 `main`에 변경이 올라오면 자동으로 사이트가 갱신된다. 진행 상황은 저장소의 **Actions** 탭에서 볼 수 있다.

토큰을 등록하지 않아도 오류는 나지 않는다. 자동 배포만 건너뛰고, B의 방식으로 계속 업데이트한다.

## 저장 데이터
- 게임 진행은 **그 브라우저에** 저장된다. 다른 PC나 다른 브라우저에서는 처음부터 시작한다.
- 브라우저의 "인터넷 사용 기록 삭제(쿠키 및 사이트 데이터)"를 하면 저장 데이터도 지워진다.
- 게임 안의 **새 게임** 버튼으로 초기화할 수 있다.
