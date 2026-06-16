// Rasterizes public/favicon.svg into the PWA PNG icons.
// Run with: npm run icons
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/favicon.svg'))

const targets = [
  { size: 192, file: 'pwa-192.png' },
  { size: 512, file: 'pwa-512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
]

for (const { size, file } of targets) {
  await sharp(svg).resize(size, size).png().toFile(resolve(root, 'public', file))
  console.log(`wrote public/${file} (${size}x${size})`)
}
