# Clothing-Anatomy Integration Design Document

## Executive Summary

This document outlines the design for integrating clothing definition and instantiation into the anatomy generation pipeline. The solution enables character recipes to specify clothing entities that will be automatically instantiated and equipped during character creation, leveraging the existing allowable clothing slots defined in anatomy blueprints.

## Goals and Requirements

### Primary Goals
1. Enable clothing specification in anatomy recipes
2. Automate clothing instantiation during character creation
3. Maintain separation between anatomy structure (blueprints) and clothing choices (recipes)
4. Preserve system modularity and extensibility

### Key Requirements
- Clothing entities must be instantiated after the body graph is fully initialized
- The system must respect the allowable clothing slots defined in blueprints
- Implementation must be backwards compatible with existing recipes
- The solution should support property overrides for instantiated clothing

## System Architecture Overview

### Current State
```
Anatomy System                    Clothing System
├── AnatomyGenerationService     ├── ClothingManagementService
├── AnatomyGenerationWorkflow    ├── EquipmentOrchestrator
├── BodyBlueprintFactory         ├── CoverageValidationService
└── RecipeProcessor              └── AnatomyClothingIntegrationService

Blueprint (DNA) → Recipe (Instance) → Anatomy Graph → [Gap] → Manual Clothing
```

### Proposed State
```
Blueprint (DNA) → Recipe (Instance + Clothing) → Anatomy Graph → Auto Clothing → Complete Character
```

## Detailed Design

### 1. Schema Extensions

#### Anatomy Recipe Schema Enhancement
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "recipeId": { "$ref": "./common.schema.json#/definitions/namespacedId" },
    "blueprintId": { "$ref": "./common.schema.json#/definitions/namespacedId" },
    "slots": { 
      "type": "object",
      "description": "Slot-specific configurations"
    },
    "clothingEntities": {
      "type": "array",
      "description": "Clothing entities to instantiate and equip during anatomy generation",
      "items": {
        "type": "object",
        "properties": {
          "entityId": {
            "$ref": "./common.schema.json#/definitions/namespacedId",
            "description": "The clothing entity definition to instantiate",
            "examples": ["clothing:simple_shirt", "apparel:leather_boots"]
          },
          "equip": {
            "type": "boolean",
            "default": true,
            "description": "Whether to automatically equip this item after instantiation"
          },
          "targetSlot": {
            "type": "string",
            "description": "Specific clothing slot to equip to (uses entity's default if not specified)",
            "examples": ["torso_upper", "feet", "head"]
          },
          "layer": {
            "type": "string",
            "enum": ["underwear", "base", "outer", "accessories"],
            "description": "Layer override (uses entity's default if not specified)"
          },
          "properties": {
            "type": "object",
            "description": "Property overrides for the instantiated entity",
            "additionalProperties": true,
            "examples": [
              { "color": "blue", "size": "medium" },
              { "condition": 0.8, "quality": "fine" }
            ]
          },
          "skipValidation": {
            "type": "boolean",
            "default": false,
            "description": "Skip slot compatibility validation (use with caution)"
          }
        },
        "required": ["entityId"],
        "additionalProperties": false
      }
    }
  },
  "required": ["recipeId", "blueprintId"]
}
```

### 2. New Service: ClothingInstantiationService

```javascript
/**
 * @file Service responsible for instantiating and equipping clothing during anatomy generation
 * @see anatomyGenerationWorkflow.js
 */

class ClothingInstantiationService {
  constructor({
    entityManager,
    entityDefinitionLoader,
    equipmentOrchestrator,
    anatomyClothingIntegrationService,
    logger,
    eventBus
  }) {
    // Dependencies injected
  }

  /**
   * Instantiates clothing entities specified in a recipe
   * @param {string} actorId - The character entity being created
   * @param {Object} recipe - The anatomy recipe containing clothingEntities
   * @param {Map} anatomyParts - Map of anatomy part IDs by slot
   * @returns {Promise<Object>} Result containing created clothing IDs and any errors
   */
  async instantiateRecipeClothing(actorId, recipe, anatomyParts) {
    const result = {
      instantiated: [],
      equipped: [],
      errors: []
    };

    if (!recipe.clothingEntities?.length) {
      return result;
    }

    // Validate clothing slots against blueprint allowances
    const validationResult = await this.#validateClothingSlots(
      recipe.blueprintId,
      recipe.clothingEntities
    );

