# Armor System Integration with Anatomy Analysis

**Date**: 2025-11-12
**Context**: Sword & Sorcery game scenario requiring armor entities (cuirasses, chainmail, plate armor, etc.)
**Status**: Analysis Complete

## Executive Summary

The Living Narrative Engine's anatomy system is **already prepared for armor** as a distinct clothing layer. The infrastructure exists in the anatomy blueprints and slot definitions, but the clothing system needs minimal updates to fully support armor entities. No fundamental changes to the anatomy system are required.

### Key Finding

**Armor can be implemented as a fifth clothing layer** without modifying the core anatomy architecture. The existing layer system (`underwear`, `base`, `outer`, `accessories`) can be extended to include `armor` with minimal changes.

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Armor Layer Discovery](#armor-layer-discovery)
3. [Gap Analysis](#gap-analysis)
4. [Armor vs. Traditional Clothing Layers](#armor-vs-traditional-clothing-layers)
5. [Implementation Requirements](#implementation-requirements)
6. [Armor-Specific Considerations](#armor-specific-considerations)
7. [Example Armor Entities](#example-armor-entities)
8. [Recommendations](#recommendations)
9. [Migration Strategy](#migration-strategy)

---

## Current System Analysis

### Clothing Layer Architecture

The current clothing system uses a four-layer model:

```
Layer Hierarchy (innermost to outermost):
1. underwear  - Undergarments, intimate clothing
2. base       - Regular clothing (shirts, pants, boots)
3. outer      - Outerwear (coats, jackets)
4. accessories - Accessories (jewelry, belts, gloves)
```

**Source**: `data/mods/clothing/components/wearable.component.json:8-12`

### Coverage System

Clothing items can cover additional body regions beyond their primary equipment slot via the `clothing:coverage_mapping` component:

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower", "legs"],
    "coveragePriority": "outer"
  }
}
```

**Coverage Priority Scoring** (from `docs/developers/clothing-coverage-system.md:26-42`):

- `outer`: 100 (highest visibility)
- `base`: 200
- `underwear`: 300
- `accessories`: 350
- `direct`: 400 (fallback)

### Available Equipment Slots

The system provides these clothing slots (from `docs/modding/clothing-items.md:48-58`):

- `torso_upper` - Upper body clothing
- `torso_lower` - Lower torso clothing
- `legs` - Leg clothing
- `feet` - Footwear
- `head_gear` - Head accessories
- `hands` - Hand clothing
- `left_arm_clothing` - Left arm specific
- `right_arm_clothing` - Right arm specific

---

## Armor Layer Discovery

### Anatomy System Already Supports Armor

**Critical Discovery**: The anatomy system has **already defined "armor" as a layer** in multiple locations:

#### 1. Slot Metadata Component

`data/mods/clothing/components/slot_metadata.component.json:29`:

```json
"allowedLayers": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": ["underwear", "base", "outer", "accessory", "armor"]
  }
}
```

#### 2. Humanoid Slot Library

`data/mods/anatomy/libraries/humanoid.slot-library.json` defines armor in **all major clothing slots**:

| Slot Definition           | Allowed Layers                            | Line |
| ------------------------- | ----------------------------------------- | ---- |
| `standard_head_gear`      | `["base", "outer", "armor"]`              | 117  |
| `standard_torso_upper`    | `["underwear", "base", "outer", "armor"]` | 133  |
| `standard_arm_clothing`   | `["base", "outer", "armor"]`              | 137  |
| `standard_hands`          | `["base", "armor"]`                       | 141  |
| `standard_legs`           | `["underwear", "base", "outer", "armor"]` | 145  |
| `standard_feet`           | `["base", "armor"]`                       | 149  |
| `standard_torso_lower`    | `["underwear", "base", "outer", "armor"]` | 166  |
| `standard_back_accessory` | `["accessory", "armor"]`                  | 170  |

#### 3. Anatomy Blueprints

All major humanoid and non-human blueprints include armor layer support:

**Blueprints with Armor Layer**:

- `human_male.blueprint.json` (lines 37, 65)
- `human_female.blueprint.json` (lines 37, 73)
- `human_futa.blueprint.json` (lines 51, 86)
- `cat_girl.blueprint.json` (lines 58, 99)
- `centaur_warrior.blueprint.json` (lines 44, 53)
- `red_dragon.blueprint.json` (lines 10, 14)

### What This Means

The anatomy system has been **future-proofed for armor** since its creation. The slot definitions, blueprints, and metadata components all recognize "armor" as a valid layer tier.

---

## Gap Analysis

### What's Missing

**Only One Component Needs Update**: The `clothing:wearable` component schema

**Current State**:

```json
// data/mods/clothing/components/wearable.component.json:8-12
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories"],
  "description": "Layer priority for stacking"
}
```

**Required Change**:

```json
"layer": {
  "type": "string",
  "enum": ["underwear", "base", "outer", "accessories", "armor"],
  "description": "Layer priority for stacking"
}
```

### Impact Assessment

| System Component           | Status             | Change Required              |
| -------------------------- | ------------------ | ---------------------------- |
| Anatomy Blueprints         | ✅ Ready           | None                         |
| Slot Metadata Schema       | ✅ Ready           | None                         |
| Humanoid Slot Library      | ✅ Ready           | None                         |
| Clothing Wearable Schema   | ⚠️ Needs Update    | Add "armor" to enum          |
| Coverage Mapping Schema    | ❓ May Need Update | Add "armor" priority tier    |
| SlotAccessResolver         | ❓ May Need Update | Add armor priority constants |
| Existing Clothing Entities | ✅ Unaffected      | None                         |

---

## Armor vs. Traditional Clothing Layers

### Conceptual Question: Where Does Armor Fit?

**User's Original Question**:

> "Armor doesn't necessarily go always over the outer clothing (could wear a bulletproof vest under a jacket or something like that)"

### Answer: Armor Should Be Its Own Layer

**Reasoning**:

1. **Functional Distinction**: Armor serves a fundamentally different purpose (protection) than aesthetic clothing layers
2. **Variable Positioning**: As noted, armor can be worn:
   - Under outer clothing (leather armor under a robe)
   - Over outer clothing (plate armor over everything)
   - As the outer layer itself (full plate armor)
3. **Game Mechanics**: Armor may have special properties (durability, protection rating) that regular clothing lacks
4. **Fantasy Context**: In sword & sorcery settings, armor is often worn in non-standard configurations (magical robes over chainmail, etc.)

### Recommended Layer Order

```
Proposed Layer Hierarchy (innermost to outermost):
1. underwear    - Undergarments
2. base         - Regular clothing (shirts, pants)
3. armor        - Protective equipment (cuirass, chainmail, plate)
4. outer        - Outerwear (cloaks, robes, long coats)
5. accessories  - Accessories (jewelry, belts)
```

**Rationale**:

- Armor sits between base clothing and outer garments
- Allows realistic scenarios: underwear → shirt → chainmail → cloak
- Maintains flexibility: armor can be "outer" layer if no cloak is worn
- Coverage priority system handles conflict resolution

### Alternative Approach: Armor as Coverage Priority

Instead of a strict layer position, armor could use the **coverage priority system**:

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_upper", "torso_lower"],
    "coveragePriority": "armor"
  }
}
```

**Coverage Priority Scores** (would need extension):

```javascript
const COVERAGE_PRIORITY = {
  outer: 100,
  armor: 150, // NEW: Between outer and base
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400,
};
```

This approach allows armor to:

- Override regular clothing coverage
- Be visible in action descriptions when appropriate
- Maintain the existing four-layer wearable system
- Work with the existing priority resolution logic

---

## Implementation Requirements

### Minimal Changes Required

#### 1. Update Wearable Component Schema ⭐ CRITICAL

**File**: `data/mods/clothing/components/wearable.component.json`

**Change**:

```diff
  "layer": {
    "type": "string",
-   "enum": ["underwear", "base", "outer", "accessories"],
+   "enum": ["underwear", "base", "outer", "accessories", "armor"],
    "description": "Layer priority for stacking"
  }
```

#### 2. Update Coverage Mapping Schema (Optional)

**File**: `data/mods/clothing/components/coverage_mapping.component.json`

**Current** (line 29):

```json
"enum": ["outer", "base", "underwear", "accessories"]
```

**Proposed**:

```json
"enum": ["outer", "armor", "base", "underwear", "accessories"]
```

#### 3. Update SlotAccessResolver Priority System

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

**Current** (from docs):

```javascript
const COVERAGE_PRIORITY = {
  outer: 100,
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400,
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10,
  base: 20,
  underwear: 30,
  accessories: 40,
};
```

**Proposed**:

```javascript
const COVERAGE_PRIORITY = {
  outer: 100,
  armor: 150, // NEW: Armor has priority between outer and base
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400,
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10,
  armor: 15, // NEW: Armor layer priority
  base: 20,
  underwear: 30,
  accessories: 40,
};
```

#### 4. Update Coverage Analyzer (Optional)

**File**: Check if `coverageAnalyzer` needs armor priority handling

### Testing Requirements

1. **Schema Validation**: Verify armor enum accepted in all contexts
2. **Coverage Resolution**: Test armor priority between outer and base layers
3. **Action Text Generation**: Ensure armor appears correctly in action descriptions
4. **Conflict Resolution**: Test scenarios with multiple armor pieces
5. **Backward Compatibility**: Verify existing clothing entities unaffected

---

## Armor-Specific Considerations

### Material Properties

The `core:material` component **already supports armor materials**:

```json
// data/mods/core/components/material.component.json
{
  "material": {
    "enum": [
      "iron", // ✅ Armor material
      "steel", // ✅ Armor material
      "leather", // ✅ Light armor
      "canvas" // ✅ Padded armor
      // ... etc
    ]
  },
  "durability": {
    "type": "number",
    "minimum": 0,
    "maximum": 100 // ✅ Perfect for armor rating
  },
  "properties": [
    "rigid", // ✅ Plate armor property
    "flexible" // ✅ Leather/chainmail property
  ]
}
```

### Armor-Specific Components (Future)

While not required for basic armor support, future expansion could include:

```json
// Potential: armor:protection component
{
  "id": "armor:protection",
  "dataSchema": {
    "properties": {
      "armorClass": { "type": "number" },
      "coverage": { "type": "string", "enum": ["light", "medium", "heavy"] },
      "vulnerablePoints": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

**Note**: This is **not required** for sword & sorcery armor entities. The existing components are sufficient.

---

## Example Armor Entities

### Example 1: Steel Cuirass

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:steel_cuirass",
  "description": "Polished steel chest armor",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear", "base", "armor", "outer"]
    },
    "core:material": {
      "material": "steel",
      "durability": 85,
      "properties": ["rigid", "reflective"]
    },
    "core:name": {
      "text": "steel cuirass"
    },
    "core:description": {
      "text": "A finely crafted steel cuirass that protects the torso. The polished metal gleams in the light, and articulated plates allow for reasonable mobility while providing substantial protection against bladed weapons."
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 8.5
    }
  }
}
```

### Example 2: Leather Bracers

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:leather_bracers",
  "description": "Hardened leather arm protection",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "left_arm_clothing",
        "secondary": ["right_arm_clothing"]
      },
      "allowedLayers": ["base", "armor", "outer"]
    },
    "core:material": {
      "material": "leather",
      "durability": 60,
      "properties": ["flexible"],
      "careInstructions": ["requires_oiling"]
    },
    "core:name": {
      "text": "leather bracers"
    },
    "core:description": {
      "text": "Sturdy leather bracers that protect the forearms. The hardened leather is reinforced with metal studs and provides protection without restricting arm movement. Worn leather shows signs of use and battle."
    },
    "descriptors:color_basic": {
      "color": "brown"
    },
    "descriptors:texture": {
      "texture": "rugged"
    },
    "descriptors:condition": {
      "condition": "worn"
    },
    "clothing:coverage_mapping": {
      "covers": ["left_arm_clothing", "right_arm_clothing"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 1.2
    }
  }
}
```

### Example 3: Chainmail Hauberk

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:chainmail_hauberk",
  "description": "Full-length chainmail shirt",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base", "armor", "outer"]
    },
    "core:material": {
      "material": "iron",
      "durability": 75,
      "properties": ["flexible"]
    },
    "core:name": {
      "text": "chainmail hauberk"
    },
    "core:description": {
      "text": "A knee-length shirt of interlocking iron rings. The chainmail provides excellent protection against slashing attacks while remaining flexible enough for combat movement. The weight is distributed across the shoulders and the metal rings create a distinctive sound with every movement."
    },
    "descriptors:texture": {
      "texture": "metallic"
    },
    "clothing:coverage_mapping": {
      "covers": [
        "torso_upper",
        "torso_lower",
        "left_arm_clothing",
        "right_arm_clothing"
      ],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 12.0
    }
  }
}
```

