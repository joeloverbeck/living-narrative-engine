# Body Descriptor Comprehensive Enhancement Specification

**Status**: Draft Specification
**Version**: 1.0
**Date**: 2025-11-09
**Category**: Anatomy System - Descriptor Enhancement
**Priority**: Medium

---

## Executive Summary

This specification proposes a comprehensive enhancement to the body descriptor system to address gaps identified during mod development. The primary driver is a user case where a modder creating a Lovecraftian abomination entity needed the descriptor value "atrophied" for the composition body descriptor but had to settle for "slim" instead, as "atrophied" was not available in the current system.

A systematic review of all body-level descriptors in the Body Descriptor Registry and part-level descriptor components reveals additional opportunities to expand descriptor vocabularies to support:

1. **Horror/Eldritch content**: Atrophied, emaciated, wasted, skeletal forms
2. **Extreme physiques**: Gigantic/colossal beings, frail/gaunt characters
3. **Fantasy creatures**: Non-standard body types and compositions
4. **Medical/realistic scenarios**: Malnourished, dehydrated, diseased states
5. **Consistency**: Align schema, registry, and component definitions

---

## Problem Statement

### 1.1 Triggering Use Case

**Context**: User creating `anatomy:writhing_observer` (Lovecraftian horror entity)

**Requirement**: Vestigial humanoid arms with atrophied musculature

**Current Workaround**: Used "slim" build descriptor instead

**Quote from Spec** (Line 1123):
```json
"descriptors:build": {
  "build": "atrophied"  // ❌ NOT AVAILABLE - had to use "slim" instead
}
```

**Impact**:
- Loss of descriptive precision
- Inability to accurately represent horror/medical conditions
- Modders forced to use inadequate approximations

### 1.2 Broader Issue

This is symptomatic of a larger gap: the descriptor system was designed with standard humanoids in mind and lacks vocabulary for:

- Extreme/abnormal body types
- Fantasy/horror creatures
- Medical conditions
- Non-standard anatomies

---

## Current State Analysis

### 2.1 Body Descriptor Registry

**Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Current Body-Level Descriptors** (6 total):

| Descriptor | Property | Type | Valid Values |
|------------|----------|------|--------------|
| height | `height` | Enum | gigantic, very-tall, tall, average, short, petite, tiny |
| skinColor | `skinColor` | Free-form | Any string |
| build | `build` | Enum | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky |
| composition | `composition` | Enum | underweight, lean, average, soft, chubby, overweight, obese |
| hairDensity | `hairDensity` | Enum | hairless, sparse, light, moderate, hairy, very-hairy |
| smell | `smell` | Free-form | Any string |

**Registry Display Order**:
1. height (10)
2. skinColor (20)
3. build (30)
4. composition (40)
5. hairDensity (50)
6. smell (60)

**Next Available Display Order**: 70

### 2.2 Schema Definitions

#### 2.2.1 Anatomy Recipe Schema

**Location**: `data/schemas/anatomy.recipe.schema.json`

**Body Descriptors Section** (Lines 135-198):

```json
"bodyDescriptors": {
  "type": "object",
  "properties": {
    "build": { "enum": ["skinny", "slim", "lissom", "toned", "athletic", "shapely", "hourglass", "thick", "muscular", "hulking", "stocky"] },
    "hairDensity": { "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"] },
    "composition": { "enum": ["underweight", "lean", "average", "soft", "chubby", "overweight", "obese"] },
    "skinColor": { "type": "string" },
    "smell": { "type": "string" },
    "height": { "enum": ["gigantic", "very-tall", "tall", "average", "short", "petite", "tiny"] }
  }
}
```

#### 2.2.2 Descriptor Components

**Location**: `data/mods/descriptors/components/`

Key findings:

**height.component.json**:
- ⚠️ **INCONSISTENCY DETECTED**
- Component defines: `tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic`
- Schema/Registry define: `gigantic, very-tall, tall, average, short, petite, tiny`
- **Missing in schema/registry**: `colossal`, `titanic`

**build.component.json**:
- Matches schema/registry exactly
- No "atrophied", "frail", "gaunt", "skeletal", "emaciated"

**body_composition.component.json**:
- Matches schema/registry exactly
- No "atrophied", "emaciated", "malnourished", "wasted", "dehydrated"

**body_hair.component.json**:
- Has both `hairDensity` (current) and deprecated `density` field
- Matches schema/registry for hairDensity

