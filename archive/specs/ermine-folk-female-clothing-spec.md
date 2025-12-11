# Ermine Folk Female Clothing Specification

## Overview

This specification defines the clothing items for the `ermine_folk_female.recipe.json` character recipe. The ermine folk female is described with a refined, elegant aesthetic featuring ivory and pearl-gray tones, wool-silk blends, and formal attire appropriate for a dignified anthropomorphic ermine character.

## Target Recipe

**File**: `data/mods/dredgers/recipes/ermine_folk_female.recipe.json`

The recipe currently has no `clothingEntities` section. This spec will add 6 clothing entities.

## Required Clothing Items

### 1. Ivory High-Neck Gown (base-clothing)

**Entity ID**: `base-clothing:ivory_high_neck_gown_wool_silk`
**File**: `data/mods/base-clothing/entities/definitions/ivory_high_neck_gown_wool_silk.entity.json`

| Property | Value |
|----------|-------|
| Layer | `base` |
| Primary Slot | `torso_upper` |
| Coverage | `torso_upper` |
| Material | `wool` (wool-silk blend described in description) |
| Color | `cream` (closest to ivory - exists in `descriptors:color_extended`) |
| Texture | `silky` |
| Weight | ~0.45 kg |

**Description Notes**:
- High neck / mandarin collar style
- Wool-silk blend fabric for warmth and elegance
- Pale silver piping at the seams (mentioned in description text)
- Formal cut suitable for an ermine folk noble or dignitary

**New Enum Values Needed**:
- **color_extended**: Add `ivory` - distinct from `cream` (more yellow) and `off-white` (less pure)

---

### 2. Ivory Overskirt (base-clothing)

**Entity ID**: `base-clothing:ivory_overskirt_wool_silk`
**File**: `data/mods/base-clothing/entities/definitions/ivory_overskirt_wool_silk.entity.json`

| Property | Value |
|----------|-------|
| Layer | `base` |
| Primary Slot | `torso_lower` |
| Secondary Slots | `legs` (covers the legs) |
| Coverage | `torso_lower`, `legs` |
| Material | `wool` |
| Color | `cream` → `ivory` (after enum addition) |
| Texture | `silky` |
| Weight | ~0.55 kg |

**Description Notes**:
- Flows over the lower body, covering legs
- Wool-silk blend matching the gown
- Worn as an outer layer over the gown
- Elegant drape suitable for formal occasions

---

### 3. Pearl-Gray Short Mantle with Stand Collar (outer-clothing)

**Entity ID**: `outer-clothing:pearl_gray_mantle_stand_collar`
**File**: `data/mods/outer-clothing/entities/definitions/pearl_gray_mantle_stand_collar.entity.json`

| Property | Value |
|----------|-------|
| Layer | `outer` |
| Primary Slot | `torso_upper` |
| Coverage | `torso_upper` |
| Material | `wool` (felted wool described in description) |
| Color | `smoke-gray` (closest existing to pearl-gray) |
| Texture | `soft` (felted texture) |
| Length | N/A (short mantle, no length descriptor needed) |
| Weight | ~0.75 kg |

**Description Notes**:
- Short shoulder mantle (capelet style)
- Stand collar (high collar that frames the neck)
- Felted wool for structure and warmth
- Pearl-gray color (soft gray with slight luminosity)

**New Enum Values Needed**:
- **color_extended**: Add `pearl-gray` - distinct from `smoke-gray` (darker) and existing `pearl-white`
- **texture**: Consider adding `felted` - distinct from `soft` (describes the wool treatment process)

---

### 4. White Elbow-Length Formal Gloves (base-clothing)

**Entity ID**: `base-clothing:white_leather_elbow_gloves`
**File**: `data/mods/base-clothing/entities/definitions/white_leather_elbow_gloves.entity.json`

| Property | Value |
|----------|-------|
| Layer | `base` |
| Primary Slot | `hands` |
| Secondary Slots | `left_arm_clothing`, `right_arm_clothing` |
| Coverage | `hands` |
| Material | `leather` |
| Color | `white` (exists in `descriptors:color_extended`) |
| Texture | `smooth` |
| Weight | ~0.18 kg |

**Description Notes**:
- Formal opera-style gloves
- Elbow-length extending up the forearms
- White leather (soft, fine leather)
- Appropriate for formal occasions

