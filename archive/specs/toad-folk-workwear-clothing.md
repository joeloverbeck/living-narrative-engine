# Spec: Toad Folk Workwear Clothing Entities

## Overview

Create 6 new workwear clothing entity definitions for the toad folk male character, plus update descriptor enums with new colors and textures. The toad folk male recipe (`data/mods/dredgers/recipes/toad_folk_male.recipe.json`) currently lacks clothing assignments (unlike the ermine_folk_female recipe which has formal attire).

## Analysis Summary

### Recipe Comparison
- **ermine_folk_female**: Has `clothingEntities` array with 6 formal items (gown, overskirt, mantle, gloves, boots, sash)
- **toad_folk_male**: Missing `clothingEntities` array entirely - needs workwear appropriate to the "dredger" theme

### Existing Patterns Analyzed
- `work_tunic_mud_brown.entity.json` - Simple linen work tunic pattern
- `reinforced_yard_trousers_mud_stained_wool.entity.json` - Work trousers pattern
- `linen_shift_coarse_gray_cream.entity.json` - Underwear undershift pattern
- `quilted_smoke_gray_jerkin_linen_wool.entity.json` - Outer clothing pattern
- `white_leather_elbow_gloves.entity.json` - Gloves pattern (hands slot)
- `waxed_leather_work_boots_dark_brown.entity.json` - Work boots pattern

---

## Implementation Plan

### Phase 1: Update Descriptor Enums

#### 1.1 Add new colors to `color_extended.component.json`
**File**: `data/mods/descriptors/components/color_extended.component.json`

Add the following to the `enum` array (alphabetically sorted):
- `clay-umber`
- `iron-brown`
- `moss`
- `oat`
- `tar-black`

#### 1.2 Add new textures to `texture.component.json`
**File**: `data/mods/descriptors/components/texture.component.json`

Add the following to the `enum` array (alphabetically sorted):
- `felted`
- `oiled`
- `waxed`

---

### Phase 2: Create Clothing Entity Definitions

#### 2.1 Underwear: Wick-Linen Undershirt
**File**: `data/mods/underwear/entities/definitions/wick_linen_undershirt_oat.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `underwear:wick_linen_undershirt_oat` |
| **Layer** | `underwear` |
| **Primary Slot** | `torso_upper` |
| **Secondary Slots** | `left_arm_clothing`, `right_arm_clothing` |
| **Material** | `linen` (coarse linen described in text) |
| **Color** | `descriptors:color_extended` → `oat` |
| **Texture** | `descriptors:texture` → `coarse` |
| **Weight** | ~0.12 kg |

#### 2.2 Base Clothing: Silt-Weave Breeches
**File**: `data/mods/base-clothing/entities/definitions/silt_weave_breeches_clay_umber.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `base-clothing:silt_weave_breeches_clay_umber` |
| **Layer** | `base` |
| **Primary Slot** | `torso_lower` |
| **Material** | `wool` (linen-wool blend described in text) |
| **Color** | `descriptors:color_extended` → `clay-umber` |
| **Texture** | `descriptors:texture` → `coarse` |
| **Weight** | ~0.45 kg |

#### 2.3 Base Clothing: Steward's Waistcoat
**File**: `data/mods/base-clothing/entities/definitions/stewards_waistcoat_moss_felted_wool.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `base-clothing:stewards_waistcoat_moss_felted_wool` |
| **Layer** | `base` |
| **Primary Slot** | `torso_upper` |
| **Material** | `wool` (felted wool) |
| **Color** | `descriptors:color_extended` → `moss` |
| **Texture** | `descriptors:texture` → `felted` |
| **Weight** | ~0.40 kg |

#### 2.4 Outer Clothing: Waxed Oversmock
**File**: `data/mods/outer-clothing/entities/definitions/waxed_oversmock_tar_black.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `outer-clothing:waxed_oversmock_tar_black` |
| **Layer** | `outer` |
| **Primary Slot** | `torso_upper` |
| **Secondary Slots** | `left_arm_clothing`, `right_arm_clothing` |
| **Material** | `canvas` (waxed linen/canvas described in text) |
| **Color** | `descriptors:color_extended` → `tar-black` |
| **Texture** | `descriptors:texture` → `waxed` |
| **Coverage** | `torso_upper` with priority `outer` |
| **Weight** | ~0.65 kg |

