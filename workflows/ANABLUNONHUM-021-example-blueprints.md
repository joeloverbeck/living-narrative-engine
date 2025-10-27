# ANABLUNONHUM-021: Create Example Blueprints Using Templates

**Phase**: 5 - Example Content
**Priority**: High
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-020

## Overview

Create v2 blueprints referencing the structure templates, demonstrating additionalSlots and proper usage.

## Deliverables

### 1. Giant Spider Blueprint
**File**: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`

- Uses structure_arachnid_8leg template
- Adds venom_gland, spinnerets (additionalSlots)
- References spider_cephalothorax root entity

### 2. Red Dragon Blueprint
**File**: `data/mods/anatomy/blueprints/red_dragon.blueprint.json`

- Uses structure_winged_quadruped template
- Adds fire_gland (additionalSlots)
- References dragon_torso root entity

### 3. Kraken Blueprint
**File**: `data/mods/anatomy/blueprints/kraken.blueprint.json`

- Uses structure_octopoid template
- Adds ink_sac (additionalSlots)
- References kraken_mantle root entity

### 4. Centaur Blueprint
**File**: `data/mods/anatomy/blueprints/centaur_warrior.blueprint.json`

- Uses structure_centauroid template
- Standard additionalSlots
- References centaur_torso root entity

## Validation

- All blueprints pass v2 schema validation
- Load successfully with BodyBlueprintFactory
- Generate correct slot definitions
- Test with integration tests

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5