    if (!validationResult.isValid) {
      result.errors.push(...validationResult.errors);
      return result;
    }

    // Process each clothing entity
    for (const clothingConfig of recipe.clothingEntities) {
      try {
        // Instantiate the clothing entity
        const clothingId = await this.#instantiateClothing(
          clothingConfig.entityId,
          clothingConfig.properties
        );
        
        result.instantiated.push({
          id: clothingId,
          definitionId: clothingConfig.entityId
        });

        // Equip if requested
        if (clothingConfig.equip !== false) {
          const equipResult = await this.#equipClothing(
            actorId,
            clothingId,
            clothingConfig
          );
          
          if (equipResult.success) {
            result.equipped.push(clothingId);
          } else {
            result.errors.push(equipResult.error);
          }
        }
      } catch (error) {
        result.errors.push({
          entityId: clothingConfig.entityId,
          error: error.message
        });
      }
    }

    // Dispatch completion event
    this.#eventBus.dispatch({
      type: 'CLOTHING_INSTANTIATION_COMPLETED',
      payload: {
        actorId,
        result
      }
    });

    return result;
  }

  async #validateClothingSlots(blueprintId, clothingEntities) {
    // Implementation details...
  }

  async #instantiateClothing(entityDefId, propertyOverrides) {
    // Implementation details...
  }

  async #equipClothing(actorId, clothingId, config) {
    // Implementation details...
  }
}
```

### 3. Integration Points

#### AnatomyGenerationWorkflow Modification
```javascript
class AnatomyGenerationWorkflow {
  constructor({
    // existing dependencies...
    clothingInstantiationService // NEW
  }) {
    // ...
  }

  async generate(recipe) {
    try {
      // Phase 1: Create anatomy graph (existing)
      const anatomyResult = await this.#bodyBlueprintFactory.createFromBlueprint(
        recipe.blueprintId,
        recipe
      );

      // Phase 2: Process anatomy result (existing)
      const partsMap = this.#buildPartsMap(anatomyResult);

      // Phase 3: Instantiate clothing (NEW)
      let clothingResult = null;
      if (recipe.clothingEntities?.length > 0) {
        this.#eventBus.dispatch({
          type: 'CLOTHING_INSTANTIATION_STARTED',
          payload: {
            actorId: recipe.entityId,
            clothingCount: recipe.clothingEntities.length
          }
        });

