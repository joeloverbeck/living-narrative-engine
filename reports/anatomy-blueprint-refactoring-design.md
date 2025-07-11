# Anatomy Blueprint Refactoring Design

## Executive Summary

The current anatomy blueprint system in the Living Narrative Engine contains significant repetition across different blueprint definitions. Analysis of the existing `human_male` and `human_female` blueprints reveals approximately **85-90% duplication** in slot definitions and **80% duplication** in clothing slot mappings. This document proposes several design options to reduce this repetition while maintaining flexibility and compatibility with the existing modding system.

### Key Benefits of Refactoring

- **Reduced maintenance burden**: Changes to common anatomy structures only need to be made once
- **Smaller file sizes**: Blueprint definitions shrink by 80-90%
- **Better consistency**: Shared definitions ensure uniform behavior
- **Easier modding**: Modders can focus on unique aspects rather than boilerplate

## Problem Analysis

### Current State Metrics

#### Slot Definitions Analysis

- **Total slots in human_male**: 22
- **Total slots in human_female**: 22
- **Identical slots**: 19 (86.4%)
- **Gender-specific slots**:
  - Male only: penis, left_testicle, right_testicle (3)
  - Female only: left_breast, right_breast, vagina (3)

#### Clothing Slot Mappings Analysis

- **Total mappings in human_male**: 10
- **Total mappings in human_female**: 11
- **Identical mappings**: 8 (72.7%)
- **Gender-specific mappings**:
  - Male only: genital_covering
  - Female only: bra, panties

### Repetition Examples

Common slot pattern repeated across both blueprints:

```json
"head": {
  "socket": "neck",
  "requirements": {
    "partType": "head",
    "components": ["anatomy:part"]
  }
}
```

This exact pattern appears for: head, left_arm, right_arm, left_leg, right_leg, left_eye, right_eye, left_ear, right_ear, nose, mouth, teeth, hair, left_hand, right_hand, left_foot, right_foot, asshole, and pubic_hair.

## Design Options

### Option 1: Blueprint Parts with Composition

This approach introduces reusable "blueprint parts" that can be composed into complete blueprints, similar to how the macro system works for operations.

#### Schema Addition

```json
// New file: data/schemas/anatomy.blueprint-part.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/schemas/anatomy.blueprint-part.schema.json",
  "title": "Anatomy Blueprint Part",
  "description": "Reusable anatomy structure definitions",
  "type": "object",
  "properties": {
    "id": {
      "$ref": "./common.schema.json#/definitions/namespacedId"
    },
    "description": {
      "type": "string"
    },
    "slots": {
      "$ref": "./anatomy.blueprint.schema.json#/properties/slots"
    },
    "clothingSlotMappings": {
      "$ref": "./anatomy.blueprint.schema.json#/properties/clothingSlotMappings"
    }
  },
  "required": ["id"],
  "additionalProperties": false
}
```

#### Example Blueprint Part

```json
// data/mods/anatomy/blueprint-parts/humanoid_base.part.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint-part.schema.json",
  "id": "anatomy:humanoid_base",
  "description": "Common humanoid anatomy structure",
  "slots": {
    "head": {
      "socket": "neck",
      "requirements": {
        "partType": "head",
        "components": ["anatomy:part"]
      }
    },
    "left_arm": {
      "socket": "left_shoulder",
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    }
    // ... all common slots
  },
  "clothingSlotMappings": {
    "head_gear": {
      "blueprintSlots": ["head"],
      "allowedLayers": ["base", "outer", "armor"],
      "layerOrder": ["base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["head", "armor_slot"]
    }
    // ... all common mappings
  }
}
```

#### Updated Blueprint Using Parts

```json
// data/mods/anatomy/blueprints/human_male.blueprint.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "parts": ["anatomy:humanoid_base"], // New field
  "slots": {
    // Only gender-specific slots
    "penis": {
      "socket": "penis",
      "requirements": {
        "partType": "penis",
        "components": ["anatomy:part"]
      }
    },
    "left_testicle": {
      "socket": "left_testicle",
      "requirements": {
        "partType": "testicle",
        "components": ["anatomy:part"]
      }
    },
    "right_testicle": {
      "socket": "right_testicle",
      "requirements": {
        "partType": "testicle",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    // Only gender-specific mappings
    "genital_covering": {
      "anatomySockets": ["penis", "left_testicle", "right_testicle"],
      "allowedLayers": ["underwear"],
      "layerOrder": ["underwear"],
      "defaultLayer": "underwear",
      "tags": ["underwear", "male_specific"]
    }
  }
}
```

