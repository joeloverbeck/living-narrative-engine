# Clothing and Descriptors Reference Guide

This comprehensive reference document details all descriptor components and clothing slots available in the Living Narrative Engine's anatomy system. It serves as a guide for adding clothing and descriptors to character recipes.

## Table of Contents

1. [Descriptor Components](#descriptor-components)
2. [Clothing Slot System](#clothing-slot-system)
3. [Usage Examples](#usage-examples)

---

## Descriptor Components

The descriptor system provides 14 components for describing physical attributes and characteristics. Each component has predefined values to ensure consistency across the game.

### 1. Texture Component (`descriptors:texture`)

Describes the surface texture of an object.

- **Values**: `smooth`, `rough`, `silky`, `coarse`, `bumpy`, `velvety`, `rib-knit`, `rugged`
- **Default**: `smooth`

### 2. Size Specific Component (`descriptors:size_specific`)

Context-specific size descriptors (e.g., cup sizes for anatomy).

- **Values**: Any string value (not enum-restricted)
- **Example**: `"G-cup"`, `"D-cup"`, etc.

### 3. Size Category Component (`descriptors:size_category`)

General size categories applicable to various objects and features.

- **Values**: `tiny`, `small`, `medium`, `large`, `huge`, `massive`
- **Default**: `medium`

### 4. Shape General Component (`descriptors:shape_general`)

General shape descriptors applicable to various objects.

- **Values**: `round`, `square`, `oval`, `elongated`, `angular`, `curved`
- **Default**: `round`

### 5. Shape Eye Component (`descriptors:shape_eye`)

Eye-specific shape descriptors.

- **Values**: `round`, `almond`, `hooded`, `monolid`, `downturned`, `upturned`
- **Default**: `round`

### 6. Weight Feel Component (`descriptors:weight_feel`)

Describes the perceived weight or density of an object.

- **Values**: `light`, `moderate`, `heavy`, `meaty`, `full`, `hollow`
- **Default**: `moderate`

### 7. Length Hair Component (`descriptors:length_hair`)

Hair-specific length descriptors.

- **Values**: `bald`, `buzz`, `short`, `medium`, `long`, `very-long`
- **Default**: `medium`

### 8. Length Category Component (`descriptors:length_category`)

General length categories applicable to various features.

- **Values**: `very-short`, `short`, `average`, `long`, `very-long`
- **Default**: `average`

### 9. Hair Style Component (`descriptors:hair_style`)

Hair style descriptors.

- **Values**: `straight`, `wavy`, `curly`, `kinky`, `braided`, `ponytail`, `ponytails`, `bun`, `dreadlocks`, `mohawk`
- **Default**: `straight`

### 10. Firmness Component (`descriptors:firmness`)

Describes the firmness or rigidity of an object or body part.

- **Values**: `soft`, `pliant`, `firm`, `hard`, `rigid`
- **Default**: `firm`

### 11. Color Extended Component (`descriptors:color_extended`)

Extended color descriptors including shades and special colors.

- **Values**: `amber`, `blonde`, `brunette`, `nude`, `raven-black`, `auburn`, `silver`, `cobalt`, `hazel`, `violet`, `navy`, `deep-navy`, `sand-beige`, `indigo`
- **Default**: `raven-black`

### 12. Color Basic Component (`descriptors:color_basic`)

Basic color descriptors.

- **Values**: `red`, `blue`, `green`, `yellow`, `orange`, `purple`, `brown`, `black`, `white`, `gray`
- **Default**: `black`

### 13. Build Component (`descriptors:build`)

Body build descriptors for physique and muscle tone.

- **Values**: `skinny`, `slim`, `toned`, `athletic`, `shapely`, `thick`, `muscular`, `stocky`
- **Default**: `average`
- **Note**: The default value "average" is not included in the enum values - this may cause validation issues and should be addressed

### 14. Projection Component (`descriptors:projection`)

Describes the projection characteristics of a surface or object.

- **Values**: `flat`, `bubbly`, `shelf`
- **Default**: `flat`

---

## Clothing System Architecture

The Living Narrative Engine's clothing system is built on a modular architecture that separates slot definitions from blueprint implementations. This allows for flexible reuse and customization while maintaining consistency.

### System Components

#### 1. Slot Library System
The clothing system uses a centralized slot library (`anatomy:humanoid_slots`) that defines standard slot and clothing definitions. This library contains:
- **slotDefinitions**: Standard anatomy slots (head, arm, leg, etc.)
- **clothingDefinitions**: Standard clothing slots with layer restrictions

#### 2. Blueprint Integration
Blueprints (`human_female`, `human_male`) compose slots from the humanoid_core part, which references the slot library. They can also override or add specific slots and clothing mappings.

#### 3. Clothing Entities
Individual clothing items are entities with components that define:
- **clothing:wearable**: Equipment slots, layers, and restrictions
- **descriptors**: Color, texture, and other physical properties
- **core components**: Name, description, material

### Clothing Entity Structure

Clothing entities follow this structure:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:item_name",
  "description": "Item description",
  "components": {
    "clothing:wearable": {
      "layer": "underwear|base|outer|armor|accessory",
      "equipmentSlots": {
        "primary": "slot_name"
      },
      "allowedLayers": ["layer1", "layer2"]
    },
    "core:material": {
      "material": "material_type"
    },
    "core:name": {
      "text": "Display name"
    },
    "core:description": {
      "text": "Detailed description"
    },
    "descriptors:color_extended": {
      "color": "color_value"
    }
  }
}
```

## Clothing Slot System

The clothing system uses a slot-based approach where clothing items can be equipped to specific slots. Each slot has allowed clothing layers and maps to either blueprint slots or anatomy sockets.

### Clothing Layers

The system supports five clothing layers:

1. **underwear** - Base layer undergarments
2. **base** - Primary clothing layer
3. **outer** - Outer garments (jackets, coats)
4. **armor** - Protective gear
5. **accessory** - Accessories and decorative items

### Available Clothing Slots

#### Head and Face Slots

##### `head_gear`

- **Maps to**: Blueprint slot `head`
- **Allowed layers**: `base`, `outer`, `armor`
- **Usage**: Hats, helmets, headbands

##### `face_gear`

- **Maps to**: Blueprint slot `head`
- **Allowed layers**: `accessory`
- **Usage**: Masks, glasses, face accessories

#### Upper Body Slots

##### `torso_upper`

- **Maps to**: 
  - Female: Anatomy sockets `left_breast`, `right_breast`, `left_chest`, `right_chest`, `chest_center`, `left_shoulder`, `right_shoulder`
  - Male: Blueprint slot `torso` only
- **Allowed layers**: `underwear`, `base`, `outer`, `armor`
- **Usage**: Shirts, bras, chest armor, jackets

##### `left_arm_clothing`

- **Maps to**: Blueprint slot `left_arm`
- **Allowed layers**: 
  - Humanoid core library: `base`, `outer`, `armor`
  - Female/male blueprints: `base`, `outer` only
- **Usage**: Sleeves, arm guards

##### `right_arm_clothing`

- **Maps to**: Blueprint slot `right_arm`
- **Allowed layers**: 
  - Humanoid core library: `base`, `outer`, `armor`
  - Female/male blueprints: `base`, `outer` only
- **Usage**: Sleeves, arm guards

##### `hands`

- **Maps to**: Blueprint slots `left_hand`, `right_hand`
- **Allowed layers**: 
  - Humanoid core library: `base`, `armor`
  - Female/male blueprints: `base`, `armor`
- **Usage**: Gloves, gauntlets

##### `back_accessory`

- **Maps to**: Anatomy sockets `upper_back`, `lower_back`
- **Allowed layers**: `accessory`, `armor`
- **Usage**: Capes, backpacks, back armor

#### Lower Body Slots

##### `torso_lower`

- **Maps to**: 
  - Female: Anatomy sockets `left_hip`, `right_hip`, `pubic_hair`, `vagina`
  - Male: Anatomy sockets `left_hip`, `right_hip`, `pubic_hair`, `penis`, `left_testicle`, `right_testicle`
- **Allowed layers**: `underwear`, `base`, `outer`
- **Usage**: Underwear, pants waistband, belts

##### `legs`

- **Maps to**: Blueprint slots `left_leg`, `right_leg`
- **Allowed layers**: 
  - Humanoid core library: `underwear`, `base`, `outer`, `armor`
  - Female/male blueprints: `base`, `outer` only
- **Usage**: Pants, skirts, leg armor

##### `feet`

- **Maps to**: Blueprint slots `left_foot`, `right_foot`
- **Allowed layers**: 
  - Humanoid core library: `base`, `armor`
  - Female/male blueprints: `base`, `outer`
- **Usage**: Shoes, boots, foot armor

#### Full Body Slot

##### `full_body`

- **Maps to**: Blueprint slots (varies by gender):
  - Female: `head`, `left_arm`, `right_arm`, `left_leg`, `right_leg`, `left_breast`, `right_breast`
  - Male: `head`, `left_arm`, `right_arm`, `left_leg`, `right_leg`
- **Allowed layers**: `outer`
- **Usage**: Dresses, robes, full body suits

---

## Usage Examples

### Character Recipe Structure

Character recipes use the following structure to define anatomy and clothing:

```json
{
  "$schema": "http://example.com/schemas/anatomy.recipe.schema.json",
  "recipeId": "mod_id:character_name_recipe",
  "blueprintId": "anatomy:human_female",
  "slots": {
    // Individual slot definitions
  },
  "patterns": [
    // Pattern-based slot definitions
  ],
  "clothingEntities": [
    // Clothing items to equip
  ]
}
```

### Adding Descriptors to Body Parts

Descriptors are added to body parts through the `properties` field in slot definitions:

```json
"slots": {
  "head": {
    "partType": "head",
    "preferId": "anatomy:humanoid_head"
  },
  "left_eye": {
    "partType": "eye",
    "properties": {
      "descriptors:color_extended": {
        "color": "amber"
      },
      "descriptors:shape_eye": {
        "shape": "almond"
      }
    }
  }
}
```

### Pattern-Based Definitions

Use patterns to apply the same configuration to multiple slots:

```json
"patterns": [
  {
    "matches": ["left_breast", "right_breast"],
    "partType": "breast",
    "properties": {
      "descriptors:size_specific": {
        "size": "G-cup"
      },
      "descriptors:weight_feel": {
        "weight": "meaty"
      },
      "descriptors:firmness": {
        "firmness": "soft"
      }
    }
  }
]
```

### Clothing Entity Definition Example

Here's a complete example of a clothing entity definition:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:underwired_plunge_bra_nude_silk",
  "description": "Luxurious underwired plunge bra in nude silk",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "silk"
    },
    "core:name": {
      "text": "underwired plunge bra"
    },
    "core:description": {
      "text": "A luxurious underwired plunge bra crafted from the finest nude silk, designed to enhance and support while maintaining elegance and comfort. The plunge design creates an alluring silhouette while the underwire provides perfect support and lift."
    },
    "descriptors:color_extended": {
      "color": "nude"
    }
  }
}
```

### Adding Clothing to Characters

Clothing is added through the `clothingEntities` array:

```json
"clothingEntities": [
  {
    "entityId": "clothing:underwired_plunge_bra_nude_silk",
    "equip": true
  },
  {
    "entityId": "clothing:nude_thong",
    "equip": true
  },
  {
    "entityId": "clothing:black_stretch_silk_bodysuit",
    "equip": true
  },
  {
    "entityId": "clothing:white_structured_linen_blazer",
    "equip": true
  },
  {
    "entityId": "clothing:graphite_wool_wide_leg_trousers",
    "equip": true
  },
  {
    "entityId": "clothing:black_calfskin_belt",
    "equip": true
  },
  {
    "entityId": "clothing:leather_stiletto_pumps",
    "equip": true
  }
]
```

### Complete Example (Amaia Castillo)

Here's a condensed example showing how descriptors and clothing work together:

```json
{
  "$schema": "http://example.com/schemas/anatomy.recipe.schema.json",
  "recipeId": "p_erotica:amaia_castillo_recipe",
  "blueprintId": "anatomy:human_female",
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_female_torso",
      "properties": {
        "descriptors:build": {
          "build": "shapely"
        }
      }
    },
    "hair": {
      "partType": "hair",
      "properties": {
        "descriptors:color_extended": {
          "color": "blonde"
        },
        "descriptors:length_hair": {
          "length": "long"
        },
        "descriptors:hair_style": {
          "style": "wavy"
        }
      }
    }
  },
  "patterns": [
    {
      "matches": ["left_breast", "right_breast"],
      "partType": "breast",
      "properties": {
        "descriptors:size_specific": {
          "size": "G-cup"
        },
        "descriptors:weight_feel": {
          "weight": "meaty"
        },
        "descriptors:firmness": {
          "firmness": "soft"
        }
      }
    }
  ],
  "clothingEntities": [
    {
      "entityId": "clothing:underwired_plunge_bra_nude_silk",
      "equip": true
    },
    {
      "entityId": "clothing:white_structured_linen_blazer",
      "equip": true
    }
  ]
}
```

### Important Notes

1. **Entity IDs**: All clothing entity IDs must follow the namespaced format `mod_id:item_name`
2. **Layer Restrictions**: Clothing items must specify appropriate layers that match the slot's allowed layers
3. **Blueprint Compatibility**: Ensure body parts and clothing are compatible with the chosen blueprint (human_female vs human_male)
4. **Descriptor Values**: Always use the exact enum values specified for each descriptor component
5. **Optional Slots**: Some anatomy slots (like pubic_hair) are marked as optional and don't need to be filled

---

## Troubleshooting Common Issues

### Validation Errors

#### Schema Inconsistencies
- **Problem**: Build component default "average" not in enum values
- **Solution**: Use one of the valid enum values (`skinny`, `slim`, `toned`, `athletic`, `shapely`, `thick`, `muscular`, `stocky`) or update the schema

#### Invalid Descriptor Values
- **Problem**: Using colors like "red" in `descriptors:color_extended`
- **Solution**: Use extended color values like `raven-black`, `blonde`, `auburn`, etc. For basic colors, use `descriptors:color_basic`

### Clothing Conflicts

#### Layer Conflicts
- **Problem**: Trying to equip `armor` layer on slots that only allow `base`, `outer`
- **Solution**: Check the blueprint-specific allowed layers. Some slots have different restrictions in humanoid_core vs. gender-specific blueprints

#### Slot Mapping Issues
- **Problem**: Clothing not appearing on correct body parts
- **Solution**: Verify the clothing slot maps to the correct blueprint slots or anatomy sockets for the target gender

### Blueprint Differences

#### Female vs Male Anatomy
- **Problem**: `torso_upper` clothing not fitting correctly
- **Solution**: Female blueprints map to anatomy sockets (breasts, chest), while male blueprints map to blueprint slots (torso)

#### Missing Slots
- **Problem**: Trying to equip clothing to non-existent slots
- **Solution**: Check that the target blueprint includes the required slots. Some slots may only exist in the humanoid_core library

### Performance Considerations

#### Large Clothing Collections
- **Problem**: Too many clothing entities causing performance issues
- **Solution**: Consider clothing categories and limit the number of equipped items per character

#### Complex Descriptor Combinations
- **Problem**: Too many descriptor components on single anatomy parts
- **Solution**: Use only necessary descriptors for the intended visual representation

---

## Summary

This reference provides a complete overview of:

- All 14 descriptor components with their accurate enum values and defaults
- The modular clothing system architecture and slot library pattern
- All available clothing slots with blueprint-specific layer restrictions
- Clothing entity structure and component system
- Practical examples and troubleshooting guidance

Use this guide when creating or modifying character recipes to ensure proper formatting, valid values, and compatibility across the anatomy and clothing systems.
