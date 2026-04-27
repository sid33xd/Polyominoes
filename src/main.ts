import * as Phaser from 'phaser'
import './style.css'
import { PuzzleController } from './game/controller'
import { LEVELS } from './game/levels'
import { GameScene } from './game/scenes/GameScene'
import { GameHud } from './game/ui'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root')
}

app.innerHTML = `
  <div class="app-shell">
    <div id="game-root" class="game-root"></div>
    <div class="hud-overlay">
      <section class="hud-band hud-top">
        <div class="status-cluster">
          <div class="status-pill">
            <span class="status-label">Level</span>
            <strong data-ui="level-count"></strong>
          </div>
          <div class="status-pill">
            <span class="status-label">Placed</span>
            <strong data-ui="progress-count"></strong>
          </div>
        </div>
      </section>

      <div class="hud-corner">
        <div class="control-strip">
          <button type="button" class="action-button secondary" data-action="reset">Reset</button>
        </div>
      </div>

      <div class="hud-next" data-ui="next-wrap" data-visible="false">
        <button type="button" class="action-button accent" data-action="next">Next level</button>
      </div>
    </div>
  </div>
`

const controller = new PuzzleController(LEVELS)
const hud = new GameHud(app, controller)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  transparent: true,
  backgroundColor: '#00000000',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 1440,
    height: 900,
  },
  input: {
    activePointers: 3,
  },
  scene: [new GameScene(controller)],
})

const preventContextMenu = (event: Event) => event.preventDefault()
document.addEventListener('contextmenu', preventContextMenu)

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return
  }

  if (event.key.toLowerCase() === 'r' || event.key === ' ') {
    event.preventDefault()
    controller.rotateSelectedPiece()
  }

  if (event.key.toLowerCase() === 'n' && controller.getSnapshot().solved) {
    event.preventDefault()
    controller.advanceOrLoop()
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    controller.resetLevel()
  }
})

window.addEventListener('beforeunload', () => {
  document.removeEventListener('contextmenu', preventContextMenu)
  hud.destroy()
  game.destroy(true)
})