---

## Gap Analysis

### 3.1 Critical Gaps

#### 3.1.1 Body Descriptor: composition

**Current Values** (7):
```
underweight, lean, average, soft, chubby, overweight, obese
```

**Missing Values for Horror/Medical Use Cases**:

| Value | Use Case | Description |
|-------|----------|-------------|
| `atrophied` | Horror, Medical | Wasted muscles, severe muscle loss |
| `emaciated` | Horror, Medical | Extreme thinness from starvation |
| `skeletal` | Horror, Undead | Visible bones, skin stretched over skeleton |
| `malnourished` | Realistic, Medical | Insufficient nutrition |
| `dehydrated` | Medical, Desert | Severe fluid loss |
| `wasted` | Horror, Disease | General wasting away |
| `desiccated` | Horror, Undead | Dried out, mummified |
| `bloated` | Horror, Disease | Abnormal swelling |
| `rotting` | Horror, Undead | Decomposing flesh |

**Priority**: HIGH (directly addresses user request)

#### 3.1.2 Body Descriptor: build

**Current Values** (11):
```
skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
```

**Missing Values for Extreme Physiques**:

| Value | Use Case | Description |
|-------|----------|-------------|
| `frail` | Elderly, Sick | Weak, delicate build |
| `gaunt` | Horror, Starvation | Extremely thin and angular |
| `skeletal` | Horror, Undead | Bones visible through skin |
| `atrophied` | Medical, Horror | Wasted muscles |
| `cadaverous` | Horror, Undead | Corpse-like build |
| `massive` | Giants, Monsters | Extremely large build |
| `willowy` | Elves, Dancers | Slender and graceful |
| `barrel-chested` | Warriors, Dwarves | Wide torso |
| `lanky` | Tall, Gangly | Tall and thin with long limbs |

**Priority**: HIGH (user requested for vestigial arms)

#### 3.1.3 Body Descriptor: height

**Current Values in Schema/Registry** (7):
```
gigantic, very-tall, tall, average, short, petite, tiny
```

**Values in Component but NOT in Schema/Registry** (2):
```
colossal, titanic
```

**Analysis**:
- Component is ahead of schema/registry
- Need to sync: add `colossal` and `titanic` to schema and registry
- Consider additional values for very small creatures

**Missing Values**:

| Value | Use Case | Description |
|-------|----------|-------------|
| `colossal` ✓ | Giants, Kaiju | Already in component, needs schema/registry |
| `titanic` ✓ | Titans, Kaiju | Already in component, needs schema/registry |
| `minuscule` | Fairies, Insects | Extremely tiny (smaller than tiny) |
| `microscopic` | Magical, Horror | Impossibly small |

**Priority**: MEDIUM (sync existing inconsistency)

### 3.2 Part-Level Descriptor Gaps

#### 3.2.1 descriptors:build (Part-Level)

**Current Values** (11): Same as body-level build

**Recommendation**: Should mirror body-level enhancements when body-level is updated

#### 3.2.2 descriptors:body_composition (Part-Level)

**Current Values** (7): Same as body-level composition

**Recommendation**: Should mirror body-level enhancements when body-level is updated

#### 3.2.3 descriptors:deformity (Part-Level)

**Location**: `data/mods/descriptors/components/deformity.component.json`

**Current Values** (5):
```
none, twisted-joints, extra-joints, fused-segments, asymmetric
```

**Missing Values for Horror/Medical**:

| Value | Use Case | Description |
|-------|----------|-------------|
| `atrophied` | Medical, Horror | Wasted, withered part |
| `withered` | Aging, Curse | Shrunken, dried |
| `vestigial` | Evolution, Horror | Underdeveloped remnant |
| `hypertrophied` | Medical, Mutation | Abnormally enlarged |
| `necrotic` | Disease, Undead | Dead tissue |
| `gangrenous` | Disease | Decaying tissue |
| `malformed` | Birth defect | Improperly formed |
| `bifurcated` | Mutation | Split into two |
| `supernumerary` | Mutation | Extra copies |

**Priority**: MEDIUM (extends part-level expressiveness)

#### 3.2.4 descriptors:structural_integrity (Part-Level)

**Location**: `data/mods/descriptors/components/structural_integrity.component.json`

**Current Values** (5):
```
fragile, normal, reinforced, regenerative, insufficient-for-flight
```

**Missing Values**:

