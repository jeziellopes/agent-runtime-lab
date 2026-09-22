#!/usr/bin/env node
// Renders the AGENT RUNTIME LAB banner through pyfiglet (the same renderer
// demo.sh uses), in the "pagga" font, and colours each glyph with a
// horizontal gradient through the four cell colours of results/index.html
// (dark theme: rust, amber, teal, light teal). The pagga font's background
// `░` blocks stay uncoloured.
//
// `node scripts/banner.mjs` prints it to stdout; benchmark.mjs imports
// renderBanner and prints it before every subcommand.
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const STOPS = [
  [221, 125, 71], // #dd7d47
  [234, 176, 107], // #eab06b
  [55, 179, 186], // #37b3ba
  [111, 214, 203] // #6fd6cb
]

function blend(a, b, t) {
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * t))
}

function colourAt(column, width) {
  const t = width <= 1 ? 0 : column / (width - 1)
  const scaled = t * (STOPS.length - 1)
  const index = Math.min(Math.floor(scaled), STOPS.length - 2)
  const fraction = scaled - index
  const [r, g, b] = blend(STOPS[index], STOPS[index + 1], fraction)

  return `\x1b[38;2;${r};${g};${b}m`
}

export function renderBanner() {
  const art = spawnSync('pyfiglet', ['-f', 'pagga', 'AGENT RUNTIME LAB'], {
    encoding: 'utf8'
  })

  if (art.status !== 0) {
    return 'AGENT RUNTIME LAB\none runtime core, three adapters, two JS runtimes\n\n'
  }

  const lines = art.stdout.replace(/\s+$/, '').split('\n')
  const width = Math.max(...lines.map(line => line.length))
  const coloured = lines.map(line => {
    let out = ''

    for (let column = 0; column < line.length; column++) {
      const char = line[column]

      out += char === '░' ? char : `${colourAt(column, width)}${char}`
    }

    return `${out}\x1b[0m`
  })

  return `${coloured.join('\n')}\n\x1b[2mone runtime core, three adapters, two JS runtimes\x1b[0m\n\n`
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write(renderBanner())
}
