# Suck Penis Hard Action Specification

## Overview

Implement an action/rule combo in the `sex-penile-oral` mod that allows an actor already giving a blowjob to suck hard on their partner's penis, applying intense suction with the intent to bring them to climax. This action represents a continuation of an ongoing blowjob interaction with a specific focus on vigorous, climax-oriented technique.

## Reference Materials and Constraints

- **Blowjob continuation baseline** – Follow the schema layout, visual palette, and structural patterns from `sex-penile-oral:suck_penis_slowly`, which also operates during an active blowjob.【F:data/mods/sex-penile-oral/actions/suck_penis_slowly.action.json†L1-L25】
- **Similar action precedent** – Reference `sex-penile-oral:pull_penis_out_of_mouth` for ongoing blowjob action structure.【F:data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json†L1-L25】
- **Rule execution patterns** – Use `handle_suck_penis_slowly` as the template for rule structure, variable naming, and macro usage.【F:data/mods/sex-penile-oral/rules/handle_suck_penis_slowly.rule.json†L1-L63】
- **Testing methodology** – Build suites using the modern fixtures, discovery beds, and matcher guidance captured in the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L347】【F:docs/testing/action-discovery-testing-toolkit.md†L1-L64】
- **Discovery test patterns** – Follow the comprehensive scenario building and scope override patterns from `suck_penis_slowly_action_discovery.test.js`.【F:tests/integration/mods/sex-penile-oral/suck_penis_slowly_action_discovery.test.js†L1-L100】
- **Rule behavior test patterns** – Follow the execution testing approach from `suck_penis_slowly_action.test.js`.【F:tests/integration/mods/sex-penile-oral/suck_penis_slowly_action.test.js†L1-L100】

## Action Requirements

Author `data/mods/sex-penile-oral/actions/suck_penis_hard.action.json` with the following properties:

1. **Schema and Identity**
   - `$schema`: `schema://living-narrative-engine/action.schema.json`
   - `id`: `sex-penile-oral:suck_penis_hard`
   - `name`: "Suck Penis Hard"
   - `description`: "Suck your partner's penis hard with intense suction, intending to bring them to climax during ongoing oral sex."

2. **Target Configuration**
   - `targets.primary.scope`: `sex-penile-oral:receiving_blowjob_from_actor`
   - `targets.primary.placeholder`: `primary`
   - `targets.primary.description`: "Partner whose penis you are currently sucking hard to draw out their cum"

3. **Component Requirements**
   - `required_components.actor`: `["positioning:giving_blowjob", "positioning:closeness"]`
   - This ensures the actor is actively performing a blowjob and is physically close to the target

4. **Action Template**
   - `template`: Exactly `suck {primary}'s cock hard`

5. **Prerequisites and Forbidden Components**
   - `prerequisites`: Empty array `[]`
   - `forbidden_components`: Empty object `{}`

6. **Visual Styling**
   - Copy the exact purple palette from `suck_penis_slowly.action.json` to maintain visual consistency within the sex-penile-oral mod:
     ```json
     "visual": {
       "backgroundColor": "#2a1a5e",
       "textColor": "#ede7f6",
       "hoverBackgroundColor": "#372483",
       "hoverTextColor": "#ffffff"
     }
     ```

7. **Mod Manifest Registration**
   - Add the new action file path to `data/mods/sex-penile-oral/mod-manifest.json` under the `actions` array

## Rule and Condition Requirements

### Condition File

Create `data/mods/sex-penile-oral/conditions/event-is-action-suck-penis-hard.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-suck-penis-hard",
  "description": "True when the action being attempted is suck_penis_hard",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:suck_penis_hard"
    ]
  }
}
```

### Rule File

Implement `data/mods/sex-penile-oral/rules/handle_suck_penis_hard.rule.json` with the following structure:

1. **Rule Metadata**
   - `rule_id`: `handle_suck_penis_hard`
   - `comment`: "Handles the 'sex-penile-oral:suck_penis_hard' action. Dispatches descriptive narrative about hard, intense sucking to draw out cum and ends the turn."
   - `event_type`: `core:attempt_action`
   - `condition.condition_ref`: `sex-penile-oral:event-is-action-suck-penis-hard`

