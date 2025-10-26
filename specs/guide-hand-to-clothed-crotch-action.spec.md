# Specification: Guide Hand to Clothed Crotch Action

## Overview
Add a clothed crotch guidance interaction to the `sex-penile-manual` mod. The acting character eases the primary target's hand
onto the bulge of their covered crotch while the pair remain close and either facing one another or positioned directly behind
one another. The addition must mirror the palette, structural conventions, and narrative tone of existing actions in the mod.

## Action Definition: `sex-penile-manual:guide_hand_to_clothed_crotch`

- **File**: `data/mods/sex-penile-manual/actions/guide_hand_to_clothed_crotch.action.json`.
- **Target Scope**: Primary target resolves through `positioning:close_actors_facing_each_other_or_behind_target`.
- **Template**: `guide {primary}'s hand to the bulge of your crotch`.
- **Required Components**: Actor must include `positioning:closeness`.
- **Forbidden Components**: Actor may **not** have `positioning:receiving_blowjob` (i.e., reference `data/mods/positioning/components/receiving_blowjob.component.json`).
- **Prerequisites** (adapt the uncovered checks from `sex-dry-intimacy:rub_penis_against_penis`):
  - `hasPartOfType` asserting the actor possesses a penis.
  - `isSocketCovered` confirmation that the actor's penis socket is covered (use the positive check rather than the negated form in the reference action).
- **Description**: Focus on coaxing the partner's hand to the clothed bulge—do not imply exposure.
- **Visual Styling**: Reuse the rust-orange palette employed by current `sex-penile-manual` actions (`backgroundColor` `#8a3b12`, `textColor` `#fff4e6`, `hoverBackgroundColor` `#a04a1b`, `hoverTextColor` `#fffaf2`).
- **Manifest Updates**: Register the new action within `data/mods/sex-penile-manual/mod-manifest.json` alongside existing entries.

## Rule Definition: `handle_guide_hand_to_clothed_crotch`

- **File**: `data/mods/sex-penile-manual/rules/handle_guide_hand_to_clothed_crotch.rule.json`.
- **Trigger**: `core:attempt_action` filtered through a dedicated condition `sex-penile-manual:event-is-action-guide-hand-to-clothed-crotch`.
- **Narrative Output**: Both the perceptible event message and the successful action log must read `{actor} takes {primary}'s wrist gently and guides their hand to the clothed bulge of {actor}'s crotch.`
- **Perception Metadata**: Continue the mod's pattern—set `perceptionType` to `action_target_general`, point `locationId` at the actor's current location, and include the primary target's ID.
- **Macro**: Conclude with `core:logSuccessAndEndTurn`.

## Condition Definition

- **File**: `data/mods/sex-penile-manual/conditions/event-is-action-guide-hand-to-clothed-crotch.condition.json`.
- **Logic**: Equality check on `event.payload.actionId` against `sex-penile-manual:guide_hand_to_clothed_crotch`.

## Testing Requirements
Implement comprehensive integration coverage to guarantee discoverability and narrative behavior. Use the reference suites in
`tests/integration/mods/` plus the current guidance in `docs/testing/` for fixture patterns.

### 1. Action Discoverability Suite
- **Suggested File**: `tests/integration/mods/sex-penile-manual/guide_hand_to_clothed_crotch_action_discovery.test.js`.
- **Goals**:
  - Confirm discoverability when both actors are close (`positioning:closeness` present), satisfy the positional scope, and the actor's penis is covered.
  - Assert the action is **not** suggested when any prerequisite fails (actor lacks penis, penis uncovered, actor lacks closeness, actor flagged with `receiving_blowjob`, or the positional scope cannot be satisfied).
  - Document the anatomy/clothing fixture arrangement so future suites can reuse it.

### 2. Rule Behavior Suite
- **Suggested File**: `tests/integration/mods/sex-penile-manual/guide_hand_to_clothed_crotch_rule.test.js`.
- **Goals**:
  - Execute the action via `ModTestFixture.forAction('sex-penile-manual', 'sex-penile-manual:guide_hand_to_clothed_crotch')` and assert the log + perceptible messages exactly match the required string.
  - Verify the perception metadata (`perceptionType`, `locationId`, `targetId`) aligns with other `sex-penile-manual` rules.
  - Include a guard to ensure unrelated actions do not invoke the rule.

## Deliverables Checklist
- [ ] Action JSON created with schema-compliant structure and registered in the manifest.
- [ ] Condition and rule JSON created, with consistent naming and `core:logSuccessAndEndTurn` usage.
- [ ] Narrative text double-checked for the clothed emphasis and duplicated across success + perceptible payloads.
- [ ] Integration suites implemented and passing (discoverability + rule behavior), following current guidance from `docs/testing/`.
