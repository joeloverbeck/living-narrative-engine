# Suck On Nipples Action & Rule Specification

## Overview

Design a sensual suction-focused interaction for the `sex-breastplay` mod that builds directly on the existing bare-breast framework established by the nuzzle action while escalating intensity toward oral nipple play.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L1-L27】 The new assets must keep parity with breastplay aesthetics, component gates, and manifest wiring so that they slot seamlessly beside the current catalog.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L1-L55】

## Reference Materials & Constraints

- Reuse the single-target structure, closeness prerequisite, blowjob exclusion, and purple UI palette demonstrated by `sex-breastplay:nuzzle_bare_breasts` to ensure visual and behavioral continuity within the mod.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L26】
- Pattern the new rule after `handle_nuzzle_bare_breasts` by loading actor/target names, querying the actor's position, and finalizing with the `core:logSuccessAndEndTurn` macro so perception metadata and turn flow mirror existing content.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L7-L55】
- Follow the Mod Testing Guide for fixture setup, discovery assertions, and helper usage when authoring tests.【F:docs/testing/mod-testing-guide.md†L1-L10】
- Use the `fondle_breasts` integration suites as templates for both rule-behavior and discovery coverage breadth.【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L1-L136】【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】

## Action Requirements

Create `data/mods/sex-breastplay/actions/suck_on_nipples.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-breastplay:suck_on_nipples`; `name`: `Suck On Nipples`; `description`: emphasize the actor taking the target's nipples into their mouth and nursing them hungrily.
3. `targets.primary.scope`: `sex-breastplay:actors_with_breasts_facing_each_other`; retain `placeholder` = `target` and describe the target as the partner whose nipples are being sucked.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L11】
4. `required_components.actor`: `["positioning:closeness"]` so the action only appears when participants are in intimate proximity.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L13-L15】
5. `forbidden_components.actor`: `["positioning:giving_blowjob"]`, preventing availability while the actor is already servicing someone orally.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L16-L18】
6. `template`: exactly `suck on {target}'s nipples`.
7. `prerequisites`: empty array.
8. `visual`: reuse the purple/pink palette (`#7a1d58`, `#fde6f2`, `#8d2465`, `#fff2f9`) for cohesion.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L21-L26】
9. Register the action in `data/mods/sex-breastplay/mod-manifest.json` under `content.actions`.

## Rule Requirements

Implement `data/mods/sex-breastplay/rules/handle_suck_on_nipples.rule.json` with this flow:

1. Schema: `schema://living-narrative-engine/rule.schema.json`; `rule_id`: `handle_suck_on_nipples`; `event_type`: `core:attempt_action`.
2. Gate on a new condition `sex-breastplay:event-is-action-suck-on-nipples` that mirrors the nuzzle condition pattern (checking `event.payload.actionId`).
3. Actions:
   - `GET_NAME` for actor and target, storing `actorName` and `targetName`.
   - `QUERY_COMPONENT` the actor's `core:position` to capture `locationId`.
   - `SET_VARIABLE` `logMessage` to `{actor} sucks eagerly on {target}'s hard nipples, {actor}'s tongue swirling around the sensitive, hardened flesh.` and reuse this string for both success log and perceptible event message.
   - Populate `perceptionType = 'action_target_general'`, `locationId = {context.actorPosition.locationId}`, and `targetId = {event.payload.targetId}`.
   - Invoke the `core:logSuccessAndEndTurn` macro to emit the perceptible event and close the turn, matching breastplay conventions.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L24-L55】
4. Register the condition and rule within the mod manifest's `content.conditions` and `content.rules` arrays.

## Testing Requirements

Author comprehensive integration coverage alongside existing breastplay suites:

1. **Action discoverability** — Add `tests/integration/mods/sex/suck_on_nipples_action_discovery.test.js` via `ModTestFixture.forAction('sex-breastplay', 'sex-breastplay:suck_on_nipples')`. Assert the action appears when actors with exposed breasts are in closeness, validate the template string, scope binding, required/forbidden components, and UI palette, and ensure it is hidden when proximity fails, the actor carries `positioning:giving_blowjob`, or the target lacks breast anatomy.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】
2. **Rule behavior** — Add `tests/integration/mods/sex/suck_on_nipples_action.test.js` that executes the action, asserts the success/perceptible messages match the specified string, confirms the event metadata (location, perception type, target id), and verifies the rule does not trigger for unrelated actions.【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L75-L136】
3. Follow the Mod Testing Guide's fixtures, cleanup, and helper expectations to keep suites aligned with repository standards.【F:docs/testing/mod-testing-guide.md†L1-L10】

## Acceptance Criteria

- Action, condition, and rule JSON validate, register in the manifest, and replicate the closeness/forbidden component gating seen in the existing nuzzle implementation.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L26】【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L7-L55】
- Rule execution emits `{actor} sucks eagerly on {target}'s hard nipples, {actor}'s tongue swirling around the sensitive, hardened flesh.` for both perceptible and success messages while logging proper perception metadata before ending the turn.
- Integration suites cover discoverability gating (including the blowjob restriction) and rule behavior following mod testing best practices.【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L75-L136】【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L60-L155】【F:docs/testing/mod-testing-guide.md†L1-L10】
