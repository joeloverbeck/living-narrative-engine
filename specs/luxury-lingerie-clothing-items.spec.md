# Luxury Lingerie and Clothing Items Specification

> ✅ **IMPLEMENTATION READY**: This specification defines new luxury lingerie and clothing items to be added to the Living Narrative Engine.  
> This document describes the requirements and implementation guidelines for adding 5 new clothing items and necessary component extensions.

## Implementation Status

### Current State (As of 2025-01-05)

**REQUIRES COMPONENT EXTENSIONS** - This specification requires extending existing components and creating new clothing items.

#### What Currently Exists:

- Comprehensive clothing system with 27 existing items
- Standardized clothing entity structure with consistent components
- Material system (`core:material`) - supports silk, leather, cotton, wool, denim, nylon, but missing microfiber and satin
- Color descriptor systems (`descriptors:color_basic`, `descriptors:color_extended`) - missing taupe and smoke-black
- Texture system (`descriptors:texture`) - missing matte texture
- Equipment slot and layering architecture
- Layer system: ["underwear", "base", "outer", "accessories"]
- **Existing similar items that should NOT be duplicated:**
  - `nude_thong.entity.json` (silk material)
  - `underwired_plunge_bra_nude_silk.entity.json` (silk material)

#### What This Document Defines:

- Addition of 5 new luxury clothing items with complete specifications
- Extension of material system to include "microfiber" and "satin"
- Extension of color descriptor system to include "taupe" and "smoke-black"
- Extension of texture system to include "matte"
- Proper integration with existing clothing architecture

### Prerequisites for Implementation

**REQUIRED COMPONENT EXTENSIONS:**

- `data/mods/core/components/material.component.json` - EXTEND with "microfiber" and "satin"
- `data/mods/descriptors/components/color_extended.component.json` - EXTEND with "taupe" and "smoke-black"
- `data/mods/descriptors/components/texture.component.json` - EXTEND with "matte"

**NEW ENTITY FILES TO CREATE:**

- `data/mods/clothing/entities/definitions/` - Add 5 new clothing entity files

---

## 1. Overview

### 1.1 Feature Summary

This specification defines the addition of 5 new luxury clothing items to the Living Narrative Engine's clothing system:

1. **Satin cowl neck camisole** - Luxurious upper body undergarment
2. **Seamless plunge bra (microfiber, nude color)** - Modern intimate apparel with different material from existing silk version
3. **High-waisted pencil skirt (black)** - Professional fitted lower body garment
4. **Matte sheer tights (smoke black)** - Sophisticated hosiery
5. **Block-heel slingbacks (leather, taupe)** - Elegant professional footwear

### 1.2 Business Value

- **Luxury Content Expansion**: Adds premium clothing options for sophisticated character styling
- **Material Diversity**: Introduces modern materials (microfiber, satin) for realistic clothing representation
- **Professional Wardrobe**: Provides business and formal clothing options
- **Player Expression**: Enables creation of elegant, professional, and intimate character looks

### 1.3 Technical Objectives

- Extend existing clothing system without structural changes
- Add necessary materials, colors, and textures for authentic representation
- Maintain consistency with established clothing entity patterns
- Ensure proper integration with equipment and layering systems

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: New Clothing Items

The system SHALL support 5 new clothing items with the following specifications:

**Satin Cowl Neck Camisole:**

- Equipment Slot: `torso_upper` (primary)
- Layer: `underwear`
- Material: `satin`
- Colors: Nude (extended)
- Style: Cowl neck design with flowing drape

**Seamless Plunge Bra (Microfiber, Nude Color):**

- Equipment Slot: `torso_upper` (primary)
- Layer: `underwear`
- Material: `microfiber`
- Colors: Nude (extended)
- Style: Seamless construction, plunge design

**High-Waisted Pencil Skirt (Black):**

- Equipment Slot: `torso_lower` (primary)
- Layer: `base`
- Material: `fabric` (structured)
- Colors: Black (basic)
- Style: High-waisted with fitted pencil silhouette

**Matte Sheer Tights (Smoke Black):**

- Equipment Slot: `feet` (primary)
- Layer: `underwear`
- Material: `nylon`
- Colors: Smoke-black (extended)
- Texture: Matte
- Style: Sheer opacity with matte finish

