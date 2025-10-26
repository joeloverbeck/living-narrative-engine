# Specification: Rub Penis Against Penis Action

## Overview
Introduce a face-to-face penis-to-penis rubbing interaction in the `sex` mod. The acting character must have an uncovered penis and be in close proximity to a partner who also has an uncovered penis within the `sex-core:actors_with_penis_facing_each_other` scope. The experience should highlight the intimate contrast between their genitalia through matching narrative and perceptible event messaging.

## Action Definition: `sex-dry-intimacy:rub_penis_against_penis`

- **File**: `data/mods/sex-dry-intimacy/actions/rub_penis_against_penis.action.json`
- **Scope**: Primary target resolves through `sex-core:actors_with_penis_facing_each_other`.
- **Template**: `rub your penis against {primary}'s penis`
- **Prerequisites**:
  - `hasPartOfType` check ensuring the actor possesses a penis.
  - `isSocketCovered` guard confirming the actor's penis is uncovered.
- **Required Components**: Actor must have `positioning:closeness`.
- **Forbidden Components**: None.
- **Visual Styling**: Reuse the standard deep-purple palette used by the other sex actions.

## Rule Definition: `handle_rub_penis_against_penis`

- **File**: `data/mods/sex-dry-intimacy/rules/handle_rub_penis_against_penis.rule.json`
- **Trigger**: `core:attempt_action` filtered via `sex-dry-intimacy:event-is-action-rub-penis-against-penis`.
- **Output Message**: `{actor} rubs their penis against {primary}'s penis, making both intimately aware of the differences in their genital organs.` — this line must be used for both the successful action display and the perceptible event payload.
- **Perception Metadata**: `perceptionType` remains `action_target_general` and the event should resolve to the actor's location and the primary target's entity ID.
- **Macro**: Finish with `core:logSuccessAndEndTurn` for consistency with existing intimate actions.

## Condition Definition
- **File**: `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-penis-against-penis.condition.json`
- **Logic**: Strict equality check on `event.payload.actionId` to `sex-dry-intimacy:rub_penis_against_penis`.

## Testing Requirements
Create comprehensive integration coverage before shipping this feature.

### 1. Rule Execution Suite
- **File**: `tests/integration/mods/sex/rub_penis_against_penis_action.test.js`
- **Goals**:
  - Execute the action through `ModTestFixture.forAction('sex-dry-intimacy', 'sex-dry-intimacy:rub_penis_against_penis')` with a fully wired anatomy graph containing two uncovered penises and mutual closeness.
  - Assert the shared success/perceptible message matches the specification verbatim.
  - Verify the perceptible event metadata (location, actor, target, perception type) mirrors other sex actions.
  - Include a resilience check that the rule does not misfire for unrelated actions.

### 2. Action Discovery Suite
- **File**: `tests/integration/mods/sex/rub_penis_against_penis_action_discovery.test.js`
- **Coverage Expectations**:
  - Seed the action index with `sex-dry-intimacy:rub_penis_against_penis` and confirm discoverability when both actors are close, facing each other, and have uncovered penises.
  - Negative assertions must cover:
    - Actor missing a penis.
    - Actor penis covered by clothing.
    - Target penis covered by clothing.
    - Missing closeness relationship.
    - Target facing away from the actor.
  - Use `ModTestFixture` discovery helpers, apply the anatomy/clothing patterns from existing penis-to-penis suites, and document the scenario builder so future tests can extend it.

### Diagnostics & Methodology
Consult the latest discovery guidance in `docs/testing/mod-testing-guide.md` and `docs/testing/mod-testing-guide.md#action-discovery-harness` to ensure fixtures, matchers, and diagnostics follow current conventions. Capture failures using the built-in helpers rather than ad-hoc logging.

## Deliverables Checklist
- [ ] Action, condition, and rule JSON validated via schema tooling.
- [ ] Manifest updated to register the new assets.
- [ ] Integration suites in place and passing (rule execution + discovery).
- [ ] Narrative strings reviewed for tone and duplication across perceptible and success events.
