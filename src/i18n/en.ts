// The source string table. Every other locale must match it key for key.
export const en = {
  title: 'Potion Siege',
  tapToStart: 'Tap to start',
  bestWave: 'Best: wave {n}',
  summon: 'Summon',
  upgrade: 'Upgrade',
  wave: 'Wave {n}/{total}',
  bossWave: 'BOSS WAVE!',
  hint: 'Drag two matching heroes together: they fuse into a random stronger one',
  upgradePick: 'Upgrade! Pick a skill',
  ultimatePick: 'Ultimate hero! Pick a bonus skill',
  cellOpen: 'New cell!',
  wallDone: 'The wall is complete!',
  commanderNext: '{n}/{total}',
  won: 'Victory!',
  lost: 'The wall has fallen',
  stats: 'Wave {wave}   Kills {kills}   Time {time}',
  playAgain: 'Play again',
  revive: 'Revive with an ad',
  hero: {
    slime: 'Slime',
    fire: 'Fire Slime',
    ice: 'Frost Slime',
    lightning: 'Storm Caller',
    poison: 'Plague Doctor',
  },
  skill: {
    allDamage: { name: 'Sharpened', desc: 'All heroes +15% damage' },
    allSpeed: { name: 'Battle Rhythm', desc: 'All heroes +12% attack speed' },
    crit: { name: 'Lucky Strike', desc: '+10% chance to deal double damage' },
    gold: { name: 'Bounty', desc: '+2 gold per kill' },
    wallRepair: { name: 'Masonry', desc: 'Wall +20% max HP, repair 30%' },
    slimePower: { name: 'Hard Jelly', desc: 'Base slimes +40% damage' },
    slimeMulti: { name: 'Double Blob', desc: 'Base slimes fire one more blob' },
    fireRadius: { name: 'Wildfire', desc: 'Fire blasts 35% wider' },
    iceFreeze: { name: 'Deep Freeze', desc: 'Frost hits may freeze for 1s' },
    lightningChain: { name: 'Overcharge', desc: 'Lightning jumps 2 more times' },
    poisonSpread: { name: 'Contagion', desc: 'Poisoned enemies spread poison on death' },
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Table = Widen<typeof en>;
