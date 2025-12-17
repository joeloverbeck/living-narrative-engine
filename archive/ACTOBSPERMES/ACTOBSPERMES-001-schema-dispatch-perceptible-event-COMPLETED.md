# ACTOBSPERMES-001: Add actor_description and target_description to dispatchPerceptibleEvent Schema

## Summary

Add two new optional string parameters (`actor_description` and `target_description`) to the `DISPATCH_PERCEPTIBLE_EVENT` operation schema. These enable perspective-aware messaging where actors receive first-person descriptions of their own actions, and targets receive target-perspective descriptions (typically written from the target’s point of view).

## Motivation

See `specs/actor-observer-perception-messaging.spec.md` - Section 1: Problem Statement.

Currently, actors receive the same third-person, sense-filtered message as all observers. This creates immersion-breaking experiences where actors appear unaware of their own actions (e.g., "You hear sounds of exertion nearby" when the actor is performing a handstand in darkness).

## Files to Touch

| File | Change |
|------|--------|
| `data/schemas/operations/dispatchPerceptibleEvent.schema.json` | Add `actor_description` and `target_description` properties |

## Out of Scope

- **DO NOT** modify handler logic (`dispatchPerceptibleEventHandler.js`)
- **DO NOT** modify `addPerceptionLogEntry.schema.json` (separate ticket)
- **DO NOT** update documentation
- **DO NOT** add new required fields - both parameters must be optional

## Assumptions Check (Current Repo State)

- `data/schemas/operations/dispatchPerceptibleEvent.schema.json` exists and currently validates `DISPATCH_PERCEPTIBLE_EVENT` via an existing unit test suite.
- Schema validation tests for this operation already live in `tests/unit/schemas/senseAwareOperationSchemas.test.js` (no need to create a new dedicated test file).
- The project already has an `npm run validate:operations` script that validates operation schemas/types, and `npm run validate:strict` for mod validation.

## Implementation Details

Add the following properties to the `Parameters` object in `$defs`:

```json
"actor_description": {
  "type": "string",
  "minLength": 1,
  "description": "First-person description delivered to the actor (e.g., 'I do a handstand'). When provided, the actor receives this message without sensory filtering - they always know what they're doing."
},
"target_description": {
  "type": "string",
  "minLength": 1,
  "description": "Target-perspective description delivered to the target (e.g., '{context.actorName} caresses my cheek gently.'). When provided, the target receives this message. Sensory filtering still applies. Note: Only provide if target is an entity with a perception log component - a warning is emitted if target lacks this component."
}
```

**Placement**: Add after `target_id` property, before `involved_entities`.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation test**: Validate JSON with `actor_description` and/or `target_description` against the schema
2. **Schema validation test**: Validate that existing rules (without new fields) still pass schema validation
3. **Schema validation test**: Validate that empty string values for new fields are rejected (`minLength: 1`)

**Test file location**: `tests/unit/schemas/senseAwareOperationSchemas.test.js` (extend existing `DISPATCH_PERCEPTIBLE_EVENT schema` block)

Example test cases:
```javascript
// Valid: Both optional fields provided
{ "type": "DISPATCH_PERCEPTIBLE_EVENT", "parameters": {
    "location_id": "loc1", "description_text": "...", "perception_type": "physical.self_action",
    "actor_id": "a1", "actor_description": "I do a thing.", "target_description": "Someone does a thing to me."
}}

// Valid: Only actor_description provided
{ "type": "DISPATCH_PERCEPTIBLE_EVENT", "parameters": {
    "location_id": "loc1", "description_text": "...", "perception_type": "physical.self_action",
    "actor_id": "a1", "actor_description": "I do a thing."
}}

// Valid: Neither new field provided (backward compatibility)
{ "type": "DISPATCH_PERCEPTIBLE_EVENT", "parameters": {
    "location_id": "loc1", "description_text": "...", "perception_type": "physical.self_action",
    "actor_id": "a1"
}}

// Invalid: Empty actor_description
{ "type": "DISPATCH_PERCEPTIBLE_EVENT", "parameters": {
    "location_id": "loc1", "description_text": "...", "perception_type": "physical.self_action",
    "actor_id": "a1", "actor_description": ""
}}
```

### Invariants That Must Remain True

1. **Backward compatibility**: All existing mod rules using `DISPATCH_PERCEPTIBLE_EVENT` must continue to pass schema validation
2. **No new required fields**: `required` array must NOT include `actor_description` or `target_description`
3. **additionalProperties: false**: Schema must continue to reject unknown properties
4. **Existing properties unchanged**: No modifications to existing property definitions

### Verification Commands

```bash
# Validate the schema itself is valid JSON Schema
npm run validate:strict

# Validate operation schema/types wiring
npm run validate:operations

# Run schema validation tests (targeted)
npm run test:single -- --config jest.config.unit.js --testPathPatterns="senseAwareOperationSchemas"

# Verify backward compatibility with existing rules
npm run validate
```

## Dependencies

- None (this is a schema-only change)

## Blocked By

- None

## Blocks

- ACTOBSPERMES-003 (handler modification needs schema to accept new params)

## Status

- [x] Completed

## Outcome

Originally planned:
- Add `actor_description` / `target_description` to the schema.
- Create a new dedicated schema test file (and/or defer tests to handler tickets).

Actually changed:
- Added `actor_description` and `target_description` to `data/schemas/operations/dispatchPerceptibleEvent.schema.json` as optional non-empty strings.
- Extended the existing schema test suite in `tests/unit/schemas/senseAwareOperationSchemas.test.js` (no new test file), including invalid empty-string cases.