| Value | Use Case | Description |
|-------|----------|-------------|
| `brittle` | Old age, Disease | Easily broken |
| `calcified` | Medical | Hardened with calcium |
| `ossified` | Medical | Turned to bone |
| `cartilaginous` | Fantasy | Made of cartilage |
| `chitinous` | Insects, Armor | Hard exoskeleton |
| `crystalline` | Fantasy, Elemental | Made of crystal |
| `gelatinous` | Oozes, Jellies | Jelly-like consistency |
| `ethereal` | Ghosts, Spirits | Non-solid, ghostly |

**Priority**: LOW (nice-to-have)

---

## Proposed Enhancements

### 4.1 Body-Level Descriptors (High Priority)

#### 4.1.1 Enhanced `composition` Descriptor

**Add 9 new values**:

```json
{
  "composition": {
    "type": "string",
    "enum": [
      // Existing values (7)
      "underweight",
      "lean",
      "average",
      "soft",
      "chubby",
      "overweight",
      "obese",

      // NEW: Horror/Medical/Fantasy (9)
      "atrophied",      // ⭐ PRIMARY REQUEST
      "emaciated",      // Extreme thinness
      "skeletal",       // Visible bones
      "malnourished",   // Poor nutrition
      "dehydrated",     // Severe fluid loss
      "wasted",         // General wasting
      "desiccated",     // Dried out, mummified
      "bloated",        // Abnormal swelling
      "rotting"         // Decomposing (undead)
    ]
  }
}
```

**Total**: 16 values (was 7)

**Rationale**:
- Directly addresses user request for "atrophied"
- Enables horror content (skeletal, wasted, rotting)
- Supports medical scenarios (malnourished, dehydrated)
- Maintains backward compatibility (all existing values preserved)

#### 4.1.2 Enhanced `build` Descriptor

**Add 9 new values**:

```json
{
  "build": {
    "type": "string",
    "enum": [
      // Existing values (11)
      "skinny", "slim", "lissom", "toned", "athletic",
      "shapely", "hourglass", "thick", "muscular", "hulking", "stocky",

      // NEW: Extreme/Fantasy (9)
      "frail",          // Weak, delicate
      "gaunt",          // Extremely thin and angular
      "skeletal",       // Bones visible
      "atrophied",      // Wasted muscles (horror arms)
      "cadaverous",     // Corpse-like
      "massive",        // Extremely large
      "willowy",        // Slender and graceful
      "barrel-chested", // Wide torso
      "lanky"           // Tall and thin
    ]
  }
}
```

**Total**: 20 values (was 11)

