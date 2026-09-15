# Architecture

Diagrams for the shape described in [README.md](README.md): two deployable
apps built from the same core, and the one request path that has to look
identical no matter which app served it.

C4 model, container and component levels, plus a sequence diagram for the
one request path the whole project rests on.

## Container: what's actually deployed

A "container" here is a separately runnable thing, not a Docker container
specifically (`docker-compose.yml` happens to give each one its own, but
that's a deployment detail, not this diagram). There are two: an app built
around `adapter-nestjs`, and an app built around `adapter-hono`. Both bundle
the exact same L2-L7 core.

```mermaid
C4Container
    title Container — agent-runtime-lab

    Person(caller, "Caller", "Sends HTTP requests, opens SSE streams")

    System_Boundary(system, "agent-runtime-lab") {
        Container(nestjs_app, "adapter-nestjs app", "NestJS, TypeScript", "L1 HTTP/SSE, plus the full framework-blind core (L2-L7), bundled in")
        Container(hono_app, "adapter-hono app", "Hono, TypeScript", "L1 HTTP/SSE, plus the same framework-blind core (L2-L7), bundled in")
        Container(contract_tests, "contract-tests", "Vitest, TypeScript", "Equivalence gate. Zero framework imports.")
    }

    Rel(caller, nestjs_app, "HTTP, SSE")
    Rel(caller, hono_app, "HTTP, SSE")
    Rel(contract_tests, nestjs_app, "asserts identical responses", "HTTP")
    Rel(contract_tests, hono_app, "asserts identical responses", "HTTP")

    UpdateElementStyle(nestjs_app, $bgColor="#dd7d47", $borderColor="#a8431c", $fontColor="#14171c")
    UpdateElementStyle(hono_app, $bgColor="#37b3ba", $borderColor="#0b6e77", $fontColor="#0f1216")
```

Each of these two containers deploys twice, once per JS runtime (Node, Bun),
for four cells total. The runtime is a deployment-time choice, not a
different container, it never shows up as a box here. The matrix in the
README is where that axis lives.

## Component: inside one app

Zoomed into `adapter-nestjs app`. `adapter-hono app` has the identical
picture below L1, its L1 component is the only thing that differs, everything
from `runtime-core` down is the same source in both containers.

```mermaid
C4Component
    title Component — adapter-nestjs app

    Container_Boundary(app, "adapter-nestjs app") {
        Component(l1, "adapter-nestjs (L1)", "NestJS controllers, middleware", "Routing, parsing, SSE framing, auth seam. The only component that differs between the two apps.")
        Component(l2, "runtime-core (L2)", "TypeScript", "Execution lifecycle, event emission, execution state")
        Component(l3, "agent-engine (L3)", "TypeScript", "Agent definitions, context, workflow start")
        Component(l4, "graph-runtime (L4)", "TypeScript", "Nodes, edges, state transitions")
        Component(l5, "tools (L5)", "TypeScript", "Registered tools, not imported")
        Component(l6, "memory (L6)", "TypeScript", "Conversation history, persistent context")
        Component(l7, "llm (L7)", "TypeScript", "Model providers behind one interface, replay is the default")
        Component(contracts, "contracts + events", "TypeScript", "Shared domain types, the seven-state lifecycle, the twelve events")
    }

    Rel(l1, l2, "invokes")
    Rel(l2, l3, "starts workflow")
    Rel(l2, l5, "invokes registered tool")
    Rel(l2, l6, "reads, writes context")
    Rel(l2, l7, "calls provider")
    Rel(l3, l4, "executes graph")
    Rel(l3, contracts, "uses types")
    Rel(l4, contracts, "uses types")
    Rel(l5, contracts, "uses types")
    Rel(l6, contracts, "uses types")
    Rel(l7, contracts, "uses types")

    UpdateElementStyle(l1, $bgColor="#dd7d47", $borderColor="#a8431c", $fontColor="#14171c")
```

L1 carries the accent color because it is the one component allowed to vary.
L2-L7 stay unstyled because none of them may contain agent logic, prompts,
workflow definitions, or tool implementations that differ by framework, that
constraint is what makes the two apps' behavior comparable at all.

## Sequence: one streamed execution

`POST /agents/:id/stream`, one representative run: a node that calls a
provider, then a tool, then completes. Event types and ordering are read
directly from `packages/events/src/event-type.ts`; `contract-tests` asserts
this exact type sequence, and monotonically increasing SSE ids
(`sse.event.id.monotonic`), on every cell.

```mermaid
sequenceDiagram
    participant C as Caller
    participant A as Adapter (L1)
    participant Core as runtime-core (L2)
    participant Eng as agent-engine + graph-runtime (L3-L4)
    participant LLM as llm (L7)
    participant T as tools (L5)

    C->>A: POST /agents/:id/stream
    A->>Core: start execution
    Core->>A: execution.created
    A-->>C: id 0 · execution.created
    Core->>A: execution.started
    A-->>C: id 1 · execution.started
    Core->>Eng: run graph
    Eng->>A: node.started
    A-->>C: id 2 · node.started
    Eng->>LLM: complete
    LLM->>A: llm.started
    A-->>C: id 3 · llm.started
    LLM->>A: llm.token (repeats)
    A-->>C: id 4 · llm.token
    LLM->>A: llm.completed
    A-->>C: id 5 · llm.completed
    Eng->>T: invoke tool
    T->>A: tool.started
    A-->>C: id 6 · tool.started
    T->>A: tool.completed
    A-->>C: id 7 · tool.completed
    Eng->>A: node.completed
    A-->>C: id 8 · node.completed
    Core->>A: execution.completed
    A-->>C: id 9 · execution.completed
    Note over C,A: contract-tests replays this against every<br/>cell and diffs the type sequence and ids
```

A run that errors mid-stream does not drop to an HTTP status, it arrives as
an `execution.failed` event on the same stream
(`error.midstream.is.event.not.status`, also asserted by `contract-tests`).
