# New Clothing Items Specification

## Overview

This specification defines three new clothing items to be added to the Living Narrative Engine clothing mod:

1. Navy-blue cotton tank top
2. Cotton twill trousers
3. Leather slippers

## Analysis Summary

After analyzing the existing clothing definitions in `data/mods/clothing/entities/definitions/`, the following items were confirmed as not existing:

- **Tank tops**: No tank tops found (only t-shirts, crop tops, camisoles)
- **Cotton twill trousers**: While cotton chinos exist with twill mentioned in description, no dedicated cotton twill trousers
- **Slippers**: No slippers found (only shoes, boots, sneakers, pumps, etc.)

## Color Descriptor Requirement

**Note**: The color "navy-blue" is not currently in the `descriptors:color_extended` enum. The existing options include "navy" and "deep-navy". For this specification, we'll use "navy" but recommend adding "navy-blue" to the enum if a more specific shade is desired.

## New Clothing Item Definitions

### 1. Navy-Blue Cotton Tank Top

**File**: `data/mods/clothing/entities/definitions/navy_cotton_tank_top.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:navy_cotton_tank_top",
  "description": "Navy cotton tank top",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "tank top"
    },
    "core:description": {
      "text": "A classic navy-blue cotton tank top with a relaxed fit. The sleeveless design offers maximum breathability and freedom of movement, perfect for warm weather or layering. The soft cotton fabric feels comfortable against the skin, while the deep navy color provides versatile styling options."
    },
    "descriptors:color_extended": {
      "color": "navy"
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

### 2. Cotton Twill Trousers

**File**: `data/mods/clothing/entities/definitions/cotton_twill_trousers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:cotton_twill_trousers",
  "description": "Cotton twill trousers",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "legs"
      },
      "allowedLayers": ["base", "outer"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "twill trousers"
    },
    "core:description": {
      "text": "Classic cotton twill trousers with a straight-leg cut and comfortable mid-rise waist. The distinctive diagonal weave pattern of the twill fabric provides excellent durability and a subtle textural interest. These versatile trousers feature a timeless design suitable for both casual and semi-formal occasions."
    },
    "descriptors:color_basic": {
      "color": "brown"
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

### 3. Leather Slippers

**File**: `data/mods/clothing/entities/definitions/leather_slippers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:leather_slippers",
  "description": "Leather slippers",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["base"]
    },
    "core:material": {
      "material": "leather"
    },
    "core:name": {
      "text": "slippers"
    },
    "core:description": {
      "text": "Comfortable leather slippers with a soft, flexible sole. The supple leather upper molds to the foot for a personalized fit, while the cushioned insole provides all-day comfort. Perfect for relaxed indoor wear or casual outdoor errands, these slippers combine practicality with understated elegance."
    },
    "descriptors:color_basic": {
      "color": "brown"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

## Implementation Notes

### Component Structure

All three items follow the standard clothing entity pattern with:

- `clothing:wearable`: Defines layer and equipment slots
- `core:material`: Specifies the material (cotton or leather)
- `core:name`: The display name of the item
- `core:description`: Detailed description for immersion
- `descriptors:color_*`: Color descriptor (using existing enums)
- `descriptors:texture`: Texture property
- `clothing:coverage_mapping`: Body coverage (not included for footwear as per existing patterns)

**Important**: All torso upper garments (including sleeveless ones like tank tops) must include both left and right arm clothing slots in their equipment slots configuration. This maintains consistency with the existing clothing system and prevents layering conflicts. Even though tank tops don't physically cover the arms, they occupy these slots for proper equipment management.

### Equipment Slots

- **Tank top**: `torso_upper` (primary) + `left_arm_clothing`, `right_arm_clothing` (secondary) - follows standard torso upper garment pattern
- **Trousers**: `legs`
- **Slippers**: `feet`

### Layer Configuration

- **Tank top**: Can be worn as underwear or base layer
- **Trousers**: Can be worn as base or outer layer
- **Slippers**: Base layer only

### Coverage Mapping

- **Tank top**: Covers `torso_upper` with base priority
- **Trousers**: Covers `torso_lower` with base priority
- **Slippers**: No coverage mapping (following pattern of other footwear)

## Validation Requirements

Before implementation, ensure:

1. All component schemas referenced exist and are properly loaded
2. The material types (cotton, leather) are valid in the material enum
3. The color descriptors used are valid in their respective enums
4. The equipment slots match the slot system configuration

## Testing Considerations

After implementation, test:

1. Items can be loaded without validation errors
2. Items can be equipped to appropriate slots
3. Layer conflicts are properly handled
4. Items appear correctly in the UI
5. Descriptions display properly in game

## Future Enhancements

Consider adding:

1. More color variations (add "navy-blue" to color_extended enum)
2. Size variants if sizing system is implemented
3. Durability values for the material component
4. Care instructions for material maintenance gameplay
5. Additional properties like breathability for the tank top
