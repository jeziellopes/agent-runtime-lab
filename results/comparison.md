# Comparison

## nestjs-node vs hono-node (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.154 | no measurable difference |
| streaming |  | 250 | 0.118 | no measurable difference |
| tool-calling |  | 250 | 0.135 | no measurable difference |
| multi-step-workflow |  | 250 | 0.097 | hono-node faster by 0.157ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.087 | hono-node faster by 0.214ms |

## nestjs-bun vs hono-bun (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.243 | hono-bun faster by 0.935ms |
| streaming |  | 250 | 0.186 | hono-bun faster by 0.491ms |
| tool-calling |  | 250 | 0.139 | hono-bun faster by 0.618ms |
| multi-step-workflow |  | 250 | 0.121 | hono-bun faster by 0.607ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.128 | hono-bun faster by 0.733ms |

## nestjs-node vs nestjs-bun (runtime effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.223 | nestjs-node faster by 1.591ms |
| streaming |  | 250 | 0.167 | nestjs-node faster by 1.031ms |
| tool-calling |  | 250 | 0.144 | nestjs-node faster by 0.722ms |
| multi-step-workflow |  | 250 | 0.113 | nestjs-node faster by 0.703ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.112 | nestjs-node faster by 0.680ms |

## hono-node vs hono-bun (runtime effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.182 | hono-node faster by 0.765ms |
| streaming |  | 250 | 0.145 | hono-node faster by 0.464ms |
| tool-calling |  | 250 | 0.129 | hono-node faster by 0.131ms |
| multi-step-workflow |  | 250 | 0.106 | hono-node faster by 0.252ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.107 | hono-node faster by 0.160ms |

## Limitations

- Replay removes real provider latency.
- The NestJS adapter bypasses @Sse(), so Nest's own SSE serializer is not measured.
- Three cells are resident and idle during every measurement.
- Scenario 05's latency comes from autocannon and is not comparable to scenarios 01 through 04.
- Any cell needing workarounds has them disclosed as confounds.
- The benchmark evaluates this architecture only.
