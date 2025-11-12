# Vespera Nightwhisper Recipe Specification

## Overview

This specification defines the anatomy recipe for **Vespera Nightwhisper**, a cat-girl bard character with distinctive features including heterochromatic slit-pupil eyes, expressive cat ears decorated with silver jewelry, long whiskers, and an expressive tufted tail. The recipe will use the existing `anatomy:cat_girl` blueprint while adding specific customizations for Vespera's unique appearance.

### Character Summary

**Vespera Nightwhisper** is a cat-girl bard with:
- Average height (5'6"), dancer's build with lean muscle
- Pale-cream colored fur covering
- Heterochromatic eyes: left amber-gold, right ice-blue (both with slit pupils and heavy-lidded)
- Large expressive cat ears decorated with silver hoops and small charms
- Long expressive whiskers
- Long expressive tail with tufted fur (full and luxurious appearance)

---

## Requirements Analysis

### Existing Components Review

After analyzing the anatomy system in `data/mods/anatomy/` and `data/mods/descriptors/`, the following components are available:

**Available:**
- ✅ Blueprint: `anatomy:cat_girl` (V1 blueprint with cat features)
- ✅ Body descriptors: height, build, composition, skinColor, hairDensity
- ✅ Eye color: `descriptors:color_extended` includes "amber" and "pale-blue"
- ✅ Eye shape: `descriptors:shape_eye` includes "hooded" (can represent heavy-lidded)
- ✅ Ear entity: `anatomy:cat_ear` with texture support
- ✅ Tail entity: `anatomy:cat_tail` with texture and length support
- ✅ Embellishment component: `descriptors:embellishment` for decorations

**Missing/Needs Enhancement:**
- ❌ Pupil shape descriptor (no component for slit vs round pupils)
- ❌ "ice-blue" color in `descriptors:color_extended`
- ❌ "silver-hoops" and "charms" in `descriptors:embellishment`
- ❌ Whiskers entity/component (no existing whisker support)
- ❌ Custom eye entities for heterochromatic slit-pupil eyes
- ⚠️ Tufted texture for tail (may need new texture value or use existing "fuzzy")

---

## Component Enhancements

### 1. Pupil Shape Descriptor Component (NEW)

**File**: `data/mods/descriptors/components/pupil_shape.component.json`

**Purpose**: Describes the shape of the pupil in an eye, supporting both human (round) and feline/reptilian (slit) pupil types.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:pupil_shape",
  "description": "Describes the shape of the pupil in an eye",
  "dataSchema": {
    "type": "object",
    "properties": {
      "shape": {
        "type": "string",
        "description": "The shape of the pupil",
        "enum": [
          "round",
          "slit-vertical",
          "slit-horizontal",
          "rectangular",
          "keyhole",
          "star-shaped",
          "cross-shaped"
        ],
        "default": "round"
      }
    },
    "required": ["shape"],
    "additionalProperties": false
  }
}
```

**Design Rationale**:
- `round`: Standard human pupil shape
- `slit-vertical`: Feline pupil shape (Vespera's eyes)
- `slit-horizontal`: Goat/sheep pupil shape (for future creatures)
- `rectangular`: Alternative animal pupil shape
- `keyhole`, `star-shaped`, `cross-shaped`: Fantasy/magical creature options
- Default "round" for compatibility with existing human eyes

**Usage Example**:
```json
{
  "components": {
    "anatomy:part": { "subType": "eye" },
    "descriptors:color_extended": { "color": "amber" },
    "descriptors:pupil_shape": { "shape": "slit-vertical" }
  }
}
```

---

### 2. Color Extended Enhancement

**File**: `data/mods/descriptors/components/color_extended.component.json`

**Current State**: The component includes "pale-blue" but not "ice-blue" as a distinct shade.

**Recommendation**: Add `"ice-blue"` to the color_extended enum for Vespera's right eye.

**Proposed Addition**:
```json
"enum": [
  "abyssal-black",
  "amber",
  "auburn",
  // ... existing colors ...
  "pale-blue",
  "ice-blue",  // <-- NEW: Add after "pale-blue"
  "midnight-blue",
  // ... rest of colors
]
```

**Justification**:
- "Ice-blue" is a distinct pale, cool-toned blue with silvery undertones
- "Pale-blue" is warmer and less striking
- Provides more precise color representation for fantasy characters
- Enhances heterochromia visual distinctiveness

---

### 3. Embellishment Component Enhancement

**File**: `data/mods/descriptors/components/embellishment.component.json`

**Current State**: The component includes "crystals", "gemstones", "metal chains", "pearls", "spikes" but no jewelry-specific options.

**Recommendation**: Add `"silver-hoops"` and `"charms"` to support Vespera's ear decorations.

**Proposed Addition**:
```json
"enum": [
  "crystals",
  "gemstones",
  "metal chains",
  "pearls",
  "spikes",
  "silver-hoops",  // <-- NEW: Add for ear jewelry
  "charms"         // <-- NEW: Add for small decorative charms
]
```

**Justification**:
- Ear piercings/hoops are common fantasy character decorations
- "Charms" enables small decorative trinkets (bells, symbols, etc.)
- Supports future characters with jewelry decorations
- Enhances character customization options

**Alternative Approach**: If embellishments should remain garment-specific, consider creating a new `descriptors:jewelry` component specifically for worn adornments. However, reusing `embellishment` maintains consistency and simplicity.

---

### 4. Whiskers Component (NEW - OPTIONAL)

**File**: `data/mods/descriptors/components/whiskers.component.json`

**Purpose**: Describes the presence and characteristics of facial whiskers on feline or fantasy creatures.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:whiskers",
  "description": "Describes the presence and characteristics of facial whiskers",
  "dataSchema": {
    "type": "object",
    "properties": {
      "length": {
        "type": "string",
        "description": "The length of the whiskers",
        "enum": ["short", "medium", "long", "very-long"],
        "default": "medium"
      },
      "expressiveness": {
        "type": "string",
        "description": "How expressive/mobile the whiskers are",
        "enum": ["subtle", "moderate", "highly-expressive"],
        "default": "moderate"
      }
    },
    "required": ["length", "expressiveness"],
    "additionalProperties": false
  }
}
```

