# Specification: Guide Blowjob with Hand Action

## Overview

This specification defines a new action in the `sex-penile-oral` mod that allows the receiving actor (the one receiving oral sex) to guide the blowjob by placing their hand on the back of the giving actor's head.

## Motivation

During oral sex interactions, the receiving partner should have actions available to guide and direct the experience. This action provides a natural, sensual interaction that maintains the existing blowjob state while adding narrative variety.

## Requirements

### Functional Requirements

#### FR-1: Scope Definition
- **Scope ID:** `sex-penile-oral:actor_giving_blowjob_to_me`
- **Purpose:** Resolve to the entity currently giving the actor a blowjob
- **Resolution Logic:**
  1. Check if actor has `positioning:receiving_blowjob` component
  2. Extract `giving_entity_id` from actor's `receiving_blowjob` component
  3. Validate that target entity exists and has `positioning:giving_blowjob` component
  4. Verify bidirectional references match (actor.receiving_blowjob.giving_entity_id === target.id AND target.giving_blowjob.receiving_entity_id === actor.id)
  5. Verify closeness established between entities
  6. Return target entity ID if all validations pass, empty set otherwise

**ScopeDSL Expression:**
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
- **Action ID:** `sex-penile-oral:guide_blowjob_with_hand`
- **Name:** "Guide Blowjob with Hand"
- **Description:** "Place your hand on their head to guide the pace and depth of the oral pleasure"
- **Primary Target:**
  - Scope: `sex-penile-oral:actor_giving_blowjob_to_me`
  - Placeholder: `primary`
  - Description: "Partner currently pleasuring you orally"
- **Required Components (Actor):**
  - `positioning:closeness` - Must be close to partner
  - `positioning:receiving_blowjob` - Must be receiving oral sex
- **Forbidden Components:** None
- **Template:** `"guide {primary}'s blowjob with your hand"`
- **Visual Properties:**
  - backgroundColor: `#2a1a5e` (consistent with mod theme)
  - textColor: `#ede7f6`
  - hoverBackgroundColor: `#372483`
  - hoverTextColor: `#ffffff`

#### FR-3: Rule Definition
- **Rule ID:** `handle_guide_blowjob_with_hand`
- **Event Type:** `core:attempt_action`
- **Condition:** Reference to `sex-penile-oral:event-is-action-guide-blowjob-with-hand`
- **Operations:**
  1. GET_NAME for actor → `actorName`
  2. GET_NAME for primary → `primaryName`
  3. QUERY_COMPONENT for actor's position → `actorPosition`
  4. SET_VARIABLE `logMessage`: `"{context.actorName} guides {context.primaryName}'s blowjob with a hand on the back of {context.primaryName}'s head."`
  5. SET_VARIABLE `perceptionType`: `"action_target_general"`
  6. SET_VARIABLE `locationId`: `"{context.actorPosition.locationId}"`
  7. SET_VARIABLE `actorId`: `"{event.payload.actorId}"`
  8. SET_VARIABLE `targetId`: `"{event.payload.primaryId}"`
  9. Macro: `core:logSuccessAndEndTurn`

**Key Behavior:** This action does NOT modify component state. The blowjob continues - this is just a guidance/direction action that provides narrative feedback.

### Non-Functional Requirements

#### NFR-1: Performance
- Scope resolution must complete in <10ms for typical scenarios
- Action discovery must not significantly impact overall discovery performance

#### NFR-2: Compatibility
- Must work with existing blowjob initialization actions
- Must not conflict with other blowjob-related actions
- Must support kneeling scenarios (target kneeling before actor)

#### NFR-3: Test Coverage
- Minimum 80% branch coverage for all test suites
- Both action discovery and rule execution must be thoroughly tested
- Edge cases must be explicitly tested (missing components, mismatched references, etc.)

## Design Rationale

### Why Inverse Scope?
The scope `actor_giving_blowjob_to_me` is the inverse of `receiving_blowjob_from_actor`:
- `receiving_blowjob_from_actor`: Actor is GIVING, targets entity RECEIVING
- `actor_giving_blowjob_to_me`: Actor is RECEIVING, targets entity GIVING

This inversion allows actions to be available from both perspectives of the interaction.

### Why No State Change?
Unlike `pull_penis_out_of_mouth` which ends the blowjob by removing components, this action maintains the ongoing state. It's a "flavor" action that adds variety to the experience without fundamentally changing the interaction state.

### Why Allow Kneeling?
Using raw `closeness.partners` without filtering out kneeling actors ensures the action works when the giving partner is kneeling before the receiving partner - a common and realistic scenario for oral sex.

## Test Requirements

### Test Suite 1: Action Discovery

**File:** `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action_discovery.test.js`

#### Test Cases:

**TC-D1: Positive - Action appears when actor is receiving blowjob**
- **Setup:** Actor has `receiving_blowjob` component, target has `giving_blowjob`, closeness established
- **Expected:** Action discovered for actor
- **Assertion:** `discovered.template === "guide {primary}'s blowjob with your hand"`

**TC-D2: Negative - Action not available without receiving_blowjob component**
- **Setup:** Actor lacks `receiving_blowjob` component
- **Expected:** Action NOT discovered