        clothingResult = await this.#clothingInstantiationService.instantiateRecipeClothing(
          recipe.entityId,
          recipe,
          partsMap
        );
      }

      // Phase 4: Generate descriptions (existing)
      // Note: Descriptions will now include equipped clothing
      await this.#generateDescriptions(recipe.entityId, partsMap);

      return {
        rootId: anatomyResult.rootId,
        entityIds: anatomyResult.entityIds,
        partsMap,
        clothingResult // NEW
      };
    } catch (error) {
      // Error handling...
    }
  }
}
```

### 4. Event Flow

```
ANATOMY_GENERATION_STARTED
├─→ ANATOMY_BLUEPRINT_LOADED
├─→ ANATOMY_PARTS_CREATED
├─→ ANATOMY_GRAPH_VALIDATED
├─→ CLOTHING_INSTANTIATION_STARTED (NEW)
│   ├─→ CLOTHING_ENTITY_CREATED (per item)
│   ├─→ CLOTHING_EQUIPPED (per item)
│   └─→ CLOTHING_INSTANTIATION_COMPLETED (NEW)
├─→ ANATOMY_DESCRIPTIONS_GENERATED
└─→ ANATOMY_GENERATION_COMPLETED
```

### 5. Example Usage

#### Recipe with Clothing
```json
{
  "recipeId": "anatomy:human_adult_male_peasant",
  "blueprintId": "anatomy:human_male",
  "slots": {
    "head": {
      "partType": "head",
      "properties": {
        "hair_style": "short",
        "hair_color": "brown"
      }
    }
  },
  "clothingEntities": [
    {
      "entityId": "clothing:linen_underwear",
      "equip": true,
      "layer": "underwear"
    },
    {
      "entityId": "clothing:peasant_shirt",
      "equip": true,
      "properties": {
        "color": "brown",
        "condition": 0.6
      }
    },
    {
      "entityId": "clothing:rough_trousers",
      "equip": true,
      "properties": {
        "color": "gray"
      }
    },
    {
      "entityId": "clothing:worn_boots",
      "equip": true
    },
    {
      "entityId": "clothing:straw_hat",
      "equip": false,
      "properties": {
        "note": "Carried, not worn"
      }
    }
  ]
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Update anatomy recipe schema
2. Create ClothingInstantiationService
3. Add dependency injection registration
4. Create unit tests for the service

### Phase 2: Integration (Week 2)
1. Modify AnatomyGenerationWorkflow
2. Update RecipeProcessor to preserve clothingEntities
3. Add integration tests
4. Update existing test fixtures

### Phase 3: Validation & Polish (Week 3)
1. Add comprehensive validation
2. Implement error recovery
3. Performance optimization
4. Documentation updates

## Testing Strategy

### Unit Tests
```javascript
describe('ClothingInstantiationService', () => {
  it('should instantiate clothing entities from recipe');
  it('should respect equip flag');
  it('should apply property overrides');
  it('should validate against blueprint allowances');
  it('should handle missing entity definitions gracefully');
  it('should dispatch appropriate events');
});
```

### Integration Tests
```javascript
describe('Anatomy Generation with Clothing', () => {
  it('should create complete character with clothing');
  it('should skip clothing for recipes without clothingEntities');
  it('should continue on clothing errors');
  it('should include clothing in generated descriptions');
});
```

### Performance Tests
- Measure impact on generation time
- Test with various clothing counts (0, 1, 5, 10+ items)
- Verify no memory leaks

## Migration Strategy

### Backward Compatibility
- All changes are additive
- Existing recipes without `clothingEntities` work unchanged
- No breaking changes to public APIs

### Migration Path
1. Deploy schema updates (no impact)
2. Deploy service code (no impact until used)
3. Update workflow (backward compatible)
4. Gradually update recipes to include clothing

### Rollback Plan
- Feature flag: `ENABLE_AUTOMATIC_CLOTHING`
- Can disable without affecting core anatomy generation
- Clothing can still be equipped manually

## Performance Considerations

### Expected Impact
- Additional 50-150ms per character (5-10 clothing items)
- Linear scaling with clothing count
- Negligible memory increase

### Optimization Opportunities
1. Batch entity creation
2. Parallel equipment operations where possible
3. Cache clothing definitions
4. Lazy-load rarely used properties

## Security Considerations

### Validation Requirements
1. Validate all entity IDs against loaded definitions
2. Sanitize property overrides
3. Enforce blueprint slot restrictions
4. Prevent circular dependencies

### Error Isolation
- Clothing errors should not break anatomy generation
- Failed equips should not prevent other items
- Clear error reporting for debugging

## Future Enhancements

### Potential Extensions
1. **Clothing Sets**: Predefined outfit combinations
   ```json
   "clothingSets": ["peasant_outfit", "merchant_attire"]
   ```

2. **Conditional Clothing**: Based on other properties
   ```json
   "conditionalClothing": [
     {
       "condition": { "gender": "female" },
       "entityId": "clothing:dress"
     }
   ]
   ```

3. **Random Variations**: For variety
   ```json
   "randomClothing": {
     "shirt": ["clothing:shirt_red", "clothing:shirt_blue"],
     "probability": 0.5
   }
   ```

## Conclusion

This design provides a clean, extensible solution for integrating clothing into the anatomy generation pipeline. By leveraging existing systems and following established patterns, we minimize risk while delivering the requested functionality. The implementation maintains separation of concerns, supports future enhancements, and provides a smooth migration path.

---
*Design Document Version: 1.0*  
*Created: 2025-01-10*  
*Status: Ready for Implementation*