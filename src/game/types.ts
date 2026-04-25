export type Point = {
  x: number
  y: number
}

export type PiecePlacement = {
  anchor: Point
  rotation: number
}

export type PieceDefinition = {
  id: string
  name: string
  color: string
  accent: string
  hint: string
  cells: Point[]
}

export type LevelDefinition = {
  id: string
  title: string
  subtitle: string
  boardCells: Point[]
  pieces: PieceDefinition[]
}

export type PieceSnapshot = PieceDefinition & {
  rotation: number
  placed: boolean
  placement: PiecePlacement | null
}

export type PuzzleSnapshot = {
  level: LevelDefinition
  levelIndex: number
  levelCount: number
  pieces: PieceSnapshot[]
  selectedPieceId: string | null
  solved: boolean
  placedCount: number
  totalPieces: number
}
