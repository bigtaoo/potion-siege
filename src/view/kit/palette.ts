// The workshop menus' colours: the dark woods and brass (P) and the light board (LIGHT).

export const P = {
  line: 0x24140a,
  wood: 0x5b3a22,
  woodDark: 0x3d2615,
  woodLight: 0x7a5233,
  brass: 0xd9a441,
  brassLight: 0xf7d77e,
  brassDark: 0x8f5c1d,
  paper: 0xf3e2bd,
  paperDark: 0xdcc08a,
  ink: 0x4a2c16,
  inkSoft: 0x765637,
  cream: 0xfff1d6,
  soft: 0xf0dcc0,
  red: 0xe5484d,
  /** Red words on the light board (a weakness, a warning): darker than `red` to read at 5:1. */
  redInk: 0xb23a2a,
  /** The one success green: a tick, a filled bar, a green button's face. */
  green: 0x4cc35a,
  /** Its shade: a green button's lip, a stem. */
  greenDark: 0x2b7c36,
  /** A switch or medal that is on. */
  greenOn: 0x3c9a4a,
  /** Green words on the light board (the next level, owned): 5.8:1 on the face. */
  greenInk: 0x2b6a33,
  /** Locked or not yet seen: the grey-brown of a closed card or padlock. */
  locked: 0x8a7d6a,
  /** The dark umber the battle's labels and the commander's badge are outlined in. */
  umber: 0x3e3128,
} as const;

/** The light board's colours: the cream face, its seams and the soft insets on it. */
export const LIGHT = {
  face: 0xf8f0de,
  seam: 0xebdfc6,
  inset: 0xe6dac2,
  insetEdge: 0xcbb994,
  tile: 0xeee3cc,
  tileLip: 0xd5c4a3,
  card: 0xf6eedb,
  cardLip: 0xe0d2b4,
  wall: 0xd8c6a2,
  wallAlt: 0xdecdab,
  wallSeam: 0xc2ab82,
  bar: 0xeadcbf,
  /** Outlines on the light surfaces: brown, softer than the black line. */
  edge: 0x6e4c2f,
  crystal: 0x1767ad,
} as const;
