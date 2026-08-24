# agent-runtime-lab

What does your backend framework actually cost you
when you build an AI agent runtime?

NestJS vs Hono, Node vs Bun — one runtime core,
four deployments, and a contract suite proving the
only thing that changed was the framework.

> All four cells pass the contract suite, all seven benchmark scenarios have
> run against every cell, and the comparison report is published with its
> limitations stated.

![A clean clone: `docker compose up` brings up all four cells and the contract suite PASSes on each, then all seven scenarios run live against every cell, then `pnpm benchmark report` regenerates the comparison from that run](assets/demo.gif)

A clean clone, `docker compose up`, all four cells proving they are
equivalent, then every scenario run live and compared: the same path
anyone reproducing this gets.

## What this is

One AI agent runtime core, exposed through two backend framework adapters and
benchmarked across two JavaScript runtimes. A framework benchmark whose cells
are quietly different programs measures nothing — that is the ordinary failure
of the genre. An isolated runtime core with no measurement attached demonstrates
a pattern but answers no question.

This project is the join. The framework-independent architecture is the
_method_, the measured four-cell answer is the _result_, and the contract suite
is the hinge between them, because it is what proves the cells are identical
except for the variable under test.

**Stack:** TypeScript, pnpm workspaces, LangGraph, NestJS and Hono adapters,
Node LTS and Bun — _because_ **NestJS and Hono sit at opposite ends of the
TypeScript backend spectrum: decorator-driven DI container versus functional
Web-Standards composition. If a runtime core survives both without change, it
will survive anything between them.**

**Deploys to:** nowhere. There is no live deployment. `docker compose up` from a
clean clone brings up every cell and prints the contract suite result; the
report and results ship as committed artifacts under `results/`. A GitHub
Pages page is the planned home for them once this repo has a remote to
publish from. That makes the bring-up a build requirement, not a nice-to-have.

**Data:** replay-primary. Recorded LLM token streams, committed as fixtures. The
replay provider is the default for every benchmark and every test; a flag
switches to a real provider for re-recording and live verification.

## The matrix

|            | Node LTS | Bun    |
| ---------- | -------- | ------ |
| **NestJS** | cell 1   | cell 3 |
| **Hono**   | cell 2   | cell 4 |

A factorial design, not a single-variable one: it separates the framework effect
from the runtime effect and exposes any interaction between them.

## The hard part

**The framework-agnostic contract suite** — `packages/contract-tests/src/suite.ts`.

One suite, importing zero framework packages, run once per cell against a base
URL, asserting that every cell produces identical HTTP responses, identical SSE
event sequences and identical error mappings. It turns "the adapters are
equivalent" from an assertion into something that can fail.

It is the artifact the audience opens first, and **it is built before either
adapter is finished**. Written afterwards, a contract suite degrades
into a description of whatever the adapters already happen to do — precisely the
assertion it exists to replace.

That ordering is why `packages/contracts` and `packages/contract-tests`
existed before either adapter did, and why both adapters were built against
a suite that could already fail them.

## The seven layers

Doc comments in the source mark which layer a file belongs to (`L2.`, `L4.` and
so on). The numbering is this:

| Layer | Owns                                                             | Where                              |
| ----- | ---------------------------------------------------------------- | ---------------------------------- |
| L1    | HTTP: routing, parsing, serialization, SSE transport, auth seam  | `adapters/nestjs`, `adapters/hono` |
| L2    | Execution lifecycle, event emission, execution state             | `packages/runtime-core`            |
| L3    | The execution model — agent definitions, context, workflow start | `packages/agent-engine`            |
| L4    | Graph execution — nodes, edges, state transitions                | `packages/graph-runtime`           |
| L5    | Tools, registered rather than imported                           | `packages/tools`                   |
| L6    | Conversation history, execution state, persistent context        | `packages/memory`                  |
| L7    | Model providers behind one interface; replay is the default      | `packages/llm`                     |

