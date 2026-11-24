# QUEST FACTORY

귀엽고 밝은 중세 판타지풍 2D 탑다운 픽셀아트 **길드 운영 + 공장 자동화** 게임입니다.

## ▶ 웹 체험판: https://dokyun1001.github.io/quest-factory/

- 현재 체험판: Phaser 3 웹 버전 (`web/`) — 사용자 승인에 따른 빠른 체험판
- 정식 엔진: Unity 6 LTS + C# (추후 착수)
- 개발 보고서: [docs/REPORT_001.md](docs/REPORT_001.md) · 배포 안내: [docs/DEPLOY.md](docs/DEPLOY.md)
- 이전 현황 보고: [docs/STATUS_001B.md](docs/STATUS_001B.md)
- 사용 에셋과 라이선스: [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)

## 저장소 구성
| 저장소 | 공개 여부 | 내용 |
|---|---|---|
| `dokyun1001/quest-factory` (이곳) | 공개 | 게임 코드, 문서, 도구, (추후) 웹 체험판 |
| `dokyun1001/quest-factory-assets` | **비공개** | 무료 에셋 원본·가공본 (라이선스상 공개 재배포 금지) |

빌드할 때는 비공개 에셋 저장소를 `assets/` 폴더로 받아서 합칩니다. `assets/`는 `.gitignore`에 등록되어 있어 이 공개 저장소에는 절대 올라가지 않습니다.

## 웹 체험판 빌드 (개발자용)
```bash
git clone https://github.com/dokyun1001/quest-factory-assets assets   # 비공개, 권한 필요
cd web && npm ci && npm run build      # 결과물: web/dist
```

## 도구
- `tools/build_art.py`: `assets/vendor`(원본)에서 슬라이싱·색감 보정본을 `assets/modified`로 생성합니다.
- `tools/fetch_itch.py`: itch.io 공식 페이지에서 무료 파일을 다시 받습니다. 사용법: `python3 tools/fetch_itch.py <페이지 URL> <저장 폴더> [파일명 일부]`
- `tools/pack_web_assets.py`: 게임에 쓰는 그림만 아틀라스로 다시 포장해 `web/.gen/`에 출력합니다. 원본 파일은 배포하지 않습니다.