**Design Decision**: Place in `base-clothing` (not accessories) because gloves are typically base layer when they extend up the arms. Accessories gloves (like `goatskin_grip_gloves`) are typically hand-only.

---

### 5. Polished Riding Boots (base-clothing)

**Entity ID**: `base-clothing:polished_riding_boots_smoke_brown`
**File**: `data/mods/base-clothing/entities/definitions/polished_riding_boots_smoke_brown.entity.json`

| Property | Value |
|----------|-------|
| Layer | `base` |
| Primary Slot | `feet` |
| Coverage | `feet` |
| Material | `calfskin` |
| Color | `warm-brown` → `smoke-brown` (needs new enum) |
| Texture | `glossy` (polished leather) |
| Weight | ~0.95 kg |

**Description Notes**:
- Classic riding boot style
- Polished to a high shine
- Calf-leather construction
- Smoke-brown color (warm brown with grayish undertone)

**New Enum Values Needed**:
- **color_extended**: Add `smoke-brown` - distinct from `warm-brown` (more red), `charcoal-brown` (darker)

---

### 6. Ivory Silk Sash with Seal Pouch (accessories)

**Entity ID**: `accessories:ivory_silk_sash_seal_pouch`
**File**: `data/mods/accessories/entities/definitions/ivory_silk_sash_seal_pouch.entity.json`

| Property | Value |
|----------|-------|
| Layer | `accessories` |
| Primary Slot | `torso_lower` |
| Coverage | `torso_lower` |
| Material | `silk` |
| Color | `cream` → `ivory` (after enum addition) |
| Texture | `silky` |
| Weight | ~0.22 kg |

**Description Notes**:
- Woven silk tape sash
- Worn around the waist
- Incorporates a small seal pouch (for carrying official seals or small documents)
- Does NOT have container functionality (purely aesthetic/narrative)
- No blocking rules (unlike belts)

---

## Enum Value Additions Required

### descriptors:color_extended

Add the following values to `data/mods/descriptors/components/color_extended.component.json`:

| Value | Rationale |
|-------|-----------|
| `ivory` | Pure off-white with slight warm yellow undertone, distinct from `cream` (more yellow) and `off-white` (cooler) |
| `pearl-gray` | Soft gray with subtle luminosity, distinct from `smoke-gray` (darker, neutral) |
| `smoke-brown` | Warm brown with grayish undertone, distinct from `warm-brown` and `charcoal-brown` |

### descriptors:texture (Optional)

Consider adding:

| Value | Rationale |
|-------|-----------|
| `felted` | Describes wool that has been processed through felting (matted, dense), distinct from `soft` |

**Decision**: Adding `felted` is OPTIONAL. The existing `soft` texture can adequately describe felted wool for now. Only add if precision is desired.

---

## Files to Create

### New Clothing Entity Files

1. `data/mods/base-clothing/entities/definitions/ivory_high_neck_gown_wool_silk.entity.json`
2. `data/mods/base-clothing/entities/definitions/ivory_overskirt_wool_silk.entity.json`
3. `data/mods/outer-clothing/entities/definitions/pearl_gray_mantle_stand_collar.entity.json`
4. `data/mods/base-clothing/entities/definitions/white_leather_elbow_gloves.entity.json`
5. `data/mods/base-clothing/entities/definitions/polished_riding_boots_smoke_brown.entity.json`
6. `data/mods/accessories/entities/definitions/ivory_silk_sash_seal_pouch.entity.json`

---

## Files to Modify

### 1. Recipe File

**File**: `data/mods/dredgers/recipes/ermine_folk_female.recipe.json`

Add `clothingEntities` array:

```json
"clothingEntities": [
  { "entityId": "base-clothing:ivory_high_neck_gown_wool_silk", "equip": true },
  { "entityId": "base-clothing:ivory_overskirt_wool_silk", "equip": true },
  { "entityId": "outer-clothing:pearl_gray_mantle_stand_collar", "equip": true },
  { "entityId": "base-clothing:white_leather_elbow_gloves", "equip": true },
  { "entityId": "base-clothing:polished_riding_boots_smoke_brown", "equip": true },
  { "entityId": "accessories:ivory_silk_sash_seal_pouch", "equip": true }
]
```

### 2. Descriptor Component

**File**: `data/mods/descriptors/components/color_extended.component.json`

Add to the `enum` array (maintain alphabetical order):
- `ivory` (after `indigo`)
- `pearl-gray` (after `pale-translucent`)
- `smoke-brown` (after `smoke-black`)

