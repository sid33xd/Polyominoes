import { normalizeCells, uniqueCells } from './geometry'
import type { LevelDefinition, PieceDefinition, Point } from './types'

type SeedPiece = Omit<PieceDefinition, 'cells'> & {
  absoluteCells: Point[]
}

type SeedLevel = {
  id: string
  title: string
  subtitle: string
  pieces: SeedPiece[]
}

const createLevel = (seed: SeedLevel): LevelDefinition => ({
  id: seed.id,
  title: seed.title,
  subtitle: seed.subtitle,
  boardCells: (() => {
    const boardCells = uniqueCells(seed.pieces.flatMap((piece) => piece.absoluteCells))
    const totalPieceCells = seed.pieces.reduce((sum, piece) => sum + piece.absoluteCells.length, 0)

    if (boardCells.length !== totalPieceCells) {
      throw new Error(
        `Level "${seed.id}" is invalid: board has ${boardCells.length} cells but pieces total ${totalPieceCells}.`,
      )
    }

    return boardCells
  })(),
  pieces: seed.pieces.map(({ absoluteCells, ...piece }) => ({
    ...piece,
    cells: normalizeCells(absoluteCells),
  })),
})

export const LEVELS: LevelDefinition[] = [
  createLevel({
    id: 'sunny-quilt',
    title: 'Sunny Quilt',
    subtitle: 'Fit every sleepy loaf onto the blanket.',
    pieces: [
      {
        id: 'biscuit',
        name: 'Biscuit',
        color: '#f7a072',
        accent: '#8a4b29',
        hint: 'A lanky cat that likes corner naps.',
        absoluteCells: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
      },
      {
        id: 'pebble',
        name: 'Pebble',
        color: '#9ad1d4',
        accent: '#326975',
        hint: 'Round and smug. Perfect square energy.',
        absoluteCells: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
      },
      {
        id: 'taffy',
        name: 'Taffy',
        color: '#f4c95d',
        accent: '#7c5a00',
        hint: 'Stretches one paw farther than necessary.',
        absoluteCells: [
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
      },
      {
        id: 'pudding',
        name: 'Pudding',
        color: '#f28fad',
        accent: '#843b57',
        hint: 'A whole row of blanket hogging.',
        absoluteCells: [
          { x: 0, y: 3 },
          { x: 1, y: 3 },
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
      },
    ],
  }),
  createLevel({
    id: 'window-seat',
    title: 'Window Seat',
    subtitle: 'A tighter stack with longer cats and fussier corners.',
    pieces: [
      {
        id: 'latte',
        name: 'Latte',
        color: '#f6b26b',
        accent: '#8d5421',
        hint: 'A warm stripe that loves the top edge.',
        absoluteCells: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
        ],
      },
      {
        id: 'momo',
        name: 'Momo',
        color: '#8fd6c3',
        accent: '#276e61',
        hint: 'Compact paws, tidy footprint.',
        absoluteCells: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
      },
      {
        id: 'yuzu',
        name: 'Yuzu',
        color: '#f4d35e',
        accent: '#856200',
        hint: 'Tall posture, curled tail.',
        absoluteCells: [
          { x: 2, y: 1 },
          { x: 2, y: 2 },
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
      },
      {
        id: 'clover',
        name: 'Clover',
        color: '#8ecae6',
        accent: '#245d78',
        hint: 'A neat little cuddle square.',
        absoluteCells: [
          { x: 3, y: 1 },
          { x: 4, y: 1 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
        ],
      },
      {
        id: 'mochi',
        name: 'Mochi',
        color: '#f9a1bc',
        accent: '#8f4460',
        hint: 'Lands softly in the lower left.',
        absoluteCells: [
          { x: 0, y: 3 },
          { x: 1, y: 3 },
          { x: 0, y: 4 },
          { x: 1, y: 4 },
        ],
      },
      {
        id: 'nori',
        name: 'Nori',
        color: '#b8a1e3',
        accent: '#533d80',
        hint: 'One back paw hangs off the ledge.',
        absoluteCells: [
          { x: 4, y: 3 },
          { x: 2, y: 4 },
          { x: 3, y: 4 },
          { x: 4, y: 4 },
        ],
      },
    ],
  }),
  createLevel({
    id: 'twilight-porch',
    title: 'Twilight Porch',
    subtitle: 'Two odd corners are missing. The cats still insist on fitting.',
    pieces: [
      {
        id: 'marmalade',
        name: 'Marmalade',
        color: '#f4a261',
        accent: '#8f4b20',
        hint: 'A sunbeam of a cat who claims the whole top row.',
        absoluteCells: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
          { x: 5, y: 0 },
        ],
      },
      {
        id: 'tofu',
        name: 'Tofu',
        color: '#9ad7cb',
        accent: '#2e6d61',
        hint: 'A square-ish curl by the left rail.',
        absoluteCells: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
      },
      {
        id: 'olive',
        name: 'Olive',
        color: '#a0c4ff',
        accent: '#315b8d',
        hint: 'Quietly takes the middle patch.',
        absoluteCells: [
          { x: 2, y: 1 },
          { x: 3, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
      },
      {
        id: 'juniper',
        name: 'Juniper',
        color: '#cdb4db',
        accent: '#644a76',
        hint: 'Always pairs up with the far-right post.',
        absoluteCells: [
          { x: 4, y: 1 },
          { x: 5, y: 1 },
          { x: 4, y: 2 },
          { x: 5, y: 2 },
        ],
      },
      {
        id: 'sable',
        name: 'Sable',
        color: '#f6bd60',
        accent: '#88610a',
        hint: 'A long low stretch across the porch floor.',
        absoluteCells: [
          { x: 0, y: 3 },
          { x: 1, y: 3 },
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
      },
      {
        id: 'maple',
        name: 'Maple',
        color: '#ffafcc',
        accent: '#8c5367',
        hint: 'Curves around the bottom-right corner.',
        absoluteCells: [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
          { x: 3, y: 4 },
          { x: 4, y: 4 },
        ],
      },
      {
        id: 'fig',
        name: 'Fig',
        color: '#84c69b',
        accent: '#2f6842',
        hint: 'Three tiny purrs on the lower edge.',
        absoluteCells: [
          { x: 0, y: 4 },
          { x: 1, y: 4 },
          { x: 2, y: 4 },
        ],
      },
    ],
  }),
]
