# Cat Girl Anatomy Recipe Specification

**Status**: Draft Specification
**Version**: 1.0
**Date**: 2025-11-11
**Category**: Anatomy System - Hybrid Creature Recipe Design
**Priority**: Medium

---

## Executive Summary

This specification defines a "cat girl" (nekomimi/kemonomimi) anatomy recipe for the Living Narrative Engine. A cat girl is a humanoid female character with feline characteristics - primarily cat ears and a tail, while maintaining a largely human bipedal anatomy. This hybrid design requires extending the existing humanoid anatomy system with felid features.

**Key Design Principles**:
1. **Humanoid Base**: Use existing human_female anatomy as the foundation
2. **Minimal Modifications**: Replace/add only cat-specific features (ears, tail)
3. **Optional Extensions**: Support additional feline features (whiskers, fangs, paw-like hands/feet, slit pupils)
4. **Descriptor Enhancement**: Extend body descriptor system to support furred/furry textures

---

## Design Philosophy

### Core Concept

A cat girl represents a **hybrid humanoid-feline creature** characterized by:

1. **Bipedal Human Form**: Standard humanoid skeletal structure, posture, and proportions
2. **Feline Features**: Cat ears, tail, and optional additional traits
3. **Aesthetic Balance**: Maintains human beauty standards while adding appealing feline characteristics
4. **Cultural Context**: Common in Japanese anime/manga (nekomimi), fantasy settings, and furry communities

### Visual Concept

**Standard Cat Girl**:
- Female humanoid body (human_female base)
- **Cat ears** on top of head (replacing or alongside human ears)
- **Cat tail** extending from lower back/tailbone area
- Optional: Furred texture on ears and tail
- Optional: Feline eye characteristics (slit pupils, reflective tapetum)
- Optional: Small fangs, whiskers, claw-like nails

**Physical Variations**:
- **Minimal**: Just ears + tail (rest fully human)
- **Standard**: Ears, tail, furred patches, fanged teeth, feline eyes
- **Enhanced**: Above + paw-like hands/feet, fur coverage on limbs
- **Extreme**: Full-body fur, muzzle-like face (approaches full anthro)

This spec focuses on **Standard** variation.

---

## Anatomical Analysis

### Current Human Female Anatomy

**Blueprint**: `anatomy:human_female`
**Composed From**: `anatomy:humanoid_core`

**Standard Slots** (from humanoid_core):
- head, left_arm, right_arm, left_leg, right_leg
- left_eye, right_eye, left_ear, right_ear
- nose, mouth, teeth, hair, pubic_hair
- left_hand, right_hand, left_foot, right_foot
- asshole, left_ass, right_ass

**Female-Specific Slots** (additional):
- left_breast, right_breast
- vagina

**Body Descriptors** (example):
```json
{
  "build": "athletic",
  "composition": "lean",
  "skinColor": "olive"
}
```

### Required Modifications for Cat Girl

#### 1. Cat Ears (Required)

**Approach**: Replace human ears with cat ears

**Option A**: Replace existing ear slots
- Modify `left_ear` and `right_ear` slots to use `cat_ear` part type
- Simplest approach, uses existing socket structure

**Option B**: Add cat ears as separate slots
- Keep human ears (small/vestigial)
- Add `cat_ear_left` and `cat_ear_right` as additional slots
- More complex but allows for "four ears" variant

**Recommendation**: **Option A** - Replace existing ear slots

**Socket Location**: `left_ear`, `right_ear` (on head)
**Part Type**: `cat_ear`
**Properties**:
- `descriptors:texture`: `fuzzy` or new `furred` value
- `descriptors:shape_general`: `triangular` (cat ear shape)
- Optional: `descriptors:color_basic` for ear fur color

#### 2. Cat Tail (Required)

**Approach**: Add new tail slot

**Socket Location**: `lower_back` or `tailbone` (new socket on torso)
**Part Type**: `cat_tail`
**Properties**:
- `descriptors:texture`: `fuzzy` or new `furred` value
- `descriptors:length_category`: `long` or `very-long`
- `descriptors:flexibility`: `flexible` (tails are very flexible)
- Optional: `descriptors:pattern`: `striped`, `spotted`, `solid`