**Rationale**:
- Provides "atrophied" option for build (user's vestigial arms case)
- Covers extreme ends of spectrum (frail → massive)
- Adds fantasy-specific builds (willowy for elves)
- Supports horror content (skeletal, cadaverous, gaunt)

#### 4.1.3 Enhanced `height` Descriptor

**Sync with component + add values**:

```json
{
  "height": {
    "type": "string",
    "enum": [
      // Existing in schema (7)
      "tiny", "petite", "short", "average", "tall", "very-tall", "gigantic",

      // From component, not in schema (2) - SYNC NEEDED
      "colossal",       // Larger than gigantic
      "titanic",        // Largest size

      // NEW: Very small (2)
      "minuscule",      // Smaller than tiny
      "microscopic"     // Impossibly small
    ]
  }
}
```

**Total**: 11 values (was 7, component had 9)

**Rationale**:
- Fixes inconsistency between component and schema
- User already using "colossal" and "titanic" in component
- Adds very small options for fairies, insects, etc.

### 4.2 Part-Level Descriptor Enhancements (Medium Priority)

#### 4.2.1 Enhanced `descriptors:deformity`

**Add 9 new values**:

```json
{
  "deformity": {
    "type": "string",
    "enum": [
      // Existing (5)
      "none", "twisted-joints", "extra-joints", "fused-segments", "asymmetric",

      // NEW: Medical/Horror (9)
      "atrophied",      // Wasted, withered
      "withered",       // Shrunken, dried
      "vestigial",      // Underdeveloped remnant
      "hypertrophied",  // Abnormally enlarged
      "necrotic",       // Dead tissue
      "gangrenous",     // Decaying tissue
      "malformed",      // Improperly formed
      "bifurcated",     // Split into two
      "supernumerary"   // Extra copies
    ]
  }
}
```

**Total**: 14 values (was 5)

#### 4.2.2 Enhanced `descriptors:structural_integrity`

**Add 8 new values**:

```json
{
  "integrity": {
    "type": "string",
    "enum": [
      // Existing (5)
      "fragile", "normal", "reinforced", "regenerative", "insufficient-for-flight",

      // NEW: Material types (8)
      "brittle",        // Easily broken
      "calcified",      // Hardened with calcium
      "ossified",       // Turned to bone
      "cartilaginous",  // Made of cartilage
      "chitinous",      // Hard exoskeleton
      "crystalline",    // Made of crystal
      "gelatinous",     // Jelly-like
      "ethereal"        // Non-solid, ghostly
    ]
  }
}
```

**Total**: 13 values (was 5)

---

## Implementation Plan

### 5.1 Phase 1: Body Descriptor Registry Updates (HIGH PRIORITY)

#### Step 1.1: Update Body Descriptor Registry

**File**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Changes Required**:

1. Update `composition` descriptor:
```javascript
composition: {
  schemaProperty: 'composition',
  displayLabel: 'Body composition',
  displayKey: 'body_composition',
  dataPath: 'body.descriptors.composition',
  validValues: [
    'underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese',
    'atrophied', 'emaciated', 'skeletal', 'malnourished', 'dehydrated',
    'wasted', 'desiccated', 'bloated', 'rotting'
  ],
  displayOrder: 40,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.composition,
  formatter: (value) => `Body composition: ${value}`,
  required: false,
}
```

2. Update `build` descriptor:
```javascript
build: {
  schemaProperty: 'build',
  displayLabel: 'Build',
  displayKey: 'build',
  dataPath: 'body.descriptors.build',
  validValues: [
    'skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass',
    'thick', 'muscular', 'hulking', 'stocky',
    'frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous', 'massive',
    'willowy', 'barrel-chested', 'lanky'
  ],
  displayOrder: 30,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.build,
  formatter: (value) => `Build: ${value}`,
  required: false,
}
```

3. Update `height` descriptor:
```javascript
height: {
  schemaProperty: 'height',
  displayLabel: 'Height',
  displayKey: 'height',
  dataPath: 'body.descriptors.height',
  validValues: [
    'microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average',
    'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'
  ],
  displayOrder: 10,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.height,
  formatter: (value) => `Height: ${value}`,
  required: false,
}
```

**Validation**: Run `npm run validate:body-descriptors`

#### Step 1.2: Update Anatomy Recipe Schema

**File**: `data/schemas/anatomy.recipe.schema.json`

Update the `bodyDescriptors` section (lines 135-198) with new enum values:

```json
"bodyDescriptors": {
  "type": "object",
  "description": "Optional body-level descriptors to apply to generated body",
  "properties": {
    "build": {
      "type": "string",
      "enum": [
        "skinny", "slim", "lissom", "toned", "athletic", "shapely",
        "hourglass", "thick", "muscular", "hulking", "stocky",
        "frail", "gaunt", "skeletal", "atrophied", "cadaverous",
        "massive", "willowy", "barrel-chested", "lanky"
      ]
    },
    "hairDensity": {
      "type": "string",
      "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]
    },
    "composition": {
      "type": "string",
      "enum": [
        "underweight", "lean", "average", "soft", "chubby", "overweight", "obese",
        "atrophied", "emaciated", "skeletal", "malnourished", "dehydrated",
        "wasted", "desiccated", "bloated", "rotting"
      ]
    },
    "skinColor": {
      "type": "string"
    },
    "smell": {
      "type": "string"
    },
    "height": {
      "type": "string",
      "enum": [
        "microscopic", "minuscule", "tiny", "petite", "short", "average",
        "tall", "very-tall", "gigantic", "colossal", "titanic"
      ]
    }
  },
  "additionalProperties": false
}
```

**Validation**: Run `npm run validate` or `npm run validate:strict`

### 5.2 Phase 2: Descriptor Component Updates (MEDIUM PRIORITY)

#### Step 2.1: Update Part-Level Descriptor Components

**Files to Modify**:

1. `data/mods/descriptors/components/build.component.json`
   - Update enum to match body-level build descriptor

2. `data/mods/descriptors/components/body_composition.component.json`
   - Update enum to match body-level composition descriptor

3. `data/mods/descriptors/components/height.component.json`
   - Already has colossal/titanic, just verify consistency

4. `data/mods/descriptors/components/deformity.component.json`
   - Add 9 new deformity values

5. `data/mods/descriptors/components/structural_integrity.component.json`
   - Add 8 new integrity values

#### Step 2.2: Example: Enhanced deformity.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:deformity",
  "description": "Describes abnormal or malformed characteristics of a body part",
  "dataSchema": {
    "type": "object",
    "properties": {
      "deformity": {
        "type": "string",
        "description": "The type of deformity or abnormality",
        "enum": [
          "none",
          "twisted-joints",
          "extra-joints",
          "fused-segments",
          "asymmetric",
          "atrophied",
          "withered",
          "vestigial",
          "hypertrophied",
          "necrotic",
          "gangrenous",
          "malformed",
          "bifurcated",
          "supernumerary"
        ],
        "default": "none"
      }
    },
    "required": ["deformity"],
    "additionalProperties": false
  }
}
```

### 5.3 Phase 3: Testing (CRITICAL)

#### Step 3.1: Registry Validation Tests

**File**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

```javascript
describe('Body Descriptor Registry - Enhanced Values', () => {
  describe('composition descriptor', () => {
    it('should include new horror/medical values', () => {
      const metadata = getDescriptorMetadata('composition');
      expect(metadata.validValues).toContain('atrophied');
      expect(metadata.validValues).toContain('emaciated');
      expect(metadata.validValues).toContain('skeletal');
      expect(metadata.validValues).toContain('wasted');
    });

    it('should validate atrophied as valid value', () => {
      const result = validateDescriptorValue('composition', 'atrophied');
      expect(result.valid).toBe(true);
    });
  });

  describe('build descriptor', () => {
    it('should include new extreme physique values', () => {
      const metadata = getDescriptorMetadata('build');
      expect(metadata.validValues).toContain('atrophied');
      expect(metadata.validValues).toContain('frail');
      expect(metadata.validValues).toContain('skeletal');
      expect(metadata.validValues).toContain('gaunt');
    });
  });

  describe('height descriptor', () => {
    it('should include colossal and titanic from component', () => {
      const metadata = getDescriptorMetadata('height');
      expect(metadata.validValues).toContain('colossal');
      expect(metadata.validValues).toContain('titanic');
    });

    it('should include new very small values', () => {
      const metadata = getDescriptorMetadata('height');
      expect(metadata.validValues).toContain('minuscule');
      expect(metadata.validValues).toContain('microscopic');
    });
  });
});
```

#### Step 3.2: Recipe Validation Tests

**File**: `tests/integration/anatomy/recipeEnhancedDescriptors.test.js`

```javascript
describe('Anatomy Recipe - Enhanced Descriptors', () => {
  it('should accept atrophied composition in recipe', async () => {
    const recipe = {
      recipeId: 'test:horror_entity',
      blueprintId: 'anatomy:humanoid',
      bodyDescriptors: {
        composition: 'atrophied',
        build: 'skeletal'
      },
      slots: {}
    };

    // Should validate without errors
    expect(() => validateRecipe(recipe)).not.toThrow();
  });

  it('should apply atrophied descriptor to generated body', async () => {
    const recipe = createRecipeWithDescriptors({
      composition: 'atrophied',
      build: 'gaunt'
    });

    const entity = await anatomyWorkflow.generateAnatomy(recipe);
    const bodyComponent = entity.getComponentData('anatomy:body');

    expect(bodyComponent.body.descriptors.composition).toBe('atrophied');
    expect(bodyComponent.body.descriptors.build).toBe('gaunt');
  });
});
```

#### Step 3.3: Description Composer Tests

**File**: `tests/unit/anatomy/bodyDescriptionComposer.test.js`

```javascript
describe('BodyDescriptionComposer - Enhanced Descriptors', () => {
  it('should format atrophied composition correctly', async () => {
    const entity = createEntityWithBodyDescriptors({
      composition: 'atrophied'
    });

    const description = await composer.composeDescription(entity);
    expect(description).toContain('Body composition: atrophied');
  });

  it('should handle skeletal build in description', async () => {
    const entity = createEntityWithBodyDescriptors({
      build: 'skeletal',
      composition: 'emaciated'
    });

    const description = await composer.composeDescription(entity);
    expect(description).toContain('Build: skeletal');
    expect(description).toContain('Body composition: emaciated');
  });

  it('should handle colossal height correctly', async () => {
    const entity = createEntityWithBodyDescriptors({
      height: 'colossal'
    });

    const description = await composer.composeDescription(entity);
    expect(description).toContain('Height: colossal');
  });
});
```

#### Step 3.4: End-to-End Horror Entity Test

**File**: `tests/integration/anatomy/horrorEntityCreation.test.js`

```javascript
describe('Horror Entity Creation - Writhing Observer Use Case', () => {
  it('should create entity with atrophied vestigial arms', async () => {
    const recipe = {
      recipeId: 'anatomy:writhing_observer',
      blueprintId: 'anatomy:writhing_observer',
      bodyDescriptors: {
        build: 'hulking',
        composition: 'grotesque', // Still not valid - use skinColor for this
        height: 'gigantic',
        skinColor: 'translucent-gray'
      },
      patterns: [
        {
          matchesGroup: 'limbSet:vestigial_arm',
          partType: 'eldritch_vestigial_arm',
          properties: {
            'descriptors:build': { build: 'atrophied' },  // ✅ NOW AVAILABLE
            'descriptors:deformity': { deformity: 'twisted-joints' }
          }
        }
      ]
    };

    const entity = await anatomyWorkflow.generateAnatomy(recipe);

    // Verify body descriptors
    const bodyComponent = entity.getComponentData('anatomy:body');
    expect(bodyComponent.body.descriptors.build).toBe('hulking');
    expect(bodyComponent.body.descriptors.height).toBe('gigantic');

    // Verify part-level atrophied descriptor on vestigial arms
    const armPartId = bodyComponent.body.parts.vestigial_arm_1;
    const armEntity = entityManager.getEntity(armPartId);
    const buildComponent = armEntity.getComponentData('descriptors:build');

    expect(buildComponent.build).toBe('atrophied');  // ✅ SUCCESS
  });
});
```

### 5.4 Phase 4: Documentation Updates

#### Step 4.1: Update Body Descriptor Documentation

**File**: `docs/anatomy/body-descriptors-complete.md`

Add section documenting new values:

```markdown
## Enhanced Body Descriptors (v1.2.0)