### Option 2: Template Inheritance Model

This approach uses explicit inheritance where blueprints can extend a base template.

#### Schema Modification

```json
// Add to anatomy.blueprint.schema.json
{
  "properties": {
    "extends": {
      "$ref": "./common.schema.json#/definitions/namespacedId",
      "description": "Blueprint to inherit from"
    }
    // ... existing properties
  }
}
```

#### Base Template

```json
// data/mods/anatomy/blueprints/humanoid_template.blueprint.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint.schema.json",
  "id": "anatomy:humanoid_template",
  "abstract": true, // New field to mark as non-instantiable
  "root": null, // Must be overridden
  "slots": {
    // All common slots
  },
  "clothingSlotMappings": {
    // All common mappings
  }
}
```

#### Child Blueprint

```json
// data/mods/anatomy/blueprints/human_male.blueprint.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "extends": "anatomy:humanoid_template",
  "root": "anatomy:human_male_torso",
  "slots": {
    // Additions/overrides only
    "penis": {
      /* ... */
    },
    "left_testicle": {
      /* ... */
    },
    "right_testicle": {
      /* ... */
    }
  },
  "clothingSlotMappings": {
    "genital_covering": {
      /* ... */
    }
  }
}
```

### Option 3: Slot Definition Libraries

This approach creates a centralized library of slot definitions that blueprints reference.

#### Slot Library Schema

```json
// data/schemas/anatomy.slot-library.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/schemas/anatomy.slot-library.schema.json",
  "title": "Anatomy Slot Library",
  "type": "object",
  "properties": {
    "id": {
      "$ref": "./common.schema.json#/definitions/namespacedId"
    },
    "slotDefinitions": {
      "type": "object",
      "additionalProperties": {
        "$ref": "./anatomy.blueprint.schema.json#/definitions/blueprintSlot"
      }
    },
    "clothingDefinitions": {
      "type": "object",
      "additionalProperties": {
        "$ref": "./anatomy.blueprint.schema.json#/definitions/clothingSlotMapping"
      }
    }
  }
}
```

#### Library Definition

```json
// data/mods/anatomy/libraries/humanoid.slot-library.json
{
  "$schema": "http://example.com/schemas/anatomy.slot-library.schema.json",
  "id": "anatomy:humanoid_slots",
  "slotDefinitions": {
    "standard_head": {
      "socket": "neck",
      "requirements": {
        "partType": "head",
        "components": ["anatomy:part"]
      }
    },
    "standard_arm": {
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    }
    // ... all reusable definitions
  },
  "clothingDefinitions": {
    "standard_head_gear": {
      "blueprintSlots": ["head"],
      "allowedLayers": ["base", "outer", "armor"],
      "layerOrder": ["base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["head", "armor_slot"]
    }
    // ... all reusable clothing mappings
  }
}
```

#### Blueprint Using Library

```json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "libraries": ["anatomy:humanoid_slots"],
  "slots": {
    "head": { "$ref": "anatomy:humanoid_slots#standard_head" },
    "left_arm": {
      "$ref": "anatomy:humanoid_slots#standard_arm",
      "socket": "left_shoulder" // Override specific property
    },
    // Gender-specific inline definitions
    "penis": {
      /* ... */
    }
  }
}
```

### Option 4: Hybrid Approach (Recommended)

Combines the best features of Options 1 and 3: Blueprint Parts for structural composition and Slot Libraries for fine-grained reuse.

#### Implementation

```json
// data/mods/anatomy/parts/humanoid_core.part.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint-part.schema.json",
  "id": "anatomy:humanoid_core",
  "library": "anatomy:humanoid_slots",  // Reference slot library
  "slots": {
    "head": { "$use": "standard_head" },
    "left_arm": { "$use": "standard_arm", "socket": "left_shoulder" },
    "right_arm": { "$use": "standard_arm", "socket": "right_shoulder" },
    // ... using library definitions
  },
  "clothingSlotMappings": {
    "head_gear": { "$use": "standard_head_gear" },
    // ... using library definitions
  }
}

// data/mods/anatomy/blueprints/human_male.blueprint.json
{
  "$schema": "http://example.com/schemas/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    // Only gender-specific additions
    "penis": { /* ... */ }
  },
  "clothingSlotMappings": {
    "genital_covering": { /* ... */ }
  }
}
```

