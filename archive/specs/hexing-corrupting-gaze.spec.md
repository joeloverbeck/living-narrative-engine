# Specification: Hexing Mod – Corrupting Gaze Action & Rule

## Overview
- Create a new `hexing` mod under `data/mods/hexing/` introducing a corrupting gaze action that seeds corruption in a target.
- Add a gating marker component `is_hexer.component.json` (new) required on the actor.
- Reuse the existing `warding:corrupted` marker component to represent corrupted targets; forbid attempting the gaze on already-corrupted targets.
- Color direction draws from the newly added Hex/Corruption scheme **Hexed Nightshade (16.1)** in `docs/mods/mod-color-schemes.md`.

## References & Prior Art
- Chance-based pattern, ratio contest, and modifier structure: `data/mods/warding/actions/extract_spiritual_corruption.action.json`.
- Warding/positioning forbiddance patterns: `data/mods/warding/actions/draw_salt_boundary.action.json`.
- Corruption marker semantics: `data/mods/warding/components/corrupted.component.json` and its removal in `data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json`.
- Dual perceptible event pattern (public vs private/target): `data/mods/items/rules/handle_drink_from.rule.json`, `data/mods/items/rules/handle_read_item.rule.json`.
- Color schemes: updated `docs/mods/mod-color-schemes.md` (Hexed Nightshade 16.1 in use for Hexing; Blighted Moss 16.2 added as available).

## Color Scheme Decision
- None of the previously available schemes matched the hexing/corruption theme, so two WCAG-compliant schemes were added to `docs/mods/mod-color-schemes.md`:
  - **16.1 Hexed Nightshade** (`#1f0d2a` bg, `#e8ffd5` text, `#2f1837` hover bg, `#f5ffe7` hover text) – assigned to the Hexing mod (marked Active in the table) and must be used for the new action’s `visual` block.
  - **16.2 Blighted Moss** (`#1a1f14` bg, `#d8ffd6` text, `#23301c` hover bg, `#e8ffe5` hover text) – added to the available pool for future hexcraft content.
- Current status counts updated to reflect 48 total schemes, 33 in use, 15 available.

## New Mod Scaffold
- Create `data/mods/hexing/mod-manifest.json` with dependencies on `core`, `skills`, `positioning`, and `warding` (for `warding:corrupted`). Include content entries for the new action, rule, condition, and `is_hexer.component.json`.
- Components directory: `data/mods/hexing/components/is_hexer.component.json` – marker-only (`dataSchema` empty object) with description noting it gates hexing actions.

## Action: `hexing:corrupting_gaze`
- Path: `data/mods/hexing/actions/corrupting_gaze.action.json`.
- Intent: Actor weaponizes a corrupting gaze to plant a seed of corruption in the primary target.
- `template`: e.g., `"cast a corrupting gaze at {target} ({chance}% chance)"`.
- `required_components.actor`: `hexing:is_hexer`.
- `forbidden_components.actor`: `positioning:doing_complex_performance`, `positioning:being_restrained`.
- `forbidden_components.primary`: `warding:corrupted` (cannot corrupt someone already corrupted).
- Targets: `primary.scope` = `core:actors_in_location` with placeholder `target`.
- Chance-based:
  - `enabled: true`, `contestType: "opposed"`, `formula: "ratio"`.
  - `actorSkill` and `targetSkill`: `skills:resolve_skill` (`property: "value"`, defaults align with extraction: actor default 10, target default 0, targetRole primary for targetSkill).
  - Bounds `{ min: 5, max: 95 }`, outcomes thresholds: `criticalSuccessThreshold: 5`, `criticalFailureThreshold: 95`.
  - Modifiers:
    1) If actor has `positioning:fallen` → flat `-10`, tag `"you're downed"`, targetRole actor.
    2) If primary target has `positioning:being_restrained` → flat `+10`, tag `"target restrained"`, targetRole primary.
- `visual`: use Hexed Nightshade colors (`backgroundColor: "#1f0d2a"`, `textColor: "#e8ffd5"`, `hoverBackgroundColor: "#2f1837"`, `hoverTextColor: "#f5ffe7"`).
- `generateCombinations`: true.

## Rule: `data/mods/hexing/rules/handle_corrupting_gaze.rule.json`
- Event condition: new `data/mods/hexing/conditions/event-is-action-corrupting-gaze.condition.json` checking `hexing:corrupting_gaze`.
- Acquire actor/target names and actor position for perception.
- Resolve outcome mirroring the action’s chance setup (resolve vs resolve).
- Shared perception context: ensure `perception_type` aligns with action-target general use (mirrors patterns in warding rules) and set `locationId` from actor position.
- Outcomes:
  1) **CRITICAL_SUCCESS**:
     - Action success message: `{actor} looks deeply into {target}'s eyes, casting a corrupting gaze. {target} shudders violently as darkness floods through them.`
     - Perceptible event A (everyone but target): same as success message with `excludedActorIds: [targetId]`.
     - Perceptible event B (only target): `{actor} looks deeply into my eyes, and I feel darkness flooding into me. A sickly warmth fills you, accompanied by a burning smell and a ringing noise in your ears.` (`recipientIds: [targetId]`).
     - Add `warding:corrupted` to target; regenerate description if applicable; log success and end turn.
  2) **SUCCESS**:
     - Action success message: `{actor} looks deeply into {target}'s eyes, casting a corrupting gaze. {target} shudders as darkness seeps into them.`
     - Perceptible event A (everyone but target): same as success message with `excludedActorIds: [targetId]`.
     - Perceptible event B (only target): `{actor} looks deeply into my eyes, and I feel darkness seeping into me. A sickly warmth starts filling me, accompanied by a burning smell.`
     - Add `warding:corrupted` to target; regenerate description; log success and end turn.
  3) **FAILURE**:
     - Action/log/perceptible message: `{actor} looks deeply into {target}'s eyes, casting a corrupting gaze, but {target} resists the spiritual attack.`
     - No component changes; log failure and end turn.
  4) **FUMBLE**:
     - Action/log/perceptible message: `{actor} looks deeply into {target}'s eyes, casting a corrupting gaze, but {target}'s resolve shocks through {actor}, making them fall to the ground.`
     - Add `positioning:fallen` to actor; regenerate description; log failure and end turn.
- Perception handling must follow the dual-perception pattern from `handle_drink_from`/`handle_read_item` (public message excluding target + private message to target).

## Testing Requirements
- Follow docs in `docs/testing/` and existing mod integration patterns under `tests/integration/mods/`.
- Add integration tests to cover:
  - Action discoverability: requires `hexing:is_hexer`, rejects when actor has forbidden components, rejects targets already marked `warding:corrupted`, respects target scope `core:actors_in_location`.
  - Chance modifiers: negative modifier when actor has `positioning:fallen` with tag `"you're downed"`; positive modifier when target restrained with tag `"target restrained"`.
  - Rule outcomes: each of CRITICAL_SUCCESS/SUCCESS/FAILURE/FUMBLE applies the correct components (`warding:corrupted` added on success, `positioning:fallen` added on fumble), dispatches two perceptible events with correct audience gating, and logs the specified messages.
- Prefer `--runInBand` for jest suites to avoid known force-exit issues when narrowing scope.
