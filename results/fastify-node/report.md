# fastify-node

Framework: fastify · Runtime: node (24.14.0) · LLM mode: replay

| Scenario | Variant | Status | Runs | Mean latency (ms) |
| --- | --- | --- | --- | --- |
| simple-execution |  | ok | 250 | 2.919 |
| streaming |  | ok | 250 | 3.207 |
| tool-calling |  | ok | 250 | 3.838 |
| multi-step-workflow |  | ok | 250 | 3.727 |
| concurrent-executions | 1-concurrent | ok | 3 |  |
| concurrent-executions | 10-concurrent | ok | 3 |  |
| concurrent-executions | 50-concurrent | ok | 3 |  |
| concurrent-executions | 100-concurrent | ok | 3 |  |
| long-context | 5000-tokens | ok | 3 | 3.231 |
| long-context | 20000-tokens | ok | 3 | 4.951 |
| long-context | 50000-tokens | ok | 3 | 9.387 |
| multiple-sessions |  | ok | 250 | 4.142 |
