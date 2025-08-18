# New Clothing Items Addition Specification

> ✅ **IMPLEMENTATION READY**: This specification defines new clothing items to be added to the Living Narrative Engine.  
> This document describes the requirements and implementation guidelines for adding 5 new clothing items and necessary descriptor components.

## Implementation Status

### Current State (As of 2025-01-18)

**REQUIRES PREREQUISITE WORK** - This specification requires creating the missing pattern component before implementing the new clothing items.

#### What Currently Exists:

- Comprehensive clothing system with 19 existing items
- Standardized clothing entity structure with consistent components
- Color descriptor system (`descriptors:color_basic`, `descriptors:color_extended`) - pink NOT currently available
- Texture and material component systems
- Equipment slot and layering architecture
- Layer system: ["underwear", "base", "outer", "accessories"]

#### What This Document Defines:

- Addition of 5 new clothing items with complete specifications
- Extension of color descriptor system to include "pink" (REQUIRED)
- Creation of new pattern descriptor component for decorative elements (REQUIRED)
- Proper integration with existing clothing architecture

### Prerequisites for Implementation

**REQUIRED COMPONENT CREATION:**

- `data/mods/descriptors/components/pattern.component.json` - CREATE new pattern component (DOES NOT EXIST)

**REQUIRED COMPONENT MODIFICATIONS:**

- `data/mods/descriptors/components/color_basic.component.json` - EXTEND with "pink" color (currently missing)

**NEW ENTITY FILES TO CREATE:**

- `data/mods/clothing/entities/definitions/` - Add 5 new clothing entity files

---

## 1. Overview

### 1.1 Feature Summary

This specification defines the addition of 5 new clothing items to the Living Narrative Engine's clothing system:

1. **Pink off-the-shoulder crop top** - Fashionable upper body garment
2. **Pink short flared skirt** - Stylish lower body garment  
3. **White thigh-high socks with pink heart pattern** - Decorative hosiery
4. **White cotton panties** - Basic underwear
5. **White platform sneakers** - Elevated casual footwear

### 1.2 Business Value

- **Content Expansion**: Increases available clothing options for character customization
- **Style Diversity**: Adds trendy, feminine clothing options to complement existing items
- **Pattern System Introduction**: Establishes foundation for future patterned clothing items
- **Player Expression**: Provides additional options for character styling and roleplay

### 1.3 Technical Objectives

- Extend existing clothing system without structural changes
- Add necessary descriptor components for new visual elements
- Maintain consistency with established clothing entity patterns
- Ensure proper integration with equipment and layering systems

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: New Clothing Items

The system SHALL support 5 new clothing items with the following specifications:

**Pink Off-The-Shoulder Crop Top:**
- Equipment Slot: `torso_upper` (primary), `left_arm_clothing`, `right_arm_clothing` (secondary)
- Layer: `base`
- Material: `cotton`
- Colors: Pink (basic), skin-showing design
- Style: Crop top with off-shoulder design

**Pink Short Flared Skirt:**
- Equipment Slot: `torso_lower` (primary)
- Layer: `base`  
- Material: `cotton`
- Colors: Pink (basic)
- Style: Short length with flared silhouette

**White Thigh-High Socks with Pink Heart Pattern:**
- Equipment Slot: `feet` (primary)
- Layer: `underwear`
- Material: `cotton`
- Colors: White (basic) with pink heart pattern
- Style: Thigh-high length with decorative hearts

**White Cotton Panties:**
- Equipment Slot: `torso_lower` (primary)
- Layer: `underwear`
- Material: `cotton`
- Colors: White (basic)
- Style: Basic undergarment

**White Platform Sneakers:**
- Equipment Slot: `feet` (primary)
- Layer: `base`
- Material: `leather` (with platform construction)
- Colors: White (basic)
- Style: Elevated casual sneakers

#### FR-2: Color System Extension

The system SHALL extend the color descriptor system:
- Add "pink" to `descriptors:color_basic` component enum values
- Maintain backward compatibility with existing color usage

#### FR-3: Pattern System Introduction

The system SHALL introduce a new pattern descriptor component:
- Create `descriptors:pattern` component with "heart" pattern value
- Support for solid (no pattern) as default
- Extensible design for future pattern additions

### 2.2 Non-Functional Requirements

#### NFR-1: Consistency

- All new items SHALL follow existing clothing entity structure
- Component usage SHALL be consistent with established patterns
- Naming conventions SHALL match existing clothing items

#### NFR-2: Integration

- New items SHALL integrate properly with existing equipment system
- Layering rules SHALL be respected and enforced
- Material properties SHALL be consistent with existing materials

#### NFR-3: Extensibility

- Pattern system SHALL be designed for future expansion
- Color additions SHALL not break existing functionality
- New items SHALL serve as examples for future clothing additions

