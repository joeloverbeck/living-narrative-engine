# Warding Mod Specification

## Overview
This specification details the creation of a new mod `warding` which introduces mechanics for protective magic, specifically creating salt boundaries against corrupted entities.

## Components

### 1. Warding Skill
*   **Path:** `data/mods/skills/components/warding_skill.component.json`
*   **Description:** Proficiency in creating protective wards and barriers.
*   **Structure:** Based on standard skill components (e.g., `melee_skill`).
    *   Properties: `value` (integer, 0-100, default 10).

### 2. Corrupted Marker
*   **Path:** `data/mods/warding/components/corrupted.component.json`
*   **Description:** Marks an entity as corrupted and susceptible to warding actions.
*   **Structure:** Marker component (no properties).

## Actions

### Draw Salt Boundary
*   **Path:** `data/mods/warding/actions/draw_salt_boundary.action.json`
*   **Template:** `draw salt boundary around {target} ({chance}% chance)`
*   **Description:** Attempt to create a protective salt boundary around a corrupted target.
*   **Requirements:**
    *   Actor must have `skills:warding_skill`.
    *   Target must have `warding:corrupted` (handled via scope).
*   **Chance Mechanics:**
    *   `enabled`: true
    *   `contestType`: `fixed_difficulty`
    *   `fixedDifficulty`: 50
    *   `formula`: `linear`
    *   `actorSkill`: `skills:warding_skill`
*   **Visual:**
    *   Use the **"Cool Grey Modern"** color scheme (Category 10.3) from `docs/mods/mod-color-schemes.md` as it fits the neutral/white "salt" aesthetic.
    *   Update `docs/mods/mod-color-schemes.md` to mark "Cool Grey Modern" as IN USE by `Warding`.

### Scope
*   **Path:** `data/mods/warding/scopes/corrupted_actors.scope.json` (or inline if preferred, but explicit scope is better for reusability).
*   **Logic:** Select actors in the current location who possess the `warding:corrupted` component.
*   **Reference:** `warding:corrupted_actors`

## Rules

### Handle Draw Salt Boundary
*   **Path:** `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
*   **Event:** `core:attempt_action`
*   **Condition:** Event is `warding:draw_salt_boundary`
*   **Outcomes:**
    1.  **CRITICAL_SUCCESS:**
        *   Message: `{actor} draws a perfect salt boundary around the corrupted target {target}.`
        *   Log: Same.
    2.  **SUCCESS:**
        *   Message: `{actor} draws a correct salt boundary around the corrupted target {target}.`
        *   Log: Same.
    3.  **FAILURE:**
        *   Message: `{actor} fails at drawing a salt boundary around the corrupted target {target}. The boundary will need to be redone.`
        *   Log: Same.
    4.  **FUMBLE:**
        *   Message: `{actor} tries to draw a salt boundary around the corrupted target {target} in a hurry, but slips and falls to the ground.`
        *   Effect: Add `positioning:fallen` component to actor.
        *   Effect: `REGENERATE_DESCRIPTION` for actor.
        *   Log: Same.

## Testing Plan

### Integration Tests
1.  **Action Discovery (`tests/integration/mods/warding/draw_salt_boundary_action_discovery.test.js`)**:
    *   Verify action appears when actor has `warding_skill` and target has `corrupted`.
    *   Verify action does NOT appear if actor lacks skill.
    *   Verify action does NOT appear if target lacks `corrupted`.
    *   Mock scope resolution similar to `restrain_target` tests.

2.  **Rule Execution (`tests/integration/mods/warding/draw_salt_boundary_rule.test.js`)**:
    *   Test all 4 outcomes (Critical Success, Success, Failure, Fumble).
    *   For Fumble, verify `positioning:fallen` is applied and description regenerated.
    *   Verify correct messages are dispatched.

## Implementation Steps
1.  Create `warding_skill.component.json`.
2.  Create `corrupted.component.json`.
3.  Update `docs/mods/mod-color-schemes.md` to assign "Cool Grey Modern" to Warding.
4.  Create `draw_salt_boundary.action.json`.
5.  Create `handle_draw_salt_boundary.rule.json`.
6.  Create integration tests.
7.  Run validation `npm run validate:ecosystem`.
8.  Run tests `npm run test:integration`.
