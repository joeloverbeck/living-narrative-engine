# Hand Holding Mod — Withdraw Hand From Grasp action

## Goal
Design a defensive follow-up to the hand-holding loop that lets the person whose hand is being held break contact. The new action must only appear for the entity currently marked as `hand-holding:hand_held`, and when executed it should clear both sides of the link while broadcasting `{actor} withdraws their hand from {target}'s grasp.` as the observable narration.

## Background & constraints
- The hand-holding state is modelled with paired components: `hand-holding:hand_held` stores the holder's entity id on the passive participant, while `hand-holding:holding_hand` stores the held entity id on the active participant. 【F:data/mods/hand-holding/components/hand_held.component.json†L1-L21】【F:data/mods/hand-holding/components/holding_hand.component.json†L1-L21】
- Discovery for existing hand interactions relies on the positioning scope `positioning:close_actors_facing_each_other_or_behind_target`, which currently ignores whether the target is actually holding the actor's hand. This is why `hand-holding:let_go_of_hand` can appear for any close actor who happens to be holding someone else's hand. 【F:data/mods/hand-holding/actions/let_go_of_hand.action.json†L1-L18】【F:data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L15】
- The initiating action `hand-holding:hold_hand` already sets the visual palette and ensures a single closeness pairing, providing tone and UI patterns to reuse. 【F:data/mods/hand-holding/actions/hold_hand.action.json†L1-L21】
- Integration suites under `tests/integration/mods/hand-holding/` use the Mod Test Fixture pattern to validate action discovery and rule execution, giving us scaffolding and expectations to extend for the new withdrawal flow. 【F:tests/integration/mods/hand-holding/hold_hand_action_discovery.test.js†L1-L10】【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L9】

## Implementation outline

### 1. Scope: limit candidates to the actual hand-holding partner
- Add a dedicated scope to `data/mods/hand-holding/scopes/` (e.g., `actor_whose_hand_target_is_holding.scope`) that wraps `positioning:close_actors_facing_each_other_or_behind_target` and filters the pairs so the target's `hand-holding:holding_hand.held_entity_id` equals the acting entity id and the actor's `hand-holding:hand_held.holding_entity_id` equals the target id.
- Ensure the scope requires both hand-holding components to exist to avoid leaking the action to unrelated close actors, thereby closing the loophole highlighted in the current `let_go_of_hand` behaviour.

### 2. Action definition: withdrawing the held hand
- Create `data/mods/hand-holding/actions/withdraw_hand_from_grasp.action.json` with the standard action schema metadata and the new scope from step 1 as its `targets` value.
- Set required components to `actor: ["positioning:closeness", "hand-holding:hand_held"]` and `primary: ["hand-holding:holding_hand"]` so the action is only discoverable for the held partner and the correct holder.
- Use the template `"withdraw your hand from {target}'s grasp"` and a short description that frames the action as the held person pulling away. Reuse the purple UI palette established by `hold_hand` for consistency.

### 3. Rule & condition wiring
- Add a condition (e.g., `event-is-action-withdraw-hand-from-grasp.condition.json`) that mirrors the existing hold/let-go conditions but points to the new action id.
- Implement `data/mods/hand-holding/rules/handle_withdraw_hand_from_grasp.rule.json` triggered on the attempt action event for the new action. The rule should:
  - Validate that the target's `holding_hand.held_entity_id` references the actor and the actor's `hand_held.holding_entity_id` references the target before proceeding; abort if the linkage was broken asynchronously.
  - Remove `hand-holding:hand_held` from the actor and `hand-holding:holding_hand` from the target, preserving any additional metadata needed for downstream actions.
  - Emit both the perceptible event message and the successful action log as `{actor} withdraws their hand from {target}'s grasp.`
  - Maintain any macros or bookkeeping the hold-hand rule relies on so the state clears cleanly and follow-up actions become available again.
- Register the new scope, action, condition, and rule in `data/mods/hand-holding/mod-manifest.json` alongside the existing hand-holding entries.

### 4. Testing strategy
- **Action discoverability:** Introduce a dedicated integration suite (e.g., `withdraw_hand_from_grasp_action_discovery.test.js`) that confirms the action appears only when the actor is the held partner, disappears when either component is missing, and does not surface for unrelated close actors. Use the Mod Test Fixture builders demonstrated in the existing discovery tests for setup. 【F:tests/integration/mods/hand-holding/hold_hand_action_discovery.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L9】
- **Rule behaviour:** Add `withdraw_hand_from_grasp_action.test.js` to assert the rule removes both components, emits the specified narration, and restores availability of `hand-holding:hold_hand` while leaving other actors unaffected. Mirror the structure of the current rule suite for `hold_hand` to keep expectations consistent. 【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L1-L10】【F:docs/testing/mod-testing-guide.md†L1-L9】
- Ensure the new suites follow the latest methodologies in `docs/testing/` and include regression cases for the bug fixed by the scope filter. All targeted tests must pass locally before opening a PR.

## Deliverables
- New scope, action, condition, and rule files for the withdrawal flow, with manifest updates.
- Perceptible and success messages aligned to `{actor} withdraws their hand from {target}'s grasp.`
- Comprehensive integration coverage for discoverability and rule execution, exercising the new scope guard and message emission pathways.
