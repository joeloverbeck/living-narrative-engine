# WEASYSIMP-018: Create Weapon Entity Definitions

**Phase:** Entity Definitions
**Timeline:** 1.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-009
**Priority:** P1

## Overview

Create 3 example weapon entity definitions: pistol, automatic rifle, revolver.

## Entities to Create

All files in `data/mods/weapons/entities/`:

1. `pistol_9mm_standard.entity.json` (spec lines 1228-1270)
   - Semi-automatic pistol with 15-round magazine
   - Components: core:name, core:description, items:*, weapons:*, weights
2. `rifle_556_auto.entity.json` (spec lines 1272-1315)
   - Military automatic rifle with 30-round magazine
   - Includes rateOfFire, higher accuracy and range
3. `revolver_357.entity.json` (spec lines 1317-1358)
   - 6-round revolver, NO magazine component
   - Manual firing mode

## Key Details

Each weapon needs:
- Core components: name, description
- Item components: item, portable, aimable, weight
- Weapon components: weapon, firearm, ammunition
- Magazine component (pistol/rifle only)

## Acceptance Criteria

- [ ] 3 entity files created
- [ ] All components present and valid
- [ ] Pistol and rifle have magazine component
- [ ] Revolver does NOT have magazine component
- [ ] Firearm properties match spec
- [ ] `npm run validate` passes

## Related Tickets

- **Depends On:** WEASYSIMP-009
- **Used By:** WEASYSIMP-025 (E2E tests)
