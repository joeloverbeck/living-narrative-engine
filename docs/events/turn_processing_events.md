# Turn Processing Events

`core:turn_processing_started` and `core:turn_processing_ended` signal when the engine begins and finishes processing any entity's turn.

Payload structure:

```json
{
  "entityId": "<namespaced id>",
  "actorType": "player" | "ai"
}
```

- `entityId` – ID of the actor whose turn is being processed.
- `actorType` – Indicates whether the actor is player controlled or AI controlled.