### Composition Enhancements

Added 9 new values for horror, medical, and fantasy use cases:

- **atrophied**: Wasted muscles, severe muscle loss (e.g., vestigial limbs)
- **emaciated**: Extreme thinness from starvation
- **skeletal**: Visible bones, skin stretched over skeleton
- **malnourished**: Insufficient nutrition
- **dehydrated**: Severe fluid loss
- **wasted**: General wasting away
- **desiccated**: Dried out, mummified
- **bloated**: Abnormal swelling
- **rotting**: Decomposing flesh (undead)

### Build Enhancements

Added 9 new values for extreme and fantasy physiques:

- **frail**: Weak, delicate build
- **gaunt**: Extremely thin and angular
- **skeletal**: Bones visible through skin
- **atrophied**: Wasted muscles
- **cadaverous**: Corpse-like build
- **massive**: Extremely large build
- **willowy**: Slender and graceful (elves, dancers)
- **barrel-chested**: Wide torso (warriors, dwarves)
- **lanky**: Tall and thin with long limbs

### Height Enhancements

Synchronized with component definitions and added extreme values:

- **colossal**: Larger than gigantic (sync from component)
- **titanic**: Largest size (sync from component)
- **minuscule**: Smaller than tiny (fairies, insects)
- **microscopic**: Impossibly small (magical creatures)
```

#### Step 4.2: Update Mod Development Guide

Add examples showing how to use new descriptors:

```markdown
## Creating Horror Entities

