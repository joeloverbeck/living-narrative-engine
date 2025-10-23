# Take Penis In Mouth (Kneeling) Specification

## Overview

Introduce a kneeling variation of the oral sex initiation action so actors who are kneeling before a partner with an exposed penis can initiate oral contact. The new action should mirror the existing `sex-penile-oral:take_penis_in_mouth` flow while adopting the kneeling requirements and component management patterns established in the codebase.

## Reference Patterns and Constraints

- **Current seated action** – Use `sex-penile-oral:take_penis_in_mouth` as the baseline for schema layout, visual palette, blowjob component management, and narrative structure.【F:data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json†L1-L28】【F:data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json†L1-L203】
- **Kneeling scope** – `sex-core:actor_kneeling_before_target_with_penis` already exists and provides the correct scope for actors kneeling before targets with uncovered penises.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L1-L14】
- **Kneeling action reference** – `sex-penile-oral:breathe_teasingly_on_penis` demonstrates the kneeling action pattern with correct required components.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json†L1-L24】
- **Blowjob component management** – Follow the complex state cleanup logic from `handle_take_penis_in_mouth.rule.json` that handles existing `giving_blowjob` and `receiving_blowjob` components for both participants before establishing new reciprocal relationships.【F:data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json†L16-L165】

## Scope Requirements

**No new scope needed** – Reuse the existing `sex-core:actor_kneeling_before_target_with_penis` scope which already provides:
- Actor has `positioning:closeness` with partner
- Actor has `positioning:kneeling_before` component pointing to partner
- Partner has an uncovered penis part
- All filtering logic for exposed anatomy

## Action Requirements

Author `data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json` (final ID should be `sex-penile-oral:take_penis_in_mouth_kneeling`).

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `sex-penile-oral:take_penis_in_mouth_kneeling`.
- `name`: "Take Penis In Mouth (Kneeling)".
- `description`: "Lean in from your kneeling position to take your partner's penis in your mouth, initiating oral sex."
- `targets.primary`:
  - `scope`: `sex-core:actor_kneeling_before_target_with_penis`
  - `placeholder`: `primary`
  - `description`: "Partner you're kneeling before with an exposed penis"
- `required_components`:
  - `actor`: `["positioning:closeness", "positioning:kneeling_before"]`
  - **Note**: No requirements on primary since the scope already ensures correct state
- `forbidden_components`:
  - `actor`: `["positioning:giving_blowjob"]`
- `template`: **Exactly** `take {primary}'s in your mouth` (note the `{primary}` placeholder as specified).
- `prerequisites`: Keep an empty array consistent with the seated variant.
- `visual`: Reuse the purple palette from the seated version for continuity.【F:data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json†L22-L27】
- Add the action file path to `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule Requirements

Implement `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth_kneeling.rule.json` alongside a matching condition file `data/mods/sex-penile-oral/conditions/event-is-action-take-penis-in-mouth-kneeling.condition.json`.

### Rule Structure

Base the rule on the seated variant but adapt the narrative message for the kneeling context:

1. **Event matching**: `event_type` is `core:attempt_action`, and the condition ensures the rule only triggers for the new action ID `sex-penile-oral:take_penis_in_mouth_kneeling`.

2. **Name retrieval**:
   - `GET_NAME` for `actor` → `actorName`
   - `GET_NAME` for `primary` → `primaryName`

3. **Position query**: Query actor's `core:position` component into `actorPosition` for location metadata.

4. **Existing blowjob state cleanup** (critical - copy from seated version):
   ```json
   {
     "type": "QUERY_COMPONENTS",
     "parameters": {
       "entity_ref": "actor",
       "pairs": [
         {
           "component_type": "positioning:giving_blowjob",
           "result_variable": "actorExistingGivingBlowjobComponent"
         },
         {
           "component_type": "positioning:receiving_blowjob",
           "result_variable": "actorExistingReceivingBlowjobComponent"
         }
       ]
     }
   }
   ```
   Repeat for `primary` entity.

5. **Cleanup logic** (copy entire IF blocks from seated version):
   - If actor has existing `giving_blowjob`, remove `receiving_blowjob` from the referenced partner
   - If actor has existing `receiving_blowjob`, remove `giving_blowjob` from the referenced partner
   - If primary has existing `giving_blowjob`, remove `receiving_blowjob` from the referenced partner
   - If primary has existing `receiving_blowjob`, remove `giving_blowjob` from the referenced partner
   - Remove both component types from actor
   - Remove both component types from primary
   【F:data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json†L23-L143】

6. **Establish new blowjob state**:
   ```json
   {
     "type": "ADD_COMPONENT",
     "parameters": {
       "entity_ref": "actor",
       "component_type": "positioning:giving_blowjob",
       "value": {
         "receiving_entity_id": "{event.payload.primaryId}",
         "initiated": true
       }
     }
   }
   ```
   ```json
   {
     "type": "ADD_COMPONENT",
     "parameters": {
       "entity_ref": "primary",
       "component_type": "positioning:receiving_blowjob",
       "value": {
         "giving_entity_id": "{event.payload.actorId}",
         "consented": true
       }
     }
   }
   ```

7. **Set narrative message**:
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "logMessage",
       "value": "{context.actorName} leans in toward {context.primaryName}'s crotch and takes {context.primaryName}'s cock in the mouth, wrapping the sex organ in that velvety warmth."
     }
   }
   ```