2. **Rule Operations Sequence**
   ```json
   "actions": [
     {
       "type": "GET_NAME",
       "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
     },
     {
       "type": "GET_NAME",
       "parameters": { "entity_ref": "primary", "result_variable": "primaryName" }
     },
     {
       "type": "QUERY_COMPONENT",
       "parameters": {
         "entity_ref": "actor",
         "component_type": "core:position",
         "result_variable": "actorPosition"
       }
     },
     {
       "type": "SET_VARIABLE",
       "parameters": {
         "variable_name": "logMessage",
         "value": "{context.actorName} sucks {context.primaryName}'s cock hard, intending to draw out {context.primaryName}'s cum."
       }
     },
     {
       "type": "SET_VARIABLE",
       "parameters": {
         "variable_name": "perceptionType",
         "value": "action_target_general"
       }
     },
     {
       "type": "SET_VARIABLE",
       "parameters": {
         "variable_name": "locationId",
         "value": "{context.actorPosition.locationId}"
       }
     },
     {
       "type": "SET_VARIABLE",
       "parameters": {
         "variable_name": "actorId",
         "value": "{event.payload.actorId}"
       }
     },
     {
       "type": "SET_VARIABLE",
       "parameters": {
         "variable_name": "targetId",
         "value": "{event.payload.primaryId}"
       }
     },
     { "macro": "core:logSuccessAndEndTurn" }
   ]
   ```

3. **Narrative Specification**
   - **Perceptible event message**: `{actor} sucks {primary}'s cock hard, intending to draw out {primary}'s cum.`
   - **Successful action message**: Same as perceptible event message
   - This narrative emphasizes the hard, intense nature of the action and the climax-focused intent

4. **Mod Manifest Registration**
   - Add both the condition and rule file paths to `data/mods/sex-penile-oral/mod-manifest.json` under their respective `conditions` and `rules` arrays

## Testing Requirements

Create comprehensive integration test coverage under `tests/integration/mods/sex-penile-oral/`:

### Test Suite 1: Action Discoverability

**File**: `tests/integration/mods/sex-penile-oral/suck_penis_hard_action_discovery.test.js`

**Purpose**: Validate that the action appears only when prerequisites are met and is correctly filtered by the action discovery pipeline.

**Test Structure**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import suckPenisHardAction from '../../../../data/mods/sex-penile-oral/actions/suck_penis_hard.action.json';

const ACTION_ID = 'sex-penile-oral:suck_penis_hard';
```

**Scenario Builder**:
Implement `buildSuckPenisHardScenario(options)` following the pattern from `buildSuckPenisSlowlyScenario`:
- Options: `includeGivingBlowjob`, `includeCloseness`, `mismatchedReferences`, `targetHasReceivingBlowjob`
- Create actor with `positioning:giving_blowjob` component (if enabled)
- Create actor with `positioning:closeness` component (if enabled)
- Create primary with `positioning:receiving_blowjob` component (if enabled)
- Establish bidirectional entity references between actor and primary

**Scope Override**:
Implement `installReceivingBlowjobFromActorScopeOverride(fixture)` to manually resolve the `sex-penile-oral:receiving_blowjob_from_actor` scope:
- Check actor has `positioning:giving_blowjob` component
- Check actor has `positioning:closeness` component
- Validate `giving_blowjob.receiving_entity_id` matches target
- Validate target has `positioning:receiving_blowjob` component
- Validate `receiving_blowjob.giving_entity_id` matches actor
- Return Set with matching entity IDs

**Test Cases**:
1. ✅ **Discovery success**: Action appears when actor has both `giving_blowjob` and `closeness`, and primary is correctly referenced
2. ❌ **Missing giving_blowjob**: Action does NOT appear when actor lacks `giving_blowjob` component
3. ❌ **Missing closeness**: Action does NOT appear when actor lacks `closeness` component
4. ❌ **Missing receiving_blowjob**: Action does NOT appear when primary lacks `receiving_blowjob` component
5. ❌ **Mismatched references**: Action does NOT appear when entity IDs in components don't match
6. 📊 **Discovery count**: Verify exactly one action discovered when all prerequisites met

**Testing References**:
- Follow scenario building patterns from `suck_penis_slowly_action_discovery.test.js`【F:tests/integration/mods/sex-penile-oral/suck_penis_slowly_action_discovery.test.js†L1-L100】
- Use ModTestFixture API from Mod Testing Guide【F:docs/testing/mod-testing-guide.md†L17-L347】

### Test Suite 2: Rule Behavior

**File**: `tests/integration/mods/sex-penile-oral/suck_penis_hard_action.test.js`

**Purpose**: Verify the rule executes correctly, dispatches proper events, and produces expected narrative output.

**Test Structure**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import suckPenisHardAction from '../../../../data/mods/sex-penile-oral/actions/suck_penis_hard.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:suck_penis_hard';
const EXPECTED_MESSAGE = "Ava sucks Nolan's cock hard, intending to draw out Nolan's cum.";
```

**Setup Functions**:
- `configureActionDiscovery(fixture)`: Build action index with suck_penis_hard action
- `buildSuckPenisHardScenario()`: Create full scenario with actor, primary, and room
- `installReceivingBlowjobFromActorScopeOverride(fixture)`: Install scope resolver override

