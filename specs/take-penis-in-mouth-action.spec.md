# Take Penis In Mouth (Blowjob Initiation) Specification

## Overview

Implement a stateful blowjob initiation system that uses positioning components as persistent state markers, mirroring the `hugging:hug_tight` pattern. This action allows a seated actor to take their close partner's exposed penis into their mouth, establishing a `giving_blowjob` / `receiving_blowjob` state relationship that other actions can reference to prevent conflicting interactions.

The system introduces two new marker components in the `positioning` mod (`giving_blowjob` and `receiving_blowjob`) to ensure broad dependency availability across mods, while the action and rule reside in the `sex-penile-oral` mod to maintain domain separation.

## Reference Materials and Constraints

- **Stateful component pattern** – Follow the reciprocal state management approach established by `hugging:hug_tight`, where both participants receive components with entity references to each other.【F:data/mods/hugging/actions/hug_tight.action.json†L1-L22】【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L1-L196】
- **State component schemas** – Model `positioning:giving_blowjob` and `positioning:receiving_blowjob` after the `positioning:hugging` and `positioning:being_hugged` component structures with entity ID references and consent metadata.【F:data/mods/positioning/components/hugging.component.json†L1-L26】【F:data/mods/positioning/components/being_hugged.component.json†L1-L22】
- **Seated action precedent** – Use the seated proximity scope and dual component requirements from `sex-penile-oral:lick_glans_sitting_close` for consistency with existing seated oral actions.【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L1-L25】【F:data/mods/sex-penile-oral/rules/handle_lick_glans_sitting_close.rule.json†L1-L63】
- **Testing methodology** – Build comprehensive test suites using modern fixtures, discovery beds, and matcher guidance from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L347】
- **Existing test patterns** – Reference the lick glans sitting close test suites for action discovery and rule behavior coverage structure.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action_discovery.test.js†L1-L80】【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action.test.js†L1-L80】

## Component Requirements

### `positioning:giving_blowjob.component.json`

Author `data/mods/positioning/components/giving_blowjob.component.json` with the following schema:

1. `$schema`: `schema://living-narrative-engine/component.schema.json`.
2. `id`: `positioning:giving_blowjob`; `description`: "Marks an actor who is actively performing oral sex on another entity's penis, preventing conflicting mouth engagement actions."
3. `dataSchema`: Object with `additionalProperties: false`.
4. Required properties:
   - `receiving_entity_id` (string): ID of the entity receiving oral sex, validated with pattern `^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$`.
   - `initiated` (boolean): Whether this entity initiated the blowjob interaction.
5. Optional property:
   - `consented` (boolean, default `true`): Whether the giving entity consents to continue the interaction.
6. Register component in `data/mods/positioning/mod-manifest.json` under the `components` array.

### `positioning:receiving_blowjob.component.json`

Author `data/mods/positioning/components/receiving_blowjob.component.json` with the following schema:

1. `$schema`: `schema://living-narrative-engine/component.schema.json`.
2. `id`: `positioning:receiving_blowjob`; `description`: "Marks an entity currently receiving oral sex on their penis, signaling that other conflicting genital actions are unavailable."
3. `dataSchema`: Object with `additionalProperties: false`.
4. Required property:
   - `giving_entity_id` (string): ID of the entity performing oral sex, validated with pattern `^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$`.
5. Optional property:
   - `consented` (boolean, default `true`): Whether this entity consents to continue receiving oral sex.
6. Register component in `data/mods/positioning/mod-manifest.json` under the `components` array.

**Rationale for positioning mod placement**: Many mods depend on `positioning` but not on `sex-penile-oral`. Placing these state components in `positioning` allows actions across multiple mods (affection, kissing, caressing, etc.) to check for blowjob state and adjust their availability accordingly without creating circular dependencies.

## Action Requirements

Author `data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:take_penis_in_mouth`; `name`: "Take Penis In Mouth"; `description`: "Lean in from your shared seat to take your partner's penis in your mouth, initiating oral sex."
3. `targets.primary.scope`: `sex-core:actors_sitting_close_with_uncovered_penis`; `placeholder`: `primary`; description clarifies the seated partner with exposed penis requirement.
4. `required_components`: Both `actor` and `primary` require `positioning:sitting_on` and `positioning:closeness` components (matching the seated action pattern from `lick_glans_sitting_close`).【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L13-L16】
5. `forbidden_components`:
   - `actor`: `["positioning:giving_blowjob"]` – Prevent initiating a blowjob while already giving one.
6. `template`: Exactly `take {primary}'s penis in your mouth`.
7. `prerequisites`: Empty array (align with seated oral action conventions).
8. `visual`: Copy the purple palette values from `lick_glans_sitting_close` for category consistency:
   ```json
   {
     "backgroundColor": "#2a1a5e",
     "textColor": "#ede7f6",
     "hoverBackgroundColor": "#372483",
     "hoverTextColor": "#ffffff"
   }
   ```
   【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L19-L24】
