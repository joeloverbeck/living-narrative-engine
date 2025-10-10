# Casual Menswear Clothing Items Specification

## Overview

This specification defines three new menswear clothing items to be added to the Living Narrative Engine clothing mod:

1. White cotton-linen trousers
2. Pale-blue button-down Oxford shirt
3. Brown suede loafers

## Analysis Summary

After analyzing the existing clothing definitions in `data/mods/clothing/entities/definitions/`, the following items were confirmed as not existing:

- **White cotton-linen trousers**: While cotton twill trousers and graphite wool wide-leg trousers exist, no white cotton-linen trousers were found
- **Pale-blue button-down Oxford**: While a forest-green cotton-linen button-down exists, no pale-blue Oxford shirt was found
- **Brown suede loafers**: While sand suede chukka boots exist, no loafers were found

## Component Enhancement Proposals

### Material Component Enhancement

**Current State**: The `core:material` component in `data/mods/core/components/material.component.json` includes "leather" but not "suede" as a distinct material type.

**Issue**: The existing `sand_suede_chukka_boots.entity.json` uses "leather" as the material value even though it's described as suede in the name and description. This creates semantic inconsistency.

**Recommendation**: Add `"suede"` to the material enum to properly differentiate suede items from standard leather items.

**Proposed Addition** to `data/mods/core/components/material.component.json`:

```json
"enum": [
  "linen",
  "denim",
  "silk",
  "stretch-silk",
  "leather",
  "suede",  // <-- NEW: Add after "leather"
  "calfskin",
  "wool",
  // ... rest of materials
]
```

**Justification**:
- Suede is a distinct type of leather with different texture, durability, and care requirements
- Allows for future differentiation in material properties (e.g., suede is more delicate, requires different care)
- Improves semantic accuracy in entity definitions
- Existing suede items (like chukka boots) can be updated in future to use the correct material

### Color Component Enhancement

**Current State**: The `descriptors:color_extended` component includes "navy", "deep-navy", "sand-beige", "taupe", "cream", but no "pale-blue" shade.

**Recommendation**: Add `"pale-blue"` to the color_extended enum for the Oxford shirt.

**Proposed Addition** to `data/mods/descriptors/components/color_extended.component.json`:

```json
"enum": [
  "amber",
  "blonde",
  "brunette",
  "nude",
  "raven-black",
  "auburn",
  "silver",
  "cobalt",
  "hazel",
  "violet",
  "navy",
  "deep-navy",
  "pale-blue",  // <-- NEW: Add after "deep-navy"
  "sand-beige",
  // ... rest of colors
]
```

**Justification**:
- "Pale-blue" is a common color for Oxford shirts and casual menswear
- Using just "blue" from color_basic would be too generic
- Provides more accurate color representation for garments

## New Clothing Item Definitions

### 1. White Cotton-Linen Trousers

**File**: `data/mods/clothing/entities/definitions/white_cotton_linen_trousers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:white_cotton_linen_trousers",
  "description": "White cotton-linen trousers",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "legs",
        "secondary": ["torso_lower"]
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "trousers"
    },
    "core:description": {
      "text": "Crisp white trousers crafted from a premium cotton-linen blend. The natural fiber combination offers excellent breathability and a relaxed drape, perfect for warm weather. The clean white color and tailored fit create a sophisticated yet comfortable look suitable for both casual and semi-formal summer occasions."
    },
    "descriptors:color_basic": {
      "color": "white"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    }
  }
}
```

**Design Notes**:
- Material: Uses "cotton" (linen-blend implied in description; cotton is the primary component)
- Equipment: Primary slot "legs", secondary "torso_lower" (following pattern of other trousers)
- Layer: Base layer with underwear/base/outer allowed layers
- Color: Uses "white" from color_basic (direct match)
- Texture: "smooth" to represent the refined fabric finish
- Coverage: Covers torso_lower with base priority (consistent with other trousers)

### 2. Pale-Blue Button-Down Oxford Shirt

