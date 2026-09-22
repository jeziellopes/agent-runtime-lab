# Comparison

## nestjs-node vs hono-node (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.138 | no measurable difference |
| streaming |  | 250 | 0.124 | nestjs-node faster by 0.153ms |
| tool-calling |  | 250 | 0.121 | hono-node faster by 0.133ms |
| multi-step-workflow |  | 250 | 0.174 | no measurable difference |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.185 | hono-node faster by 0.932ms |

## nestjs-node vs fastify-node (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.135 | no measurable difference |
| streaming |  | 250 | 0.112 | no measurable difference |
| tool-calling |  | 250 | 0.123 | no measurable difference |
| multi-step-workflow |  | 250 | 0.166 | no measurable difference |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.198 | fastify-node faster by 0.921ms |

## hono-node vs fastify-node (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.142 | no measurable difference |
| streaming |  | 250 | 0.122 | fastify-node faster by 0.197ms |
| tool-calling |  | 250 | 0.122 | no measurable difference |
| multi-step-workflow |  | 250 | 0.162 | no measurable difference |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.174 | no measurable difference |

## nestjs-bun vs hono-bun (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.091 | no measurable difference |
| streaming |  | 250 | 0.091 | hono-bun faster by 0.463ms |
| tool-calling |  | 250 | 0.115 | hono-bun faster by 0.556ms |
| multi-step-workflow |  | 250 | 0.090 | hono-bun faster by 0.531ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.124 | hono-bun faster by 0.665ms |

## nestjs-bun vs fastify-bun (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.085 | no measurable difference |
| streaming |  | 250 | 0.098 | fastify-bun faster by 0.100ms |
| tool-calling |  | 250 | 0.117 | no measurable difference |
| multi-step-workflow |  | 250 | 0.106 | fastify-bun faster by 0.129ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.138 | no measurable difference |

## hono-bun vs fastify-bun (framework effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.090 | no measurable difference |
| streaming |  | 250 | 0.075 | hono-bun faster by 0.364ms |
| tool-calling |  | 250 | 0.091 | hono-bun faster by 0.471ms |
| multi-step-workflow |  | 250 | 0.101 | hono-bun faster by 0.402ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.119 | hono-bun faster by 0.588ms |

## nestjs-node vs nestjs-bun (runtime effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.111 | nestjs-bun faster by 0.769ms |
| streaming |  | 250 | 0.113 | nestjs-bun faster by 0.591ms |
| tool-calling |  | 250 | 0.129 | nestjs-bun faster by 0.784ms |
| multi-step-workflow |  | 250 | 0.143 | nestjs-bun faster by 0.898ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.178 | nestjs-bun faster by 1.575ms |

## hono-node vs hono-bun (runtime effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.123 | hono-bun faster by 0.709ms |
| streaming |  | 250 | 0.105 | hono-bun faster by 1.207ms |
| tool-calling |  | 250 | 0.105 | hono-bun faster by 1.207ms |
| multi-step-workflow |  | 250 | 0.134 | hono-bun faster by 1.379ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.134 | hono-bun faster by 1.308ms |

## fastify-node vs fastify-bun (runtime effect)

| Scenario | Variant | Runs | Resolution floor (ms) | Verdict |
| --- | --- | --- | --- | --- |
| simple-execution |  | 250 | 0.115 | fastify-bun faster by 0.834ms |
| streaming |  | 250 | 0.097 | fastify-bun faster by 0.647ms |
| tool-calling |  | 250 | 0.110 | fastify-bun faster by 0.822ms |
| multi-step-workflow |  | 250 | 0.136 | fastify-bun faster by 1.019ms |
| concurrent-executions | 1-concurrent | 3 |  | not tested |
| concurrent-executions | 10-concurrent | 3 |  | not tested |
| concurrent-executions | 50-concurrent | 3 |  | not tested |
| concurrent-executions | 100-concurrent | 3 |  | not tested |
| long-context | 5000-tokens | 3 |  | not tested |
| long-context | 20000-tokens | 3 |  | not tested |
| long-context | 50000-tokens | 3 |  | not tested |
| multiple-sessions |  | 250 | 0.163 | fastify-bun faster by 0.731ms |

## Limitations

- Replay removes real provider latency.
- The NestJS adapter bypasses @Sse(), so Nest's own SSE serializer is not measured.
- 5 cells are resident and idle during every measurement.
- The Fastify adapter writes SSE frames on the raw response, so Fastify's own reply serialization is not measured.
- Scenario 05's latency comes from autocannon and is not comparable to scenarios 01 through 04.
- Any cell needing workarounds has them disclosed as confounds.
- The benchmark evaluates this architecture only.
