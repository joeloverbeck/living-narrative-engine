## Goal
Add a third and final breaching stage for barred blockers: a new action, rule, scope, condition, and manifest updates. This stage mirrors stage two but targets blockers with a progress tracker value of 2 and finalizes the opening so actors can pass through comfortably.

## References
- `data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json`
- `data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_two.rule.json`
- `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker-stage-two.condition.json`
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_two.scope`
- `data/mods/blockers/mod-manifest.json`
- `data/mods/breaching/mod-manifest.json`
- Tests: `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_action_discovery.test.js`, `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_rule_execution.test.js`, and other breaching tests in `tests/integration/mods/breaching/`.

## New/Updated Content
### Blockers scope
- Create `data/mods/blockers/scopes/sawable_barred_blockers_stage_three.scope`.
- Match the stage two scope structure, but require `core:progress_tracker.value == 2`.
- Description comment should call out stage 2 progress.
- Update `data/mods/blockers/mod-manifest.json` to include the new scope file.

### Action
- Create `data/mods/breaching/actions/saw_through_barred_blocker_stage_three.action.json`.
- Copy `saw_through_barred_blocker_stage_two.action.json` and update:
  - `id` to `breaching:saw_through_barred_blocker_stage_three`.
  - Primary target `scope` to `blockers:sawable_barred_blockers_stage_three`.
  - Keep template/description/targets/required_components/chanceBased/visual identical otherwise.
- Update `data/mods/breaching/mod-manifest.json` to include the new action.

### Condition
- Create `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker-stage-three.condition.json`.
- Mirror the stage two condition but target `breaching:saw_through_barred_blocker_stage_three`.
- Update `data/mods/breaching/mod-manifest.json` to include the new condition.

### Rule
- Create `data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_three.rule.json`.
- Mirror `handle_saw_through_barred_blocker_stage_two.rule.json`, with these changes:
  - `rule_id`: `handle_saw_through_barred_blocker_stage_three`.
  - Condition ref: `breaching:event-is-action-saw-through-barred-blocker-stage-three`.
  - CRITICAL_SUCCESS branch:
    - `DISPATCH_PERCEPTIBLE_EVENT.description_text`:
      `{context.actorName} finds the perfect angle and bites deep into {context.blockerName}' bars with {context.toolName}, sending sparks flying. The opening now will allow passing through comfortably.`
    - Add +2 to `core:progress_tracker` (same upsert pattern as stage two).
    - Set `mechanisms:openable.isOpen` to true.
    - Update `actor_description` and any related text to align with the new description (keep same tone, reflect the final opening).
  - SUCCESS branch:
    - `DISPATCH_PERCEPTIBLE_EVENT.description_text`:
      `{context.actorName} steadily works the {context.toolName} across {context.blockerName}, clearing the third bar and opening the gap further. The gap will now allow passing through.`
    - Increment `core:progress_tracker` by +1 (same upsert pattern).
    - Set `mechanisms:openable.isOpen` to true.
    - Update `actor_description` and any related text to align with the new description.
  - FAILURE branch: unchanged from stage two.
  - FUMBLE branch:
    - `DISPATCH_PERCEPTIBLE_EVENT.description_text`:
      `As {context.actorName} starts cutting through {context.blockerName}'s third bar, {context.actorName} loses control of {context.toolName}; it clatters to the ground.`
    - Update `actor_description`/alternate text as needed to reflect the "third bar" phrasing and the new narrative.
- Update `data/mods/breaching/mod-manifest.json` to include the new rule.

## Testing Requirements
Add comprehensive integration coverage for the new stage three action and rule:
- Action discoverability tests similar to:
  - `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_action_discovery.test.js`
  - Ensure only blockers with `core:progress_tracker.value == 2` and the required components appear in the scope.
  - Include negative cases for missing progress trackers or values other than 2.
- Rule execution tests similar to:
  - `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_rule_execution.test.js`
  - Validate CRITICAL_SUCCESS/SUCCESS outcomes update progress tracking, set `mechanisms:openable.isOpen` to true, and emit the correct perceptible event text (including actor text changes).
  - Validate FAILURE and FUMBLE behavior matches expectations (including drop/unwield on FUMBLE).
- Reference other mod tests under `tests/integration/mods/` for patterns (e.g., setup helpers, assertions around `DISPATCH_PERCEPTIBLE_EVENT` payloads).

## Acceptance Checklist
- New stage three scope, action, condition, and rule created with correct IDs and wiring.
- Manifests updated to register the new content.
- Event texts match the requested phrasing exactly.
- Progress tracker and openable state updates match the new stage requirements.
- Integration tests for discovery and rule behavior added and passing.