8. **Set metadata variables**:
   - `perceptionType`: `action_target_general`
   - `locationId`: `{context.actorPosition.locationId}`
   - `actorId`: `{event.payload.actorId}`
   - `targetId`: `{event.payload.primaryId}`

9. **Finish**: Use `{ "macro": "core:logSuccessAndEndTurn" }` to complete the action.

10. Add both the new rule and condition files to the `sex-penile-oral` mod manifest.

### Condition File

Create `data/mods/sex-penile-oral/conditions/event-is-action-take-penis-in-mouth-kneeling.condition.json`:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-take-penis-in-mouth-kneeling",
  "description": "Evaluates to true when the event is an attempt_action for take_penis_in_mouth_kneeling",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:take_penis_in_mouth_kneeling"
    ]
  }
}
```

## Testing Requirements

Develop comprehensive integration coverage under `tests/integration/mods/sex-penile-oral/` using the practices from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L347】Reference the existing test suites for the seated version as the primary pattern.【F:tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action_discovery.test.js†L1-L114】【F:tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action.test.js†L1-L218】

### Test File 1: Action Discovery

Create `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_kneeling_action_discovery.test.js`:

#### Test Structure
- Use `ModTestFixture.forAction('sex-penile-oral', 'sex-penile-oral:take_penis_in_mouth_kneeling')`
- Build scenarios using `ModEntityBuilder` or scenario helpers
- Import domain matchers: `import '../../../common/mods/domainMatchers.js'`
- Import action matchers: `import '../../../common/actionMatchers.js'`

#### Test Cases Required

1. **Positive case**: "appears when actor is kneeling before partner with uncovered penis"
   - Actor has `positioning:closeness` component with partner in `partners` array
   - Actor has `positioning:kneeling_before` component with `entityId` pointing to partner
   - Partner has penis part that is not covered
   - Verify action appears in discovery results
   - Verify template matches: `take {primary}'s in your mouth`

2. **Negative case**: "does not appear when partner's penis is covered"
   - Set up same scenario but cover the penis
   - Verify action does not appear

3. **Negative case**: "does not appear when actor is not kneeling"
   - Set up scenario without `positioning:kneeling_before` component
   - Verify action does not appear

4. **Negative case**: "does not appear when closeness is not established"
   - Set up scenario without `positioning:closeness` component
   - Verify action does not appear

5. **Negative case**: "does not appear when actor is already giving a blowjob"
   - Set up valid scenario
   - Add `positioning:giving_blowjob` component to actor
   - Verify action does not appear (forbidden component blocks discovery)

#### Reference Pattern
```javascript
describe('sex-penile-oral:take_penis_in_mouth_kneeling action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-penile-oral',
      'sex-penile-oral:take_penis_in_mouth_kneeling'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Test cases here
});
```

### Test File 2: Rule Execution

Create `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_kneeling_action.test.js`:

#### Test Structure
- Use `ModTestFixture.forActionAutoLoad('sex-penile-oral', 'sex-penile-oral:take_penis_in_mouth_kneeling')`
- Import `ModAssertionHelpers` for event validation
- Import domain and action matchers
- Build complete entity scenarios with proper components

