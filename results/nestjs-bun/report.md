# nestjs-bun

Framework: nestjs · Runtime: bun (1.4.2) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.129 |
| streaming |  | ok | 250 | 2.660 |
| tool-calling |  | ok | 250 | 3.101 |
| multi-step-workflow |  | ok | 250 | 2.836 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 2.845 |
| long-context | 20000-tokens | ok | 3 | 5.068 |
| long-context | 50000-tokens | ok | 3 | 7.788 |
| multiple-sessions |  | ok | 250 | 3.488 |
