# Breathe Teasingly on Penis (Sitting Close) Specification

## Overview

Introduce a seated variation of the teasing breath interaction so partners who are already sharing close seating can engage without moving into a kneeling pose. The new action should mirror the existing `sex-penile-oral:breathe_teasingly_on_penis` flow while adopting the seating requirements defined by `positioning:sit_on_lap_from_sitting_facing`.

## Reference Patterns and Constraints

- **Current teasing action** – Use `sex-penile-oral:breathe_teasingly_on_penis` as the baseline for schema layout, visual palette, and narrative structure.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json†L1-L24】【F:data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis.rule.json†L1-L63】
- **Seated proximity scope** – `positioning:actors_both_sitting_close` shows how the positioning mod guarantees both entities are seated and in closeness; reuse its approach when building the new sex scope.【F:data/mods/positioning/scopes/actors_both_sitting_close.scope†L1-L6】
- **Uncovered penis checks** – Follow the uncovered anatomy gating implemented by `sex-core:actor_kneeling_before_target_with_penis` to ensure the primary target both has a penis and that it is exposed.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L1-L14】
- **Required components precedent** – Match the dual `positioning:sitting_on` and `positioning:closeness` component requirements used by `positioning:sit_on_lap_from_sitting_facing` for both actor and primary entries.【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing.action.json†L13-L25】

## Scope Requirements

Create `data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope` (final name may vary but must stay within the sex namespace) to supply the action's `targets.primary.scope` value.

1. Start from `actor.components.positioning:closeness.partners` just like both reference scopes.
2. Require that **both** the actor and the partner own `positioning:sitting_on` components, mirroring `positioning:actors_both_sitting_close`.
3. Add `hasPartOfType` and `not isSocketCovered` predicates for a penis on the partner, copying the structure used in `sex-core:actor_kneeling_before_target_with_penis`.
4. Include concise comments documenting that the scope is for seated, close partners where the partner's penis is exposed.
5. Register the new scope file in `data/mods/sex-penile-oral/mod-manifest.json`.

## Action Requirements

Author `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json` (final ID should be `sex-penile-oral:breathe_teasingly_on_penis_sitting_close`).

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `name`: "Breathe Teasingly on Penis (Sitting Close)".
- `description`: Emphasize breathing teasingly on the seated partner's penis while leaning in from close seating.
- `targets.primary`: Reference the new seated scope, use placeholder `primary`, and describe the seated, penis-bearing partner requirement.
- `required_components`: Copy the structure from `positioning:sit_on_lap_from_sitting_facing`, demanding `positioning:sitting_on` and `positioning:closeness` on both actor and primary.【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing.action.json†L13-L16】
- `template`: **Exactly** `breathe teasingly on {primary}'s penis` (note the `{primary}` placeholder).
- `prerequisites`: Keep an empty array consistent with the kneeling variant unless additional blockers emerge.
- `visual`: Reuse the purple palette from the kneeling version for continuity.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json†L17-L23】
- Add the action file path to `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule Requirements

Implement `data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_sitting_close.rule.json` alongside a matching condition file `data/mods/sex-penile-oral/conditions/event-is-action-breathe-teasingly-on-penis-sitting-close.condition.json`.

1. Base the rule on the kneeling variant: `event_type` is `core:attempt_action`, and the single condition ensures the rule only triggers for the new action ID.【F:data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis.rule.json†L1-L63】
2. Retrieve `actorName` and `primaryName` via `GET_NAME` calls (`entity_ref` values `actor` and `primary` respectively).
3. Query the actor's `core:position` component into `actorPosition` for logging metadata.
4. Set `logMessage` to `{actor} breathes teasingly on {primary}'s penis from up close, leaning toward {primary}'s lap.` exactly as provided.
5. Set `perceptionType` to `action_target_general`, copy the location resolution, and populate `actorId` / `targetId` using `{event.payload.actorId}` and `{event.payload.primaryId}` to align with the `{primary}` placeholder conventions used elsewhere.【F:data/mods/sex-vaginal-penetration/rules/handle_ride_penis_greedily.rule.json†L1-L119】
6. Finish with the `core:logSuccessAndEndTurn` macro.
7. Add both the new rule and condition files to the `sex-penile-oral` mod manifest.

## Testing Requirements

Develop comprehensive integration coverage under `tests/integration/mods/sex/` using the practices from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L198】 Reference neighboring suites (e.g., `rub_pussy_against_penis_through_clothes_action_discovery.test.js` and `ride_penis_greedily_action.test.js`) to stay consistent with current harness usage.【F:tests/integration/mods/sex/rub_pussy_against_penis_through_clothes_action_discovery.test.js†L1-L200】【F:tests/integration/mods/sex/ride_penis_greedily_action.test.js†L1-L180】

1. **Action discoverability** – Introduce `breathe_teasingly_on_penis_sitting_close_action_discovery.test.js` that builds a sitting pair scenario, uncovers the primary's penis, and proves the action surfaces only when both actors are seated closely with an exposed penis. Cover negative cases (covered anatomy, lack of sitting components, missing closeness).
2. **Rule behavior** – Add `breathe_teasingly_on_penis_sitting_close_action.test.js` (or place inside `tests/integration/mods/sex/rules/` if preferred) using `ModTestFixture.forActionAutoLoad` to confirm the perceptible event and success messages match the new string, and that `locationId`, `actorId`, and `targetId` reference the seated actor and primary correctly.
3. Ensure both suites import the matcher modules recommended in the testing guide and clean up fixtures after each test.
4. Run `npm run test:integration` locally before submitting changes, per repository policy.

## Acceptance Criteria

- Scope guarantees both actors are seated close together and that the primary's penis is uncovered before exposing the action.
- Action, condition, and rule JSON validate against their schemas, reuse the required component patterns, and deliver the specified narrative template/message.
- Sex mod manifest registers the new assets so discovery and execution pipelines can load them.
- Integration suites cover discovery gating and rule execution behaviors using the modern testing fixtures, with all integration tests passing.
