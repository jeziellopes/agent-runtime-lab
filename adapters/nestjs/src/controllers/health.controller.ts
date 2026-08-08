import { Controller, Get } from '@nestjs/common'

export interface HealthBody {
  status: 'ok'
  uptime: number
}

/**
 * `GET /health`: adapter-local; it never reaches the runtime.
 */
@Controller()
export class HealthController {
  @Get('health')
  health(): HealthBody {
    return { status: 'ok', uptime: process.uptime() }
  }
}