**File**: `data/mods/clothing/entities/definitions/pale_blue_oxford_button_down.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:pale_blue_oxford_button_down",
  "description": "Pale-blue Oxford button-down shirt",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "Oxford shirt"
    },
    "core:description": {
      "text": "A classic pale-blue Oxford button-down shirt in premium cotton. The distinctive Oxford weave creates a subtle texture and exceptional durability, while the button-down collar adds a refined casual touch. The soft pale-blue hue offers versatile styling options, working equally well for professional settings or relaxed weekend wear."
    },
    "descriptors:color_extended": {
      "color": "pale-blue"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "base"
    }
  }
}
```

**Design Notes**:
- Material: "cotton" (Oxford cloth is cotton)
- Equipment: Primary "torso_upper", secondary both arm slots (standard pattern for shirts)
- Layer: Base layer with underwear/base/outer allowed
- Color: Uses proposed "pale-blue" from color_extended
- Texture: "smooth" (Oxford weave has subtle texture but still relatively smooth)
- Coverage: Covers torso_upper with base priority

**Dependency**: Requires "pale-blue" to be added to color_extended enum (see Component Enhancement Proposals)

### 3. Brown Suede Loafers

**File**: `data/mods/clothing/entities/definitions/brown_suede_loafers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:brown_suede_loafers",
  "description": "Brown suede loafers",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["base", "outer"]
    },
    "core:material": {
      "material": "suede"
    },
    "core:name": {
      "text": "loafers"
    },
    "core:description": {
      "text": "Elegant brown suede loafers with a slip-on design and subtle moccasin stitching. The soft suede upper provides comfort and sophisticated style, while the cushioned leather sole ensures all-day wearability. These versatile loafers transition seamlessly from casual to smart-casual settings, offering effortless refinement."
    },
    "descriptors:color_basic": {
      "color": "brown"
    },
    "descriptors:texture": {
      "texture": "velvety"
    }
  }
}
```

**Design Notes**:
- Material: Uses proposed "suede" material (see Component Enhancement Proposals)
- Equipment: Primary slot "feet" only (standard for footwear)
- Layer: Base layer with base/outer allowed (no underwear layer for shoes)
- Color: Uses "brown" from color_basic (direct match)
- Texture: "velvety" (matches the texture used for suede chukka boots)
- Coverage: No coverage_mapping (following pattern of other footwear items)

**Dependency**: Requires "suede" to be added to material enum (see Component Enhancement Proposals)

## Implementation Notes

### Component Structure

All three items follow the standard clothing entity pattern with:

- `clothing:wearable`: Defines layer and equipment slots
- `core:material`: Specifies the material (cotton or suede)
- `core:name`: The display name of the item
- `core:description`: Detailed description for immersion
- `descriptors:color_*`: Color descriptor (using existing or proposed enums)
- `descriptors:texture`: Texture property
- `clothing:coverage_mapping`: Body coverage (not included for footwear per existing patterns)

### Equipment Slots

- **White trousers**: `legs` (primary) + `torso_lower` (secondary)
- **Oxford shirt**: `torso_upper` (primary) + `left_arm_clothing`, `right_arm_clothing` (secondary)
- **Loafers**: `feet` (primary only)

**Important**: All torso upper garments must include both left and right arm clothing slots in their secondary equipment slots. This maintains consistency with the existing clothing system and prevents layering conflicts.

### Layer Configuration

- **White trousers**: Can be worn as base or outer layer (over underwear)
- **Oxford shirt**: Can be worn as underwear, base, or outer layer
- **Loafers**: Base or outer layer only (no underwear layer for footwear)

### Coverage Mapping

- **White trousers**: Covers `torso_lower` with base priority
- **Oxford shirt**: Covers `torso_upper` with base priority
- **Loafers**: No coverage mapping (following pattern of other footwear)

### Material and Color Choices

**Materials**:
- Cotton: Appropriate for both trousers and Oxford shirt (natural, breathable fabric)
- Suede (proposed): Accurate for loafers (distinct from smooth leather)

**Colors**:
- White (color_basic): Direct match for trousers
- Pale-blue (proposed color_extended): Specific shade for Oxford shirt
- Brown (color_basic): Standard color for suede loafers

**Textures**:
- Smooth: Used for cotton-linen trousers and Oxford shirt (refined finish)
- Velvety: Used for suede loafers (consistent with existing suede items)

## Validation Requirements

Before implementation, ensure:

