# Nuzzle Penis Through Clothing (Sitting Close) Specification

## Overview

Deliver a seated-variation follow-up to `sex-penile-oral:nuzzle_penis_through_clothing` so partners who are already sharing close seating can indulge in clothed oral teasing without needing to shift into a kneeling position. The new content should preserve the clothed-penis focus while mirroring the proximity requirements, shared narrative voice, and visual identity present across the sitting-close oral teasing line.

## Reference Materials and Constraints

- **Legacy kneeling action** – Reuse the schema layout, clothing target handling, and purple visual palette from the existing kneeling implementation.【F:data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json†L1-L29】
- **Seated proximity precedents** – Match the bilateral component requirements that guarantee both participants are seated together at close range from the glans and testicle sitting-close variants.【F:data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json†L1-L25】【F:data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json†L1-L25】
- **Scope authoring context** – Model the new covered-penis sitting-close scope after the uncovered reference, adding socket coverage checks while retaining shared-seat validation.【F:data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope†L1-L12】【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_covered_penis.scope†L1-L17】
- **Mod manifest registration** – Extend the penile oral and sex core manifests so the new action, condition, rule, and scope are discoverable alongside their peers.【F:data/mods/sex-penile-oral/mod-manifest.json†L30-L59】【F:data/mods/sex-core/mod-manifest.json†L24-L31】
- **Testing methodology** – Follow the mod testing guide for fixture setup, discovery diagnostics, and matcher usage when drafting integration coverage.【F:docs/testing/mod-testing-guide.md†L1-L10】
- **Nearby integration suites** – Reference the current kneeling nuzzle discovery and rule tests for structure, naming, and assertion patterns to ensure consistency across variants.【F:tests/integration/actions/nuzzlePenisThroughClothingDiscovery.integration.test.js†L1-L10】【F:tests/integration/mods/sex/nuzzle_penis_through_clothing_action.test.js†L1-L10】

## Action Requirements

Author `data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing_sitting_close.action.json` with these properties:

1. `$schema`: `schema://living-narrative-engine/action.schema.json`.
2. `id`: `sex-penile-oral:nuzzle_penis_through_clothing_sitting_close`; `name`: “Nuzzle Penis Through Clothing (Sitting Close)”; `description`: Highlight the actor leaning almost horizontally across shared seating to nuzzle a clothed erection.
3. `targets.primary.scope`: Point to a new scope `sex-core:actors_sitting_close_with_covered_penis` that guarantees both entities share `positioning:sitting_on`, maintain closeness, feature a penis part, and confirm the socket is still covered. Keep `placeholder` = `primary` and clarify the clothed-penis requirement in the description.
4. `targets.secondary.scope`: Reuse `clothing:target_topmost_torso_lower_clothing_no_accessories`, retain the `contextFrom: "primary"`, and describe it as the garment barrier involved.【F:data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json†L12-L17】
5. `required_components`: Mirror the seated licking variants so both `actor` and `primary` list `positioning:sitting_on` and `positioning:closeness` while removing the kneeling requirement.【F:data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json†L13-L16】
6. `template`: Exactly ``nuzzle against {primary}'s penis through the {secondary}``, matching the legacy phrasing while applying to seated partners.【F:data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json†L22-L22】
7. `prerequisites`: Leave as an empty array for parity with peer actions.
8. `visual`: Copy the purple palette block verbatim to maintain category styling consistency.【F:data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json†L24-L28】
9. Register the new action inside the penile oral manifest’s `actions` list so it loads with the rest of the module.【F:data/mods/sex-penile-oral/mod-manifest.json†L30-L37】

## Scope Requirements

1. Create `data/mods/sex-core/scopes/actors_sitting_close_with_covered_penis.scope` that mirrors the uncovered sitting-close logic but flips the coverage predicate to `isSocketCovered` for the penis while preserving the shared-seat checks for actor and partner.【F:data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope†L1-L12】
2. Document the scope with comments matching house style, indicating it supports seated clothed-penis teasing.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_covered_penis.scope†L1-L4】
3. Append the new scope filename to the sex core manifest’s `scopes` array so downstream mods can reference it.【F:data/mods/sex-core/mod-manifest.json†L24-L31】

## Rule and Condition Requirements

1. Author `data/mods/sex-penile-oral/conditions/event-is-action-nuzzle-penis-through-clothing-sitting-close.condition.json` that whitelists only the new action id, mirroring the legacy condition pattern.【F:data/mods/sex-penile-oral/conditions/event-is-action-nuzzle-penis-through-clothing.condition.json†L1-L12】
2. Implement `data/mods/sex-penile-oral/rules/handle_nuzzle_penis_through_clothing_sitting_close.rule.json` based on the original rule’s macro flow, including `GET_NAME` calls for actor, primary, and clothing, plus a `QUERY_COMPONENT` for the actor’s position.【F:data/mods/sex-penile-oral/rules/handle_nuzzle_penis_through_clothing.rule.json†L1-L58】
3. Set both the perceptible event message and the success log message to `{actor}, leaning almost horizontally, nuzzles their face against the bulge of {primary}'s crotch through the {secondary}.`, ensuring the rule feeds the string into the `logMessage` variable before invoking `core:logSuccessAndEndTurn`.
4. Maintain `perceptionType` = `action_target_general`, `locationId` sourced from the queried position, and `targetId` mapped to the primary entity as in the reference rule.【F:data/mods/sex-penile-oral/rules/handle_nuzzle_penis_through_clothing.rule.json†L31-L58】
5. Add the new condition and rule filenames to the mod manifest lists so they participate in content loading.【F:data/mods/sex-penile-oral/mod-manifest.json†L39-L59】

## Testing Requirements

1. **Action discoverability** – Create an integration suite under `tests/integration/actions/` that covers positive and negative discovery for the seated-close variant, leveraging diagnostics helpers from the mod testing guide. Include scenarios where the penis is uncovered or seating is broken to confirm exclusion.【F:tests/integration/actions/nuzzlePenisThroughClothingDiscovery.integration.test.js†L1-L7】【F:docs/testing/mod-testing-guide.md†L1-L10】
2. **Rule behavior** – Add a parallel test under `tests/integration/mods/sex/` exercising the new action through `ModTestFixture` to assert the perceptible payload, success logging string, participant ids, and end-of-turn handling mirror the specification.【F:tests/integration/mods/sex/nuzzle_penis_through_clothing_action.test.js†L1-L10】
3. Ensure the new suites run alongside the existing penile oral tests when executing `npm run test:integration`, documenting coverage for both discovery and rule execution pathways.

## Acceptance Criteria

- Action, scope, condition, and rule JSON validate and register in their respective manifests, reusing the established visual styling and seated component requirements.
- The rule outputs the specified narrative string for both perceptible and success logs while targeting the clothed penis through the referenced garment.
- Integration tests comprehensively cover discovery gating and rule execution, demonstrating seated closeness, clothing requirements, and messaging fidelity through passing `npm run test:integration` runs.
- All changes align with repository style and documentation standards outlined in the mod testing guide.
