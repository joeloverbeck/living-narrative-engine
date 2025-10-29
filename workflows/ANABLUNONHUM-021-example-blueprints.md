# ANABLUNONHUM-021: Create Example Blueprints Using Templates

**Phase**: 5 - Example Content  
**Priority**: High  
**Estimated Effort**: 6-8 hours  
**Dependencies**: ANABLUNONHUM-020

## Overview

Produce four showcase anatomy blueprints that exercise the V2 `structureTemplate` flow documented in
[`docs/anatomy/blueprints-v2.md`](../docs/anatomy/blueprints-v2.md) and the creature patterns captured in
[`docs/anatomy/common-non-human-patterns.md`](../docs/anatomy/common-non-human-patterns.md). Each blueprint lives under
`data/mods/anatomy/blueprints/`, declares `schemaVersion: "2.0"`, and references the structure templates landed in ticket 020.

> ℹ️ **Implementation notes**
> - Include the schema hint: `$schema: "schema://living-narrative-engine/anatomy.blueprint.schema.json"`.
> - Blueprint IDs must follow the `anatomy:<creature_name>` convention so they align with entity definitions from ticket 022.
> - `root` should match the primary body entity for the creature (see entity deliverables in ANABLUNONHUM-022).
> - `structureTemplate` must point at the template IDs delivered in ANABLUNONHUM-020.
> - Any `additionalSlots` entry **must** declare:
>   - `socket`: matches the socket ID that exists on the root entity.
>   - `requirements`: include `partType` **and** a `components` array reflecting the required component mix (use
>     [`docs/anatomy/structure-templates.md`](../docs/anatomy/structure-templates.md) for naming guidance).
>   - Optional sockets should mark `optional: true`.
> - Keep the documents purely V2—do **not** include legacy `slots`, `parts`, or `compose` blocks.
> - Where relevant, add lightweight comments (`//`) inside JSON snippets to clarify intent; the goal is to provide
>   implementers with immediately usable examples.

## Deliverables

### 1. Giant Spider Blueprint
**File**: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`

- **Blueprint ID**: `anatomy:giant_spider`
- **Structure Template**: `anatomy:structure_arachnid_8leg`
- **Root Entity**: `anatomy:spider_cephalothorax`
- **Additional Slots**:
  - `venom_gland`
    - Socket: `venom_gland`
    - Requirements: `partType: venom_gland`, `components: ["anatomy:part", "anatomy:venom"]`
    - Optional: `true` (not all spiders have an active gland)
  - `spinnerets`
    - Socket: `spinnerets`
    - Requirements: `partType: spinneret`, `components: ["anatomy:part"]`
- **Notes**: Demonstrates coexistence of template-generated limb sockets with bespoke rear sockets. Use
  the pedipalp / leg naming from [`docs/anatomy/common-non-human-patterns.md`](../docs/anatomy/common-non-human-patterns.md#arachnid).

### 2. Red Dragon Blueprint
**File**: `data/mods/anatomy/blueprints/red_dragon.blueprint.json`

- **Blueprint ID**: `anatomy:red_dragon`
- **Structure Template**: `anatomy:structure_winged_quadruped`
- **Root Entity**: `anatomy:dragon_torso`
- **Additional Slots**:
  - `fire_gland`
    - Socket: `fire_gland`
    - Requirements: `partType: gland`, `components: ["anatomy:part", "anatomy:fire_breathing"]`
  - `treasure_pouch` (optional showcase)
    - Socket: `treasure_pouch`
    - Requirements: `partType: storage_organ`, `components: ["anatomy:part"]`
    - Optional: `true`
- **Clothing Slot Mapping**: Provide at least one `clothingSlotMappings` entry, e.g.
  `"saddle": "back_mount"`, to illustrate equipment interoperability (see
  [`docs/anatomy/recipe-patterns.md`](../docs/anatomy/recipe-patterns.md#equipment-overlays) for conventions).

### 3. Kraken Blueprint
**File**: `data/mods/anatomy/blueprints/kraken.blueprint.json`

- **Blueprint ID**: `anatomy:kraken`
- **Structure Template**: `anatomy:structure_octopoid`
- **Root Entity**: `anatomy:kraken_mantle`
- **Additional Slots**:
  - `ink_sac`
    - Socket: `ink_sac`
    - Requirements: `partType: ink_reservoir`, `components: ["anatomy:part"]`
  - `beak`
    - Socket: `beak`
    - Requirements: `partType: beak`, `components: ["anatomy:part"]`
    - Optional: `true` (allows for beakless juvenile variants)
- **Notes**: Highlight that all eight tentacle sockets originate from the template. Cross-check socket naming with the
  radial symmetry guidance in [`docs/anatomy/non-human-quickstart.md`](../docs/anatomy/non-human-quickstart.md#octopoid).

### 4. Centaur Blueprint
**File**: `data/mods/anatomy/blueprints/centaur_warrior.blueprint.json`

- **Blueprint ID**: `anatomy:centaur_warrior`
- **Structure Template**: `anatomy:structure_centauroid`
- **Root Entity**: `anatomy:centaur_torso`
- **Additional Slots**:
  - Baseline implementation can rely purely on template output (humanoid arms + equine legs).
  - Optionally include a `quiver_mount` slot (socket `back_upper`) with requirements `partType: equipment_mount`,
    `components: ["anatomy:part"]`, marked `optional: true`, to demonstrate customization.
- **Clothing Slot Mapping**: Provide at least two mappings that cover both humanoid upper body and equine lower body (e.g.,
  `"torso_upper": "humanoid_torso"`, `"legs_equine": "hind_quarters"`). Follow the hybrid guidelines in
  [`docs/anatomy/v1-to-v2-pattern-migration.md`](../docs/anatomy/v1-to-v2-pattern-migration.md#hybrid-bodies).

## Validation

1. All blueprints pass schema validation using the V2 blueprint schema.
2. Load each blueprint through `BodyBlueprintFactory` to confirm template expansion and additional slot wiring.
3. Ensure optional slots behave as expected (omitted entries do not break loading, present entries validate).
4. Provide a short integration test (or extend an existing one) that instantiates each blueprint and checks for the
   expected slot counts described in [`docs/anatomy/structure-templates.md`](../docs/anatomy/structure-templates.md#slot-expansion-rules).

## References

- **Primary Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5  
- **Supporting Docs**: `docs/anatomy/blueprints-v2.md`, `docs/anatomy/common-non-human-patterns.md`,
  `docs/anatomy/structure-templates.md`, `docs/anatomy/non-human-quickstart.md`