1. **Enum Updates Applied**:
   - "suede" added to material enum in `data/mods/core/components/material.component.json`
   - "pale-blue" added to color_extended enum in `data/mods/descriptors/components/color_extended.component.json`

2. **Component Schema Validation**:
   - All component schemas referenced exist and are properly loaded
   - Material types are valid in the updated material enum
   - Color descriptors are valid in their respective enums
   - Equipment slots match the slot system configuration

3. **Entity Definition Validation**:
   - Each entity definition file validates against `entity-definition.schema.json`
   - All component data validates against respective component schemas
   - No duplicate entity IDs exist in the mod

## Testing Considerations

After implementation, test:

1. **Loading and Validation**:
   - Items load without validation errors
   - Schema validation passes for all component data
   - No conflicts with existing entity IDs

2. **Equipment System**:
   - Items can be equipped to appropriate slots
   - Layer conflicts are properly handled
   - Secondary equipment slots function correctly
   - Items can be removed without errors

3. **UI Display**:
   - Items appear correctly in inventory/equipment UI
   - Descriptions display properly in game
   - Names render correctly
   - Colors and textures are represented appropriately

4. **Coverage System**:
   - Coverage mapping works correctly for trousers and shirt
   - Coverage priorities are respected
   - No coverage conflicts with other items

5. **Material and Color**:
   - New enum values (suede, pale-blue) work correctly
   - No validation errors with new enum additions
   - Texture properties display properly

## Future Enhancements

Consider adding:

1. **Material Properties**:
   - Durability values specific to suede vs. leather
   - Care instructions differentiating suede maintenance from leather
   - Material properties like "breathable" for cotton items

2. **Color Variations**:
   - Additional pale shades (pale-pink, pale-yellow) for expanded color palette
   - More suede color options (navy-suede, gray-suede)

3. **Style Variants**:
   - Pleated vs. flat-front trousers
   - Different Oxford collar styles
   - Penny loafer vs. tassel loafer variations

4. **Seasonal Attributes**:
   - Season appropriateness tags (summer-appropriate for white cotton-linen)
   - Weather resistance properties

5. **Update Existing Items**:
   - Migrate `sand_suede_chukka_boots.entity.json` to use "suede" material instead of "leather"
   - Consider other items that might benefit from new enum values

## Implementation Order

Recommended implementation sequence:

1. **Update Component Enums** (prerequisites):
   - Add "suede" to `data/mods/core/components/material.component.json`
   - Add "pale-blue" to `data/mods/descriptors/components/color_extended.component.json`
   - Validate schema changes don't break existing items

2. **Create Entity Definitions**:
   - Create `white_cotton_linen_trousers.entity.json`
   - Create `pale_blue_oxford_button_down.entity.json`
   - Create `brown_suede_loafers.entity.json`

3. **Validation**:
   - Run schema validation on all new files
   - Test loading in development environment
   - Verify equipment and coverage systems work correctly

4. **Testing**:
   - Execute unit tests for entity loading
   - Test integration with equipment system
   - Verify UI display and functionality

## Related Files

- `data/mods/core/components/material.component.json` - Material enum definition
- `data/mods/descriptors/components/color_basic.component.json` - Basic colors
- `data/mods/descriptors/components/color_extended.component.json` - Extended colors
- `data/mods/descriptors/components/texture.component.json` - Texture properties
- `data/mods/clothing/components/wearable.component.json` - Wearable component schema
- `data/mods/clothing/components/coverage_mapping.component.json` - Coverage mapping schema
- Reference: `data/mods/clothing/entities/definitions/forest_green_cotton_linen_button_down.entity.json` - Similar button-down pattern
- Reference: `data/mods/clothing/entities/definitions/graphite_wool_wide_leg_trousers.entity.json` - Similar trousers pattern
- Reference: `data/mods/clothing/entities/definitions/sand_suede_chukka_boots.entity.json` - Existing suede footwear pattern

## Dependencies

**Critical Dependencies**:
- Brown suede loafers require "suede" material enum addition
- Pale-blue Oxford shirt requires "pale-blue" color enum addition

**Optional but Recommended**:
- Consider updating existing suede items to use new "suede" material after implementation
