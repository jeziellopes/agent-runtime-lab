# hono-bun

Framework: hono · Runtime: bun (1.1.38) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 3.980 |
| streaming |  | ok | 250 | 3.583 |
| tool-calling |  | ok | 250 | 4.275 |
| multi-step-workflow |  | ok | 250 | 4.042 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 3.032 |
| long-context | 20000-tokens | ok | 3 | 4.402 |
| long-context | 50000-tokens | ok | 3 | 7.515 |
| multiple-sessions |  | ok | 250 | 3.484 |