**Scenario Configuration**:
Create entities:
- `ACTOR_ID = 'ava'`, `PRIMARY_ID = 'nolan'`, `ROOM_ID = 'bedroom1'`
- Actor has: `positioning:giving_blowjob`, `positioning:closeness`, location components
- Primary has: `positioning:receiving_blowjob`, `positioning:closeness`, location components
- Bidirectional component references established

**Test Cases**:

1. **Successful execution with correct perceptible event**
   ```javascript
   it('successfully executes suck penis hard action with correct perceptible event', async () => {
     // Arrange
     configureActionDiscovery(fixture);
     const scopeCleanup = installReceivingBlowjobFromActorScopeOverride(fixture);
     const { entities, actorId, primaryId, roomId } = buildSuckPenisHardScenario();
     // ... setup entities

     // Act
     const result = await fixture.executeAction(actorId, ACTION_ID, { primaryId });

     // Assert
     expect(result.turnEnded).toBe(true);
     const perceptibleEvents = fixture.getDispatchedEvents('PERCEPTIBLE_EVENT');
     expect(perceptibleEvents).toHaveLength(1);
     expect(perceptibleEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
     expect(perceptibleEvents[0].payload.perceptionType).toBe('action_target_general');
     expect(perceptibleEvents[0].payload.actorId).toBe(actorId);
     expect(perceptibleEvents[0].payload.targetId).toBe(primaryId);
     expect(perceptibleEvents[0].payload.locationId).toBe(roomId);

     scopeCleanup();
   });
   ```

2. **Verify message format matches specification**
   ```javascript
   it('produces narrative message matching specification format', async () => {
     // ... setup and execution

     // Assert exact message format
     const perceptibleEvent = fixture.getDispatchedEvents('PERCEPTIBLE_EVENT')[0];
     expect(perceptibleEvent.payload.message).toContain('sucks');
     expect(perceptibleEvent.payload.message).toContain('cock hard');
     expect(perceptibleEvent.payload.message).toContain('intending to draw out');
     expect(perceptibleEvent.payload.message).toContain("'s cum");
   });
   ```

