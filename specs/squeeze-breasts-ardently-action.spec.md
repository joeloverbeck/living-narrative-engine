# Squeeze Breasts Ardently Action & Rule Specification

## Overview

Add an ardent breast-squeezing interaction to the `sex-breastplay` mod that builds on the fondling and nuzzling flows while expanding orientation support beyond face-to-face setups. The new content should reuse the mod's purple UI palette, closeness gating, and descriptive structure so it fits seamlessly with existing breastplay actions.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L1-L26】【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L1-L26】

## Reference Materials & Constraints

- Mirror the target anatomy checks and uncovered-breast logic from `sex-breastplay:actors_with_breasts_facing_each_other`, but extend the orientation block to allow the target to face away when the actor is behind them, following the pattern in `positioning:close_actors_facing_each_other_or_behind_target`.【F:data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other.scope†L1-L14】【F:data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L15】
- Keep the single-target layout, `target` placeholder, `positioning:closeness` requirement, and `positioning:giving_blowjob` exclusion seen in the existing breastplay actions so availability stays consistent.【F:data/mods/sex-breastplay/actions/fondle_breasts.action.json†L6-L20】【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L6-L20】
- Reuse the purple visual scheme from `nuzzle_bare_breasts.action.json` for the new action card.【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L21-L26】
- Follow the mod testing guide and existing breastplay integration suites when authoring new discovery and execution tests so fixtures, helpers, and assertions align with repository standards.【F:docs/testing/mod-testing-guide.md†L1-L120】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action_discovery.test.js†L1-L151】【F:tests/integration/mods/sex/nuzzle_bare_breasts_action.test.js†L1-L140】

## Scope Requirements

1. Create `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_or_away.scope` (name can vary if aligned with naming conventions) by adapting `actors_with_breasts_facing_each_other`:
   - Keep the closeness chain, breast anatomy requirement, and uncovered chest check intact.【F:data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other.scope†L1-L13】
   - Replace the single `entity-not-in-facing-away` guard with an `or` block that passes when actors face each other **or** the actor is behind the target, reusing the positioning conditions leveraged by `positioning:close_actors_facing_each_other_or_behind_target`.【F:data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope†L5-L14】
   - Document the orientation flexibility in comments to match the tone of the other scope files.
   - Register the new scope path in `data/mods/sex-breastplay/mod-manifest.json`.

## Action Requirements

Author `data/mods/sex-breastplay/actions/squeeze_breasts_ardently.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-breastplay:squeeze_breasts_ardently`; `name`: `Squeeze Breasts Ardently`; describe the action as the actor gripping and squeezing the target's breasts with fervor.
3. `targets.primary.scope`: reference the new scope above, keep `placeholder` = `target`, and describe the target as the partner whose breasts are being squeezed ardently.
4. `required_components.actor`: `["positioning:closeness"]`.
5. `forbidden_components.actor`: `["positioning:giving_blowjob"]`.
6. `template`: exactly `grab {target}'s breasts ardently`.
7. `prerequisites`: empty array.
8. `visual`: copy the four-color palette from `nuzzle_bare_breasts.action.json` (`#7a1d58`, `#fde6f2`, `#8d2465`, `#fff2f9`).【F:data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json†L21-L26】
9. Register the action filename in the breastplay mod manifest so it ships with the rest of the content.【F:data/mods/sex-breastplay/mod-manifest.json†L21-L52】

## Rule Requirements

1. Add `data/mods/sex-breastplay/rules/handle_squeeze_breasts_ardently.rule.json` that mirrors the macro and payload flow from `handle_fondle_breasts.rule.json`, including name resolution, perception metadata, and `core:logSuccessAndEndTurn` invocation.【F:data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json†L1-L53】
2. Load the actor's position (for `locationId`) and the triggering `targetId` the same way other breastplay rules do.【F:data/mods/sex-breastplay/rules/handle_nuzzle_bare_breasts.rule.json†L9-L47】
3. Set both the perceptible event message and the success log message to `{actor} grabs {target}'s breasts and squeezes them ardently, feeling their flesh against the palms and fingers.` before calling the macro.
4. Register the rule and any supporting condition filenames in the mod manifest (`content.rules`, plus `content.conditions` if a dedicated event condition is added).【F:data/mods/sex-breastplay/mod-manifest.json†L28-L52】

## Testing Requirements

Produce comprehensive integration coverage to match the depth of existing breastplay suites:

1. **Action discoverability** — Add `tests/integration/mods/sex/squeeze_breasts_ardently_action_discovery.test.js` that asserts the action appears with close partners who have uncovered breasts, supports both face-to-face and actor-behind orientations, and is excluded when closeness is absent, breasts are covered/missing, or the actor has `positioning:giving_blowjob`. Include checks for template text, required/forbidden components, scope binding, and visual palette consistency.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L155】
2. **Rule behavior** — Add `tests/integration/mods/sex/squeeze_breasts_ardently_action.test.js` validating the rule emits the specified perceptible event and success log, applies perception metadata (location, target, perception type), and ends the actor's turn using the same helper patterns as the other breastplay rule tests.【F:tests/integration/mods/sex/fondle_breasts_action.test.js†L1-L136】

Ensure all new files adhere to the repository's mod testing documentation and naming conventions during implementation.【F:docs/testing/mod-testing-guide.md†L1-L120】
