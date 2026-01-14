# Expression Evaluation Logging (Option 1)

## Summary
Add an append-only logging pipeline for expression evaluations so we can review which expressions matched, which one was dispatched, and which were outranked. Logging should be emitted from the runtime and written by the llm-proxy-server into daily JSONL files.

## Goals
- Capture every expression evaluation cycle (when state changes and evaluation runs).
- Record the selected expression, its priority, and all other matching expressions in descending priority order.
- Persist logs to a single append-only file per day for easy review.
- Include enough metadata to correlate to actors, turns, and event sources.

## Non-Goals
- Do not capture full evaluation traces or failures for every prerequisite.
- Do not alter expression selection logic or priority resolution.
- Do not modify existing expression schemas.

## Definitions
- Evaluation cycle: A call path that builds expression context and evaluates expressions for an actor after a state change.
- Match: An expression whose prerequisites pass evaluation for the given context.
- Selected expression: The highest priority match (first element of matches list).

## Current Behavior (Reference)
- Expressions are sorted by descending priority, then by id in `src/expressions/expressionRegistry.js`.
- Highest priority match is selected in `src/expressions/expressionEvaluatorService.js#evaluate`.
- Evaluations are triggered by `src/expressions/expressionPersistenceListener.js` on `MOOD_STATE_UPDATED` and `ACTION_DECIDED` events.

## Proposed Design

### Runtime logging hook
- Location: `src/expressions/expressionPersistenceListener.js`.
- After building context and confirming state changed, call `evaluateAll` (or a new helper) to get the ordered list of matches.
- Selected expression is `matches[0]` when present.
- Log entry is created for every evaluation cycle, even when there is no match.
- Dispatch result (success/failed rate-limit or other failure) is captured.
- The listener posts the log entry to llm-proxy-server (new endpoint below).

### Server-side append endpoint
- Add an endpoint to llm-proxy-server to append JSONL lines:
  - `POST /api/expressions/log`
- The server writes the log entry to a daily file in project root:
  - Directory: `logs/expressions/`
  - Filename format: `expression-evals-YYYY-MM-DD.jsonl`
- Each request appends a single JSON line.
- The server must reject path traversal and write only within the project root.

### Log entry format (JSONL)
Example entry:
```
{
  "timestamp": "2025-01-13T20:34:56.123Z",
  "actorId": "actor:abc",
  "turnNumber": 42,
  "eventType": "MOOD_STATE_UPDATED",
  "selected": {
    "id": "emotions-fear:panic_onset",
    "priority": 95,
    "category": "threat"
  },
  "matches": [
    { "id": "emotions-fear:panic_onset", "priority": 95, "category": "threat" },
    { "id": "emotions-attention:curious_lean_in", "priority": 60, "category": "attention" }
  ],
  "dispatch": {
    "attempted": true,
    "success": true,
    "rateLimited": false,
    "reason": null
  }
}
```

#### Required fields
- `timestamp` (ISO 8601)
- `actorId` (string or null)
- `turnNumber` (number or null)
- `eventType` (string: `MOOD_STATE_UPDATED` or `ACTION_DECIDED`)
- `matches` (array; empty if no matches)
- `selected` (object or null)
- `dispatch` (object)

#### Expression summary shape
- `id` (string)
- `priority` (number)
- `category` (string)

### Runtime request payload
The runtime posts the log entry as JSON:
```
POST /api/expressions/log
{
  "entry": { ...logEntry }
}
```

### Server response
- 200 OK with `{ success: true, path, bytesWritten }` on success.
- 400 for validation failures (missing entry).
- 500 for file write failures.

## Implementation Notes

### Runtime
- Introduce a small logging utility in `src/expressions/` or `src/utils/` to send the entry via `fetch` to the proxy server.
- Use the existing proxy host configuration that other runtime services use (avoid hardcoding).
- Ensure failures to log do not block expression dispatch.
- Avoid adding large payloads; only include the match list, not full context.

### Proxy server
- Create a new route module or extend existing expression routes.
- Use `fs.appendFile` for JSONL logging.
- Ensure `logs/expressions` directory is created if missing.
- Enforce that the target log file stays within the project root.

## Validation
- Manual run: trigger expressions and verify that daily JSONL file grows with each evaluation.
- Verify that a no-match evaluation still logs with `selected: null` and `matches: []`.
- Ensure that rate-limited dispatch logs `success: false` with `reason` set.

## Open Questions
- Should logs be disabled or sampled in production builds?
- Should we include actor name or location for analysis?
- Do we need a max size / rotation policy beyond daily files?
