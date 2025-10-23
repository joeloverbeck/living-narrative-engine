# Positioning "Crawl To" Action Specification

## Executive Summary

The positioning mod currently supports the `positioning:kneel_before` action, which establishes a kneeling relationship between an actor and a target. However, kneeling before someone does not automatically create a closeness relationship—the actor remains at a distance while maintaining the kneeling posture. During narrative gameplay, scenarios arise where a kneeling actor needs to transition from this distant kneeling position to being close to the target, such as crawling submissively across the floor to enter their personal space.

This specification defines the requirements for a new action that transitions a kneeling actor from their current position to a closeness relationship with the entity they are kneeling before. The action will use the existing `MERGE_CLOSENESS_CIRCLE` operation (similar to `positioning:get_close`) to establish proper closeness semantics while preserving the kneeling state.

## Goals

1. Introduce a new positioning action (`positioning:crawl_to`) that allows actors currently in a `positioning:kneeling_before` state to establish closeness with the target of their kneeling.
2. Create a dedicated scope definition that resolves to the single entity that the actor is currently kneeling before (derived from the `kneeling_before` component's `entityId` field).
3. Implement a rule that processes the new action using the `MERGE_CLOSENESS_CIRCLE` operation to establish proper closeness semantics, mirroring the behavior of `positioning:get_close`.
4. Deliver comprehensive integration test suites covering action discovery, rule execution, closeness establishment, and edge case scenarios.
5. Ensure the action respects existing posture constraints and forbidden component combinations established by other positioning actions.

## Non-Goals

- Modifying the existing `positioning:kneel_before` action or its associated rule.
- Changing the semantics of `positioning:kneeling_before` component or its lifecycle.
- Altering the `MERGE_CLOSENESS_CIRCLE` operation or closeness circle mechanics.
- Implementing automatic crawling behavior (the action must be explicitly chosen by the actor or AI).
- Creating variations for different crawling styles or speeds (this is a single, standard crawling action).

## Implementation Plan

### 1. Action Definition (`data/mods/positioning/actions/crawl_to.action.json`)

Create a new action file with the following specifications:

- **ID**: `positioning:crawl_to`
- **Name**: "Crawl To"
- **Description**: "Crawl submissively to the entity you are kneeling before, entering their personal space."
- **Template**: `"crawl to {primary}"`
- **Targets**:
  - **Primary**: Reference the new scope `positioning:entity_actor_is_kneeling_before` (see Section 2) to identify the single entity that the actor is currently kneeling before.
  - The scope should resolve to exactly one entity (the target of the actor's `kneeling_before` component).
  - If no `kneeling_before` component exists, the scope returns empty and the action is not discoverable.

- **Required Components** (actor):
  - `positioning:kneeling_before` - Actor must be kneeling before someone to crawl to them.

- **Forbidden Components** (actor):
  - `positioning:sitting_on` - Cannot crawl while sitting on furniture.
  - `positioning:bending_over` - Cannot crawl while bending over a surface.
  - `positioning:lying_down` - Cannot crawl while lying down.
  - `positioning:straddling_waist` - Cannot crawl while straddling someone.
  - `positioning:being_hugged` - Cannot crawl while being hugged.
  - `positioning:hugging` - Cannot crawl while hugging someone.
  - `positioning:closeness` - Cannot crawl if already close (action is for establishing closeness).

- **Forbidden Components** (primary target):
  - `positioning:kneeling_before` - Target should not be kneeling before someone else (prevents awkward chains).
  - `positioning:lying_down` - Cannot crawl to someone lying down (different interaction expected).
  - `positioning:bending_over` - Cannot crawl to someone bending over (different interaction expected).

- **Visual Scheme**: Match `positioning:get_close` visual properties:
  ```json
  {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
  ```

- **Prerequisites**: Consider adding the same mouth engagement prerequisite as `kneel_before`:
  ```json
  [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ]
  ```

### 2. Primary Target Scope (`data/mods/positioning/scopes/entity_actor_is_kneeling_before.scope`)

Create a new scope file that resolves to the entity the actor is currently kneeling before:

```javascript
// Scope for identifying the entity that the actor is currently kneeling before.
// Returns the single entity whose ID matches the entityId stored in the actor's
// positioning:kneeling_before component.
// Used by: positioning:crawl_to action
positioning:entity_actor_is_kneeling_before := 
  entities(core:actor)[{"==": [{"var": "id"}, {"var": "actor.components.positioning:kneeling_before.entityId"}]}]
```

**Scope Semantics**:
- Start from all entities with `core:actor` component (all actors in the game).
- Filter to the single actor whose `id` exactly matches the `entityId` stored in `actor.components.positioning:kneeling_before.entityId`.
- This guarantees returning exactly zero or one entity:
  - Zero if the actor lacks a `kneeling_before` component.
  - One if the actor has a valid `kneeling_before` component pointing to an existing entity.
- The scope is actor-context dependent (uses `actor.` prefix) and will be evaluated with the acting entity as context.

**Validation Considerations**:
- Ensure the scope handles the case where the `kneeling_before` component exists but references a non-existent entity (should return empty set gracefully).
- The scope does not need location filtering since the `kneeling_before` relationship already implies spatial proximity suitable for crawling.

### 3. Rule Definition (`data/mods/positioning/rules/handle_crawl_to.rule.json`)

Create a new rule file that handles the `positioning:crawl_to` action:

- **Rule ID**: `handle_crawl_to`
- **Event Type**: `core:attempt_action`
- **Condition**: Create or reference a condition that matches `positioning:crawl_to` action ID (e.g., `positioning:event-is-action-crawl-to`).

**Rule Actions Sequence** (following the `get_close` pattern):

1. **MERGE_CLOSENESS_CIRCLE**: Establish closeness between actor and target.
   ```json
   {
     "type": "MERGE_CLOSENESS_CIRCLE",
     "comment": "Merge actor and target into a closeness circle, maintaining the kneeling state.",
     "parameters": {
       "actor_id": "{event.payload.actorId}",
       "target_id": "{event.payload.targetId}"
     }
   }
   ```

2. **GET_NAME**: Retrieve actor name for logging.
   ```json
   {
     "type": "GET_NAME",
     "comment": "Get actor name for the UI message.",
     "parameters": {
       "entity_ref": "actor",
       "result_variable": "actorName"
     }
   }
   ```

3. **GET_NAME**: Retrieve target name for logging.
   ```json
   {
     "type": "GET_NAME",
     "parameters": {
       "entity_ref": "target",
       "result_variable": "targetName"
     }
   }
   ```

4. **QUERY_COMPONENT**: Get actor's position for perceptible event location.
   ```json
   {
     "type": "QUERY_COMPONENT",
     "comment": "Get location for perceptible event.",
     "parameters": {
       "entity_ref": "actor",
       "component_type": "core:position",
       "result_variable": "actorPosition"
     }
   }
   ```

5. **SET_VARIABLE**: Compose the success and perceptible event message.
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "logMessage",
       "value": "{context.actorName} crawls submissively to {context.targetName} until they're close."
     }
   }
   ```

6. **SET_VARIABLE**: Set location ID for perceptible event.
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "locationId",
       "value": "{context.actorPosition.locationId}"
     }
   }
   ```

