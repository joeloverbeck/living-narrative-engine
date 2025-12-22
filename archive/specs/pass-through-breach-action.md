# Pass Through Breach Action/Rule Spec

## Goal
Add a new movement action/rule combo that lets an actor pass through a breached blocker into the destination behind it. This adds two new scopes and a new action+rule in the movement mod. No code changes in this spec; this is the implementation plan.

Template required by request:
- `pass through the breach in {breachedBlocker} into {destination}`

## Current State Findings

### Locations Exits Component
File: `data/mods/locations/components/exits.component.json`
- `locations:exits` is an array of exit objects with `direction`, `target`, and optional `blocker`.
- `target` and `blocker` are namespaced IDs resolved to instance IDs at world init.

### Breached Component
File: `data/mods/breaching/components/breached.component.json`
- Marker component `breaching:breached`, no data.
- Applied in breaching rules for saw-through barred blockers (stage two and stage three).

Breached usage (adds component):
- `data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_two.rule.json`
- `data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_three.rule.json`

### Scopes Using `locations:exits` (DSL)
These scope definitions directly reference `location.locations:exits`:
- `data/mods/movement/scopes/clear_directions.scope` (filters unblocked exits; returns `.target`)
- `data/mods/movement/scopes/dimensional_portals.scope` (filters exits where blocker is a portal; returns `.target`)
- `data/mods/locks/scopes/blockers_actor_can_lock.scope` (returns `.blocker`)
- `data/mods/locks/scopes/blockers_actor_can_unlock.scope` (returns `.blocker`)
- `data/mods/blockers/scopes/sawable_barred_blockers.scope` (returns `.blocker`)
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_two.scope` (returns `.blocker`)
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_three.scope` (returns `.blocker`)

### Files Using Those Scopes
`movement:clear_directions`:
- `data/mods/movement/actions/go.action.json`
- `data/mods/movement/actions/teleport.action.json`
- `data/mods/movement/scopes/clear_directions.scope`
- `docs/migration/movement-mod-migration-execution.md`
- `reports/movement-mod-migration-analysis.md`
- `archive/specs/locks-mod-connection-locking.md`
- `archive/LOCMODCONLOC/LOCMODCONLOC-005-movement-lock-integration-COMPLETED.md`
- `tests/visual/movement-action-test.html`
- `tests/performance/actions/ActionDiscoveryWorkflow.performance.test.js`
- `tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js`
- `tests/e2e/actions/ActionTargetResolutionWorkflow.e2e.test.js`
- `tests/e2e/prompting/common/promptGenerationTestBed.js`
- `tests/e2e/turns/common/fullTurnExecutionTestBed.js`
- `tests/e2e/turns/common/fullTurnExecutionTestBed.js.bak`
- `tests/unit/actions/targetResolutionService.scope-loading.test.js`
- `tests/unit/initializers/services/scopeRegistryInitialization.focused.test.js`
- `tests/unit/mods/movement/actions/go.test.js`
- `tests/unit/mods/movement/scopes.test.js`
- `tests/unit/schemas/goActionMultiTarget.schema.test.js`
- `tests/unit/utils/registryStoreUtils.scope-id-mapping.test.js`
- `tests/common/actions/actionTestUtilities.js`
- `tests/common/actions/testDataFactory.js`
- `tests/integration/actions/targetResolutionService.realModules.integration.test.js`
- `tests/integration/mods/movement/actionLoading.test.js`
- `tests/integration/mods/movement/teleport_action_discovery.test.js`
- `tests/integration/mods/movement/movementFlow.test.js`
- `tests/integration/mods/movement/go_action_lighting.test.js`
- `tests/integration/locks/movement_visibility.integration.test.js`
- `tests/integration/scopeEngineSingletonLocationContext.test.js`
- `tests/integration/scopes/actionDiscoveryIntegration.integration.test.js`
- `tests/integration/scopes/scopeIntegration.test.js`

`movement:dimensional_portals`:
- `data/mods/movement/actions/travel_through_dimensions.action.json`
- `data/mods/movement/scopes/dimensional_portals.scope`
- `tests/common/engine/systemLogicTestEnv.js`
- `tests/unit/scopeDsl/dimensionalPortalsScope.test.js`
- `tests/integration/logic/hasComponentOperatorMissingEntity.test.js`
- `archive/specs/locks-mod-connection-locking.md`

`locks:blockers_actor_can_lock`:
- `data/mods/locks/actions/lock_connection.action.json`
- `data/mods/locks/scopes/blockers_actor_can_lock.scope`
- `tests/integration/actions/locks.actions.integration.test.js`
- `tests/unit/mods/locks/scopes.test.js`
- `archive/specs/locks-mod-connection-locking.md`
- `archive/LOCMODCONLOC/LOCMODCONLOC-003-lock-unlock-actions-COMPLETED.md`

