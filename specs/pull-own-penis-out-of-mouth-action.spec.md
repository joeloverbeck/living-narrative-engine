# Specification: Pull Own Penis Out of Target's Mouth Action

## Overview

This specification defines a new action in the `sex-penile-oral` mod that allows the receiving actor (the one receiving oral sex) to pull their penis out of the giving actor's mouth, thereby ending the blowjob interaction.

## Motivation

The existing `pull_penis_out_of_mouth` action provides this capability from the GIVING perspective (the one performing oral sex pulls the penis out of their mouth). This new action provides the inverse perspective, allowing the RECEIVING actor to withdraw their penis, which is a natural and realistic interaction pattern.

## Requirements

### Functional Requirements

#### FR-1: Scope Usage
- **Scope ID:** `sex-penile-oral:actor_giving_blowjob_to_me` (EXISTING scope, no new scope needed)
- **Purpose:** Resolve to the entity currently giving the actor a blowjob
- **Resolution Logic:**
  1. Check if actor has `positioning:receiving_blowjob` component
  2. Extract `giving_entity_id` from actor's `receiving_blowjob` component
  3. Validate that target entity exists and has `positioning:giving_blowjob` component
  4. Verify bidirectional references match (actor.receiving_blowjob.giving_entity_id === target.id AND target.giving_blowjob.receiving_entity_id === actor.id)
  5. Verify closeness established between entities
  6. Return target entity ID if all validations pass, empty set otherwise

**ScopeDSL Expression (EXISTING):**
```
// Scope restricting potential targets to the entity currently giving oral sex to the acting entity
// Uses raw closeness.partners to allow kneeling scenarios (target kneeling before actor during blowjob)
sex-penile-oral:actor_giving_blowjob_to_me := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "actor.components.positioning:receiving_blowjob"}},
    {"!!": {"var": "entity.components.positioning:giving_blowjob"}},
    {"==": [
      {"var": "actor.components.positioning:receiving_blowjob.giving_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:giving_blowjob.receiving_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

#### FR-2: Action Definition
- **Action ID:** `sex-penile-oral:pull_own_penis_out_of_mouth`
- **Name:** "Pull Penis Out of Mouth"
- **Description:** "Withdraw your penis from your partner's mouth, ending the oral sex interaction with a sensual release."
- **Primary Target:**
  - Scope: `sex-penile-oral:actor_giving_blowjob_to_me`
  - Placeholder: `primary`
  - Description: "Partner currently pleasuring you orally"
- **Required Components (Actor):**
  - `positioning:closeness` - Must be close to partner
  - `positioning:receiving_blowjob` - Must be receiving oral sex
- **Forbidden Components:** None
- **Template:** `"pull out your cock out of {primary}'s mouth"`
- **Visual Properties:**
  - backgroundColor: `#2a1a5e` (consistent with mod theme)
  - textColor: `#ede7f6`
  - hoverBackgroundColor: `#372483`
  - hoverTextColor: `#ffffff`

#### FR-3: Rule Definition
- **Rule ID:** `handle_pull_own_penis_out_of_mouth`
- **Event Type:** `core:attempt_action`
- **Condition:** Reference to `sex-penile-oral:event-is-action-pull-own-penis-out-of-mouth`
- **Operations:**
  1. GET_NAME for actor → `actorName`
  2. GET_NAME for primary → `primaryName`
  3. QUERY_COMPONENT for actor's position → `actorPosition`
  4. REMOVE_COMPONENT from actor: `positioning:receiving_blowjob`
  5. REMOVE_COMPONENT from primary: `positioning:giving_blowjob`
  6. SET_VARIABLE `logMessage`: `"{context.actorName} pulls out their cock out of {context.primaryName}'s mouth, a thread of saliva linking the cockhead to {context.primaryName}'s lips."`
  7. SET_VARIABLE `perceptionType`: `"action_target_general"`
  8. SET_VARIABLE `locationId`: `"{context.actorPosition.locationId}"`
  9. SET_VARIABLE `actorId`: `"{event.payload.actorId}"`
  10. SET_VARIABLE `targetId`: `"{event.payload.primaryId}"`
  11. Macro: `core:logSuccessAndEndTurn`

