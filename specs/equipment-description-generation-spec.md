# Equipment Description Generation Implementation Specification

## Executive Summary

This specification defines the implementation requirements for **Equipment Description Generation** in the Living Narrative Engine's anatomy description system. The feature extends the existing anatomy description generation architecture to include equipment/clothing descriptions that appear as "Wearing: X, Y, Z..." after the anatomy parts' composed description.

**Status**: Ready for Implementation  
**Priority**: High (Content Enhancement)  
**Duration**: 1-2 weeks  
**Risk Level**: Low (leverages existing infrastructure)

## Objectives

### Primary Goals

- **Equipment Description Integration**: Add equipment descriptions to anatomy descriptions following the format "Wearing: X, Y, Z..."
- **Data-Driven Approach**: Use configurable descriptor ordering and formatting similar to anatomy descriptions
- **Seamless Integration**: Extend existing anatomy description workflow without disrupting current functionality
- **Descriptor Consistency**: Apply same descriptor patterns used for anatomy parts to equipment descriptions

### Secondary Goals

- **Configuration Flexibility**: Provide configurable equipment description formatting options
- **Performance Optimization**: Maintain current anatomy description performance
- **Testing Coverage**: Ensure comprehensive test coverage for equipment description functionality
- **Documentation**: Complete API documentation and usage examples

## Current State Analysis

### Existing Architecture Foundation

The Living Narrative Engine provides a solid foundation for equipment description integration:

#### 1. **Anatomy Description System** (Ready)

- **Location**: `src/anatomy/anatomyDescriptionService.js`
- **Components**: Multi-layered service architecture with orchestrator, composer, and formatter layers
- **Integration Point**: `BodyDescriptionOrchestrator.generateAllDescriptions()` method
- **Status**: ✅ Production-ready with comprehensive service orchestration

#### 2. **Clothing Integration Infrastructure** (Ready)

- **Location**: `src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js`
- **Components**: Slot resolution system for equipment attachment points
- **Integration Point**: Equipment attachment resolution and mapping
- **Status**: ✅ Production-ready with comprehensive slot mapping

#### 3. **Descriptor System** (Ready)

- **Location**: `src/anatomy/descriptorFormatter.js`
- **Components**: Flexible descriptor extraction and formatting with configurable ordering
- **Integration Point**: `DescriptorFormatter.extractDescriptors()` and `formatDescriptors()` methods
- **Status**: ✅ Production-ready with data-driven configuration

#### 4. **Configuration System** (Ready)

- **Location**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Components**: JSON configuration for descriptor ordering and formatting rules
- **Integration Point**: Configuration extensions for equipment descriptors
- **Status**: ✅ Production-ready with extensible configuration structure

### Equipment Description Requirements

Based on the user requirements and existing architecture:

#### Input Requirements

- **Equipment Entities**: Equipment/clothing entities with descriptor components
- **Attachment Information**: Equipment attached to anatomy parts via existing slot system
- **Descriptor Components**: Equipment entities with `descriptors:*` components similar to anatomy parts

#### Output Requirements

- **Format**: "Wearing: X, Y, Z..." where X, Y, Z are formatted equipment descriptions
- **Descriptor Format**: Equipment described using descriptors (e.g., "stretch-silk, black, silky bodysuit")
- **Ordering**: Data-driven descriptor ordering similar to anatomy descriptions
- **Integration**: Appended to existing anatomy description after body parts

#### Example Output

```
Build: athletic
Eyes: large, blue, almond-shaped
Hair: long, silky, black
Torso: lean, toned

Wearing: stretch-silk, black, silky bodysuit | leather, brown, sturdy boots | silver, ornate, ruby ring.
```

## Technical Architecture

### Enhanced Service Layer Architecture

The equipment description integration extends the existing anatomy description architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestration Layer                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BodyDescriptionOrchestrator (Enhanced)                 │   │
│  │   ├── generateAllDescriptions() (Modified)             │   │
│  │   ├── generateAnatomyDescriptions() (Existing)         │   │
│  │   └── generateEquipmentDescriptions() (New)            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                      Composition Layer                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BodyDescriptionComposer (Enhanced)                      │   │
│  │   ├── composeDescription() (Modified)                   │   │
│  │   └── composeEquipmentDescription() (New)               │   │
│  │                                                         │   │
│  │ EquipmentDescriptionService (New)                       │   │
│  │   ├── generateEquipmentDescriptions()                   │   │
│  │   └── formatEquipmentDescription()                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                      Formatting Layer                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DescriptorFormatter (Enhanced)                          │   │
│  │   ├── extractDescriptors() (Enhanced)                   │   │
│  │   ├── formatDescriptors() (Enhanced)                    │   │
│  │   └── extractEquipmentDescriptors() (New)               │   │
│  │                                                         │   │
│  │ EquipmentResolver (New)                                 │   │
│  │   ├── getEquippedItems()                                │   │
│  │   └── resolveEquipmentAttachments()                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     Configuration Layer                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AnatomyFormattingService (Enhanced)                     │   │
│  │   ├── getDescriptorOrder() (Enhanced)                   │   │
│  │   ├── getEquipmentDescriptorOrder() (New)               │   │
│  │   └── getEquipmentIntegrationConfig() (New)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Service Enhancements

