# Vampirism: Pull Out Fangs Action & Rule Specification

## Overview

This document defines a new action and rule for the vampirism mod that allows a vampire who is currently biting a target's neck to withdraw their fangs. The feature should cleanly exit the biting posture, update state components for both entities, and provide clear narrative feedback consistent with existing vampirism interactions such as `bare_fangs`, `bite_neck_carefully`, and `drink_blood`.

## Feature Summary

- **Feature Name**: Pull Out Fangs
- **Mod**: `vampirism`
- **Action ID**: `vampirism:pull_out_fangs`
- **Rule ID**: `handle_pull_out_fangs`
- **Purpose**: Let the vampire stop biting a neck, removing the reciprocal positioning components and narrating the disengagement.
- **State Impact**: Removes the biting/being-bitten relationship components from both actors.

## Action Design

### Targets Scope
- Use `vampirism:actor_being_bitten_by_me` (see `data/mods/vampirism/actions/drink_blood.action.json` for precedent).

### Required Components
- `actor`: `["positioning:biting_neck"]`

### Forbidden Components
- `actor`: `["positioning:being_bitten_in_neck"]`
  - Mirrors the guard in `drink_blood.action.json` to ensure vampires cannot simultaneously be bitten while attempting to disengage their own bite.

### Template & Visuals
- **Template**: `pull out your fangs from {target}'s neck`
- **Visual Scheme**: Match the dark crimson and pale text palette used by `bare_fangs.action.json`, `bite_neck_carefully.action.json`, and `drink_blood.action.json`:
  ```json
  {
    "backgroundColor": "#6c0f36",
    "textColor": "#ffe6ef",
    "hoverBackgroundColor": "#861445",
    "hoverTextColor": "#fff2f7"
  }
  ```

### Metadata
- Provide a short description such as: "Withdraw your fangs from the target's neck, ending the bite."
- Ensure action schema fields align with `schema://living-narrative-engine/action.schema.json`.

## Rule Design

### Trigger Condition
- Mirror the existing rule patterns (e.g., `data/mods/vampirism/rules/handle_bare_fangs.rule.json`).
- Bind to the action via a dedicated condition (e.g., `vampirism:event-is-action-pull_out_fangs`).

### Effects
- Remove `positioning:biting_neck` from the acting vampire.
- Remove `positioning:being_bitten_in_neck` from the target specified by the action scope.
- Ensure reciprocal removal only occurs when component IDs correspond to each other, similar to validation logic in `vampirism:actor_being_bitten_by_me` scope.

### Messaging
- **Perceptible Event Message**: `{actor} pulls out their fangs from {target}'s neck.`
- **Successful Action Message**: `{actor} pulls out their fangs from {target}'s neck.`
  - Follow the messaging conventions used by other vampirism rules for consistency.

### Turn Handling
- End the actor's turn after the state updates, aligning with other vampirism action handlers unless a different flow is required by design.

## Testing Requirements

### Action Discoverability
- Add integration tests under `tests/integration/mods/vampirism/` to confirm the action appears in the action list when:
  - The actor has `positioning:biting_neck` referencing the target.
  - The target has `positioning:being_bitten_in_neck` referencing the actor.
  - The scope `vampirism:actor_being_bitten_by_me` yields the target.
- Ensure tests cover absence cases (e.g., action hidden when the actor lacks `positioning:biting_neck`).
- Use existing fixtures and helpers documented in `docs/testing/` and reference patterns from tests such as `bare_fangs_action.test.js`.

### Rule Behavior
- Create integration rule tests verifying:
  - Both positioning components are removed after action execution.
  - The reciprocal component data is cleared only when IDs match.
  - The perceptible event and success messages match exactly.
  - No extraneous components are modified.

### Regression Coverage
- Include negative tests to ensure components remain unchanged when the rule receives malformed or non-reciprocal component data.
- Validate that the action cannot be executed when forbidden component conditions are violated.

### Testing Framework Notes
- Follow the latest mod testing guidelines in `docs/testing/`.
- Update or create reusable fixtures if necessary, keeping them scoped to the vampirism mod.
- Ensure all new tests run via `npm run test:integration` and pass before submitting a PR.

## Implementation Checklist

1. Create the new action JSON in `data/mods/vampirism/actions/` following the schema and visual style.
2. Register the action in `data/mods/vampirism/mod-manifest.json`.
3. Implement the supporting condition and rule JSON files in `data/mods/vampirism/conditions/` and `data/mods/vampirism/rules/`.
4. Update any localization or narrative tables if required (check existing patterns for vampirism actions).
5. Add comprehensive integration tests for action discoverability and rule behavior.
6. Run `npm run validate` for schema compliance and `npm run test:integration` to exercise the new tests.
7. Document any new fixtures or utilities introduced for testing.