**Key Behavior:** This action TERMINATES the blowjob interaction by removing the reciprocal blowjob components from both participants. This is identical to the existing `pull_penis_out_of_mouth` action but from the receiving actor's perspective.

### Non-Functional Requirements

#### NFR-1: Performance
- Scope resolution must complete in <10ms for typical scenarios
- Action discovery must not significantly impact overall discovery performance

#### NFR-2: Compatibility
- Must work with existing blowjob initialization actions
- Must not conflict with other blowjob-related actions
- Must support kneeling scenarios (target kneeling before actor)
- Must be the inverse perspective of existing `pull_penis_out_of_mouth` action

#### NFR-3: Test Coverage
- Minimum 80% branch coverage for all test suites
- Both action discovery and rule execution must be thoroughly tested
- Edge cases must be explicitly tested (missing components, mismatched references, etc.)

## Design Rationale

### Perspective Relationship
This action complements the existing `pull_penis_out_of_mouth`:
- **Existing `pull_penis_out_of_mouth`:** GIVING actor (performing oral) pulls penis out of their own mouth
  - Required components: `giving_blowjob`, `closeness`
  - Target scope: `receiving_blowjob_from_actor`
- **New `pull_own_penis_out_of_mouth`:** RECEIVING actor (receiving oral) pulls their penis out of partner's mouth
  - Required components: `receiving_blowjob`, `closeness`
  - Target scope: `actor_giving_blowjob_to_me`

Both actions result in the same state change (termination of blowjob), but from opposite perspectives.

### Why Terminate the Interaction?
Unlike `guide_blowjob_with_hand` which maintains ongoing state, this action fundamentally changes the interaction by ending the blowjob. The components must be removed to reflect that oral sex is no longer occurring.

### Why Use Existing Scope?
The scope `actor_giving_blowjob_to_me` already exists and perfectly matches our requirements. It resolves to the entity giving the actor a blowjob, which is exactly the target we need for this action.

### Why Allow Kneeling?
Using raw `closeness.partners` without filtering out kneeling actors ensures the action works when the giving partner is kneeling before the receiving partner - a common and realistic scenario for oral sex.

### Narrative Message Design
The perceptible event message "pulls out their cock out of {primary}'s mouth, a thread of saliva linking the cockhead to {primary}'s lips" provides:
- Clear physical description of the action
- Sensual detail appropriate for adult content
- Consistency with the narrative style of other sexual actions in the mod

## Test Requirements

### Test Suite 1: Action Discovery

**File:** `tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action_discovery.test.js`

**Testing Utilities Required:**
- `ModTestFixture` from `tests/common/mods/ModTestFixture.js`
- `ModEntityBuilder` from `tests/common/mods/ModEntityBuilder.js`
- Domain matchers from `tests/common/mods/domainMatchers.js`

**Scenario Builder: `buildPullOwnPenisOutScenario(options)`**

Required options support:
- `includeReceivingBlowjob` (default: true) - Whether actor has receiving_blowjob component
- `includeCloseness` (default: true) - Whether closeness is established
- `mismatchedReferences` (default: false) - Whether entity references don't match
- `targetHasGivingBlowjob` (default: true) - Whether target has giving_blowjob
- `targetKneeling` (default: false) - Whether target is kneeling before actor

**Returns:**
- `entities`: Array of entity instances (room, actor, primary)
- `actorId`: ID of receiving actor
- `primaryId`: ID of giving actor
- `roomId`: Location ID

**Scope Override: `installActorGivingBlowjobToMeScopeOverride(fixture)`**

Implements the scope resolution logic:
1. Check actor has `receiving_blowjob` component
2. Extract `giving_entity_id` from actor's component
3. Validate target exists and has `giving_blowjob` component
4. Verify bidirectional references match
5. Verify closeness established
6. Return giving entity ID if all checks pass

**Returns:** Cleanup function to restore original resolver

#### Test Cases:

