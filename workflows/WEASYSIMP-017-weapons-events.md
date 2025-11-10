# WEASYSIMP-017: Create Weapons Mod Events

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-011-015
**Priority:** P0 (Blocking)

## Overview

Create 8 event schemas for weapons mod event system.

## Events to Create

All files in `data/mods/weapons/events/`:

1. `weapon_fired.event.json` (spec lines 965-1005)
   - Payload: actorId, weaponId, targetId, hit (bool), remainingAmmo, timestamp
2. `weapon_jammed.event.json` (spec lines 1007-1039)
   - Payload: actorId, weaponId, jamType (enum), timestamp
3. `weapon_reloaded.event.json` (spec lines 1042-1083)
   - Payload: actorId, weaponId, ammoSourceId, roundsLoaded, newAmmoCount, timestamp
4. `round_chambered.event.json` (spec lines 1085-1112)
   - Payload: actorId, weaponId, timestamp
5. `jam_cleared.event.json` (spec lines 1114-1145)
   - Payload: actorId, weaponId, jamType, timestamp
6. `magazine_ejected.event.json` (spec lines 1147-1184)
   - Payload: actorId, weaponId, magazineId, remainingRounds, timestamp
7. `magazine_inserted.event.json` (spec lines 1186-1222)
   - Payload: actorId, weaponId, magazineId, roundsInMagazine, timestamp

Also create corresponding conditions (event-is-action-*) for each action.

## Acceptance Criteria

- [ ] All 7 event files created
- [ ] All 7 condition files created
- [ ] Valid JSON and schemas
- [ ] Required fields specified
- [ ] Entity ID patterns correct
- [ ] `npm run validate` passes

## Related Tickets

- **Depends On:** WEASYSIMP-011-015
- **Used By:** All weapon rules dispatch these events