**Blueprint Modification Required**:
- Add `tail` socket to torso entity definition
- OR extend human_female blueprint with `additionalSlots`

#### 3. Enhanced Eyes (Optional)

**Approach**: Use existing eye slots with cat-specific properties

**Part Type**: Reuse `eye` part type with cat properties
**Properties**:
- `descriptors:shape_eye`: Add new value `slit-pupil` (vertical slit like cats)
- `descriptors:effect`: Add new value `reflective-tapetum` (glowing eyes in dark)
- `descriptors:color_extended`: Cat eye colors (amber, green, gold)

#### 4. Fanged Teeth (Optional)

**Approach**: Use existing teeth slot with cat-specific properties

**Part Type**: Reuse `teeth` part type with fang properties
**Properties**:
- `descriptors:shape_general`: Add new value `fanged` (pronounced canines)

#### 5. Whiskers (Optional)

**Approach**: Add whiskers as facial feature

**Socket Location**: `face` or parent to `head`
**Part Type**: `whiskers`
**Properties**:
- `descriptors:sensory_capability`: `tactile-sensitive`
- `descriptors:length_category`: `long`

#### 6. Paw-like Hands/Feet (Optional - Not Recommended for Standard)

**Approach**: Replace hand/foot parts with paw variants

**Recommendation**: **Skip for standard cat girl** - too far from humanoid, better for full anthro

---

## Body Descriptor Enhancement Requirements

### Current Limitations

**hairDensity Descriptor** (from `bodyDescriptorRegistry.js`):
```javascript
validValues: ['hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy']
```

**Problem**: No value for "furred" or "furry" to describe cat-like fur coverage

### Proposed Enhancement

#### Option 1: Extend hairDensity Enum (Recommended)

**Add to hairDensity**:
- `'furred'` - For characters with fur (cat girls, werewolves, etc.)

**Justification**:
- `hairDensity` already describes body hair characteristics
- Fur is essentially dense body hair
- Maintains semantic consistency
- Minimal system impact

**Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`
```javascript
hairDensity: {
  schemaProperty: 'hairDensity',
  displayLabel: 'Body hair density',
  displayKey: 'body_hair',
  dataPath: 'body.descriptors.hairDensity',
  validValues: ['hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy', 'furred'], // ADD 'furred'
  displayOrder: 50,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.hairDensity,
  formatter: (value) => `Body hair: ${value}`,
  required: false,
}
```

**Required Changes**:
1. Update `src/anatomy/registries/bodyDescriptorRegistry.js` - Add `'furred'` to validValues
2. Update `data/schemas/anatomy.recipe.schema.json` - Add `'furred'` to hairDensity enum
3. Update `data/mods/descriptors/components/body_hair.component.json` - Add `'furred'` to enum
4. Run validation: `npm run validate:body-descriptors`

#### Option 2: Create New Descriptor Component (Alternative)

**New Component**: `descriptors:fur_coverage`
- Independent descriptor for fur-covered species
- More explicit but adds complexity

**Recommendation**: **Not needed** - Option 1 is simpler and sufficient

---

## Texture Descriptor Enhancement

### Current texture Component

**Location**: `data/mods/descriptors/components/texture.component.json`

**Current Values**:
```json
"enum": [
  "bumpy", "chitinous", "coarse", "concentric-teeth", "croc-embossed",
  "faceted", "fleece", "fuzzy", "glossy", "leathery", "lipless-slit",
  "matte", "mucous", "nodular-receptors", "pale-clammy", "rib-knit",
  "ridged", "rough", "rugged", "scarred", "scaled", "serrated-edges",
  "silky", "slick", "slimy", "smooth", "smooth-muscular",
  "smooth-segmented", "soft", "suckered", "terry", "translucent",
  "translucent-slick", "translucent-veined", "velvety", "webbed-clawed"
]
```

**Analysis**:
- ✅ `"fuzzy"` - Already exists, suitable for cat ears/tail
- ✅ `"soft"` - Already exists, suitable for fur
- ✅ `"velvety"` - Already exists, excellent for cat fur

**Recommendation**: **No changes needed** - Existing values are sufficient

**Suggested Usage**:
- Cat ears: `"fuzzy"` or `"velvety"`
- Cat tail: `"fuzzy"` or `"soft"`
- Paw pads (if added): `"soft"`

---

## Implementation Plan

### Phase 1: Entity Definitions

#### 1.1 Cat Ear Entity

**File**: `data/mods/anatomy/entities/definitions/cat_ear.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_ear",
  "description": "Feline ear - triangular, mobile, covered in short fur",
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
    "descriptors:shape_general": {
      "shape": "triangular"
    }
  }
}
```

#### 1.2 Cat Tail Entity

**File**: `data/mods/anatomy/entities/definitions/cat_tail.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_tail",
  "description": "Feline tail - long, flexible, covered in fur",
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
      "flexibility": "flexible"
    }
  }
}
```

#### 1.3 Torso Entity with Tail Socket (Optional)

**Option A**: Create cat_girl-specific torso entity
**Option B**: Extend human_female blueprint with additionalSlots (Recommended)

**File**: `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json` (if Option A)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_girl_torso",
  "description": "Female torso with tail attachment point",
  "components": {
    "anatomy:part": {
      "subType": "torso"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "tail",
          "allowedTypes": ["tail"],
          "nameTpl": "tail"
        }
        // Note: Would also need to duplicate all human_female_torso sockets
        // This is why Option B (additionalSlots) is recommended
      ]
    },
    "core:name": {
      "text": "torso"
    }
  }
}
```

