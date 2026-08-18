import { spawn } from 'node:child_process'

/**
 * `pnpm start --framework nestjs --runtime node`. Every command names both a
 * framework and a JS runtime.
 *
 * `--deterministic` is what the contract suite needs: it compares golden SSE
 * bytes, and those are only literal while ids are derived and timestamps are
 * the epoch. Leave it off to run a cell the way the benchmark does.
 *
 * Ports match `packages/contract-tests/src/cells.ts` and `docker-compose.yml`.
 */
const CELLS = {
  'nestjs/node': {
    command: 'node',
    entry: 'adapters/nestjs/dist/main.js',
    port: 3000
  },
  'hono/node': {
    command: 'node',
    entry: 'adapters/hono/dist/server.js',
    port: 3001
  },
  'nestjs/bun': {
    command: 'bun',
    entry: 'adapters/nestjs/dist/main.js',
    port: 3002
  },
  'hono/bun': {
    command: 'bun',
    entry: 'adapters/hono/dist/server.bun.js',
    port: 3003
  }
}

const argv = process.argv.slice(2)
const flag = name => argv[argv.indexOf(`--${name}`) + 1]

const key = `${flag('framework')}/${flag('runtime')}`
const cell = CELLS[key]

if (!cell) {
  process.stderr.write(
    `unknown cell: ${key}\nexpected one of: ${Object.keys(CELLS).join(', ')}\n`
  )
  process.exit(1)
}

spawn(cell.command, [cell.entry], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(cell.port),
    ...(argv.includes('--deterministic') ? { DETERMINISTIC: 'true' } : {})
  }
}).on('exit', code => process.exit(code ?? 0))