Example: Eldritch abomination with atrophied vestigial arms

\`\`\`json
{
  "bodyDescriptors": {
    "build": "hulking",
    "height": "colossal",
    "composition": "rotting"
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:vestigial_arm",
      "properties": {
        "descriptors:build": { "build": "atrophied" },
        "descriptors:deformity": { "deformity": "withered" }
      }
    }
  ]
}
\`\`\`
```

### 5.5 Phase 5: Migration & Communication

#### Step 5.1: Update CHANGELOG

```markdown
## [1.2.0] - 2025-11-XX

### Added

#### Body Descriptors
- **composition**: Added 9 new values (atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting)
- **build**: Added 9 new values (frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky)
- **height**: Added 4 new values (colossal, titanic, minuscule, microscopic)

#### Part-Level Descriptors
- **deformity**: Added 9 new values (atrophied, withered, vestigial, hypertrophied, necrotic, gangrenous, malformed, bifurcated, supernumerary)
- **structural_integrity**: Added 8 new values (brittle, calcified, ossified, cartilaginous, chitinous, crystalline, gelatinous, ethereal)

### Fixed
- Synchronized height descriptor between component, schema, and registry (added colossal, titanic)
```

#### Step 5.2: Modder Communication

Create announcement in mod development channels:

```
🎉 Body Descriptor System Enhanced! 🎉

We've significantly expanded the vocabulary of body descriptors based on community feedback.

**Highlight**: You can now use "atrophied" for composition and build!

This addresses the Lovecraftian horror use case where modders needed to describe wasted, atrophied limbs and bodies.

**New Values Added**:
- Composition: atrophied, emaciated, skeletal, wasted, rotting, and more
- Build: atrophied, frail, gaunt, skeletal, cadaverous, massive, and more
- Height: colossal, titanic, minuscule, microscopic

**Breaking Changes**: None - all changes are additive

**Migration**: No action required - existing content continues to work

See documentation for full details: docs/anatomy/body-descriptors-complete.md
```