#### 2.5 Base Clothing: River-Sole Work Shoes
**File**: `data/mods/base-clothing/entities/definitions/river_sole_work_shoes_iron_brown.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `base-clothing:river_sole_work_shoes_iron_brown` |
| **Layer** | `base` |
| **Primary Slot** | `feet` |
| **Material** | `leather` (oiled leather) |
| **Color** | `descriptors:color_extended` → `iron-brown` |
| **Texture** | `descriptors:texture` → `oiled` |
| **Properties** | `waterproof` |
| **Coverage** | `feet` with priority `base` |
| **Weight** | ~0.85 kg |

#### 2.6 Base Clothing: Oilcloth Finger-Mitts
**File**: `data/mods/base-clothing/entities/definitions/oilcloth_finger_mitts_tar_black.entity.json`

| Property | Value |
|----------|-------|
| **ID** | `base-clothing:oilcloth_finger_mitts_tar_black` |
| **Layer** | `base` |
| **Primary Slot** | `hands` |
| **Material** | `linen` (oilcloth-backed linen described in text) |
| **Color** | `descriptors:color_extended` → `tar-black` |
| **Texture** | `descriptors:texture` → `oiled` |
| **Coverage** | `hands` with priority `base` |
| **Weight** | ~0.10 kg |

---

### Phase 3: Update Recipe File

**File**: `data/mods/dredgers/recipes/toad_folk_male.recipe.json`

Add `clothingEntities` array after the `patterns` array:

```json
"clothingEntities": [
  { "entityId": "underwear:wick_linen_undershirt_oat", "equip": true },
  { "entityId": "base-clothing:silt_weave_breeches_clay_umber", "equip": true },
  { "entityId": "base-clothing:stewards_waistcoat_moss_felted_wool", "equip": true },
  { "entityId": "outer-clothing:waxed_oversmock_tar_black", "equip": true },
  { "entityId": "base-clothing:river_sole_work_shoes_iron_brown", "equip": true },
  { "entityId": "base-clothing:oilcloth_finger_mitts_tar_black", "equip": true }
]
```

---

## Files to Modify

### Existing Files (2)
1. `data/mods/descriptors/components/color_extended.component.json` - Add 5 color values
2. `data/mods/descriptors/components/texture.component.json` - Add 3 texture values

### New Files (6)
1. `data/mods/underwear/entities/definitions/wick_linen_undershirt_oat.entity.json`
2. `data/mods/base-clothing/entities/definitions/silt_weave_breeches_clay_umber.entity.json`
3. `data/mods/base-clothing/entities/definitions/stewards_waistcoat_moss_felted_wool.entity.json`
4. `data/mods/outer-clothing/entities/definitions/waxed_oversmock_tar_black.entity.json`
5. `data/mods/base-clothing/entities/definitions/river_sole_work_shoes_iron_brown.entity.json`
6. `data/mods/base-clothing/entities/definitions/oilcloth_finger_mitts_tar_black.entity.json`

### Recipe Update (1)
7. `data/mods/dredgers/recipes/toad_folk_male.recipe.json` - Add clothingEntities array

---

## Design Notes

### Color Naming Choices
- `oat` - Natural, earthy tone for undyed linen (simpler than "oat-colored")
- `clay-umber` - Earthy brown with clay undertones for breeches
- `moss` - Green-brown for workwear waistcoat (fits marshland/toad theme)
- `tar-black` - Deep black with organic quality for waxed items
- `iron-brown` - Dark utilitarian brown for work shoes

### Texture Reasoning
- `felted` - For wool that's been processed into a dense, smooth material
- `oiled` - For leather/fabric treated with oil for water resistance
- `waxed` - For canvas/linen treated with wax for weatherproofing

### Material Selection (Primary)
The system uses single materials. Blends are described in `core:description`:
- Undershirt: `linen` (coarse linen)
- Breeches: `wool` (linen-wool blend → wool as dominant)
- Waistcoat: `wool` (felted wool)
- Oversmock: `canvas` (waxed linen/canvas → canvas for outerwear)
- Shoes: `leather` (oiled leather)
- Mitts: `linen` (oilcloth-backed linen → linen as base)

### Thematic Consistency
All items reflect a working-class "dredger" aesthetic:
- Practical, utilitarian designs
- Water-resistant treatments (waxed, oiled)
- Earthy, muted colors (oat, clay, moss, tar-black, iron-brown)
- Durable materials suited for manual labor in wet conditions

---

## Full File Specifications

### Underwear: Wick-Linen Undershirt

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "underwear:wick_linen_undershirt_oat",
  "description": "A coarse wick-linen undershirt in oat color with short sleeves",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "linen"
    },
    "core:name": {
      "text": "wick-linen undershirt"
    },
    "core:description": {
      "text": "A simple undershirt of coarse wick-linen in a dull oat color. The rough-woven fabric wicks moisture away from the skin, making it suitable for labor in damp conditions. Short sleeves end above the elbow, and the construction is plain but serviceable—the work of hands accustomed to making garments that last rather than impress."
    },
    "descriptors:color_extended": {
      "color": "oat"
    },
    "descriptors:texture": {
      "texture": "coarse"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.12
    }
  }
}
```

