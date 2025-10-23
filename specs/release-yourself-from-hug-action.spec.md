# Hugging Mod — Release Yourself from Hug Action & Rule

## Goal
Design an action/rule pair that lets an actor currently being hugged gently free themselves from the hugger while preserving the hugging mod's thematic and systemic patterns. The new interaction must use a target scope that mirrors `hugging:hugged_by_actor` but selects the hugging entity instead, requires the actor to be marked as `positioning:being_hugged`, and produces the narration "{actor} releases themselves gently from {target}'s hug." 【F:data/mods/hugging/actions/release_hug.action.json†L1-L22】【F:data/mods/hugging/scopes/hugged_by_actor.scope†L1-L15】

## Current observations
- The existing `hugging:release_hug` action assumes the actor initiated the embrace (`positioning:hugging`) and targets the entity they're hugging. Its template and success messaging reference the target being released rather than the actor freeing themselves. 【F:data/mods/hugging/actions/release_hug.action.json†L6-L20】【F:data/mods/hugging/rules/handle_release_hug.rule.json†L257-L285】
- `hugging:hugged_by_actor` filters close targets whose `positioning:being_hugged.hugging_entity_id` equals the actor, ensuring mutual component links before offering the action. We'll need a sibling scope that instead returns actors whose `positioning:hugging.embraced_entity_id` equals the acting entity and whose `positioning:hugging` component is marked as hugging them. 【F:data/mods/hugging/scopes/hugged_by_actor.scope†L2-L13】【F:data/mods/positioning/components/hugging.component.json†L8-L18】
- The positioning components establish the linkage we must respect: a hugged actor tracks the hugger via `hugging_entity_id`, while the hugger tracks the hugged entity via `embraced_entity_id`. Both are required, so validation can rely on them without defensive optionality. 【F:data/mods/positioning/components/being_hugged.component.json†L8-L20】【F:data/mods/positioning/components/hugging.component.json†L8-L23】
- Scope authoring should leverage the documented `entities(...)` sources, filter composition, and comparison helpers to mirror the structure of the existing hugging scope while inverting the component lookups. 【F:docs/scopeDsl/quick-reference.md†L6-L145】
- Mod integration tests for the hugging mod already exercise action discovery and rule execution for `hugging:hug_tight`, providing patterns for fixture setup, expectation style, and component cleanup assertions that the new suites should mirror. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L1-L313】【F:docs/testing/mod-testing-guide.md†L1-L188】

## Implementation outline

### 1. Author an inverted hugger scope
- Create `data/mods/hugging/scopes/hugging_actor.scope` (final name TBC) that uses `entities(core:actor)` or an existing proximity scope and filters for actors whose `positioning:hugging.embraced_entity_id` equals `{actor.id}` and whose `positioning:hugging` component is present. Include a guard that the acting entity currently has `positioning:being_hugged` to avoid exposing the action outside an active embrace. 【F:data/mods/hugging/scopes/hugged_by_actor.scope†L2-L15】【F:data/mods/positioning/components/being_hugged.component.json†L8-L20】
- Register the scope in `mod-manifest.json` so it is available to action definitions.

### 2. Define the new self-release action
- Add `data/mods/hugging/actions/release_self_from_hug.action.json` (exact ID TBC) targeting the new scope. Require `positioning:closeness` and `positioning:being_hugged` on the actor, require `positioning:hugging` on the target, and forbid `positioning:hugging` on the actor. This mirrors the requested component contract and inverts the existing release action's assumptions. 【F:data/mods/hugging/actions/release_hug.action.json†L6-L13】【F:data/mods/positioning/components/closeness.component.json†L1-L20】
- Use the template `release yourself gently from {target}'s hug` and retain the hugging mod's rose palette for visual parity. 【F:data/mods/hugging/actions/release_hug.action.json†L14-L20】

### 3. Wire manifest and condition assets
- Introduce a `hugging:event-is-action-release-self-from-hug` condition mirroring the existing release condition but keyed to the new action ID, and add both the action and condition entries to `data/mods/hugging/mod-manifest.json`.

### 4. Implement the gentle self-release rule
- Create `data/mods/hugging/rules/handle_release_self_from_hug.rule.json` responding to `core:attempt_action` with the new condition. Query hugging/being-hugged components for both entities, clean up mismatched third-party links just like `handle_release_hug`, and remove the mutual components tying the actor and target together once validation passes. 【F:data/mods/hugging/rules/handle_release_hug.rule.json†L7-L255】
- Emit the narration `{actor} releases themselves gently from {target}'s hug.` for both the success log and perceptible event, and continue to use `core:logSuccessAndEndTurn` for consistent turn resolution. 【F:data/mods/hugging/rules/handle_release_hug.rule.json†L257-L285】

### 5. Testing strategy
- **Action discoverability:** Add an integration suite (e.g., `release_self_from_hug_action_discovery.test.js`) that verifies the action appears only when the actor has `positioning:being_hugged` pointing at a target whose `positioning:hugging` references the actor, and disappears once the rule fires or the actor gains `positioning:hugging`. Follow the mod testing guide's discovery bed conventions. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L33-L128】【F:docs/testing/mod-testing-guide.md†L33-L162】
- **Rule execution:** Add a companion suite (e.g., `release_self_from_hug_rule.test.js`) that runs the rule via `ModTestFixture.forAction`, asserting component removal for both entities and the exact gentle-release messaging for success and perceptible events. Include negative coverage where the target's `embraced_entity_id` mismatches the actor to ensure no cleanup occurs. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L130-L263】【F:data/mods/positioning/components/hugging.component.json†L8-L18】
- Ensure both suites run under `npm run test:integration` and treat them as required deliverables; no new action ships without passing coverage per the mod testing guidelines. 【F:docs/testing/mod-testing-guide.md†L1-L188】

## Deliverables
- New hugging scope, action, condition, and rule assets registered in the mod manifest, all conforming to the hugging mod's palette and component contracts.
- Updated localization/templates to the gentle self-release copy for action discovery, success messaging, and perceptible events.
- Comprehensive integration tests covering discoverability and rule execution for the new self-release interaction, with all integration tests passing locally.