3. **Verify components remain unchanged** (action doesn't modify blowjob state)
   ```javascript
   it('does not modify blowjob components during action execution', async () => {
     // ... setup and execution

     // Assert components still present
     const actorAfter = fixture.entityManager.getEntityInstance(actorId);
     const primaryAfter = fixture.entityManager.getEntityInstance(primaryId);
     expect(actorAfter.components['positioning:giving_blowjob']).toBeDefined();
     expect(primaryAfter.components['positioning:receiving_blowjob']).toBeDefined();
   });
   ```

4. **Negative scenario: rule does not trigger for different action**
   ```javascript
   it('does not trigger rule for different action IDs', async () => {
     // Arrange with different action
     configureActionDiscovery(fixture);
     // ... setup entities

     // Act with different action
     await fixture.dispatchEvent({
       type: 'core:attempt_action',
       payload: { actionId: 'sex-penile-oral:different_action', actorId, primaryId }
     });

     // Assert no perceptible event dispatched
     const perceptibleEvents = fixture.getDispatchedEvents('PERCEPTIBLE_EVENT');
     expect(perceptibleEvents).toHaveLength(0);
   });
   ```

**Testing References**:
- Follow execution patterns from `suck_penis_slowly_action.test.js`【F:tests/integration/mods/sex-penile-oral/suck_penis_slowly_action.test.js†L1-L100】
- Use event assertion helpers from ModAssertionHelpers【F:docs/testing/mod-testing-guide.md†L17-L347】

### Test Execution Requirements

1. **Local validation before submission**:
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/sex-penile-oral/suck_penis_hard_action_discovery.test.js --no-coverage --verbose
   NODE_ENV=test npx jest tests/integration/mods/sex-penile-oral/suck_penis_hard_action.test.js --no-coverage --verbose
   ```

2. **Integration with CI pipeline**:
   ```bash
   npm run test:integration -- tests/integration/mods/sex-penile-oral/ --silent
   ```

3. **Cleanup patterns**:
   - Use `beforeEach` to create fresh fixture
   - Use `afterEach` to call `fixture.cleanup()`
   - Clean up scope overrides with cleanup functions

4. **Matcher imports**:
   - Import `../../../common/mods/domainMatchers.js` for component assertions
   - Import `../../../common/actionMatchers.js` for action discovery assertions

## Implementation Checklist

### Phase 1: Action and Rule Definition
- [ ] Create `data/mods/sex-penile-oral/actions/suck_penis_hard.action.json`
- [ ] Create `data/mods/sex-penile-oral/conditions/event-is-action-suck-penis-hard.condition.json`
- [ ] Create `data/mods/sex-penile-oral/rules/handle_suck_penis_hard.rule.json`
- [ ] Register all three files in `data/mods/sex-penile-oral/mod-manifest.json`
- [ ] Validate JSON schemas with `npm run validate:mod:sex-penile-oral`

### Phase 2: Test Suite Development
- [ ] Create `tests/integration/mods/sex-penile-oral/suck_penis_hard_action_discovery.test.js`
- [ ] Implement scenario builder function
- [ ] Implement scope override function
- [ ] Write 6 discovery test cases (success + 5 failure scenarios)
- [ ] Create `tests/integration/mods/sex-penile-oral/suck_penis_hard_action.test.js`
- [ ] Implement rule execution test cases (4 scenarios minimum)
- [ ] Verify all tests pass locally

### Phase 3: Quality Validation
- [ ] Run ESLint on modified/new files: `npx eslint tests/integration/mods/sex-penile-oral/suck_penis_hard_*.test.js`
- [ ] Run integration tests: `npm run test:integration -- tests/integration/mods/sex-penile-oral/ --silent`
- [ ] Verify no regressions in existing sex-penile-oral tests
- [ ] Run scope linting: `npm run scope:lint`

## Acceptance Criteria

### Functional Requirements
✅ **Action discoverability**: Action appears only when actor has `giving_blowjob` + `closeness` components and is targeting entity with matching `receiving_blowjob` component

✅ **Rule execution**: Rule correctly handles action attempt, retrieves entity names and position, dispatches perceptible event with specified narrative message

✅ **Component state**: Action does NOT modify `giving_blowjob` or `receiving_blowjob` components (stateless action)

✅ **Narrative quality**: Perceptible event message exactly matches specification: `{actor} sucks {primary}'s cock hard, intending to draw out {primary}'s cum.`

### Technical Requirements
✅ **Schema validation**: All JSON files validate against their respective schemas

✅ **Mod registration**: Action, condition, and rule are registered in mod manifest

✅ **Visual consistency**: Action uses identical purple color scheme as other sex-penile-oral actions

✅ **Scope implementation**: Uses existing `sex-penile-oral:receiving_blowjob_from_actor` scope correctly

### Testing Requirements
✅ **Discovery coverage**: Test suite covers success case and 5 failure scenarios (missing components, mismatched references)

✅ **Rule coverage**: Test suite covers successful execution, message format validation, component state verification, and negative case

✅ **Test infrastructure**: Tests use ModTestFixture, ModEntityBuilder, and modern matcher patterns

✅ **Test execution**: Both test suites pass with `npm run test:integration` and no regressions in existing tests

### Documentation Requirements
✅ **Code comments**: Action, rule, and test files include descriptive comments explaining purpose

✅ **Test descriptions**: Test cases have clear, descriptive names following "should/does" patterns

✅ **Specification adherence**: Implementation matches all details specified in this document

## Related Documentation

- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md` - Complete guide to fixture API, matchers, and testing patterns
- **Action Discovery Toolkit**: `docs/testing/action-discovery-testing-toolkit.md` - Specialized guidance for action discovery testing
- **Reference Action (Slow)**: `data/mods/sex-penile-oral/actions/suck_penis_slowly.action.json` - Structural template for similar action
- **Reference Action (Pull)**: `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json` - Structural template for ongoing blowjob actions
- **Reference Rule (Slow)**: `data/mods/sex-penile-oral/rules/handle_suck_penis_slowly.rule.json` - Rule pattern for blowjob actions
- **Reference Test (Discovery - Slow)**: `tests/integration/mods/sex-penile-oral/suck_penis_slowly_action_discovery.test.js` - Discovery test pattern
- **Reference Test (Execution - Slow)**: `tests/integration/mods/sex-penile-oral/suck_penis_slowly_action.test.js` - Rule execution test pattern
- **Giving Blowjob Component**: `data/mods/positioning/components/giving_blowjob.component.json` - Component schema reference
- **Receiving Blowjob Scope**: `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope` - Scope definition reference

## Notes

- This action represents a continuation of an ongoing blowjob interaction, NOT initiation or completion
- The action is stateless - it does not modify the `giving_blowjob` or `receiving_blowjob` components
- The hard, climax-focused nature should be conveyed through the narrative description
- Visual styling maintains consistency with the sex-penile-oral mod family
- Testing follows the most current patterns from the Mod Testing Guide (updated 2024)
- This action differs from `suck_penis_slowly` in intensity and intent: "hard" sucking to "draw out cum" vs "slow" sucking with "careful attention"
