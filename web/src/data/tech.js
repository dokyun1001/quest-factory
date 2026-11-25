// Research (연구소: industry). Samples are PERMANENT counters from kills/surveys; consuming loot never reduces them.
// req.samples: { monsterId: n }, req.milestones: { key: n } (basic industry techs need no monster research).
// All thresholds are TEST values.
export const TECH = {
  logistics: { name: '물류 분기', desc: '분배기·합류기·분류기', req: { milestones: { iron_ingot_made: 6 } } },
  schooling: { name: '모험가 학교', desc: '종합 모험가 학교 건설', req: { milestones: { adventurers: 3 } } },
  alchemy: { name: '연금술', desc: '회복/마나 물약, 연금 작업대', req: { samples: { slime: 8 } } },
  iron_arms: { name: '철제 무장', desc: '철검·철퇴·철 갑옷·상위 지팡이/활', req: { samples: { wolf: 5 }, milestones: { iron_ingot_made: 4 } } },
  recycling: { name: '장비 분쇄', desc: '분쇄기 (회수율 20%)', req: { milestones: { used_bought: 1 } } },
  natural_power: { name: '자연 동력', desc: '물레방아, 컨베이어 II, 대형 채굴기, 기계 속도 2.5배', req: { samples: { slime: 15, wolf: 8 }, milestones: { iron_ingot_made: 15 } } },
  steam: { name: '증기 공학', desc: '(구조 시험용) 6배', req: { prereq: ['natural_power'], samples: { golem: 1 } } },
  arcane: { name: '마력 공학', desc: '(구조 시험용) 15배', req: { prereq: ['steam'], samples: { golem: 3 } } },
  ancient: { name: '고대 공학', desc: '(구조 시험용) 40배', req: { prereq: ['arcane'], samples: { golem: 6 } } },
};
export const TIER_TECH = [null, 'natural_power', 'steam', 'arcane', 'ancient'];