#### 1. **BodyDescriptionOrchestrator** (Enhanced)

- **File**: `src/anatomy/BodyDescriptionOrchestrator.js`
- **Enhancements**:
  - Extend `generateAllDescriptions()` to include equipment descriptions
  - Add equipment description generation workflow
  - Combine anatomy and equipment descriptions
  - Maintain backward compatibility

#### 2. **BodyDescriptionComposer** (Enhanced)

- **File**: `src/anatomy/bodyDescriptionComposer.js`
- **Enhancements**:
  - Extend `composeDescription()` to append equipment descriptions
  - Add equipment description composition logic
  - Support "Wearing: X, Y, Z..." formatting

#### 3. **EquipmentDescriptionService** (New)

- **File**: `src/anatomy/equipmentDescriptionService.js`
- **Responsibilities**:
  - Generate descriptions for equipped items
  - Format equipment descriptions using descriptor system
  - Integrate with existing clothing slot resolution

#### 4. **EquipmentResolver** (New)

- **File**: `src/anatomy/equipmentResolver.js`
- **Responsibilities**:
  - Resolve equipped items from anatomy entity
  - Use existing clothing slot mapping infrastructure
  - Provide equipment attachment information

## Configuration-Driven Equipment System

### Enhanced Anatomy Formatting Configuration

The equipment description system extends the existing configuration structure:

**File**: `data/mods/anatomy/anatomy-formatting/default.json`

```json
{
  "$schema": "../../../schemas/anatomy-formatting.schema.json",
  "id": "default",
  "descriptionOrder": [
    "build",
    "hair",
    "eye",
    "face",
    "ear",
    "nose",
    "mouth",
    "neck",
    "breast",
    "torso",
    "arm",
    "hand",
    "leg",
    "foot",
    "pubic_hair",
    "vagina",
    "penis",
    "testicle",
    "tail",
    "wing"
  ],
  "pairedParts": [
    "eye",
    "ear",
    "arm",
    "leg",
    "hand",
    "foot",
    "breast",
    "wing",
    "testicle"
  ],
  "irregularPlurals": {
    "foot": "feet",
    "tooth": "teeth"
  },
  "descriptorOrder": [
    "descriptors:length_category",
    "descriptors:length_hair",
    "descriptors:size_category",
    "descriptors:size_specific",
    "descriptors:weight_feel",
    "descriptors:color_basic",
    "descriptors:color_extended",
    "descriptors:shape_general",
    "descriptors:shape_eye",
    "descriptors:hair_style",
    "descriptors:texture",
    "descriptors:firmness",
    "descriptors:build"
  ],
  "descriptorValueKeys": [
    "value",
    "color",
    "size",
    "shape",
    "length",
    "style",
    "texture",
    "firmness",
    "build",
    "weight"
  ],
  "equipmentIntegration": {
    "enabled": true,
    "prefix": "Wearing: ",
    "suffix": ".",
    "separator": ", ",
    "itemSeparator": " | ",
    "placement": "after_anatomy"
  },
  "equipmentDescriptorOrder": [
    "descriptors:material",
    "descriptors:color_basic",
    "descriptors:color_extended",
    "descriptors:texture",
    "descriptors:quality",
    "descriptors:condition",
    "descriptors:style",
    "descriptors:size_category",
    "descriptors:shape_general",
    "descriptors:special_properties"
  ],
  "equipmentDescriptorValueKeys": [
    "material",
    "color",
    "texture",
    "quality",
    "condition",
    "style",
    "size",
    "shape",
    "property",
    "value"
  ]
}
```

### Equipment Descriptor Configuration

#### Equipment-Specific Descriptors

- **`descriptors:material`**: Fabric/material type (silk, leather, cotton, steel, etc.)
- **`descriptors:color_basic`**: Basic color (black, white, red, blue, etc.)
- **`descriptors:color_extended`**: Extended color (crimson, azure, emerald, etc.)
- **`descriptors:texture`**: Texture quality (smooth, rough, silky, coarse, etc.)
- **`descriptors:quality`**: Quality level (masterwork, fine, poor, crude, etc.)
- **`descriptors:condition`**: Condition state (pristine, worn, damaged, etc.)
- **`descriptors:style`**: Style type (ornate, simple, elegant, rugged, etc.)
- **`descriptors:size_category`**: Size category (tiny, small, large, oversized, etc.)
- **`descriptors:shape_general`**: General shape (flowing, fitted, loose, tight, etc.)
- **`descriptors:special_properties`**: Special properties (magical, enchanted, blessed, etc.)

#### Configuration Options

- **`equipmentIntegration.enabled`**: Toggle equipment description integration
- **`equipmentIntegration.prefix`**: Text before equipment list (default: "Wearing: ")
- **`equipmentIntegration.suffix`**: Text after equipment list (default: ".")
- **`equipmentIntegration.separator`**: Separator between descriptors within an item (default: ", ")
- **`equipmentIntegration.itemSeparator`**: Separator between different equipment items (default: " | ")
- **`equipmentIntegration.placement`**: Where to place equipment descriptions (default: "after_anatomy")

### Equipment Description Format Examples

