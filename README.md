# QUEST FACTORY

중세 판타지 **길드 경영 × 공장 자동화** 2D 탑다운 픽셀아트 게임 — 웹 개발 빌드 006 (전면 재개발, 단계 1)

## ▶ 플레이: https://dokyun1001.github.io/quest-factory/
## ▶ 007 통합 테스트 빌드: https://dokyun1001.github.io/quest-factory/test007/ (브랜치 `feat/test-007`, 보고서 [docs/DEV_REPORT_007.md](docs/DEV_REPORT_007.md))

- 엔진: Phaser 3.90 + JavaScript + Vite (Unity 전환은 별도 지시까지 보류)
- 개발 보고서: [docs/DEV_REPORT_006.md](docs/DEV_REPORT_006.md)
- 임시 표시 목록: [docs/PLACEHOLDERS_006.md](docs/PLACEHOLDERS_006.md) · 에셋 추가 방법: [docs/ADDING_ASSETS_006.md](docs/ADDING_ASSETS_006.md) · 배포: [docs/DEPLOY.md](docs/DEPLOY.md)
- 에셋 라이선스: [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)
- 이전 구현(004/005 시기)은 브랜치 `backup/pre-006-main`, `backup/pre-006-gh-pages`에 보존되어 있습니다.

## 조작
| 키 | 기능 |
|---|---|
| WASD / 방향키 | 길드마스터 이동 (관리자 시점에서는 화면 이동) |
| Tab | 직접 조작 ↔ 관리자 시점 |
| 마우스 휠, + / - | 확대/축소 (정수 배율 1~6) |
| 1~5 | 컨베이어 · 수정 채굴기 · 수정 제련기 · 임시 공급기 · 임시 저장소 |
| X / 우클릭 | 삭제 |
| R | 방향 회전 |
| 좌클릭 드래그 | 컨베이어 연속 설치 (코너 자동) |
| E | 채집 (나무, 발견한 광맥 옆) |
| Q / Esc | 도구 해제 |
| F3 | 성능 표시 |

## 저장소 구성
| 저장소 | 공개 | 내용 |
|---|---|---|
| `dokyun1001/quest-factory` (이곳) | 공개 | 게임 코드, 문서, 도구 |
| `dokyun1001/quest-factory-assets` | **비공개** | 아트 원본 (`QUEST_FACTORY_DEV_RESTART_006.zip` 등) |

빌드는 비공개 저장소의 `QUEST_FACTORY_DEV_RESTART_006.zip` **하나만** 읽어 SHA-256을 검증한 뒤, 허용 목록의 그림만 아틀라스 1장으로 포장합니다. 원본 파일은 배포하지 않습니다.

## 개발자용 빌드
```bash
git clone https://github.com/dokyun1001/quest-factory-assets assets   # 비공개, 권한 필요
cd web && npm ci && node test/sim.test.mjs && npm run build             # 결과물: web/dist
```
- `tools/pack_assets_006.py`: 006 패키지 검증 + 런타임 아틀라스 생성 (`web/src/gen/`, git 제외)
- `tools/check_legacy_assets.py`: 배포 폴더에 이전 임시 에셋이 0건인지 검사 (빌드 시 자동 실행)
- `web/test/`: 물류 시뮬레이션 단위 시험(Node), 브라우저 시험(Playwright)
