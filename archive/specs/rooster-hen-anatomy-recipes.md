# Spec: Rooster and Hen Anatomy

## 1. Overview

This specification outlines the creation of anatomy definitions for two avian entities: a **Rooster** (male chicken) and a **Hen** (female chicken). This involves creating new entity definitions (parts), blueprints, and recipes, following the existing `data/mods/anatomy/` patterns.

## 2. Analysis of Existing Structures

- **Recipes** (`data/mods/anatomy/recipes/`): Map body descriptors and specific parts to blueprint slots.
- **Blueprints** (`data/mods/anatomy/blueprints/`): Define the skeletal structure, slots, and composition of the entity.
- **Parts/Entities** (`data/mods/anatomy/entities/definitions/`): Define the specific attributes of anatomical parts (name, size, texture, etc.).
- **Libraries** (`data/mods/anatomy/libraries/`): reusable slot definitions (e.g., `humanoid_slots`).

## 3. Proposed Implementation

### 3.1. Entity Definitions (Parts)

New files in `data/mods/anatomy/entities/definitions/`. All parts will use the `anatomy:part` component.

- **Torso**: `chicken_torso.entity.json`
  - Size: Small
  - Texture: Feathered
- **Head**: `chicken_head.entity.json`
  - Size: Small
  - Texture: Feathered
- **Beak**: `chicken_beak.entity.json`
  - Distinct from `anatomy:beak` (Kraken).
  - Size: Small, conical.
  - Color: Yellow/Orange.
- **Comb**: `chicken_comb.entity.json`
  - Texture: Fleshy/Warty.
  - Color: Red.
  - Note: Used for both, but recipe will specify different descriptors/variants if needed (or just rely on size/shape).
- **Wattle**: `chicken_wattle.entity.json`
  - Texture: Fleshy.
  - Color: Red.
- **Wing**: `chicken_wing.entity.json`
  - Texture: Feathered.
- **Leg**: `chicken_leg.entity.json`
  - Texture: Scaly.
  - Color: Yellow/Grey.
- **Foot**: `chicken_foot.entity.json`
  - Texture: Scaly.
  - Features: Claws/Talons.
- **Tail**: `chicken_tail.entity.json`
  - Texture: Feathered.
- **Spur**: `chicken_spur.entity.json` (Rooster specific part).

### 3.2. Blueprints

New files in `data/mods/anatomy/blueprints/`.

#### `rooster.blueprint.json`

- **Root**: `anatomy:chicken_torso`
- **Slots**:
  - `head`: Socket `neck`.
  - `left_wing`, `right_wing`: Socket `shoulder` (or `wing_root`).
  - `left_leg`, `right_leg`: Socket `hip`.
  - `tail`: Socket `tail_root`.
  - _Head Slots_: `beak`, `left_eye`, `right_eye`, `comb`, `wattle`.
  - _Leg Slots_: `foot`, `spur`.
- **Clothing**: Minimal or standard mappings (optional).

#### `hen.blueprint.json`

- Similar to Rooster but **omits the `spur` slots** on the legs (or leaves them strictly optional/unused).
- (Alternatively, use a shared `chicken.blueprint.json` if the only difference is the _part_ filled in the slot, but separate blueprints allow for structural differences like spurs).

### 3.3. Recipes

New files in `data/mods/anatomy/recipes/`.

#### `rooster.recipe.json`

- **ID**: `anatomy:rooster`
- **Blueprint**: `anatomy:rooster`
- **Slots**:
  - `head`: `anatomy:chicken_head`
  - `comb`: `anatomy:chicken_comb` (Large)
  - `wattle`: `anatomy:chicken_wattle` (Large)
  - `tail`: `anatomy:chicken_tail` (Long/Sickle feathers)
  - `spur`: `anatomy:chicken_spur`
  - ...and standard parts.

#### `hen.recipe.json`

- **ID**: `anatomy:hen`
- **Blueprint**: `anatomy:hen`
- **Slots**:
  - `head`: `anatomy:chicken_head`
  - `comb`: `anatomy:chicken_comb` (Small)
  - `wattle`: `anatomy:chicken_wattle` (Small)
  - `tail`: `anatomy:chicken_tail` (Standard)
  - ...and standard parts.

## 4. Validation

After creating the files, run:

```bash
npm run validate:recipe
```

(Note: `npm run validate:ecosystem` is the broader command, but `validate:recipe` was requested).