#### Single Equipment Item

```
Wearing: stretch-silk, black, silky bodysuit.
```

#### Multiple Equipment Items

```
Wearing: stretch-silk, black, silky bodysuit | leather, brown, sturdy boots | silver, ornate, ruby ring.
```

#### Alternative Item Separators

The `itemSeparator` can be customized for different visual styles:

- **Bullet separator**: `Wearing: silk bodysuit • leather boots.`
- **Slash separator**: `Wearing: silk bodysuit / leather boots.`
- **Double colon**: `Wearing: silk bodysuit :: leather boots.`

#### Format Benefits

- **Clear Item Boundaries**: Easy to distinguish individual equipment pieces
- **Readable**: Natural visual separation between items
- **Configurable**: Item separator can be customized per game/mod preferences
- **Consistent**: Maintains descriptor ordering within each item
- **Parseable**: Clear structure for potential future parsing or processing

## Implementation Specifications

### 1. **EquipmentDescriptionService** Implementation

**File**: `src/anatomy/equipmentDescriptionService.js`

```javascript
/**
 * @file Service for generating equipment descriptions
 * @see src/anatomy/anatomyDescriptionService.js
 * @see src/anatomy/descriptorFormatter.js
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('./descriptorFormatter.js').DescriptorFormatter} DescriptorFormatter */
/** @typedef {import('./equipmentResolver.js').EquipmentResolver} EquipmentResolver */

/**
 * Service for generating equipment descriptions using the descriptor system
 */
class EquipmentDescriptionService {
  #logger;
  #entityManager;
  #descriptorFormatter;
  #equipmentResolver;
  #anatomyFormattingService;

  constructor({
    logger,
    entityManager,
    descriptorFormatter,
    equipmentResolver,
    anatomyFormattingService,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager');
    validateDependency(descriptorFormatter, 'DescriptorFormatter');
    validateDependency(equipmentResolver, 'EquipmentResolver');
    validateDependency(anatomyFormattingService, 'AnatomyFormattingService');

    this.#entityManager = entityManager;
    this.#descriptorFormatter = descriptorFormatter;
    this.#equipmentResolver = equipmentResolver;
    this.#anatomyFormattingService = anatomyFormattingService;
  }

  /**
   * Generate equipment descriptions for an entity
   * @param {string} entityId - Entity ID to generate equipment descriptions for
   * @returns {Promise<string>} Formatted equipment description
   */
  async generateEquipmentDescriptions(entityId) {
    try {
      const equippedItems =
        await this.#equipmentResolver.getEquippedItems(entityId);

      if (!equippedItems || equippedItems.length === 0) {
        return '';
      }

      const equipmentDescriptions = [];

      for (const item of equippedItems) {
        const description = await this.#generateSingleEquipmentDescription(
          item.entityId
        );
        if (description) {
          equipmentDescriptions.push(description);
        }
      }

      return this.#formatEquipmentDescriptions(equipmentDescriptions);
    } catch (error) {
      this.#logger.error(
        `Failed to generate equipment descriptions for entity ${entityId}`,
        error
      );
      return '';
    }
  }

  /**
   * Generate description for a single equipment item
   * @param {string} equipmentEntityId - Equipment entity ID
   * @returns {Promise<string>} Formatted equipment description
   * @private
   */
  async #generateSingleEquipmentDescription(equipmentEntityId) {
    const entity =
      await this.#entityManager.getEntityInstance(equipmentEntityId);
    if (!entity) {
      return '';
    }

    const components = this.#extractEntityComponents(entity);
    const descriptors = this.#extractEquipmentDescriptors(components);

    return this.#descriptorFormatter.formatDescriptors(descriptors);
  }

  /**
   * Extract entity components
   * @param {object} entity - Entity instance
   * @returns {object} Entity components
   * @private
   */
  #extractEntityComponents(entity) {
    const components = {};

    for (const [componentId, componentData] of Object.entries(
      entity.components || {}
    )) {
      if (componentData) {
        components[componentId] = componentData;
      }
    }

    return components;
  }

  /**
   * Extract equipment descriptors using configured ordering
   * @param {object} components - Entity components
   * @returns {Array<{componentId: string, value: string}>} Equipment descriptors
   * @private
   */
  #extractEquipmentDescriptors(components) {
    const descriptors = [];
    const equipmentDescriptorOrder =
      this.#anatomyFormattingService.getEquipmentDescriptorOrder();
    const equipmentValueKeys =
      this.#anatomyFormattingService.getEquipmentDescriptorValueKeys();

    for (const [componentId, componentData] of Object.entries(components)) {
      if (componentId.startsWith('descriptors:') && componentData) {
        const value = this.#extractDescriptorValue(
          componentId,
          componentData,
          equipmentValueKeys
        );
        if (value) {
          descriptors.push({ componentId, value });
        }
      }
    }

    // Sort by configured equipment descriptor order
    return descriptors.sort((a, b) => {
      const indexA = equipmentDescriptorOrder.indexOf(a.componentId);
      const indexB = equipmentDescriptorOrder.indexOf(b.componentId);

      const orderA = indexA === -1 ? equipmentDescriptorOrder.length : indexA;
      const orderB = indexB === -1 ? equipmentDescriptorOrder.length : indexB;

      return orderA - orderB;
    });
  }

  /**
   * Extract descriptor value from component data
   * @param {string} componentId - Component ID
   * @param {object} componentData - Component data
   * @param {string[]} valueKeys - Possible value keys
   * @returns {string|null} Extracted value
   * @private
   */
  #extractDescriptorValue(componentId, componentData, valueKeys) {
    for (const key of valueKeys) {
      if (componentData[key]) {
        return componentData[key];
      }
    }

    // Fallback to first string value
    const values = Object.values(componentData);
    const stringValue = values.find((v) => typeof v === 'string');
    return stringValue || null;
  }

  /**
   * Format equipment descriptions with configured formatting
   * @param {string[]} descriptions - Equipment descriptions
   * @returns {string} Formatted equipment description
   * @private
   */
  #formatEquipmentDescriptions(descriptions) {
    if (!descriptions || descriptions.length === 0) {
      return '';
    }

    const config =
      this.#anatomyFormattingService.getEquipmentIntegrationConfig();

    const prefix = config.prefix || 'Wearing: ';
    const suffix = config.suffix || '.';
    const itemSeparator = config.itemSeparator || ' | ';

    return `${prefix}${descriptions.join(itemSeparator)}${suffix}`;
  }
}

export default EquipmentDescriptionService;
```

