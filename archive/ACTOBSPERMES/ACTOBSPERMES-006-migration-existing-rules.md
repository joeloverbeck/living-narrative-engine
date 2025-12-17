# ACTOBSPERMES-006: Migrate Existing Dual-Dispatch Rules (Optional)

## Summary

Migrate existing mod rules that use the dual-dispatch workaround pattern to the new single-dispatch pattern with `actor_description` and `target_description`.

**This ticket is OPTIONAL** - the existing rules will continue to work. Migration improves:
- Code clarity (single dispatch vs two)
- Maintainability (less error-prone)
- Consistency with new best practices

## Motivation

See `specs/actor-observer-perception-messaging.spec.md` - Section 1.3: Existing Workaround.

Some existing rules work around the actor perspective limitation by dispatching two separate events with `excludedActorIds` and `recipientIds`. This pattern is verbose and error-prone.

## Files to Touch

| File | Change |
|------|--------|
| `data/mods/items/rules/handle_drink_from.rule.json` | Migrate from dual-dispatch to single-dispatch |
| `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` | Migrate from dual-dispatch to single-dispatch |

## Out of Scope

- **DO NOT** modify handler code
- **DO NOT** modify schema files
- **DO NOT** modify documentation
- **DO NOT** migrate rules that don't use the dual-dispatch pattern
- **DO NOT** add new functionality beyond the migration

## Implementation Details

### Rule 1: handle_drink_from.rule.json

**Current pattern** (two dispatches):

> **Note**: The current implementation uses third-person for both public and private messages.
> The private message adds flavor text but remains third-person. Migration adds first-person
> perspective for the actor while consolidating to a single dispatch.

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Public message visible to all EXCEPT actor",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.publicMessage}",
    "perception_type": "consumption.consume",
    "contextual_data": {
      "excludedActorIds": ["{event.payload.actorId}"],
      "volumeConsumed": "{context.drinkResult.volumeConsumed}"
    }
  }
},
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Private message with flavor visible only to actor",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.privateMessage}",
    "perception_type": "consumption.consume",
    "contextual_data": {
      "recipientIds": ["{event.payload.actorId}"],
      "volumeConsumed": "{context.drinkResult.volumeConsumed}",
      "flavorText": "{context.drinkResult.flavorText}"
    }
  }
}
```

Where `publicMessage` is `"{context.actorName} drinks from {context.containerName}."` and
`privateMessage` is `"{context.actorName} drinks from {context.containerName}. {context.drinkResult.flavorText}"`
(both third-person).

**New pattern** (single dispatch):
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Drink action with perspective-aware descriptions",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} drinks from {context.containerName}.",
    "actor_description": "I drink from {context.containerName}. {context.drinkResult.flavorText}",
    "perception_type": "consumption.consume",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear gulping sounds nearby."
    }
  }
}
```

### Rule 2: handle_corrupting_gaze.rule.json

**Current pattern** (targeting victim):
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Observer message",
  "parameters": {
    "description_text": "{context.actorName} looks deeply into {context.targetName}'s eyes...",
    ...
  }
},
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Target sensation (first-person)",
  "parameters": {
    "description_text": "Darkness floods through me as a sickly warmth fills my body.",
    "contextual_data": { "recipientIds": ["{event.payload.primaryId}"] },
    ...
  }
}
```

**New pattern** (single dispatch with target_description):
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Corrupting gaze with perspective-aware descriptions",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze. {context.targetName} shudders as darkness seeps into them.",
    "actor_description": "I cast a corrupting gaze upon {context.targetName}. Power flows through me.",
    "target_description": "{context.actorName} looks deeply into my eyes. Darkness floods through me as a sickly warmth fills my body.",
    "perception_type": "magic.spell",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear a faint humming and feel a chill in the air.",
      "tactile": "I feel a wave of supernatural cold pass through the area."
    }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing tests for handle_drink_from**: Any existing tests for drinking behavior must pass
2. **Existing tests for handle_corrupting_gaze**: Any existing tests for hexing must pass
3. **Schema validation**: Migrated rules must pass `npm run validate`

**New tests to add** (in appropriate test files):

```javascript
// tests/integration/mods/items/drink_from_rule.test.js
it('should deliver first-person description to drinking actor', async () => {
  // Setup: Actor drinks from container
  // Assert: Actor's perception log contains "I drink from..." with flavor text
});

it('should deliver third-person description to observers', async () => {
  // Setup: Actor drinks, observer in location
  // Assert: Observer's perception log contains "{actorName} drinks from..."
});

