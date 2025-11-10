# WEASYSIMP-021: Create Weapons Mod Component Tests

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-009, WEASYSIMP-010
**Priority:** P1

## Overview

Create unit tests for all weapons mod components.

## Tests to Create

### Unit Tests (`tests/unit/mods/weapons/components/`)

1. `weapon.test.js` - Marker component validation
2. `firearm.test.js` - Firearm component validation
   - Test enums (firearmType, firingMode, condition)
   - Test number constraints (accuracy 0-100, range > 0)
3. `ammunition.test.js` - Ammunition component validation
   - Test currentAmmo constraints
   - Test chambered boolean
4. `magazine.test.js` - Magazine component validation
5. `jammed.test.js` - Jammed state component validation
   - Test jamType enum
6. `ammoContainer.test.js` - Ammo container component validation
   - Test containerType enum

## Acceptance Criteria

- [ ] 6 test files created
- [ ] All component schemas validated
- [ ] Enum values tested
- [ ] Number constraints tested
- [ ] Required fields validated
- [ ] `npm run test:unit -- tests/unit/mods/weapons/components/` passes

## Related Tickets

- **Depends On:** WEASYSIMP-009, WEASYSIMP-010