**TC-D3: Negative - Action not available without closeness**
- **Setup:** Actor has `receiving_blowjob` but closeness not established
- **Expected:** Action NOT discovered

**TC-D4: Negative - Action not available with mismatched entity references**
- **Setup:** `actor.receiving_blowjob.giving_entity_id !== target.id`
- **Expected:** Action NOT discovered

**TC-D5: Negative - Action not available when target lacks giving_blowjob**
- **Setup:** Target missing `giving_blowjob` component
- **Expected:** Action NOT discovered

**TC-D6: Positive - Action appears when target is kneeling (regression test)**
- **Setup:** Actor has `receiving_blowjob`, target has `giving_blowjob` AND `kneeling_before` actor
- **Expected:** Action discovered (proves raw closeness.partners works correctly)

### Test Suite 2: Rule Execution

**File:** `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action.test.js`

#### Test Cases:

**TC-R1: Narrative - Dispatches correct message and perceptible event**
- **Setup:** Execute action with actor receiving blowjob from primary
- **Expected:**
  - Success message: `"{actor} guides {primary}'s blowjob with a hand on the back of {primary}'s head."`
  - Perceptible event with correct structure
  - Turn ended

**TC-R2: State Preservation - Blowjob components NOT removed**
- **Setup:** Execute action
- **Verify Before:** Actor has `giving_blowjob`, primary has `receiving_blowjob`
- **Verify After:** Both components still present (unlike pull_penis_out_of_mouth)

**TC-R3: Isolation - Does not affect other entities**
- **Setup:** Two blowjob pairs in same location, execute action for first pair
- **Expected:** Second pair's components unchanged

**TC-R4: Specificity - Does not fire for different action**
- **Setup:** Dispatch different action event
- **Expected:** Rule does not execute, components unchanged

**TC-R5: Workflow - Maintains ongoing blowjob state**
- **Setup:** Execute action mid-blowjob
- **Expected:**
  - Success event dispatched
  - Components maintained
  - Can execute again (unlike terminating actions)

### Test Utilities Required

#### Scenario Builder: `buildGuideBlowjobScenario(options)`
**Options:**
- `includeReceivingBlowjob` (default: true)
- `includeCloseness` (default: true)
- `mismatchedReferences` (default: false)
- `targetHasGivingBlowjob` (default: true)
- `targetKneeling` (default: false)

**Returns:**
- `entities`: Array of entity instances
- `actorId`: ID of receiving actor
- `primaryId`: ID of giving actor
- `roomId`: Location ID

#### Scope Override: `installActorGivingBlowjobToMeScopeOverride(fixture)`
Mimics the scope resolution logic for testing purposes.

**Returns:** Cleanup function to restore original resolver

## Implementation Checklist

- [ ] Create scope file: `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope`
- [ ] Create action file: `data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json`
- [ ] Create rule file: `data/mods/sex-penile-oral/rules/handle_guide_blowjob_with_hand.rule.json`
- [ ] Create condition file: `data/mods/sex-penile-oral/conditions/event-is-action-guide-blowjob-with-hand.condition.json`
- [ ] Create discovery test: `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action_discovery.test.js`
- [ ] Create rule test: `tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action.test.js`
- [ ] Validate all JSON schemas
- [ ] Run discovery test suite: `npm run test:integration -- tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action_discovery.test.js`
- [ ] Run rule test suite: `npm run test:integration -- tests/integration/mods/sex-penile-oral/guide_blowjob_with_hand_action.test.js`
- [ ] Verify no regressions in existing sex-penile-oral tests
- [ ] Run full mod test suite: `npm run test:integration -- tests/integration/mods/sex-penile-oral/`

## Dependencies

### Data Files Referenced:
- `data/mods/positioning/components/closeness.component.json`
- `data/mods/positioning/components/receiving_blowjob.component.json`
- `data/mods/positioning/components/giving_blowjob.component.json`

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

## Success Criteria

1. ✅ All data files pass JSON schema validation
2. ✅ Action discovery test suite passes with 100% success rate
3. ✅ Rule execution test suite passes with 100% success rate
4. ✅ Test coverage ≥80% for both test suites
5. ✅ No regressions in existing sex-penile-oral mod tests
6. ✅ Action appears correctly in game when receiving blowjob
7. ✅ Action maintains blowjob state (does not end interaction)
8. ✅ Action works correctly when target is kneeling

## Future Enhancements

### Potential Follow-up Actions:
1. **Increase Pace:** Speed up the blowjob rhythm
2. **Slow Down:** Direct partner to go slower
3. **Pull Hair Gently:** Additional guidance mechanic
4. **Press Deeper:** Encourage deeper motion

These would follow the same pattern of maintaining state while providing narrative variety and player agency.

## Notes

- This action is part of a broader pattern of "guidance" actions that give the receiving partner control without ending the interaction
- The scope pattern `actor_giving_blowjob_to_me` can be reused for other receiving-perspective actions
- Component state preservation is intentional - this is not a terminating action
- Kneeling support is critical for realism and consistency with other blowjob actions
