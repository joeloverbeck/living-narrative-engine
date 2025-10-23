# Hugging Mod — Release Hug Action and Rule

## Goal
Introduce a complementary release workflow so actors who initiated a tight hug can deliberately free their partners, clearing the reciprocal `positioning:hugging`/`positioning:being_hugged` state links. 【F:data/mods/positioning/components/hugging.component.json†L1-L26】【F:data/mods/positioning/components/being_hugged.component.json†L1-L22】

## Background & constraints
- `hugging:hug_tight` already sets up persistent embrace state, shares the dark rose palette that defines the mod’s visual identity, and forbids discovery while either participant is already flagged as hugging or being hugged. 【F:data/mods/hugging/actions/hug_tight.action.json†L1-L21】
- The handling rule performs extensive cleanup of stale hugging links before applying the new pair and emits a tender success/perceptible message; the release flow must follow the same defensive cleanup patterns while swapping the narration for the provided release copy. 【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L1-L195】
- `hand-holding:let_go_of_hand` demonstrates how release actions reuse the originating palette, require the initiating state on the actor, and target entities currently linked to that actor—mirroring this structure will keep UX and validation consistent. 【F:data/mods/hand-holding/actions/let_go_of_hand.action.json†L1-L18】
- Existing integration suites for `hugging:hug_tight` cover state transitions, component cleanup, and messaging, giving concrete expectations for the new rule’s assertions and fixture setup. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L1-L313】
- Craft the new target scope with ScopeDSL filters that locate actors whose `positioning:being_hugged.hugging_entity_id` equals the acting entity, using the documented `entities(...)` source and filter syntax. 【F:docs/scopeDsl/quick-reference.md†L1-L162】
- Follow the mod testing guide when authoring new suites so fixtures, discovery beds, and matchers stay aligned with current best practices. 【F:docs/testing/mod-testing-guide.md†L1-L188】

## Implementation outline

### 1. Define a dedicated release target scope
- Add a scope under `data/mods/hugging/scopes/` (e.g., `hugged_by_actor.scope.json`) that selects actors with `positioning:being_hugged` whose `hugging_entity_id` matches `{actor.id}`. Include a same-location guard or rely on the closeness component if needed, but the core filter must enforce the actor/target linkage described above. 【F:data/mods/positioning/components/being_hugged.component.json†L8-L18】【F:docs/scopeDsl/quick-reference.md†L9-L111】
- Reference the new scope via a resolver ID such as `hugging:hugged_by_actor` so actions can list it in their `targets` array.

### 2. Author the release action definition
- Create `data/mods/hugging/actions/release_hug.action.json` that mirrors the schema metadata used by `hug_tight`. Set `targets` to the new scope, require the actor to have both `positioning:closeness` and `positioning:hugging`, and forbid `positioning:being_hugged` on the actor to match the user requirement. 【F:data/mods/hugging/actions/hug_tight.action.json†L1-L21】
- Add a `primary` requirement for `positioning:being_hugged` so validation fails if the scope ever returns an entity missing the component, keeping rule assumptions explicit. 【F:data/mods/positioning/components/being_hugged.component.json†L1-L22】
- Use the template `release {primary} from the hug` and reuse the exact visual palette from `hug_tight` (`#7d2a50` background, `#fbeaf2` text, `#a13a6a` hover background, `#fff3f9` hover text) to maintain cohesive styling. 【F:data/mods/hugging/actions/hug_tight.action.json†L14-L20】

### 3. Wire condition and manifest entries
- Add a condition JSON (e.g., `event-is-action-release-hug.condition.json`) that checks `event.payload.actionId === 'hugging:release_hug'`, following the pattern of the existing hug-tight condition.
- Register the new scope, action, condition, and upcoming rule inside `data/mods/hugging/mod-manifest.json` so loaders discover them alongside the existing assets.

### 4. Implement the release rule
- Introduce `data/mods/hugging/rules/handle_release_hug.rule.json` keyed off `core:attempt_action` and gated by the new condition. Structure the action list like `handle_hug_tight`: gather actor/target names, current position, and any pre-existing hugging/being_hugged components for both participants to enable safe cleanup. 【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L7-L115】
- Before removing components, verify that the actor’s `positioning:hugging.embraced_entity_id` matches the target and that the target’s `positioning:being_hugged.hugging_entity_id` matches the actor to avoid severing unrelated embraces. 【F:data/mods/positioning/components/hugging.component.json†L8-L18】【F:data/mods/positioning/components/being_hugged.component.json†L8-L18】
- Remove both hugging/being_hugged components from actor and target, skipping no-ops gracefully, and do **not** add replacement components. The rule should also clear stray links on third parties in the same fashion as `handle_hug_tight` to prevent dangling references. 【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L56-L143】
- Set the perceptible event and successful action payloads to `{actor} releases {primary} from the hug.` and reuse the same perception type, location capture, and macro (`core:logSuccessAndEndTurn`) so turn resolution stays consistent. 【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L166-L195】

### 5. Testing strategy
- **Action discoverability:** Create an integration suite (e.g., `release_hug_action_discovery.test.js`) under `tests/integration/mods/hugging/` that provisions actors with mutual closeness and hugging state, confirms the new action appears only for targets whose `hugging_entity_id` matches the actor, and disappears once the release rule fires or the actor loses `positioning:hugging`. Reuse the action discovery bed utilities documented in the testing guide. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L33-L128】【F:docs/testing/mod-testing-guide.md†L1-L162】
- **Rule behavior:** Add `release_hug_action.test.js` using `ModTestFixture.forAction` to execute the rule. Assert that it removes both hugging components, emits the exact `{actor} releases {primary} from the hug.` message through both success and perceptible events, and leaves third parties untouched. Ensure subsequent discovery once again surfaces `hugging:hug_tight`, validating state cleanup. 【F:tests/integration/mods/hugging/hug_tight_action.test.js†L130-L263】【F:docs/testing/mod-testing-guide.md†L49-L188】
- **Regression safeguards:** Include negative tests confirming the rule does nothing when the actor’s `embraced_entity_id` points elsewhere (should fail discovery) and that actors flagged as `positioning:being_hugged` themselves cannot access the release action, honoring the forbidden component contract. 【F:data/mods/hugging/actions/hug_tight.action.json†L10-L13】【F:tests/integration/mods/hugging/hug_tight_action.test.js†L214-L263】

## Deliverables
- New scope, action, condition, and rule JSON files registered in the hugging mod manifest to support releasing an initiated hug.
- Updated localization/strings if required by mod guidelines so the new message matches the mandated template.
- Comprehensive integration tests covering action discovery and rule execution, all adhering to the mod testing guide and passing locally.