## Comparison Matrix

| Criteria                        | Option 1: Parts | Option 2: Inheritance | Option 3: Libraries | Option 4: Hybrid |
| ------------------------------- | --------------- | --------------------- | ------------------- | ---------------- |
| **Repetition Reduction**        | 85%             | 85%                   | 80%                 | 90%              |
| **Maintainability**             | High            | Medium                | High                | Very High        |
| **Flexibility**                 | High            | Medium                | Very High           | Very High        |
| **Learning Curve**              | Medium          | Low                   | Medium              | Medium-High      |
| **Backwards Compatibility**     | High\*          | High\*                | High\*              | High\*           |
| **Schema Complexity**           | Medium          | Low                   | Medium              | High             |
| **Alignment with Architecture** | Very High       | Medium                | High                | Very High        |
| **Granularity of Reuse**        | Medium          | Low                   | Very High           | Very High        |

\*With proper loader updates

## Recommendation

**I recommend Option 4: Hybrid Approach** for the following reasons:

1. **Maximum Flexibility**: Combines structural composition (parts) with fine-grained reuse (libraries)
2. **Best Fit with Architecture**: Aligns with the modding-first philosophy and existing patterns
3. **Future-Proof**: Supports both current needs and anticipated future complexity
4. **Clear Mental Model**: Parts = structure, Libraries = definitions

### Why Not the Others?

- **Option 1**: Good but lacks fine-grained reuse
- **Option 2**: Too rigid, doesn't match the project's composition-based patterns
- **Option 3**: Good for definitions but awkward for structural composition

## Implementation Roadmap

### Phase 1: Schema Updates (Week 1)

1. Create `anatomy.blueprint-part.schema.json`
2. Create `anatomy.slot-library.schema.json`
3. Update `anatomy.blueprint.schema.json` with composition fields
4. Add validation tests for new schemas

### Phase 2: Loader Modifications (Week 2)

1. Update anatomy blueprint loader to support:
   - Loading and caching blueprint parts
   - Loading and caching slot libraries
   - Composing blueprints from parts
   - Resolving `$use` references from libraries
2. Maintain backwards compatibility for existing blueprints
3. Add comprehensive unit tests

### Phase 3: Content Migration (Week 3)

1. Create `humanoid.slot-library.json` with common definitions
2. Create `humanoid_core.part.json` using the library
3. Migrate `human_male.blueprint.json` to use composition
4. Migrate `human_female.blueprint.json` to use composition
5. Test thoroughly with existing game mechanics

### Phase 4: Documentation (Week 4)

1. Update modding documentation
2. Create migration guide for modders
3. Add examples of creating new blueprints
4. Document best practices

## Migration Guide

### For Existing Blueprints

Existing blueprints will continue to work without modification. To migrate:

1. Identify common patterns across blueprints
2. Extract common slots to a slot library
3. Create blueprint parts using the library
4. Update blueprints to compose from parts
5. Test thoroughly

### Example Migration

```json
// Before: 280 lines
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "slots": {
    "head": { /* 6 lines */ },
    "left_arm": { /* 6 lines */ },
    // ... 20 more repeated definitions
  }
}

// After: 40 lines
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [{
    "part": "anatomy:humanoid_core",
    "include": ["slots", "clothingSlotMappings"]
  }],
  "slots": {
    "penis": { /* 6 lines */ },
    "left_testicle": { /* 6 lines */ },
    "right_testicle": { /* 6 lines */ }
  }
}
```

## Conclusion

The hybrid approach provides the best balance of flexibility, maintainability, and alignment with the Living Narrative Engine's architecture. By combining blueprint parts for structural composition with slot libraries for definition reuse, we can achieve 90% reduction in repetition while maintaining the system's modding-first philosophy.

The phased implementation approach ensures smooth migration with maintained backwards compatibility, making this a low-risk, high-reward refactoring.