### Phase 2: Blueprint

#### Approach: V1 Blueprint with humanoid_core Composition

**File**: `data/mods/anatomy/blueprints/cat_girl.blueprint.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:cat_girl",
  "root": "anatomy:human_female_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "left_ear": {
      "socket": "left_ear",
      "requirements": {
        "partType": "ear",
        "components": ["anatomy:part"]
      }
    },
    "right_ear": {
      "socket": "right_ear",
      "requirements": {
        "partType": "ear",
        "components": ["anatomy:part"]
      }
    },
    "tail": {
      "socket": "lower_back",
      "requirements": {
        "partType": "tail",
        "components": ["anatomy:part"]
      }
    },
    "left_breast": {
      "socket": "left_chest",
      "requirements": {
        "partType": "breast",
        "components": ["anatomy:part"]
      }
    },
    "right_breast": {
      "socket": "right_chest",
      "requirements": {
        "partType": "breast",
        "components": ["anatomy:part"]
      }
    },
    "vagina": {
      "socket": "vagina",
      "requirements": {
        "partType": "vagina",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    "back_accessory": {
      "anatomySockets": ["upper_back", "lower_back", "tail"],
      "allowedLayers": ["accessory", "armor"]
    },
    "tail_accessory": {
      "anatomySockets": ["tail"],
      "allowedLayers": ["accessory"]
    },
    "full_body": {
      "blueprintSlots": [
        "head",
        "left_arm",
        "right_arm",
        "left_leg",
        "right_leg",
        "left_breast",
        "right_breast",
        "tail"
      ],
      "allowedLayers": ["outer"]
    }
  }
}
```

**Notes**:
- Overrides `left_ear` and `right_ear` slots from humanoid_core
- Adds `tail` slot with `lower_back` socket
- Includes female-specific slots (breasts, vagina)
- Extends clothing mappings to include tail

**Critical Issue**: `lower_back` socket doesn't exist on standard human torso

**Solutions**:
1. **Modify human_female_torso entity** to add tail socket (affects all human_female instances)
2. **Create cat_girl-specific torso entity** (duplicates torso definition)
3. **Use additionalSlots in blueprint** (NOT available in V1 - requires V2)

**Recommendation**: Create `anatomy:cat_girl_torso` entity that extends human_female_torso

### Phase 3: Recipe

