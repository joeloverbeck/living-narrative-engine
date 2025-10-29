# ANABLUNONHUM-021: Create Example Blueprints Using Templates

**Phase**: 5 - Example Content
**Priority**: High
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-020

## Overview

Create V2 anatomy blueprints that exercise the structure templates landed in ANABLUNONHUM-020. These
blueprints live in `data/mods/anatomy/blueprints/`, use the V2 schema features (`schemaVersion: "2.0"` +
`structureTemplate`), and stay within the `anatomy:` namespace.

> ℹ️ **Implementation notes**
> - Include the schema hint: `$schema: "schema://living-narrative-engine/anatomy.blueprint.schema.json"`.
> - Blueprint IDs should follow the pattern `anatomy:<creature_name>` to match existing content.
> - Reference the exact template IDs already present under `data/mods/anatomy/structure-templates/`.
> - Root entities (`root`) should line up with the entity definition files introduced in ANABLUNONHUM-022
>   (e.g., `anatomy:spider_cephalothorax`, `anatomy:dragon_torso`).
> - `additionalSlots` entries must specify both `socket` and `requirements` (with the correct
>   `partType` / components) so the BodyBlueprintFactory examples compile once those parts exist.
> - Keep everything V2-compliant: do **not** include legacy `slots` / `parts` / `compose` blocks.

## Deliverables

### 1. Giant Spider Blueprint
**File**: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`

- **Blueprint ID**: `anatomy:giant_spider`
- **Structure Template**: `anatomy:structure_arachnid_8leg`
- **Root Entity**: `anatomy:spider_cephalothorax`
- **Additional Slots**:
  - `venom_gland` → socket `venom_gland`, `partType: venom_gland`, components `["anatomy:part", "anatomy:venom"]`, optional (spiders may omit glands)
  - `spinnerets` → socket `spinnerets`, `partType: spinneret`, components `["anatomy:part"]`
- **Notes**: demonstrate how template-generated leg / pedipalp sockets coexist with bespoke glands.

### 2. Red Dragon Blueprint
**File**: `data/mods/anatomy/blueprints/red_dragon.blueprint.json`

- **Blueprint ID**: `anatomy:red_dragon`
- **Structure Template**: `anatomy:structure_winged_quadruped`
- **Root Entity**: `anatomy:dragon_torso`
- **Additional Slots**:
  - `fire_gland` → socket `fire_gland`, `partType: gland`, components `["anatomy:part", "anatomy:fire_breathing"]`
  - (Optional) `treasure_pouch` → socket `treasure_pouch`, `partType: storage_organ`, mark as `optional: true`
- **Clothing Slot Mapping**: include a simple example (e.g., `saddle` mapped to `back_mount`) to show V2 compatibility with equipment slots.

### 3. Kraken Blueprint
**File**: `data/mods/anatomy/blueprints/kraken.blueprint.json`

- **Blueprint ID**: `anatomy:kraken`
- **Structure Template**: `anatomy:structure_octopoid`
- **Root Entity**: `anatomy:kraken_mantle`
- **Additional Slots**:
  - `ink_sac` → socket `ink_sac`, `partType: ink_reservoir`, components `["anatomy:part"]`
  - `beak` → socket `beak`, `partType: beak`, components `["anatomy:part"]`, optional true (allows variants)
- **Notes**: highlight how radial tentacle generation comes entirely from the template.

### 4. Centaur Blueprint
**File**: `data/mods/anatomy/blueprints/centaur_warrior.blueprint.json`

- **Blueprint ID**: `anatomy:centaur_warrior`
- **Structure Template**: `anatomy:structure_centauroid`
- **Root Entity**: `anatomy:centaur_torso`
- **Additional Slots**: none required beyond template output; rely on template-provided humanoid arms + equine legs. Optionally add a `quiver_mount` (socket `back_upper`, optional) if you need to demonstrate the pattern.
- **Clothing Slot Mapping**: map at least one clothing slot (e.g., `torso_upper`, `legs`, `hooves`) to prove mixed humanoid/equine coverage.

## Validation

- All blueprints pass v2 schema validation
- Load successfully with BodyBlueprintFactory
- Generate correct slot definitions
- Test with integration tests

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5
