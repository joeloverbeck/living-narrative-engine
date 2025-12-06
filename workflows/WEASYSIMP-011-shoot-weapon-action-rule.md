# WEASYSIMP-011: Create Shoot Weapon Action and Rule

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-007, WEASYSIMP-009
**Priority:** P0 (Critical Path)

## Overview

Create the `weapons:shoot_weapon` action, condition, and rule handler. This is the core combat action.

## Files to Create

### 1. Action

**File:** `data/mods/weapons/actions/shoot_weapon.action.json`

Spec reference: Lines 572-607

Key fields:

- Required components: actor (items:inventory), secondary (weapons:weapon, weapons:ammunition, items:aimed_at)
- Forbidden components: secondary (weapons:jammed)
- Targets: primary (aimed target), secondary (ready firearm)
- Template: "shoot {target} with {weapon}"
- Visual: Arctic Steel color scheme (#112a46 bg, #e6f1ff text)

### 2. Condition

**File:** `data/mods/weapons/conditions/event-is-action-shoot-weapon.condition.json`

Standard action condition pattern checking for `weapons:shoot_weapon` action.

### 3. Rule

**File:** `data/mods/weapons/rules/handle_shoot_weapon.rule.json`

Spec reference: Lines 1458-1610

Operations sequence:

1. QUERY_COMPONENT (get ammo data)
2. MATH (subtract 1 from currentAmmo)
3. MODIFY_COMPONENT (set new ammo count)
4. MODIFY_COMPONENT (set chambered = false)
5. SET_VARIABLE (hit = true, simplified for MVP)
6. SET_VARIABLE (jammed = false, simplified for MVP)
7. GET_TIMESTAMP
8. DISPATCH_EVENT (weapons:weapon_fired)
9. IF (auto-loading weapon) THEN MODIFY_COMPONENT (set chambered = true)
10. END_TURN

## Acceptance Criteria

- [ ] All 3 files created
- [ ] Action references correct scopes
- [ ] Rule operations match spec sequence
- [ ] Event dispatching correct
- [ ] Color scheme matches Arctic Steel
- [ ] `npm run validate` passes

## Testing

Integration test: Aim weapon → Shoot → Verify ammo decremented and event dispatched

## Related Tickets

- **Depends On:** WEASYSIMP-007 (aiming), WEASYSIMP-009 (components)
- **Requires:** WEASYSIMP-016 (scopes), WEASYSIMP-017 (events)