**File**: `data/mods/anatomy/recipes/cat_girl.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "anatomy:cat_girl_standard",
  "blueprintId": "anatomy:cat_girl",
  "bodyDescriptors": {
    "build": "athletic",
    "composition": "lean",
    "skinColor": "fair",
    "hairDensity": "furred",
    "height": "average"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:cat_girl_torso",
      "properties": {
        "descriptors:build": {
          "build": "toned"
        }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head"
    },
    "left_ear": {
      "partType": "ear",
      "preferId": "anatomy:cat_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "right_ear": {
      "partType": "ear",
      "preferId": "anatomy:cat_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "tail": {
      "partType": "tail",
      "preferId": "anatomy:cat_tail",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:length_category": {
          "length": "long"
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
      "preferId": "anatomy:humanoid_hand"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "foot",
      "preferId": "anatomy:human_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:humanoid_eye"
    },
    {
      "matches": ["hair"],
      "partType": "hair",
      "preferId": "anatomy:human_hair"
    }
  ]
}
```

**Key Features**:
- Uses `hairDensity: "furred"` (requires descriptor enhancement)
- Specifies cat ears and tail explicitly
- Uses human parts for most anatomy
- Maintains female-specific anatomy

### Phase 4: Descriptor System Updates

#### 4.1 Update Body Descriptor Registry

**File**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Change**:
```javascript
hairDensity: {
  schemaProperty: 'hairDensity',
  displayLabel: 'Body hair density',
  displayKey: 'body_hair',
  dataPath: 'body.descriptors.hairDensity',
  validValues: ['hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy', 'furred'], // ADD 'furred'
  displayOrder: 50,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.hairDensity,
  formatter: (value) => `Body hair: ${value}`,
  required: false,
}
```

#### 4.2 Update Recipe Schema

**File**: `data/schemas/anatomy.recipe.schema.json`

**Find hairDensity property** (around line 175):
```json
"hairDensity": {
  "type": "string",
  "enum": [
    "hairless",
    "sparse",
    "light",
    "moderate",
    "hairy",
    "very-hairy",
    "furred"
  ],
  "description": "Body hair density (including fur for animal-like creatures)"
}
```

#### 4.3 Update body_hair Component

**File**: `data/mods/descriptors/components/body_hair.component.json`

