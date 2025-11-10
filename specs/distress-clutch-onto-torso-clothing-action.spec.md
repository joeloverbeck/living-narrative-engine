# Distress Mod Pleading Clutch Action Specification

## Overview

Introduce the distress mod's first multi-target gesture by adapting the caressing mod's `adjust_clothing` structure to convey a desperate cling to a companion's upper torso garment. Mirror the multi-target layout, closeness-driven targeting, and rule orchestration shown in the caressing implementation so the new distress content remains compatible with the engine's action pipeline. 【F:data/mods/caressing/actions/adjust_clothing.action.json†L2-L39】【F:data/mods/caressing/rules/adjust_clothing.rule.json†L2-L69】

The distress mod already declares the `clothing` dependency and documents the Obsidian Frost secondary palette; reuse that palette so the new action aligns with existing visual plans. 【F:data/mods/distress/mod-manifest.json†L9-L32】【F:data/mods/distress/README.md†L1-L13】 The WCAG palette spec lists Obsidian Frost (11.7) as the combination assigned to distress gestures—apply the same colors to the new action's `visual` block. 【F:docs/mods/mod-color-schemes.md†L660-L670】

## Scope Requirements

Create `data/mods/distress/scopes/close_actors_facing_each_other_with_torso_clothing.scope` that mirrors the caressing scope logic but is namespaced for the distress mod. Preserve the closeness partner traversal, the facing condition, and the torso_upper clothing filter. 【F:data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope†L1-L8】 Register the scope file inside the distress manifest's `content.scopes` array.

## Action Requirements

Add `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` using the standard action schema and the following properties:

- `id`: `distress:clutch_onto_upper_clothing`.
- `name`: `Clutch Pleadingly Onto Clothing` (title case, concise, expresses the gesture's desperation).
- `description`: Briefly describe the actor grabbing onto the target's upper garment in a pleading way.
- `targets.primary.scope`: `distress:close_actors_facing_each_other_with_torso_clothing` with placeholder `primary` and the same description style as the reference action's primary target. 【F:data/mods/caressing/actions/adjust_clothing.action.json†L7-L11】
- `targets.secondary.scope`: `clothing:target_topmost_torso_upper_clothing`, placeholder `secondary`, description noting it's the garment being clutched, and `contextFrom: "primary"`. 【F:data/mods/caressing/actions/adjust_clothing.action.json†L12-L17】
- `template`: **exactly** `clutch pleadingly onto {primary}'s {secondary}`.
- `required_components.actor`: `["positioning:closeness"]`. 【F:data/mods/caressing/actions/adjust_clothing.action.json†L20-L22】
- `forbidden_components`: Empty objects for all entity keys (no forbidden components for this action).
- `prerequisites`: `[]` (omit the redundant closeness prerequisite from the reference action).
- `visual`: Obsidian Frost palette — background `#0b132b`, text `#f2f4f8`, hover background `#1c2541`, hover text `#e0e7ff`. 【F:docs/mods/mod-color-schemes.md†L660-L670】

Add the new action path to `content.actions` in the distress manifest. 【F:data/mods/distress/mod-manifest.json†L27-L31】

## Condition Requirements

Provide `data/mods/distress/conditions/event-is-action-clutch-onto-upper-clothing.condition.json` that matches the schema and equality check pattern used by the caressing condition, but targets the new distress action id. Register it under `content.conditions`. 【F:data/mods/caressing/conditions/event-is-action-adjust-clothing.condition.json†L1-L12】【F:data/mods/distress/mod-manifest.json†L27-L31】

## Rule Requirements

Implement `data/mods/distress/rules/clutch_onto_upper_clothing.rule.json` using the `core:attempt_action` pipeline from the caressing rule as a reference. 【F:data/mods/caressing/rules/adjust_clothing.rule.json†L2-L69】 Requirements:

1. `rule_id`: `handle_clutch_onto_upper_clothing` with a concise comment describing the action handling.
2. `condition`: `{ "condition_ref": "distress:event-is-action-clutch-onto-upper-clothing" }`.
3. Action steps:
   - `GET_NAME` actor → `actorName`.
   - `GET_NAME` primary → `primaryName`.
   - `GET_NAME` secondary → `garmentName`.
   - `QUERY_COMPONENT` actor `core:position` → `actorPosition` for location data.
   - `SET_VARIABLE` for `perceptibleLogMessage` with the exact sentence `{context.actorName} clutches pleadingly onto {context.primaryName}'s {context.garmentName}.`
   - `SET_VARIABLE` for `successMessage` using the same sentence (no wording divergence between logs and success UI).
   - `DISPATCH_PERCEPTIBLE_EVENT` with `description_text` bound to the log message, `perception_type` `action_target_general`, `actor_id` from `event.payload.actorId`, and `target_id` from `event.payload.primaryId`.
   - `{ "macro": "core:displaySuccessAndEndTurn" }`.
4. Ensure the rule is listed in `content.rules` in the manifest. 【F:data/mods/distress/mod-manifest.json†L27-L31】

## Manifest Updates

Expand `data/mods/distress/mod-manifest.json` so `content.actions`, `content.conditions`, `content.rules`, and `content.scopes` each include the new file names. Maintain alphabetical ordering if additional entries are added later. 【F:data/mods/distress/mod-manifest.json†L27-L31】

## Testing Specification

Author comprehensive integration coverage under `tests/integration/mods/distress/`, following the ModTestFixture-driven pattern demonstrated by the caressing suite. 【F:tests/integration/mods/caressing/adjust_clothing_action.test.js†L1-L94】

1. **Action Discoverability** — A test (e.g., `clutch_onto_upper_clothing_discovery.test.js`) that loads the distress mod action via `ModTestFixture.forAction`. Validate:
   - Metadata and templates match the specification, including the Obsidian Frost palette.
   - The action appears when actors satisfy the `distress:close_actors_facing_each_other_with_torso_clothing` scope and the target has appropriate torso clothing.
   - The action is absent when closeness, facing, or clothing requirements fail.
2. **Rule Behavior** — A test (e.g., `clutch_onto_upper_clothing_action.test.js`) that dispatches `core:attempt_action` with both targets and asserts:
   - The perceptible event and success message both equal "{actor} clutches pleadingly onto {primary}'s {secondary}." after name resolution.
   - The emitted perceptible event uses `perception_type` `action_target_general`, includes the actor and primary ids, and references the actor's location.
   - The rule only triggers for the new action id and ends the actor's turn via the macro.

Run the integration suite (`npm run test:integration`) after adding the new tests to ensure all mod integrations—including the distress additions—pass together. 【F:tests/integration/mods/caressing/adjust_clothing_action.test.js†L15-L55】