### 2. **EquipmentResolver** Implementation

**File**: `src/anatomy/equipmentResolver.js`

```javascript
/**
 * @file Service for resolving equipped items from anatomy entities
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 * @see src/anatomy/integration/SlotResolver.js
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('./integration/SlotResolver.js').SlotResolver} SlotResolver */

/**
 * Service for resolving equipped items from anatomy entities
 */
class EquipmentResolver {
  #logger;
  #entityManager;
  #slotResolver;

  constructor({ logger, entityManager, slotResolver }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager');
    validateDependency(slotResolver, 'SlotResolver');

    this.#entityManager = entityManager;
    this.#slotResolver = slotResolver;
  }

  /**
   * Get equipped items for an entity
   * @param {string} entityId - Entity ID to get equipped items for
   * @returns {Promise<Array<{entityId: string, slotId: string, attachmentPoint: string}>>} Equipped items
   */
  async getEquippedItems(entityId) {
    try {
      const equippedItems = [];

      // Get all entities with equipment components
      const allEntities = await this.#entityManager.getAllEntities();

      for (const entity of allEntities) {
        if (await this.#isEquippedToEntity(entity.id, entityId)) {
          const attachmentInfo = await this.#getAttachmentInfo(
            entity.id,
            entityId
          );
          equippedItems.push({
            entityId: entity.id,
            slotId: attachmentInfo.slotId,
            attachmentPoint: attachmentInfo.attachmentPoint,
          });
        }
      }

      return equippedItems;
    } catch (error) {
      this.#logger.error(
        `Failed to get equipped items for entity ${entityId}`,
        error
      );
      return [];
    }
  }

  /**
   * Check if an item is equipped to an entity
   * @param {string} itemEntityId - Item entity ID
   * @param {string} targetEntityId - Target entity ID
   * @returns {Promise<boolean>} True if item is equipped to target entity
   * @private
   */
  async #isEquippedToEntity(itemEntityId, targetEntityId) {
    const equipmentComponent = await this.#entityManager.getComponentData(
      itemEntityId,
      'equipment:equipped'
    );
    return (
      equipmentComponent && equipmentComponent.equippedTo === targetEntityId
    );
  }

  /**
   * Get attachment information for an equipped item
   * @param {string} itemEntityId - Item entity ID
   * @param {string} targetEntityId - Target entity ID
   * @returns {Promise<{slotId: string, attachmentPoint: string}>} Attachment information
   * @private
   */
  async #getAttachmentInfo(itemEntityId, targetEntityId) {
    const equipmentComponent = await this.#entityManager.getComponentData(
      itemEntityId,
      'equipment:equipped'
    );

    if (!equipmentComponent) {
      return { slotId: '', attachmentPoint: '' };
    }

    try {
      const attachmentPoints = await this.#slotResolver.resolve(
        targetEntityId,
        {
          clothingSlotId: equipmentComponent.slotId,
        }
      );

      return {
        slotId: equipmentComponent.slotId,
        attachmentPoint: attachmentPoints[0]?.socketId || '',
      };
    } catch (error) {
      this.#logger.error(
        `Failed to resolve attachment info for item ${itemEntityId}`,
        error
      );
      return { slotId: equipmentComponent.slotId, attachmentPoint: '' };
    }
  }
}

export default EquipmentResolver;
```

### 3. **BodyDescriptionOrchestrator** Enhancement

**File**: `src/anatomy/BodyDescriptionOrchestrator.js` (Modified)