---

## Validation & Quality Assurance

### 6.1 Pre-Release Checklist

- [ ] All registry validValues updated
- [ ] All schema enums updated
- [ ] All component enums updated
- [ ] Registry validation tests pass (`npm run validate:body-descriptors`)
- [ ] Schema validation passes (`npm run validate`)
- [ ] Unit tests written and passing (80%+ coverage)
- [ ] Integration tests written and passing
- [ ] End-to-end horror entity test passes
- [ ] Description composer handles all new values
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] No performance regression (run performance tests)
- [ ] Backward compatibility verified (existing recipes still work)

### 6.2 Validation Commands

```bash
# Schema validation
npm run validate:strict

# Body descriptor system validation
npm run validate:body-descriptors

# Run all tests
npm run test:ci

# Run specific test suites
npm run test:unit -- tests/unit/anatomy/
npm run test:integration -- tests/integration/anatomy/

# Performance validation
npm run test:performance -- tests/performance/anatomy/

# Lint code changes
npx eslint src/anatomy/registries/bodyDescriptorRegistry.js
npx eslint src/anatomy/bodyDescriptionComposer.js
```

---

## Impact Analysis

### 7.1 Affected Systems

| System | Impact | Changes Required |
|--------|--------|------------------|
| Body Descriptor Registry | HIGH | Add new validValues arrays |
| Anatomy Recipe Schema | HIGH | Expand enum definitions |
| Part Descriptor Components | MEDIUM | Update component enums |
| Body Description Composer | LOW | No changes (handles all string values) |
| Anatomy Generation Workflow | NONE | Works with any valid descriptor |
| Mod Content | POSITIVE | More expressive vocabulary available |

### 7.2 Backward Compatibility

**Status**: ✅ FULLY BACKWARD COMPATIBLE

- All existing descriptor values retained
- Only adding new values, not removing any
- Existing recipes/content continue to work unchanged
- No breaking changes to APIs or schemas

### 7.3 Performance Impact

**Expected**: ⚡ NEGLIGIBLE TO POSITIVE

- Registry lookups: O(1) (no change)
- Validation: O(n) where n = enum size (minimal increase)
- Memory: ~1KB additional string data (negligible)
- Potential improvement: Larger vocabularies may reduce need for free-form strings

---

## Risk Assessment

### 8.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Registry/schema mismatch | LOW | HIGH | Automated validation tests |
| Invalid descriptor values in content | LOW | MEDIUM | Schema validation at load time |
| Confusing similar values | MEDIUM | LOW | Clear documentation, examples |
| Modder adoption issues | LOW | LOW | Backward compatible, opt-in |

### 8.2 Contingency Plans

**If issues discovered post-release**:

1. **Rollback**: Revert registry/schema changes (values never used in content yet)
2. **Hotfix**: Correct specific value issues without full rollback
3. **Deprecation**: Mark problematic values as deprecated, add better alternatives

---

## Success Criteria

This enhancement will be considered successful when:

1. ✅ User can create Lovecraftian horror with `composition: "atrophied"`
2. ✅ User can define `build: "atrophied"` for vestigial arms
3. ✅ All validation tests pass
4. ✅ No backward compatibility issues reported
5. ✅ Documentation clearly explains new values
6. ✅ Height descriptor inconsistency resolved (colossal/titanic synced)
7. ✅ Community feedback positive on expanded vocabulary

---

## Timeline Estimate