---

## Recommendations

### Primary Recommendation: Add Armor as Fifth Layer

**Implement armor as a distinct layer** with priority between outer and base:

```
underwear (300) → base (200) → armor (150) → outer (100) → accessories (350/direct)
```

**Advantages**:

- ✅ Aligns with existing anatomy system infrastructure
- ✅ Clear semantic distinction from regular clothing
- ✅ Flexible positioning (can be worn under or over other layers)
- ✅ Works with existing coverage resolution system
- ✅ Supports game mechanics (armor stats, durability)
- ✅ Minimal code changes required

**Disadvantages**:

- ❌ Adds complexity to layer hierarchy
- ❌ Requires updates to priority constants
- ❌ Need to test interaction with all existing clothing

### Alternative Recommendation: Armor as Coverage Priority Only

Keep the four-layer `wearable` system, but add "armor" as a `coveragePriority` value:

```json
{
  "clothing:wearable": {
    "layer": "outer", // or "base"
    "equipmentSlots": { "primary": "torso_upper" }
  },
  "clothing:coverage_mapping": {
    "covers": ["torso_upper"],
    "coveragePriority": "armor" // NEW value
  }
}
```

**Advantages**:

- ✅ Simpler change (only coverage priority)
- ✅ Armor can use existing base/outer layer slots
- ✅ Less impact on layer hierarchy
- ✅ Works with current wearable schema