### 2.3 Constraints

- Must use existing equipment slot architecture
- Cannot modify core clothing system structure
- Must maintain JSON schema validation compatibility
- Pattern system limited to visual description (no gameplay impact)

## 3. Technical Design

### 3.1 Descriptor Component Extensions

#### 3.1.1 Color Basic Component Extension

**File**: `data/mods/descriptors/components/color_basic.component.json`

**REQUIRED MODIFICATION:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:color_basic",
  "description": "Basic color descriptors",
  "dataSchema": {
    "type": "object",
    "properties": {
      "color": {
        "type": "string",
        "description": "The basic color",
        "enum": [
          "red",
          "blue", 
          "green",
          "yellow",
          "orange",
          "purple",
          "brown",
          "black",
          "white",
          "gray",
          "pink"
        ],
        "default": "black"
      }
    },
    "required": ["color"],
    "additionalProperties": false
  }
}
```

#### 3.1.2 New Pattern Component

**File**: `data/mods/descriptors/components/pattern.component.json`

**NEW COMPONENT:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json", 
  "id": "descriptors:pattern",
  "description": "Pattern and decorative element descriptors for clothing and accessories",
  "dataSchema": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "The pattern or decorative element",
        "enum": [
          "solid",
          "striped", 
          "polka-dot",
          "heart",
          "floral",
          "geometric",
          "plaid",
          "checked"
        ],
        "default": "solid"
      }
    },
    "required": ["pattern"],
    "additionalProperties": false
  }
}
```

### 3.2 Clothing Entity Definitions

#### 3.2.1 Pink Off-The-Shoulder Crop Top

