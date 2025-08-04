# Jon Ureña Clothing Implementation Specification

## Overview

This specification document details the implementation plan for adding clothing items to Jon Ureña's character recipe in the Living Narrative Engine. The character will feature a curated masculine wardrobe consisting of 6 clothing items that require new entity definitions and potential descriptor/material component updates.

## Target Clothing Items

Jon Ureña's wardrobe consists of the following 6 items:

1. **Dark-olive cotton twill chore jacket**
2. **Forest-green cotton-linen button-down**
3. **Charcoal wool T-shirt**
4. **Dark-indigo denim jeans**
5. **Sand-suede chukka boots**
6. **Dark-brown leather belt** _(partially exists - similar item available)_

## System Architecture Analysis

### Current Clothing System Structure

The Living Narrative Engine uses a modular clothing system with the following components:

#### Clothing Layers (4 layers)

- `underwear` - Base layer undergarments
- `base` - Primary clothing layer
- `outer` - Outer garments (jackets, coats)
- `accessories` - Accessories and decorative items

#### Relevant Clothing Slots for Jon Ureña

- `torso_upper` - Shirts, jackets (maps to blueprint slot `torso`, allowed layers: `underwear`, `base`, `outer`, `accessories`)
- `legs` - Pants (maps to blueprint slots `left_leg`, `right_leg`, allowed layers: `base`, `outer`)
- `feet` - Shoes, boots (maps to blueprint slots `left_foot`, `right_foot`, allowed layers: `base`, `outer`)
- `torso_lower` - Belts (maps to anatomy sockets: `left_hip`, `right_hip`, `pubic_hair`, `penis`, `left_testicle`, `right_testicle`, allowed layers: `underwear`, `base`, `outer`)

#### Blueprint Compatibility

Jon Ureña uses `anatomy:human_male` blueprint, which inherits from `anatomy:humanoid_core` and adds male-specific slots:

- `torso_upper` maps to blueprint slot `torso` only
- `torso_lower` maps to male-specific anatomy sockets (hips, genitals)
- Layer restrictions are defined in the blueprint's `clothingSlotMappings`
- Male blueprint adds slots: `penis`, `left_testicle`, `right_testicle`

## Descriptor Component Analysis

### Existing Compatible Descriptors

#### Colors

- ✅ `indigo` (available in `descriptors:color_extended`)
- ✅ `sand-beige` (available in `descriptors:color_extended`)
- ✅ `brown` (available in `descriptors:color_basic`)
- ✅ `gray` (available in `descriptors:color_basic` - can substitute for charcoal)

#### Textures

- ✅ `smooth` (available in `descriptors:texture`)
- ✅ `rugged` (available in `descriptors:texture`)

### Missing Descriptors Requiring New Values

#### Color Descriptors

**Issue**: Several specific colors are not available in existing descriptor components.

**Required New Color Values:**

1. `dark-olive` - Not available in either color component
2. `forest-green` - Not available in either color component
3. `charcoal` - Could use existing `gray` from basic colors
4. `dark-indigo` - Existing `indigo` might suffice, or need darker variant
5. `dark-brown` - Could use existing `brown` from basic colors

**Resolution Strategy:**

- **Option A**: Add new values to `descriptors:color_extended` component
- **Option B**: Use closest existing colors with naming conventions in entity descriptions
- **Recommended**: Option B for immediate implementation, Option A for future enhancement

**Fallback Color Mappings:**

- `dark-olive` → `green` (from `descriptors:color_basic`) - describes as dark olive in text
- `forest-green` → `green` (from `descriptors:color_basic`) - describes as forest green in text
- `charcoal` → `gray` (from `descriptors:color_basic`) - describes as charcoal in text
- `dark-indigo` → `indigo` (existing in `descriptors:color_extended`) - describes as dark indigo in text
- `dark-brown` → `brown` (from `descriptors:color_basic`) - describes as dark brown in text

#### Texture Descriptors

**Issue**: Need to verify if additional textures are required.