**Design Rationale**:
- Two-property descriptor: length and expressiveness
- Length: Visual/physical characteristic
- Expressiveness: Behavioral/emotional characteristic (important for Vespera's character)
- Both properties required for complete whisker description
- Can be applied to head/face entity or as separate whiskers entity

**Usage Example**:
```json
{
  "id": "anatomy:cat_girl_head_with_whiskers",
  "components": {
    "anatomy:part": { "subType": "head" },
    "descriptors:whiskers": {
      "length": "long",
      "expressiveness": "highly-expressive"
    }
  }
}
```

**Alternative Approach**: Instead of a new component, whiskers could be:
1. A separate anatomy part entity (like ears/tail)
2. Added as properties to existing head entity
3. Described narratively without mechanical support

**Recommendation**: Create the component for mechanical support, as whiskers are a distinctive feline feature that may appear on multiple future characters and should be trackable for narrative purposes (Vespera's whiskers betray emotions).

---

## New Entity Definitions

### 1. Feline Eye Entities with Slit Pupils

**File**: `data/mods/anatomy/entities/definitions/feline_eye_amber_slit.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:feline_eye_amber_slit",
  "description": "Feline eye with amber-gold iris and vertical slit pupil",
  "components": {
    "anatomy:part": {
      "subType": "eye"
    },
    "descriptors:color_extended": {
      "color": "amber"
    },
    "descriptors:shape_eye": {
      "shape": "hooded"
    },
    "descriptors:pupil_shape": {
      "shape": "slit-vertical"
    },
    "core:name": {
      "text": "eye"
    }
  }
}
```

**File**: `data/mods/anatomy/entities/definitions/feline_eye_ice_blue_slit.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:feline_eye_ice_blue_slit",
  "description": "Feline eye with ice-blue iris and vertical slit pupil",
  "components": {
    "anatomy:part": {
      "subType": "eye"
    },
    "descriptors:color_extended": {
      "color": "ice-blue"
    },
    "descriptors:shape_eye": {
      "shape": "hooded"
    },
    "descriptors:pupil_shape": {
      "shape": "slit-vertical"
    },
    "core:name": {
      "text": "eye"
    }
  }
}
```

**Design Notes**:
- Both eyes use "hooded" shape to represent heavy-lidded appearance
- Slit-vertical pupils match feline characteristics
- Heterochromia achieved by specifying different eye entities for left/right slots
- Color descriptors match character concept (amber vs ice-blue)

---

### 2. Decorated Cat Ear Entity

**File**: `data/mods/anatomy/entities/definitions/cat_ear_decorated.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_ear_decorated",
  "description": "Feline ear decorated with silver hoops and small charms",
  "components": {
    "anatomy:part": {
      "subType": "ear"
    },
    "core:name": {
      "text": "cat ear"
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    },
    "descriptors:embellishment": {
      "embellishment": "silver-hoops"
    }
  }
}
```

**Design Notes**:
- Extends base `anatomy:cat_ear` concept with embellishments
- Uses "silver-hoops" to represent piercing jewelry
- Could alternatively include "charms" or create separate entity for each decoration style
- Fuzzy texture maintains feline appearance while adding decorative element

**Alternative**: Create two entities (`cat_ear_hoops` and `cat_ear_charms`) for more granular control, or use a single entity with both embellishment values if schema allows.

---

### 3. Tufted Cat Tail Entity (OPTIONAL)

**File**: `data/mods/anatomy/entities/definitions/cat_tail_tufted.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_tail_tufted",
  "description": "Long feline tail with tufted fur giving it a full, luxurious appearance",
  "components": {
    "anatomy:part": {
      "subType": "tail"
    },
    "core:name": {
      "text": "cat tail"
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    },
    "descriptors:length_category": {
      "length": "long"
    },
    "descriptors:flexibility": {
      "flexibility": "highly-flexible"
    }
  }
}
```

**Design Notes**:
- Reuses existing `anatomy:cat_tail` structure
- "Fuzzy" texture approximates tufted appearance
- If "fuzzy" is insufficient, consider adding "tufted" to `descriptors:texture` enum
- Long length and high flexibility match character description
- "Luxurious" quality conveyed through narrative description rather than mechanical component

**Alternative**: If texture precision is critical, add "tufted" to texture.component.json enum and update this entity definition accordingly.

---

### 4. Cat Girl Head with Whiskers (OPTIONAL)

**File**: `data/mods/anatomy/entities/definitions/cat_girl_head_with_whiskers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_girl_head_with_whiskers",
  "description": "Humanoid head with feline features including long expressive whiskers",
  "components": {
    "anatomy:part": {
      "subType": "head"
    },
    "core:name": {
      "text": "head"
    },
    "descriptors:whiskers": {
      "length": "long",
      "expressiveness": "highly-expressive"
    }
  }
}
```

**Design Notes**:
- Only necessary if `descriptors:whiskers` component is implemented
- Alternative: Use narrative description without mechanical component
- Whiskers could also be a separate body part entity if preferred
- "Highly-expressive" captures Vespera's involuntary whisker movements that betray emotions

---

## Recipe Definition

### Vespera Nightwhisper Recipe

**File**: `data/mods/anatomy/recipes/vespera_nightwhisper.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "anatomy:vespera_nightwhisper",
  "blueprintId": "anatomy:cat_girl",
  "bodyDescriptors": {
    "height": "average",
    "build": "athletic",
    "composition": "lean",
    "skinColor": "pale-cream",
    "hairDensity": "furred"
  },
  "slots": {
    "left_eye": {
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit",
      "properties": {
        "descriptors:color_extended": {
          "color": "amber"
        },
        "descriptors:pupil_shape": {
          "shape": "slit-vertical"
        },
        "descriptors:shape_eye": {
          "shape": "hooded"
        }
      }
    },
    "right_eye": {
      "partType": "eye",
      "preferId": "anatomy:feline_eye_ice_blue_slit",
      "properties": {
        "descriptors:color_extended": {
          "color": "ice-blue"
        },
        "descriptors:pupil_shape": {
          "shape": "slit-vertical"
        },
        "descriptors:shape_eye": {
          "shape": "hooded"
        }
      }
    },
    "left_ear": {
      "partType": "ear",
      "preferId": "anatomy:cat_ear_decorated",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:embellishment": {
          "embellishment": "silver-hoops"
        }
      }
    },
    "right_ear": {
      "partType": "ear",
      "preferId": "anatomy:cat_ear_decorated",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:embellishment": {
          "embellishment": "silver-hoops"
        }
      }
    },
    "tail": {
      "partType": "tail",
      "preferId": "anatomy:cat_tail_tufted",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:length_category": {
          "length": "long"
        }
      }
    },
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:cat_girl_torso",
      "properties": {
        "descriptors:build": {
          "build": "toned"
        }
      }
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_average"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_average"
    },
    "vagina": {
      "partType": "vagina",
      "preferId": "anatomy:human_vagina"
    }
  },
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm"
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg"
    },
    {
      "matches": ["left_hand", "right_hand"],
      "partType": "hand",
      "preferId": "anatomy:human_hand"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "foot",
      "preferId": "anatomy:human_foot"
    },
    {
      "matches": ["hair"],
      "partType": "hair",
      "preferId": "anatomy:human_hair"
    }
  ]
}
```

**Design Notes**:

1. **Body Descriptors**:
   - `height: "average"` - Matches 5'6" (average female height)
   - `build: "athletic"` - Dancer's build with lean muscle
   - `composition: "lean"` - Matches character's muscular definition
   - `skinColor: "pale-cream"` - Custom free-form value for fur color
   - `hairDensity: "furred"` - Indicates fur covering (already in schema)

2. **Heterochromatic Eyes**:
   - Left eye: amber with slit pupils (amber-gold in concept)
   - Right eye: ice-blue with slit pupils
   - Both use "hooded" eye shape to represent heavy-lidded appearance
   - Each eye specified individually in slots to achieve heterochromia

3. **Decorated Ears**:
   - Both ears use decorated entity with silver-hoops embellishment
   - Maintains fuzzy texture for feline appearance
   - Properties ensure embellishment is applied

4. **Expressive Tail**:
   - Uses tufted tail entity (or standard cat_tail if tufted not implemented)
   - Long length matches character description
   - Fuzzy texture represents full, luxurious fur

5. **Standard Humanoid Parts**:
   - Patterns handle symmetric limbs (arms, legs, hands, feet)
   - Uses standard human/humanoid parts for base anatomy
   - Maintains compatibility with cat_girl blueprint

6. **Head/Whiskers** (If Implemented):
   - If whiskers component is created, add head slot:
   ```json
   "head": {
     "partType": "head",
     "preferId": "anatomy:cat_girl_head_with_whiskers",
     "properties": {
       "descriptors:whiskers": {
         "length": "long",
         "expressiveness": "highly-expressive"
       }
     }
   }
   ```

---

## Implementation Checklist

### Phase 1: Component Creation

- [ ] Create `descriptors:pupil_shape` component
  - [ ] File: `data/mods/descriptors/components/pupil_shape.component.json`
  - [ ] Validate schema: `npm run validate`
  - [ ] Test: Verify component loads correctly

- [ ] Enhance `descriptors:color_extended` component
  - [ ] Add "ice-blue" to enum
  - [ ] Validate schema: `npm run validate`
  - [ ] Test: Verify color validates correctly

- [ ] Enhance `descriptors:embellishment` component
  - [ ] Add "silver-hoops" and "charms" to enum
  - [ ] Validate schema: `npm run validate`
  - [ ] Test: Verify embellishments validate correctly

- [ ] (Optional) Create `descriptors:whiskers` component
  - [ ] File: `data/mods/descriptors/components/whiskers.component.json`
  - [ ] Validate schema: `npm run validate`
  - [ ] Decide on implementation approach (component vs entity vs narrative-only)

### Phase 2: Entity Definition Creation

- [ ] Create feline eye entities
  - [ ] File: `data/mods/anatomy/entities/definitions/feline_eye_amber_slit.entity.json`
  - [ ] File: `data/mods/anatomy/entities/definitions/feline_eye_ice_blue_slit.entity.json`
  - [ ] Validate: `npm run validate`
  - [ ] Test: Verify entities load and have correct components

- [ ] Create decorated cat ear entity
  - [ ] File: `data/mods/anatomy/entities/definitions/cat_ear_decorated.entity.json`
  - [ ] Validate: `npm run validate`
  - [ ] Test: Verify entity loads with embellishments

- [ ] (Optional) Create tufted cat tail entity
  - [ ] File: `data/mods/anatomy/entities/definitions/cat_tail_tufted.entity.json`
  - [ ] Or add "tufted" to texture enum if needed
  - [ ] Validate: `npm run validate`

- [ ] (Optional) Create head with whiskers entity
  - [ ] File: `data/mods/anatomy/entities/definitions/cat_girl_head_with_whiskers.entity.json`
  - [ ] Only if whiskers component is implemented
  - [ ] Validate: `npm run validate`

### Phase 3: Recipe Creation

- [ ] Create Vespera recipe
  - [ ] File: `data/mods/anatomy/recipes/vespera_nightwhisper.recipe.json`
  - [ ] Use blueprint `anatomy:cat_girl`
  - [ ] Configure body descriptors
  - [ ] Specify heterochromatic eyes in slots
  - [ ] Configure decorated ears
  - [ ] Configure tail
  - [ ] Add patterns for limbs
  - [ ] Validate: `npm run validate`
  - [ ] Validate body descriptors: `npm run validate:body-descriptors`

### Phase 4: Testing

- [ ] Visual Testing
  - [ ] Load recipe in anatomy visualizer (`/anatomy-visualizer.html`)
  - [ ] Verify anatomy graph generates correctly
  - [ ] Check body descriptors display
  - [ ] Verify heterochromia (different eye colors)
  - [ ] Confirm ear decorations appear
  - [ ] Validate tail properties

- [ ] Integration Testing (Recommended)
  - [ ] Create test: `tests/integration/mods/anatomy/vespera_nightwhisper.test.js`
  - [ ] Test anatomy generation workflow
  - [ ] Verify all components applied correctly
  - [ ] Check heterochromatic eyes have different colors
  - [ ] Validate pupil shape on eyes
  - [ ] Confirm embellishments on ears
  - [ ] Test body descriptor values
  - [ ] Run: `npm run test:integration -- tests/integration/mods/anatomy/vespera_nightwhisper.test.js`

- [ ] Linting and Type Checking
  - [ ] Run: `npx eslint data/mods/descriptors/components/pupil_shape.component.json`
  - [ ] Run: `npx eslint data/mods/anatomy/entities/definitions/feline_eye_*.entity.json`
  - [ ] Run: `npx eslint data/mods/anatomy/recipes/vespera_nightwhisper.recipe.json`
  - [ ] Run: `npm run typecheck`

### Phase 5: Documentation

- [ ] Update anatomy documentation
  - [ ] Add Vespera recipe to example files list
  - [ ] Document pupil shape component in appropriate guide
  - [ ] Document heterochromia approach (different entities per eye)
  - [ ] Update embellishment documentation with jewelry examples

---

## Design Decisions and Alternatives

### 1. Heterochromia Implementation

**Chosen Approach**: Create separate eye entities with different colors and explicitly assign to left_eye/right_eye slots.

**Alternatives Considered**:
- **Dynamic color override**: Use properties to override color on standard eye entity
  - ❌ Rejected: Less explicit, harder to visualize in anatomy viewer
- **Heterochromia component**: Create `descriptors:heterochromia` with left/right color specification
  - ❌ Rejected: Overly complex, single-use component, doesn't handle other eye differences (pupil shape)

**Rationale**: Explicit entity assignment is clearest, most maintainable, and allows full control over each eye's properties independently.

---

### 2. Whiskers Implementation

**Chosen Approach**: Create optional `descriptors:whiskers` component and apply to head entity.

**Alternatives Considered**:
- **Separate whiskers entity**: Treat whiskers as independent body part
  - ⚠️ Viable but adds complexity to blueprint (new socket required)
- **Narrative-only**: Describe whiskers in character description without mechanical support
  - ⚠️ Simpler but loses ability to track whisker state for emotional cues
- **Part of facial descriptor**: Add whisker properties to existing facial components
  - ❌ Rejected: Facial aesthetic is about attractiveness, not physical features

**Rationale**: Component approach provides mechanical support without requiring blueprint changes, enables future whisker-related mechanics (emotional state, sensory capabilities), and keeps whiskers as a descriptor rather than a structural part.

---

### 3. Ear Decoration Implementation

**Chosen Approach**: Add "silver-hoops" and "charms" to existing `descriptors:embellishment` component.

**Alternatives Considered**:
- **New jewelry component**: Create `descriptors:jewelry` for worn adornments
  - ⚠️ More semantically correct but adds new component type
  - Could be justified if jewelry becomes common on non-garment entities
- **Free-form description**: Use `core:description` without mechanical component
  - ❌ Rejected: Loses queryability and consistency

**Rationale**: Reusing `embellishment` maintains simplicity, avoids proliferation of descriptor components, and "embellishment" is broad enough to encompass both garment and body decorations. If embellishments become complex (material, style, quantity), reconsider jewelry component.

---

### 4. Tail Tufting Representation

**Chosen Approach**: Use existing "fuzzy" texture or optionally add "tufted" to texture enum.

**Alternatives Considered**:
- **New component**: Create `descriptors:fur_style` with values like "smooth", "tufted", "spiky"
  - ❌ Rejected: Too specific, single-use case
- **Size/volume component**: Represent tufted tail as "fuller" or "larger"
  - ❌ Rejected: Doesn't capture texture difference

**Rationale**: Texture is the appropriate descriptor for surface appearance. If "fuzzy" is insufficient, adding "tufted" to the texture enum is minimal and reusable for other entities (tufted ears, tufted bird tails, etc.).

---

### 5. Slit Pupils Representation

**Chosen Approach**: Create new `descriptors:pupil_shape` component with multiple pupil shapes.

**Alternatives Considered**:
- **Eye shape component**: Add pupil shapes to existing `descriptors:shape_eye`
  - ❌ Rejected: Eye shape (almond, hooded) describes the eye itself, not the pupil
  - Mixing concerns reduces clarity
- **Feline marker component**: Create `descriptors:feline_features` with boolean flags
  - ❌ Rejected: Too specific, doesn't support non-feline slit pupils (reptilian, goat)
- **Free-form in eye entity**: Describe in entity description without component
  - ❌ Rejected: Loses mechanical queryability, can't filter by pupil shape

**Rationale**: Pupil shape is a distinct, queryable characteristic that may appear across multiple species (feline, reptilian, fantasy creatures). Dedicated component provides clear semantics, enables future mechanics (light sensitivity, night vision), and supports reuse across diverse eye entities.

---

## Testing Strategy

### Unit Tests

**Target**: Component validation logic

**Location**: `tests/unit/descriptors/`

**Tests**:
- Validate `pupil_shape` component schema
- Validate `whiskers` component schema (if implemented)
- Test color_extended includes "ice-blue"
- Test embellishment includes "silver-hoops" and "charms"

**Example**:
```javascript
describe('descriptors:pupil_shape', () => {
  it('should accept valid pupil shapes', () => {
    const validShapes = ['round', 'slit-vertical', 'slit-horizontal'];
    validShapes.forEach(shape => {
      const result = validateComponent('descriptors:pupil_shape', { shape });
      expect(result.valid).toBe(true);
    });
  });

  it('should reject invalid pupil shapes', () => {
    const result = validateComponent('descriptors:pupil_shape', { shape: 'square' });
    expect(result.valid).toBe(false);
  });
});
```

---

### Integration Tests

**Target**: Anatomy generation workflow with Vespera recipe

**Location**: `tests/integration/mods/anatomy/vespera_nightwhisper.test.js`

**Tests**:
1. **Recipe Loading**: Verify recipe loads without errors
2. **Anatomy Generation**: Generate anatomy from recipe
3. **Body Descriptors**: Validate body component has correct descriptors
4. **Heterochromia**: Verify left and right eyes have different colors
5. **Pupil Shape**: Verify eyes have slit-vertical pupils
6. **Ear Decorations**: Verify ears have embellishments
7. **Tail Properties**: Verify tail has correct length and texture
8. **Part Count**: Verify expected number of body parts generated
9. **Component Application**: Verify all custom properties applied

**Example Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';

describe('Vespera Nightwhisper Recipe - Anatomy Generation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRecipe('anatomy', 'anatomy:vespera_nightwhisper');
  });

  it('should generate anatomy with heterochromatic eyes', () => {
    const { entityManager } = fixture;
    const bodyId = fixture.generateAnatomy();

    const leftEye = entityManager.getComponent(fixture.getPartId('left_eye'), 'descriptors:color_extended');
    const rightEye = entityManager.getComponent(fixture.getPartId('right_eye'), 'descriptors:color_extended');

    expect(leftEye.color).toBe('amber');
    expect(rightEye.color).toBe('ice-blue');
  });

  it('should apply slit pupils to both eyes', () => {
    const { entityManager } = fixture;
    const bodyId = fixture.generateAnatomy();

    const leftPupil = entityManager.getComponent(fixture.getPartId('left_eye'), 'descriptors:pupil_shape');
    const rightPupil = entityManager.getComponent(fixture.getPartId('right_eye'), 'descriptors:pupil_shape');

    expect(leftPupil.shape).toBe('slit-vertical');
    expect(rightPupil.shape).toBe('slit-vertical');
  });

  it('should apply decorations to cat ears', () => {
    const { entityManager } = fixture;
    const bodyId = fixture.generateAnatomy();

    const leftEar = entityManager.getComponent(fixture.getPartId('left_ear'), 'descriptors:embellishment');
    const rightEar = entityManager.getComponent(fixture.getPartId('right_ear'), 'descriptors:embellishment');

    expect(leftEar.embellishment).toBe('silver-hoops');
    expect(rightEar.embellishment).toBe('silver-hoops');
  });
});
```

---

### Visual Testing

**Tool**: Anatomy Visualizer (`/anatomy-visualizer.html`)

**Steps**:
1. Start development server: `npm run dev`
2. Open anatomy visualizer in browser
3. Select "Vespera Nightwhisper" recipe from dropdown
4. Verify anatomy graph displays correctly
5. Check body description includes:
   - Average height
   - Athletic build
   - Lean composition
   - Pale-cream skin color
   - Furred hair density
6. Inspect individual parts:
   - Left eye: amber color, slit pupil
   - Right eye: ice-blue color, slit pupil
   - Ears: fuzzy texture, silver-hoops embellishment
   - Tail: long length, fuzzy texture
7. Check for any missing parts or errors in console

---

## Future Enhancements

### 1. Whisker State Tracking

If whiskers are implemented with mechanical support, consider future enhancements:

- **Emotional State Integration**: Whisker position/movement reflects character's emotional state
- **Component**: `descriptors:whisker_state` with values like "relaxed", "alert", "drooping", "twitching"
- **Event-Driven**: Update whisker state in response to emotional events
- **Narrative Integration**: Include whisker state in character descriptions during interactions

**Example**:
```json
{
  "descriptors:whisker_state": {
    "position": "drooping",
    "twitching": true
  }
}
```

### 2. Advanced Pupil Mechanics

Future gameplay mechanics could leverage pupil shape:

- **Light Sensitivity**: Slit pupils contract more in bright light, causing discomfort/visual impairment
- **Night Vision**: Slit pupils provide advantage in low-light conditions
- **Racial Traits**: Pupil shape determines environmental preferences and penalties
- **Social Perception**: NPCs react differently to characters with non-human pupils

### 3. Jewelry System

If ear decorations expand beyond simple embellishments:

- **Jewelry Slots**: Define equipment slots for piercings, necklaces, rings
- **Jewelry Entities**: Create wearable jewelry items similar to clothing system
- **Material Properties**: Track jewelry material (silver, gold, bone, etc.)
- **Magical Enchantments**: Enable jewelry as equipment with magical properties
- **Component**: `items:jewelry` with properties for material, enchantments, slots

### 4. Fur Color Patterns

Vespera has solid pale-cream fur, but future cat-girl characters might have patterns:

- **Component**: `descriptors:fur_pattern` with values like "solid", "striped", "spotted", "calico", "tuxedo"
- **Integration**: Apply to body descriptor or individual parts
- **Multi-Color Support**: Enable pattern component to reference multiple colors

---

## Summary

This specification defines a complete implementation plan for Vespera Nightwhisper's anatomy recipe, including:

1. **New Components** (2 required, 1 optional):
   - `descriptors:pupil_shape` (REQUIRED for slit pupils)
   - `descriptors:whiskers` (OPTIONAL for mechanical whisker support)

2. **Component Enhancements** (2):
   - Add "ice-blue" to `descriptors:color_extended`
   - Add "silver-hoops" and "charms" to `descriptors:embellishment`

3. **New Entity Definitions** (2-4):
   - `anatomy:feline_eye_amber_slit` (REQUIRED)
   - `anatomy:feline_eye_ice_blue_slit` (REQUIRED)
   - `anatomy:cat_ear_decorated` (REQUIRED)
   - `anatomy:cat_tail_tufted` (OPTIONAL, can use existing cat_tail)
   - `anatomy:cat_girl_head_with_whiskers` (OPTIONAL, only if whiskers component implemented)

4. **Recipe Definition**:
   - `anatomy:vespera_nightwhisper.recipe.json` using `anatomy:cat_girl` blueprint
   - Body descriptors: average height, athletic build, lean composition, pale-cream skin, furred
   - Heterochromatic eyes with slit pupils
   - Decorated ears with silver hoops
   - Long tufted tail

The implementation follows anatomy system best practices, maintains backward compatibility, and provides clear extension points for future enhancements. All components are reusable for future characters with similar features.

---

**Last Updated**: 2025-11-12
**Author**: Claude Code
**Status**: Specification Complete - Ready for Implementation
