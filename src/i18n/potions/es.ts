// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Tónico radiante', metal: 'Tónico mercurial', vine: 'Tónico espinoso' },
  role: { light: 'Haz perforante', metal: 'Golpe pesado', vine: 'Enraíza' },
  rx: { prism: 'Prisma', flare: 'Destello', magnetize: 'Magnetismo', molten: 'Fundición', spores: 'Esporas', bramble: 'Espinas de escarcha' },
  rxDo: {
    prism: 'La escarcha divide la luz: haces a los 3 más cercanos',
    flare: 'Estallido de calor y brillo: daño y ralentiza alrededor',
    magnetize: 'El mercurio se vuelve imán: atrae todo lo cercano',
    molten: 'El mercurio hierve: una quemadura fuerte',
    spores: 'La enredadera florece veneno sobre todo lo cercano',
    bramble: 'Brotan espinas heladas: todo alrededor queda atrapado',
  },
  skill: {
    lightDamage: { name: 'Brillantez', desc: 'Tónicos radiantes +40% de daño' },
    lightWide: { name: 'Haz amplio', desc: 'Haces de luz un 40% más anchos' },
    lightGlare: { name: 'Deslumbrar', desc: 'Los haces ralentizan un 20% durante 1s todo lo que cruzan' },
    lightFocus: { name: 'Enfoque', desc: 'Los haces golpean todo en su línea tan fuerte como a su objetivo' },
    lightFire: { name: 'Fuego solar', desc: 'Los haces queman como el fuego' },
    metalDamage: { name: 'Metal pesado', desc: 'Tónicos mercuriales +40% de daño' },
    metalShrapnel: { name: 'Metralla', desc: 'Las balas salpican un 30% del golpe alrededor' },
    metalCrush: { name: 'Derribo', desc: 'Las balas pueden derribar 0.6s (15%); a los jefes los ralentizan' },
    metalBreak: { name: 'Rompearmaduras', desc: 'Las balas dejan frágiles a los enemigos 1.5s: +40% de daño recibido' },
    metalFire: { name: 'Forja', desc: 'Las balas hacen +60% de daño a enemigos en llamas' },
    vineDamage: { name: 'Maleza', desc: 'Tónicos espinosos +40% de daño' },
    vineRoot: { name: 'Raíces profundas', desc: 'Los enraizamientos duran un 30% más' },
    vineThorns: { name: 'Espinas', desc: 'Los enemigos enraizados sangran un 40% del golpe por segundo' },
    vineSpread: { name: 'Trepadora', desc: 'Las bajas de enredadera enraízan al enemigo más cercano' },
    vinePoison: { name: 'Espinas tóxicas', desc: 'Los golpes de enredadera envenenan como los corrosivos' },
  },
  perk: {
    lightGlarePlus: 'Deslumbrar: ralentiza un 50% más',
    metalCrushPlus: 'Los derribos duran un 50% más',
    vineThornsPlus: 'Espinas: +50% de daño',
  },
};