**Update enum**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:body_hair",
  "description": "Describes the body hair characteristics",
  "dataSchema": {
    "type": "object",
    "properties": {
      "hairDensity": {
        "type": "string",
        "description": "The density or amount of body hair (including fur)",
        "enum": [
          "hairless",
          "sparse",
          "light",
          "moderate",
          "hairy",
          "very-hairy",
          "furred"
        ],
        "default": "moderate"
      }
    },
    "required": [],
    "additionalProperties": false
  }
}
```

### Phase 5: Torso Entity with Tail Socket

**File**: `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_girl_torso",
  "description": "Female humanoid torso with tail attachment point at lower back",
  "components": {
    "anatomy:part": {
      "subType": "torso"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "neck",
          "allowedTypes": ["head"],
          "nameTpl": "neck"
        },
        {
          "id": "left_shoulder",
          "allowedTypes": ["arm"],
          "nameTpl": "left shoulder"
        },
        {
          "id": "right_shoulder",
          "allowedTypes": ["arm"],
          "nameTpl": "right shoulder"
        },
        {
          "id": "left_hip",
          "allowedTypes": ["leg"],
          "nameTpl": "left hip"
        },
        {
          "id": "right_hip",
          "allowedTypes": ["leg"],
          "nameTpl": "right hip"
        },
        {
          "id": "left_chest",
          "allowedTypes": ["breast"],
          "nameTpl": "left chest"
        },
        {
          "id": "right_chest",
          "allowedTypes": ["breast"],
          "nameTpl": "right chest"
        },
        {
          "id": "vagina",
          "allowedTypes": ["vagina"],
          "nameTpl": "vagina"
        },
        {
          "id": "asshole",
          "allowedTypes": ["asshole"],
          "nameTpl": "asshole"
        },
        {
          "id": "left_ass",
          "allowedTypes": ["ass_cheek"],
          "nameTpl": "left ass cheek"
        },
        {
          "id": "right_ass",
          "allowedTypes": ["ass_cheek"],
          "nameTpl": "right ass cheek"
        },
        {
          "id": "pubic_hair",
          "allowedTypes": ["pubic_hair"],
          "nameTpl": "pubic hair"
        },
        {
          "id": "upper_back",
          "allowedTypes": [],
          "nameTpl": "upper back"
        },
        {
          "id": "lower_back",
          "allowedTypes": ["tail"],
          "nameTpl": "lower back"
        },
        {
          "id": "chest_center",
          "allowedTypes": [],
          "nameTpl": "chest center"
        },
        {
          "id": "waist_front",
          "allowedTypes": [],
          "nameTpl": "waist front"
        },
        {
          "id": "waist_back",
          "allowedTypes": [],
          "nameTpl": "waist back"
        }
      ]
    },
    "core:name": {
      "text": "torso"
    },
    "descriptors:build": {
      "build": "athletic"
    }
  }
}
```

**Note**: This duplicates human_female_torso socket structure and adds `tail` to `lower_back` allowedTypes.

---

## Optional Enhancements

### Enhanced Cat Girl (Additional Features)

#### Feline Eyes with Slit Pupils

**Entity**: `data/mods/anatomy/entities/definitions/cat_eye.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_eye",
  "description": "Feline eye with vertical slit pupil and reflective tapetum",
  "components": {
    "anatomy:part": {
      "subType": "eye"
    },
    "core:name": {
      "text": "feline eye"
    },
    "descriptors:shape_eye": {
      "shape": "slit-pupil"
    },
    "descriptors:color_extended": {
      "color": "amber"
    }
  }
}
```

**Required**: Add `"slit-pupil"` to `descriptors:shape_eye` component enum

**Recipe Change**:
```json
{
  "patterns": [
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:cat_eye"
    }
  ]
}
```

#### Small Fangs

**Entity**: Reuse `anatomy:humanoid_teeth` with properties

**Recipe Change**:
```json
{
  "slots": {
    "teeth": {
      "partType": "teeth",
      "preferId": "anatomy:humanoid_teeth",
      "properties": {
        "descriptors:shape_general": {
          "shape": "fanged"
        }
      }
    }
  }
}
```

**Required**: Add `"fanged"` to `descriptors:shape_general` component enum

#### Whiskers

**Entity**: `data/mods/anatomy/entities/definitions/whiskers.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:cat_whiskers",
  "description": "Tactile whiskers extending from the face",
  "components": {
    "anatomy:part": {
      "subType": "whiskers"
    },
    "core:name": {
      "text": "whiskers"
    },
    "descriptors:sensory_capability": {
      "capability": "tactile-sensitive"
    },
    "descriptors:length_category": {
      "length": "long"
    }
  }
}
```

**Blueprint Change**: Add whiskers slot
```json
{
  "slots": {
    "whiskers": {
      "socket": "face",
      "requirements": {
        "partType": "whiskers",
        "components": ["anatomy:part"]
      },
      "optional": true
    }
  }
}
```

**Required**: Add `"face"` socket to head entity or make whiskers parent to `head`

---

## Testing Plan

### Integration Tests

**File**: `tests/integration/mods/anatomy/cat_girl_anatomy.integration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Cat Girl Anatomy Integration', () => {
  let testBed;
  let fixture;

  beforeEach(async () => {
    testBed = createTestBed();
    fixture = await ModTestFixture.forRecipe('anatomy', 'anatomy:cat_girl_standard');
  });

  afterEach(() => {
    fixture.cleanup();
    testBed.cleanup();
  });

  describe('Blueprint Loading', () => {
    it('should load cat_girl blueprint successfully', async () => {
      const blueprint = await fixture.loadBlueprint('anatomy:cat_girl');
      expect(blueprint).toBeDefined();
      expect(blueprint.id).toBe('anatomy:cat_girl');
    });

    it('should have tail slot defined', async () => {
      const blueprint = await fixture.loadBlueprint('anatomy:cat_girl');
      expect(blueprint.slots.tail).toBeDefined();
      expect(blueprint.slots.tail.socket).toBe('lower_back');
    });

    it('should have ear slots defined', async () => {
      const blueprint = await fixture.loadBlueprint('anatomy:cat_girl');
      expect(blueprint.slots.left_ear).toBeDefined();
      expect(blueprint.slots.right_ear).toBeDefined();
    });
  });

  describe('Recipe Processing', () => {
    it('should generate cat girl anatomy with all parts', async () => {
      const result = await fixture.generateAnatomy();

      expect(result.parts).toBeDefined();
      expect(result.parts.left_ear).toBeDefined();
      expect(result.parts.right_ear).toBeDefined();
      expect(result.parts.tail).toBeDefined();
      expect(result.parts.left_breast).toBeDefined();
      expect(result.parts.right_breast).toBeDefined();
    });

    it('should use cat_ear entity for ear parts', async () => {
      const result = await fixture.generateAnatomy();

      const leftEar = result.parts.left_ear;
      expect(leftEar.definitionId).toBe('anatomy:cat_ear');

      const rightEar = result.parts.right_ear;
      expect(rightEar.definitionId).toBe('anatomy:cat_ear');
    });

    it('should use cat_tail entity for tail part', async () => {
      const result = await fixture.generateAnatomy();

      const tail = result.parts.tail;
      expect(tail.definitionId).toBe('anatomy:cat_tail');
    });

    it('should apply furred body descriptor', async () => {
      const result = await fixture.generateAnatomy();

      expect(result.bodyDescriptors.hairDensity).toBe('furred');
    });

    it('should apply fuzzy texture to cat ears', async () => {
      const result = await fixture.generateAnatomy();

      const leftEar = result.parts.left_ear;
      expect(leftEar.components['descriptors:texture'].texture).toBe('fuzzy');
    });

    it('should apply fuzzy texture to cat tail', async () => {
      const result = await fixture.generateAnatomy();

      const tail = result.parts.tail;
      expect(tail.components['descriptors:texture'].texture).toBe('fuzzy');
    });
  });

  describe('Body Descriptors', () => {
    it('should validate furred hairDensity value', () => {
      const result = validateDescriptorValue('hairDensity', 'furred');
      expect(result.valid).toBe(true);
    });

    it('should include all standard humanoid parts', async () => {
      const result = await fixture.generateAnatomy();

      // Verify humanoid structure maintained
      expect(result.parts.head).toBeDefined();
      expect(result.parts.left_arm).toBeDefined();
      expect(result.parts.right_arm).toBeDefined();
      expect(result.parts.left_leg).toBeDefined();
      expect(result.parts.right_leg).toBeDefined();
      expect(result.parts.left_hand).toBeDefined();
      expect(result.parts.right_hand).toBeDefined();
      expect(result.parts.left_foot).toBeDefined();
      expect(result.parts.right_foot).toBeDefined();
    });
  });
});
```

### Validation Tests

```bash
# Schema validation
npm run validate

