# Spec: Warding Spiritual Corruption Extraction Action

## Goal

Add a new warding action/rule that lets an actor use a spiritual anchor item to extract the `warding:corrupted` component from a target. The action template should read: `extract spiritual corruption from {target} with {anchor} ({chance}% chance)`.

## Current References

- `data/mods/warding/components/corrupted.component.json`: marker component used by `warding:corrupted_actors` scope, `warding:entity-has-corrupted-component` condition, and gating for `draw_salt_boundary`/`cross_salt_boundary`.
- `data/mods/warding/actions/draw_salt_boundary.action.json`: supplies actor forbidden components list and modifier patterns (restrained/downed bonuses, unrestrained penalty).
- `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`: shows warding outcome handling + perception/log macros.
- `data/mods/weapons/actions/strike_target.action.json`: reference for `chanceBased.contestType = opposed` with actorSkill vs targetSkill and ratio formula.
- `data/mods/items/rules/handle_drop_item.rule.json`: reference sequence for unwield/drop/regenerate description/logging when an item is dropped.
- Tests under `tests/integration/mods/warding/*draw_salt_boundary*` exercise discovery + modifiers for corrupted targets; reuse patterns for new action tests.

## New Data Assets

- **Component:** `data/mods/warding/components/is_spiritual_anchor.component.json`
  - Id `warding:is_spiritual_anchor`; marker (empty schema) to tag anchor items.
  - Add to `data/mods/warding/mod-manifest.json` components array.
- **Skill:** `data/mods/skills/components/resolve_skill.component.json`
  - Id `skills:resolve_skill`; schema mirrors other skills (`value` int 0–100, default 10).
  - Description: “Strength of will and spiritual self-command. Governs both resisting and exerting non-physical influence—hexes, possession pressure, corrupting effects, fear/compulsion, and other mind/spirit intrusions. Determines effectiveness in spiritual dominance contests and resistance against them.”
  - Add to `data/mods/skills/mod-manifest.json` components array.
- **Scope:** `data/mods/warding/scopes/spiritual_anchors.scope`
  - Finds secondary targets for `{anchor}`: entities in the actor’s location that have `warding:is_spiritual_anchor` (and preferably `items:item` so actors aren’t valid). Pattern after other scopes (`warding:corrupted_actors`) with location match + not-the-actor guard.
- **Action:** `data/mods/warding/actions/extract_spiritual_corruption.action.json`
  - Id `warding:extract_spiritual_corruption`; template as stated; `generateCombinations: true`.
  - Required components (actor): `skills:warding_skill`.
  - Forbidden components (actor): mirror `draw_salt_boundary.action.json` (hugging, giving_blowjob, doing_complex_performance, bending_over, being_restrained, restraining, fallen). No forbidden components for primary/secondary.
  - Targets:
    - `primary`: scope `warding:corrupted_actors`, placeholder `target`, description “Corrupted actor to cleanse”.
    - `secondary`: scope `warding:spiritual_anchors`, placeholder `anchor`, description “Anchor item to channel corruption”.
  - Chance based: `contestType: opposed`, `formula: ratio`, bounds min 5 / max 95, outcomes thresholds 5/95 (match strike_target). `actorSkill` = `skills:warding_skill` (value, default 10). `targetSkill` = `skills:resolve_skill` targeting the `primary` role (value, default 0).
  - Modifiers:
    1. `-10` flat when primary lacks `positioning:being_restrained` (tag `target unrestrained`).
    2. `+10` flat when primary has `positioning:being_restrained` (tag `target restrained`).
    3. `+5` flat when primary has `warding:warded_by_salt` (tag `target warded`).
    4. `+5` flat when primary has `positioning:fallen` (tag `target downed`).
  - Visual styling can reuse the Cool Grey Modern palette from existing warding actions.
- **Condition:** `data/mods/warding/conditions/event-is-action-extract-spiritual-corruption.condition.json`
  - Checks `event.payload.actionId === 'warding:extract_spiritual_corruption'`; include in manifest conditions.
- **Rule:** `data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json`
  - Event: `core:attempt_action`, condition above.
  - Resolve outcome: `RESOLVE_OUTCOME` opposed contest using `skills:warding_skill` vs target (primary) `skills:resolve_skill`; store result (e.g., `extractionResult`).
  - Common setup: GET_NAME for actor/target/anchor, QUERY_COMPONENT for actor position, set `locationId`, `targetId`, `perceptionType` (`action_target_general`), maybe `anchorId` variable if helpful.
  - Outcome branches:
    - **CRITICAL_SUCCESS:** Remove `warding:corrupted` from target; optionally `REGENERATE_DESCRIPTION` for target; dispatch perception `{actor} extracts the corruption out of {target} swiftly using {anchor}. Light returns to {target}'s eyes.`; log success + end turn macro.
    - **SUCCESS:** Same message with “After a struggle, ...”; remove `warding:corrupted` from target as corruption was extracted; log success + end turn macro.
    - **FAILURE:** Message `Despite a struggle, {actor} fails to extract the corruption out of {target} using {anchor}. Darkness lingers in {target}'s eyes.`; no component changes; failure log macro.
    - **FUMBLE:** Message `{actor} attempts to extract the corruption out of {target} using {anchor}, but during the struggle, the {anchor} slips from {actor}'s hands.`; drop the anchor using the same steps as `handle_drop_item.rule.json` (UNWIELD_ITEM, DROP_ITEM_AT_LOCATION at actor position, REGENERATE_DESCRIPTION for actor); failure log macro.
  - Add rule id to manifest `rules` array and ensure `actionPurpose/actionConsiderWhen` metadata stays consistent if present elsewhere.
- **Entity Update:** Add `warding:is_spiritual_anchor` component to `data/mods/fantasy/entities/definitions/containment_vessel.entity.json` (anchor source item).
- **Manifest Updates:** Register new component, scope, condition, action, and rule in `data/mods/warding/mod-manifest.json`; register `resolve_skill` in `data/mods/skills/mod-manifest.json`.

## Testing Plan

- **Action discovery (integration):** New tests under `tests/integration/mods/warding/` verifying:
  - Action surfaces only when actor has `skills:warding_skill`, target has `warding:corrupted`, and an anchor with `warding:is_spiritual_anchor` is present in location.
  - Actor forbidden components block availability (reuse list from draw_salt_boundary); no forbidden checks on primary/secondary.
  - Secondary scope resolves only anchor-tagged items (e.g., containment vessel); absence removes action.
  - Modifiers appear with correct tags/values and react to `being_restrained`, `warding:warded_by_salt`, `positioning:fallen`.
  - Template renders `extract spiritual corruption from {target} with {anchor} ({chance}% chance)`.
- **Rule behavior (integration):** Add scenario tests (e.g., `extract_spiritual_corruption_rule.test.js`) covering all four outcomes:
  - Critical success/success remove `warding:corrupted` from target and emit correct text.
  - Failure leaves corruption intact and logs failure text.
  - Fumble causes anchor to be dropped (removed from inventory/wielded, placed in location, description refreshed) using same operations as `handle_drop_item`.
  - Outcome resolution uses opposed contest: actor warding_skill vs target resolve_skill (stub values to force each branch).
- **Component/skill loading:** Extend or mirror `warding_components_loading.test.js` to include `is_spiritual_anchor`; add skills component load test for `resolve_skill` if needed.
- **Docs reference:** Follow mod testing guidance in `docs/testing/` and reuse `ModActionTestFixture`/`ModEntityBuilder` patterns from existing warding tests for discoverability and rule assertions.
