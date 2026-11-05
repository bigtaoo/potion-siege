// The three later potions' words (light, quicksilver, vine): their names and roles, their skill
// cards and perks, and the reactions they set off. Their own file, as the language's table is
// near the length limit; spread into hero, role, codex.rx, codex.rxDo, skill and perk there.

export const potions = {
  hero: { light: 'Radiant Tonic', metal: 'Quicksilver Tonic', vine: 'Bramble Tonic' },
  role: { light: 'Piercing beam', metal: 'Heavy hitter', vine: 'Root' },
  rx: { prism: 'Prism', flare: 'Flare', magnetize: 'Magnetize', molten: 'Molten', spores: 'Spores', bramble: 'Frost Thorns' },
  rxDo: {
    prism: 'The frost splits the light: beams at the 3 nearest',
    flare: 'A burst of heat and glare: damage and a slow all around',
    magnetize: 'The quicksilver turns magnet: draws everything around in',
    molten: 'The quicksilver boils over: a heavy burn',
    spores: 'The vine blooms poison onto everything around',
    bramble: 'Frozen thorns burst out: everything around held fast',
  },
  skill: {
    lightDamage: { name: 'Brilliance', desc: 'Radiant tonics +40% damage' },
    lightWide: { name: 'Wide Beam', desc: 'Light beams 40% wider' },
    lightGlare: { name: 'Glare', desc: 'Beams slow everything they cross by 20% for 1s' },
    lightFocus: { name: 'Focus', desc: 'Beams hit everything on their line as hard as their target' },
    lightFire: { name: 'Sunfire', desc: 'Beams scorch as fire' },
    metalDamage: { name: 'Heavy Metal', desc: 'Quicksilver tonics +40% damage' },
    metalShrapnel: { name: 'Shrapnel', desc: 'Slugs splash 30% of the hit around' },
    metalCrush: { name: 'Knockdown', desc: 'Slugs may knock down for 0.6s (15%); bosses slow' },
    metalBreak: { name: 'Armor Break', desc: 'Slugs leave enemies brittle for 1.5s: +40% damage taken' },
    metalFire: { name: 'Forge', desc: 'Slugs +60% damage to burning enemies' },
    vineDamage: { name: 'Overgrowth', desc: 'Bramble tonics +40% damage' },
    vineRoot: { name: 'Deep Roots', desc: 'Roots hold 30% longer' },
    vineThorns: { name: 'Thorns', desc: 'Rooted enemies bleed 40% of the hit per second' },
    vineSpread: { name: 'Creeper', desc: 'Vine kills root the nearest enemy' },
    vinePoison: { name: 'Toxic Thorns', desc: 'Vine hits poison as corrosion does' },
  },
  perk: {
    lightGlarePlus: 'Glare slows 50% harder',
    metalCrushPlus: 'Knockdowns last 50% longer',
    vineThornsPlus: 'Thorns +50% damage',
  },
};
