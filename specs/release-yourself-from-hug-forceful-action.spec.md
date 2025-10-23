# Hugging Mod — Forceful Self-Release Action & Rule

## Goal
Design a follow-up to `hugging:release_self_from_hug` that lets an actor being hugged wrench themselves free with a more forceful tone. The new interaction must reuse the hugging mod's `hugging:hugging_actor` scope so the action always targets the hugging entity, mirror the existing self-release component requirements, and narrate the aggressive escape as "{actor} frees themselves forcefully from {target}'s hug."【F:data/mods/hugging/actions/release_self_from_hug.action.json†L1-L22】

## Current observations
- The gentle self-release action already enforces `positioning:closeness` and `positioning:being_hugged` on the actor, requires `positioning:hugging` on the target, forbids the actor from simultaneously hugging, and uses the inverted hugging scope to locate the hugger. The new forceful variant should keep this contract so component synchronization stays consistent across hugging rules.【F:data/mods/hugging/actions/release_self_from_hug.action.json†L6-L20】
- `hugging:hugging_actor` ensures discoverability only while another entity is hugging the actor, aligning with the requirement that the new forceful action appear in the same contexts as the gentle version. Reusing the scope avoids duplicating selection logic and keeps validation aligned with existing hugging assets.【F:data/mods/hugging/actions/release_self_from_hug.action.json†L7-L11】
- The hugging rule `handle_release_hug` demonstrates how to perform mutual component cleanup, emit success logs, and broadcast perceptible events once the embrace ends; the new rule should follow those sequencing patterns while swapping in the updated forceful copy. Use this rule as the behavioral template when implementing the new asset.【F:data/mods/hugging/rules/handle_release_hug.rule.json†L7-L285】
- Mod integration tests under `tests/integration/mods/` and the mod testing guide outline best practices for action discoverability setups, rule execution verification, and component teardown assertions. These resources should be mirrored to validate the new forceful variant comprehensively.【F:tests/integration/mods/hugging/hug_tight_action.test.js†L1-L313】【F:docs/testing/mod-testing-guide.md†L1-L188】

## Implementation outline
1. **Define the forceful self-release action**
   - Create `data/mods/hugging/actions/release_self_from_hug_forceful.action.json` (final name TBC) using ID `hugging:release_self_from_hug_forceful` or similar, targeting `hugging:hugging_actor`.
   - Copy the `required_components` and `forbidden_components` objects from the gentle action so the actor and target preconditions remain identical.
   - Set the `template` to `free yourself forcefully from {target}'s hug` and retain the hugging mod's visual palette for UI cohesion.

2. **Implement the accompanying rule**
   - Author `data/mods/hugging/rules/handle_release_self_from_hug_forceful.rule.json` responding to `core:attempt_action` with a new condition keyed to the forceful action.
   - Follow the cleanup flow from `handle_release_hug`: fetch both entities' hugging components, validate mutual linkage, remove `positioning:being_hugged` from the actor and `positioning:hugging` from the target, and end the turn via `core:logSuccessAndEndTurn`.
   - Emit the exact success and perceptible narration strings `{actor} frees themselves forcefully from {target}'s hug.` in the rule's log and event payloads.

3. **Wire manifest and conditions**
   - Register the new action, rule, and condition in `data/mods/hugging/mod-manifest.json`.
   - Add a dedicated `hugging:event-is-action-release-self-from-hug-forceful` condition mirroring the existing release-self condition but bound to the new action ID.

## Testing strategy
- **Action discoverability suite:** Add an integration test under `tests/integration/mods/hugging/` that proves the forceful action appears only when the actor is being hugged by the target, uses the correct template, and disappears once the embrace is broken or when the actor starts hugging someone else. Base the fixture setup and assertions on existing hugging mod discovery tests referenced above.
- **Rule behavior suite:** Create a companion integration test that triggers the new rule via `ModTestFixture.forAction`, asserts that the success and perceptible messages match `{actor} frees themselves forcefully from {target}'s hug.`, and verifies component cleanup plus any negative paths (e.g., mismatched embrace data prevents execution).
- Ensure both suites run inside `npm run test:integration`, following the latest guidance in `docs/testing/`, and treat them as required deliverables before shipping the new assets.

## Deliverables
- Forceful self-release action asset targeting `hugging:hugging_actor` with the same component requirements/forbiddances as the gentle action but a forceful copy template.
- Paired rule asset that removes hugging components and narrates the forceful escape with the mandated messaging.
- Updated manifest and condition entries registering the new content.
- Comprehensive integration test coverage for action discoverability and rule execution, aligned with repository testing standards.
