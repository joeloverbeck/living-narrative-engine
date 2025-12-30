# GRA001CHABASGRANECACT-007: Create handle_grab_neck_target Rule

**STATUS: COMPLETED**

## Summary
Create the new `handle_grab_neck_target.rule.json` file that handles all four outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) with proper state changes, appendage locking, and sense-aware perceptible events. Register the rule and condition in the grabbing mod manifest, and add focused integration tests to validate wiring and outcome branches.

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing/rules/handle_grab_neck_target.rule.json`
- `tests/integration/mods/grabbing/handle_grab_neck_target_rule_validation.test.js`

### Files to Modify
- `data/mods/grabbing/mod-manifest.json`

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing/rules/handle_grab_neck.rule.json` (deleted in separate ticket)
- `data/mods/grabbing/rules/handle_squeeze_neck_with_both_hands.rule.json`
- Any action files
- Any condition files (except referencing the new one and manifest registration)
- Any files in `data/mods/grabbing-states/`
- Any source code in `src/`

## Implementation Details

### Rule Structure Overview

The rule must handle four outcomes from the opposed contest:

| Outcome | Actor State Change | Target State Change | Appendage | Narrative Tone |
|---------|-------------------|---------------------|-----------|----------------|
| CRITICAL_SUCCESS | Add `grabbing_neck` | Add `neck_grabbed` | Lock 1 | Predatory, iron grip |
| SUCCESS | Add `grabbing_neck` | Add `neck_grabbed` | Lock 1 | Firm, controlled |
| FAILURE | None | None | None | Evaded attempt |
| FUMBLE | Add `fallen` | None | None | Crash to ground |

### Rule Operations Sequence

1. **Setup Phase**
   - `GET_NAME` for actor and target
   - `QUERY_COMPONENT` for actor position (location ID)
   - `SET_VARIABLE` for locationId, perceptionType, targetId

2. **Outcome Resolution**
   - `RESOLVE_OUTCOME` operation with melee_skill vs mobility_skill
   - Use `target_role: "primary"` to align with the existing action config

3. **Conditional Branches**
   - `IF` blocks for each outcome checking `context.attackResult.outcome`

### Perceptible Event Template (for each outcome)

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "perception_type": "physical.target_action",
    "description_text": "[Third-person narrative]",
    "actor_description": "[First-person actor narrative]",
    "target_description": "[First-person target narrative]",
    "alternate_descriptions": {
      "auditory": "[Auditory description]",
      "tactile": "[Tactile description]"
    }
  }
}
```

### Narratives by Outcome

| Outcome | description_text | actor_description | target_description |
|---------|------------------|-------------------|-------------------|
| CRITICAL_SUCCESS | "{actorName} lunges forward with predatory speed, seizing {targetName}'s neck in an iron grip!" | "I lunge forward with predatory speed, seizing {targetName}'s neck in an iron grip!" | "{actorName} lunges forward with predatory speed, seizing my neck in an iron grip!" |
| SUCCESS | "{actorName} reaches out and grabs {targetName}'s neck, gaining a firm hold." | "I reach out and grab {targetName}'s neck, gaining a firm hold." | "{actorName} reaches out and grabs my neck, gaining a firm hold." |
| FAILURE | "{actorName} reaches for {targetName}'s neck, but {targetName} manages to evade the grab." | "I reach for {targetName}'s neck, but they manage to evade my grab." | "{actorName} reaches for my neck, but I manage to evade the grab." |
| FUMBLE | "{actorName} lunges recklessly at {targetName}'s throat, completely overextending and crashing to the ground!" | "I lunge recklessly at {targetName}'s throat, completely overextending and crashing to the ground!" | "{actorName} lunges recklessly at my throat, completely overextending and crashing to the ground!" |

### Alternate Descriptions

| Outcome | auditory | tactile |
|---------|----------|---------|
| CRITICAL_SUCCESS | "I hear a sudden scuffle and a choking sound nearby." | "I feel the impact of bodies colliding nearby." |
| SUCCESS | "I hear sounds of a brief struggle nearby." | "I feel vibrations of physical contact nearby." |
| FAILURE | "I hear shuffling and movement nearby." | (omit) |
| FUMBLE | "I hear someone stumble and fall heavily nearby." | "I feel the thud of someone hitting the ground nearby." |

### Key Operations

**LOCK_GRABBING** (for CRITICAL_SUCCESS and SUCCESS):
```json
{
  "type": "LOCK_GRABBING",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "count": 1,
    "item_id": "{event.payload.targetId}"
  }
}
```

**ADD_COMPONENT** for grabbing_neck (actor):
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "grabbing-states:grabbing_neck",
    "value": {
      "grabbed_entity_id": "{event.payload.targetId}",
      "initiated": true,
      "consented": false
    }
  }
}
```