```javascript
// Add to existing constructor
constructor({
  // ... existing parameters
  equipmentDescriptionService,
  enableEquipmentDescriptions = true,
}) {
  // ... existing initialization
  this.#equipmentDescriptionService = equipmentDescriptionService;
  this.#enableEquipmentDescriptions = enableEquipmentDescriptions;
}

// Modify generateAllDescriptions method
async generateAllDescriptions(bodyEntity) {
  try {
    // Generate anatomy descriptions (existing logic)
    const { bodyDescription, partDescriptions } = await this.#generateAnatomyDescriptions(bodyEntity);

    // Generate equipment descriptions (new logic)
    let enhancedBodyDescription = bodyDescription;
    if (this.#enableEquipmentDescriptions && this.#equipmentDescriptionService) {
      const equipmentDescription = await this.#equipmentDescriptionService.generateEquipmentDescriptions(bodyEntity.id);
      if (equipmentDescription) {
        enhancedBodyDescription = this.#combineDescriptions(bodyDescription, equipmentDescription);
      }
    }

    // Persist enhanced descriptions
    this.#descriptionPersistenceService.updateDescription(bodyEntity.id, enhancedBodyDescription);
    this.#descriptionPersistenceService.updateMultipleDescriptions(partDescriptions);

    return { bodyDescription: enhancedBodyDescription, partDescriptions };
  } catch (error) {
    this.#logger.error(`Failed to generate all descriptions for entity ${bodyEntity.id}`, error);
    throw error;
  }
}

// Add new method
#combineDescriptions(anatomyDescription, equipmentDescription) {
  if (!anatomyDescription) return equipmentDescription;
  if (!equipmentDescription) return anatomyDescription;

  return `${anatomyDescription}\n\n${equipmentDescription}`;
}
```

### 4. **AnatomyFormattingService** Enhancement

**File**: `src/anatomy/configuration/anatomyFormattingService.js` (Modified)

```javascript
// Add new methods
/**
 * Get equipment descriptor order from configuration
 * @returns {string[]} Equipment descriptor order
 */
getEquipmentDescriptorOrder() {
  return this.#config.equipmentDescriptorOrder || [];
}

/**
 * Get equipment descriptor value keys from configuration
 * @returns {string[]} Equipment descriptor value keys
 */
getEquipmentDescriptorValueKeys() {
  return this.#config.equipmentDescriptorValueKeys || [];
}

/**
 * Get equipment integration configuration
 * @returns {object} Equipment integration configuration
 */
getEquipmentIntegrationConfig() {
  return this.#config.equipmentIntegration || {
    enabled: false,
    prefix: 'Wearing: ',
    suffix: '.',
    separator: ', ',
    itemSeparator: ' | ',
    placement: 'after_anatomy',
  };
}
```

## Data Structure Definitions

### Equipment Descriptor Components

Equipment entities will use the same descriptor component pattern as anatomy parts:

```json
{
  "equipment:equipped": {
    "equippedTo": "character_entity_id",
    "slotId": "torso_clothing",
    "attachmentPoint": "torso_socket"
  },
  "descriptors:material": {
    "material": "silk"
  },
  "descriptors:color_basic": {
    "color": "black"
  },
  "descriptors:texture": {
    "texture": "silky"
  },
  "descriptors:quality": {
    "quality": "fine"
  },
  "core:description": {
    "text": "fine, black, silky silk"
  }
}
```

### Equipment Integration Schema

**File**: `data/schemas/anatomy-formatting.schema.json` (Enhanced)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "descriptionOrder": {
      "type": "array",
      "items": { "type": "string" }
    },
    "pairedParts": {
      "type": "array",
      "items": { "type": "string" }
    },
    "irregularPlurals": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "descriptorOrder": {
      "type": "array",
      "items": { "type": "string" }
    },
    "descriptorValueKeys": {
      "type": "array",
      "items": { "type": "string" }
    },
    "equipmentIntegration": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "prefix": { "type": "string" },
        "suffix": { "type": "string" },
        "separator": { "type": "string" },
        "itemSeparator": { "type": "string" },
        "placement": {
          "type": "string",
          "enum": ["after_anatomy", "before_anatomy", "integrated"]
        }
      },
      "required": ["enabled"]
    },
    "equipmentDescriptorOrder": {
      "type": "array",
      "items": { "type": "string" }
    },
    "equipmentDescriptorValueKeys": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": [
    "id",
    "descriptionOrder",
    "descriptorOrder",
    "descriptorValueKeys"
  ]
}
```

## Testing Strategy

### Unit Testing Requirements

#### 1. **EquipmentDescriptionService** Tests

**File**: `tests/unit/anatomy/equipmentDescriptionService.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testbed.js';
import EquipmentDescriptionService from '../../../src/anatomy/equipmentDescriptionService.js';