### Base Clothing: Silt-Weave Breeches

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:silt_weave_breeches_clay_umber",
  "description": "Silt-weave breeches in clay-umber linen-wool blend",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "wool"
    },
    "core:name": {
      "text": "silt-weave breeches"
    },
    "core:description": {
      "text": "Sturdy breeches of silt-weave cloth, a blend of linen and wool dyed the clay-umber color of riverbank mud. The weave is dense enough to shed light rain and resist snagging on dock timbers. Wide through the thigh for ease of movement, they taper below the knee where they can be tucked into boots or bound with wraps. The seat and knees show the wear of one who kneels and squats in labor."
    },
    "descriptors:color_extended": {
      "color": "clay-umber"
    },
    "descriptors:texture": {
      "texture": "coarse"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.45
    }
  }
}
```

### Base Clothing: Steward's Waistcoat

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:stewards_waistcoat_moss_felted_wool",
  "description": "A moss-colored felted wool steward's waistcoat",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "wool"
    },
    "core:name": {
      "text": "steward's waistcoat"
    },
    "core:description": {
      "text": "A sleeveless waistcoat of felted wool dyed the dull green of marsh moss. The felting has rendered the fabric dense and water-resistant, ideal for those who work in mist and drizzle. Simple bone buttons secure the front, and small pockets at each hip hold the implements of a working steward—chalk for marking, twine for binding, a stub of pencil for tallying. The garment speaks of modest authority among laborers."
    },
    "descriptors:color_extended": {
      "color": "moss"
    },
    "descriptors:texture": {
      "texture": "felted"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "base"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.40
    }
  }
}
```

### Outer Clothing: Waxed Oversmock

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "outer-clothing:waxed_oversmock_tar_black",
  "description": "A tar-black waxed oversmock of heavy canvas and linen",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "canvas",
      "properties": ["waterproof"]
    },
    "core:name": {
      "text": "waxed oversmock"
    },
    "core:description": {
      "text": "A heavy oversmock of waxed linen and canvas, stained the tar-black of pitch-treated rope. The wax coating sheds rain and river spray, while the loose cut allows for the full range of motion needed when hauling nets or poling barges. The sleeves are long and full, the hem falls to mid-thigh, and the whole garment carries the faint smell of beeswax and tallow that marks a dredger's trade."
    },
    "descriptors:color_extended": {
      "color": "tar-black"
    },
    "descriptors:texture": {
      "texture": "waxed"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "outer"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.65
    }
  }
}
```

### Base Clothing: River-Sole Work Shoes

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:river_sole_work_shoes_iron_brown",
  "description": "Iron-brown oiled leather work shoes with river-sole treads",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["base", "outer"]
    },
    "core:material": {
      "material": "leather",
      "properties": ["waterproof"]
    },
    "core:name": {
      "text": "river-sole work shoes"
    },
    "core:description": {
      "text": "Low-cut work shoes of oiled leather in iron-brown, fitted with thick river-soles designed to grip wet planking and slick stone. The oiling keeps the leather supple and water-resistant, though the finish has gone patchy with use. The soles are scored in a crosshatch pattern for traction, and the stitching is doubled where foot meets sole—a cobbler's concession to the demands of dock labor."
    },
    "descriptors:color_extended": {
      "color": "iron-brown"
    },
    "descriptors:texture": {
      "texture": "oiled"
    },
    "clothing:coverage_mapping": {
      "covers": ["feet"],
      "coveragePriority": "base"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.85
    }
  }
}
```

### Base Clothing: Oilcloth Finger-Mitts

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:oilcloth_finger_mitts_tar_black",
  "description": "Tar-black oilcloth finger-mitts with linen backing",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "hands"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "linen"
    },
    "core:name": {
      "text": "oilcloth finger-mitts"
    },
    "core:description": {
      "text": "Work mitts of tar-black oilcloth backed with sturdy linen, leaving the fingers exposed for dexterity while protecting the palms and backs of the hands from rope burn and splinters. The oilcloth outer layer sheds water and fish slime, and the stitching is reinforced at the stress points where a grip would pull hardest. These are the hands of a dredger—protected where it matters, bare where nimbleness counts."
    },
    "descriptors:color_extended": {
      "color": "tar-black"
    },
    "descriptors:texture": {
      "texture": "oiled"
    },
    "clothing:coverage_mapping": {
      "covers": ["hands"],
      "coveragePriority": "base"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.10
    }
  }
}
```

---

## Implementation Checklist

1. [x] Add new color values to `data/mods/descriptors/components/color_extended.component.json`
2. [x] Add new texture values to `data/mods/descriptors/components/texture.component.json`
3. [x] Create `data/mods/underwear/entities/definitions/wick_linen_undershirt_oat.entity.json`
4. [x] Create `data/mods/base-clothing/entities/definitions/silt_weave_breeches_clay_umber.entity.json`
5. [x] Create `data/mods/base-clothing/entities/definitions/stewards_waistcoat_moss_felted_wool.entity.json`
6. [x] Create `data/mods/outer-clothing/entities/definitions/waxed_oversmock_tar_black.entity.json`
7. [x] Create `data/mods/base-clothing/entities/definitions/river_sole_work_shoes_iron_brown.entity.json`
8. [x] Create `data/mods/base-clothing/entities/definitions/oilcloth_finger_mitts_tar_black.entity.json`
9. [x] Update `data/mods/dredgers/recipes/toad_folk_male.recipe.json` with clothingEntities array
10. [ ] Run validation: `npm run validate`
11. [x] Copy this spec to `specs/toad-folk-workwear-clothing.md`

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2025-12-12 | Initial specification |
| 1.1.0 | 2025-12-12 | Implementation complete |
