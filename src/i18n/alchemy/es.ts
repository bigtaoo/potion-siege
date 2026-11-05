// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: '¡Nueva reacción: {name}! +{n} cristales',
  starred: 'Maestría de {name} {s}★: poder +{p}%',
  power: 'Poder +{p}%',
  legendBoost: 'Potencia {name}',
  exits: {
    title: 'Otros caminos',
    lineup: 'Prueba este equipo',
    reacts: '{n} {n|one:reacción|other:reacciones} entre ellas',
    hard: 'Modo difícil, capítulo {c}',
    hardDesc: 'Paga como niveles más avanzados',
    tower: 'La torre alquímica',
    towerDesc: 'Sube pisos por cristales',
  },
  rack: {
    name: 'Estante de brebajes',
    claim: '+{n}',
    got: 'Estante: +{n} cristales',
    full: 'Lleno',
  },
  replayCut: 'Repetir hoy: mitad de cristales',
  talents: {
    open: 'Talentos',
    title: '{name}: talentos',
    both: 'Ambos talentos de Nv {n}',
    free: 'Cada batalla empieza con estas cartas. Cambia gratis cuando quieras.',
  },
  catalyst: {
    title: 'Catalizador: elige uno',
    held: 'Ya tienes ×{n}',
    volatile: {
      name: 'Sales volátiles',
      desc: 'Las reacciones hacen un 50 % más de daño el resto de la subida.',
    },
    wide: {
      name: 'Vapor difuso',
      desc: 'Las reacciones alcanzan un 30 % más el resto de la subida.',
    },
    potent: {
      name: 'Concentrado',
      desc: 'Cada poción hace un 20 % más de daño.',
    },
    quick: {
      name: 'Azogue',
      desc: 'Cada poción ataca un 15 % más rápido.',
    },
    bulwark: {
      name: 'Argamasa',
      desc: 'El muro gana un 40 % más de vida y se repara del todo.',
    },
    bounty: {
      name: 'Pan de oro',
      desc: 'Cada enemigo abatido da 2 de oro más.',
    },
  },
  rebrew: {
    button: 'Reelaborar',
    count: 'Reelaboraciones: {n}',
    essence: 'Esencia: {n}',
    what: 'Vuelca todo en el caldero: la campaña empieza de nuevo en el nivel 1 y las pociones en su primer nivel. Conservas el códice, la maestría de reacciones, los talentos, las estrellas, los cristales y la mitad del laboratorio, y ganas esencia para mejoras permanentes.',
    go: 'Reelaborar: +{n} esencia',
    sure: 'Toca otra vez para confirmar',
    locked: 'Supera el nivel {n} para reelaborar',
    done: '¡Reelaborado! +{n} esencia',
    perks: 'Mejoras permanentes',
    perk: {
      reaction: 'Reacciones +{p} %',
      wall: 'Vida del muro +{p} %',
      gold: 'Oro inicial +{n}',
      crystals: 'Cristales +{p} %',
    },
  },
  week: {
    button: 'Semana',
    title: 'Esta semana',
    rule: 'Regla de la torre: {name}',
    left: 'Nueva semana en: {n} d',
    best: 'Mejor piso de la semana: {n}',
    play: 'Subir',
    surge: {
      name: 'Oleada',
      desc: 'Las reacciones hacen 2× daño; los enemigos tienen un 30 % más de vida.',
    },
    focus: {
      name: 'Enfoque',
      desc: '{name} hace 4× daño.',
    },
    glass: {
      name: 'Cañón de cristal',
      desc: 'Las reacciones hacen 2,5× daño; las pociones un 20 % menos.',
    },
    brittle: {
      name: 'Muro frágil',
      desc: 'Las reacciones hacen 1,8× daño; el muro tiene un 25 % menos de vida.',
    },
    task: {
      kinds: 'Provoca {n} reacciones distintas',
      react: 'Provoca {n} reacciones',
      tower: 'Llega al piso {n} de la torre',
      challenge: 'Juega {n} desafíos diarios',
    },
  },
  next: {
    find: 'Quedan {n} reacciones por descubrir: ¡prueba parejas nuevas!',
    week: 'Hay una tarea semanal lista',
    tower: 'Torre esta semana: {name}. Mejor piso {n}',
    rebrew: 'Campaña superada: reelabora por {n} esencia',
    perk: 'Esencia por gastar: {n}',
  },
};