describe('EquipmentDescriptionService', () => {
  let testBed;
  let equipmentDescriptionService;
  let mockEntityManager;
  let mockDescriptorFormatter;
  let mockEquipmentResolver;

  beforeEach(() => {
    testBed = createTestBed();
    ({
      equipmentDescriptionService,
      mockEntityManager,
      mockDescriptorFormatter,
      mockEquipmentResolver,
    } = testBed.createEquipmentDescriptionService());
  });

  describe('generateEquipmentDescriptions', () => {
    it('should generate equipment descriptions for equipped items', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedItems = [
        {
          entityId: 'shirt_1',
          slotId: 'torso_clothing',
          attachmentPoint: 'torso_socket',
        },
        {
          entityId: 'boots_1',
          slotId: 'foot_clothing',
          attachmentPoint: 'foot_socket',
        },
      ];

      mockEquipmentResolver.getEquippedItems.mockResolvedValue(equippedItems);
      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce({
          id: 'shirt_1',
          components: { 'descriptors:material': { material: 'silk' } },
        })
        .mockResolvedValueOnce({
          id: 'boots_1',
          components: { 'descriptors:material': { material: 'leather' } },
        });

      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('silk')
        .mockReturnValueOnce('leather');

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescriptions(
          entityId
        );

      // Assert
      expect(result).toBe('Wearing: silk | leather.');
      expect(mockEquipmentResolver.getEquippedItems).toHaveBeenCalledWith(
        entityId
      );
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalledTimes(
        2
      );
    });

    it('should return empty string when no equipment is equipped', async () => {
      // Arrange
      const entityId = 'character_1';
      mockEquipmentResolver.getEquippedItems.mockResolvedValue([]);

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescriptions(
          entityId
        );

      // Assert
      expect(result).toBe('');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      mockEquipmentResolver.getEquippedItems.mockRejectedValue(
        new Error('Test error')
      );

      // Act
      const result =
        await equipmentDescriptionService.generateEquipmentDescriptions(
          entityId
        );

      // Assert
      expect(result).toBe('');
    });
  });
});
```

#### 2. **EquipmentResolver** Tests

**File**: `tests/unit/anatomy/equipmentResolver.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testbed.js';
import EquipmentResolver from '../../../src/anatomy/equipmentResolver.js';