**Block-Heel Slingbacks (Leather, Taupe):**

- Equipment Slot: `feet` (primary)
- Layer: `base`
- Material: `leather`
- Colors: Taupe (extended)
- Style: Slingback design with block heel

#### FR-2: Material System Extension

The system SHALL extend the material system:

- Add "microfiber" to `core:material` component enum values
- Add "satin" to `core:material` component enum values
- Maintain backward compatibility with existing material usage

#### FR-3: Color System Extension

The system SHALL extend the color descriptor system:

- Add "taupe" to `descriptors:color_extended` component enum values
- Add "smoke-black" to `descriptors:color_extended` component enum values
- Maintain backward compatibility with existing color usage

#### FR-4: Texture System Extension

The system SHALL extend the texture descriptor system:

- Add "matte" to `descriptors:texture` component enum values
- Support for existing textures as defaults
- Maintain backward compatibility with existing texture usage

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

- Material/color/texture extensions SHALL be designed for future expansion
- Component additions SHALL not break existing functionality
- New items SHALL serve as examples for future luxury clothing additions

### 2.3 Constraints

- Must use existing equipment slot architecture
- Cannot modify core clothing system structure
- Must maintain JSON schema validation compatibility
- Extensions limited to enum additions (no structural schema changes)

## 3. Technical Design

### 3.1 Component Extensions

#### 3.1.1 Material Component Extension

**File**: `data/mods/core/components/material.component.json`

**REQUIRED MODIFICATION:**

Add to existing enum array:

```json
"enum": [
  "linen",
  "denim",
  "silk",
  "stretch-silk",
  "leather",
  "calfskin",
  "wool",
  "cotton",
  "canvas",
  "steel",
  "iron",
  "wood",
  "glass",
  "plastic",
  "ceramic",
  "stone",
  "fabric",
  "synthetic",
  "nylon",
  "organic",
  "microfiber",
  "satin"
]
```

#### 3.1.2 Color Extended Component Extension

**File**: `data/mods/descriptors/components/color_extended.component.json`

**REQUIRED MODIFICATION:**

