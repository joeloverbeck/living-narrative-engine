# Nuzzle Bare Breasts Action & Rule Specification

## Overview

Expand the `sex-breastplay` module with a nuzzling interaction that mirrors the existing fondling content structure while presenting a softer facial contact variant focused on exposed breasts.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L1-L27】 The new action and rule should stay consistent with the mod's palette, proximity requirements, and rule macro flow so breastplay scenes keep a unified presentation.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L21-L26】【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L1-L53】

## Reference Materials & Constraints

- Reuse the single-target layout, closeness requirement, `target` placeholder, and purple card styling from `sex-breastplay:fondle_breasts` to maintain module consistency.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L6-L26】
- Pattern the handler after `handle_fondle_breasts.rule.json`, including `GET_NAME`, `QUERY_COMPONENT` for the actor's position, perception metadata, and the `core:logSuccessAndEndTurn` macro structure.【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L7-L53】
- Follow the mod testing guide when authoring discovery and execution suites so fixtures, matchers, and file naming align with repository standards.【F:docs/testing/mod-testing-guide.md†L1-L120】
- Mirror the breadth of existing breastplay integration suites for discovery and rule validation to keep coverage parity with the new content.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L1-L136】

## Action Requirements

Author `data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json` with these properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-breastplay:nuzzle_bare_breasts`; `name`: `Nuzzle Bare Breasts`; `description`: emphasize the actor pressing their face tenderly against the target's uncovered chest.
3. `targets.primary.scope`: `sex-breastplay:actors_with_breasts_facing_each_other`; keep `placeholder` = `target` and describe the target as the partner whose bare breasts are being nuzzled.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L6-L11】
4. `required_components.actor`: `["positioning:closeness"]` to parallel the fondling prerequisite.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L13-L15】
5. `forbidden_components.actor`: `["positioning:giving_blowjob"]` so the action cannot surface while the actor is kneeling for oral contact.
6. `template`: exactly `nuzzle {target}'s breasts` (match the reference placeholder usage and lowercase style).【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L19-L19】
7. `prerequisites`: empty array.
8. `visual`: copy the four-color palette from the fondle action (`#7a1d58`, `#fde6f2`, `#8d2465`, `#fff2f9`) to preserve card styling.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L21-L26】
9. Register the action in `data/mods/sex-breastplay/mod-manifest.json` under `content.actions` so it loads with the rest of the mod.【F:data/mods/sex-breastplay/mod-manifest.json†L21-L36】

## Condition & Rule Requirements

1. Add `data/mods/sex-breastplay/conditions/event-is-action-nuzzle-bare-breasts.condition.json` that checks for `event.payload.actionId === 'sex-breastplay:nuzzle_bare_breasts'`, mirroring the fondle condition pattern.【F:data/mods/sex-breastplay/conditions/event-is-action-fondle-breasts.condition.json†L1-L8】
2. Implement `data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json` by adapting the fondle handler:
   - Load actor and target names, plus the actor's `core:position` for location metadata.【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L7-L23】
   - Set both the perceptible event message and success log message to `{actor} nuzzles their face against {target}'s bare breasts.` before invoking `core:logSuccessAndEndTurn`.
   - Populate `perceptionType = 'action_target_general'`, `locationId = {context.actorPosition.locationId}`, and `targetId = {event.payload.targetId}` prior to the macro call to stay consistent with peer rules.【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L24-L53】
3. Register the new condition and rule filenames in the breastplay manifest lists (`content.conditions`, `content.rules`).【F:data/mods/sex-breastplay/mod-manifest.json†L28-L47】

## Testing Requirements

Create comprehensive integration coverage alongside the existing breastplay suites:

1. **Action discoverability** — Add `tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js` using `ModTestFixture.forAction('sex-breastplay', 'sex-breastplay:nuzzle_bare_breasts')`. Assert the action appears when actors with bare breasts are close and facing, and that it is excluded when closeness is missing, the target lacks breast anatomy, or the actor has `positioning:giving_blowjob`. Include assertions for the template, scope binding, required/forbidden components, and visual palette, echoing the breadth of the fondle-over-clothes discovery suite.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】
2. **Rule behavior** — Add `tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js` that executes the new action and validates the rule's log message, perceptible event payload, location targeting, and turn termination using `ModAssertionHelpers`, paralleling the fondle breasts rule tests.【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L1-L136】
3. Follow the Mod Testing Guide's fixture setup, auto-registration options, and checklist to ensure the suites integrate smoothly with the broader mod test harness.【F:docs/testing/mod-testing-guide.md†L1-L120】

## Acceptance Criteria

- Action, condition, and rule JSON validate, register in the manifest, and inherit the reference visual style and proximity requirements.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L6-L26】【F:data/mods/sex-breastplay/mod-manifest.json†L21-L47】
- Rule execution emits `{actor} nuzzles their face against {target}'s bare breasts.` for both perceptible and success messages while logging the correct perception metadata before ending the turn.【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L24-L53】
- Integration suites cover discoverability gating (including the blowjob-forbidden component) and rule behavior, adhering to repository testing practices.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L1-L136】【F:docs/testing/mod-testing-guide.md†L1-L120】
