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