### 3. Mod Manifests

**Files to update** (add new entity files to manifest):
- `data/mods/base-clothing/mod-manifest.json` - Add 4 new entity files
- `data/mods/outer-clothing/mod-manifest.json` - Add 1 new entity file
- `data/mods/accessories/mod-manifest.json` - Add 1 new entity file

---

## Entity Definition Templates

### Template: ivory_high_neck_gown_wool_silk.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:ivory_high_neck_gown_wool_silk",
  "description": "Elegant ivory high-neck gown in wool-silk blend",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "base"
    },
    "core:material": {
      "material": "wool"
    },
    "core:name": {
      "text": "ivory high-neck gown"
    },
    "core:description": {
      "text": "An exquisitely tailored gown in ivory-hued wool-silk blend, featuring a high mandarin collar that frames the face with elegant severity. The fabric carries the warmth of fine wool tempered by silk's lustrous drape, pale silver piping tracing each seam with restrained ornamentation. Cut to emphasize a refined silhouette, this formal garment speaks of aristocratic taste and measured dignity—the sort of attire worn at diplomatic functions or court audiences where one must appear both approachable and untouchable."
    },
    "descriptors:color_extended": {
      "color": "ivory"
    },
    "descriptors:texture": {
      "texture": "silky"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.45
    }
  }
}
```

### Template: ivory_overskirt_wool_silk.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:ivory_overskirt_wool_silk",
  "description": "Flowing ivory overskirt in wool-silk blend",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_lower",
        "secondary": ["legs"]
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower", "legs"],
      "coveragePriority": "base"
    },
    "core:material": {
      "material": "wool"
    },
    "core:name": {
      "text": "ivory overskirt"
    },
    "core:description": {
      "text": "A gracefully flowing overskirt in matching ivory wool-silk, designed to layer over formal attire and cascade to the floor in elegant folds. The fabric pools softly with each step, creating movement and visual interest while maintaining the cohesive ivory palette of the ensemble. Silver piping echoes the companion gown, ensuring the pieces read as a unified whole rather than separate garments."
    },
    "descriptors:color_extended": {
      "color": "ivory"
    },
    "descriptors:texture": {
      "texture": "silky"
    },
    "descriptors:length_category": {
      "length": "very-long"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.55
    }
  }
}
```

### Template: pearl_gray_mantle_stand_collar.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "outer-clothing:pearl_gray_mantle_stand_collar",
  "description": "Short pearl-gray mantle with stand collar in felted wool",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "outer"
    },
    "core:material": {
      "material": "wool"
    },
    "core:name": {
      "text": "pearl-gray mantle"
    },
    "core:description": {
      "text": "A distinguished short mantle in pearl-gray felted wool, cut to drape elegantly across the shoulders without obscuring the formal attire beneath. The stand collar rises to frame the neck and jaw, lending an air of composed authority. Dense felted wool provides structure and warmth without bulk, the gray carrying subtle luminosity that catches light like nacre. This is outerwear meant for moments of transition—entering a great hall, stepping onto a balcony, receiving guests—rather than extended outdoor exposure."
    },
    "descriptors:color_extended": {
      "color": "pearl-gray"
    },
    "descriptors:texture": {
      "texture": "soft"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.75
    }
  }
}
```

### Template: white_leather_elbow_gloves.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:white_leather_elbow_gloves",
  "description": "Formal elbow-length white leather gloves",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "hands",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["hands"],
      "coveragePriority": "base"
    },
    "core:material": {
      "material": "leather"
    },
    "core:name": {
      "text": "white elbow gloves"
    },
    "core:description": {
      "text": "Opera-length gloves in supple white leather, extending past the elbow in the formal style favored at courtly functions. The leather is fine-grained and immaculately maintained, soft enough to permit delicate manipulation yet formal enough to signal elevated status. Tiny mother-of-pearl buttons secure the inner wrist, allowing the gloves to be donned and removed without struggling. These are gloves for receiving honored guests, signing treaties, or lifting a wine glass at a state banquet—accessories that transform every gesture into a statement of refined grace."
    },
    "descriptors:color_extended": {
      "color": "white"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.18
    }
  }
}
```

