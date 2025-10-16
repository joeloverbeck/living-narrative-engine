# Affection Mod — Hold Hand stateful interaction

## Goal
Make the `affection:hold_hand` interaction persistent so subsequent actions respect mutual consent. The current action and rule only emit flavor text without leaving any stateful trace, which lets the actor re-run the action immediately and blocks future context-aware gestures. 【F:data/mods/affection/actions/hold_hand.action.json†L1-L21】【F:data/mods/affection/rules/handle_hold_hand.rule.json†L1-L53】

## Background & constraints
- `affection:hold_hand` is available to any close actors and never disables itself after use, allowing the initiating actor to chain the action against multiple partners in the same scene. 【F:data/mods/affection/actions/hold_hand.action.json†L6-L14】【F:tests/integration/mods/affection/hold_hand_action.test.js†L94-L128】
- Downstream gestures such as `affection:squeeze_hand_reassuringly` currently have no awareness of who is holding whose hand, so they are always discoverable so long as closeness is present. 【F:data/mods/affection/actions/squeeze_hand_reassuringly.action.json†L1-L17】
- Existing stateful touch systems (for example the straddling waist and deep kiss flows) store their partner entity IDs inside components added by the action rule. 【F:data/mods/positioning/components/straddling_waist.component.json†L1-L18】【F:data/mods/kissing/rules/lean_in_for_deep_kiss.rule.json†L1-L55】
- Integration coverage already exists for rule execution and action discoverability in other affection actions, providing reusable patterns for the new tests. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L1-L195】【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L143】

## Implementation outline

### 1. Introduce affection-specific hand-holding components
- Create `data/mods/affection/components/holding_hand.component.json` describing the initiating actor’s state. It should follow the established component schema pattern: reference the partner entity ID (e.g., `held_entity_id`) and mark whether this actor initiated the contact. Use the straddling component as a structural template for schema fields and validation constraints. 【F:data/mods/positioning/components/straddling_waist.component.json†L1-L18】
- Create `data/mods/affection/components/hand_held.component.json` to represent the partner whose hand is being held. Mirror the schema (store `holding_entity_id` and optionally a boolean flag indicating if the partner consented via an action vs. passive acceptance).
- Register both components in `data/mods/affection/mod-manifest.json` under a new `components` section so the loader can discover them. 【F:data/mods/affection/mod-manifest.json†L27-L90】

### 2. Enforce exclusivity when discovering `affection:hold_hand`
- Update `hold_hand.action.json` to forbid the actor from already having `affection:holding_hand` and to forbid the target from already having `affection:hand_held`. This ensures an actor cannot start another hand hold without first releasing the existing one, and prevents the target from being grabbed by multiple partners simultaneously. 【F:data/mods/affection/actions/hold_hand.action.json†L6-L14】
- Keep the closeness requirement intact so proximity and orientation continue to gate availability.

### 3. Persist the relationship in the rule
- Extend `handle_hold_hand.rule.json` so that, after resolving names/position, it removes any stale `affection:holding_hand`/`affection:hand_held` components from the participants (defensive cleanup) and then adds fresh components pointing at each other. Use the `ADD_COMPONENT` / `REMOVE_COMPONENT` pattern established in the kissing rules for consistency. 【F:data/mods/affection/rules/handle_hold_hand.rule.json†L1-L53】【F:data/mods/kissing/rules/lean_in_for_deep_kiss.rule.json†L18-L41】
- Ensure the log message, perceptible event payload, and turn-ending behavior remain unchanged to keep existing narrative output stable. 【F:data/mods/affection/rules/handle_hold_hand.rule.json†L24-L52】

### 4. Provide reusable conditions for follow-up gestures
- Author `data/mods/affection/conditions/actors-are-holding-hands.condition.json` (name negotiable) that verifies either participant has the initiator component pointing at the other. This condition will enable future actions (withdraw, squeeze, etc.) to query the relationship without duplicating logic.
- Register the condition in the affection manifest alongside the existing event-based conditions. 【F:data/mods/affection/mod-manifest.json†L64-L80】

### 5. Rework dependent actions
- Update `squeeze_hand_reassuringly.action.json` so it requires actors to be close *and* pass the new “actors are holding hands” prerequisite. When wiring the condition, follow the approach used in other affection action discovery specs/tests: feed the action definition into the action index inside the fixture before asserting availability. 【F:data/mods/affection/actions/squeeze_hand_reassuringly.action.json†L1-L17】【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L16-L90】
- Any other actions that logically depend on an active hand-holding state (e.g., `warm_hands_between_yours`) should add the same prerequisite to preserve consistency; call out each touchpoint while updating manifests.

### 6. Testing strategy
- **Hold-hand action discovery:** Create a new suite (e.g., `hold_hand_action_discovery.test.js`) that mirrors the ruffle-hair discovery tests. It must confirm availability for close, unoccupied partners and unavailability when the actor already has `affection:holding_hand`, when the target already has `affection:hand_held`, and when closeness is missing. 【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L1-L143】
- **Hold-hand rule execution:** Extend `hold_hand_action.test.js` to assert that both components are added after execution and that no duplicates exist when replaying the action (because the action becomes undiscoverable). Replace the existing “multiple partners” expectation with a check that the second attempt is blocked. 【F:tests/integration/mods/affection/hold_hand_action.test.js†L27-L128】
- **Squeeze-hand discovery & rule tests:** Update the current discovery/execution coverage (or introduce new suites if missing) to require the hand-holding condition: verify the action is discoverable to either participant once components are present, and confirm it is hidden otherwise. Ensure the rule tests assert that the prerequisite components remain untouched so later “withdraw” flows can detect them. 【F:data/mods/affection/actions/squeeze_hand_reassuringly.action.json†L1-L17】【F:tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js†L16-L143】
- **Action index coverage:** Where fixtures rebuild the action index, include the updated `hold_hand` and `squeeze_hand_reassuringly` definitions so their new prerequisites/components are part of the discoverability assertions.
- **Future-proofing:** Add regression tests to ensure the forbidden components prevent multiple simultaneous holders and that removing the components (e.g., via a future “withdraw hand” action) restores discoverability.

### 7. Documentation & manifests
- Update the affection mod manifest to list the new components and condition, and verify any future withdraw action placeholder notes if documentation exists.
- If contributor docs enumerate available affection components, append brief descriptions of `holding_hand` and `hand_held` so content designers understand the new stateful affordances.

## Test requirements summary
- New and updated suites must cover both action discoverability and rule behavior for `hold_hand` and downstream gestures. Where appropriate, use `ModTestFixture.forAction` to seed fixtures with custom components and assert on component mutations via the entity manager.
- All tests should be added under `tests/integration/mods/affection/`, following existing naming conventions (`*_action_discovery.test.js`, `*_action.test.js`).
- Ensure the new discoverability cases explicitly check that `hold_hand` is absent once the actor already carries `affection:holding_hand`, and that `squeeze_hand_reassuringly` appears for either participant when hand-holding components point at each other.
