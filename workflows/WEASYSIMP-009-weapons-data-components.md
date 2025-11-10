# WEASYSIMP-009: Create Weapons Mod Data Components

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-008
**Priority:** P0 (Blocking)

## Overview

Create three data components for weapons: `firearm` (weapon properties), `ammunition` (ammo tracking), and `ammo_container` (magazines/ammo boxes). Also create `magazine` component for detachable magazines.

## Objectives

1. Create `weapons:firearm` component
2. Create `weapons:ammunition` component
3. Create `weapons:magazine` component
4. Create `weapons:ammo_container` component
5. Validate all component schemas

## Components to Create

### 1. weapons:firearm

**File:** `data/mods/weapons/components/firearm.component.json`

Spec reference: Lines 373-420

Properties: `firearmType` (enum), `firingMode` (enum), `rateOfFire` (number), `accuracy` (0-100), `range` (meters), `condition` (enum)

### 2. weapons:ammunition

**File:** `data/mods/weapons/components/ammunition.component.json`

Spec reference: Lines 427-461

Properties: `ammoType` (string), `currentAmmo` (integer ≥0), `maxCapacity` (integer ≥1), `chambered` (boolean)

### 3. weapons:magazine

**File:** `data/mods/weapons/components/magazine.component.json`

Spec reference: Lines 468-496

Properties: `magazineInserted` (boolean), `magazineType` (string)

### 4. weapons:ammo_container

**File:** `data/mods/weapons/components/ammo_container.component.json`

Spec reference: Lines 529-569

Properties: `ammoType` (string), `currentRounds` (integer ≥0), `maxCapacity` (integer ≥1), `containerType` (enum: magazine, speed_loader, ammo_box, stripper_clip)

## Full JSON Specifications

See spec lines 373-569 for complete component JSON schemas.

## Acceptance Criteria

- [ ] All 4 component files created in `data/mods/weapons/components/`
- [ ] All have valid JSON syntax
- [ ] All validate against `component.schema.json`
- [ ] Enums match spec exactly
- [ ] Required fields correctly specified
- [ ] Number constraints (min/max) match spec
- [ ] `npm run validate` passes

## Testing

```bash
npm run validate
npm run validate:mod:weapons
```

Unit tests: `tests/unit/mods/weapons/components/`

## Related Tickets

- **Depends On:** WEASYSIMP-008
- **Blocks:** WEASYSIMP-011-015, WEASYSIMP-018-019
