# BEAATTCAP-005: Create handleBeakFumble Macro

**Status**: ✅ COMPLETED (2025-12-05)

## Summary

Create the `violence:handleBeakFumble` macro that handles fumble outcomes for beak attacks. Unlike melee weapon fumbles (which drop the weapon), beak fumbles cause the attacker to lose balance and fall.

## Motivation

Beaks are natural weapons that cannot be dropped. When a peck attack fumbles, the realistic consequence is the attacker overextending and falling, not dropping their "weapon."

## Files to Touch

| File                                                    | Change Type                             |
| ------------------------------------------------------- | --------------------------------------- |
| `data/mods/violence/macros/handleBeakFumble.macro.json` | **Create**                              |
| `data/mods/violence/macros/.gitkeep`                    | **Create** (if directory doesn't exist) |

## Out of Scope

- **DO NOT** modify existing macros (especially `weapons:handleMeleeFumble`)
- **DO NOT** change the `positioning:fallen` component schema
- **DO NOT** modify operation handlers
- **DO NOT** create additional fumble macros for other natural weapons

## Implementation Details

### Macro Definition

**File**: `data/mods/violence/macros/handleBeakFumble.macro.json`

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "violence:handleBeakFumble",
  "description": "Handles FUMBLE outcome for beak attacks - actor loses balance and falls. Expects context variables: actorName, targetName, attackVerbPast, actorPosition.",
  "actions": [
    {
      "type": "ADD_COMPONENT",
      "comment": "Fumble: actor falls from overextending",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:fallen",
        "value": {}
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} lunges forward with their beak but completely misses, losing balance and falling to the ground!",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lunges forward with their beak but completely misses, losing balance and falling to the ground!"
      }
    },
    {
      "macro": "core:logFailureOutcomeAndEndTurn"
    }
  ]
}
```

**Note (Schema Correction)**: The original spec referenced a `data.reason` property for `positioning:fallen`, but the actual component schema only accepts `activityMetadata` (optional) or an empty object `{}`. The `reason` field was removed to match the actual schema. See `data/mods/distress/rules/throw_self_to_ground.rule.json` for reference.

### Directory Structure

Create directory if needed:

```
data/mods/violence/macros/
├── .gitkeep
└── handleBeakFumble.macro.json
```

### Comparison with `weapons:handleMeleeFumble`

| Aspect                | handleMeleeFumble      | handleBeakFumble          |
| --------------------- | ---------------------- | ------------------------- |
| UNWIELD_ITEM          | ✓ (drops weapon)       | ✗ (no weapon to drop)     |
| DROP_ITEM_AT_LOCATION | ✓                      | ✗                         |
| ADD_COMPONENT fallen  | ✗                      | ✓                         |
| Narrative             | "loses grip on weapon" | "loses balance and falls" |

### Expected Context Variables

The macro expects these variables to be set by the rule before invocation:

- `context.actorName` - Name of the attacking actor
- `context.targetName` - Name of the target (for potential future use)
- `context.attackVerbPast` - Past tense of attack verb (e.g., "pecked")
- `context.actorPosition` - Actor's position component with `locationId`

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:

   ```bash
   npm run validate:mod:violence
   ```

2. **Macro Schema Compliance**:
   - Valid `$schema` reference
   - Valid `id` format (namespaced)
   - All operations have valid `type` values
   - All parameter references use valid syntax

3. **Unit Tests** (create `tests/unit/mods/violence/handleBeakFumbleMacro.test.js`):

   ```javascript
   describe('violence:handleBeakFumble macro', () => {
     it('should have valid macro schema structure');
     it('should add positioning:fallen component to actor');
     it('should dispatch perceptible event with fumble narrative');
     it('should call core:logFailureOutcomeAndEndTurn');
     it('should NOT include UNWIELD_ITEM or DROP_ITEM_AT_LOCATION operations');
   });
   ```

4. **Integration Test** (in BEAATTCAP-007):
   - When peck attack results in FUMBLE, actor has `positioning:fallen` component
   - Narrative event contains "losing balance"
   - Target receives no damage

### Invariants That Must Remain True

1. **Existing Macros Unchanged**: `weapons:handleMeleeFumble` and other macros unmodified
2. **Component Schema Compliance**: `positioning:fallen` component data matches schema
3. **Operation Type Validity**: All operation types are registered and valid
4. **Macro Termination**: Macro ends turn via `core:logFailureOutcomeAndEndTurn`

## Verification Commands

```bash
# Validate violence mod schemas
npm run validate:mod:violence

# Validate all mods
npm run validate

# Check macro file is valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/violence/macros/handleBeakFumble.macro.json')))"

# Run macro-related tests (when created)
npm run test:unit -- --testPathPattern="handleBeakFumble" --verbose
```

## Dependencies

- None directly, but relies on:
  - `positioning:fallen` component existing (it does)
  - `core:logFailureOutcomeAndEndTurn` macro existing (it does)
  - `DISPATCH_PERCEPTIBLE_EVENT` operation handler (it does)
  - `ADD_COMPONENT` operation handler (it does)

## Blocked By

- None

## Blocks

- BEAATTCAP-006 (rule needs this macro for FUMBLE outcome)

## Notes

### Design Decision: Fall vs Other Fumble Effects

The spec chose "falling" as the fumble effect because:

1. It's physically realistic for overextending a peck attack
2. It has meaningful gameplay consequences (must get up)
3. It differs from weapon fumbles (makes natural weapons feel different)

Alternative fumble effects considered but rejected:

- "Stunned" - no existing component for this
- "Disoriented" - too abstract
- "Hurt self" - would require damage to self logic

### Positioning:fallen Component Reference

The `positioning:fallen` component should already exist in the positioning mod. If it doesn't, this ticket is blocked until it's created.

---

## Outcome

### Changes Actually Made

1. **Created macro file**: `data/mods/violence/macros/handleBeakFumble.macro.json`
   - Uses `ADD_COMPONENT` with `positioning:fallen` and empty `value: {}` (corrected from original spec's `data.reason`)
   - Uses `DISPATCH_PERCEPTIBLE_EVENT` with beak-specific narrative
   - Uses `SET_VARIABLE` for logMessage
   - Delegates to `core:logFailureOutcomeAndEndTurn`

2. **Updated mod manifest**: `data/mods/violence/mod-manifest.json`
   - Added `macros` array with `handleBeakFumble.macro.json`

3. **Created unit tests**: `tests/unit/mods/violence/macros/handleBeakFumble.test.js`
   - 18 test cases covering schema structure, operations, ordering, and key differentiators from weapon fumbles

### Deviations from Original Plan

| Planned                                          | Actual                                       | Reason                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `data: { reason: "lost_balance_attacking" }` | Use `value: {}`                              | The `positioning:fallen` component schema doesn't support a `reason` property; it only accepts `activityMetadata` (optional) or empty object |
| Test path: `handleBeakFumbleMacro.test.js`       | Test path: `macros/handleBeakFumble.test.js` | Better organization matching existing test structure                                                                                         |
| `.gitkeep` file                                  | Not created                                  | Directory creation handled automatically; .gitkeep unnecessary when actual files exist                                                       |

### Validation Results

- ✅ All 18 unit tests pass
- ✅ JSON syntax valid
- ✅ Ecosystem validation passes (52 mods, 0 violations)
- ✅ ESLint passes
- ✅ Macro schema integration tests pass
