# nestjs-node

Framework: nestjs · Runtime: node (24.14.0) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.898 |
| streaming |  | ok | 250 | 3.251 |
| tool-calling |  | ok | 250 | 3.885 |
| multi-step-workflow |  | ok | 250 | 3.734 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 3.715 |
| long-context | 20000-tokens | ok | 3 | 5.418 |
| long-context | 50000-tokens | ok | 3 | 11.319 |
| multiple-sessions |  | ok | 250 | 5.062 |
