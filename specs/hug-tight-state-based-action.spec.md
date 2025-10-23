# Hug Tight State-Based Action Specification

## Overview

Convert the existing `hugging:hug_tight` interaction into a state-managed action that mirrors the hand-holding workflow. The update must introduce persistent hugging state components, ensure action availability rules respect those states, and adjust the rule logic to attach and clear stateful components for both participants. This brings hugging in line with the ergonomics already used by the hand-holding mod and prevents anatomically implausible overlaps with other actions.【F:data/mods/hugging/actions/hug_tight.action.json†L1-L21】【F:data/mods/hand-holding/actions/hold_hand.action.json†L1-L22】

## Current Implementation

- **Hug Tight action** – Requires `positioning:closeness` but declares no meaningful forbidden components, so actors can re-trigger the action or perform other incompatible actions while already in a tight embrace.【F:data/mods/hugging/actions/hug_tight.action.json†L6-L12】
- **Hug Tight rule** – Logs descriptive text and ends the turn without attaching or clearing any interaction components, leaving no persistent state that other systems can inspect.【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L7-L53】
- **Hand-holding reference** – The `hand-holding:hold_hand` action forbids initiating when either partner is already holding hands or being held, while its rule queries for stale components, cleans them up, and then assigns paired `holding_hand` / `hand_held` components referencing the counterpart actor.【F:data/mods/hand-holding/actions/hold_hand.action.json†L6-L13】【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L25-L195】
- **Component schemas** – Hand-holding components model bilateral state via required IDs and consent/initiator flags, establishing a template for the structure the hugging components should follow.【F:data/mods/hand-holding/components/holding_hand.component.json†L2-L19】【F:data/mods/hand-holding/components/hand_held.component.json†L2-L21】
- **Testing gap** – The hugging integration suite only verifies messaging and perceptible events; it lacks assertions about state persistence, forbidden-component validation, or repeated attempts.【F:tests/integration/mods/hugging/hug_tight_action.test.js†L27-L78】 The richer hand-holding suite demonstrates the depth of coverage we need to replicate.【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L28-L178】

## Proposed Changes

### 1. Introduce hugging state components in the positioning mod

- Add `hugging.component.json` and `being_hugged.component.json` under `data/mods/positioning/components/`, following the JSON schema pattern used by other positioning components and the hand-holding state pair.【F:data/mods/positioning/components/closeness.component.json†L1-L21】【F:data/mods/hand-holding/components/holding_hand.component.json†L2-L19】
- Suggested schemas:
  - `positioning:hugging` – Required fields `embraced_entity_id` (string ID of the target) and `initiated` (boolean flag). Optional `consented` boolean may mirror hand-holding defaults if narrative design wants to record target consent explicitly.
  - `positioning:being_hugged` – Required field `hugging_entity_id` referencing the actor, plus optional `consented` boolean defaulting to `true`.
- Document each component with `description` text clarifying that the state represents physically occupying a tight hug, meaning other anatomically incompatible actions should forbid these components.
- Register both component files inside `data/mods/positioning/mod-manifest.json`'s `content.components` array so they are available to all mods that depend on positioning.【F:data/mods/positioning/mod-manifest.json†L20-L31】

### 2. Update Hug Tight action gating

- Extend `forbidden_components.actor` to include both `positioning:hugging` and `positioning:being_hugged` to prevent actors from starting a new hug when already embracing or being hugged by someone else.【F:data/mods/hugging/actions/hug_tight.action.json†L10-L12】
- Add `positioning:being_hugged` to `forbidden_components.primary` so a target already being hugged cannot be selected as the primary target, aligning with the hand-holding precedent.【F:data/mods/hand-holding/actions/hold_hand.action.json†L10-L13】
- Leave `required_components.actor` unchanged so the action still depends on `positioning:closeness`.

### 3. Rewrite Hug Tight rule to manage state

- Import the new positioning components into the rule logic by:
  - Querying existing `positioning:hugging` / `positioning:being_hugged` components on both actor and target (and removing cross-linked counterparts) before applying new ones, mirroring the cleanup blocks in the hand-holding rule.【F:data/mods/hand-holding/rules/handle_hold_hand.rule.json†L25-L143】
  - Removing any lingering hugging components from the actor and target themselves to guard against stale partial state.
  - Adding new components: assign `positioning:hugging` to the actor with `embraced_entity_id: {event.payload.targetId}` and `initiated: true`; assign `positioning:being_hugged` to the target with `hugging_entity_id: {event.payload.actorId}` and a default `consented: true` (unless design chooses to defer consent elsewhere).
- Preserve the existing narrative logging, perception type, and location variable assignments so downstream storytelling remains unchanged.【F:data/mods/hugging/rules/handle_hug_tight.rule.json†L25-L52】

### 4. Mod manifest adjustments

- Because the new components live in the positioning mod, ensure `data/mods/positioning/mod-manifest.json` lists them (see step 1). No extra dependency changes are needed because positioning already depends on core.【F:data/mods/positioning/mod-manifest.json†L1-L31】
- Confirm `data/mods/hugging/mod-manifest.json` continues to declare `positioning` as a dependency so the hug rule can attach positioning components. Update the manifest’s `content.rules`/`content.actions` section only if file names change; no components are added directly to hugging because they reside in the positioning package.【F:data/mods/hugging/mod-manifest.json†L9-L29】

## Testing Strategy

Expand `tests/integration/mods/hugging/hug_tight_action.test.js` to deliver parity with the hand-holding suite and prove the new state logic works end-to-end.【F:tests/integration/mods/hugging/hug_tight_action.test.js†L27-L78】【F:tests/integration/mods/hand-holding/hold_hand_action.test.js†L28-L178】

1. **State assignment** – After a successful hug, assert that the actor instance stores `positioning:hugging` with the target’s ID and the target stores `positioning:being_hugged` with the actor’s ID.
2. **Repeated attempts** – Ensure a second hug attempt by the same actor toward the same target throws a forbidden-component error and does not spawn additional events.
3. **Stale cleanup** – Seed the actor or target with stale hugging/being_hugged components pointing at other entities, then verify the action removes the counterpart’s component before applying fresh state (mirroring the hand-holding cleanup tests).
4. **Target exclusivity** – Validate that an actor cannot initiate `hug_tight` against a target already flagged with `positioning:being_hugged` by someone else.
5. **Action routing** – Dispatch a different action ID to confirm the hug rule does not fire when it shouldn’t, maintaining coverage analogous to the hand-holding suite.
6. **Regression of existing expectations** – Keep assertions that success and perceptible events share the same descriptive text, the perception type is unchanged, and the actor’s turn ends normally.

All new or updated tests must pass under `npm run test:integration`, in keeping with the repository policy that no PR is opened until the suites succeed.

## Acceptance Criteria

- Hugging state components exist in the positioning mod with documented schemas and are registered in its manifest.
- `hugging:hug_tight` enforces the new forbidden-component gating for both actor and target before execution.
- The rule assigns and clears hugging state symmetrically, using entity references to keep both participants in sync.
- Integration tests verify state assignment, validation failures, stale state cleanup, and non-regression of narrative outputs, and the overall integration suite passes.
