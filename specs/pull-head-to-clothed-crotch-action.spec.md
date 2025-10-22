# Pull Head to Clothed Crotch Action Specification

## Overview

Introduce a seated dominance beat in the `sex-penile-oral` mod where the acting participant guides their partner's head down to their still-covered crotch. The interaction should slot alongside the other seated, close-proximity oral foreplay options while respecting clothing coverage and component conventions already established for the mod.

## Reference Materials and Constraints

- **Seated closeness action blueprint** – Mirror the target scope, shared component requirements, and purple visual palette from the existing seated lick action so the new interaction inherits the same discovery constraints and UI styling.【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L1-L24】
- **Penis coverage prerequisite pattern** – Reuse the prerequisite structure from actions that validate both penis ownership and coverage states to ensure the new interaction only appears when the actor's penis remains clothed.【F:data/mods/sex-dry-intimacy/actions/rub_penis_against_penis.action.json†L1-L36】
- **Testing methodology** – Follow the modern mod testing workflow, fixtures, and discovery tooling outlined in the Mod Testing Guide when authoring the new integration suites.【F:docs/testing/mod-testing-guide.md†L1-L188】
- **Discovery and rule coverage precedents** – Use the existing seated teasing discovery and rule suites as structural references for scenario preparation, diagnostics, and assertion helpers.【F:tests/integration/mods/sex/breathe_teasingly_on_penis_sitting_close_action_discovery.test.js†L1-L94】【F:tests/integration/mods/sex/breathe_teasingly_on_penis_sitting_close_action.test.js†L1-L73】

## Action Requirements

Author `data/mods/sex-penile-oral/actions/pull_head_to_clothed_crotch.action.json` with the following properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:pull_head_to_clothed_crotch`; `name`: “Pull Head to Clothed Crotch”; `description`: Emphasize guiding the partner's head down toward the actor's clothed crotch while seated together.
3. `targets.primary.scope`: `positioning:actors_sitting_close`; `placeholder`: `primary`; description highlights the seated partner within arm's reach.
4. `required_components`: Match the seated lick blueprint—both `actor` and `primary` require `positioning:sitting_on` and `positioning:closeness` entries.
5. `template`: Exactly `pull {primary}'s head to your clothed crotch`.
6. `prerequisites`: Two entries mirroring the penis validation pattern—first ensures the actor has a penis, second confirms that penis is currently covered (fail with concise, diegetic messages).
7. `visual`: Copy the background, text, and hover colors from the seated lick action to maintain palette consistency.
8. Register the new action inside `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule Requirements

Implement `data/mods/sex-penile-oral/rules/handle_pull_head_to_clothed_crotch.rule.json` (with a matching condition file if required by the resolver pattern) so that:

1. The rule listens for `core:attempt_action` events tied exclusively to `sex-penile-oral:pull_head_to_clothed_crotch`.
2. Names for `actor` and `primary` are resolved via `GET_NAME` macros and used in narrative construction.
3. The perceptible event payload and success log share the message `{actor}, holding the back of {primary}'s head, pulls them down to {actor}'s bulging, clothed crotch.`
4. Event metadata sets `locationId` from the actor's current position component, `actorId` from the event payload, `targetId` from the primary target, and `perceptionType` to `action_target_general` before invoking the standard `core:logSuccessAndEndTurn` macro.
5. Manifest entries reference the new rule (and condition) assets alongside the action.

## Testing Requirements

Create comprehensive integration coverage under `tests/integration/mods/sex/`:

1. **Action discoverability** – Add a `pull_head_to_clothed_crotch_action_discovery.test.js` suite that seeds a sitting-close pair with a clothed penis, confirms the action appears under valid conditions, and asserts it disappears when seating, closeness, or penis coverage requirements break.
2. **Rule behavior** – Add `pull_head_to_clothed_crotch_action.test.js` using `ModTestFixture.forActionAutoLoad` to execute the action, asserting the success log and perceptible event payload match the specified narrative while verifying actor/target/location metadata. Include a negative trigger scenario if the prerequisites fail.
3. Execute `npm run test:integration` (or the targeted subset) to ensure all new suites pass, following diagnostics and cleanup practices from the testing guide.