**File**: `data/mods/clothing/entities/definitions/pink_off_shoulder_crop_top.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:pink_off_shoulder_crop_top",
  "description": "Pink off-the-shoulder crop top",
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
      "text": "off-the-shoulder crop top"
    },
    "core:description": {
      "text": "A trendy pink cotton crop top with an off-the-shoulder design that elegantly exposes the shoulders and collarbone. The fitted silhouette accentuates the figure while the cropped length adds a playful, modern touch. Perfect for casual outings or layering with other pieces."
    },
    "descriptors:color_basic": {
      "color": "pink"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.2 Pink Short Flared Skirt

**File**: `data/mods/clothing/entities/definitions/pink_short_flared_skirt.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:pink_short_flared_skirt", 
  "description": "Pink short flared skirt",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["underwear", "base"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "short flared skirt"
    },
    "core:description": {
      "text": "A cute pink cotton skirt with a flared silhouette that creates graceful movement with each step. The short length sits comfortably at mid-thigh, while the flared design adds feminine flair and allows for easy movement. The soft cotton fabric ensures comfort throughout the day."
    },
    "descriptors:color_basic": {
      "color": "pink"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.3 White Thigh-High Socks with Pink Heart Pattern

**File**: `data/mods/clothing/entities/definitions/white_thigh_high_socks_pink_hearts.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:white_thigh_high_socks_pink_hearts",
  "description": "White thigh-high socks with pink heart pattern",
  "components": {
    "clothing:wearable": {
      "layer": "underwear", 
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "thigh-high socks"
    },
    "core:description": {
      "text": "Adorable white cotton thigh-high socks decorated with a delicate pink heart pattern. These soft, stretchy socks extend elegantly up the thighs, featuring cute pink hearts scattered across the white fabric. The comfortable cotton blend provides breathability while the playful heart design adds a touch of sweetness to any outfit."
    },
    "descriptors:color_basic": {
      "color": "white"
    },
    "descriptors:pattern": {
      "pattern": "heart"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.4 White Cotton Panties

**File**: `data/mods/clothing/entities/definitions/white_cotton_panties.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:white_cotton_panties",
  "description": "White cotton panties",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "cotton"
    },
    "core:name": {
      "text": "panties"
    },
    "core:description": {
      "text": "Comfortable white cotton panties with a classic fit. Made from soft, breathable cotton fabric that provides all-day comfort and coverage. The simple, practical design makes these essential everyday undergarments perfect for any occasion."
    },
    "descriptors:color_basic": {
      "color": "white"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.5 White Platform Sneakers

**File**: `data/mods/clothing/entities/definitions/white_platform_sneakers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:white_platform_sneakers",
  "description": "White platform sneakers", 
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["underwear", "base"]
    },
    "core:material": {
      "material": "leather"
    },
    "core:name": {
      "text": "platform sneakers"
    },
    "core:description": {
      "text": "Trendy white leather platform sneakers that add both height and style. The thick platform sole provides extra elevation while maintaining the comfort and versatility of classic sneakers. The clean white leather upper offers a fresh, modern look that pairs well with casual or dressy outfits."
    },
    "descriptors:color_basic": {
      "color": "white"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

## 4. Implementation Guidelines

### 4.1 Phase 1: Descriptor Components

#### Step 1.1: Extend Color Basic Component

**File**: `data/mods/descriptors/components/color_basic.component.json`

- Add "pink" to the enum array in the color property
- Maintain existing default value and schema structure
- Validate schema compliance after modification

#### Step 1.2: Create Pattern Component

**File**: `data/mods/descriptors/components/pattern.component.json`

- Create new component following existing descriptor patterns
- Include extensible enum with initial values including "heart"
- Set "solid" as default for items without patterns
- Ensure component ID follows naming convention: `descriptors:pattern`

### 4.2 Phase 2: Clothing Entity Creation

#### Step 2.1: Create Entity Files

Create 5 new entity definition files in `data/mods/clothing/entities/definitions/`:

1. `pink_off_shoulder_crop_top.entity.json`
2. `pink_short_flared_skirt.entity.json` 
3. `white_thigh_high_socks_pink_hearts.entity.json`
4. `white_cotton_panties.entity.json`
5. `white_platform_sneakers.entity.json`

#### Step 2.2: Component Assignment Guidelines

**Required Components for All Items:**
- `clothing:wearable` - Equipment slots and layering rules
- `core:material` - Material specification
- `core:name` - Display name
- `core:description` - Detailed narrative description
- `descriptors:color_basic` - Primary color
- `descriptors:texture` - Texture properties

**Additional Components:**
- `descriptors:pattern` - Only for items with patterns (heart socks)

#### Step 2.3: Equipment Slot Assignments

**Upper Body Items (Crop Top):**
- Primary: `torso_upper`
- Secondary: `left_arm_clothing`, `right_arm_clothing`
- Layer: `base`

**Lower Body Items (Skirt, Panties):**
- Primary: `torso_lower`
- Layer: `base` (skirt) or `underwear` (panties)

**Foot Items (Socks/Thigh-highs):**
- Primary: `feet` 
- Layer: `underwear`

**Foot Items (Sneakers):**
- Primary: `feet`
- Layer: `base`

### 4.3 Phase 3: Validation and Testing

#### Step 3.1: Schema Validation

- Validate all new entity files against entity definition schema
- Verify component references exist and are properly formatted
- Ensure enum values are valid for all descriptor components

#### Step 3.2: Integration Testing

- Test loading of new entities in game context
- Verify proper equipment slot assignments
- Validate layering rules work correctly
- Check material and color rendering

#### Step 3.3: Content Verification

- Verify item descriptions are appropriate and engaging
- Ensure naming consistency with existing items
- Check that all required components are properly assigned

## 5. Validation & Constraints

### 5.1 Entity Validation Rules

1. **Component Requirements**:
   - All clothing items MUST include required core components
   - Color descriptors MUST use valid enum values
   - Equipment slots MUST exist in the system

2. **Naming Conventions**:
   - Entity IDs: `clothing:{snake_case_name}`
   - File names: `{snake_case_name}.entity.json`
   - Component IDs: `namespace:component_name`

3. **Layer Compatibility**:
   - Underwear layer items can only coexist with base/outer layers
   - Base layer items must allow underwear layer underneath
   - No conflicting equipment slot assignments

### 5.2 Descriptor Component Validation

1. **Color Extension**:
   - "pink" must be added to existing color_basic enum
   - No modification to existing color values
   - Maintain schema structure and validation rules

2. **Pattern Component**:
   - Must follow existing component schema structure
   - Enum values must be lowercase with hyphens for spaces
   - Default value must be included in enum array

### 5.3 Content Quality Standards

1. **Descriptions**:
   - Must be engaging and descriptive (50-150 words)
   - Should include material, fit, and visual details
   - Maintain appropriate tone for game context

2. **Consistency**:
   - Similar items should use similar descriptor patterns
   - Material assignments should be logical and consistent
   - Color/texture combinations should be realistic

## 6. Examples & Usage Patterns

### 6.1 Complete Outfit Combination

The new items can be combined to create a cohesive outfit:

```
Lower Layer (Underwear):
- White cotton panties (torso_lower, underwear)
- White thigh-high socks with pink hearts (feet, underwear)

Upper Layer (Base):
- Pink off-the-shoulder crop top (torso_upper, base)
- Pink short flared skirt (torso_lower, base)
- White platform sneakers (feet, base)
```

### 6.2 Layering Compatibility

**Valid Combinations:**
- Panties (underwear) + Skirt (base) = ✅ Compatible layers
- Socks (underwear) + Sneakers (base) = ✅ Different equipment slots
- Crop top (base) + Any underwear layer = ✅ Compatible layers

**Invalid Combinations:**
- Two base layer items on same equipment slot = ❌ Layer conflict
- Underwear over base layer = ❌ Layer ordering violation

### 6.3 Component Usage Examples

**Basic Color Usage:**
```json
"descriptors:color_basic": {
  "color": "pink"
}
```

**Pattern Usage (New):**
```json
"descriptors:pattern": {
  "pattern": "heart" 
}
```

**Material Consistency:**
```json
"core:material": {
  "material": "cotton"
}
```

## 7. Migration & Rollout

### 7.1 Rollout Strategy

1. **Phase 1**: Add pattern component and extend color component
2. **Phase 2**: Create and validate new clothing entity files
3. **Phase 3**: Test integration and loading functionality
4. **Phase 4**: Document new items in game content guides

### 7.2 No Migration Required

- All additions are new content, no existing content modified
- Color extension is backward compatible
- New pattern component is optional for existing items

### 7.3 Testing Checklist

- [ ] Pattern component loads correctly
- [ ] Color basic component accepts "pink" value
- [ ] All 5 clothing entities load without errors
- [ ] Equipment slots assign properly
- [ ] Layer combinations work as specified
- [ ] Schema validation passes for all new files
- [ ] Item descriptions render properly in game
- [ ] No conflicts with existing clothing items
- [ ] Complete outfit can be equipped simultaneously

## 8. Future Enhancements

### 8.1 Pattern System Expansion

The new pattern component enables future additions:

1. **Additional Patterns**: stripes, polka-dots, florals, geometric designs
2. **Color Coordination**: Pattern colors that complement base colors  
3. **Seasonal Patterns**: Holiday-themed or seasonal decorative elements
4. **Cultural Patterns**: Traditional or cultural design elements

### 8.2 Clothing System Extensions

1. **Style Categories**: Casual, formal, athletic, vintage classifications
2. **Seasonal Appropriateness**: Temperature and weather suitability
3. **Material Properties**: Breathability, durability, care instructions
4. **Size Variations**: Different fits and size options

### 8.3 Integration Opportunities

1. **Character Preferences**: NPCs with clothing style preferences
2. **Social Contexts**: Appropriate clothing for different situations
3. **Economic System**: Pricing based on materials and construction
4. **Crafting System**: Player-created clothing variations

## 9. Success Criteria

The implementation will be considered successful when:

1. **Functionality**:
   - All 5 clothing items load and render correctly
   - Pattern component works with heart pattern on socks
   - Pink color displays properly in game interface
   - Equipment and layering systems work as specified

2. **Integration**:
   - New items integrate seamlessly with existing clothing system
   - No performance degradation with additional items
   - Schema validation passes for all new components and entities

3. **Quality**:
   - Item descriptions are engaging and appropriate
   - Visual consistency maintained with existing items
   - No conflicts or compatibility issues detected

4. **Documentation**:
   - All new components properly documented
   - Implementation guidelines are clear and complete
   - Testing procedures validate all requirements

## 10. Appendices

### Appendix A: Equipment Slot Reference

**Available Equipment Slots Used:**
- `torso_upper` - Upper torso coverage (crop top)
- `torso_lower` - Lower torso coverage (skirt, panties) 
- `feet` - Foot coverage (platform sneakers, thigh-high socks)
- `left_arm_clothing`, `right_arm_clothing` - Arm coverage (crop top secondary)

### Appendix B: Layer System Reference

**Layer Hierarchy (bottom to top):**
1. `underwear` - Base undergarments (panties, socks)
2. `base` - Primary clothing layer (crop top, skirt, sneakers)
3. `outer` - Outer garments (jackets, coats) - not used in this spec
4. `accessories` - Decorative accessories (belts, jewelry) - not used in this spec

### Appendix C: Material Reference

**Materials Used in New Items:**
- `cotton` - Natural fiber, breathable, comfortable (tops, bottoms, socks, underwear)
- `leather` - Durable material for footwear (platform sneakers)

### Appendix D: Component Schema Dependencies

**Required Schema Files:**
- `schema://living-narrative-engine/entity-definition.schema.json`
- `schema://living-narrative-engine/component.schema.json`

**Component Dependencies:**
- `clothing:wearable` - Existing clothing system component
- `core:material` - Existing material component
- `core:name` - Existing name component  
- `core:description` - Existing description component
- `descriptors:color_basic` - Modified existing component
- `descriptors:texture` - Existing texture component
- `descriptors:pattern` - New component created by this spec

---

**Document Version**: 1.0.0  
**Date**: 2025-01-18  
**Status**: REQUIRES PREREQUISITE WORK  
**Implementation Status**: Specification Complete - Pattern Component Creation Required  
**Author**: System Architecture Team