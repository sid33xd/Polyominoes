import type { PuzzleController } from './controller'
import type { PuzzleSnapshot } from './types'

export class GameHud {
  private readonly controller: PuzzleController
  private readonly levelCount: HTMLElement
  private readonly progressCount: HTMLElement
  private readonly nextWrap: HTMLElement
  private readonly resetButton: HTMLButtonElement
  private readonly nextButton: HTMLButtonElement
  private readonly unsubscribe: () => void

  constructor(root: HTMLElement, controller: PuzzleController) {
    this.controller = controller
    this.levelCount = this.require(root, '[data-ui="level-count"]')
    this.progressCount = this.require(root, '[data-ui="progress-count"]')
    this.nextWrap = this.require(root, '[data-ui="next-wrap"]')
    this.resetButton = this.requireButton(root, '[data-action="reset"]')
    this.nextButton = this.requireButton(root, '[data-action="next"]')

    this.resetButton.addEventListener('click', this.handleReset)
    this.nextButton.addEventListener('click', this.handleNext)

    this.unsubscribe = controller.subscribe((snapshot) => {
      this.render(snapshot)
    })
  }

  destroy(): void {
    this.resetButton.removeEventListener('click', this.handleReset)
    this.nextButton.removeEventListener('click', this.handleNext)
    this.unsubscribe()
  }

  private readonly handleReset = (): void => {
    this.controller.resetLevel()
  }

  private readonly handleNext = (): void => {
    this.controller.advanceOrLoop()
  }

  private render(snapshot: PuzzleSnapshot): void {
    this.levelCount.textContent = `${snapshot.levelIndex + 1} / ${snapshot.levelCount}`
    this.progressCount.textContent = `${snapshot.placedCount} / ${snapshot.totalPieces}`
    this.nextWrap.dataset.visible = snapshot.solved ? 'true' : 'false'
    this.nextButton.disabled = !snapshot.solved
    this.nextButton.textContent =
      snapshot.levelIndex === snapshot.levelCount - 1 ? 'Loop again' : 'Next level'
  }

  private require(root: HTMLElement, selector: string): HTMLElement {
    const node = root.querySelector<HTMLElement>(selector)

    if (!node) {
      throw new Error(`Missing HUD node: ${selector}`)
    }

    return node
  }

  private requireButton(root: HTMLElement, selector: string): HTMLButtonElement {
    const node = root.querySelector<HTMLButtonElement>(selector)

    if (!node) {
      throw new Error(`Missing HUD button: ${selector}`)
    }

    return node
  }
}