**TC-D1: Positive - Action appears when actor is receiving blowjob from partner**
- **Setup:** Actor has `receiving_blowjob` component, target has `giving_blowjob`, closeness established
- **Expected:** Action discovered for actor
- **Assertion:**
  ```javascript
  expect(discovered).toBeDefined();
  expect(discovered.template).toBe("pull out your cock out of {primary}'s mouth");
  ```

**TC-D2: Negative - Action not available without receiving_blowjob component**
- **Setup:** Actor lacks `receiving_blowjob` component
- **Expected:** Action NOT discovered
- **Assertion:** `expect(discovered).toBeUndefined();`

**TC-D3: Negative - Action not available without closeness**
- **Setup:** Actor has `receiving_blowjob` but closeness not established
- **Expected:** Action NOT discovered
- **Assertion:** `expect(discovered).toBeUndefined();`

**TC-D4: Negative - Action not available with mismatched entity references**
- **Setup:** `actor.receiving_blowjob.giving_entity_id !== target.id`
- **Expected:** Action NOT discovered
- **Assertion:** `expect(discovered).toBeUndefined();`

**TC-D5: Negative - Action not available when target lacks giving_blowjob**
- **Setup:** Target missing `giving_blowjob` component
- **Expected:** Action NOT discovered
- **Assertion:** `expect(discovered).toBeUndefined();`

**TC-D6: Positive - Action appears when target is kneeling (regression test)**
- **Setup:** Actor has `receiving_blowjob`, target has `giving_blowjob` AND `kneeling_before` actor
- **Expected:** Action discovered (proves raw closeness.partners works correctly)
- **Assertion:**
  ```javascript
  expect(discovered).toBeDefined();
  expect(discovered.template).toBe("pull out your cock out of {primary}'s mouth");
  ```

### Test Suite 2: Rule Execution

**File:** `tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action.test.js`

**Testing Utilities Required:**
- `ModTestFixture` from `tests/common/mods/ModTestFixture.js`
- `ModEntityBuilder` from `tests/common/mods/ModEntityBuilder.js`
- `ModAssertionHelpers` from `tests/common/mods/ModAssertionHelpers.js`
- Domain matchers from `tests/common/mods/domainMatchers.js`
- Action matchers from `tests/common/actionMatchers.js`

**Expected Message:**
```javascript
const EXPECTED_MESSAGE = "Nolan pulls out their cock out of Ava's mouth, a thread of saliva linking the cockhead to Ava's lips.";
```

#### Test Cases:

**TC-R1: Narrative - Dispatches correct message and perceptible event**
- **Setup:** Execute action with actor receiving blowjob from primary
- **Expected:**
  - Success message matches EXPECTED_MESSAGE
  - Perceptible event dispatched with correct structure
  - Turn ended
- **Assertions:**
  ```javascript
  ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
    shouldEndTurn: true,
    shouldHavePerceptibleEvent: true,
  });

  ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
    descriptionText: EXPECTED_MESSAGE,
    locationId: roomId,
    actorId,
    targetId: primaryId,
    perceptionType: 'action_target_general',
  });
  ```

**TC-R2: State Termination - Blowjob components ARE removed**
- **Setup:** Execute action
- **Verify Before:** Actor has `receiving_blowjob`, primary has `giving_blowjob`
- **Verify After:** Both components removed (unlike guide_blowjob_with_hand)
- **Assertions:**
  ```javascript
  const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
  const primaryBefore = testFixture.entityManager.getEntityInstance(primaryId);
  expect(actorBefore.components['positioning:receiving_blowjob']).toBeDefined();
  expect(primaryBefore.components['positioning:giving_blowjob']).toBeDefined();

  await testFixture.executeAction(actorId, primaryId, { additionalPayload: { primaryId } });

  const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
  const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
  expect(actorAfter.components['positioning:receiving_blowjob']).toBeUndefined();
  expect(primaryAfter.components['positioning:giving_blowjob']).toBeUndefined();
  ```