`locks:blockers_actor_can_unlock`:
- `data/mods/locks/actions/unlock_connection.action.json`
- `data/mods/locks/scopes/blockers_actor_can_unlock.scope`
- `tests/integration/actions/locks.actions.integration.test.js`
- `tests/unit/mods/locks/scopes.test.js`
- `archive/specs/locks-mod-connection-locking.md`

`blockers:sawable_barred_blockers`:
- `data/mods/blockers/scopes/sawable_barred_blockers.scope`
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_two.scope`
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_three.scope`
- `data/mods/breaching/actions/saw_through_barred_blocker.action.json`
- `data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json`
- `data/mods/breaching/actions/saw_through_barred_blocker_stage_three.action.json`
- `tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js`
- `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_action_discovery.test.js`
- `tests/integration/mods/breaching/saw_through_barred_blocker_stage_three_action_discovery.test.js`
- `tests/integration/mods/breaching/edge_cases.test.js`
- `tests/integration/mods/breaching/scopes.test.js`
- `archive/specs/breaching-mod-saw-through-barred-blocker.spec.md`
- `archive/specs/breaching-barred-blocker-stage-two.md`
- `archive/specs/breaching-barred-blocker-stage-three.md`
- `archive/BREMODSAWTHRBARBLO-005-saw-through-action-COMPLETED.md`