describe('EquipmentResolver', () => {
  let testBed;
  let equipmentResolver;
  let mockEntityManager;
  let mockSlotResolver;

  beforeEach(() => {
    testBed = createTestBed();
    ({ equipmentResolver, mockEntityManager, mockSlotResolver } =
      testBed.createEquipmentResolver());
  });

  describe('getEquippedItems', () => {
    it('should return equipped items for entity', async () => {
      // Arrange
      const entityId = 'character_1';
      const mockEntities = [
        { id: 'shirt_1' },
        { id: 'boots_1' },
        { id: 'unequipped_item' },
      ];

      mockEntityManager.getAllEntities.mockResolvedValue(mockEntities);
      mockEntityManager.getComponentData
        .mockResolvedValueOnce({
          equippedTo: 'character_1',
          slotId: 'torso_clothing',
        })
        .mockResolvedValueOnce({
          equippedTo: 'character_1',
          slotId: 'foot_clothing',
        })
        .mockResolvedValueOnce(null);

      mockSlotResolver.resolve
        .mockResolvedValueOnce([{ socketId: 'torso_socket' }])
        .mockResolvedValueOnce([{ socketId: 'foot_socket' }]);

      // Act
      const result = await equipmentResolver.getEquippedItems(entityId);

      // Assert
      expect(result).toEqual([
        {
          entityId: 'shirt_1',
          slotId: 'torso_clothing',
          attachmentPoint: 'torso_socket',
        },
        {
          entityId: 'boots_1',
          slotId: 'foot_clothing',
          attachmentPoint: 'foot_socket',
        },
      ]);
    });

    it('should handle entities with no equipment components', async () => {
      // Arrange
      const entityId = 'character_1';
      mockEntityManager.getAllEntities.mockResolvedValue([]);

      // Act
      const result = await equipmentResolver.getEquippedItems(entityId);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
```

### Integration Testing Requirements

#### 1. **Equipment Description Integration** Tests

**File**: `tests/integration/anatomy/equipmentDescriptionIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Equipment Description Integration', () => {
  let testBed;
  let bodyDescriptionOrchestrator;
  let entityManager;

  beforeEach(() => {
    testBed = createIntegrationTestBed();
    bodyDescriptionOrchestrator = testBed.getBodyDescriptionOrchestrator();
    entityManager = testBed.getEntityManager();
  });

  it('should integrate equipment descriptions with anatomy descriptions', async () => {
    // Arrange
    const characterEntity = await testBed.createCharacterWithEquipment({
      anatomy: {
        build: 'athletic',
        hair: 'long, black',
        eyes: 'blue',
      },
      equipment: [
        {
          type: 'bodysuit',
          descriptors: {
            material: 'silk',
            color: 'black',
            texture: 'silky',
          },
          slot: 'torso_clothing',
        },
        {
          type: 'boots',
          descriptors: {
            material: 'leather',
            color: 'brown',
            quality: 'sturdy',
          },
          slot: 'foot_clothing',
        },
      ],
    });

    // Act
    const result =
      await bodyDescriptionOrchestrator.generateAllDescriptions(
        characterEntity
      );

    // Assert
    expect(result.bodyDescription).toContain('Build: athletic');
    expect(result.bodyDescription).toContain('Hair: long, black');
    expect(result.bodyDescription).toContain('Eyes: blue');
    expect(result.bodyDescription).toContain(
      'Wearing: silk, black, silky bodysuit | leather, brown, sturdy boots.'
    );
  });

  it('should handle anatomy descriptions without equipment', async () => {
    // Arrange
    const characterEntity = await testBed.createCharacterWithEquipment({
      anatomy: {
        build: 'athletic',
        hair: 'long, black',
      },
      equipment: [],
    });

    // Act
    const result =
      await bodyDescriptionOrchestrator.generateAllDescriptions(
        characterEntity
      );

    // Assert
    expect(result.bodyDescription).toContain('Build: athletic');
    expect(result.bodyDescription).toContain('Hair: long, black');
    expect(result.bodyDescription).not.toContain('Wearing:');
  });
});
```

### Performance Testing Requirements

#### 1. **Equipment Description Performance** Tests

**File**: `tests/performance/equipmentDescriptionPerformance.test.js`

```javascript
describe('Equipment Description Performance', () => {
  it('should generate equipment descriptions within performance targets', async () => {
    // Arrange
    const characterEntity = await testBed.createCharacterWithEquipment({
      equipment: Array(10)
        .fill(0)
        .map((_, i) => ({
          type: `item_${i}`,
          descriptors: {
            material: 'silk',
            color: 'black',
            texture: 'smooth',
          },
          slot: `slot_${i}`,
        })),
    });

    // Act
    const startTime = performance.now();
    const result =
      await bodyDescriptionOrchestrator.generateAllDescriptions(
        characterEntity
      );
    const endTime = performance.now();

    // Assert
    expect(endTime - startTime).toBeLessThan(100); // < 100ms for 10 equipment items
    expect(result.bodyDescription).toContain('Wearing:');
  });
});
```

## Implementation Tasks

### Phase 1: Core Service Implementation (5 days)

#### Task 1.1: EquipmentDescriptionService Implementation (2 days)

- **File**: `src/anatomy/equipmentDescriptionService.js`
- **Requirements**:
  - Implement equipment description generation
  - Use existing descriptor formatting infrastructure
  - Support configurable descriptor ordering
  - Handle equipment descriptor extraction
- **Tests**: Unit tests for all methods
- **Validation**: Service follows existing patterns

#### Task 1.2: EquipmentResolver Implementation (2 days)

- **File**: `src/anatomy/equipmentResolver.js`
- **Requirements**:
  - Implement equipped item resolution
  - Use existing clothing slot mapping infrastructure
  - Handle equipment attachment point resolution
  - Support equipment filtering and validation
- **Tests**: Unit tests for equipment resolution
- **Validation**: Integration with existing slot system

#### Task 1.3: Configuration Enhancement (1 day)

- **File**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Requirements**:
  - Add equipment integration configuration
  - Add equipment descriptor ordering
  - Add equipment descriptor value keys
  - Maintain backward compatibility
- **Tests**: Configuration validation tests
- **Validation**: Schema compliance

### Phase 2: Service Integration (3 days)

#### Task 2.1: BodyDescriptionOrchestrator Enhancement (2 days)

- **File**: `src/anatomy/BodyDescriptionOrchestrator.js`
- **Requirements**:
  - Integrate equipment description generation
  - Combine anatomy and equipment descriptions
  - Maintain backward compatibility
  - Support feature toggling
- **Tests**: Integration tests for combined descriptions
- **Validation**: No regression in existing functionality

#### Task 2.2: AnatomyFormattingService Enhancement (1 day)

- **File**: `src/anatomy/configuration/anatomyFormattingService.js`
- **Requirements**:
  - Add equipment configuration methods
  - Support equipment descriptor ordering
  - Support equipment integration configuration
  - Maintain existing API compatibility
- **Tests**: Configuration service tests
- **Validation**: Configuration loading and validation

### Phase 3: Integration and Testing (2 days)

#### Task 3.1: Service Factory Integration (1 day)

- **File**: `src/dependencyInjection/createDefaultServicesWithConfig.js`
- **Requirements**:
  - Register equipment description services
  - Wire service dependencies
  - Support configuration-based enabling
  - Maintain service factory patterns
- **Tests**: Service factory tests
- **Validation**: Dependency injection validation

#### Task 3.2: Comprehensive Testing (1 day)

- **Files**: `tests/unit/anatomy/`, `tests/integration/anatomy/`
- **Requirements**:
  - Unit tests for all new services
  - Integration tests for combined functionality
  - Performance tests for equipment descriptions
  - End-to-end tests for complete workflow
- **Tests**: All testing requirements
- **Validation**: 95%+ test coverage

## Success Criteria

### Technical Success Metrics

#### Functionality Targets

- **Equipment Description Generation**: Equipment descriptions generated using descriptor system
- **Configuration Integration**: Equipment descriptions configurable via JSON configuration
- **Descriptor Ordering**: Equipment descriptors ordered according to configuration
- **Format Compliance**: Equipment descriptions follow "Wearing: X, Y, Z..." format
- **Performance**: Equipment description generation adds < 10ms to anatomy description time

#### Quality Targets

- **Test Coverage**: 95%+ coverage for all equipment description code
- **Integration**: Seamless integration with existing anatomy description system
- **Backward Compatibility**: No breaking changes to existing anatomy description API
- **Error Handling**: Graceful handling of missing equipment or invalid configurations

### Functional Success Criteria

#### Equipment Description Integration

- **Descriptor System**: Equipment uses same descriptor system as anatomy parts
- **Configuration Driven**: Equipment descriptors configurable via JSON configuration
- **Slot Integration**: Equipment resolution uses existing clothing slot mapping
- **Format Consistency**: Equipment descriptions formatted consistently with anatomy descriptions

#### User Experience

- **Natural Integration**: Equipment descriptions appear naturally after anatomy descriptions
- **Configurable Format**: Equipment description format (prefix, suffix, separator) configurable
- **Performance**: No noticeable performance impact on anatomy description generation
- **Error Resilience**: System handles missing equipment gracefully

### Validation Criteria

#### Integration Validation

- **Anatomy Compatibility**: Equipment descriptions work with all existing anatomy configurations
- **Slot Compatibility**: Equipment resolution works with existing clothing slot mappings
- **Configuration Validation**: Equipment configuration validated against schema
- **Performance Validation**: Equipment description generation meets performance targets

#### Quality Validation

- **Unit Tests**: All unit tests pass with 95%+ coverage
- **Integration Tests**: All integration tests pass
- **Performance Tests**: Equipment description generation meets performance targets
- **End-to-End Tests**: Complete workflow functions correctly

## Risk Management

### Technical Risks

#### Risk 1: Performance Impact

- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Use existing caching infrastructure, optimize equipment resolution
- **Contingency**: Implement equipment description caching, optimize descriptor extraction

#### Risk 2: Configuration Complexity

- **Probability**: Low
- **Impact**: Medium
- **Mitigation**: Provide sensible defaults, comprehensive validation, clear documentation
- **Contingency**: Simplify configuration options, provide configuration examples

#### Risk 3: Integration Issues

- **Probability**: Low
- **Impact**: Medium
- **Mitigation**: Thorough integration testing, follow existing patterns, maintain backward compatibility
- **Contingency**: Feature flags for equipment descriptions, rollback mechanisms

### Implementation Risks

#### Risk 1: Dependency Complexity

- **Probability**: Low
- **Impact**: High
- **Mitigation**: Use existing dependency injection patterns, comprehensive testing
- **Contingency**: Simplify service dependencies, implement fallback mechanisms

#### Risk 2: Slot Resolution Issues

- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Use existing clothing slot mapping infrastructure, comprehensive testing
- **Contingency**: Implement equipment resolution fallbacks, improve error handling

## Rollback Strategy

### Immediate Rollback Options

#### Feature Flag Rollback

- **Scope**: Disable equipment descriptions via `equipmentIntegration.enabled = false`
- **Impact**: Equipment descriptions disabled, anatomy descriptions continue normally
- **Time**: < 1 minute (configuration change)
- **Risk**: None (anatomy descriptions unaffected)

#### Service Rollback

- **Scope**: Remove equipment description services from service factory
- **Impact**: Equipment description functionality removed
- **Time**: < 15 minutes (code deployment)
- **Risk**: Low (services have no dependencies on other systems)

### Gradual Rollback Options

#### Selective Equipment Types

- **Scope**: Disable specific equipment types via configuration
- **Impact**: Reduced equipment description coverage
- **Time**: < 5 minutes (configuration change)
- **Risk**: None (partial functionality maintained)

## Post-Implementation Tasks

### Documentation Updates

- **API Documentation**: Update anatomy description API documentation
- **Configuration Guide**: Document equipment description configuration options
- **Integration Guide**: Create equipment description integration guide
- **Examples**: Provide equipment description examples and use cases

### Performance Monitoring

- **Equipment Description Performance**: Monitor equipment description generation time
- **Memory Usage**: Track memory usage for equipment description generation
- **Cache Performance**: Monitor equipment description caching effectiveness
- **Error Tracking**: Track equipment description generation errors

### Future Enhancements

- **Advanced Equipment Descriptions**: Support for equipment condition, enchantments, etc.
- **Equipment Grouping**: Group equipment by type or location
- **Dynamic Equipment Descriptions**: Equipment descriptions that change based on context
- **Equipment Description Templates**: Template-based equipment description generation

## Conclusion

The Equipment Description Generation implementation extends the Living Narrative Engine's anatomy description system with comprehensive equipment description capabilities. The design leverages existing infrastructure while providing a flexible, configurable system for generating equipment descriptions.

**Key Benefits**:

- **Seamless Integration**: Equipment descriptions integrate naturally with anatomy descriptions
- **Configuration Flexibility**: Equipment descriptions fully configurable via JSON configuration
- **Performance**: Minimal performance impact on existing anatomy description generation
- **Consistency**: Equipment descriptions follow same patterns as anatomy descriptions

**Low Implementation Risk**:

- Leverages existing anatomy description infrastructure
- Uses established descriptor system patterns
- Maintains backward compatibility
- Comprehensive testing ensures quality

**Immediate Value**:

- Enhanced character descriptions with equipment information
- Configurable equipment description formatting
- Foundation for future equipment description enhancements
- Improved narrative immersion through detailed equipment descriptions

The implementation should proceed with confidence, following the detailed specifications and timeline outlined in this document. The result will be a comprehensive equipment description system that enhances the Living Narrative Engine's character description capabilities while maintaining performance and reliability.

---

_This specification provides the complete implementation guide for Equipment Description Generation in the Living Narrative Engine, ensuring integration follows existing architectural patterns and maintains system quality._