**TC-R3: Isolation - Does not affect other entities when ending blowjob**
- **Setup:** Two blowjob pairs in same location, execute action for first pair
- **Expected:** Second pair's components unchanged
- **Assertions:**
  ```javascript
  const secondaryActorAfter = testFixture.entityManager.getEntityInstance(SECONDARY_ACTOR_ID);
  const secondaryPrimaryAfter = testFixture.entityManager.getEntityInstance(SECONDARY_PRIMARY_ID);
  expect(secondaryActorAfter.components['positioning:receiving_blowjob']).toBeDefined();
  expect(secondaryPrimaryAfter.components['positioning:giving_blowjob']).toBeDefined();
  ```

**TC-R4: Specificity - Does not fire for different action**
- **Setup:** Dispatch different action event manually (won't match condition)
- **Expected:** Rule does not execute, components unchanged
- **Assertions:**
  ```javascript
  testFixture.testEnv.eventBus.dispatch({
    type: 'core:attempt_action',
    payload: { actorId, primaryId, actionId: 'some:other_action' },
  });

  const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
  expect(actorAfter.components['positioning:receiving_blowjob']).toBeDefined();

  const successEvents = testFixture.events.filter(
    (e) => e.eventType === 'core:display_successful_action_result'
  );
  expect(successEvents.length).toBe(0);
  ```

**TC-R5: Workflow - Prevents re-execution after blowjob ends**
- **Setup:** Execute action once to end blowjob
- **Expected:**
  - First execution succeeds and removes components
  - Action should no longer be discoverable (no receiving_blowjob component)
  - Cannot execute second time
- **Assertions:**
  ```javascript
  await testFixture.executeAction(actorId, primaryId, { additionalPayload: { primaryId } });

  const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
  expect(actorAfter.components['positioning:receiving_blowjob']).toBeUndefined();

  testFixture.clearEvents();

  const actions = await testFixture.discoverActions(actorId);
  const rediscovered = actions.find((action) => action.id === ACTION_ID);
  expect(rediscovered).toBeUndefined();
  ```

**TC-R6: Edge Case - Handles kneeling target correctly**
- **Setup:** Target is kneeling before actor during blowjob
- **Expected:**
  - Action executes successfully
  - Both blowjob components removed
  - Kneeling component remains (only blowjob state is affected)
- **Assertions:**
  ```javascript
  const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
  expect(primaryAfter.components['positioning:giving_blowjob']).toBeUndefined();
  expect(primaryAfter.components['positioning:kneeling_before']).toBeDefined();
  ```

## Implementation Checklist

**Data Files:**
- [ ] Create action file: `data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json`
- [ ] Create rule file: `data/mods/sex-penile-oral/rules/handle_pull_own_penis_out_of_mouth.rule.json`
- [ ] Create condition file: `data/mods/sex-penile-oral/conditions/event-is-action-pull-own-penis-out-of-mouth.condition.json`
- [ ] ✅ Scope already exists: `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope` (NO NEW SCOPE NEEDED)

**Test Files:**
- [ ] Create discovery test: `tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action_discovery.test.js`
  - [ ] Implement `buildPullOwnPenisOutScenario()` scenario builder
  - [ ] Implement `installActorGivingBlowjobToMeScopeOverride()` scope override
  - [ ] Implement all 6 discovery test cases (TC-D1 through TC-D6)
- [ ] Create rule test: `tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action.test.js`
  - [ ] Implement all 6 rule execution test cases (TC-R1 through TC-R6)

**Validation & Testing:**
- [ ] Validate action JSON against schema
- [ ] Validate rule JSON against schema
- [ ] Validate condition JSON against schema
- [ ] Run discovery test suite: `npm run test:integration -- tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action_discovery.test.js`
- [ ] Run rule test suite: `npm run test:integration -- tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_action.test.js`
- [ ] Verify no regressions: `npm run test:integration -- tests/integration/mods/sex-penile-oral/`
- [ ] Verify test coverage ≥80%

**Quality Assurance:**
- [ ] ESLint passes: `npx eslint data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json`
- [ ] ESLint passes: `npx eslint data/mods/sex-penile-oral/rules/handle_pull_own_penis_out_of_mouth.rule.json`
- [ ] ESLint passes: `npx eslint tests/integration/mods/sex-penile-oral/pull_own_penis_out_of_mouth_*.test.js`

## Dependencies

### Data Files Referenced:
- `data/mods/positioning/components/closeness.component.json` (EXISTING)
- `data/mods/positioning/components/receiving_blowjob.component.json` (EXISTING)
- `data/mods/positioning/components/giving_blowjob.component.json` (EXISTING)
- `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope` (EXISTING - shared with guide_blowjob_with_hand)

### Test Utilities Referenced:
- `tests/common/mods/ModTestFixture.js`
- `tests/common/mods/ModEntityBuilder.js`
- `tests/common/mods/ModAssertionHelpers.js`
- `tests/common/mods/domainMatchers.js`
- `tests/common/actionMatchers.js`

### Schema Files Referenced:
- `data/schemas/action.schema.json`
- `data/schemas/rule.schema.json`
- `data/schemas/condition.schema.json`

### Reference Implementation Files:
- `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json` (giving perspective version)
- `data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json` (receiving perspective, non-terminating)
- `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth.rule.json` (giving perspective version)
- `data/mods/sex-penile-oral/rules/handle_guide_blowjob_with_hand.rule.json` (receiving perspective, non-terminating)

### Reference Test Files:
- `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`
- `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`
- `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action_discovery.test.js`
- `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action.test.js`

## Success Criteria

1. ✅ All data files pass JSON schema validation
2. ✅ Action discovery test suite passes with 100% success rate (all 6 test cases)
3. ✅ Rule execution test suite passes with 100% success rate (all 6 test cases)
4. ✅ Test coverage ≥80% for both test suites
5. ✅ No regressions in existing sex-penile-oral mod tests
6. ✅ Action appears correctly in game when receiving blowjob
7. ✅ Action terminates blowjob interaction (removes components from both participants)
8. ✅ Action works correctly when target is kneeling
9. ✅ Perceptible event message displays correctly with proper formatting
10. ✅ Action does not interfere with other blowjob pairs in same location

## Architecture Notes

### Scope Reuse Pattern
This action demonstrates proper scope reuse:
- The scope `actor_giving_blowjob_to_me` is shared by:
  1. `guide_blowjob_with_hand` (non-terminating guidance action)
  2. `pull_own_penis_out_of_mouth` (terminating withdrawal action)

This is efficient and correct - the same scope can serve multiple actions with different behaviors.

### Component State Management
**Critical distinction:**
- **Terminating actions** (like this one): Remove blowjob components from both participants
- **Guidance actions** (like `guide_blowjob_with_hand`): Maintain blowjob components

The rule implementation must include `REMOVE_COMPONENT` operations to properly terminate the interaction.

### Bidirectional Reference Pattern
The scope validation checks ensure:
1. Actor's `receiving_blowjob.giving_entity_id` points to target
2. Target's `giving_blowjob.receiving_entity_id` points to actor
3. Both entities are in closeness relationship

This bidirectional validation prevents orphaned components and state inconsistencies.

### Kneeling Scenario Support
Using raw `closeness.partners` without additional position filtering allows realistic scenarios where:
- The giving partner kneels before the receiving partner
- The receiving partner can still pull out their penis
- Kneeling state is preserved (only blowjob components are removed)

## Future Enhancements

### Complementary Actions (Receiving Perspective):
1. **Thrust Into Mouth:** Active receiving-side participation
2. **Hold Head Still:** Restrain partner's movement
3. **Caress Face During Blowjob:** Gentle interaction while receiving

### Related Actions (Other Perspectives):
These would follow similar patterns with appropriate scope and component adjustments for other oral sex scenarios.

## Notes

- This action completes the perspective symmetry for blowjob termination
- The narrative message matches the style and detail level of the giving-perspective version
- Component removal is immediate and affects both participants simultaneously
- The scope resolution logic ensures the action only appears when appropriate
- Test coverage must include both standard scenarios and edge cases (kneeling, multiple pairs, etc.)
- The implementation must follow the established patterns from reference files to ensure consistency