**Disadvantages**:

- ❌ Armor must choose between "base" or "outer" layer
- ❌ Less semantic clarity
- ❌ May conflict with coverage resolution logic
- ❌ Doesn't leverage existing anatomy system armor support

### Recommended Approach: Primary Recommendation

**Use armor as a fifth layer** because:

1. The anatomy system is already built for it
2. Provides maximum flexibility for sword & sorcery scenarios
3. Clear semantic meaning in game context
4. Supports future expansion (armor stats, special properties)

---

## Migration Strategy

### Phase 1: Core System Update (Minimal Risk)

1. **Update `clothing:wearable` schema**
   - Add "armor" to layer enum
   - No breaking changes to existing entities

2. **Update `clothing:coverage_mapping` schema**
   - Add "armor" to coveragePriority enum
   - Optional but recommended

3. **Run validation suite**
   ```bash
   npm run validate
   npm run test:unit -- tests/unit/clothing/
   npm run test:integration -- tests/integration/clothing/
   ```

### Phase 2: Priority System Update (Medium Risk)

1. **Update `slotAccessResolver.js`**
   - Add armor priority constants
   - Insert armor at priority 150 (between outer and base)

2. **Update any related coverage logic**
   - Check `coverageAnalyzer` if it exists
   - Update priority calculation tests

