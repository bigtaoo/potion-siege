// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

export const alchemy = {
  found: 'New reaction: {name}! +{n} crystals',
  starred: '{name} mastery {s}★: power +{p}%',
  power: 'Power +{p}%',
  legendBoost: 'Boosts {name}',
  exits: {
    title: 'Other ways on',
    lineup: 'Try this lineup',
    reacts: '{n} {n|one:reaction|other:reactions} between them',
    hard: 'Hard mode, chapter {c}',
    hardDesc: 'Pays as stages further on',
    tower: 'The alchemy tower',
    towerDesc: 'Climb floors for crystals',
  },
  rack: {
    name: 'Brewing rack',
    claim: '+{n}',
    got: 'Brewing rack: +{n} crystals',
    full: 'Full',
  },
  replayCut: 'Replays of this stage today: half crystals',
  talents: {
    open: 'Talents',
    title: '{name}: talents',
    both: 'Both Lv {n} talents',
    free: 'Each battle starts with these cards on. Switch any time, free.',
  },
  catalyst: {
    title: 'Catalyst: pick one',
    held: 'Held ×{n}',
    volatile: {
      name: 'Volatile Salts',
      desc: 'Reactions deal 50% more damage for the rest of the climb.',
    },
    wide: {
      name: 'Spreading Vapor',
      desc: 'Reactions reach 30% wider for the rest of the climb.',
    },
    potent: {
      name: 'Concentrate',
      desc: 'Every potion deals 20% more damage.',
    },
    quick: {
      name: 'Quicksilver',
      desc: 'Every potion attacks 15% faster.',
    },
    bulwark: {
      name: 'Stone Mortar',
      desc: 'The wall gets 40% more HP and is fully repaired.',
    },
    bounty: {
      name: 'Gold Leaf',
      desc: 'Every kill brings 2 more gold.',
    },
  },
  rebrew: {
    button: 'Rebrew',
    count: 'Rebrews: {n}',
    essence: 'Essence: {n}',
    what: 'Pour it all back into the cauldron: the campaign starts again at stage 1 and the potions at their first level. You keep the codex, reaction mastery, talents, stars, crystals and half the lab, and gain essence for lasting perks.',
    go: 'Rebrew: +{n} essence',
    sure: 'Tap again to rebrew',
    locked: 'Clear stage {n} to rebrew',
    done: 'Rebrewed! +{n} essence',
    perks: 'Lasting perks',
    perk: {
      reaction: 'Reactions +{p}%',
      wall: 'Wall HP +{p}%',
      gold: 'Start gold +{n}',
      crystals: 'Crystals +{p}%',
    },
  },
  week: {
    button: 'Week',
    title: 'This week',
    rule: 'Tower rule: {name}',
    left: 'New week in: {n} d',
    best: 'Best floor this week: {n}',
    play: 'Climb',
    surge: {
      name: 'Surge',
      desc: 'Reactions deal 2× damage; enemies have 30% more HP.',
    },
    focus: {
      name: 'Focus',
      desc: '{name} deals 4× damage.',
    },
    glass: {
      name: 'Glass Cannon',
      desc: 'Reactions deal 2.5× damage; potions deal 20% less.',
    },
    brittle: {
      name: 'Brittle Wall',
      desc: 'Reactions deal 1.8× damage; the wall has 25% less HP.',
    },
    task: {
      kinds: 'Set off {n} different reactions',
      react: 'Set off {n} reactions',
      tower: 'Reach floor {n} in the tower',
      challenge: 'Play {n} daily challenges',
    },
  },
  next: {
    find: '{n} reactions still to find: try new pairs!',
    week: 'A weekly task is ready to claim',
    tower: 'Tower this week: {name}. Best floor {n}',
    rebrew: 'Campaign cleared: rebrew for {n} essence',
    perk: 'Essence to spend: {n}',
  },
};