**Potential New Texture Values:**

1. `twill` - For cotton twill chore jacket (could use `rugged` or `coarse`)
2. `linen` - For cotton-linen fabric (could use `smooth`)
3. `suede` - For suede boots (not available, might need new texture)

## Material Component Analysis

### Existing Compatible Materials

- ✅ `cotton` (available in `core:material`)
- ✅ `wool` (available in `core:material`)
- ✅ `denim` (available in `core:material`)
- ✅ `leather` (available in `core:material`)

### Missing Materials Requiring New Values

**Required New Material Values:**

1. `cotton-twill` - Specific fabric type for chore jacket
2. `cotton-linen` - Blended fabric for button-down shirt
3. `suede` - Specific leather type for chukka boots

**Resolution Strategy:**

- **Option A**: Add new specific materials to `core:material` component enum
- **Option B**: Use closest existing materials with descriptions clarifying specific types
- **Recommended**: Option B for immediate implementation, Option A for future enhancement

**Fallback Material Mappings:**

- `cotton-twill` → `cotton` (existing material)
- `cotton-linen` → `cotton` (existing material)
- `suede` → `leather` (existing material)

## Clothing Entity Definitions

### 1. Dark-Olive Cotton Twill Chore Jacket

**File**: `data/mods/clothing/entities/definitions/dark_olive_cotton_twill_chore_jacket.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:dark_olive_cotton_twill_chore_jacket",
  "description": "Dark-olive cotton twill chore jacket with utilitarian design",
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
      "material": "cotton"
    },
    "core:name": {
      "text": "chore jacket"
    },
    "core:description": {
      "text": "A classic dark-olive cotton twill chore jacket featuring a boxy, utilitarian cut. This workwear-inspired piece includes chest pockets, side pockets, and sturdy button closures. The dense cotton twill construction provides durability while the earthy olive tone adds versatile color to any outfit."
    },
    "descriptors:color_basic": {
      "color": "green"
    },
    "descriptors:texture": {
      "texture": "rugged"
    }
  }
}
```

### 2. Forest-Green Cotton-Linen Button-Down

