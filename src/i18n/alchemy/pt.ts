// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Nova reação: {name}! +{n} cristais',
  starred: 'Maestria de {name} {s}★: poder +{p}%',
  power: 'Poder +{p}%',
  legendBoost: 'Fortalece {name}',
  exits: {
    title: 'Outros caminhos',
    lineup: 'Tente esta equipe',
    reacts: '{n} {n|one:reação|other:reações} entre elas',
    hard: 'Modo difícil, capítulo {c}',
    hardDesc: 'Paga como fases mais à frente',
    tower: 'A torre alquímica',
    towerDesc: 'Suba andares por cristais',
  },
  rack: {
    name: 'Estante de poções',
    claim: '+{n}',
    got: 'Estante: +{n} cristais',
    full: 'Cheio',
  },
  replayCut: 'Repetir hoje: metade dos cristais',
  talents: {
    open: 'Talentos',
    title: '{name}: talentos',
    both: 'Os dois talentos do Nv {n}',
    free: 'Toda batalha começa com essas cartas. Troque grátis quando quiser.',
  },
  catalyst: {
    title: 'Catalisador: escolha um',
    held: 'Já tem ×{n}',
    volatile: {
      name: 'Sais voláteis',
      desc: 'Reações causam 50% mais dano pelo resto da subida.',
    },
    wide: {
      name: 'Vapor difuso',
      desc: 'Reações alcançam 30% mais longe pelo resto da subida.',
    },
    potent: {
      name: 'Concentrado',
      desc: 'Toda poção causa 20% mais dano.',
    },
    quick: {
      name: 'Azougue',
      desc: 'Toda poção ataca 15% mais rápido.',
    },
    bulwark: {
      name: 'Argamassa',
      desc: 'A muralha ganha 40% mais vida e é toda reparada.',
    },
    bounty: {
      name: 'Folha de ouro',
      desc: 'Cada abate rende 2 de ouro a mais.',
    },
  },
  rebrew: {
    button: 'Rebrassar',
    count: 'Rebrassagens: {n}',
    essence: 'Essência: {n}',
    what: 'Despeje tudo de volta no caldeirão: a campanha recomeça na fase 1 e as poções no primeiro nível. Você mantém o códice, a maestria das reações, os talentos, as estrelas, os cristais e metade do laboratório, e ganha essência para bônus permanentes.',
    go: 'Rebrassar: +{n} essência',
    sure: 'Toque de novo para confirmar',
    locked: 'Conclua a fase {n} para rebrassar',
    done: 'Rebrassado! +{n} essência',
    perks: 'Bônus permanentes',
    perk: {
      reaction: 'Reações +{p}%',
      wall: 'Vida da muralha +{p}%',
      gold: 'Ouro inicial +{n}',
      crystals: 'Cristais +{p}%',
    },
  },
  week: {
    button: 'Semana',
    title: 'Esta semana',
    rule: 'Regra da torre: {name}',
    left: 'Nova semana em: {n} d',
    best: 'Melhor andar da semana: {n}',
    play: 'Subir',
    surge: {
      name: 'Onda',
      desc: 'Reações causam 2× dano; inimigos têm 30% mais vida.',
    },
    focus: {
      name: 'Foco',
      desc: '{name} causa 4× dano.',
    },
    glass: {
      name: 'Canhão de vidro',
      desc: 'Reações causam 2,5× dano; poções causam 20% menos.',
    },
    brittle: {
      name: 'Muralha frágil',
      desc: 'Reações causam 1,8× dano; a muralha tem 25% menos vida.',
    },
    task: {
      kinds: 'Provoque {n} reações diferentes',
      react: 'Provoque {n} reações',
      tower: 'Chegue ao andar {n} da torre',
      challenge: 'Jogue {n} desafios diários',
    },
  },
  next: {
    find: 'Ainda faltam {n} reações: teste novos pares!',
    week: 'Uma tarefa semanal está pronta',
    tower: 'Torre esta semana: {name}. Melhor andar {n}',
    rebrew: 'Campanha concluída: rebrasse por {n} essência',
    perk: 'Essência para gastar: {n}',
  },
};