9. Register the new action file path in `data/mods/sex-penile-oral/mod-manifest.json` under the `actions` array.

## Rule and Condition Requirements

### Rule: `handle_take_penis_in_mouth.rule.json`

Implement `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json` following the stateful component management pattern from `handle_hug_tight.rule.json`:

1. `$schema`: `schema://living-narrative-engine/rule.schema.json`.
2. `rule_id`: `handle_take_penis_in_mouth`; `comment`: "Handles the 'sex-penile-oral:take_penis_in_mouth' action. Cleans up existing blowjob state, adds reciprocal giving/receiving components, dispatches descriptive text, and ends the turn."
3. `event_type`: `core:attempt_action`; `condition`: Reference to `sex-penile-oral:event-is-action-take-penis-in-mouth`.
4. **State cleanup logic** (mirror hug_tight pattern):【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L24-L143】
   - Query existing `positioning:giving_blowjob` and `positioning:receiving_blowjob` components for both actor and primary.
   - If actor has existing `giving_blowjob` component, remove `receiving_blowjob` from the previously referenced entity.
   - If actor has existing `receiving_blowjob` component, remove `giving_blowjob` from the previously referenced entity.
   - Repeat cleanup for primary's existing blowjob components.
   - Remove both component types from actor and primary to ensure clean state.
5. **State establishment**:
   - `ADD_COMPONENT` for actor: `positioning:giving_blowjob` with `{ "receiving_entity_id": "{event.payload.primaryId}", "initiated": true }`.
   - `ADD_COMPONENT` for primary: `positioning:receiving_blowjob` with `{ "giving_entity_id": "{event.payload.actorId}", "consented": true }`.
6. **Name and position retrieval**:
   - `GET_NAME` for actor into `actorName`.
   - `GET_NAME` for primary into `primaryName`.
   - `QUERY_COMPONENT` for actor's `core:position` into `actorPosition`.
7. **Event payload setup**:
   - `SET_VARIABLE` `logMessage`: `{context.actorName} leans down to {context.primaryName}'s lap and takes {context.primaryName}'s cock in the mouth, wrapping the sex organ in that velvety warmth.`
   - `SET_VARIABLE` `perceptionType`: `action_target_general`.
   - `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`.
   - `SET_VARIABLE` `actorId`: `{event.payload.actorId}`.
   - `SET_VARIABLE` `targetId`: `{event.payload.primaryId}`.
8. Invoke `{ "macro": "core:logSuccessAndEndTurn" }` to finalize.
9. Register rule in `data/mods/sex-penile-oral/mod-manifest.json` under the `rules` array.

### Condition: `event-is-action-take-penis-in-mouth.condition.json`

Implement `data/mods/sex-penile-oral/conditions/event-is-action-take-penis-in-mouth.condition.json`:

1. `$schema`: `schema://living-narrative-engine/condition.schema.json`.
2. `id`: `sex-penile-oral:event-is-action-take-penis-in-mouth`; `description`: "True when the action ID is sex-penile-oral:take_penis_in_mouth."
3. Condition logic: Check `event.payload.actionId` equals `sex-penile-oral:take_penis_in_mouth`.
4. Register condition in `data/mods/sex-penile-oral/mod-manifest.json` under the `conditions` array.

## Testing Requirements

Create comprehensive integration test coverage under `tests/integration/mods/sex-penile-oral/` following the patterns established in the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L347】

### Action Discovery Test Suite

Author `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action_discovery.test.js`:

1. **Test setup**:
   - Use `ModTestFixture.forAction('sex-penile-oral', 'sex-penile-oral:take_penis_in_mouth')`.
   - Install the `sex-core:actors_sitting_close_with_uncovered_penis` scope override using the existing sitting close fixtures.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action_discovery.test.js†L10-L11】
   - Configure action discovery via `fixture.testEnv.actionIndex.buildIndex([takepenisInMouthAction])`.

2. **Positive discovery test**:
   - Build scenario using `buildBreatheTeasinglyOnPenisSittingCloseScenario()` (reuse existing fixture helper).
   - Assert action is discovered with correct template: `take {primary}'s penis in your mouth`.

3. **Negative discovery tests** (ensure action does NOT appear when prerequisites fail):
   - **Penis covered**: Use `{ coverPrimaryPenis: true }` option.
   - **Actor not sitting**: Use `{ includeActorSitting: false }` option.
   - **Primary not sitting**: Use `{ includePrimarySitting: false }` option (if fixture supports).
   - **No closeness**: Build scenario without closeness component establishment.
   - **Already giving blowjob**: Manually add `positioning:giving_blowjob` component to actor, assert action is forbidden.

4. **Cleanup**: Use `afterEach` hook with scope resolver restoration and fixture cleanup.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action_discovery.test.js†L33-L43】

### Rule Behavior Test Suite