Add to existing enum array:

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
  "sand-beige",
  "indigo",
  "taupe",
  "smoke-black"
]
```

#### 3.1.3 Texture Component Extension

**File**: `data/mods/descriptors/components/texture.component.json`

**REQUIRED MODIFICATION:**

Add to existing enum array:

```json
"enum": [
  "smooth",
  "rough",
  "silky",
  "coarse",
  "bumpy",
  "velvety",
  "rib-knit",
  "rugged",
  "scarred",
  "matte"
]
```

### 3.2 Clothing Entity Definitions

#### 3.2.1 Satin Cowl Neck Camisole

**File**: `data/mods/clothing/entities/definitions/satin_cowl_neck_camisole.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:satin_cowl_neck_camisole",
  "description": "Luxurious satin camisole with cowl neckline",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "satin"
    },
    "core:name": {
      "text": "cowl neck camisole"
    },
    "core:description": {
      "text": "An exquisite satin camisole featuring an elegant cowl neckline that drapes gracefully across the décolletage. The luxurious satin fabric has a subtle sheen that catches the light beautifully, while the flowing cowl design creates an alluring silhouette. The adjustable straps and comfortable fit make this piece both seductive and practical for layering or wearing alone."
    },
    "descriptors:color_extended": {
      "color": "nude"
    },
    "descriptors:texture": {
      "texture": "silky"
    }
  }
}
```

#### 3.2.2 Seamless Plunge Bra (Microfiber, Nude)

**File**: `data/mods/clothing/entities/definitions/seamless_plunge_bra_microfiber_nude.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:seamless_plunge_bra_microfiber_nude",
  "description": "Modern seamless plunge bra in nude microfiber",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "microfiber"
    },
    "core:name": {
      "text": "seamless plunge bra"
    },
    "core:description": {
      "text": "A sophisticated seamless plunge bra crafted from ultra-soft microfiber in a flattering nude tone. The seamless construction ensures a smooth silhouette under fitted clothing, while the plunge design creates an alluring low neckline. The microfiber fabric is breathable and moisture-wicking, providing all-day comfort with a barely-there feel. Perfect support and lift with modern style."
    },
    "descriptors:color_extended": {
      "color": "nude"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.3 High-Waisted Pencil Skirt (Black)

**File**: `data/mods/clothing/entities/definitions/high_waisted_pencil_skirt_black.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:high_waisted_pencil_skirt_black",
  "description": "Professional high-waisted pencil skirt in black",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["underwear", "base"]
    },
    "core:material": {
      "material": "fabric"
    },
    "core:name": {
      "text": "high-waisted pencil skirt"
    },
    "core:description": {
      "text": "A sleek black high-waisted pencil skirt that hugs the curves in all the right places. The high waistline creates a flattering silhouette while the fitted pencil cut elongates the legs. Made from a structured fabric blend that maintains its shape throughout the day, this skirt is perfect for professional settings or sophisticated evening occasions. The classic black color ensures versatility and timeless elegance."
    },
    "descriptors:color_basic": {
      "color": "black"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

#### 3.2.4 Matte Sheer Tights (Smoke Black)

**File**: `data/mods/clothing/entities/definitions/matte_sheer_tights_smoke_black.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:matte_sheer_tights_smoke_black",
  "description": "Sophisticated matte sheer tights in smoke black",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["underwear"]
    },
    "core:material": {
      "material": "nylon"
    },
    "core:name": {
      "text": "matte sheer tights"
    },
    "core:description": {
      "text": "Elegant sheer tights in a sophisticated smoke black shade with a matte finish that eliminates unwanted shine. These premium nylon tights provide subtle coverage while maintaining a natural, refined appearance. The matte texture creates a sophisticated look that pairs beautifully with professional attire or evening wear. The sheer construction offers breathability while the smoke black color adds depth and mystery to any outfit."
    },
    "descriptors:color_extended": {
      "color": "smoke-black"
    },
    "descriptors:texture": {
      "texture": "matte"
    }
  }
}
```

#### 3.2.5 Block-Heel Slingbacks (Leather, Taupe)

**File**: `data/mods/clothing/entities/definitions/block_heel_slingbacks_leather_taupe.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:block_heel_slingbacks_leather_taupe",
  "description": "Elegant leather block-heel slingback shoes in taupe",
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
      "text": "block-heel slingbacks"
    },
    "core:description": {
      "text": "Sophisticated taupe leather slingback shoes featuring a stable block heel that combines style with comfort. The rich taupe color is versatile and elegant, complementing both professional and casual ensembles. The slingback design with an adjustable strap ensures a secure fit, while the block heel provides stability and confidence with every step. The premium leather construction promises durability and a polished appearance that elevates any outfit."
    },
    "descriptors:color_extended": {
      "color": "taupe"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

## 4. Implementation Guidelines

### 4.1 Phase 1: Component Extensions

#### Step 1.1: Extend Material Component

**File**: `data/mods/core/components/material.component.json`

- Add "microfiber" and "satin" to the enum array in the material property
- Maintain existing structure and validation rules
- Validate schema compliance after modification

#### Step 1.2: Extend Color Extended Component

**File**: `data/mods/descriptors/components/color_extended.component.json`

- Add "taupe" and "smoke-black" to the enum array in the color property
- Maintain existing default value and schema structure
- Validate schema compliance after modification

#### Step 1.3: Extend Texture Component

**File**: `data/mods/descriptors/components/texture.component.json`

- Add "matte" to the enum array in the texture property
- Maintain existing default value and schema structure
- Validate schema compliance after modification

### 4.2 Phase 2: Clothing Entity Creation

#### Step 2.1: Create Entity Files

Create 5 new entity definition files in `data/mods/clothing/entities/definitions/`:

1. `satin_cowl_neck_camisole.entity.json`
2. `seamless_plunge_bra_microfiber_nude.entity.json`
3. `high_waisted_pencil_skirt_black.entity.json`
4. `matte_sheer_tights_smoke_black.entity.json`
5. `block_heel_slingbacks_leather_taupe.entity.json`

#### Step 2.2: Component Assignment Guidelines

**Required Components for All Items:**

- `clothing:wearable` - Equipment slots and layering rules
- `core:material` - Material specification
- `core:name` - Display name
- `core:description` - Detailed narrative description
- `descriptors:color_basic` OR `descriptors:color_extended` - Primary color
- `descriptors:texture` - Texture properties

**Color Component Selection:**

- Use `descriptors:color_basic` for: black
- Use `descriptors:color_extended` for: nude, taupe, smoke-black

#### Step 2.3: Equipment Slot Assignments

**Upper Body Items (Camisole, Bra):**

- Primary: `torso_upper`
- Layer: `underwear`

**Lower Body Items (Pencil Skirt):**

- Primary: `torso_lower`
- Layer: `base`

**Foot Items (Tights):**

- Primary: `feet`
- Layer: `underwear`

**Foot Items (Slingbacks):**

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

### 5.2 Component Extension Validation

1. **Material Extension**:
   - "microfiber" and "satin" must be added to existing material enum
   - No modification to existing material values
   - Maintain schema structure and validation rules

2. **Color Extension**:
   - "taupe" and "smoke-black" must be added to existing color_extended enum
   - No modification to existing color values
   - Maintain schema structure and validation rules

3. **Texture Extension**:
   - "matte" must be added to existing texture enum
   - No modification to existing texture values
   - Default value must remain unchanged

### 5.3 Content Quality Standards

1. **Descriptions**:
   - Must be engaging and descriptive (100-200 words)
   - Should include material, fit, style, and visual details
   - Maintain sophisticated tone appropriate for luxury items

2. **Consistency**:
   - Similar items should use similar descriptor patterns
   - Material assignments should be logical and realistic
   - Color/texture combinations should be authentic

## 6. Examples & Usage Patterns

### 6.1 Professional Outfit Combination

The new items can be combined to create sophisticated professional looks:

```
Professional Look:
- Seamless plunge bra (microfiber, nude) - torso_upper, underwear
- Matte sheer tights (smoke black) - feet, underwear
- High-waisted pencil skirt (black) - torso_lower, base
- Block-heel slingbacks (taupe) - feet, base
```

### 6.2 Luxurious Intimate Look

```
Intimate/Luxury Look:
- Satin cowl neck camisole (nude) - torso_upper, underwear
- Existing nude thong - torso_lower, underwear
- Matte sheer tights (smoke black) - feet, underwear
```

### 6.3 Layering Compatibility

**Valid Combinations:**

- Underwear layer items + base layer items = ✅ Compatible layers
- Multiple underwear items on different equipment slots = ✅ Different slots
- Base layer items on different equipment slots = ✅ Different slots

**Invalid Combinations:**

- Two base layer items on same equipment slot = ❌ Layer conflict
- Underwear over base layer = ❌ Layer ordering violation

### 6.4 Component Usage Examples

**Extended Color Usage:**

```json
"descriptors:color_extended": {
  "color": "taupe"
}
```

**New Material Usage:**

```json
"core:material": {
  "material": "microfiber"
}
```

**New Texture Usage:**

```json
"descriptors:texture": {
  "texture": "matte"
}
```

## 7. Migration & Rollout

### 7.1 Rollout Strategy

1. **Phase 1**: Extend material, color, and texture components
2. **Phase 2**: Create and validate new clothing entity files
3. **Phase 3**: Test integration and loading functionality
4. **Phase 4**: Document new items in game content guides

### 7.2 No Migration Required

- All additions are new content, no existing content modified
- Component extensions are backward compatible
- All extensions are additive enum values only

### 7.3 Testing Checklist

- [ ] Material component accepts "microfiber" and "satin" values
- [ ] Color extended component accepts "taupe" and "smoke-black" values
- [ ] Texture component accepts "matte" value
- [ ] All 5 clothing entities load without errors
- [ ] Equipment slots assign properly
- [ ] Layer combinations work as specified
- [ ] Schema validation passes for all new/modified files
- [ ] Item descriptions render properly in game
- [ ] No conflicts with existing clothing items
- [ ] Professional outfit combinations can be equipped simultaneously
- [ ] No duplicate functionality with existing nude_thong or underwired_plunge_bra_nude_silk

## 8. Future Enhancements

### 8.1 Material System Expansion

The new materials enable future additions:

1. **Microfiber Items**: Athletic wear, modern undergarments, activewear
2. **Satin Items**: Evening wear, luxury sleepwear, formal accessories
3. **Texture Combinations**: Matte finishes on various materials for sophisticated looks

### 8.2 Professional Wardrobe Expansion

1. **Business Attire**: Blazers, dress pants, professional blouses
2. **Formal Wear**: Evening gowns, cocktail dresses, formal accessories
3. **Luxury Accessories**: Handbags, jewelry, scarves with premium materials

### 8.3 Integration Opportunities

1. **Professional Contexts**: NPCs in business settings, workplace scenarios
2. **Luxury Settings**: High-end establishments, formal events, upscale environments
3. **Character Archetypes**: Business professionals, sophisticated characters, luxury lifestyle roles

## 9. Success Criteria

The implementation will be considered successful when:

1. **Functionality**:
   - All 5 clothing items load and render correctly
   - New materials (microfiber, satin) display properly
   - New colors (taupe, smoke-black) render accurately
   - Matte texture appears correctly in game interface
   - Equipment and layering systems work as specified

2. **Integration**:
   - New items integrate seamlessly with existing clothing system
   - No performance degradation with additional items
   - Schema validation passes for all new/modified components and entities
   - No conflicts with existing similar items (nude thong, silk plunge bra)

3. **Quality**:
   - Item descriptions are engaging, sophisticated, and appropriate
   - Visual consistency maintained with existing luxury items
   - No compatibility issues detected
   - Professional outfit combinations work correctly

4. **Documentation**:
   - All component extensions properly documented
   - Implementation guidelines are clear and complete
   - Testing procedures validate all requirements

## 10. Appendices

### Appendix A: Equipment Slot Reference

**Available Equipment Slots Used:**

- `torso_upper` - Upper torso coverage (camisole, bra)
- `torso_lower` - Lower torso coverage (pencil skirt)
- `feet` - Foot coverage (tights, slingbacks)

### Appendix B: Layer System Reference

**Layer Hierarchy (bottom to top):**

1. `underwear` - Base undergarments (camisole, bra, tights)
2. `base` - Primary clothing layer (pencil skirt, slingbacks)
3. `outer` - Outer garments (jackets, coats) - not used in this spec
4. `accessories` - Decorative accessories (belts, jewelry) - not used in this spec

### Appendix C: Material Reference

**Materials Used in New Items:**

- `satin` - Luxurious fabric with subtle sheen (camisole)
- `microfiber` - Modern synthetic material, soft and breathable (bra)
- `fabric` - Structured material blend (pencil skirt)
- `nylon` - Synthetic material for hosiery (tights)
- `leather` - Durable material for footwear (slingbacks)

### Appendix D: Component Schema Dependencies

**Required Schema Files:**

- `schema://living-narrative-engine/entity-definition.schema.json`
- `schema://living-narrative-engine/component.schema.json`

**Component Dependencies:**

- `clothing:wearable` - Existing clothing system component
- `core:material` - Modified existing component (add microfiber, satin)
- `core:name` - Existing name component
- `core:description` - Existing description component
- `descriptors:color_basic` - Existing basic color component
- `descriptors:color_extended` - Modified existing component (add taupe, smoke-black)
- `descriptors:texture` - Modified existing component (add matte)

### Appendix E: Differentiation from Existing Items

**Avoiding Duplication:**

This specification specifically creates items that complement rather than duplicate existing inventory:

- **New microfiber plunge bra** vs **Existing silk plunge bra**: Different materials (microfiber vs silk) provide different properties and use cases
- **New items fill gaps**: No existing camisoles, pencil skirts, tights, or slingback shoes
- **Material differentiation**: Introduces modern materials (microfiber, satin) alongside existing natural materials
- **Style differentiation**: Professional/luxury focus complements existing casual/basic items

---

**Document Version**: 1.0.0  
**Date**: 2025-01-05  
**Status**: REQUIRES COMPONENT EXTENSIONS  
**Implementation Status**: Specification Complete - Component Extensions Required  
**Author**: Luxury Fashion Design Team
