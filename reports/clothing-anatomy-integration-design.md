# Clothing-Anatomy Integration Architecture Design Document

**Document Version**: 2.0  
**Date**: 2025-07-10  
**Status**: Implemented with Socket/Slot Resolution  
**Author**: System Architecture Team

> **Update Note**: This document has been updated to reflect the implemented solution that properly handles the distinction between blueprint slots and anatomy sockets.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architectural Goals](#architectural-goals)
4. [Proposed Solution](#proposed-solution)
5. [Detailed Design](#detailed-design)
6. [Implementation Guide](#implementation-guide)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)
9. [Risk Analysis](#risk-analysis)
10. [Appendices](#appendices)

## Executive Summary

This document presents a comprehensive architectural design for integrating the clothing and anatomy systems in the Living Narrative Engine. The proposed solution addresses critical integration issues by establishing anatomy blueprints as the authoritative source for clothing capabilities, following Domain-Driven Design principles while maintaining clean separation of concerns.

### Key Design Decisions

1. **Blueprint-Level Clothing Slot Declarations**: Anatomy blueprints declare their clothing capabilities through a new `clothingSlotMappings` property
2. **Integration Service Layer**: A new service layer bridges the anatomy and clothing domains without creating tight coupling
3. **Data-Driven Architecture**: All clothing slot mappings move from hardcoded values to JSON configuration
4. **Automatic Component Integration**: Characters with anatomy automatically receive clothing capabilities

### Expected Benefits

- Eliminates domain boundary violations
- Makes clothing capabilities fully moddable
- Supports diverse anatomy types with different clothing capabilities
- Maintains clean architectural separation
- Enables runtime validation of clothing-anatomy compatibility

## Problem Statement

### Current Architecture Issues

1. **Missing Clothing Slot Integration**
   - The `clothing:clothing_slot` component exists in schema but is never instantiated
   - No bridge between anatomy sockets and clothing equipment slots
   - Characters cannot equip clothing despite having anatomy

2. **Domain Boundary Violations**
   - Clothing system attempts to define slots independently of anatomy
   - Hardcoded slot-to-anatomy mappings in code violate data-driven principles
   - Tight coupling between domains through implicit assumptions

3. **Integration Failures**
   - `EquipmentOrchestrator.getAvailableClothingSlots()` returns empty arrays
   - Coverage validation uses mock data instead of actual anatomy
   - No runtime validation that equipment slots map to existing anatomy

### Root Cause Analysis

The fundamental issue is a **missing translation layer** between anatomy sockets (physical attachment points) and clothing slots (logical equipment categories). The current architecture attempts to bridge this gap through hardcoded mappings, violating the engine's data-driven philosophy.

## Architectural Goals

### Primary Goals

1. **Domain Integrity**: Respect domain boundaries while enabling necessary integration
2. **Data-Driven Design**: Move all configuration from code to data files
3. **Modding Support**: Enable modders to define custom anatomy-clothing relationships
4. **Runtime Safety**: Validate all clothing-anatomy interactions at runtime

### Design Principles

1. **Single Source of Truth**: Anatomy owns its clothing capabilities
2. **Loose Coupling**: Domains interact through well-defined interfaces
3. **Open-Closed Principle**: Extensible for new anatomy types without code changes
4. **Fail-Fast**: Early validation of configuration errors

## Proposed Solution

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Anatomy Domain (Enhanced)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Anatomy Blueprints with Clothing Slot Mappings    │    │
│  │  - Defines body structure (existing)               │    │
│  │  - Declares clothing capabilities (NEW)            │    │
│  │  - Maps slots to anatomy sockets (NEW)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Anatomy Generation Service (existing)              │    │
│  │  - Creates body from blueprints                    │    │
│  │  - Now includes clothing capability metadata        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ queries capabilities
┌─────────────────────────────────────────────────────────────┐
│              Integration Layer (NEW)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │     AnatomyClothingIntegrationService               │    │
│  │     - Queries anatomy for clothing capabilities     │    │
│  │     - Validates socket-to-slot mappings            │    │
│  │     - Provides clothing slot discovery             │    │
│  │     - Manages domain translation                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ provides slots
┌─────────────────────────────────────────────────────────────┐
│                  Clothing Domain (Enhanced)                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Equipment Orchestrator (existing)                  │    │
│  │  - Uses integration service for slot discovery     │    │
│  │  - Manages equipment/unequipment                   │    │
│  │  - Validates clothing compatibility                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Coverage Validation Service (refactored)           │    │
│  │  - No more hardcoded mappings                      │    │
│  │  - Uses actual anatomy data                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Core Concept: Dual-Mode Clothing Slot Declarations

Anatomy blueprints become the authoritative source for clothing capabilities, supporting two modes of mapping:

1. **Blueprint Slot References** - For extremities with generic sockets (arms, legs)
2. **Direct Socket References** - For torso parts with orientation-specific sockets

```json
{
  "id": "anatomy:humanoid",
  "rootEntityId": "anatomy:humanoid_torso",
  "slots": [...], // existing anatomy structure
  "clothingSlotMappings": {
    "hands": {
      "blueprintSlots": ["left_hand", "right_hand"], // References to blueprint slots
      "allowedLayers": ["base", "armor"],
      "defaultLayer": "base",
      "tags": ["hands", "extremities"]
    },
    "torso_upper": {
      "anatomySockets": ["left_shoulder", "right_shoulder"], // Direct socket IDs
      "allowedLayers": ["underwear", "base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["torso", "upper_body"]
    }
  }
}
```

**Key Innovation**: The system automatically resolves blueprint slots to actual attachment points at runtime, handling the orientation context properly.

## Key Architectural Decision: Slots vs Sockets

### The Problem

The anatomy system uses two distinct concepts:

- **Blueprint Slots**: Named positions in the anatomy hierarchy (e.g., "left_hand", "right_foot")
- **Sockets**: Generic attachment points on body parts (e.g., "wrist", "ankle")

Extremities (arms, legs) have generic sockets without orientation, while the torso has orientation-specific sockets. The orientation for extremities comes from the blueprint slot hierarchy, not the socket names.

### The Solution

The clothing system supports both approaches:

1. **blueprintSlots**: For extremities - references slot IDs that are resolved to actual entities at runtime
2. **anatomySockets**: For torso parts - direct socket IDs that already include orientation

This dual approach respects the anatomy system's design while providing the flexibility needed for clothing.

## Detailed Design

### 1. Enhanced Anatomy Blueprint Schema

**File**: `data/schemas/anatomy.blueprint.schema.json`

**Additions**:

```json
{
  "properties": {
    "clothingSlotMappings": {
      "type": "object",
      "description": "Maps clothing slots to anatomy sockets",
      "patternProperties": {
        "^[a-zA-Z_]+$": {
          "type": "object",
          "properties": {
            "blueprintSlots": {
              "type": "array",
              "items": { "type": "string" },
              "minItems": 1,
              "description": "Blueprint slot IDs this clothing slot covers (e.g., ['left_hand', 'right_hand'])"
            },
            "anatomySockets": {
              "type": "array",
              "items": { "type": "string" },
              "minItems": 1,
              "description": "Direct socket IDs for parts with orientation-specific sockets (e.g., torso)"
            },
            "allowedLayers": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["underwear", "base", "outer", "armor", "accessory"]
              },
              "minItems": 1,
              "description": "Clothing layers allowed in this slot"
            },
            "layerOrder": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Order of layers from innermost to outermost"
            },
            "defaultLayer": {
              "type": "string",
              "description": "Default layer for single-layer items"
            },
            "tags": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Tags for categorization and filtering"
            },
            "conflictsWith": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Other clothing slots this conflicts with"
            },
            "requiresSlots": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Other slots that must be available"
            }
          },
          "required": ["allowedLayers", "defaultLayer"],
          "oneOf": [
            {
              "required": ["blueprintSlots"],
              "not": { "required": ["anatomySockets"] }
            },
            {
              "required": ["anatomySockets"],
              "not": { "required": ["blueprintSlots"] }
            }
          ]
        }
      }
    }
  }
}
```

### 2. Example Enhanced Blueprint

**File**: `data/mods/anatomy/blueprints/humanoid.blueprint.json`

```json
{
  "id": "anatomy:humanoid",
  "version": "1.0.0",
  "rootEntityId": "anatomy:humanoid_torso",
  "slots": [
    {
      "slotId": "head",
      "parentSocketId": "neck_top",
      "requiredSockets": {
        "neck_bottom": { "orientation": "down" }
      },
      "optional": false
    },
    {
      "slotId": "left_arm",
      "parentSocketId": "left_shoulder",
      "requiredSockets": {
        "shoulder": { "orientation": "inward" }
      },
      "optional": true
    },
    {
      "slotId": "right_arm",
      "parentSocketId": "right_shoulder",
      "requiredSockets": {
        "shoulder": { "orientation": "inward" }
      },
      "optional": true
    }
  ],
  "clothingSlotMappings": {
    "head_gear": {
      "anatomySockets": ["head_top", "head_sides"],
      "allowedLayers": ["base", "outer", "armor"],
      "layerOrder": ["base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["head", "armor_slot"]
    },
    "face_gear": {
      "anatomySockets": ["face_front"],
      "allowedLayers": ["accessory"],
      "layerOrder": ["accessory"],
      "defaultLayer": "accessory",
      "tags": ["face", "accessory"],
      "conflictsWith": ["full_helmet"]
    },
    "torso_upper": {
      "anatomySockets": [
        "left_chest",
        "right_chest",
        "left_shoulder",
        "right_shoulder",
        "upper_back"
      ],
      "allowedLayers": ["underwear", "base", "outer", "armor"],
      "layerOrder": ["underwear", "base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["torso", "upper_body"]
    },
    "torso_lower": {
      "anatomySockets": ["left_hip", "right_hip", "lower_back"],
      "allowedLayers": ["underwear", "base", "outer"],
      "layerOrder": ["underwear", "base", "outer"],
      "defaultLayer": "base",
      "tags": ["torso", "lower_body"]
    },
    "left_arm_clothing": {
      "anatomySockets": ["left_shoulder", "left_upper_arm", "left_forearm"],
      "allowedLayers": ["base", "outer", "armor"],
      "layerOrder": ["base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["arm", "left_side"],
      "requiresSlots": ["torso_upper"]
    },
    "right_arm_clothing": {
      "anatomySockets": ["right_shoulder", "right_upper_arm", "right_forearm"],
      "allowedLayers": ["base", "outer", "armor"],
      "layerOrder": ["base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["arm", "right_side"],
      "requiresSlots": ["torso_upper"]
    },
    "hands": {
      "blueprintSlots": ["left_hand", "right_hand"],
      "allowedLayers": ["base", "armor"],
      "layerOrder": ["base", "armor"],
      "defaultLayer": "base",
      "tags": ["hands", "extremities"]
    },
    "legs": {
      "blueprintSlots": ["left_leg", "right_leg"],
      "allowedLayers": ["underwear", "base", "outer", "armor"],
      "layerOrder": ["underwear", "base", "outer", "armor"],
      "defaultLayer": "base",
      "tags": ["legs", "lower_body"]
    },
    "feet": {
      "blueprintSlots": ["left_foot", "right_foot"],
      "allowedLayers": ["base", "armor"],
      "layerOrder": ["base", "armor"],
      "defaultLayer": "base",
      "tags": ["feet", "extremities"]
    },
    "full_body": {
      "anatomySockets": ["*"], // Special: covers all sockets
      "allowedLayers": ["outer"],
      "layerOrder": ["outer"],
      "defaultLayer": "outer",
      "tags": ["full_body", "special"],
      "conflictsWith": ["torso_upper", "torso_lower", "legs"]
    }
  }
}
```

### 3. Integration Service Design

**File**: `src/anatomy/integration/anatomyClothingIntegrationService.js`

```javascript
/**
 * @file Service that bridges anatomy and clothing domains
 * @see src/anatomy/services/anatomyOrchestrator.js
 * @see src/clothing/orchestration/equipmentOrchestrator.js
 */

import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../types/anatomy.types.js').AnatomyBlueprint} AnatomyBlueprint */
/** @typedef {import('../../clothing/types/clothing.types.js').ClothingSlot} ClothingSlot */

/**
 * Maps clothing slot ID to its configuration
 * @typedef {Object} ClothingSlotMapping
 * @property {string[]} anatomySockets - Socket IDs this slot covers
 * @property {string[]} allowedLayers - Allowed clothing layers
 * @property {string[]} layerOrder - Layer order from inner to outer
 * @property {string} defaultLayer - Default layer for items
 * @property {string[]} [tags] - Optional categorization tags
 * @property {string[]} [conflictsWith] - Slots that conflict
 * @property {string[]} [requiresSlots] - Required companion slots
 */

/**
 * Service that provides clothing capabilities based on anatomy structure
 */
class AnatomyClothingIntegrationService {
  #logger;
  #entityManager;
  #anatomyOrchestrator;
  #bodyGraphService;
  #blueprintCache = new Map();

  constructor({
    logger,
    entityManager,
    anatomyOrchestrator,
    bodyGraphService,
  }) {
    validateDependency(logger, 'ILogger');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(anatomyOrchestrator, 'IAnatomyOrchestrator');
    validateDependency(bodyGraphService, 'IBodyGraphService');

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#anatomyOrchestrator = anatomyOrchestrator;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Gets available clothing slots for an entity based on its anatomy
   * @param {string} entityId - Entity to query
   * @returns {Promise<Map<string, ClothingSlotMapping>>} Available slots
   */
  async getAvailableClothingSlots(entityId) {
    assertNonBlankString(entityId, 'Entity ID is required');

    try {
      // Get entity's anatomy blueprint
      const blueprint = await this.#getEntityBlueprint(entityId);
      if (!blueprint || !blueprint.clothingSlotMappings) {
        return new Map();
      }

      // Get entity's actual anatomy sockets
      const anatomySockets = await this.#getEntityAnatomySockets(entityId);

      // Filter clothing slots to only those with existing sockets
      const availableSlots = new Map();

      for (const [slotId, mapping] of Object.entries(
        blueprint.clothingSlotMappings
      )) {
        if (this.#validateSlotMapping(mapping, anatomySockets)) {
          availableSlots.set(slotId, mapping);
        }
      }

      return availableSlots;
    } catch (err) {
      this.#logger.error(
        `Failed to get clothing slots for entity ${entityId}`,
        err
      );
      throw err;
    }
  }

  /**
   * Validates that a clothing item can be equipped in a slot
   * @param {string} entityId - Entity attempting to equip
   * @param {string} slotId - Target clothing slot
   * @param {string} itemId - Item to equip
   * @returns {Promise<{valid: boolean, reason?: string}>}
   */
  async validateClothingSlotCompatibility(entityId, slotId, itemId) {
    assertNonBlankString(entityId, 'Entity ID is required');
    assertNonBlankString(slotId, 'Slot ID is required');
    assertNonBlankString(itemId, 'Item ID is required');

    const availableSlots = await this.getAvailableClothingSlots(entityId);

    if (!availableSlots.has(slotId)) {
      return {
        valid: false,
        reason: `Entity lacks clothing slot '${slotId}'`,
      };
    }

    // Additional validation would go here
    // - Check item's required coverage against slot's sockets
    // - Validate layer compatibility
    // - Check for conflicts

    return { valid: true };
  }

  /**
   * Gets the anatomy sockets covered by a clothing slot
   * @param {string} entityId - Entity to query
   * @param {string} slotId - Clothing slot ID
   * @returns {Promise<string[]>} Socket IDs covered by this slot
   */
  async getSlotAnatomySockets(entityId, slotId) {
    const slots = await this.getAvailableClothingSlots(entityId);
    const mapping = slots.get(slotId);

    if (!mapping) {
      return [];
    }

    // Handle wildcard sockets
    if (mapping.anatomySockets.includes('*')) {
      return await this.#getEntityAnatomySockets(entityId);
    }

    return mapping.anatomySockets;
  }

  /**
   * Gets entity's anatomy blueprint
   * @private
   */
  async #getEntityBlueprint(entityId) {
    const bodyComponent = await this.#entityManager.getComponent(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.recipeId) {
      return null;
    }

    // Check cache
    if (this.#blueprintCache.has(bodyComponent.recipeId)) {
      return this.#blueprintCache.get(bodyComponent.recipeId);
    }

    // Load through anatomy orchestrator
    const recipe = await this.#anatomyOrchestrator.getRecipe(
      bodyComponent.recipeId
    );
    const blueprint = await this.#anatomyOrchestrator.getBlueprint(
      recipe.blueprintId
    );

    // Cache for performance
    this.#blueprintCache.set(bodyComponent.recipeId, blueprint);

    return blueprint;
  }

  /**
   * Gets all anatomy sockets for an entity
   * @private
   */
  async #getEntityAnatomySockets(entityId) {
    const graph = await this.#bodyGraphService.getBodyGraph(entityId);
    const sockets = new Set();

    // Traverse anatomy graph to collect all sockets
    for (const partEntityId of graph.getAllPartIds()) {
      const socketComponent = await this.#entityManager.getComponent(
        partEntityId,
        'anatomy:sockets'
      );

      if (socketComponent?.sockets) {
        for (const socket of socketComponent.sockets) {
          sockets.add(socket.socketId);
        }
      }
    }

    return Array.from(sockets);
  }

  /**
   * Validates that required sockets exist for a slot mapping
   * @private
   */
  #validateSlotMapping(mapping, availableSockets) {
    // Wildcard always valid
    if (mapping.anatomySockets.includes('*')) {
      return true;
    }

    // Check that at least one required socket exists
    const socketSet = new Set(availableSockets);
    return mapping.anatomySockets.some((socketId) => socketSet.has(socketId));
  }

  /**
   * Clears the blueprint cache
   */
  clearCache() {
    this.#blueprintCache.clear();
  }
}

export default AnatomyClothingIntegrationService;
```

### 4. Updated Clothing Validation Service

**Refactored**: `src/clothing/validation/coverageValidationService.js`

Key changes:

- Remove `SLOT_BODY_PART_MAPPING` constant
- Replace `#getMockAnatomyParts()` with integration service calls
- Update validation to use dynamic mappings

```javascript
/**
 * Validates that an item covers required anatomy parts
 * @param {string} entityId - Entity wearing the item
 * @param {string} itemId - Item being validated
 * @param {string} slotId - Target clothing slot
 * @returns {Promise<ValidationResult>}
 */
async validateCoverage(entityId, itemId, slotId) {
  // Get actual anatomy sockets for this slot
  const coveredSockets = await this.#anatomyClothingIntegration
    .getSlotAnatomySockets(entityId, slotId);

  // Get item's required coverage
  const wearableComponent = await this.#entityManager
    .getComponent(itemId, 'clothing:wearable');

  // Validate coverage requirements
  const missingParts = wearableComponent.coverage.required
    .filter(part => !coveredSockets.includes(part));

  if (missingParts.length > 0) {
    return {
      valid: false,
      reason: `Missing required coverage: ${missingParts.join(', ')}`
    };
  }

  return { valid: true };
}
```

### 5. Character Integration Updates

**Updated Character Definition**:

```json
{
  "id": "isekai:hero",
  "components": {
    "core:actor": {},
    "anatomy:body": {
      "recipeId": "anatomy:human_male"
    },
    "clothing:equipment": {
      "_comment": "Auto-added by anatomy system",
      "equippedItems": {}
    }
  }
}
```

**Character Creation Workflow Enhancement**:

```javascript
// In AnatomyOrchestrator.generateAnatomy()
async generateAnatomy(entityId) {
  // ... existing anatomy generation ...

  // Auto-add clothing capability
  if (!await this.#entityManager.hasComponent(entityId, 'clothing:equipment')) {
    await this.#entityManager.addComponent(entityId, 'clothing:equipment', {
      equippedItems: {}
    });
  }

  // Dispatch event for other systems
  await this.#eventBus.dispatch({
    type: 'ANATOMY_CLOTHING_CAPABILITY_ADDED',
    payload: { entityId }
  });
}
```

## Implementation Guide

### Phase 1: Foundation (Week 1)

#### 1.1 Schema Updates

- [ ] Create enhanced `anatomy.blueprint.schema.json` with `clothingSlotMappings`
- [ ] Update existing blueprint validation logic
- [ ] Add schema tests for new properties

#### 1.2 Blueprint Migration

- [ ] Update `humanoid.blueprint.json` with clothing slot mappings
- [ ] Create migration script for existing blueprints
- [ ] Document clothing slot conventions

#### 1.3 Integration Service

- [ ] Implement `AnatomyClothingIntegrationService`
- [ ] Add comprehensive unit tests
- [ ] Create integration test fixtures

### Phase 2: Core Integration (Week 2)

#### 2.1 Service Registration

- [ ] Register integration service in DI container
- [ ] Update service dependencies
- [ ] Add service interfaces

#### 2.2 Clothing System Refactor

- [ ] Remove hardcoded `SLOT_BODY_PART_MAPPING`
- [ ] Update `CoverageValidationService` to use integration
- [ ] Update `EquipmentOrchestrator` for dynamic slots
- [ ] Refactor `LayerCompatibilityService`

#### 2.3 Test Updates

- [ ] Update clothing validation tests
- [ ] Update equipment orchestrator tests
- [ ] Add integration bridge tests

### Phase 3: Character Integration (Week 3)

#### 3.1 Auto-Component Addition

- [ ] Modify anatomy generation to add clothing:equipment
- [ ] Update character creation workflows
- [ ] Add event dispatching

#### 3.2 Demo Character Updates

- [ ] Update isekai character definitions
- [ ] Verify clothing capability addition
- [ ] Test equipment workflows

#### 3.3 End-to-End Testing

- [ ] Create comprehensive E2E test suite
- [ ] Test all equipment scenarios
- [ ] Validate layer conflicts

### Phase 4: Polish & Documentation (Week 4)

#### 4.1 Performance Optimization

- [ ] Implement blueprint caching
- [ ] Optimize socket lookups
- [ ] Add performance benchmarks

#### 4.2 Documentation

- [ ] Update modding documentation
- [ ] Create clothing slot definition guide
- [ ] Document migration process

#### 4.3 Validation & Error Handling

- [ ] Add comprehensive error messages
- [ ] Implement validation helpers
- [ ] Create troubleshooting guide

## Migration Strategy

### For Existing Mods

1. **Automated Migration Tool**

   ```bash
   npm run migrate:clothing-slots
   ```

   - Scans existing blueprints
   - Generates default clothing slot mappings
   - Creates migration report

2. **Manual Review Process**
   - Modders review generated mappings
   - Customize slot definitions
   - Test with clothing items

3. **Backward Compatibility**
   - Temporary fallback to hardcoded mappings
   - Deprecation warnings in logs
   - Grace period for migration

### Data Migration Example

**Before**:

```json
{
  "id": "custom:alien",
  "rootEntityId": "custom:alien_core",
  "slots": [...]
}
```

**After Migration**:

```json
{
  "id": "custom:alien",
  "rootEntityId": "custom:alien_core",
  "slots": [...],
  "clothingSlotMappings": {
    "alien_torso": {
      "anatomySockets": ["core_segment_1", "core_segment_2"],
      "allowedLayers": ["base", "armor"],
      "layerOrder": ["base", "armor"],
      "defaultLayer": "base",
      "tags": ["alien", "torso"]
    }
  }
}
```

## Testing Strategy

### Unit Test Coverage

1. **Integration Service Tests**
   - Socket discovery
   - Slot validation
   - Cache behavior
   - Error handling

2. **Validation Service Tests**
   - Dynamic coverage validation
   - Layer compatibility
   - Size validation

3. **Blueprint Tests**
   - Schema validation
   - Mapping integrity
   - Inheritance behavior

### Integration Test Scenarios

1. **Human Character Equipping Armor**

   ```javascript
   it('should equip plate armor on human character', async () => {
     const character = await createCharacter('anatomy:human_male');
     const armor = await createItem('clothing:plate_armor');

     const result = await equipItem(character, armor, 'torso_upper');

     expect(result.success).toBe(true);
     expect(getEquippedItem(character, 'torso_upper')).toBe(armor);
   });
   ```

2. **Alien Anatomy Custom Slots**

   ```javascript
   it('should support alien-specific clothing slots', async () => {
     const alien = await createCharacter('custom:alien_recipe');
     const slots = await getAvailableClothingSlots(alien);

     expect(slots).toContain('alien_torso');
     expect(slots).not.toContain('human_legs');
   });
   ```

3. **Layer Conflict Resolution**

   ```javascript
   it('should prevent conflicting layers', async () => {
     const character = await createCharacter('anatomy:human_female');
     const shirt = await createItem('clothing:shirt');
     const jacket = await createItem('clothing:jacket');

     await equipItem(character, shirt, 'torso_upper');
     const result = await equipItem(character, jacket, 'torso_upper');

     expect(result.success).toBe(true);
     expect(result.layerResolution).toBe('outer');
   });
   ```

### Performance Benchmarks

1. **Slot Discovery Performance**
   - Target: < 10ms for standard humanoid
   - Measure with/without cache
   - Test with complex anatomies

2. **Validation Performance**
   - Target: < 5ms per item validation
   - Test with multiple layers
   - Measure conflict resolution

3. **Memory Usage**
   - Blueprint cache size limits
   - Socket lookup optimization
   - Graph traversal efficiency

## Risk Analysis

### Technical Risks

1. **Performance Impact**
   - **Risk**: Dynamic lookups slower than hardcoded
   - **Mitigation**: Aggressive caching, optimized queries
   - **Monitoring**: Performance benchmarks in CI

2. **Migration Complexity**
   - **Risk**: Breaking existing mods
   - **Mitigation**: Automated migration tools, backward compatibility
   - **Monitoring**: Migration success metrics

3. **Integration Bugs**
   - **Risk**: Subtle clothing-anatomy mismatches
   - **Mitigation**: Comprehensive test coverage, validation
   - **Monitoring**: Error tracking, user reports

### Design Risks

1. **Over-Complexity**
   - **Risk**: System too complex for modders
   - **Mitigation**: Clear documentation, examples, defaults
   - **Evaluation**: Modder feedback sessions

2. **Flexibility vs Structure**
   - **Risk**: Too flexible, leading to inconsistencies
   - **Mitigation**: Validation rules, best practices guide
   - **Evaluation**: Mod compatibility testing

## Appendices

### Appendix A: Clothing Layer System

**Standard Layer Definitions**:

1. **underwear**: Base layer, minimal coverage
2. **base**: Standard clothing layer
3. **outer**: Jackets, robes, overwear
4. **armor**: Protective gear
5. **accessory**: Non-clothing additions

**Layer Interaction Rules**:

- Items on same layer conflict
- Higher layers render above lower
- Some items may occupy multiple layers

### Appendix B: Socket Naming Conventions

**Standard Socket Patterns**:

- `{body_part}_{position}` (e.g., `left_shoulder`)
- `{body_part}_{direction}` (e.g., `head_top`)
- `{feature}_{index}` (e.g., `spine_socket_1`)

**Special Sockets**:

- `*`: Wildcard, matches all sockets
- `attachment_{type}`: Generic attachment points
- `mount_{purpose}`: Equipment mounting points

### Appendix C: Example Clothing Slot Configurations

**Full Body Robe**:

```json
{
  "full_body_robe": {
    "anatomySockets": ["*"],
    "allowedLayers": ["outer"],
    "layerOrder": ["outer"],
    "defaultLayer": "outer",
    "tags": ["magic", "robe", "full_coverage"],
    "conflictsWith": ["torso_upper", "torso_lower", "legs"]
  }
}
```

**Modular Armor Set**:

```json
{
  "chest_plate": {
    "anatomySockets": ["left_chest", "right_chest", "upper_back"],
    "allowedLayers": ["armor"],
    "layerOrder": ["armor"],
    "defaultLayer": "armor",
    "tags": ["armor", "metal", "torso"],
    "requiresSlots": ["shoulder_guards"]
  },
  "shoulder_guards": {
    "anatomySockets": ["left_shoulder", "right_shoulder"],
    "allowedLayers": ["armor"],
    "layerOrder": ["armor"],
    "defaultLayer": "armor",
    "tags": ["armor", "metal", "shoulders"]
  }
}
```

### Appendix D: Migration Checklist

**For Engine Developers**:

- [ ] Update all core anatomy blueprints
- [ ] Refactor clothing validation services
- [ ] Create integration service
- [ ] Update character creation
- [ ] Write migration tools
- [ ] Update documentation

**For Mod Developers**:

- [ ] Run migration tool on blueprints
- [ ] Review generated mappings
- [ ] Test clothing compatibility
- [ ] Update custom validation
- [ ] Report issues

**For QA Testing**:

- [ ] Test all clothing items
- [ ] Verify layer conflicts
- [ ] Check performance
- [ ] Test edge cases
- [ ] Validate error messages

---

**Document Status**: This design document represents the proposed architecture for clothing-anatomy integration. Implementation should follow the phases outlined while remaining flexible to discoveries during development.

**Next Steps**:

1. Architecture review and approval
2. Prototype integration service
3. Begin Phase 1 implementation
4. Gather early feedback from mod developers

**Approval**:

- [ ] Architecture Team
- [ ] Development Lead
- [ ] QA Lead
- [ ] Community Representative