Author `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action.test.js`:

1. **Test setup**:
   - Use `ModTestFixture.forActionAutoLoad('sex-penile-oral', 'sex-penile-oral:take_penis_in_mouth')` to auto-load rule and condition.
   - Install scope override and configure action discovery.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action.test.js†L32-L35】

2. **Successful execution test**:
   - Build scenario using sitting close fixture helper.
   - Execute action via `testFixture.executeAction(actorId, primaryId, { additionalPayload: { primaryId } })`.
   - Assert action success with expected message using `ModAssertionHelpers.assertActionSuccess()`.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action.test.js†L59-L62】
   - Assert perceptible event with correct payload using `ModAssertionHelpers.assertPerceptibleEvent()`.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action.test.js†L64-L70】
   - Expected message: `"{actorName} leans down to {primaryName}'s lap and takes {primaryName}'s cock in the mouth, wrapping the sex organ in that velvety warmth."`

3. **Component state verification**:
   - After execution, retrieve actor entity via `testFixture.entityManager.getEntityInstance(actorId)`.
   - Assert actor has `positioning:giving_blowjob` component with correct `receiving_entity_id` reference.
   - Retrieve primary entity and assert it has `positioning:receiving_blowjob` component with correct `giving_entity_id` reference.
   - Use domain matchers: `expect(actor).toHaveComponent('positioning:giving_blowjob')`.【F:docs/testing/mod-testing-guide.md†L158】

4. **State cleanup verification test**:
   - Build scenario where actor already has `positioning:giving_blowjob` component referencing a different entity.
   - Execute action with new primary target.
   - Assert old receiving entity no longer has `positioning:receiving_blowjob`.
   - Assert new primary has correct `positioning:receiving_blowjob` component.
   - Assert actor's `positioning:giving_blowjob` now references new primary.

5. **Negative rule trigger test**:
   - Build scenario with different action ID.
   - Execute different action (e.g., `sex-penile-oral:lick_glans_sitting_close`).
   - Assert `take_penis_in_mouth` rule did NOT fire.【F:tests/integration/mods/sex-penile-oral/lick_glans_sitting_close_action.test.js†L73-L80】

6. **Cleanup**: Standard `afterEach` with scope restoration and fixture cleanup.

### Test Organization and Best Practices

- Follow modern fixture lifecycle patterns: await factories in `beforeEach`, cleanup in `afterEach`.【F:docs/testing/mod-testing-guide.md†L172-L175】
- Import domain matchers: `import '../../common/mods/domainMatchers.js';` and `import '../../common/actionMatchers.js';`.【F:docs/testing/mod-testing-guide.md†L152-L166】
- Use scenario helpers from existing seated fixtures rather than building entities manually.【F:docs/testing/mod-testing-guide.md†L177-L182】
- Validate component payloads with `toHaveComponentData(componentType, expectedData)` matcher for deep assertions.【F:docs/testing/mod-testing-guide.md†L159】
- Enable diagnostics only for debugging, keep passing runs silent.【F:docs/testing/mod-testing-guide.md†L144-L148】

## Acceptance Criteria

- [ ] Both positioning components (`giving_blowjob`, `receiving_blowjob`) validate against their schemas with correct entity ID references and optional consent properties.
- [ ] Action JSON validates with forbidden component restriction on actor's `positioning:giving_blowjob`.
- [ ] Rule includes comprehensive state cleanup logic (removes existing blowjob components before adding new ones) mirroring the hug_tight pattern.
- [ ] Rule establishes reciprocal component relationship with correct entity references.
- [ ] Condition file whitelists only `sex-penile-oral:take_penis_in_mouth` action ID.
- [ ] All files registered in `sex-penile-oral` and `positioning` mod manifests.
- [ ] Action discovery test suite covers positive case (sitting close with uncovered penis) and negative cases (covered penis, not sitting, no closeness, already giving blowjob).
- [ ] Rule behavior test suite verifies successful execution with correct message, perceptible event payload, component state establishment, state cleanup on subsequent actions, and negative rule trigger case.
- [ ] Test command `npm run test:integration -- tests/integration/mods/sex-penile-oral/take_penis_in_mouth*.test.js` passes with 100% pass rate.
- [ ] Visual palette matches existing `sex-penile-oral` action styling for UI consistency.

## Implementation Notes

- **Dependency consideration**: The positioning mod must be updated before the sex-penile-oral mod to ensure component definitions exist before action references them.
- **State transition actions**: Future specifications should address releasing from blowjob state (e.g., `pull_away_from_blowjob`, `end_blowjob`) following the pattern of `hugging:release_hug`.
- **Multi-mod coordination**: Other mods (kissing, affection, caressing) should eventually add forbidden checks for `positioning:giving_blowjob` and `positioning:receiving_blowjob` on actions that conflict with oral engagement.
- **Consent mechanics**: The `consented` property on both components enables future consent-checking logic and forced release actions.
