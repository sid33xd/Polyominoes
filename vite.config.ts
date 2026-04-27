import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/whisker-fit/' : '/',
  build: {
    outDir: 'dist',
  },
}))
