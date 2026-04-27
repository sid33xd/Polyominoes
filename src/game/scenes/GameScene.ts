import * as Phaser from 'phaser'
import { getBounds, rotateCells, translateCells } from '../geometry'
import type { PuzzleController } from '../controller'
import type {
  LevelDefinition,
  PieceSnapshot,
  Point,
  PuzzleSnapshot,
} from '../types'

type CarryState = {
  pieceId: string
  pointerId: number
  rotatingPointerId: number | null
  pointerX: number
  pointerY: number
  grabOffsetX: number
  grabOffsetY: number
  grabbedCell: Point
  cellOffsetX: number
  cellOffsetY: number
}

type PieceView = {
  container: Phaser.GameObjects.Container
  highlight: Phaser.GameObjects.Graphics
  body: Phaser.GameObjects.Container
  hitLayer: Phaser.GameObjects.Container
}

type RectLike = {
  x: number
  y: number
  width: number
  height: number
}

export class GameScene extends Phaser.Scene {
  private readonly controller: PuzzleController
  private unsubscribe: (() => void) | null = null
  private snapshot: PuzzleSnapshot | null = null
  private backgroundGraphic!: Phaser.GameObjects.Graphics
  private boardGlow!: Phaser.GameObjects.Graphics
  private boardCells!: Phaser.GameObjects.Graphics
  private placementPreview!: Phaser.GameObjects.Graphics
  private pieceLayer!: Phaser.GameObjects.Container
  private boardOrigin = new Phaser.Math.Vector2(0, 0)
  private boardRect = new Phaser.Geom.Rectangle()
  private cellSize = 72
  private trayPieceScale = 0.9
  private pieceViews = new Map<string, PieceView>()
  private carryState: CarryState | null = null
  private unplacedPositions = new Map<string, Point>()
  private lastTapByPiece = new Map<string, number>()
  private rotatedTouchIdentifiers = new Set<number>()
  private lastCarryRotateAt = -Infinity
  private lastCelebratedLevelId: string | null = null
  private topClearance = 120
  private bottomClearance = 32
  private readonly handleNativeTouchStart = (event: TouchEvent): void => {
    if (!this.carryState || event.touches.length < 2 || event.changedTouches.length === 0) {
      return
    }

    const touch = event.changedTouches[0]

    if (this.rotatedTouchIdentifiers.has(touch.identifier)) {
      return
    }

    this.rotatedTouchIdentifiers.add(touch.identifier)
    this.rotateCarriedPiece()
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  private readonly handleNativeTouchEnd = (event: TouchEvent): void => {
    for (const touch of event.changedTouches) {
      this.rotatedTouchIdentifiers.delete(touch.identifier)
    }
  }

  constructor(controller: PuzzleController) {
    super('whisker-fit')
    this.controller = controller
  }

  create(): void {
    this.backgroundGraphic = this.add.graphics()
    this.backgroundGraphic.setDepth(0)
    this.boardGlow = this.add.graphics()
    this.boardGlow.setDepth(1)
    this.boardCells = this.add.graphics()
    this.boardCells.setDepth(2)
    this.placementPreview = this.add.graphics()
    this.placementPreview.setDepth(3)
    this.pieceLayer = this.add.container(0, 0)
    this.pieceLayer.setDepth(10)

    this.input.on('pointerdown', this.handlePointerDown, this)
    this.input.on('pointermove', this.handlePointerMove, this)
    this.input.on('pointerup', this.handlePointerUp, this)
    this.input.on('pointerupoutside', this.handlePointerUp, this)
    this.scale.on('resize', this.handleResize, this)
    this.input.addPointer(Math.max(0, 3 - this.input.manager.pointersTotal))
    this.game.canvas.addEventListener('touchstart', this.handleNativeTouchStart, {
      passive: false,
    })
    this.game.canvas.addEventListener('touchend', this.handleNativeTouchEnd)
    this.game.canvas.addEventListener('touchcancel', this.handleNativeTouchEnd)
    this.input.mouse?.disableContextMenu()

    this.unsubscribe = this.controller.subscribe((snapshot) => {
      this.receiveSnapshot(snapshot)
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.()
      this.input.off('pointerdown', this.handlePointerDown, this)
      this.input.off('pointermove', this.handlePointerMove, this)
      this.input.off('pointerup', this.handlePointerUp, this)
      this.input.off('pointerupoutside', this.handlePointerUp, this)
      this.scale.off('resize', this.handleResize, this)
      this.game.canvas.removeEventListener('touchstart', this.handleNativeTouchStart)
      this.game.canvas.removeEventListener('touchend', this.handleNativeTouchEnd)
      this.game.canvas.removeEventListener('touchcancel', this.handleNativeTouchEnd)
    })
  }

  private receiveSnapshot(snapshot: PuzzleSnapshot): void {
    const levelChanged = this.snapshot?.level.id !== snapshot.level.id
    const firstSnapshot = this.snapshot === null
    const becameSolved = snapshot.solved && !this.snapshot?.solved

    this.snapshot = snapshot

    if (firstSnapshot || levelChanged) {
      this.buildLevel(snapshot.level)
    }

    this.layoutLevel()
    this.syncPieceViews()

    if (becameSolved && this.lastCelebratedLevelId !== snapshot.level.id) {
      this.lastCelebratedLevelId = snapshot.level.id
      this.celebrateSolvedBoard()
    }

    if (!snapshot.solved) {
      this.lastCelebratedLevelId = null
    }
  }

  private buildLevel(level: LevelDefinition): void {
    this.carryState = null
    this.unplacedPositions.clear()
    this.pieceLayer.removeAll(true)
    this.backgroundGraphic.clear()
    this.boardGlow.clear()
    this.boardCells.clear()
    this.placementPreview.clear()
    this.pieceViews.clear()

    this.paintBackgroundDust()

    for (const piece of level.pieces) {
      const container = this.add.container(0, 0)
      const highlight = this.add.graphics()
      const body = this.add.container(0, 0)
      const hitLayer = this.add.container(0, 0)
      container.add([highlight, body, hitLayer])

      const pieceView: PieceView = { container, highlight, body, hitLayer }
      this.configurePieceInteractivity(pieceView)
      this.pieceLayer.add(container)
      this.pieceViews.set(piece.id, pieceView)
    }
  }

  private paintBackgroundDust(): void {
    this.backgroundGraphic.clear()
    this.backgroundGraphic.fillStyle(0xfdf7ed, 1)
    this.backgroundGraphic.fillRect(0, 0, this.scale.width, this.scale.height)

    for (let index = 0; index < 18; index += 1) {
      const tint = [0xf6d59d, 0xf3c9d9, 0xbde0d8, 0xbad7ff][index % 4]
      this.backgroundGraphic.fillStyle(tint, 0.12)
      this.backgroundGraphic.fillCircle(
        Phaser.Math.Between(60, Math.max(61, this.scale.width - 60)),
        Phaser.Math.Between(60, Math.max(61, this.scale.height - 60)),
        Phaser.Math.Between(18, 34),
      )
    }
  }

  private configurePieceInteractivity(pieceView: PieceView): void {
    pieceView.container.on('destroy', () => {
      pieceView.container.removeAllListeners()
    })
  }

  private startCarryingPiece(
    pieceId: string,
    cell: Point,
    zoneX: number,
    zoneY: number,
    pointer: Phaser.Input.Pointer,
  ): void {
    if (this.carryState) {
      return
    }

    const pieceView = this.pieceViews.get(pieceId)

    if (!pieceView) {
      return
    }

    this.carryState = {
      pieceId,
      pointerId: pointer.id,
      rotatingPointerId: null,
      pointerX: pointer.worldX,
      pointerY: pointer.worldY,
      grabOffsetX: pointer.worldX - pieceView.container.x,
      grabOffsetY: pointer.worldY - pieceView.container.y,
      grabbedCell: { ...cell },
      cellOffsetX: pointer.worldX - (pieceView.container.x + zoneX),
      cellOffsetY: pointer.worldY - (pieceView.container.y + zoneY),
    }

    this.controller.selectPiece(pieceId)
    this.controller.liftPiece(pieceId)
    this.syncPieceViews()
  }

  private layoutLevel(): void {
    if (!this.snapshot) {
      return
    }

    const level = this.snapshot.level
    const boardBounds = getBounds(level.boardCells)
    const width = this.scale.width
    const height = this.scale.height
    const isPhonePortrait = width <= 700 && height > width
    const outerPadding = 24
    const centerGap = isPhonePortrait ? 10 : 18
    const topHudWidth = 228
    const controlWidth = 298
    const sideLaneWidth = isPhonePortrait
      ? Math.max(72, Math.min(104, (width - outerPadding * 2 - 48 * boardBounds.width) / 2))
      : Math.max(110, (width - topHudWidth - controlWidth - centerGap * 4) * 0.24)
    const boardArea = isPhonePortrait
      ? {
          x: outerPadding + sideLaneWidth + centerGap,
          y: this.topClearance + Math.max(60, height * 0.14),
          width: width - outerPadding * 2 - sideLaneWidth * 2 - centerGap * 2,
          height: Math.min(height * 0.52, height - this.topClearance - this.bottomClearance),
        }
      : {
          x: outerPadding + sideLaneWidth + centerGap,
          y: this.topClearance,
          width: width - outerPadding * 2 - sideLaneWidth * 2 - centerGap * 2,
          height: height - this.topClearance - this.bottomClearance,
        }

    const mobileCell = Math.floor(
      Math.min(
        boardArea.width / boardBounds.width,
        boardArea.height / (boardBounds.height + 1.2),
        54,
      ),
    )
    this.cellSize = isPhonePortrait
      ? Math.max(44, mobileCell)
      : Math.floor(
          Math.min(
            boardArea.width / (boardBounds.width + 0.9),
            boardArea.height / (boardBounds.height + 1.2),
            94,
          ),
        )
    this.trayPieceScale = 0.9

    const boardPixelWidth = boardBounds.width * this.cellSize
    const boardPixelHeight = boardBounds.height * this.cellSize

    this.boardOrigin.set(
      boardArea.x + (boardArea.width - boardPixelWidth) / 2,
      boardArea.y + (boardArea.height - boardPixelHeight) / 2,
    )

    this.boardRect.setTo(this.boardOrigin.x, this.boardOrigin.y, boardPixelWidth, boardPixelHeight)
    document.documentElement.style.setProperty('--board-left', `${this.boardRect.x}px`)
    document.documentElement.style.setProperty('--board-top', `${this.boardRect.y}px`)
    document.documentElement.style.setProperty('--board-width', `${this.boardRect.width}px`)
    document.documentElement.style.setProperty('--board-height', `${this.boardRect.height}px`)

    this.drawBoard(level)
    this.seedDefaultUnplacedPositions()
    this.drawPlacementPreview()
  }

  private drawBoard(level: LevelDefinition): void {
    this.boardGlow.clear()
    this.boardCells.clear()

    for (const cell of level.boardCells) {
      const x = this.boardOrigin.x + cell.x * this.cellSize
      const y = this.boardOrigin.y + cell.y * this.cellSize
      const radius = this.cellSize * 0.24

      this.boardGlow.fillStyle(0xca9f45, 0.08)
      this.boardGlow.fillRoundedRect(
        x + this.cellSize * 0.08,
        y + this.cellSize * 0.14,
        this.cellSize * 0.84,
        this.cellSize * 0.76,
        radius,
      )

      this.boardCells.fillStyle(0xfff7ea, 0.95)
      this.boardCells.fillRoundedRect(
        x,
        y + this.cellSize * 0.06,
        this.cellSize * 0.88,
        this.cellSize * 0.78,
        radius,
      )
      this.boardCells.fillTriangle(
        x + this.cellSize * 0.16,
        y + this.cellSize * 0.2,
        x + this.cellSize * 0.3,
        y,
        x + this.cellSize * 0.42,
        y + this.cellSize * 0.2,
      )
      this.boardCells.fillTriangle(
        x + this.cellSize * 0.46,
        y + this.cellSize * 0.2,
        x + this.cellSize * 0.6,
        y,
        x + this.cellSize * 0.72,
        y + this.cellSize * 0.2,
      )
      this.boardCells.lineStyle(Math.max(2, this.cellSize * 0.035), 0xd3b071, 0.8)
      this.boardCells.strokeRoundedRect(
        x,
        y + this.cellSize * 0.06,
        this.cellSize * 0.88,
        this.cellSize * 0.78,
        radius,
      )
    }
  }

  private seedDefaultUnplacedPositions(): void {
    if (!this.snapshot) {
      return
    }

    const isPhonePortrait = this.scale.width <= 700 && this.scale.height > this.scale.width
    const leftX = isPhonePortrait ? 10 : 24
    const leftArea = {
      x: leftX,
      y: this.boardRect.y + 12,
      width: isPhonePortrait ? Math.max(48, this.boardRect.x - leftX - 10) : Math.max(120, this.boardRect.x - 48),
      height: this.boardRect.height - 24,
    }
    const rightArea = {
      x: this.boardRect.right + (isPhonePortrait ? 10 : 20),
      y: this.boardRect.y + 12,
      width: isPhonePortrait
        ? Math.max(48, this.scale.width - this.boardRect.right - 20)
        : Math.max(120, this.scale.width - this.boardRect.right - 44),
      height: this.boardRect.height - 24,
    }

    const leftPieces = this.snapshot.pieces.filter((_, index) => index % 2 === 0)
    const rightPieces = this.snapshot.pieces.filter((_, index) => index % 2 === 1)

    const overflowPieces = [
      ...this.assignAreaSlots(leftPieces, leftArea),
      ...this.assignAreaSlots(rightPieces, rightArea),
    ]

    this.assignHorizontalFallbackSlots(overflowPieces)
  }

  private assignAreaSlots(pieces: PieceSnapshot[], area: RectLike): PieceSnapshot[] {
    let cursorY = area.y
    const overflowPieces: PieceSnapshot[] = []

    for (const piece of pieces) {
      if (this.controller.getPlacement(piece.id) || this.unplacedPositions.has(piece.id)) {
        continue
      }

      const bounds = this.getScaledPieceBounds(piece)
      const fitsWidth = bounds.width <= area.width
      const fitsHeight = cursorY + bounds.height <= area.y + area.height

      if (!fitsWidth || !fitsHeight) {
        overflowPieces.push(piece)
        continue
      }

      const x = Phaser.Math.Clamp(
        area.x + Math.max(0, (area.width - bounds.width) / 2),
        area.x,
        Math.max(area.x, area.x + area.width - bounds.width),
      )
      this.unplacedPositions.set(piece.id, {
        x,
        y: cursorY,
      })
      cursorY += bounds.height + 18
    }

    return overflowPieces
  }

  private assignHorizontalFallbackSlots(pieces: PieceSnapshot[]): void {
    if (pieces.length === 0) {
      return
    }

    const margin = 14
    const topArea = {
      x: margin,
      y: this.topClearance,
      width: this.scale.width - margin * 2,
      height: Math.max(0, this.boardRect.top - this.topClearance - margin),
    }
    const bottomArea = {
      x: margin,
      y: this.boardRect.bottom + margin,
      width: this.scale.width - margin * 2,
      height: Math.max(0, this.scale.height - this.boardRect.bottom - this.bottomClearance - margin),
    }
    const remainingPieces = this.assignHorizontalAreaSlots(pieces, topArea)
    const finalOverflowPieces = this.assignHorizontalAreaSlots(remainingPieces, bottomArea)

    this.assignForcedVisibleSlots(finalOverflowPieces)
  }

  private assignHorizontalAreaSlots(pieces: PieceSnapshot[], area: RectLike): PieceSnapshot[] {
    let cursorX = area.x
    let cursorY = area.y
    let rowHeight = 0
    const overflowPieces: PieceSnapshot[] = []

    for (const piece of pieces) {
      if (this.controller.getPlacement(piece.id) || this.unplacedPositions.has(piece.id)) {
        continue
      }

      const bounds = this.getScaledPieceBounds(piece)

      if (bounds.width > area.width || bounds.height > area.height) {
        overflowPieces.push(piece)
        continue
      }

      if (cursorX > area.x && cursorX + bounds.width > area.x + area.width) {
        cursorX = area.x
        cursorY += rowHeight + 14
        rowHeight = 0
      }

      if (cursorY + bounds.height > area.y + area.height) {
        overflowPieces.push(piece)
        continue
      }

      this.unplacedPositions.set(piece.id, {
        x: cursorX,
        y: cursorY,
      })
      cursorX += bounds.width + 14
      rowHeight = Math.max(rowHeight, bounds.height)
    }

    return overflowPieces
  }

  private assignForcedVisibleSlots(pieces: PieceSnapshot[]): void {
    let cursorY = this.boardRect.bottom + 12

    for (const piece of pieces) {
      if (this.controller.getPlacement(piece.id) || this.unplacedPositions.has(piece.id)) {
        continue
      }

      const bounds = this.getScaledPieceBounds(piece)
      this.unplacedPositions.set(piece.id, {
        x: Phaser.Math.Clamp(14, 14, Math.max(14, this.scale.width - bounds.width - 14)),
        y: Phaser.Math.Clamp(
          cursorY,
          this.topClearance,
          Math.max(this.topClearance, this.scale.height - bounds.height - this.bottomClearance),
        ),
      })
      cursorY += bounds.height + 14
    }
  }

  private syncPieceViews(): void {
    if (!this.snapshot) {
      return
    }

    for (const piece of this.snapshot.pieces) {
      const pieceView = this.pieceViews.get(piece.id)

      if (!pieceView) {
        continue
      }

      this.rebuildPieceVisual(piece, pieceView)

      if (this.carryState?.pieceId === piece.id) {
        this.positionCarriedPiece(pieceView)
        continue
      }

      const placement = this.controller.getPlacement(piece.id)
      const target = placement
        ? this.getBoardPosition(placement.anchor)
        : this.unplacedPositions.get(piece.id) ?? { x: 0, y: 0 }

      pieceView.container.setPosition(target.x, target.y)
      pieceView.container.setScale(placement ? 1 : this.trayPieceScale)
      pieceView.container.setDepth(piece.id === this.snapshot.selectedPieceId ? 14 : 10)
      pieceView.container.alpha = 1
      pieceView.highlight.setAlpha(piece.id === this.snapshot.selectedPieceId ? 0.9 : 0.24)
    }

    this.drawPlacementPreview()
  }

  private rebuildPieceVisual(piece: PieceSnapshot, pieceView: PieceView): void {
    const cells = rotateCells(piece.cells, piece.rotation)
    const bounds = getBounds(cells)
    const width = bounds.width * this.cellSize
    const height = bounds.height * this.cellSize

    pieceView.body.removeAll(true)
    pieceView.hitLayer.removeAll(true)
    pieceView.highlight.clear()

    pieceView.highlight.fillStyle(0xffffff, 0.34)

    for (const cell of cells) {
      const x = cell.x * this.cellSize
      const y = cell.y * this.cellSize
      pieceView.highlight.fillRoundedRect(
        x - this.cellSize * 0.03,
        y + this.cellSize * 0.01,
        this.cellSize * 0.94,
        this.cellSize * 0.84,
        this.cellSize * 0.25,
      )
      pieceView.body.add(this.drawCatTile(piece, x, y))
      pieceView.hitLayer.add(this.drawHitZone(piece.id, cell, x, y))
    }
    pieceView.container.setSize(width, height)
  }

  private drawCatTile(piece: PieceSnapshot, x: number, y: number): Phaser.GameObjects.Container {
    const tile = this.add.container(x, y)
    const shadow = this.add.graphics()
    const body = this.add.graphics()
    const face = this.add.graphics()
    const size = this.cellSize

    shadow.fillStyle(0x5c4331, 0.16)
    shadow.fillRoundedRect(size * 0.08, size * 0.15, size * 0.78, size * 0.68, size * 0.22)

    body.fillStyle(Phaser.Display.Color.HexStringToColor(piece.color).color, 1)
    body.fillRoundedRect(0, size * 0.04, size * 0.82, size * 0.7, size * 0.22)
    body.fillTriangle(size * 0.12, size * 0.18, size * 0.26, 0, size * 0.36, size * 0.18)
    body.fillTriangle(size * 0.46, size * 0.18, size * 0.58, 0, size * 0.72, size * 0.18)
    body.lineStyle(Math.max(2, size * 0.03), Phaser.Display.Color.HexStringToColor(piece.accent).color, 0.86)
    body.strokeRoundedRect(0, size * 0.04, size * 0.82, size * 0.7, size * 0.22)

    face.lineStyle(Math.max(2, size * 0.028), Phaser.Display.Color.HexStringToColor(piece.accent).color, 0.92)
    face.beginPath()
    face.moveTo(size * 0.24, size * 0.34)
    face.lineTo(size * 0.3, size * 0.34)
    face.moveTo(size * 0.48, size * 0.34)
    face.lineTo(size * 0.54, size * 0.34)
    face.moveTo(size * 0.39, size * 0.4)
    face.lineTo(size * 0.36, size * 0.46)
    face.lineTo(size * 0.42, size * 0.46)
    face.lineTo(size * 0.39, size * 0.4)
    face.moveTo(size * 0.24, size * 0.48)
    face.lineTo(size * 0.34, size * 0.5)
    face.moveTo(size * 0.44, size * 0.5)
    face.lineTo(size * 0.54, size * 0.48)
    face.strokePath()

    tile.add([shadow, body, face])
    return tile
  }

  private drawHitZone(pieceId: string, cell: Point, x: number, y: number): Phaser.GameObjects.Zone {
    const zone = this.add.zone(
      x,
      y + this.cellSize * 0.04,
      this.cellSize * 0.82,
      this.cellSize * 0.7,
    )
    zone.setOrigin(0, 0)
    zone.setInteractive({ useHandCursor: true })
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.snapshot || pointer.rightButtonDown()) {
        return
      }

      if (this.carryState && this.carryState.pieceId !== pieceId) {
        return
      }

      const now = this.time.now
      const lastTap = this.lastTapByPiece.get(pieceId) ?? -Infinity

      if (!this.carryState && now - lastTap < 280) {
        this.controller.selectPiece(pieceId)
        this.controller.rotateSelectedPiece()
        this.lastTapByPiece.delete(pieceId)
        return
      }

      this.lastTapByPiece.set(pieceId, now)
      this.startCarryingPiece(pieceId, cell, x, y + this.cellSize * 0.04, pointer)
    })
    return zone
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.carryState && pointer.id !== this.carryState.pointerId && !pointer.rightButtonDown()) {
      this.carryState.rotatingPointerId = pointer.id
      this.rotateCarriedPiece()
      return
    }

    if (!this.carryState || pointer.id !== this.carryState.pointerId || !pointer.rightButtonDown()) {
      return
    }

    this.carryState.pointerX = pointer.worldX
    this.carryState.pointerY = pointer.worldY
    this.rotateCarriedPiece()
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.carryState || pointer.id !== this.carryState.pointerId) {
      return
    }

    this.carryState.pointerX = pointer.worldX
    this.carryState.pointerY = pointer.worldY

    const piece = this.snapshot?.pieces.find((entry) => entry.id === this.carryState?.pieceId)
    const pieceView = this.pieceViews.get(this.carryState.pieceId)

    if (!piece || !pieceView) {
      return
    }

    this.positionCarriedPiece(pieceView)
    this.drawPlacementPreview()
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.carryState?.rotatingPointerId === pointer.id) {
      this.carryState.rotatingPointerId = null
      return
    }

    if (!this.carryState || pointer.id !== this.carryState.pointerId || !this.snapshot) {
      return
    }

    if (!pointer.leftButtonReleased() && pointer.button !== 0) {
      return
    }

    const carriedPieceId = this.carryState.pieceId
    const carriedPiece = this.snapshot.pieces.find((piece) => piece.id === carriedPieceId)

    if (!carriedPiece) {
      this.carryState = null
      this.drawPlacementPreview()
      return
    }

    this.carryState.pointerX = pointer.worldX
    this.carryState.pointerY = pointer.worldY

    const preview = this.getPlacementPreviewForPiece(carriedPiece)

    if (preview) {
      this.unplacedPositions.delete(carriedPieceId)
      this.carryState = null
      this.controller.placePiece(carriedPieceId, preview.anchor)
      return
    }

    const dropPosition = this.getDropOutsidePosition(carriedPiece)
    this.unplacedPositions.set(carriedPieceId, dropPosition)
    this.carryState = null
    this.controller.selectPiece(carriedPieceId)
    this.syncPieceViews()
  }

  private positionCarriedPiece(pieceView: PieceView): void {
    if (!this.carryState) {
      return
    }

    pieceView.container.setPosition(
      this.carryState.pointerX - this.carryState.grabOffsetX,
      this.carryState.pointerY - this.carryState.grabOffsetY,
    )
    pieceView.container.setScale(this.trayPieceScale)
    pieceView.container.setDepth(60)
    pieceView.highlight.setAlpha(1)
  }

  private getPlacementPreviewForPiece(piece: PieceSnapshot): null | { anchor: Point; cells: Point[] } {
    if (!this.carryState) {
      return null
    }

    const topLeft = this.getCurrentCarriedTopLeft(piece)
    const rotatedCells = rotateCells(piece.cells, piece.rotation)
    const anchor = {
      x: Math.round((topLeft.x - this.boardOrigin.x) / this.cellSize),
      y: Math.round((topLeft.y - this.boardOrigin.y) / this.cellSize),
    }

    if (!this.controller.canPlacePiece(piece.id, anchor, piece.rotation)) {
      return null
    }

    return {
      anchor,
      cells: translateCells(rotatedCells, anchor),
    }
  }

  private drawPlacementPreview(): void {
    this.placementPreview.clear()

    if (!this.snapshot || !this.carryState) {
      return
    }

    const piece = this.snapshot.pieces.find((entry) => entry.id === this.carryState?.pieceId)

    if (!piece) {
      return
    }

    const preview = this.getPlacementPreviewForPiece(piece)

    if (!preview) {
      return
    }

    for (const cell of preview.cells) {
      const x = this.boardOrigin.x + cell.x * this.cellSize
      const y = this.boardOrigin.y + cell.y * this.cellSize
      const radius = this.cellSize * 0.22

      this.placementPreview.fillStyle(0x8f9399, 0.32)
      this.placementPreview.fillRoundedRect(
        x + this.cellSize * 0.05,
        y + this.cellSize * 0.1,
        this.cellSize * 0.78,
        this.cellSize * 0.66,
        radius,
      )
      this.placementPreview.lineStyle(Math.max(2, this.cellSize * 0.03), 0x6f7378, 0.5)
      this.placementPreview.strokeRoundedRect(
        x + this.cellSize * 0.05,
        y + this.cellSize * 0.1,
        this.cellSize * 0.78,
        this.cellSize * 0.66,
        radius,
      )
    }
  }

  private getDropOutsidePosition(piece: PieceSnapshot): Point {
    const topLeft = this.getCurrentCarriedTopLeft(piece)
    const scaledBounds = this.getScaledPieceBounds(piece)
    const pointerInsideBoard = Phaser.Geom.Rectangle.Contains(
      this.boardRect,
      this.carryState?.pointerX ?? topLeft.x,
      this.carryState?.pointerY ?? topLeft.y,
    )
    const pieceRect = new Phaser.Geom.Rectangle(topLeft.x, topLeft.y, scaledBounds.width, scaledBounds.height)

    if (!pointerInsideBoard && !Phaser.Geom.Rectangle.Overlaps(this.boardRect, pieceRect)) {
      return this.clampFreePosition(topLeft, scaledBounds)
    }

    const distances = [
      { edge: 'left', value: Math.abs((this.carryState?.pointerX ?? 0) - this.boardRect.left) },
      { edge: 'right', value: Math.abs((this.carryState?.pointerX ?? 0) - this.boardRect.right) },
      { edge: 'top', value: Math.abs((this.carryState?.pointerY ?? 0) - this.boardRect.top) },
      { edge: 'bottom', value: Math.abs((this.carryState?.pointerY ?? 0) - this.boardRect.bottom) },
    ].sort((left, right) => left.value - right.value)

    const margin = 18
    const nearest = distances[0]?.edge ?? 'left'

    if (nearest === 'left') {
      return this.clampFreePosition(
        {
          x: this.boardRect.left - scaledBounds.width - margin,
          y: topLeft.y,
        },
        scaledBounds,
      )
    }

    if (nearest === 'right') {
      return this.clampFreePosition(
        {
          x: this.boardRect.right + margin,
          y: topLeft.y,
        },
        scaledBounds,
      )
    }

    if (nearest === 'top') {
      return this.clampFreePosition(
        {
          x: topLeft.x,
          y: this.boardRect.top - scaledBounds.height - margin,
        },
        scaledBounds,
      )
    }

    return this.clampFreePosition(
      {
        x: topLeft.x,
        y: this.boardRect.bottom + margin,
      },
      scaledBounds,
    )
  }

  private clampFreePosition(position: Point, bounds: { width: number; height: number }): Point {
    return {
      x: Phaser.Math.Clamp(position.x, 18, Math.max(18, this.scale.width - bounds.width - 18)),
      y: Phaser.Math.Clamp(
        position.y,
        this.topClearance,
        Math.max(this.topClearance, this.scale.height - bounds.height - this.bottomClearance),
      ),
    }
  }

  private getScaledPieceBounds(piece: PieceSnapshot): { width: number; height: number } {
    const rotatedCells = rotateCells(piece.cells, piece.rotation)
    const bounds = getBounds(rotatedCells)

    return {
      width: bounds.width * this.cellSize * this.trayPieceScale,
      height: bounds.height * this.cellSize * this.trayPieceScale,
    }
  }

  private getCurrentCarriedTopLeft(piece: PieceSnapshot): Point {
    const bounds = this.getScaledPieceBounds(piece)
    const topLeft = {
      x: (this.carryState?.pointerX ?? 0) - (this.carryState?.grabOffsetX ?? bounds.width / 2),
      y: (this.carryState?.pointerY ?? 0) - (this.carryState?.grabOffsetY ?? bounds.height / 2),
    }

    return topLeft
  }

  private getBoardPosition(anchor: Point): Point {
    return {
      x: this.boardOrigin.x + anchor.x * this.cellSize,
      y: this.boardOrigin.y + anchor.y * this.cellSize,
    }
  }

  private rotateCarriedPiece(): boolean {
    if (!this.carryState || !this.snapshot || this.time.now - this.lastCarryRotateAt < 80) {
      return false
    }

    const piece = this.snapshot.pieces.find((entry) => entry.id === this.carryState?.pieceId)

    if (!piece) {
      return false
    }

    this.lastCarryRotateAt = this.time.now
    this.rotateCarryGrabOffset(piece)
    this.controller.rotateSelectedPiece()
    this.syncPieceViews()
    return true
  }

  private rotateCarryGrabOffset(piece: PieceSnapshot): void {
    if (!this.carryState) {
      return
    }

    const currentCells = rotateCells(piece.cells, piece.rotation)
    const bounds = getBounds(currentCells)
    const rotatedCell = {
      x: this.carryState.grabbedCell.y,
      y: bounds.width - 1 - this.carryState.grabbedCell.x,
    }
    const zoneX = rotatedCell.x * this.cellSize
    const zoneY = rotatedCell.y * this.cellSize + this.cellSize * 0.04

    this.carryState.grabbedCell = rotatedCell
    this.carryState.grabOffsetX = zoneX + this.carryState.cellOffsetX
    this.carryState.grabOffsetY = zoneY + this.carryState.cellOffsetY
  }

  private celebrateSolvedBoard(): void {
    const sparklePalette = [0xf6bd60, 0xf7a072, 0x84c69b, 0xa0c4ff, 0xf9a1bc]

    for (let index = 0; index < 20; index += 1) {
      const puff = this.add.circle(
        this.boardOrigin.x + Phaser.Math.Between(20, Math.floor(this.cellSize * 4.5)),
        this.boardOrigin.y + Phaser.Math.Between(20, Math.floor(this.cellSize * 4.5)),
        Phaser.Math.Between(7, 14),
        sparklePalette[index % sparklePalette.length],
        0.85,
      )

      this.tweens.add({
        targets: puff,
        x: puff.x + Phaser.Math.Between(-140, 140),
        y: puff.y + Phaser.Math.Between(-120, 120),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(500, 860),
        ease: 'Cubic.easeOut',
        onComplete: () => puff.destroy(),
      })
    }
  }

  private handleResize(): void {
    if (!this.snapshot) {
      return
    }

    this.paintBackgroundDust()
    this.layoutLevel()
    this.syncPieceViews()
  }
}
