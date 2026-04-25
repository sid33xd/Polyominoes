import { PuzzleEngine } from './puzzle-engine'
import type {
  LevelDefinition,
  PiecePlacement,
  Point,
  PuzzleSnapshot,
} from './types'

type SnapshotListener = (snapshot: PuzzleSnapshot) => void

export class PuzzleController {
  private readonly listeners = new Set<SnapshotListener>()
  private readonly levels: LevelDefinition[]
  private levelIndex = 0
  private engine: PuzzleEngine
  private pieceRotations = new Map<string, number>()
  private selectedPieceId: string | null = null

  constructor(levels: LevelDefinition[]) {
    this.levels = levels
    this.engine = new PuzzleEngine(levels[0])
    this.seedRotations()
    this.selectedPieceId = levels[0]?.pieces[0]?.id ?? null
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): PuzzleSnapshot {
    const level = this.engine.getLevel()
    const placements = this.engine.getPlacements()

    return {
      level,
      levelIndex: this.levelIndex,
      levelCount: this.levels.length,
      pieces: level.pieces.map((piece) => {
        const placement = placements.get(piece.id) ?? null

        return {
          ...piece,
          rotation: this.getPieceRotation(piece.id),
          placed: placement !== null,
          placement,
        }
      }),
      selectedPieceId: this.selectedPieceId,
      solved: this.engine.isSolved(),
      placedCount: placements.size,
      totalPieces: level.pieces.length,
    }
  }

  getPieceRotation(pieceId: string): number {
    return this.pieceRotations.get(pieceId) ?? 0
  }

  getPlacement(pieceId: string): PiecePlacement | null {
    return this.engine.getPlacement(pieceId)
  }

  canPlacePiece(pieceId: string, anchor: Point, rotation = this.getPieceRotation(pieceId)): boolean {
    return this.engine.canPlacePiece(pieceId, anchor, rotation)
  }

  selectPiece(pieceId: string | null): void {
    this.selectedPieceId = pieceId
    this.emit()
  }

  rotateSelectedPiece(): boolean {
    if (!this.selectedPieceId) {
      return false
    }

    const pieceId = this.selectedPieceId
    const nextRotation = (this.getPieceRotation(pieceId) + 1) % 4
    const placement = this.engine.getPlacement(pieceId)

    if (!placement) {
      this.pieceRotations.set(pieceId, nextRotation)
      this.emit()
      return true
    }

    this.engine.removePiece(pieceId)

    if (this.engine.placePiece(pieceId, placement.anchor, nextRotation)) {
      this.pieceRotations.set(pieceId, nextRotation)
      this.emit()
      return true
    }

    this.engine.placePiece(pieceId, placement.anchor, placement.rotation)
    this.emit()
    return false
  }

  liftPiece(pieceId: string): PiecePlacement | null {
    const placement = this.engine.removePiece(pieceId)

    if (placement) {
      this.pieceRotations.set(pieceId, placement.rotation)
      this.emit()
    }

    return placement
  }

  placePiece(pieceId: string, anchor: Point, rotation = this.getPieceRotation(pieceId)): boolean {
    const normalizedRotation = ((rotation % 4) + 4) % 4
    const placed = this.engine.placePiece(pieceId, anchor, normalizedRotation)

    if (placed) {
      this.pieceRotations.set(pieceId, normalizedRotation)
      this.selectedPieceId = pieceId
    }

    this.emit()
    return placed
  }

  resetLevel(): void {
    this.engine.reset()
    this.seedRotations()
    this.selectedPieceId = this.engine.getLevel().pieces[0]?.id ?? null
    this.emit()
  }

  advanceOrLoop(): void {
    if (this.levelIndex < this.levels.length - 1) {
      this.levelIndex += 1
      this.engine = new PuzzleEngine(this.levels[this.levelIndex])
      this.seedRotations()
      this.selectedPieceId = this.engine.getLevel().pieces[0]?.id ?? null
      this.emit()
      return
    }

    this.levelIndex = 0
    this.engine = new PuzzleEngine(this.levels[this.levelIndex])
    this.seedRotations()
    this.selectedPieceId = this.engine.getLevel().pieces[0]?.id ?? null
    this.emit()
  }

  private seedRotations(): void {
    this.pieceRotations = new Map(
      this.engine.getLevel().pieces.map((piece, index) => [piece.id, (this.levelIndex + index) % 4]),
    )
  }

  private emit(): void {
    const snapshot = this.getSnapshot()

    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
