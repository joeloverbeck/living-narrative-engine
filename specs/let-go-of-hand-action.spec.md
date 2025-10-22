# Hand Holding Mod — Let Go of Hand action

## Goal
Introduce an explicit follow-up action that allows an actor to release their partner's hand, clearing the `hand-holding:holding_hand`/`hand-holding:hand_held` state and emitting matching narrative feedback. 【F:data/mods/hand-holding/components/holding_hand.component.json†L1-L18】【F:data/mods/hand-holding/components/hand_held.component.json†L1-L21】

## Background & constraints
- `hand-holding:hold_hand` already establishes a persistent relationship by attaching reciprocal components and uses the dark purple visual palette that should remain consistent across related actions. 【F:data/mods/hand-holding/actions/hold_hand.action.json†L1-L21】
- The handling rule eagerly cleans up previous pairings and adds fresh component links between actor and target, so a release flow must remove both components for the active pair while leaving unrelated actors untouched. 【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L1-L146】
- Integration suites under `tests/integration/mods/hand-holding/` already cover discovery and rule execution patterns for the existing actions, providing scaffolding for new coverage. 【F:tests/integration/mods/hand-holding/hold_hand_action_discovery.test.js†L1-L178】【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L1-L203】
- Follow the Test Module Pattern guidance when expanding or creating suites to keep fixtures aligned with the latest testing methodologies. 【F:docs/testing/mod-testing-guide.md†L1-L184】

## Implementation outline

### 1. Author the release action definition
- Add `data/mods/hand-holding/actions/let_go_of_hand.action.json` with schema metadata mirroring `hold_hand.action.json` (same `$schema`, mod namespace, and prose voice). Set `targets` to `positioning:close_actors_facing_each_other_or_behind_target` to match discovery constraints. 【F:data/mods/hand-holding/actions/hold_hand.action.json†L1-L21】
- Require the actor to possess `hand-holding:holding_hand` and forbid the target from lacking `hand-holding:hand_held` so the action only appears when a partnership exists. Consider also forbidding the actor from lacking the component to avoid duplicate discovery entries.
- Reuse the existing visual palette (`backgroundColor` `#2c0e37`, `textColor` `#ffebf0`, `hoverBackgroundColor` `#451952`, `hoverTextColor` `#f3e5f5`) for visual consistency. 【F:data/mods/hand-holding/actions/hold_hand.action.json†L12-L20】
- Use the template string `"let go of {target}'s hand"` and author name/description copy that frames the action as intentionally releasing the hold.

### 2. Implement the corresponding rule
- Create `data/mods/hand-holding/rules/handle_let_go_of_hand.rule.json` triggered by `core:attempt_action` and gated by a new condition that matches the release action (reuse the pattern from `handle_hold_hand`). 【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L1-L20】
- Within the rule, fetch the actor and target names (for message composition) and remove both `hand-holding:holding_hand` and `hand-holding:hand_held` components from the appropriate entities using `REMOVE_COMPONENT`. Ensure the actor’s `holding_hand.held_entity_id` matches the current target before removal to prevent accidentally clearing unrelated links.
- Set the perceptible event message and the success log to `{actor} lets go of {target}'s hand.` before invoking the standard logging/turn-ending macro. Use the same perception type and location scoping logic as the hold rule to maintain downstream behavior. 【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L107-L144】

### 3. Wire conditions and manifest entries
- Add a condition (e.g., `data/mods/hand-holding/conditions/event-is-action-let-go-of-hand.condition.json`) mirroring the hold-hand condition but pointing to the new action ID. 【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L5-L10】
- Register the new action, rule, and condition inside `data/mods/hand-holding/mod-manifest.json` alongside the existing hand-holding entries so loaders discover them at runtime. 【F:data/mods/hand-holding/mod-manifest.json†L1-L120】

### 4. Ensure state exclusivity and cleanup
- Confirm the release rule removes both components from actor and target and does not add new ones. If other actors were holding the target prior to this interaction, the preceding hold rule already would have disconnected them; the release rule should only clean up the current pair by referencing the stored entity IDs. 【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L24-L106】
- After removal, the hold-hand action should become discoverable again for the pair; update or add prerequisites in existing actions (e.g., `warm_hands_between_yours`) if they assume active hand-holding so they remain undiscoverable immediately after release until a new hold occurs. 【F:tests/integration/mods/hand-holding/warm_hands_between_yours_action_discovery.test.js†L1-L207】

## Testing strategy
- **Action discoverability suite:** Add or extend an integration test (e.g., `let_go_of_hand_action_discovery.test.js`) verifying the new action appears only when the actor has `hand-holding:holding_hand` pointing at the target and disappears once components are cleared. Mirror fixture setup patterns from the existing discovery tests. 【F:tests/integration/mods/hand-holding/hold_hand_action_discovery.test.js†L55-L164】
- **Rule behavior suite:** Create `let_go_of_hand_action.test.js` (or extend an existing rule suite) to assert that executing the release action removes both components, emits `{actor} lets go of {target}'s hand.` through perceptible events, and restores availability of `hand-holding:hold_hand`. Leverage the module-builder utilities described in the mod testing guide for consistent setup. 【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L71-L203】【F:docs/testing/mod-testing-guide.md†L1-L184】
- **Regression coverage:** Add assertions ensuring no other entities lose their components and that repeating the release action without an active hold fails discovery, preventing redundant state changes. Use the existing squeeze-hand suites as references for asserting component presence/absence after rule execution. 【F:tests/integration/mods/hand-holding/squeeze_hand_reassuringly_action.test.js†L1-L188】

## Deliverables
- New action, condition, and rule JSON files for the release workflow, registered in the hand-holding manifest.
- Updated localization/strings if required by the mod guidelines (ensure message consistency with the specified template).
- Comprehensive integration test suites covering both discovery and rule execution, written with the Test Module Pattern, and all tests passing.