7. **SET_VARIABLE**: Set perception type for the event.
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "perceptionType",
       "value": "state_change_observable"
     }
   }
   ```

8. **SET_VARIABLE**: Set target ID for event tracking.
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "targetId",
       "value": "{event.payload.targetId}"
     }
   }
   ```

9. **Macro**: End the turn with success logging.
   ```json
   { "macro": "core:logSuccessAndEndTurn" }
   ```

**Important Implementation Notes**:
- The rule does NOT remove the `positioning:kneeling_before` component—the actor remains kneeling while now also being close.
- Movement should already be locked from the original `kneel_before` action (via `LOCK_MOVEMENT`), so no additional locking is needed.
- The `MERGE_CLOSENESS_CIRCLE` operation handles all closeness circle mechanics, including reciprocal relationships and partner lists.
- The perceptible event type `state_change_observable` matches the pattern used by `get_close`.

### 4. Condition Definition (if needed)

If the positioning mod uses specific condition files for action matching, create:

**File**: `data/mods/positioning/conditions/event-is-action-crawl-to.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-crawl-to",
  "description": "Matches events where the action is positioning:crawl_to",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "positioning:crawl_to"
    ]
  }
}
```

**Alternative**: If the positioning mod has a generic action matching pattern, reuse the existing condition structure and update the condition reference in the rule accordingly.

### 5. Documentation & Manifest Updates

