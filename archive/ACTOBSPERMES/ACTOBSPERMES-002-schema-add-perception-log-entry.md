# ACTOBSPERMES-002: Add actor_description, target_description, and target_id to addPerceptionLogEntry Schema

## Status: ✅ COMPLETED

**Completed**: 2025-12-17

## Summary

Add three new optional parameters to the `ADD_PERCEPTION_LOG_ENTRY` operation schema to support pass-through of perspective-aware messaging fields from `DISPATCH_PERCEPTIBLE_EVENT`.

## Motivation

The `addPerceptionLogEntryHandler` is called by `dispatchPerceptibleEventHandler` when `log_entry: true`. To route actor/target-specific descriptions, these parameters must be accepted by the schema.

See `specs/actor-observer-perception-messaging.spec.md` - Section 2: Proposed Solution.

## Files to Touch

| File | Change |
|------|--------|
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | Add `actor_description`, `target_description`, and `target_id` properties |

## Out of Scope

- **DO NOT** modify handler logic (`addPerceptionLogEntryHandler.js`)
- **DO NOT** modify `dispatchPerceptibleEvent.schema.json` (separate ticket ACTOBSPERMES-001)
- **DO NOT** update documentation
- **DO NOT** add new required fields - all new parameters must be optional

**Note**: Schema validation tests ARE in scope for this ticket, as schema changes require validation tests.

## Implementation Details

Add the following properties to the `Parameters` object in `$defs`:

```json
"actor_description": {
  "type": "string",
  "minLength": 1,
  "description": "First-person description delivered to the actor. Passed through from DISPATCH_PERCEPTIBLE_EVENT. When provided, the actor receives this message without sensory filtering."
},
"target_description": {
  "type": "string",
  "minLength": 1,
  "description": "First-person description delivered to the target. Passed through from DISPATCH_PERCEPTIBLE_EVENT. When provided, the target receives this message with sensory filtering applied."
},
"target_id": {
  "type": ["string", "null"],
  "description": "The ID of the target entity, if any. Used to route target_description to the correct recipient."
}
```

**Placement**: Add after `excluded_actor_ids` property, before `alternate_descriptions`.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation test**: Validate JSON with new fields passes schema validation
2. **Schema validation test**: Validate that existing calls (without new fields) still pass
3. **Schema validation test**: Validate that empty string values for description fields are rejected

**Test file location**: `tests/unit/schemas/senseAwareOperationSchemas.test.js` (existing file - add to `ADD_PERCEPTION_LOG_ENTRY schema` describe block)

Example test cases:
```javascript
// Valid: All new fields provided
{ "type": "ADD_PERCEPTION_LOG_ENTRY", "parameters": {
    "location_id": "loc1", "entry": { "descriptionText": "..." },
    "actor_description": "I do a thing.",
    "target_description": "Someone does a thing to me.",
    "target_id": "target1"
}}

// Valid: Only actor_description provided
{ "type": "ADD_PERCEPTION_LOG_ENTRY", "parameters": {
    "location_id": "loc1", "entry": { "descriptionText": "..." },
    "actor_description": "I do a thing."
}}

// Valid: target_id is null
{ "type": "ADD_PERCEPTION_LOG_ENTRY", "parameters": {
    "location_id": "loc1", "entry": { "descriptionText": "..." },
    "target_id": null
}}

// Valid: Neither new field provided (backward compatibility)
{ "type": "ADD_PERCEPTION_LOG_ENTRY", "parameters": {
    "location_id": "loc1", "entry": { "descriptionText": "..." }
}}

// Invalid: Empty actor_description
{ "type": "ADD_PERCEPTION_LOG_ENTRY", "parameters": {
    "location_id": "loc1", "entry": { "descriptionText": "..." },
    "actor_description": ""
}}
```

### Invariants That Must Remain True

1. **Backward compatibility**: Existing calls to `ADD_PERCEPTION_LOG_ENTRY` must continue to pass validation
2. **No new required fields**: `required` array must remain `["location_id", "entry"]`
3. **additionalProperties: false**: Schema must continue to reject unknown properties
4. **Existing properties unchanged**: No modifications to existing property definitions

### Verification Commands

```bash
# Validate the schema itself is valid JSON Schema
npm run validate:strict

# Run schema validation tests
npm run test:unit -- --testPathPattern="senseAwareOperationSchemas"

# Verify backward compatibility
npm run validate
```

## Dependencies

- None (this is a schema-only change)

## Blocked By

- None (can be done in parallel with ACTOBSPERMES-001)

## Blocks

- ACTOBSPERMES-004 (handler modification needs schema to accept new params)

---

## Outcome

### What Was Actually Changed

1. **Schema file modified**: `data/schemas/operations/addPerceptionLogEntry.schema.json`
   - Added `actor_description` property (string, minLength: 1)
   - Added `target_description` property (string, minLength: 1)
   - Added `target_id` property (string or null)
   - All new fields are optional (not added to `required` array)
   - Placement: After `excluded_actor_ids`, before `alternate_descriptions`

2. **Tests added**: `tests/unit/schemas/senseAwareOperationSchemas.test.js`
   - Added new `describe` block: `actor/target description fields (ACTOBSPERMES-002)`
   - 7 new test cases covering:
     - `actor_description` only
     - `target_description` with `target_id`
     - All new fields together
     - `target_id` set to null
     - Empty string rejection for `actor_description`
     - Empty string rejection for `target_description`
     - Integration with all existing fields

### Deviations from Original Plan

1. **Test file location changed**: Original ticket suggested creating `addPerceptionLogEntrySchema.test.js`, but tests were added to the existing `senseAwareOperationSchemas.test.js` to follow project patterns (this file already contained tests for both `DISPATCH_PERCEPTIBLE_EVENT` and `ADD_PERCEPTION_LOG_ENTRY` schemas).

2. **Ticket scope clarified**: Original "Out of Scope" said "DO NOT modify tests" but also listed acceptance criteria requiring tests. This contradiction was resolved by clarifying that schema validation tests ARE in scope.

### Test Results

- All 29 schema tests pass (22 existing + 7 new)
- `npm run validate:strict` passes with 0 violations across 65 mods
- Handler tests (`addPerceptionLogEntryHandler.test.js`) continue to pass (43 tests)
- No lint errors

### Files Modified

| File | Type | Lines Changed |
|------|------|---------------|
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | Schema | +14 |
| `tests/unit/schemas/senseAwareOperationSchemas.test.js` | Test | +160 |
| `tickets/ACTOBSPERMES-002-schema-add-perception-log-entry.md` | Ticket | +3 (corrections) |
