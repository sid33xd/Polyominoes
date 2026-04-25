import type { Point } from './types'

export const cellKey = ({ x, y }: Point): string => `${x},${y}`

export const sortCells = (cells: Point[]): Point[] =>
  [...cells].sort((left, right) => left.y - right.y || left.x - right.x)

export const uniqueCells = (cells: Point[]): Point[] => {
  const seen = new Set<string>()
  const result: Point[] = []

  for (const cell of sortCells(cells)) {
    const key = cellKey(cell)

    if (!seen.has(key)) {
      seen.add(key)
      result.push(cell)
    }
  }

  return result
}

export const getBounds = (cells: Point[]) => {
  const xs = cells.map((cell) => cell.x)
  const ys = cells.map((cell) => cell.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

export const normalizeCells = (cells: Point[]): Point[] => {
  const bounds = getBounds(cells)

  return sortCells(
    cells.map((cell) => ({
      x: cell.x - bounds.minX,
      y: cell.y - bounds.minY,
    })),
  )
}

export const rotateCells = (cells: Point[], rotation: number): Point[] => {
  const turns = ((rotation % 4) + 4) % 4
  let current = cells.map((cell) => ({ ...cell }))

  for (let index = 0; index < turns; index += 1) {
    current = current.map((cell) => ({ x: cell.y, y: -cell.x }))
  }

  return normalizeCells(current)
}

export const translateCells = (cells: Point[], anchor: Point): Point[] =>
  cells.map((cell) => ({
    x: cell.x + anchor.x,
    y: cell.y + anchor.y,
  }))
