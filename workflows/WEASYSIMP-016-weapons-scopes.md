# WEASYSIMP-016: Create Weapons Mod Scopes

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-009, WEASYSIMP-010
**Priority:** P0 (Blocking)

## Overview

Create 9 scope DSL files for weapons mod action discovery and filtering.

## Scopes to Create

All files in `data/mods/weapons/scopes/`:

1. `ready_firearms_in_inventory.scope` (spec lines 825-839)
   - Firearms that are aimed, loaded, and not jammed
2. `reloadable_firearms_in_inventory.scope` (spec lines 841-856)
   - Firearms with currentAmmo < maxCapacity
3. `unchambered_firearms_in_inventory.scope` (spec lines 858-872)
   - Firearms with ammo but chambered=false
4. `jammed_firearms_in_inventory.scope` (spec lines 874-885)
   - Firearms with weapons:jammed component
5. `compatible_ammo_in_inventory.scope` (spec lines 887-904)
   - Ammo containers with matching ammoType (uses context.weapon)
6. `aimed_target_from_weapon.scope` (spec lines 906-916)
   - Entity that weapon is aimed at (from items:aimed_at.targetId)
7. `magazine_fed_firearms_with_magazine.scope` (spec lines 918-930)
   - Firearms with magazineInserted=true
8. `magazine_fed_firearms_without_magazine.scope` (spec lines 932-944)
   - Firearms with magazineInserted=false
9. `compatible_magazines_in_inventory.scope` (spec lines 946-963)
   - Magazine containers with matching ammoType

## Key Patterns

- Use `entity.components.*` to access component fields in filters
- Use `context.weapon.components.*` for context-dependent scopes
- Use `{"has": [{"var": "."}, "component:type"]}` for component existence checks
- Use comparison operators for field validation

## Acceptance Criteria

- [ ] All 9 scope files created
- [ ] Correct Scope DSL syntax
- [ ] Component references correct
- [ ] JSON Logic filters valid
- [ ] `npm run scope:lint` passes

## Testing

Integration tests with ModTestFixture.resolveScope()

## Related Tickets

- **Depends On:** WEASYSIMP-009, WEASYSIMP-010
- **Blocks:** WEASYSIMP-011-015 (all actions need these scopes)