### Development Phases

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1 | Registry & Schema Updates | 2-3 hours |
| 2 | Component Updates | 2-3 hours |
| 3 | Testing (Unit + Integration) | 4-6 hours |
| 4 | Documentation | 2-3 hours |
| 5 | Migration & Communication | 1-2 hours |

**Total Estimated Time**: 11-17 hours (1.5-2 days)

**Recommended Schedule**:
- Day 1 Morning: Phases 1-2 (updates)
- Day 1 Afternoon: Phase 3 (testing)
- Day 2 Morning: Phase 4 (documentation)
- Day 2 Afternoon: Phase 5 (migration), final validation

---

## References

### Primary Documents

1. **Body Descriptor Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`
2. **Recipe Schema**: `data/schemas/anatomy.recipe.schema.json`
3. **Descriptor Components**: `data/mods/descriptors/components/`
4. **Body Descriptor Docs**: `docs/anatomy/body-descriptors-complete.md`
5. **Triggering Spec**: `specs/lovecraftian-abomination-the-writhing-observer.spec.md`

### Related Specifications

1. **Body Descriptor Migration**: `specs/body-descriptor-migration.spec.md`
2. **Body Descriptor Robustness**: `specs/body-descriptor-robustness-refactoring.spec.md`

### Validation Tools

1. **Validator**: `src/anatomy/validators/bodyDescriptorValidator.js`
2. **CLI Command**: `npm run validate:body-descriptors`

---

## Appendices

### Appendix A: Complete Enhanced Value Lists

#### A.1 Body-Level Descriptors

**composition** (16 total):
```
underweight, lean, average, soft, chubby, overweight, obese,
atrophied, emaciated, skeletal, malnourished, dehydrated,
wasted, desiccated, bloated, rotting
```

**build** (20 total):
```
skinny, slim, lissom, toned, athletic, shapely, hourglass,
thick, muscular, hulking, stocky,
frail, gaunt, skeletal, atrophied, cadaverous, massive,
willowy, barrel-chested, lanky
```

**height** (11 total):
```
microscopic, minuscule, tiny, petite, short, average,
tall, very-tall, gigantic, colossal, titanic
```

#### A.2 Part-Level Descriptors

**deformity** (14 total):
```
none, twisted-joints, extra-joints, fused-segments, asymmetric,
atrophied, withered, vestigial, hypertrophied, necrotic,
gangrenous, malformed, bifurcated, supernumerary
```

**structural_integrity** (13 total):
```
fragile, normal, reinforced, regenerative, insufficient-for-flight,
brittle, calcified, ossified, cartilaginous, chitinous,
crystalline, gelatinous, ethereal
```

### Appendix B: Use Case Examples

#### Horror/Undead
```json
{
  "bodyDescriptors": {
    "composition": "rotting",
    "build": "skeletal",
    "height": "tall",
    "skinColor": "corpse-gray"
  }
}
```

#### Eldritch Abomination
```json
{
  "bodyDescriptors": {
    "composition": "bloated",
    "build": "massive",
    "height": "colossal"
  }
}
```

#### Starving Survivor
```json
{
  "bodyDescriptors": {
    "composition": "emaciated",
    "build": "gaunt",
    "height": "average"
  }
}
```

#### Fairy Creature
```json
{
  "bodyDescriptors": {
    "composition": "lean",
    "build": "willowy",
    "height": "minuscule"
  }
}
```

#### Diseased Patient
```json
{
  "bodyDescriptors": {
    "composition": "malnourished",
    "build": "frail",
    "height": "short"
  }
}
```

### Appendix C: Glossary

- **Body-level descriptors**: Overall characteristics applied to entire body via `bodyDescriptors` in recipe
- **Part-level descriptors**: Characteristics applied to individual body parts via component properties
- **Body Descriptor Registry**: Centralized metadata for all body-level descriptors (`src/anatomy/registries/bodyDescriptorRegistry.js`)
- **Descriptor Component**: JSON component definition with enum values for a descriptor type
- **Enumerated descriptor**: Descriptor with predefined valid values (e.g., build, composition)
- **Free-form descriptor**: Descriptor accepting any string value (e.g., skinColor, smell)

---

**Document Status**: DRAFT - Ready for Review
**Approval Required**: Architecture Team, Content Team
**Target Release**: Version 1.2.0
**Priority**: HIGH (user-requested feature)
**Effort**: Medium (1.5-2 days development)

**End of Specification**