# Body descriptor validation
npm run validate:body-descriptors

# Anatomy visualizer manual test
# Open: /anatomy-visualizer.html
# Select: anatomy:cat_girl_standard
```

---

## Alternative Approaches Considered

### Alternative 1: V2 Blueprint with Structure Template

**Pros**:
- Cleaner for creatures with many repeating limbs
- Automatic socket generation

**Cons**:
- Cat girl is essentially humanoid (not many repeating parts)
- Would require creating structure template for minimal benefit
- More complex than needed for this use case

**Verdict**: **Not recommended** - V1 blueprint is more appropriate

### Alternative 2: Full Anthro Cat (Not Cat Girl)

**Description**: Full feline bipedal anthropomorphic character

**Additional Features**:
- Muzzle/snout instead of human face
- Digitigrade legs (walking on toes)
- Paw hands with retractable claws
- Full body fur
- Plantigrade vs digitigrade foot structure

**Verdict**: **Different creature** - Out of scope for "cat girl" (which is humanoid with cat features)

### Alternative 3: Add "fur_coverage" Descriptor Instead of Extending hairDensity

**Pros**:
- More explicit separation of hair vs fur
- Cleaner semantics

**Cons**:
- Adds complexity
- Fur is essentially dense body hair
- Would need new descriptor in registry (next: 70)

**Verdict**: **Not recommended** - Extending hairDensity is simpler and semantically appropriate

---

## Descriptor Component Enhancements Required

### New Enum Values Needed

#### 1. descriptors:shape_eye (Optional)

**File**: `data/mods/descriptors/components/shape_eye.component.json`

**Add**: `"slit-pupil"` for cat-like vertical slit pupils

```json
{
  "enum": [
    "round",
    "almond",
    "hooded",
    "upturned",
    "downturned",
    "slit-pupil"
  ]
}
```

#### 2. descriptors:shape_general (Optional)

**File**: `data/mods/descriptors/components/shape_general.component.json`

**Add**:
- `"triangular"` for cat ear shape
- `"fanged"` for teeth with prominent canines

```json
{
  "enum": [
    // ... existing values ...
    "triangular",
    "fanged"
  ]
}
```

---

## Implementation Checklist

### Phase 1: Descriptor System Updates (Required First)

- [ ] Update `src/anatomy/registries/bodyDescriptorRegistry.js`
  - [ ] Add `'furred'` to `hairDensity.validValues` array
- [ ] Update `data/schemas/anatomy.recipe.schema.json`
  - [ ] Add `'furred'` to `hairDensity` enum (around line 175)
- [ ] Update `data/mods/descriptors/components/body_hair.component.json`
  - [ ] Add `'furred'` to `hairDensity` enum
  - [ ] Update description to mention fur
- [ ] Run validation
  - [ ] `npm run validate`
  - [ ] `npm run validate:body-descriptors`
- [ ] Commit descriptor changes with message: "feat(anatomy): add 'furred' hairDensity value for cat girls and furry creatures"

### Phase 2: Entity Definitions

- [ ] Create `data/mods/anatomy/entities/definitions/cat_ear.entity.json`
  - [ ] Define cat ear with triangular shape and fuzzy texture
- [ ] Create `data/mods/anatomy/entities/definitions/cat_tail.entity.json`
  - [ ] Define cat tail with long length, fuzzy texture, flexible property
- [ ] Create `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json`
  - [ ] Duplicate human_female_torso sockets
  - [ ] Add `tail` to `lower_back` socket allowedTypes
- [ ] Update mod manifest to include new entity definitions
- [ ] Run validation: `npm run validate`

### Phase 3: Blueprint

- [ ] Create `data/mods/anatomy/blueprints/cat_girl.blueprint.json`
  - [ ] Compose from `anatomy:humanoid_core`
  - [ ] Use `anatomy:cat_girl_torso` as root
  - [ ] Override ear slots to use cat ears
  - [ ] Add tail slot
  - [ ] Include female-specific slots (breasts, vagina)
  - [ ] Extend clothing slot mappings for tail
- [ ] Update mod manifest to include blueprint
- [ ] Run validation: `npm run validate`

### Phase 4: Recipe

- [ ] Create `data/mods/anatomy/recipes/cat_girl.recipe.json`
  - [ ] Reference `anatomy:cat_girl` blueprint
  - [ ] Set body descriptors including `hairDensity: "furred"`
  - [ ] Configure ear slots to use `anatomy:cat_ear`
  - [ ] Configure tail slot to use `anatomy:cat_tail`
  - [ ] Configure female anatomy (breasts, vagina)
  - [ ] Set patterns for limbs, hands, feet using humanoid parts
- [ ] Update mod manifest to include recipe
- [ ] Run validation: `npm run validate`

### Phase 5: Testing

- [ ] Create integration test: `tests/integration/mods/anatomy/cat_girl_anatomy.integration.test.js`
  - [ ] Test blueprint loading
  - [ ] Test recipe processing
  - [ ] Test entity generation
  - [ ] Test descriptor validation
- [ ] Run integration tests: `npm run test:integration -- tests/integration/mods/anatomy/cat_girl_anatomy.integration.test.js`
- [ ] Manual test in anatomy visualizer
  - [ ] Open `/anatomy-visualizer.html`
  - [ ] Select `anatomy:cat_girl_standard` recipe
  - [ ] Verify all parts render correctly
  - [ ] Verify body descriptors display correctly
  - [ ] Verify no console errors

### Phase 6: Optional Enhancements (If Desired)

- [ ] Add slit pupil eyes
  - [ ] Add `"slit-pupil"` to `descriptors:shape_eye` component enum
  - [ ] Create `anatomy:cat_eye` entity
  - [ ] Create enhanced recipe variant using cat eyes
- [ ] Add fanged teeth
  - [ ] Add `"fanged"` to `descriptors:shape_general` component enum
  - [ ] Update recipe to add fanged property to teeth
- [ ] Add whiskers
  - [ ] Create `anatomy:cat_whiskers` entity
  - [ ] Add `face` socket to head or make whiskers parent to head
  - [ ] Add whiskers slot to blueprint

### Phase 7: Documentation

- [ ] Update `docs/anatomy/non-human-quickstart.md` to include cat girl as example
- [ ] Add cat girl to anatomy recipe examples
- [ ] Document new `furred` hairDensity value
- [ ] Update testing documentation with cat girl test example

---

## Risk Assessment

### Low Risk

- ✅ **Descriptor Enhancement**: Adding `'furred'` to hairDensity enum is low-impact
  - Backwards compatible (doesn't affect existing recipes)
  - Follows established pattern
  - Validated by existing validation tools

### Medium Risk

- ⚠️ **Torso Entity Duplication**: Creating `cat_girl_torso` duplicates human_female_torso
  - Risk: Maintenance burden (changes to torso sockets need dual updates)
  - Mitigation: Document clearly, consider refactoring to use blueprint additionalSlots if V2 features added to V1

### No Risk

- ✅ **New Entity Definitions**: Cat ear and tail entities are isolated
- ✅ **Blueprint Creation**: New blueprint doesn't affect existing blueprints
- ✅ **Recipe Creation**: New recipe doesn't affect existing recipes

---

## Future Enhancements

### Hybrid Blueprint System

**Problem**: V1 blueprints don't support `additionalSlots`, requiring torso entity duplication

**Solution**: Add `additionalSlots` support to V1 blueprints

**Benefit**: Could simplify cat_girl blueprint by extending human_female blueprint with just tail slot

### Shape Descriptor Enhancement

**Current**: `descriptors:shape_general` component has generic shapes

**Enhancement**: Create specialized shape components:
- `descriptors:ear_shape`: `human`, `cat`, `elf`, `bat`, `etc`
- `descriptors:tail_shape`: `cat`, `fox`, `wolf`, `reptilian`, `etc`

**Benefit**: More semantic, easier to query/filter

### Fur Pattern Descriptor

**Enhancement**: Add `descriptors:fur_pattern` for striped, spotted, calico variations

```json
{
  "fur_pattern": {
    "type": "string",
    "enum": ["solid", "striped", "spotted", "calico", "tuxedo", "tortoiseshell"]
  }
}
```

### Cat Girl Variations

Create additional recipes for variety:
- `anatomy:cat_girl_minimal` - Just ears and tail
- `anatomy:cat_girl_enhanced` - Ears, tail, fangs, slit eyes
- `anatomy:cat_girl_extreme` - Paw hands/feet, full fur, whiskers

---

## Conclusion

This specification provides a comprehensive plan for implementing a cat girl anatomy recipe in the Living Narrative Engine. The approach:

1. ✅ **Maintains humanoid foundation** - Uses existing human_female anatomy as base
2. ✅ **Minimal system changes** - Only extends hairDensity descriptor and adds cat-specific entities
3. ✅ **Backwards compatible** - Doesn't affect existing recipes or blueprints
4. ✅ **Extensible** - Supports optional enhancements (fangs, whiskers, slit eyes)
5. ✅ **Well-tested** - Includes comprehensive integration tests
6. ✅ **Documented** - Clear implementation checklist and examples

### Recommended Implementation Order

1. **Descriptor Enhancement** (Required first - enables hairDensity: "furred")
2. **Entity Definitions** (Cat ears, tail, torso)
3. **Blueprint** (Cat girl blueprint with ear/tail slots)
4. **Recipe** (Standard cat girl recipe)
5. **Testing** (Integration tests and manual validation)
6. **Optional Enhancements** (Eyes, fangs, whiskers as desired)

### Estimated Effort

- **Core Implementation**: 4-6 hours
- **Testing**: 2-3 hours
- **Optional Enhancements**: 2-4 hours each
- **Total**: 8-15 hours (depending on optional features)

---

**Status**: Ready for Implementation
**Blockers**: None
**Dependencies**: None (descriptor enhancement is backwards compatible)