**File**: `data/mods/clothing/entities/definitions/forest_green_cotton_linen_button_down.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:forest_green_cotton_linen_button_down",
  "description": "Forest-green cotton-linen button-down shirt",
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
      "text": "button-down shirt"
    },
    "core:description": {
      "text": "A sophisticated forest-green button-down shirt crafted from a premium cotton-linen blend. The natural fiber combination offers breathability and a refined drape, while the deep green hue provides rich, earthy sophistication. Features a classic collar, button placket, and tailored fit."
    },
    "descriptors:color_basic": {
      "color": "green"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

### 3. Charcoal Wool T-Shirt

**File**: `data/mods/clothing/entities/definitions/charcoal_wool_tshirt.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:charcoal_wool_tshirt",
  "description": "Charcoal merino wool T-shirt",
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
      "text": "wool T-shirt"
    },
    "core:description": {
      "text": "A premium charcoal merino wool T-shirt offering exceptional comfort and temperature regulation. The fine merino fibers provide natural odor resistance and moisture-wicking properties, while the charcoal gray color offers versatile styling options. Cut with a modern fit and crew neckline."
    },
    "descriptors:color_basic": {
      "color": "gray"
    },
    "descriptors:texture": {
      "texture": "smooth"
    }
  }
}
```

### 4. Dark-Indigo Denim Jeans

**File**: `data/mods/clothing/entities/definitions/dark_indigo_denim_jeans.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:dark_indigo_denim_jeans",
  "description": "Dark-indigo raw denim jeans",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "legs"
      },
      "allowedLayers": ["base", "outer"]
    },
    "core:material": {
      "material": "denim"
    },
    "core:name": {
      "text": "denim jeans"
    },
    "core:description": {
      "text": "Classic dark-indigo raw denim jeans with a straight-leg cut. These premium jeans feature deep indigo coloring that will develop unique fading patterns over time. The heavyweight denim construction offers durability and structure, while the timeless styling ensures lasting versatility in any wardrobe."
    },
    "descriptors:color_extended": {
      "color": "indigo"
    },
    "descriptors:texture": {
      "texture": "rugged"
    }
  }
}
```

### 5. Sand-Suede Chukka Boots

**File**: `data/mods/clothing/entities/definitions/sand_suede_chukka_boots.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:sand_suede_chukka_boots",
  "description": "Sand-colored suede chukka boots",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["base", "outer"]
    },
    "core:material": {
      "material": "leather"
    },
    "core:name": {
      "text": "chukka boots"
    },
    "core:description": {
      "text": "Sophisticated sand-colored suede chukka boots with a minimalist ankle-high silhouette. The soft suede upper provides comfort and style, while the classic two-eyelet lacing system ensures a secure fit. The neutral sand tone offers versatility for both casual and semi-formal occasions."
    },
    "descriptors:color_extended": {
      "color": "sand-beige"
    },
    "descriptors:texture": {
      "texture": "velvety"
    }
  }
}
```

### 6. Dark-Brown Leather Belt

**File**: `data/mods/clothing/entities/definitions/dark_brown_leather_belt.entity.json`

**Note**: Similar item exists (`black_calfskin_belt`), this is a variation.

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:dark_brown_leather_belt",
  "description": "Dark-brown leather belt with brass buckle",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "core:material": {
      "material": "leather"
    },
    "core:name": {
      "text": "leather belt"
    },
    "core:description": {
      "text": "A handsome dark-brown leather belt crafted from full-grain leather with a polished brass buckle. The rich brown patina develops character over time, while the sturdy construction ensures lasting durability. Features classic stitching details and a versatile width suitable for both casual and dress wear."
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

## Required Component Updates

### 1. Color Extended Component Updates

**File**: `data/mods/descriptors/components/color_extended.component.json`

**Status**: No changes required for immediate implementation (using fallback strategy)

**Optional Future Enhancements (if specific colors desired)**:

```json
"enum": [
  // ... existing colors ...
  "dark-olive",    // OPTIONAL ADDITION
  "forest-green"   // OPTIONAL ADDITION
]
```

### 2. Material Component Updates

**File**: `data/mods/core/components/material.component.json`

**Status**: No changes required for immediate implementation (using fallback strategy)

**Optional Future Enhancements (if specific materials desired)**:

```json
"enum": [
  // ... existing materials ...
  "cotton-twill",   // OPTIONAL ADDITION
  "cotton-linen",   // OPTIONAL ADDITION
  "suede"           // OPTIONAL ADDITION
]
```

## Character Recipe Structure

### Jon Ureña Recipe Modification

**File**: `.private/data/mods/p_erotica/recipes/jon_urena.recipe.json` (existing file)

**Note**: This recipe file already exists and contains the character's anatomical definitions. The clothing items need to be added to the existing `clothingEntities` array.

**Current clothingEntities Array**: `[]` (empty)

**Required Addition to clothingEntities Array**:

```json
"clothingEntities": [
  {
    "entityId": "clothing:charcoal_wool_tshirt",
    "equip": true
  },
  {
    "entityId": "clothing:forest_green_cotton_linen_button_down",
    "equip": true
  },
  {
    "entityId": "clothing:dark_olive_cotton_twill_chore_jacket",
    "equip": true
  },
  {
    "entityId": "clothing:dark_indigo_denim_jeans",
    "equip": true
  },
  {
    "entityId": "clothing:dark_brown_leather_belt",
    "equip": true
  },
  {
    "entityId": "clothing:sand_suede_chukka_boots",
    "equip": true
  }
]
```

## Implementation Roadmap

### Phase 1: Clothing Entity Creation (Primary Task)

1. **Create 6 new clothing entity files** in `data/mods/clothing/entities/definitions/`
   - Use fallback colors and materials (no component updates required)
   - Validate each entity against schema
   - Test clothing slot compatibility with male blueprint

### Phase 2: Character Recipe Modification

1. **Modify existing recipe file** at `.private/data/mods/p_erotica/recipes/jon_urena.recipe.json`
   - Add clothing entities to empty `clothingEntities` array
   - Validate recipe structure against anatomy recipe schema
   - Test clothing layering (base layer shirts + outer jacket compatibility)

### Phase 3: Integration Testing

1. **Validate all clothing slots** work with `anatomy:human_male` blueprint
2. **Test clothing layer conflicts** (multiple base layer tops)
3. **Verify descriptor rendering** in game descriptions
4. **Test material system integration**

### Phase 4: Optional Enhancements (Future)

1. **Add specific colors** to `descriptors:color_extended` component if desired
2. **Add specific materials** to `core:material` component if desired
3. **Create texture variants** for suede and twill if needed

## Validation Checklist

### Schema Validation

- [ ] All clothing entities validate against entity-definition schema
- [ ] Character recipe validates against anatomy recipe schema
- [ ] Updated components validate against component schema

### System Integration

- [ ] All clothing slots map correctly to male anatomy blueprint
- [ ] Clothing layers are compatible (no conflicts)
- [ ] All descriptor values exist in component definitions
- [ ] All material values exist in material component

### Game Integration

- [ ] Clothing renders correctly in character descriptions
- [ ] Recipe loads without errors
- [ ] All 6 items can be equipped simultaneously
- [ ] Layering system works (T-shirt + button-down + jacket)

## Alternative Implementation Strategies

### Quick Implementation (No Component Updates)

If component updates are not feasible, use existing values:

**Color Substitutions:**

- `dark-olive` → `green` (basic color)
- `forest-green` → `green` (basic color)
- `charcoal` → `gray` (basic color)
- `dark-brown` → `brown` (basic color)

**Material Substitutions:**

- `cotton-twill` → `cotton`
- `cotton-linen` → `cotton`
- `suede` → `leather`

### Gradual Implementation

Implement clothing items in order of complexity:

1. **Simple items first**: Belt, T-shirt, jeans (using existing descriptors)
2. **Medium complexity**: Button-down, boots (minimal new descriptors)
3. **Complex items last**: Chore jacket (requires most new descriptors)

## Dependencies and Prerequisites

### Required Files to Exist

- `anatomy:human_male` blueprint (✅ exists)
- Clothing slot definitions in humanoid_core (✅ exists)
- Base descriptor and material components (✅ exist)

### Required System Components

- ECS entity loading system
- Clothing equipment system
- Recipe processing system
- Descriptor rendering system

## Notes and Considerations

### Design Decisions

1. **Layer Strategy**: Uses proper layering (underwear < base < outer) for realistic clothing stacking
2. **Color Strategy**: Balances accuracy with system constraints
3. **Material Strategy**: Prioritizes specific materials for authenticity
4. **Slot Strategy**: Maximizes use of existing clothing slots

### Potential Issues

1. **Layer Conflicts**: Multiple base layer tops (T-shirt + button-down) may need testing
2. **Male Anatomy Mapping**: Ensure `torso_upper` maps correctly to male blueprint
3. **Descriptor Limitations**: Some colors may need fallback options
4. **Material System**: New materials may affect other game systems

### Future Enhancements

1. **Seasonal Variants**: Different fabric weights for different climates
2. **Wear States**: Clothing that shows wear and aging
3. **Care Instructions**: Using material component care system
4. **Style Variations**: Alternative cuts and fits of same garments

---

## Summary

This specification provides a complete implementation plan for Jon Ureña's 6-item clothing wardrobe, using fallback strategies to work with existing system components. The implementation prioritizes immediate functionality over component modifications, allowing for quick implementation while maintaining system integrity.

**Total Files to Create**: 6 (clothing entities only)
**Total Files to Modify**: 1 (existing recipe file: jon_urena.recipe.json)
**Total Files to Add/Update**: 0 (using fallback colors and materials)
**Estimated Implementation Time**: 1-2 hours including testing and validation
