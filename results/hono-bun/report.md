# hono-bun

Framework: hono · Runtime: bun (1.4.2) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.116 |
| streaming |  | ok | 250 | 2.197 |
| tool-calling |  | ok | 250 | 2.545 |
| multi-step-workflow |  | ok | 250 | 2.305 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 2.396 |
| long-context | 20000-tokens | ok | 3 | 4.086 |
| long-context | 50000-tokens | ok | 3 | 7.875 |
| multiple-sessions |  | ok | 250 | 2.823 |