**ADD_COMPONENT** for neck_grabbed (target):
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "grabbing-states:neck_grabbed",
    "value": {
      "grabbing_entity_id": "{event.payload.actorId}",
      "consented": false
    }
  }
}
```

**ADD_COMPONENT** for fallen (actor, FUMBLE only):
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "recovery-states:fallen",
    "value": {}
  }
}
```

**REGENERATE_DESCRIPTION** (after adding components, SUCCESS/CRITICAL_SUCCESS only):
```json
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "target"
  }
}
```

### End Turn Macros
- CRITICAL_SUCCESS/SUCCESS: `{ "macro": "core:endTurnOnly" }`
- FAILURE/FUMBLE: `{ "macro": "core:logFailureOutcomeAndEndTurn" }`

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- Rule schema validation passes (valid against rule.schema.json)
- All component references resolve correctly
- All condition references resolve correctly

### Invariants That Must Remain True
- Rule ID follows `handle_{action_name}` pattern
- Event type is `core:attempt_action`
- Condition uses `condition_ref` to reference the new condition
- All four outcomes are handled (no missing branches)
- CRITICAL_SUCCESS and SUCCESS add BOTH components to BOTH entities
- CRITICAL_SUCCESS and SUCCESS call LOCK_GRABBING with count=1
- CRITICAL_SUCCESS and SUCCESS regenerate descriptions for actor + target
- FAILURE adds no components and doesn't lock appendages
- FUMBLE adds `recovery-states:fallen` to ACTOR only
- FUMBLE does NOT lock appendages
- All perceptible events include sense-aware alternate descriptions
- Old rule file is NOT modified (separate deletion ticket)
- Grabbing mod manifest registers the new rule + condition file names

## Verification Steps

1. File exists: `data/mods/grabbing/rules/handle_grab_neck_target.rule.json`
2. JSON is syntactically valid
3. `npm run validate` passes
4. Rule follows established pattern from `physical-control:handle_restrain_target.rule.json`
5. All four outcomes produce distinct behavior
6. Integration tests for rule wiring/outcomes pass

## Dependencies
- GRA001CHABASGRANECACT-002 (grabbing_neck component)
- GRA001CHABASGRANECACT-003 (neck_grabbed component)
- GRA001CHABASGRANECACT-005 (action exists)
- GRA001CHABASGRANECACT-006 (condition exists)

## Blocked By
- None (condition already present)

## Blocks
- GRA001CHABASGRANECACT-011 (rule execution tests)

## Complexity Note
This is the largest single ticket in the sequence. The rule JSON will be 200-400 lines. If this feels too large for comfortable review, consider splitting into:
- 007a: Setup and CRITICAL_SUCCESS branch
- 007b: SUCCESS branch
- 007c: FAILURE and FUMBLE branches

However, the rule must be valid JSON and all branches must exist for the mod to function, so partial implementations are not valid states.

## Outcome

### What Was Actually Changed
- Added `data/mods/grabbing/rules/handle_grab_neck_target.rule.json` with outcome branches, state changes, and perceptible events.
- Registered the rule and condition in `data/mods/grabbing/mod-manifest.json`.
- Added `tests/integration/mods/grabbing/handle_grab_neck_target_rule_validation.test.js` to validate wiring and outcome branches.

### Compared to Original Plan
- Expanded scope to include manifest registration and a focused integration test so the rule is discoverable and validated.