### Template: polished_riding_boots_smoke_brown.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "base-clothing:polished_riding_boots_smoke_brown",
  "description": "Polished smoke-brown calf leather riding boots",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["feet"],
      "coveragePriority": "base"
    },
    "core:material": {
      "material": "calfskin"
    },
    "core:name": {
      "text": "polished riding boots"
    },
    "core:description": {
      "text": "Classic riding boots in smoke-brown calf leather, polished to a mirror shine that reflects ambient light. The warm brown carries a subtle grayish undertone, lending sophistication without severity. Rising to mid-calf, they provide ankle support and protection while remaining elegant enough for formal indoor wear. The soles are thin leather for quiet movement across polished floors, though a slight heel offers proper stirrup purchase should riding actually be required. These are boots that proclaim their wearer equally at home in saddle or salon."
    },
    "descriptors:color_extended": {
      "color": "smoke-brown"
    },
    "descriptors:texture": {
      "texture": "glossy"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.95
    }
  }
}
```

### Template: ivory_silk_sash_seal_pouch.entity.json

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "accessories:ivory_silk_sash_seal_pouch",
  "description": "Woven ivory silk sash with integrated seal pouch",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "accessories"
    },
    "core:material": {
      "material": "silk"
    },
    "core:name": {
      "text": "silk sash with seal pouch"
    },
    "core:description": {
      "text": "A broad sash woven from ivory silk tape, wrapped twice around the waist and secured with a discreet fastening. Integrated into the layered fabric is a small pouch, barely visible, designed to carry an official seal, correspondence, or other items of diplomatic importance. The silk catches light with each movement, its ivory hue complementing formal attire while the hidden pouch ensures readiness for official duties. This is an accessory of quiet authority—understated yet essential for one who may need to authenticate documents or display credentials at a moment's notice."
    },
    "descriptors:color_extended": {
      "color": "ivory"
    },
    "descriptors:texture": {
      "texture": "silky"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 0.22
    }
  }
}
```

---

## Implementation Checklist

1. [ ] Add `ivory`, `pearl-gray`, `smoke-brown` to `descriptors:color_extended` enum
2. [ ] Create `ivory_high_neck_gown_wool_silk.entity.json` in base-clothing
3. [ ] Create `ivory_overskirt_wool_silk.entity.json` in base-clothing
4. [ ] Create `pearl_gray_mantle_stand_collar.entity.json` in outer-clothing
5. [ ] Create `white_leather_elbow_gloves.entity.json` in base-clothing
6. [ ] Create `polished_riding_boots_smoke_brown.entity.json` in base-clothing
7. [ ] Create `ivory_silk_sash_seal_pouch.entity.json` in accessories
8. [ ] Update `base-clothing/mod-manifest.json` with 4 new files
9. [ ] Update `outer-clothing/mod-manifest.json` with 1 new file
10. [ ] Update `accessories/mod-manifest.json` with 1 new file
11. [ ] Add `clothingEntities` array to `ermine_folk_female.recipe.json`
12. [ ] Run validation: `npm run validate`
13. [ ] Run tests to ensure no regressions

---

## Design Rationale

### Color Choices

- **Ivory palette**: Creates cohesive ensemble matching the ermine's winter-white fur described in the recipe's `bodyDescriptors`
- **Pearl-gray accent**: Provides contrast without harshness, complementing the silvery undertones
- **Smoke-brown boots**: Grounds the outfit with earthier tones while remaining elegant

### Material Choices

- **Wool-silk blend**: Provides warmth (important for a cold-weather creature archetype) with elegance
- **Felted wool mantle**: Dense and structured, appropriate for formal outer garment
- **Calfskin boots**: Fine leather appropriate for formal riding/walking

### Layer Strategy

The outfit layers correctly from innermost to outermost:
1. (Implied underwear layer)
2. **Base**: Gown (torso_upper) + Overskirt (torso_lower/legs) + Gloves (hands) + Boots (feet)
3. **Outer**: Mantle (torso_upper)
4. **Accessories**: Sash (torso_lower)

This ensures proper coverage priority and no slot conflicts.

---

## Testing Recommendations

After implementation:

1. **Validation**: Run `npm run validate` to ensure all entities pass schema validation
2. **Integration Test**: Create/update tests in `tests/integration/mods/dredgers/` to verify:
   - Clothing entities can be loaded
   - Recipe correctly references all clothing
   - Clothing can be equipped without conflicts
3. **Visual Verification**: If applicable, verify the character renders correctly with all clothing applied