`blockers:sawable_barred_blockers_stage_two`:
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_two.scope`
- `data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json`
- `tests/integration/mods/breaching/saw_through_barred_blocker_stage_two_action_discovery.test.js`
- `archive/specs/breaching-barred-blocker-stage-two.md`

`blockers:sawable_barred_blockers_stage_three`:
- `data/mods/blockers/scopes/sawable_barred_blockers_stage_three.scope`
- `data/mods/breaching/actions/saw_through_barred_blocker_stage_three.action.json`
- `tests/integration/mods/breaching/saw_through_barred_blocker_stage_three_action_discovery.test.js`
- `archive/specs/breaching-barred-blocker-stage-three.md`

### ContextFrom Actions and Scope Patterns
Actions that use `contextFrom` (all are `secondary` targets using `contextFrom: "primary"`):
- `caressing:adjust_clothing` -> `clothing:target_topmost_torso_upper_clothing`
- `caressing:caress_abdomen` -> `clothing:target_topmost_torso_upper_clothing`
- `caressing:fondle_ass` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `clothing:remove_others_clothing` -> `clothing:target_topmost_clothing`
- `containers:take_from_container` -> `containers-core:container_contents`
- `distress:clutch_onto_upper_clothing` -> `clothing:target_topmost_torso_upper_clothing`
- `first-aid:disinfect_wounded_part` -> `first-aid:wounded_target_body_parts`
- `first-aid:rinse_wounded_part` -> `first-aid:wounded_target_body_parts`
- `first-aid:treat_wounded_part` -> `first-aid:treatable_target_body_parts`
- `item-placement:take_from_nearby_surface` -> `containers-core:container_contents`
- `locks:lock_connection` -> `locks:keys_for_blocker`
- `locks:unlock_connection` -> `locks:keys_for_blocker`
- `personal-space:scoot_closer` -> `personal-space:closest_leftmost_occupant`
- `personal-space:scoot_closer_right` -> `personal-space:closest_rightmost_occupant`
- `personal-space:sit_down_at_distance` -> `personal-space:actors_sitting_with_space_to_right`
- `sex-breastplay:fondle_breasts_over_clothes` -> `clothing:target_topmost_torso_upper_clothing`
- `sex-dry-intimacy:grind_ass_against_penis` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-dry-intimacy:press_penis_against_ass_through_clothes` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-dry-intimacy:rub_pussy_against_penis_through_clothes` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-dry-intimacy:rub_vagina_over_clothes` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-penile-manual:rub_penis_over_clothes` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-penile-oral:nuzzle_penis_through_clothing` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`
- `sex-penile-oral:nuzzle_penis_through_clothing_sitting_close` -> `clothing:target_topmost_torso_lower_clothing_no_accessories`

Scope patterns that rely on `contextFrom`:
- Use `target` as the dependent context source (provided by `contextFrom`).
  - Example: `containers-core:container_contents := target.containers-core:container.contents[]`
  - Example: `clothing:target_topmost_clothing := target.topmost_clothing[]`
  - Example: `first-aid:treatable_target_body_parts := target.body_parts[][...]`
- Use `target` inside JSON Logic operators for relationship tests.
  - Example: `personal-space:closest_leftmost_occupant := entities(core:actor)[{"isClosestLeftOccupant": ["entity", "target", "actor"]}]`
  - Example: `locks:keys_for_blocker` uses `target` to compare key IDs.

### Go Action and Related Files
Action file: `data/mods/movement/actions/go.action.json`
- Primary scope: `movement:clear_directions` (location exits that are unblocked).
- Template: `go to {destination}`.
- Prereqs: `anatomy:actor-can-move`, `isActorLocationLit`.

Rule file: `data/mods/movement/rules/go.rule.json`
- Condition: `movement:event-is-action-go` (`data/mods/movement/conditions/event-is-action-go.condition.json`).
- Resolves actor name and position, fetches current and target location names.
- Dispatches sense-aware departure and arrival `DISPATCH_PERCEPTIBLE_EVENT` events with `alternate_descriptions`.
- Updates `core:position.locationId`, dispatches `core:entity_moved`, and ends turn via `core:displaySuccessAndEndTurn` with a success message.

Relevant movement condition: `data/mods/movement/conditions/exit-is-unblocked.condition.json`
- Exit is unblocked if no blocker or blocker openable is unlocked.

## Proposed Additions

### New Scopes
1) `breaching:breached_blockers_at_location` (in `data/mods/breaching/scopes/`)
- Purpose: Return blockers from `location.locations:exits` where the blocker has `breaching:breached`.
- Proposed DSL sketch:
  - `breaching:breached_blockers_at_location := location.locations:exits[].blocker[{"has_component": [{"var": "entity"}, "breaching:breached"]}]`
  - If scope DSL cannot access blocker entity directly via `entity`, use `location.locations:exits` with filter on `entity.blocker` and use `has_component` against `entity.blocker`, then return `.blocker`.

2) `movement:destinations_for_breached_blocker` (in `data/mods/movement/scopes/`)
- Purpose: Given a breached blocker (via `contextFrom`), return destination location IDs from exits that reference that blocker.
- Proposed DSL sketch (contextFrom required):
  - `movement:destinations_for_breached_blocker := location.locations:exits[{"==": [{"var": "entity.blocker"}, {"var": "target.id"}]}].target`
- Optionally include a `has_component` check for `breaching:breached` in the filter to avoid stale matches.

### New Action (movement mod)
Action ID: `movement:pass_through_breach`
File: `data/mods/movement/actions/pass_through_breach.action.json`
- Targets:
  - `primary`: scope `breaching:breached_blockers_at_location`, placeholder `breachedBlocker`.
  - `secondary`: scope `movement:destinations_for_breached_blocker`, placeholder `destination`, `contextFrom: "primary"`.
- Template: `pass through the breach in {breachedBlocker} into {destination}` (required).
- Prerequisites: mirror `movement:go` for movement capability and lighting (unless design wants breach traversal allowed in darkness; confirm).
- Forbidden components: mirror `movement:go` unless gameplay dictates otherwise.
- `generateCombinations`: true (to produce paired blocker + destination options).

### New Rule (movement mod)
Rule ID: `handle_pass_through_breach`
File: `data/mods/movement/rules/pass_through_breach.rule.json`
- Condition: `movement:event-is-action-pass-through-breach` (new condition file in movement mod).
- Mechanics (mirror `go.rule.json` flow):
  - Query actor name and `core:position`.
  - Resolve current location name and destination name.
  - Dispatch sense-aware departure perceptible event (movement.departure) with `alternate_descriptions` and `actor_description`.
  - Update `core:position.locationId` to destination.
  - Dispatch `core:entity_moved`.
  - Dispatch sense-aware arrival perceptible event (movement.arrival).
  - Dispatch success UI message: `{actor} passes through the breach in {breachedBlocker} into {destination}`.
  - End turn via `core:displaySuccessAndEndTurn` or equivalent pattern used in `go.rule.json`.
- Use `event.payload.primaryId` and `event.payload.secondaryId` (multi-target format), or the existing backward-compatible targetId pattern if required by engine expectations. Confirm with current multi-target rules (e.g., `locks:lock_connection`).

### Sense-Aware Perception
Use `DISPATCH_PERCEPTIBLE_EVENT` with:
- `alternate_descriptions` (auditory/tactile minimum, per `docs/modding/sense-aware-perception.md`).
- `actor_description` for first-person message.
- `perception_type`: use `movement.departure` / `movement.arrival` as in `go.rule.json`.

## Testing Requirements
Add comprehensive tests using existing movement/breaching integration tests as reference:
- Action discovery tests:
  - New integration tests under `tests/integration/mods/movement/` similar to:
    - `tests/integration/mods/movement/teleport_action_discovery.test.js`
    - `tests/integration/mods/movement/go_action_lighting.test.js`
  - Cover target resolution for breached blockers and destination pairing.
- Rule behavior tests:
  - New integration tests verifying:
    - Movement updates (`core:position.locationId`).
    - `core:entity_moved` event dispatch.
    - Departure/arrival perceptible events with sense-aware alternate descriptions.
    - UI success message content.
- Scope tests:
  - Add scope resolution tests similar to `tests/integration/mods/breaching/scopes.test.js` and `tests/unit/mods/movement/scopes.test.js`.

## Open Questions / Confirmations
- Should breach traversal be allowed in darkness (bypass `isActorLocationLit`), or align with `movement:go` prerequisites?
- If multiple exits share the same breached blocker, should the destination scope return all exits or only the first? (Current DSL suggests returning all matches.)
- Should `movement:destinations_for_breached_blocker` enforce `breaching:breached` check even though the primary target is already filtered?
