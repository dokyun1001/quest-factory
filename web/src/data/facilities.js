// Facility registry. Art version, display size, ground anchor, footprint, collision and ports are
// managed separately so art can be swapped without touching logistics.
// Footprint/collision/ports of the ART 005-R facilities are PROTOTYPE candidates (not final).
export const FACILITIES = {
  miner: {
    name: '수정 채굴기', artFrame: 'fac_miner', artId: 'FAC_TEST_002_A_R1', artVersion: 'ART 005-R1',
    imageSize: [32, 32], anchorPx: [16, 30], footprint: [2, 2], solid: true,
    ports: [{ kind: 'out', tile: [1, 1], edge: 'E' }],
    cycleSec: 2.0, outCap: 2, needsDeposit: true,                // TEST values
  },
  smelter: {
    name: '수정 제련기', artFrame: 'fac_smelter', artId: 'FAC_TEST_003_A_R1', artVersion: 'ART 005-R1',
    imageSize: [32, 32], anchorPx: [16, 30], footprint: [2, 2], solid: true,
    ports: [{ kind: 'in', tile: [0, 1], edge: 'W' }, { kind: 'out', tile: [1, 1], edge: 'E' }],
    recipes: { iron_ore: 'iron_ingot' },                         // TEST: gold has no ingot art yet
    cycleSec: 3.0, inCap: 4, outCap: 4,                          // TEST values
  },
  supplier: {
    name: '임시 공급기', placeholder: true, artFrame: 'ph_supplier', imageSize: [16, 16], anchorPx: [8, 16],
    footprint: [1, 1], solid: true, rotatable: true, cycleSec: 1.0, outCap: 1,
    ports: [{ kind: 'out', tile: [0, 0], edge: 'E' }],           // edge follows rotation
  },
  storage: {
    name: '임시 저장소', placeholder: true, artFrame: 'ph_storage', imageSize: [16, 16], anchorPx: [8, 16],
    footprint: [1, 1], solid: true,
    ports: ['N', 'E', 'S', 'W'].map((e) => ({ kind: 'in', tile: [0, 0], edge: e })),
  },
};
