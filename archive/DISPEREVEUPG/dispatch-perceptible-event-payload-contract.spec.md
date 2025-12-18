# DISPATCH_PERCEPTIBLE_EVENT Payload Contract Specification

## Status: Active

## Purpose

This specification documents the **exact contract** between rule parameters passed to `DISPATCH_PERCEPTIBLE_EVENT` operations and what appears in the dispatched event payload. This prevents recurring test failures caused by developers incorrectly assuming internal parameters appear in broadcast events.

---

## Context

### Module Location

- **Handler**: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- **Schema**: `data/schemas/operations/dispatchPerceptibleEvent.schema.json`
- **Token**: `tokens-core.js` → `DispatchPerceptibleEventHandler`
- **Registration**: `operationHandlerRegistrations.js`, `interpreterRegistrations.js`
- **Pre-validation**: `preValidationUtils.js` → `KNOWN_OPERATION_TYPES`

### What the Module Does

The `DispatchPerceptibleEventHandler` transforms rule parameters into standardized perceptible events that can be observed by nearby entities. It performs two distinct operations:

1. **Event Broadcasting**: Dispatches `core:perceptible_event` through the event bus with a standardized payload
2. **Log Handler Routing** (optional): When `log_entry: true`, routes perspective-aware parameters to `AddPerceptionLogEntryHandler` for writing perception logs to specific actors

**Critical Architecture Insight**: These two operations have **different data contracts**. Parameters for log routing do NOT appear in the broadcast event payload.

### Related Documentation

- `docs/modding/sense-aware-perception.md` - Sense-aware perception system
- `specs/dispatch-perceptible-event-upgrades.spec.md` - Rule modification patterns (complementary spec)

---

## Problem

### What Failed

Tests across multiple tickets (DISPEREVEUPG series) failed with assertions like:

```javascript
// ❌ WRONG - These assertions FAIL
expect(perceptibleEvent.payload.actorDescription).toBe('I do something.');
expect(perceptibleEvent.payload.alternateDescriptions).toBeDefined();
expect(perceptibleEvent.payload.logEntry).toBe(true);
```

### How It Failed

All such assertions return `undefined` because these fields **do not exist** in the event payload.

### Why It Failed

**Root Cause**: Developers assumed rule parameters flow directly to event payloads. In reality:

1. **Broadcast payload** contains a standardized subset of fields
2. **Perspective-aware parameters** (`actor_description`, `target_description`, `alternate_descriptions`) are consumed internally by the log handler
3. **`log_entry`** triggers internal log handler call but only manifests as `contextualData.skipRuleLogging: true` in payload

### Affected Tests (Examples)

