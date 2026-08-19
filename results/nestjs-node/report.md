# nestjs-node

Framework: nestjs · Runtime: node (24.14.0) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 3.325 |
| streaming |  | ok | 250 | 3.042 |
| tool-calling |  | ok | 250 | 4.170 |
| multi-step-workflow |  | ok | 250 | 3.947 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 2.385 |
| long-context | 20000-tokens | ok | 3 | 3.803 |
| long-context | 50000-tokens | ok | 3 | 6.963 |
| multiple-sessions |  | ok | 250 | 3.537 |