- **Update** `data/mods/positioning/mod-manifest.json` if explicit action or rule registration is required (check existing patterns in the manifest).
- **Add** a brief entry to `data/mods/positioning/README.md` describing the new action:
  ```markdown
  ### crawl_to
  Allows an actor who is kneeling before someone to crawl closer to them, 
  establishing a closeness relationship while maintaining the kneeling posture.
  ```
- **Ensure** validation patterns in `data/mods/positioning/VALIDATION_PATTERNS.md` (if it exists) are satisfied.
- **Run** `npm run scope:lint` after creating the new scope file to validate syntax.

## Testing Strategy

Create comprehensive integration test suites under `tests/integration/mods/positioning/` using `ModTestFixture` patterns. The testing approach should mirror the structure used in `kneel_before_action.test.js` and `sit_down_at_distance_action_discovery.test.js`.

### Test File 1: Action Discovery Tests

**File**: `tests/integration/mods/positioning/crawl_to_action_discovery.test.js`

**Purpose**: Verify action metadata, discoverability logic, and scope resolution.

**Test Cases**:

1. **Action Metadata Validation**
   - Import the action JSON file and validate structure.
   - Verify `id`, `name`, `description`, `template`, `targets`, `required_components`, `forbidden_components`, and `visual` fields.
   - Ensure the action schema conforms to `schema://living-narrative-engine/action.schema.json`.

2. **Positive Discoverability: Actor Kneeling Before Target at Distance**
   - **Setup**: 
     - Room with two actors (Alice and Bob).
     - Alice has `positioning:kneeling_before` component with `entityId: "bob"`.
     - Alice does NOT have `positioning:closeness` component.
     - Bob is standing normally with no forbidden components.
   - **Action**: Discover available actions for Alice.
   - **Expectation**: 
     - `positioning:crawl_to` action appears with Bob as the target.
     - Action label/template shows "crawl to Bob".

3. **Negative Discoverability: Actor Not Kneeling**
   - **Setup**: Alice standing normally (no `kneeling_before` component).
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear.

4. **Negative Discoverability: Actor Already Close**
   - **Setup**: 
     - Alice kneeling before Bob (`kneeling_before` component present).
     - Alice and Bob both have `positioning:closeness` components with each other as partners.
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden by `closeness` component on actor).

5. **Negative Discoverability: Actor Sitting**
   - **Setup**: 
     - Alice has both `kneeling_before` and `sitting_on` components (invalid state, but test defensive behavior).
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden by `sitting_on` component).

6. **Negative Discoverability: Target Kneeling**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Bob also kneeling before someone else (`kneeling_before` component present).
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden by target's `kneeling_before` component).

7. **Negative Discoverability: Target Lying Down**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Bob has `positioning:lying_down` component.
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden by target's `lying_down` component).

8. **Negative Discoverability: Target Bending Over**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Bob has `positioning:bending_over` component.
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden by target's `bending_over` component).

9. **Edge Case: Actor Being Hugged**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Alice has `positioning:being_hugged` component.
   - **Action**: Discover available actions for Alice.
   - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden component).

10. **Edge Case: Actor Hugging Someone**
    - **Setup**: 
      - Alice kneeling before Bob.
      - Alice has `positioning:hugging` component.
    - **Action**: Discover available actions for Alice.
    - **Expectation**: `positioning:crawl_to` action does NOT appear (forbidden component).

11. **Scope Resolution Validation**
    - **Setup**: Multiple actors in the room, Alice kneeling before Bob specifically.
    - **Action**: Resolve the `positioning:entity_actor_is_kneeling_before` scope for Alice.
    - **Expectation**: Scope returns exactly Bob's entity ID, not other actors.

### Test File 2: Rule Execution Tests

**File**: `tests/integration/mods/positioning/crawl_to_action.test.js`

**Purpose**: Test the rule execution, closeness establishment, and event dispatching.

**Test Cases**:

1. **Successful Rule Execution**
   - **Setup**: Alice kneeling before Bob at distance (no closeness).
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - Alice gains `positioning:closeness` component with Bob in partners list.
     - Bob gains `positioning:closeness` component with Alice in partners list.
     - Alice retains `positioning:kneeling_before` component (not removed).
     - Success message: "Alice crawls submissively to Bob until they're close."
     - `core:perceptible_event` dispatched with correct location and actors.
     - `core:action_success` event dispatched.