- `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
- `tests/integration/mods/items/readItemRuleExecution.test.js`
- `tests/integration/mods/writing/jotDownNotesRuleExecution.test.js`
- `tests/integration/mods/writing/signDocumentRuleExecution.test.js`

---

## Truth Sources

### Primary Source: Handler Code

**File**: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

**Lines 226-241 - Event Payload Construction**:

```javascript
const payload = {
  eventName: EVENT_ID,
  locationId: validatedLocationId,
  descriptionText: description_text,      // ← FROM rule param
  timestamp,
  perceptionType: validatedPerceptionType,
  actorId: actor_id,
  targetId: target_id ?? null,
  involvedEntities: Array.isArray(involved_entities)
    ? involved_entities
    : [],
  contextualData: {
    ...normalizedContextualData,
    skipRuleLogging: log_entry,           // ← ONLY indicator of log_entry
  },
};
```

**Lines 248-272 - Log Handler Call (NOT in payload)**:

```javascript
if (log_entry) {
  await this.#logHandler.execute({
    location_id: validatedLocationId,
    entry,
    originating_actor_id: actor_id,
    recipient_ids: normalizedContextualData.recipientIds,
    excluded_actor_ids: normalizedContextualData.excludedActorIds,
    alternate_descriptions: params.alternate_descriptions,  // ← Internal only
    sense_aware: params.sense_aware ?? true,
    actor_description,        // ← Internal only
    target_description,       // ← Internal only
    target_id,
  });
}
```

### Secondary Sources

- **Schema**: `data/schemas/operations/dispatchPerceptibleEvent.schema.json`
- **Perception Type Registry**: `src/perception/registries/perceptionTypeRegistry.js`

---

## Desired Behavior

### Rule Parameter → Payload Mapping

| Rule Parameter | Payload Field | Notes |
|----------------|---------------|-------|
| `location_id` | `locationId` | Required, validated |
| `description_text` | `descriptionText` | Required, third-person for observers |
| `perception_type` | `perceptionType` | Required, validated against registry |
| `actor_id` | `actorId` | Required |
| `target_id` | `targetId` | Optional, defaults to `null` |
| `involved_entities` | `involvedEntities` | Optional, array |
| `contextual_data.*` | `contextualData.*` | Custom data passed through |
| `log_entry` | `contextualData.skipRuleLogging` | Boolean indicator only |
| _(auto-generated)_ | `eventName` | Always `'core:perceptible_event'` |
| _(auto-generated)_ | `timestamp` | ISO timestamp |

### Rule Parameter → Log Handler Only (NOT in Payload)

| Rule Parameter | Where It Goes | Purpose |
|----------------|---------------|---------|
| `actor_description` | Log handler `actor_description` param | First-person text for actor's perception log |
| `target_description` | Log handler `target_description` param | Second-person text for target's perception log |
| `alternate_descriptions` | Log handler `alternate_descriptions` param | Sense-based variants (auditory, tactile) |
| `sense_aware` | Log handler `sense_aware` param | Enable/disable sense filtering |

### Normal Cases

**Case 1: Basic perception event without logging**

```json
// Rule operation
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Alice waves.",
    "perception_type": "social.gesture",
    "actor_id": "{event.payload.actorId}"
  }
}
```

**Expected payload**:
```javascript
{
  eventName: 'core:perceptible_event',
  locationId: 'room-1',
  descriptionText: 'Alice waves.',
  perceptionType: 'social.gesture',
  actorId: 'alice-1',
  targetId: null,
  involvedEntities: [],
  timestamp: '2025-01-15T...',
  contextualData: {
    skipRuleLogging: false  // log_entry not set or false
  }
}
```

**Case 2: Perception event with perspective-aware logging**

```json
// Rule operation
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Alice reads the letter.",
    "actor_description": "I read the letter. It says: 'Meet at midnight.'",
    "perception_type": "item.examine",
    "actor_id": "{event.payload.actorId}",
    "target_id": "letter-1",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear paper rustling nearby."
    }
  }
}
```

**Expected payload** (what tests should validate):
```javascript
{
  eventName: 'core:perceptible_event',
  locationId: 'room-1',
  descriptionText: 'Alice reads the letter.',  // Third-person, no private content
  perceptionType: 'item.examine',
  actorId: 'alice-1',
  targetId: 'letter-1',
  involvedEntities: [],
  timestamp: '2025-01-15T...',
  contextualData: {
    skipRuleLogging: true  // ← ONLY observable indicator of log_entry: true
  }
}
```

**What does NOT appear in payload**:
- `actorDescription` ❌
- `alternateDescriptions` ❌
- `logEntry` ❌

### Edge Cases

**Edge Case 1: `log_entry: false` or omitted**

- `contextualData.skipRuleLogging` will be `false`
- Log handler is NOT called
- Perspective parameters are ignored even if provided

**Edge Case 2: `contextual_data` with custom fields**

Custom fields in `contextual_data` ARE passed through to payload:
```javascript
// Rule parameter
"contextual_data": {
  "readableText": "Secret message content",
  "customField": "value"
}

