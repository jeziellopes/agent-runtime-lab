# hono-node

Framework: hono · Runtime: node (24.14.0) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.825 |
| streaming |  | ok | 250 | 3.405 |
| tool-calling |  | ok | 250 | 3.752 |
| multi-step-workflow |  | ok | 250 | 3.684 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 3.002 |
| long-context | 20000-tokens | ok | 3 | 4.811 |
| long-context | 50000-tokens | ok | 3 | 11.190 |
| multiple-sessions |  | ok | 250 | 4.130 |