L1 may not contain agent logic, prompts, workflow definitions or tool
implementations — that constraint is what makes the four cells comparable. The
remaining four packages are cross-cutting: `contracts` and `events` are the
shared vocabulary, `contract-tests` is the equivalence gate, and
`benchmark-runner` / `benchmark-report` sit outside the stack entirely.

## Build order

1. `packages/contracts` — done: the domain model, the seven-state lifecycle and
   the twelve events are real types with tests.
2. `packages/contract-tests` — done: the equivalence gate, built before either
   adapter.
3. The adapters, then the runtime beneath them: done.
4. `packages/benchmark-runner`, then `benchmark-report`: done.

## The surface, enumerated

| Item                     | Count | Where                               |
| ------------------------ | ----- | ----------------------------------- |
| HTTP endpoints           | 6     | identical in every cell             |
| Handlers written         | 12    | 6 x 2 adapters                      |
| Handlers contract-tested | 24    | 6 x 4 cells                         |
| Packages                 | 11    | `packages/`                         |
| Reference agents         | 3     | `agents/`                           |
| Benchmark scenarios      | 7     | `scenarios/`                        |
| Runtime events           | 12    | `packages/events/src/event-type.ts` |

```
GET    /health
GET    /agents
POST   /agents/:id/execute      -> ExecutionResult
POST   /agents/:id/stream       -> SSE RuntimeEvent
GET    /executions/:id          -> Execution
DELETE /executions/:id          -> cancel
```

Neither adapter delegates SSE framing to its framework. NestJS does
not use `@Sse()`: it emits `event, id, data` over a GET route, and the contract
is `id, event, data` over POST.

## What this is not

1. **No persistent memory backend.** In-memory store only. Redis, PostgreSQL and
   vector stores remain named, unimplemented interfaces.
2. **No WebSocket transport.** SSE only, both adapters.
3. **No multi-tenancy.**
4. **No production authorization.** Auth is an empty middleware seam that proves
   the adapter has the integration point, and does nothing.
5. **No distributed scheduling or queue-based execution.**
6. **No Kubernetes orchestration or ArgoCD deployment.**
7. **No billing, cost governance, or enterprise governance.**
8. **No human-in-the-loop interrupt UI.** `WAITING` covers tool awaits only.

## Faked deliberately

| Stubbed                                                | Stands in for                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `packages/llm/src/providers/replay/replay-provider.ts` | a live LLM — and it is the **default**, not the fallback            |
| `packages/tools/src/search/search-tool.ts`             | a real search API; canned results, no network, no key               |
| `adapters/nestjs/src/middleware/auth.middleware.ts`    | production authorization; an empty slot that proves the seam exists |
| `adapters/hono/src/http/middleware/auth.ts`            | the same seam, in the other adapter                                 |
| `scenarios/06-long-context/workload.ts`                | a long-context corpus; synthetic filler, so token counts are exact  |
| `packages/benchmark-runner/src/results-store.ts`       | a metrics backend; JSON files on disk, no Prometheus, no Grafana    |

The replay LLM inverts the usual rule that a benchmark must issue real calls
and mock nothing. Adapter overhead is microseconds to low milliseconds and was
being measured through 500 ms – 5 s of provider variance: the signal sat two to
four orders of magnitude below the noise floor, every run cost money, and CI
could not execute the suite at all.

## Running it

```bash
pnpm install
docker compose up                                 # every cell, then the suite

pnpm start --framework nestjs --runtime node      # or one cell, on :3000
pnpm contract-test --all
pnpm benchmark run
pnpm benchmark report
```

Development needs no API key. `LLM_MODE=replay` is the default; `live` is opt-in
and used only to re-record fixtures.

## Done when

1. The contract test suite is green on **all 4 cells in the matrix**.
2. All 7 benchmark scenarios have executed against every cell.
3. The comparison report is published with its own limitations stated.

From here: no features. Only fixes to things that break the contract suite.

## Licence

MIT. See [`LICENSE`](LICENSE).
