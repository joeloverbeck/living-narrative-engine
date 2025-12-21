# Specification: Breaching Mod - Saw Through Barred Blocker (Stage 2)

## Overview

Define the second stage of the three-stage breaching flow for barred blockers. This stage should be nearly identical to the existing `breaching:saw_through_barred_blocker` action and `handle_saw_through_barred_blocker` rule, with updates noted below for scoping and outcome messaging/state changes.

Reference files:
- `data/mods/breaching/actions/saw_through_barred_blocker.action.json`
- `data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json`
- `data/mods/blockers/scopes/sawable_barred_blockers.scope`

## Files To Add

### 1) New Scope (Stage 2)

**File**: `data/mods/blockers/scopes/sawable_barred_blockers_stage_two.scope`

**Scope ID**: `blockers:sawable_barred_blockers_stage_two`

**Behavior**:
- Same filtering as `blockers:sawable_barred_blockers`, but only includes blockers where a `core:progress_tracker` exists and has `value == 1`.
- This scope gates the second-stage action and guarantees stage-1 progress is present.

**Suggested DSL**:
```
blockers:sawable_barred_blockers_stage_two := location.locations:exits[].blocker[{
  "and": [
    { "!!": { "var": "entity.components.blockers:is_barred" } },
    { "!!": { "var": "entity.components.blockers:structural_resistance" } },
    { "!!": { "var": "entity.components.core:progress_tracker" } },
    { "==": [{ "var": "entity.components.core:progress_tracker.value" }, 1] }
  ]
}]
```

### 2) Action (Stage 2)

**File**: `data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json`

**Action ID**: `breaching:saw_through_barred_blocker_stage_two`

**Structure**:
- Keep all fields identical to `breaching:saw_through_barred_blocker` (template, description, chanceBased, modifiers, visuals, required_components, etc.).
- Only change the primary target scope to `blockers:sawable_barred_blockers_stage_two`.

**Key Differences vs stage 1**:
- `targets.primary.scope` is the new stage-two scope.

### 3) Condition (Stage 2)

**File**: `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker-stage-two.condition.json`

**Condition ID**: `breaching:event-is-action-saw-through-barred-blocker-stage-two`

**Logic**:
- Exact match against the new action ID.

### 4) Rule (Stage 2)

**File**: `data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_two.rule.json`

**Rule ID**: `handle_saw_through_barred_blocker_stage_two`

**Structure**:
- Keep the overall rule flow and steps identical to `handle_saw_through_barred_blocker.rule.json`.
- Update description_text values per outcome as specified below.
- On CRITICAL_SUCCESS, also set the target blocker's `mechanisms:openable.isOpen` to `true`.

#### Outcome Changes

**CRITICAL_SUCCESS**
- `description_text`:
  - `{context.actorName} finds the perfect angle and bites deep into {context.blockerName}' bars with {context.toolName}, sending sparks flying. The opening now will allow passing through.`
- Progress tracker increment:
  - Increase by `+2` (same increment logic as stage 1, but applied to stage 2).
- Openable change:
  - Set `mechanisms:openable.isOpen` to `true` on the target barred blocker (primary).

**SUCCESS**
- `description_text`:
  - `{context.actorName} steadily works the {context.toolName} across {context.blockerName}, clearing the second bar and opening the gap further; it's now close to shoulder-width, but not quite.`
- Progress tracker increment:
  - Increase by `+1`.

**FAILURE**
- Keep identical to `handle_saw_through_barred_blocker.rule.json` (no text or behavior changes).

**FUMBLE**
- `description_text`:
  - `As {context.actorName} starts cutting through {context.blockerName}'s second bar, {context.actorName} loses control of {context.toolName}; it clatters to the ground.`
- Other behaviors remain identical (unwield, drop item, log failure).

## Testing Requirements

Create new tests that mirror the stage-1 test suite. Use these as reference and pattern templates:
- `tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js`
- `tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js`
- `tests/integration/mods/breaching/saw_through_barred_blocker_modifier_chance.test.js`

### Action Discoverability Tests

Add a new discovery suite for the stage-2 action that validates:
- Action is discoverable only when the primary target has `core:progress_tracker.value == 1`.
- Action is not discoverable when:
  - `core:progress_tracker` is missing.
  - `core:progress_tracker.value == 0`.
  - `core:progress_tracker.value > 1`.
- The action still requires the same sawing tool and barred blocker components as stage 1.
- The chance-based metadata (contest type, skills, corroded modifier) matches stage 1.

### Rule Behavior Tests

Add a new rule-execution suite for stage 2 to cover:
- **CRITICAL_SUCCESS**:
  - Progress tracker increments by `+2`.
  - `mechanisms:openable.isOpen` becomes `true` on the barred blocker.
  - Perceptible event uses the new `description_text`.
- **SUCCESS**:
  - Progress tracker increments by `+1`.
  - Perceptible event uses the new `description_text`.
- **FAILURE**:
  - Same behavior as stage 1 (no progress changes, same text).
- **FUMBLE**:
  - Tool is unwielded and dropped.
  - Perceptible event uses the new `description_text`.

### Modifier/Chance Tests

If a dedicated modifier test is added for stage 2, mirror the stage-1 expectations (corroded modifier present and applied) to ensure the action metadata is unchanged aside from the primary scope.

## Notes

- Do not change the existing stage-1 files.
- The stage-2 action should be discoverable only after stage-1 progress is recorded (progress tracker at 1).
- The stage-2 rule should preserve logging macros and all non-specified messaging fields (actor_description, alternate_descriptions) unless intentionally changed later.