2. **Closeness Circle Semantics**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Bob already close to Carol (existing closeness circle).
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - Alice, Bob, and Carol all have each other in their `closeness.partners` lists (merged circle).
     - Verify reciprocal closeness relationships are properly established.
     - `MERGE_CLOSENESS_CIRCLE` operation produces correct result.

3. **Perceptible Event Validation**
   - **Setup**: Alice kneeling before Bob in throne room, witness Charlie also present.
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - `core:perceptible_event` contains:
       - `descriptionText`: "Alice crawls submissively to Bob until they're close."
       - `locationId`: throne room ID
       - `actorId`: Alice's ID
       - `targetId`: Bob's ID
       - `perceptionType`: "state_change_observable"

4. **Movement Lock Preservation**
   - **Setup**: Alice kneeling before Bob (movement already locked from kneel_before).
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - Verify Alice's movement remains locked (check movement lock state).
     - No additional movement lock operations should be needed.

5. **Component Lifecycle Validation**
   - **Setup**: Alice kneeling before Bob.
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - `positioning:kneeling_before` component remains on Alice with same `entityId`.
     - `positioning:closeness` component added to Alice (not replaced).
     - Both components coexist on the same entity.

6. **Rule Only Fires for Correct Action**
   - **Setup**: Alice kneeling before Bob.
   - **Action**: Execute a different action (e.g., `core:wait`).
   - **Assertions**:
     - No closeness components added.
     - No perceptible events related to crawling.
     - Rule condition properly filters for `positioning:crawl_to` only.

7. **Multi-Actor Scenario**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Carol kneeling before Dave.
     - All in same room.
   - **Action**: Execute `positioning:crawl_to` for Alice.
   - **Assertions**:
     - Only Alice and Bob gain closeness with each other.
     - Carol and Dave remain unaffected.
     - No cross-contamination of closeness relationships.

8. **Edge Case: Target Already Close to Others**
   - **Setup**: 
     - Alice kneeling before Bob.
     - Bob already in closeness circle with Carol and Dave.
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - Alice joins the existing closeness circle.
     - All four actors (Alice, Bob, Carol, Dave) have each other as partners.
     - Closeness circle properly merged.

9. **Realistic Entity IDs**
   - **Setup**: Use production-like namespaced entity IDs (e.g., `p_scenario:alice_smith`, `p_scenario:bob_jones`).
   - **Action**: Execute `positioning:crawl_to` action.
   - **Assertions**:
     - All operations work correctly with namespaced IDs.
     - Component `entityId` references properly formatted.

10. **Action Success Event Format**
    - **Setup**: Standard crawling scenario.
    - **Action**: Execute `positioning:crawl_to` action.
    - **Assertions**:
      - `core:action_success` event contains:
        - `actionId`: "positioning:crawl_to"
        - `actorId`: Alice's ID
        - `targetId`: Bob's ID
        - `success`: true

### Test File 3: Regression & Integration Tests

**File**: `tests/integration/mods/positioning/crawl_to_integration.test.js`

**Purpose**: Ensure the new action integrates properly with existing positioning features.

**Test Cases**:

1. **Full Workflow: Kneel Then Crawl**
   - **Setup**: Alice and Bob standing in room, facing each other.
   - **Actions**: 
     1. Execute `positioning:kneel_before` (Alice kneels before Bob).
     2. Execute `positioning:crawl_to` (Alice crawls to Bob).
   - **Assertions**:
     - After step 1: Alice has `kneeling_before`, no closeness.
     - After step 2: Alice has both `kneeling_before` and `closeness`.
     - Both actions succeed with appropriate messages.

2. **Existing Actions Unaffected**
   - **Setup**: Standard positioning scenarios.
   - **Action**: Execute various positioning actions (`kneel_before`, `get_close`, `sit_down`, etc.).
   - **Assertions**:
     - All existing actions continue to work correctly.
     - No interference from the new action's scope or rule.

3. **Scope Independence**
   - **Setup**: Multiple actors with various positioning states.
   - **Action**: Resolve `positioning:entity_actor_is_kneeling_before` scope for different actors.
   - **Assertions**:
     - Scope correctly returns the kneeling target for each actor independently.
     - Scope returns empty when actor not kneeling.
     - No false positives or cross-actor contamination.

4. **Combined Forbidden Component Check**
   - **Setup**: Actor with multiple forbidden components (e.g., `sitting_on` + `kneeling_before`).
   - **Action**: Attempt to discover `positioning:crawl_to`.
   - **Assertions**:
     - Action correctly blocked by any forbidden component.
     - No partial execution or error states.