3. **Run comprehensive tests**
   ```bash
   npm run test:integration -- tests/integration/scopeDsl/clothing-resolution
   npm run test:ci
   ```

### Phase 3: Documentation and Examples (No Risk)

1. **Update documentation**
   - `docs/modding/clothing-items.md` - Add armor layer section
   - `docs/developers/clothing-coverage-system.md` - Add armor priority

2. **Create example armor entities**
   - Add to `data/mods/armor/entities/definitions/` (new mod)
   - Or add to `data/mods/clothing/entities/definitions/`

3. **Update CLAUDE.md**
   - Document armor layer in clothing section

### Phase 4: Testing with Real Scenarios (Validation)

1. **Create test characters with armor**
   - Warrior with full plate
   - Rogue with leather armor
   - Mage with robe over chainmail

2. **Test action text generation**
   - Verify armor appears in descriptions
   - Check coverage resolution
   - Test conflict scenarios

3. **Performance testing**
   - Ensure no degradation with armor layer

---

## Conclusion

**Good News**: The anatomy system requires **no fundamental changes** to support armor entities. The infrastructure is already in place.

**Required Changes**: Minimal - primarily updating the `clothing:wearable` component schema and adding armor priority constants.

**Risk Level**: Low - changes are additive and don't break existing functionality.

**Recommendation**: Implement armor as a **fifth clothing layer** with priority between outer and base layers. This approach:

- Leverages existing anatomy system infrastructure
- Provides maximum flexibility for sword & sorcery scenarios
- Requires minimal code changes
- Supports future expansion

The anatomy system was future-proofed for this exact use case.

---

## References

- Anatomy System Guide: `docs/anatomy/anatomy-system-guide.md`
- Clothing Coverage Mapping: `docs/anatomy/clothing-coverage-mapping.md`
- Blueprints and Recipes: `docs/anatomy/blueprints-and-recipes.md`
- Clothing Items Guide: `docs/modding/clothing-items.md`
- Coverage System Developer Guide: `docs/developers/clothing-coverage-system.md`
- Wearable Component: `data/mods/clothing/components/wearable.component.json`
- Coverage Mapping Component: `data/mods/clothing/components/coverage_mapping.component.json`
- Slot Metadata Component: `data/mods/clothing/components/slot_metadata.component.json`
- Humanoid Slot Library: `data/mods/anatomy/libraries/humanoid.slot-library.json`
- Material Component: `data/mods/core/components/material.component.json`

---

**Report Prepared By**: Claude (AI Assistant)
**Review Status**: Ready for Team Review
**Next Steps**: Discuss with team, choose implementation approach, create implementation tasks
