# nestjs-bun

Framework: nestjs · Runtime: bun (1.1.38) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 4.916 |
| streaming |  | ok | 250 | 4.073 |
| tool-calling |  | ok | 250 | 4.892 |
| multi-step-workflow |  | ok | 250 | 4.649 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 3.063 |
| long-context | 20000-tokens | ok | 3 | 4.833 |
| long-context | 50000-tokens | ok | 3 | 6.987 |
| multiple-sessions |  | ok | 250 | 4.217 |
