# WEASYSIMP-019: Create Ammunition Entity Definitions

**Phase:** Entity Definitions
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-009
**Priority:** P1

## Overview

Create 3 ammunition container entity definitions: 9mm magazine, 5.56mm ammo box, .357 speed loader.

## Entities to Create

All files in `data/mods/weapons/entities/`:

1. `magazine_9mm_loaded.entity.json` (spec lines 1361-1391)
   - 15-round magazine, containerType: "magazine"
2. `ammo_box_556.entity.json` (spec lines 1393-1421)
   - 200-round ammo box, containerType: "ammo_box"
3. `speed_loader_357.entity.json` (spec lines 1423-1452)
   - 6-round speed loader for revolvers, containerType: "speed_loader"

Each needs:
- core:name, core:description
- items:item, items:portable, items:weight
- weapons:ammo_container

## Acceptance Criteria

- [ ] 3 ammo entity files created
- [ ] All have ammo_container component
- [ ] containerType matches spec
- [ ] ammoType matches corresponding weapon
- [ ] `npm run validate` passes

## Related Tickets

- **Depends On:** WEASYSIMP-009
- **Used By:** WEASYSIMP-012, WEASYSIMP-015, WEASYSIMP-025
