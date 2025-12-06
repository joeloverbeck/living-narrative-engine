# WEASYSIMP-012: Create Reload Weapon Action and Rule

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-009
**Priority:** P0 (Critical Path)

## Overview

Create `weapons:reload_weapon` action, condition, and rule handler for reloading weapons from ammo containers.

## Files to Create

### 1. Action

**File:** `data/mods/weapons/actions/reload_weapon.action.json`

Spec reference: Lines 622-654

Key fields:

- Required components: actor (items:inventory), secondary (weapons:weapon, weapons:ammunition)
- Targets: primary (reloadable firearm), secondary (compatible ammo source)
- Template: "reload {weapon} with {ammo_source}"

### 2. Condition

**File:** `data/mods/weapons/conditions/event-is-action-reload-weapon.condition.json`

### 3. Rule

**File:** `data/mods/weapons/rules/handle_reload_weapon.rule.json`

Spec reference: Lines 1611-1810

Operations:

1. HAS_COMPONENT (check if aimed)
2. IF (aimed) REMOVE_COMPONENT (items:aimed_at)
3. QUERY_COMPONENT (weapon ammo)
4. QUERY_COMPONENT (ammo container)
5. MATH (calculate rounds to transfer)
6. MATH (calculate new counts)
7. MODIFY_COMPONENT (update weapon ammo)
8. IF (container empty) REMOVE_COMPONENT else MODIFY_COMPONENT
9. GET_TIMESTAMP
10. DISPATCH_EVENT (weapons:weapon_reloaded)
11. END_TURN

## Acceptance Criteria

- [ ] All 3 files created
- [ ] Complex math operations correct
- [ ] Auto-lowers aim if weapon aimed
- [ ] Handles empty ammo containers
- [ ] `npm run validate` passes

## Related Tickets

- **Depends On:** WEASYSIMP-009
- **Requires:** WEASYSIMP-016, WEASYSIMP-017
