# Display Error Event Payload

The `core:display_error` event communicates user-facing errors to the UI layer. Payloads dispatched via `safeDispatchError` follow this structure:

```json
{
  "message": "<human readable message>",
  "details": { "<optional additional fields>": "..." }
}
```

- `message` is a short text explaining the error.
- `details` is an object with arbitrary diagnostic information intended for logs or debugging tools.

The `safeDispatchError` utility validates the dispatcher before emitting the event, ensuring consistent formatting across the codebase.