## Performance & Edge Case Considerations

### Performance
- The new scope `entity_actor_is_kneeling_before` performs a simple ID lookup, which should be O(1) or O(n) depending on entity manager implementation.
- The scope only evaluates when the actor has a `kneeling_before` component, providing natural early exit.
- `MERGE_CLOSENESS_CIRCLE` operation already optimized for closeness circle merging in the engine.

### Edge Cases to Document
1. **Invalid kneeling_before reference**: If `kneeling_before.entityId` references a non-existent entity, the scope returns empty and action is not discoverable. This is correct behavior.
2. **Kneeling component removed during action**: The rule assumes `kneeling_before` component exists at execution time. If removed between discovery and execution, the action should fail gracefully (existing engine validation handles this).
3. **Both actors kneeling before each other**: While unusual, the action would allow both to crawl if they meet other requirements. This creates an interesting narrative scenario and should be allowed.
4. **Large closeness circles**: `MERGE_CLOSENESS_CIRCLE` operation handles arbitrary circle sizes, so no special handling needed for many-actor closeness circles.

## Open Questions & Follow-ups

1. **Movement Lock Interaction**: Confirm that `MERGE_CLOSENESS_CIRCLE` operation properly handles entities with existing movement locks (from `kneel_before`). Expected behavior: locks are preserved through the merge.

2. **Animation/Narrative Flavor**: Should the perceptible event message be customizable or always use "crawls submissively"? Current spec uses a fixed message for consistency, but this could be enhanced in future iterations.

3. **Prerequisite Validation**: Should the action include the mouth engagement prerequisite, or is movement already restricted sufficiently by the `kneeling_before` state? Current spec includes it for consistency with `kneel_before`.

4. **Stand-Up Interaction**: Verify behavior when actor uses `stand_up` action after crawling while kneeling. Expected: both `kneeling_before` and `closeness` components are removed, and movement unlocked. This should be tested in integration suite.

5. **AI Usage Patterns**: Monitor how LLM-controlled actors use this action in gameplay. If overused or underused, consider adjusting action description or discovery conditions to guide AI behavior.

6. **Localization**: If the engine supports multiple languages, ensure the action template and success message support localization patterns used elsewhere in the positioning mod.

## Implementation Checklist

- [ ] Create `data/mods/positioning/actions/crawl_to.action.json` with all specified properties
- [ ] Create `data/mods/positioning/scopes/entity_actor_is_kneeling_before.scope` with correct scope DSL syntax
- [ ] Create `data/mods/positioning/rules/handle_crawl_to.rule.json` following the operation sequence
- [ ] Create or update condition file for action matching (if needed)
- [ ] Update `data/mods/positioning/mod-manifest.json` (if explicit registration required)
- [ ] Add entry to `data/mods/positioning/README.md`
- [ ] Run `npm run scope:lint` to validate scope syntax
- [ ] Create `tests/integration/mods/positioning/crawl_to_action_discovery.test.js` with all discovery test cases
- [ ] Create `tests/integration/mods/positioning/crawl_to_action.test.js` with all execution test cases
- [ ] Create `tests/integration/mods/positioning/crawl_to_integration.test.js` with regression tests
- [ ] Run `npm run test:integration -- tests/integration/mods/positioning/crawl_to*.test.js` and verify all tests pass
- [ ] Run full positioning mod test suite to ensure no regressions
- [ ] Conduct manual gameplay testing with LLM-controlled actors to validate narrative flow
- [ ] Update this spec with any discovered issues or refinements during implementation

## References

- Action Pattern: `data/mods/positioning/actions/get_close.action.json`
- Rule Pattern: `data/mods/positioning/rules/get_close.rule.json`
- Component Schema: `data/mods/positioning/components/kneeling_before.component.json`
- Closeness Component: `data/mods/positioning/components/closeness.component.json`
- Test Pattern: `tests/integration/mods/positioning/kneel_before_action.test.js`
- Discovery Test Pattern: `tests/integration/mods/positioning/sit_down_at_distance_action_discovery.test.js`
- Testing Guide: `docs/testing/mod-testing-guide.md`
- Scope DSL Reference: `docs/scopeDsl/README.md` and `docs/scopeDsl/quick-reference.md`