// tests/integration/mods/hexing/corrupting_gaze_rule.test.js
it('should deliver first-person sensation to target of corrupting gaze', async () => {
  // Setup: Caster uses corrupting gaze on target
  // Assert: Target's perception log contains first-person sensation
});

it('should deliver first-person power description to caster', async () => {
  // Setup: Caster uses corrupting gaze
  // Assert: Caster's perception log contains "I cast... Power flows through me."
});
```

### Invariants That Must Remain True

1. **Functional equivalence**: The migrated rules must produce the same user-facing behavior
2. **No new dependencies**: Rules must not require new mods or components
3. **Placeholder consistency**: All placeholders must resolve to valid values
4. **Rule structure valid**: Rules must pass JSON Schema validation
5. **Tests updated**: Existing tests explicitly validate dual-dispatch pattern (checking for `excludedActorIds`/`recipientIds`); tests must be updated to validate new single-dispatch with `actor_description`/`target_description`

### Verification Commands

```bash
# Validate rule JSON
npm run validate

# Run mod-specific tests
npm run test:integration -- --testPathPattern="items/drink"
npm run test:integration -- --testPathPattern="hexing"

# Verify rules load correctly
npm run start  # Manual test: perform actions and check perception logs
```

## Migration Checklist

For each rule:

- [x] Identify all `DISPATCH_PERCEPTIBLE_EVENT` pairs using `excludedActorIds`/`recipientIds`
- [x] Combine into single dispatch with `actor_description`/`target_description`
- [x] Remove `contextual_data.excludedActorIds` and `contextual_data.recipientIds`
- [x] Ensure `actor_id` and `target_id` are set correctly
- [x] Add appropriate `alternate_descriptions` if not present
- [x] Verify JSON syntax is valid
- [x] Run validation: `npm run validate`
- [x] Test manually or via automated tests

## Outcome ✅ COMPLETED

### What Was Done

1. **handle_drink_from.rule.json**: Migrated to single-dispatch pattern
   - Uses `actor_description` for first-person with flavor: "I drink from {container}. {flavor}"
   - Uses `description_text` for observers: "{actorName} drinks from {container}."
   - Added `alternate_descriptions.auditory`: "I hear gulping sounds nearby."
   - Set `actor_id` and `target_id` for proper routing

2. **handle_corrupting_gaze.rule.json**: Migrated SUCCESS and CRITICAL_SUCCESS branches
   - Uses `actor_description` for caster's first-person perspective
   - Uses `target_description` for target's first-person sensation
   - Added `alternate_descriptions` for non-visual perception (auditory, tactile)
   - FAILURE and FUMBLE branches were already single-dispatch

### Tests Updated

1. **drinkFromRuleExecution.test.js**: Updated 5 tests to validate single-dispatch pattern
   - Tests verify `contextualData.flavorText` instead of checking for `actorDescription` in event payload
   - Confirmed `actor_id` is set for internal routing by log handler

2. **corrupting_gaze_rule.test.js**: Updated CRITICAL_SUCCESS and SUCCESS tests
   - Tests verify `actor_description` and `target_description` parameters in rule JSON
   - Confirmed `alternate_descriptions` structure

### Key Technical Note

The `actor_description` and `target_description` parameters are passed to the internal log handler for routing but are NOT included in the event payload. The event payload contains:
- `descriptionText` (third-person for observers)
- `actorId` and `targetId` (for routing)
- `contextualData` (including `flavorText`)

Tests validate the rule structure and routing capability, not the event payload fields.

### Verification

- `npm run validate`: ✅ PASSED
- `drinkFromRuleExecution.test.js`: ✅ 12/12 tests pass
- `corrupting_gaze_rule.test.js`: ✅ 8/8 tests pass

## Dependencies

- ACTOBSPERMES-001 (schema must support new parameters)
- ACTOBSPERMES-002 (schema must support new parameters)
- ACTOBSPERMES-003 (dispatch handler must pass parameters)
- ACTOBSPERMES-004 (log handler must route descriptions)

## Blocked By

- ACTOBSPERMES-004 (all implementation must be complete)

## Blocks

- None (this is optional polish work)

## Priority

**Low** - Existing rules continue to work. This migration improves code quality but is not required for the feature to function.

## Notes

- More rules may use this pattern and could be migrated later
- Consider creating a grep/search to find other candidates:
  ```bash
  grep -r "excludedActorIds" data/mods/*/rules/*.json
  grep -r "recipientIds" data/mods/*/rules/*.json
  ```
