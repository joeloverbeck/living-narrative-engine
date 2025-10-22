# Lick Glans (Sitting Close) Specification

## Overview

Deliver a seated variation of the glans licking interaction so partners who are already sharing close seating can transition seamlessly into oral play without moving into a kneeling pose. The action should mirror the existing kneeling-focused `sex-penile-oral:lick_glans` flow while reusing the seated proximity and component conventions introduced for `sex-penile-oral:breathe_teasingly_on_penis_sitting_close`.

## Reference Materials and Constraints

- **Baseline glans lick** – Follow the schema layout, visual palette, and narrative tone of the existing `sex-penile-oral:lick_glans` definition.【F:data/mods/sex-penile-oral/actions/lick_glans.action.json†L1-L24】
- **Seated proximity precedent** – Reuse the seated scope and dual component requirements established by `sex-penile-oral:breathe_teasingly_on_penis_sitting_close` to guarantee both actors share close seating with an exposed penis.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json†L1-L24】
- **Testing methodology** – Build suites using the modern fixtures, discovery beds, and matcher guidance captured in the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L198】
- **Nearby integration patterns** – Use `lick_testicles_sensually_action.test.js` as a reference for structuring rule-behavior coverage in the sex penile oral mod family.【F:tests/integration/mods/sex/lick_testicles_sensually_action.test.js†L1-L160】

## Action Requirements

Author `data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:lick_glans_sitting_close`; `name`: “Lick Glans (Sitting Close)”; `description`: Emphasize leaning in from shared seating to lick the partner’s glans.
3. `targets.primary.scope`: `sex-core:actors_sitting_close_with_uncovered_penis`; `placeholder`: `primary`; description clarifies the seated partner with an exposed penis requirement.
4. `required_components`: Match the seated breathing variant—both `actor` and `primary` require `positioning:sitting_on` and `positioning:closeness` components.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json†L13-L16】
5. `template`: Exactly `lick {primary}'s glans`.
6. `prerequisites`: Empty array (align with both reference actions).
7. `visual`: Copy the purple palette values from the existing lick/breathe entries to keep category consistency.【F:data/mods/sex-penile-oral/actions/lick_glans.action.json†L18-L23】
8. Register the new action file path inside `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule and Condition Requirements

Implement a companion rule `data/mods/sex-penile-oral/rules/handle_lick_glans_sitting_close.rule.json` and condition `data/mods/sex-penile-oral/conditions/event-is-action-lick-glans-sitting-close.condition.json`.

1. `event_type`: `core:attempt_action`; `condition` references the new condition file, mirroring the seated breathing handler.
2. Retrieve `actorName` and `primaryName` via `GET_NAME` operations (`entity_ref` `actor` / `primary`).
3. Query the actor’s `core:position` component into `actorPosition` for logging metadata as done in the seated breathing rule.
4. Set `logMessage` and `perceptible` payload:
   - `perceptionType`: `action_target_general`.
   - `logMessage`: `{actor}, leaning toward {primary}'s lap, licks {primary}'s glans sensually, swirling the tongue.`
5. Set `locationId` to `{context.actorPosition.locationId}`, `actorId` to `{event.payload.actorId}`, and `targetId` to `{event.payload.primaryId}` before invoking `{ "macro": "core:logSuccessAndEndTurn" }`.
6. Ensure the condition file whitelists `sex-penile-oral:lick_glans_sitting_close` and nothing else.
7. Add both files to the mod manifest under their respective sections.

## Testing Requirements

Create comprehensive integration coverage under `tests/integration/mods/sex-penile-oral/`:

1. **Action discoverability** – Author `lick_glans_sitting_close_action_discovery.test.js` that provisions a sitting pair via fixture helpers, confirms discovery when the penis is uncovered, and asserts absence when seating, closeness, or exposure prerequisites fail.
2. **Rule behavior** – Add `lick_glans_sitting_close_action.test.js` (or equivalent) using `ModTestFixture.forActionAutoLoad` to execute the new action, asserting the perceptible event and success message matches the specified string and that actor/target/location metadata are set correctly. Include a negative rule trigger case similar to the lick testicles suite.【F:tests/integration/mods/sex/lick_testicles_sensually_action.test.js†L67-L160】
3. Follow cleanup patterns, matcher imports, and diagnostics practices from the Mod Testing Guide, and run the integration suite locally prior to submission.【F:docs/testing/mod-testing-guide.md†L17-L198】

## Acceptance Criteria

- Action, condition, and rule JSON validate, reuse seated closeness components, and emit the specified narrative strings.
- Mod manifest registers the new assets so discovery and rule execution load automatically.
- Integration suites cover both discovery gating and rule execution outcomes, exercising success and negative scenarios.
- Test command `npm run test:integration` passes after adding the suites.
