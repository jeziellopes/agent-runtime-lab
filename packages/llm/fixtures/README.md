# Replay fixtures

Recorded LLM token streams, committed. `ReplayLLMProvider` reads them, and it is
the default for every benchmark run and every test.

One file per agent, named `<agent-id>.json`, shaped as `TokenStreamFixture`:

```json
{
  "agentId": "simple-agent",
  "model": "",
  "prompt": "Explain what an API gateway is.",
  "tokens": [],
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 }
}
```

Re-record with `LLM_MODE=live`. Two things must be true of a recording before it
is committed:

- `model` is pinned and non-empty. No model has been decided, so no fixture
  has been recorded yet.
- The same fixture set is used by every cell. A cell replaying a different
  recording is measuring a different program.