#### Test Cases Required

1. **Perceptible event test**: "dispatches the blowjob initiation narration and perceptible event"
   - Build scenario with kneeling actor and partner
   - Execute action: `await testFixture.executeAction(actorId, primaryId, { additionalPayload: { primaryId } })`
   - Assert success with expected message using `ModAssertionHelpers.assertActionSuccess()`
   - Assert perceptible event with correct location, actor, target, and perception type
   - Expected message: `{actor} leans in toward {primary}'s crotch and takes {primary}'s cock in the mouth, wrapping the sex organ in that velvety warmth.`

2. **Component establishment test**: "establishes reciprocal blowjob components on both participants"
   - Execute action
   - Verify actor has `positioning:giving_blowjob` with `receiving_entity_id: primaryId` and `initiated: true`
   - Verify primary has `positioning:receiving_blowjob` with `giving_entity_id: actorId` and `consented: true`
   - Use matchers: `expect(actor).toHaveComponent('positioning:giving_blowjob')`
   - Use data matcher: `expect(actor).toHaveComponentData('positioning:giving_blowjob', { ... })`

3. **State cleanup test**: "cleans up existing blowjob state when initiating with a new partner"
   - Create 4 entities: actor, primary, oldReceivingEntity, oldGivingEntity
   - Set up initial state:
     - primary has `giving_blowjob` pointing to oldReceivingEntity
     - oldReceivingEntity has `receiving_blowjob` pointing to primary
     - actor has `receiving_blowjob` pointing to oldGivingEntity
     - oldGivingEntity has `giving_blowjob` pointing to actor
   - Execute action with actor taking primary's penis
   - Verify cleanup:
     - oldReceivingEntity no longer has `receiving_blowjob`
     - oldGivingEntity no longer has `giving_blowjob`
     - actor no longer has `receiving_blowjob`, now has `giving_blowjob` pointing to primary
     - primary no longer has `giving_blowjob`, now has `receiving_blowjob` pointing to actor

4. **Rule specificity test**: "does not fire rule for a different action"
   - Build simple scenario
   - Dispatch different action event (e.g., `sex-penile-oral:breathe_teasingly_on_penis`)
   - Verify no blowjob components added
   - Ensures rule condition properly gates execution

#### Reference Pattern
```javascript
describe('sex-penile-oral:take_penis_in_mouth_kneeling action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      'sex-penile-oral:take_penis_in_mouth_kneeling'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Test cases here
});
```

### Test Execution
- Run `npm run test:integration` locally before submitting changes
- Ensure all tests pass with proper cleanup
- Verify no test pollution between suites

## Implementation Checklist

- [ ] Create `data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json`
- [ ] Create `data/mods/sex-penile-oral/conditions/event-is-action-take-penis-in-mouth-kneeling.condition.json`
- [ ] Create `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth_kneeling.rule.json` with full blowjob state cleanup logic
- [ ] Update `data/mods/sex-penile-oral/mod-manifest.json` to register all three files
- [ ] Create `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_kneeling_action_discovery.test.js` with 5 test cases
- [ ] Create `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_kneeling_action.test.js` with 4 test cases
- [ ] Run `npm run test:integration` to verify all tests pass
- [ ] Run `npx eslint` on modified test files to ensure code quality
- [ ] Verify action appears correctly in game when kneeling before partner with exposed penis

## Acceptance Criteria

- Scope correctly identifies actors kneeling before targets with uncovered penises (reuses existing scope).
- Action JSON validates against schema, uses correct required and forbidden components, and delivers the specified template: `take {primary}'s in your mouth`.
- Condition JSON properly gates rule execution to only the new action ID.
- Rule JSON validates against schema, implements full blowjob state cleanup logic identical to seated version, and delivers the specified narrative message.
- Sex mod manifest registers all new assets so discovery and execution pipelines can load them.
- Integration test suite for action discovery covers all 5 required test cases with proper positive and negative coverage.
- Integration test suite for rule execution covers all 4 required test cases including complex state cleanup verification.
- All integration tests pass using modern `ModTestFixture` patterns with proper cleanup.
- Action is discoverable in-game only when all requirements are met (kneeling, closeness, uncovered penis, not already giving blowjob).
- Action execution correctly establishes reciprocal blowjob components and cleans up any existing blowjob relationships.
