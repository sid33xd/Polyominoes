import { cellKey, rotateCells, translateCells } from './geometry'
import type { LevelDefinition, PiecePlacement, Point } from './types'

export class PuzzleEngine {
  private readonly board = new Set<string>()
  private readonly placements = new Map<string, PiecePlacement>()
  private readonly level: LevelDefinition

  constructor(level: LevelDefinition) {
    this.level = level
    this.board = new Set(level.boardCells.map(cellKey))
  }

  getLevel(): LevelDefinition {
    return this.level
  }

  getPlacement(pieceId: string): PiecePlacement | null {
    const placement = this.placements.get(pieceId)
    return placement ? { anchor: { ...placement.anchor }, rotation: placement.rotation } : null
  }

  getPlacements(): Map<string, PiecePlacement> {
    return new Map(
      [...this.placements.entries()].map(([pieceId, placement]) => [
        pieceId,
        {
          anchor: { ...placement.anchor },
          rotation: placement.rotation,
        },
      ]),
    )
  }

  removePiece(pieceId: string): PiecePlacement | null {
    const placement = this.getPlacement(pieceId)

    if (placement) {
      this.placements.delete(pieceId)
    }

    return placement
  }

  reset(): void {
    this.placements.clear()
  }

  canPlacePiece(pieceId: string, anchor: Point, rotation: number): boolean {
    const piece = this.level.pieces.find((entry) => entry.id === pieceId)

    if (!piece) {
      return false
    }

    const trialCells = translateCells(rotateCells(piece.cells, rotation), anchor)
    const occupiedByOthers = new Set<string>()

    for (const [placedPieceId, placement] of this.placements.entries()) {
      if (placedPieceId === pieceId) {
        continue
      }

      const placedPiece = this.level.pieces.find((entry) => entry.id === placedPieceId)

      if (!placedPiece) {
        continue
      }

      for (const cell of translateCells(
        rotateCells(placedPiece.cells, placement.rotation),
        placement.anchor,
      )) {
        occupiedByOthers.add(cellKey(cell))
      }
    }

    return trialCells.every((cell) => this.board.has(cellKey(cell)) && !occupiedByOthers.has(cellKey(cell)))
  }

  placePiece(pieceId: string, anchor: Point, rotation: number): boolean {
    if (!this.canPlacePiece(pieceId, anchor, rotation)) {
      return false
    }

    this.placements.set(pieceId, {
      anchor: { ...anchor },
      rotation: ((rotation % 4) + 4) % 4,
    })

    return true
  }

  isSolved(): boolean {
    return this.placements.size === this.level.pieces.length
  }
}
