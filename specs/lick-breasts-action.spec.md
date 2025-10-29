# Lick Breasts Action & Rule Specification

## Overview

Introduce a new licking-focused breastplay interaction in the `sex-breastplay` mod that builds directly on the existing bare-breast nuzzling content. The new action must keep the same single-target structure, scope, proximity expectations, and palette already established for bare breast contact so the module maintains a consistent player experience.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L26】【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L10-L55】

## Reference Materials & Constraints

- Use the `sex-breastplay:actors_with_breasts_facing_each_other` primary scope, `target` placeholder, and descriptive copy patterns from the nuzzling action as baselines for the new interaction.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L20】
- Preserve the `positioning:closeness` requirement and `positioning:giving_blowjob` forbidden component on the acting entity so the action surfaces under the same intimacy gatekeeping rules.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L13-L18】
- Follow the handler shape from `handle_nuzzle_bare_breasts.rule.json`, including `GET_NAME`, `QUERY_COMPONENT`, perception metadata variables, and the `core:logSuccessAndEndTurn` macro.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L10-L55】
- Mirror the breadth of the existing nuzzle action discovery and execution suites when outlining coverage expectations for the new tests.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L54-L149】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L31-L130】
- Adhere to the current mod testing practices documented in the Mod Testing Guide for fixture setup, scope registration, and assertion helpers.【F:docs/testing/mod-testing-guide.md†L7-L80】

## Action Requirements

Author `data/mods/sex-breastplay/actions/lick_breasts.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-breastplay:lick_breasts`; `name`: `Lick Breasts`; `description`: emphasize the actor licking the target's exposed breasts.
3. `targets.primary.scope`: `sex-breastplay:actors_with_breasts_facing_each_other`; keep `placeholder` = `target` and describe the target as the partner whose breasts are being licked.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L11】
4. `required_components.actor`: `["positioning:closeness"]` and `forbidden_components.actor`: `["positioning:giving_blowjob"]` exactly, matching the nuzzling prerequisites.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L13-L18】
5. `template`: exactly `lick {target}'s breasts`.
6. `prerequisites`: empty array.
7. `visual`: reuse the existing nuzzle palette of `#7a1d58`, `#fde6f2`, `#8d2465`, and `#fff2f9` for consistency.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L21-L25】
8. Register the action in `data/mods/sex-breastplay/mod-manifest.json` under `content.actions` so it is discoverable by the engine alongside other breastplay actions.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L26】

## Rule Requirements

1. Add `data/mods/sex-breastplay/conditions/event-is-action-lick-breasts.condition.json` mirroring the naming and payload checks from the nuzzling condition but targeting `sex-breastplay:lick_breasts`.
2. Implement `data/mods/sex-breastplay/rules/handle_lick_breasts.rule.json` by adapting the nuzzling handler:
   - Resolve actor and target names plus the actor's `core:position` component using the same action list order.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L10-L25】
   - Set both the perceptible event message and the success log message to `{actor} licks {target}'s breasts, {actor}'s tongue sliding warm and wet over {target}'s tit meat.`
   - Populate `perceptionType = 'action_target_general'`, `locationId = {context.actorPosition.locationId}`, and `targetId = {event.payload.targetId}` before invoking `core:logSuccessAndEndTurn`.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L26-L55】
3. Register the new condition and rule in `data/mods/sex-breastplay/mod-manifest.json` under `content.conditions` and `content.rules` respectively.

## Testing Requirements

Deliver comprehensive integration coverage to guarantee both discoverability and rule execution behave as specified:

1. **Action discoverability** — Create `tests/integration/mods/sex/lick_breasts_action_discovery.test.js` patterned after the existing nuzzle discovery suite. Validate the action appears for close, breast-endowed partners, enforces the forbidden blowjob state, and preserves the template/visual metadata.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L54-L149】
2. **Rule behavior** — Create `tests/integration/mods/sex/lick_breasts_action.test.js` that executes the new action and asserts narration, perceptible event payload, metadata, and turn-ending behavior, matching the structure of the nuzzle integration tests.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L31-L130】
3. Follow the Mod Testing Guide checklist for fixture construction, scope overrides, and assertion helpers to keep the new suites aligned with the testing standards.【F:docs/testing/mod-testing-guide.md†L7-L80】

## Acceptance Criteria

- Action, condition, and rule JSON files validate, share the nuzzling interaction's scope/components, and register in the mod manifest so the engine can discover and execute them.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L26】【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L10-L55】
- Executing `sex-breastplay:lick_breasts` logs and emits `{actor} licks {target}'s breasts, {actor}'s tongue sliding warm and wet over {target}'s tit meat.` as both the success message and perceptible event with correct perception metadata before ending the turn.
- Integration suites cover availability gating (including the blowjob restriction) and rule execution behavior comparable to existing breastplay actions, providing regression protection for the new content.【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L92-L148】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L57-L130】【F:docs/testing/mod-testing-guide.md†L7-L80】
