# Suckle Testicle (Sitting Close) Specification

## Overview

Introduce a seated variant of the sensual testicle-suckling action so players can remain in close, shared seating while indulging in oral attention. The new content should explicitly target the existing seated-with-uncovered-testicle scope and inherit the cozy, purple visual identity used across the penile-oral set.

## Reference Materials and Constraints

- **Baseline kneeling action** – Reuse the descriptive tone, schema structure, and color palette established in the original `sex-penile-oral:suckle_testicle` definition as guiding references.【F:data/mods/sex-penile-oral/actions/suckle_testicle.action.json†L1-L24】【F:data/mods/sex-penile-oral/rules/handle_suckle_testicle.rule.json†L1-L41】
- **Seated proximity precedent** – Mirror the seated target scope and bilateral component requirements from the existing lick sitting-close action.【F:data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json†L9-L20】
- **Testing playbook** – Follow the latest mod testing conventions when authoring integration coverage.【F:docs/testing/mod-testing-guide.md†L1-L198】

## Action Requirements

Create `data/mods/sex-penile-oral/actions/suckle_testicle_sitting_close.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:suckle_testicle_sitting_close`; `name`: “Suckle Testicle (Sitting Close)”. Describe the action as the actor burying their face in the seated partner’s lap to suckle an exposed testicle.
3. `targets.primary.scope`: `sex-core:actors_sitting_close_with_uncovered_testicle`. Retain a concise placeholder description that clarifies at least one testicle is uncovered while both participants are seated close together.【F:data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json†L9-L15】
4. `required_components`: Match the lick sitting-close action—both `actor` and `primary` must list `positioning:sitting_on` and `positioning:closeness` with no kneeling requirement.【F:data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json†L16-L19】
5. `template`: Exactly `suckle on {primary}'s testicle`.
6. `prerequisites`: Empty array.
7. `visual`: Copy the purple palette from the kneeling action (background `#2a1a5e`, text `#ede7f6`, hover background `#372483`, hover text `#ffffff`).【F:data/mods/sex-penile-oral/actions/suckle_testicle.action.json†L18-L23】
8. Register the new action path in `data/mods/sex-penile-oral/mod-manifest.json` under the `actions` section.

## Rule and Condition Requirements

1. Add `data/mods/sex-penile-oral/conditions/event-is-action-suckle-testicle-sitting-close.condition.json` that whitelists only `sex-penile-oral:suckle_testicle_sitting_close`, and register it in the mod manifest.
2. Implement `data/mods/sex-penile-oral/rules/handle_suckle_testicle_sitting_close.rule.json`:
   - Listen to `core:attempt_action` and reference the new condition.
   - Fetch the actor and primary names into `actorName` and `primaryName`, plus query the actor’s `core:position` component into `actorPosition`, following the pattern from the kneeling rule.【F:data/mods/sex-penile-oral/rules/handle_suckle_testicle.rule.json†L7-L27】
   - Set both the perceptible event message and the success log message to `{actor}, face buried in {primary}'s lap, suckles on one of {primary}'s testicles.`
   - Use `perceptionType` `action_target_general`, copy `{context.actorPosition.locationId}` into `locationId`, assign `actorId` `{event.payload.actorId}`, `targetId` `{event.payload.primaryId}`, and finish by invoking `{ "macro": "core:logSuccessAndEndTurn" }`.

## Testing Requirements

Provide comprehensive integration coverage alongside the existing penile-oral suites:

1. **Action discoverability** – Author `tests/integration/mods/sex-penile-oral/suckle_testicle_sitting_close_action_discovery.test.js` to confirm the new action appears only when both actors meet the seated-closeness components and the primary’s testicle is uncovered, while asserting absence for each missing prerequisite.【F:docs/testing/mod-testing-guide.md†L7-L167】
2. **Rule behavior** – Add `tests/integration/mods/sex-penile-oral/suckle_testicle_sitting_close_action.test.js` that drives the rule via `ModTestFixture` helpers, verifies the perceptible event and success messages match the specified narration exactly, and covers negative paths mirroring the kneeling variant.【F:docs/testing/mod-testing-guide.md†L82-L198】
3. Run `npm run test:integration` to demonstrate the suites pass and document the successful command when submitting the implementation.
