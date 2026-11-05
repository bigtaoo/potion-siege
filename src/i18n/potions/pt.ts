// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Tônico Radiante', metal: 'Tônico de Mercúrio', vine: 'Tônico de Espinhos' },
  role: { light: 'Feixe perfurante', metal: 'Golpe pesado', vine: 'Enraíza' },
  rx: { prism: 'Prisma', flare: 'Clarão', magnetize: 'Magnetismo', molten: 'Fusão', spores: 'Esporos', bramble: 'Espinhos de gelo' },
  rxDo: {
    prism: 'A geada divide a luz: feixes nos 3 mais próximos',
    flare: 'Explosão de calor e brilho: dano e desacelera ao redor',
    magnetize: 'O mercúrio vira ímã: puxa tudo ao redor',
    molten: 'O mercúrio ferve: uma queimadura forte',
    spores: 'A vinha floresce veneno sobre tudo por perto',
    bramble: 'Espinhos congelados brotam: tudo ao redor fica preso',
  },
  skill: {
    lightDamage: { name: 'Brilho', desc: 'Tônicos radiantes +40% de dano' },
    lightWide: { name: 'Feixe Largo', desc: 'Feixes de luz 40% mais largos' },
    lightGlare: { name: 'Ofuscar', desc: 'Os feixes deixam tudo que cruzam 20% mais lento por 1s' },
    lightFocus: { name: 'Foco', desc: 'Os feixes atingem tudo na linha com a força do alvo' },
    lightFire: { name: 'Fogo Solar', desc: 'Os feixes queimam como fogo' },
    metalDamage: { name: 'Metal Pesado', desc: 'Tônicos de mercúrio +40% de dano' },
    metalShrapnel: { name: 'Metralha', desc: 'Balas espalham 30% do golpe ao redor' },
    metalCrush: { name: 'Derrubada', desc: 'Balas podem derrubar por 0,6s (15%); chefes ficam mais lentos' },
    metalBreak: { name: 'Quebra-Armadura', desc: 'Balas deixam inimigos frágeis por 1,5s: +40% de dano recebido' },
    metalFire: { name: 'Forja', desc: 'Balas +60% de dano em inimigos em chamas' },
    vineDamage: { name: 'Matagal', desc: 'Tônicos de espinhos +40% de dano' },
    vineRoot: { name: 'Raízes Profundas', desc: 'Enraizamentos duram 30% mais' },
    vineThorns: { name: 'Espinhos', desc: 'Inimigos enraizados sangram 40% do golpe por segundo' },
    vineSpread: { name: 'Trepadeira', desc: 'Abates de vinha enraízam o inimigo mais próximo' },
    vinePoison: { name: 'Espinhos Tóxicos', desc: 'Golpes de vinha envenenam como o corrosivo' },
  },
  perk: {
    lightGlarePlus: 'Ofuscar desacelera 50% mais',
    metalCrushPlus: 'Derrubadas duram 50% mais',
    vineThornsPlus: 'Espinhos +50% de dano',
  },
};
