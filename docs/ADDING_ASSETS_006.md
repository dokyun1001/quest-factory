# 신규 시설·캐릭터 에셋 추가 방법 (006)

## 원칙
1. 원본은 비공개 저장소 `quest-factory-assets`에 **버전별 ZIP**으로 올리고, 매니페스트에 SHA-256을 기록합니다.
2. 빌드는 `tools/pack_assets_006.py`의 **허용 목록**(`allow_list()`)에 적힌 파일만 아틀라스에 넣습니다. 미리보기·마스크·보존본은 넣지 않습니다.
3. 아틀라스는 항상 1장(공유 GPU 텍스처)입니다. 이미지가 늘어 256×1024를 넘으면 스크립트가 높이를 2의 거듭제곱으로 자동 확장합니다.

## 새 시설 (예: 수정 채굴기 작동 애니메이션, 새 가공기)
1. `pack_assets_006.py` → `allow_list()`에 프레임 추가 (예: `out.append(("fac_press", PKG, "…/FAC_TEST_004_A.png", None))`). 새 패키지라면 `PKG_…` 상수와 매니페스트 검증이 자동으로 적용됩니다.
2. `web/src/data/facilities.js`에 항목 추가: `artFrame`, `artId`, `artVersion`, `imageSize`, `anchorPx`(지면 기준점), `footprint`(설치 범위), `solid`(충돌), `ports`(입출력 위치·방향), 처리 규칙. **아트 메타데이터와 실제 기능 값이 다르면 보고하고 임의 확정하지 않습니다.**
3. `web/src/sim/world.js`의 `facAccepts / tickFacility`에 동작 규칙 추가.
4. `web/src/ui/ui.js`의 `TOOL_INFO`와 `GameScene.js`의 `TOOLS` 단축키에 등록.
5. `node web/test/sim.test.mjs`에 시험 추가 후 빌드.

## 새 캐릭터 외형 (머리·눈·의상·장신구)
- 시트 규격: 16×24 프레임, 64×96 시트, 4열×4행(아래/왼쪽/오른쪽/위), idle/walk 각 1장. **전체 이동 동작이 완성된 것만** 등록합니다.
- 합성 순서: 뒤쪽 머리 → 몸체 → 눈 → 의상 → 앞쪽 머리 → 장신구 (`web/src/render/charComposer.js`의 `composeCanvas`).
- `web/src/data/appearance.js`의 목록(`HAIRS`, `OUTFITS`, 팔레트)에 추가하면 길드마스터 선택 화면과 모험가 무작위 생성에 동시에 반영됩니다.
- 색 변경은 **해당 레이어에만** 정확한 색 치환으로 적용합니다(합성 결과 전체에 적용 금지).
- 저장 필드: `bodyType, skinId, hairId, hairPaletteId, eyeShapeId, eyeColorId, outfitId, outfitPaletteId, accessoryIds`.
- Big 체형(위로 1px 보정 후보)·Small 체형(측면 미완성)은 검증 후 `BODY_TYPES`에 추가합니다.

## 라이선스 기록
Franuka 등 외부 에셋을 추가하면 `THIRD_PARTY_ASSETS.md`와 `web/index.html`의 크레딧 화면에 에셋명·제작자·출처·라이선스·변경 사항을 함께 적습니다.
