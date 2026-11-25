// TEST monsters (not final content). elem: own element; weak/resist multipliers by attacking element.
export const MONSTERS = {
  slime: { name: '슬라임', hp: 30, atk: 4, def: 0, speed: 1.2, range: 0.9, cd: 1.4, xp: 14, elem: 'water',
    weak: { thunder: 1.5, fire: 1.2 }, resist: { water: 0.5 }, loot: [['slime', 1.0, 1]], color: '#5fc45a', size: 10 },
  wolf: { name: '늑대', hp: 55, atk: 8, def: 2, speed: 2.4, range: 1.0, cd: 1.1, xp: 28, elem: 'earth',
    weak: { fire: 1.5 }, resist: { earth: 0.6 }, loot: [['wolf_pelt', 0.7, 1], ['wolf_fang', 0.45, 1]], color: '#7d756c', size: 12 },
  golem: { name: '시험 보스: 바위 골렘', hp: 2200, atk: 26, def: 6, speed: 1.0, range: 1.4, cd: 2.0, xp: 400, elem: 'earth', boss: true,
    weak: { water: 1.4, ice: 1.3 }, resist: { earth: 0.4, fire: 0.8 }, loot: [['golem_core', 1.0, 1]], color: '#8b8475', size: 22,
    // telegraphed patterns: windup is shown as a filling red area before the hit
    patterns: [
      { id: 'slam', name: '내려찍기', windup: 1.8, radius: 2.6, dmg: 3.2, every: 6 },
      { id: 'quake', name: '지진파', windup: 2.6, radius: 5.0, dmg: 2.0, every: 15 },
    ] },
};
export const HABITATS = { slime: { max: 6 }, wolf: { max: 4 } };
