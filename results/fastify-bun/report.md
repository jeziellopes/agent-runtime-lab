# fastify-bun

Framework: fastify · Runtime: bun (1.4.2) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.084 |
| streaming |  | ok | 250 | 2.561 |
| tool-calling |  | ok | 250 | 3.016 |
| multi-step-workflow |  | ok | 250 | 2.707 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 2.871 |
| long-context | 20000-tokens | ok | 3 | 4.664 |
| long-context | 50000-tokens | ok | 3 | 5.599 |
| multiple-sessions |  | ok | 250 | 3.411 |
