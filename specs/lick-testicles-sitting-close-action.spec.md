# Lick Testicles (Sitting Close) Specification

## Overview

Deliver a seated variation of the testicle-licking interaction so partners who are already sharing close seating can indulge in oral attention without transitioning into a kneeling pose. The new content should parallel the sensual tone and saliva-focused narration of `sex-penile-oral:lick_testicles_sensually` while inheriting the seated proximity ergonomics introduced for `sex-penile-oral:lick_glans_sitting_close`.

## Reference Materials and Constraints

- **Baseline testicle lick** – Mirror the schema structure, template phrasing, and warm narration found in the existing kneeling action definition.【F:data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json†L1-L24】【F:data/mods/sex-penile-oral/rules/handle_lick_testicles_sensually.rule.json†L1-L40】
- **Seated proximity precedent** – Reuse the closeness-centric components and seated scope patterns established for the glans sitting-close action.【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L1-L25】【F:data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope†L1-L12】
- **Testicle exposure logic** – Base the uncovered anatomy checks on the shared scope that powers the kneeling variant to guarantee at least one visible testicle.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_testicle.scope†L1-L21】
- **Testing methodology** – Follow the modern fixture, discovery bed, and matcher conventions documented in the Mod Testing Guide when authoring new suites.【F:docs/testing/mod-testing-guide.md†L1-L198】
- **Nearby integration patterns** – Use the existing test suite for the kneeling action as a behavioral reference for success messaging and negative rule triggers.【F:tests/integration/mods/sex/lick_testicles_sensually_action.test.js†L1-L160】

## Scope Requirements

Create `data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_testicle.scope` that combines the shared seating contract with uncovered testicle validation:

1. Namespace the scope as `sex-core:actors_sitting_close_with_uncovered_testicle` and register it inside `data/mods/sex-core/mod-manifest.json` under the `scopes` section.
2. Require reciprocal `positioning:closeness` partners, both entities to possess `positioning:sitting_on` components, and limit candidates to those with a testicle body part.
3. Ensure the scope passes when either left or right testicle sockets are uncovered, mirroring the `or` logic from the kneeling scope while omitting the kneeling component check.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_testicle.scope†L3-L20】

## Action Requirements

Author `data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:lick_testicles_sitting_close`; `name`: “Lick Testicles (Sitting Close)”; `description`: Highlight leaning almost horizontally over a seated partner’s lap to lavish attention on exposed testicles.
3. `targets.primary.scope`: `sex-core:actors_sitting_close_with_uncovered_testicle`; set `placeholder` to `target` so the template renders naturally; describe the target as a seated partner with at least one uncovered testicle.
4. `required_components`: Match the glans sitting-close variant—both `actor` and `primary` require `positioning:sitting_on` and `positioning:closeness` components.【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L13-L16】
5. `template`: Exactly `lick {target}'s testicles sensually` (identical wording to the kneeling action).【F:data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json†L16-L23】
6. `prerequisites`: Empty array.
7. `visual`: Reuse the purple palette shared across the penile oral action set (`#2a1a5e` background, `#ede7f6` text, `#372483` hover background, `#ffffff` hover text).【F:data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json†L18-L23】
8. Register the action file path within `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule and Condition Requirements

Implement `data/mods/sex-penile-oral/rules/handle_lick_testicles_sitting_close.rule.json` and `data/mods/sex-penile-oral/conditions/event-is-action-lick-testicles-sitting-close.condition.json`.

1. The condition file must whitelist only `sex-penile-oral:lick_testicles_sitting_close` and be added to the mod manifest.
2. The rule listens to `core:attempt_action` and references the new condition.
3. Retrieve `actorName` (`entity_ref`: `actor`) and `primaryName` (`entity_ref`: `primary`) via `GET_NAME` actions, then query the actor’s `core:position` component into `actorPosition`, mirroring the seated glans handler.【F:data/mods/sex-penile-oral/rules/handle_lick_glans_sitting_close.rule.json†L1-L32】
4. Set both the perceptible event message and the success log message to `{context.actorName}, leaning almost horizontally over {context.primaryName}'s lap, licks {context.primaryName}'s testicles slowly, coating them in warm saliva.`
5. Assign `perceptionType` to `action_target_general`, copy the actor’s location (`{context.actorPosition.locationId}`), set `actorId` to `{event.payload.actorId}`, and `targetId` to `{event.payload.primaryId}` before invoking `{ "macro": "core:logSuccessAndEndTurn" }`.
6. Ensure all new files are referenced in `data/mods/sex-penile-oral/mod-manifest.json` under their respective sections.

## Testing Requirements

Author comprehensive integration coverage alongside the existing penile-oral suites:

1. **Action discoverability** – Create `tests/integration/mods/sex-penile-oral/lick_testicles_sitting_close_action_discovery.test.js` using the discovery bed helpers to confirm the action appears only when both actors sit close together and the target’s testicles are uncovered; assert absence when seating, closeness, or exposure preconditions fail.【F:docs/testing/mod-testing-guide.md†L7-L167】
2. **Rule behavior** – Add `tests/integration/mods/sex-penile-oral/lick_testicles_sitting_close_action.test.js` (or equivalent) via `ModTestFixture.forActionAutoLoad` to execute the new action, verify the perceptible and success messages match the specified narration exactly, and cover negative dispatch cases similar to the kneeling suite.【F:tests/integration/mods/sex/lick_testicles_sensually_action.test.js†L67-L159】
3. Run `npm run test:integration` locally to validate the new suites and document the passing command in submission materials.