// Payload result
contextualData: {
  readableText: "Secret message content",
  customField: "value",
  skipRuleLogging: true  // Added by handler
}
```

**Edge Case 3: Legacy perception types**

- Deprecated types trigger warning but are auto-mapped to new types
- Payload contains the NEW type, not the legacy one

### Failure Modes

| Condition | Error Behavior |
|-----------|---------------|
| Missing `location_id` | `safeDispatchError`, handler returns early |
| Missing `description_text` | `safeDispatchError`, handler returns early |
| Missing `perception_type` | `safeDispatchError`, handler returns early |
| Invalid `perception_type` | `safeDispatchError` with suggestion, handler returns early |
| Missing `actor_id` | `safeDispatchError`, handler returns early |
| Both `recipientIds` and `excludedActorIds` set | `safeDispatchError`, handler returns early |

### Invariants

Properties that MUST always hold:

1. **Payload never contains `actorDescription`** - Even if `actor_description` is in rule params
2. **Payload never contains `alternateDescriptions`** - Even if `alternate_descriptions` is in rule params
3. **Payload never contains `logEntry`** - Only `contextualData.skipRuleLogging` indicates this
4. **`descriptionText` is always third-person** - First-person goes to log handler only
5. **`skipRuleLogging` equals `log_entry` boolean value** - Direct mapping
6. **Custom `contextual_data` fields are preserved** - Passed through unchanged

### API Contracts

**Stable (DO NOT CHANGE without migration)**:

- Payload field names and types in the mapping table above
- `skipRuleLogging` mechanism for indicating log_entry status
- Event name `'core:perceptible_event'`
- Required fields: `locationId`, `descriptionText`, `perceptionType`, `actorId`

**Internal (May change)**:

- Log handler parameter names
- Perception type validation logic
- Error message formatting
- Timestamp format details

### What Can Change

Without breaking tests:

- Internal log handler implementation
- Error message wording
- New optional fields added to payload (additive changes)
- Perception type registry entries
- Log handler parameter structure

---

## Testing Plan

### Correct Test Assertions

```javascript
// ✅ CORRECT - Validate observable payload fields
expect(perceptibleEvent.payload.descriptionText).toBe('Alice reads the letter.');
expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
expect(perceptibleEvent.payload.targetId).toBe('letter-1');
expect(perceptibleEvent.payload.perceptionType).toBe('item.examine');
expect(perceptibleEvent.payload.locationId).toBe('study');

// ✅ CORRECT - Check log_entry indicator
expect(perceptibleEvent.payload.contextualData.skipRuleLogging).toBe(true);

// ✅ CORRECT - Check custom contextual data
expect(perceptibleEvent.payload.contextualData.readableText).toBe('Secret content');

// ✅ CORRECT - Verify field does NOT exist (negative assertion)
expect(perceptibleEvent.payload.actorDescription).toBeUndefined();
```

### Incorrect Test Assertions (DO NOT USE)

```javascript
// ❌ WRONG - These fields do not exist in payload
expect(perceptibleEvent.payload.actorDescription).toBeDefined();
expect(perceptibleEvent.payload.alternateDescriptions).toBeDefined();
expect(perceptibleEvent.payload.logEntry).toBe(true);
expect(perceptibleEvent.payload.targetDescription).toBeDefined();
```

### Tests to Update/Add

1. **Existing Integration Tests**: Update any test asserting on non-existent payload fields
2. **Contract Tests**: Add explicit tests verifying invariants:
   ```javascript
   it('should NOT include actorDescription in payload', async () => {
     // Execute action with actor_description in rule
     expect(event.payload.actorDescription).toBeUndefined();
     expect(event.payload.contextualData.skipRuleLogging).toBe(true);
   });
   ```

### Regression Tests

Add to `tests/integration/logging/dispatchPerceptibleEvent.integration.test.js` (create if needed):

1. **Payload contract verification** - Assert exact payload structure
2. **Internal field exclusion** - Verify `actor_description` etc. not in payload
3. **skipRuleLogging indicator** - Verify correlation with `log_entry`
4. **Custom contextual_data passthrough** - Verify custom fields preserved

### Property Tests (Future Enhancement)

Consider property-based testing:

```javascript
// For any valid DISPATCH_PERCEPTIBLE_EVENT parameters:
// - Payload never contains actorDescription, alternateDescriptions, logEntry
// - skipRuleLogging === log_entry parameter value
// - Custom contextual_data fields are preserved
```

---

## Prevention Mechanisms

### For Future Development

1. **Read this spec** before writing tests for perception events
2. **Check payload structure** in handler code (lines 226-241) when uncertain
3. **Use correct assertions** from the "Correct Test Assertions" section above
4. **Remember the rule**: Internal parameters stay internal

### Suggested Tooling (Optional Future Work)

- **TypeScript interfaces** for payload structure
- **Test helper** that validates payload against contract
- **Linting rule** to catch assertions on non-existent fields

---

## References

- Handler implementation: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js:226-272`
- Companion spec: `specs/dispatch-perceptible-event-upgrades.spec.md`
- Sense-aware perception docs: `docs/modding/sense-aware-perception.md`
- Perception type registry: `src/perception/registries/perceptionTypeRegistry.js`
