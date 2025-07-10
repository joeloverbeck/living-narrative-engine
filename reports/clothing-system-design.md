# Clothing System Design Document

## Living Narrative Engine

**Version:** 1.0  
**Date:** 2025-07-10  
**Author:** AI Assistant (SuperClaude)

---

## Executive Summary

The Clothing System extends the Living Narrative Engine's anatomy system to provide comprehensive equipment and layering mechanics. Built on the existing socket-based architecture, it enables entities to equip, layer, and manage clothing items while maintaining the engine's core "modding-first" philosophy.

### Key Features

- **Socket-Based Integration**: Leverages existing anatomy system infrastructure
- **Multi-Layer Support**: Underwear, base clothing, and outer layers
- **Gender-Flexible Design**: Handles diverse anatomy configurations gracefully
- **Coverage Validation**: Ensures clothing compatibility with entity anatomy
- **Event-Driven Architecture**: Integrates seamlessly with existing systems

### Architecture Highlights

- **Domain-Driven Design**: Clear bounded contexts between Clothing and Anatomy domains
- **Component-Based**: ECS architecture with reusable clothing components
- **Validation-First**: Comprehensive compatibility checking before equipment changes
- **Modular Structure**: Complete clothing mod with extensible framework

---

## Domain-Driven Design Architecture

### Bounded Contexts

#### Clothing Domain

**Responsibilities:**

- Equipment management and validation
- Layer compatibility resolution
- Coverage area validation
- Clothing item lifecycle

**Core Entities:**

- `ClothingItem` (Entity) - Individual clothing pieces
- `Equipment` (Aggregate) - Manages all equipped items for an entity
- `WearableProperties` (Value Object) - Clothing characteristics
- `Coverage` (Value Object) - Body part coverage definition

#### Integration Points

- **Anatomy Domain**: Socket validation and body part queries
- **Core Domain**: Event dispatching and entity management
- **UI Domain**: Equipment display and interaction

### Service Architecture

#### Application Services

```
ClothingManagementService (Facade)
├── equipClothing(entityId, clothingItemId, options)
├── unequipClothing(entityId, clothingItemId)
├── getEquippedItems(entityId)
└── validateCompatibility(entityId, clothingItemId)
```

#### Domain Services

```
EquipmentOrchestrator
├── processEquipmentRequest()
├── resolveLayerConflicts()
└── validateEquipmentChain()

LayerCompatibilityService
├── checkLayerCompatibility()
├── getConflictingItems()
└── suggestResolutions()

CoverageValidationService
├── validateAnatomyCoverage()
├── checkRequiredCoverage()
└── allowMissingOptionalParts()
```

---

## Component Specifications

### clothing:wearable Component

```json
{
  "$schema": "http://example.com/schemas/component.schema.json",
  "id": "clothing:wearable",
  "description": "Defines clothing item properties and equipment behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "wearableType": {
        "type": "string",
        "enum": [
          "shirt",
          "pants",
          "underwear",
          "jacket",
          "shoes",
          "accessories"
        ],
        "description": "Category of clothing item"
      },
      "layer": {
        "type": "string",
        "enum": ["underwear", "base", "outer", "accessories"],
        "description": "Layer priority for stacking"
      },
      "coverage": {
        "type": "object",
        "properties": {
          "required": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Anatomy sockets that must exist"
          },
          "optional": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Sockets covered if present"
          },
          "exclusions": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Incompatible anatomy configurations"
          }
        },
        "required": ["required"]
      },
      "size": {
        "type": "string",
        "enum": ["xs", "s", "m", "l", "xl", "xxl"],
        "description": "Size compatibility"
      },
      "material": {
        "type": "string",
        "description": "Material composition"
      },
      "equipmentSlots": {
        "type": "object",
        "properties": {
          "primary": { "type": "string" },
          "secondary": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["primary"]
      }
    },
    "required": ["wearableType", "layer", "coverage", "equipmentSlots"]
  }
}
```

### clothing:equipment Component

```json
{
  "$schema": "http://example.com/schemas/component.schema.json",
  "id": "clothing:equipment",
  "description": "Tracks equipped clothing items with layer support",
  "dataSchema": {
    "type": "object",
    "properties": {
      "equipped": {
        "type": "object",
        "patternProperties": {
          "^[a-z_]+_clothing$": {
            "type": "object",
            "patternProperties": {
              "^(underwear|base|outer|accessories)$": {
                "type": "string",
                "description": "Entity ID of equipped item"
              }
            }
          }
        }
      },
      "maxLayers": {
        "type": "object",
        "patternProperties": {
          "^[a-z_]+_clothing$": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "required": ["equipped"]
  }
}
```

### clothing:clothing_slot Component

```json
{
  "$schema": "http://example.com/schemas/component.schema.json",
  "id": "clothing:clothing_slot",
  "description": "Extends anatomy sockets for clothing-specific behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "clothingSlots": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "slotId": { "type": "string" },
            "anatomySocket": { "type": "string" },
            "allowedLayers": {
              "type": "array",
              "items": { "type": "string" }
            },
            "layerOrder": {
              "type": "array",
              "items": { "type": "string" }
            },
            "maxItemsPerLayer": { "type": "integer" },
            "size": { "type": "string" },
            "tags": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "required": ["slotId", "anatomySocket", "allowedLayers"]
        }
      }
    },
    "required": ["clothingSlots"]
  }
}
```

---

## Clothing Mod Structure

### Mod Manifest

```json
{
  "$schema": "http://example.com/schemas/mod-manifest.schema.json",
  "id": "clothing",
  "version": "1.0.0",
  "name": "Clothing System",
  "description": "Comprehensive clothing and equipment system",
  "author": "Living Narrative Engine",
  "dependencies": [
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "core", "version": "^1.0.0" }
  ],
  "gameVersion": ">=0.0.1",
  "content": {
    "components": [
      "wearable.component.json",
      "equipment.component.json",
      "clothing_slot.component.json"
    ],
    "entities": {
      "definitions": [
        "basic_shirt.entity.json",
        "jeans.entity.json",
        "boxers.entity.json",
        "panties.entity.json",
        "jacket.entity.json",
        "dress_shirt.entity.json",
        "sneakers.entity.json"
      ]
    },
    "actions": [
      "equip.action.json",
      "unequip.action.json",
      "transfer_clothing.action.json"
    ],
    "events": [
      "clothing_equipped.event.json",
      "clothing_unequipped.event.json",
      "clothing_layer_conflict.event.json"
    ],
    "rules": [
      "validate_clothing_compatibility.rule.json",
      "handle_layer_conflicts.rule.json",
      "auto_unequip_conflicts.rule.json"
    ],
    "clothingFormatting": ["default.json"]
  }
}
```

### Example Clothing Entities

#### Basic Shirt

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "clothing:basic_shirt",
  "description": "A simple cotton shirt",
  "components": {
    "clothing:wearable": {
      "wearableType": "shirt",
      "layer": "base",
      "coverage": {
        "required": ["torso"],
        "optional": ["left_arm", "right_arm"],
        "exclusions": []
      },
      "size": "medium",
      "material": "cotton",
      "equipmentSlots": {
        "primary": "torso_clothing",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      }
    },
    "core:name": { "text": "basic shirt" },
    "core:description": { "text": "A comfortable cotton shirt" }
  }
}
```

#### Gender-Flexible Underwear

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "clothing:boxers",
  "description": "Comfortable underwear suitable for any anatomy",
  "components": {
    "clothing:wearable": {
      "wearableType": "underwear",
      "layer": "underwear",
      "coverage": {
        "required": ["lower_torso"],
        "optional": ["penis", "left_testicle", "right_testicle", "vagina"],
        "exclusions": []
      },
      "size": "medium",
      "material": "cotton",
      "equipmentSlots": {
        "primary": "lower_torso_clothing"
      }
    },
    "core:name": { "text": "boxers" },
    "core:description": { "text": "Comfortable cotton boxers" }
  }
}
```

---

## Event-Driven Integration

### Equipment Workflow Events

#### Core Equipment Events

```json
// clothing_equipped.event.json
{
  "id": "clothing_equipped",
  "description": "Fired when clothing item is successfully equipped",
  "schema": {
    "type": "object",
    "properties": {
      "entityId": {"type": "string"},
      "clothingItemId": {"type": "string"},
      "slotId": {"type": "string"},
      "layer": {"type": "string"},
      "timestamp": {"type": "string"}
    }
  }
}

// clothing_layer_conflict.event.json
{
  "id": "clothing_layer_conflict",
  "description": "Fired when layer conflicts are detected",
  "schema": {
    "type": "object",
    "properties": {
      "entityId": {"type": "string"},
      "conflictingItems": {"type": "array"},
      "targetItem": {"type": "string"},
      "resolution": {"type": "string"}
    }
  }
}
```

### Integration Event Flow

```
CLOTHING_EQUIP_REQUESTED
  ↓ (anatomy validation)
ANATOMY_COMPATIBILITY_CHECKED
  ↓ (layer validation)
CLOTHING_LAYER_COMPATIBILITY_VALIDATED
  ↓ (conflict resolution if needed)
CLOTHING_LAYER_CONFLICT_RESOLVED
  ↓ (equipment update)
CLOTHING_EQUIPPED
  ↓ (description update)
ANATOMY_DESCRIPTION_UPDATE_REQUESTED
```

---

## Gender-Flexible & Missing Body Parts Design

### Coverage System

The coverage system uses three categories to handle anatomical diversity:

1. **Required Coverage**: Body parts that must exist for the item to be equipped
2. **Optional Coverage**: Parts that are covered if present, ignored if missing
3. **Exclusions**: Anatomical configurations that prevent equipment

### Validation Logic

```javascript
// Pseudo-code for coverage validation
function validateCoverage(entity, clothingItem) {
  const anatomy = getEntityAnatomy(entity);
  const coverage = clothingItem.coverage;

  // Check required coverage
  for (const requiredPart of coverage.required) {
    if (!anatomy.hasPart(requiredPart)) {
      return false; // Cannot equip
    }
  }

  // Check exclusions
  for (const excludedPart of coverage.exclusions) {
    if (anatomy.hasPart(excludedPart)) {
      return false; // Incompatible anatomy
    }
  }

  // Optional parts are covered if present, ignored if missing
  return true;
}
```

### Size Compatibility

```javascript
function validateSize(entitySize, clothingSize) {
  const sizeCompatibility = {
    xs: ['xs', 's'],
    s: ['xs', 's', 'm'],
    m: ['s', 'm', 'l'],
    l: ['m', 'l', 'xl'],
    xl: ['l', 'xl', 'xxl'],
    xxl: ['xl', 'xxl'],
  };

  return sizeCompatibility[entitySize]?.includes(clothingSize) ?? false;
}
```

---

## Layer Management System

### Layer Hierarchy

1. **underwear** (bottom layer)
2. **base** (shirts, pants)
3. **outer** (jackets, coats)
4. **accessories** (top layer)

### Conflict Resolution Strategies

- **Auto-Remove**: Automatically unequip conflicting items
- **Prompt-User**: Ask for user decision on conflicts
- **Block-Equip**: Prevent equipment if conflicts exist
- **Layer-Swap**: Move items between compatible layers

### Layer Rules

```json
{
  "layerRules": {
    "torso_clothing": {
      "maxLayers": 3,
      "order": ["underwear", "base", "outer"],
      "conflicts": {
        "base": ["base"], // Only one base layer item
        "outer": ["outer"]
      },
      "requirements": {
        "outer": ["base"] // Outer requires base layer
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

- Component validation (wearable, equipment, clothing_slot schemas)
- Layer compatibility logic
- Coverage validation algorithms
- Size compatibility checks
- Event payload validation

### Integration Tests

- Full equip/unequip workflows
- Anatomy system integration
- Multi-layer equipment scenarios
- Gender-flexible equipment validation
- Missing body part handling

### Edge Case Tests

- Conflicting equipment scenarios
- Invalid anatomy configurations
- Size mismatch handling
- Layer requirement violations
- Event sequence validation

### Performance Tests

- Large inventory management
- Complex layering scenarios
- Batch equipment operations
- Memory usage optimization

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

- Create clothing mod structure
- Implement core component schemas
- Basic entity definitions
- Initial validation services

### Phase 2: Core Services (Week 2)

- ClothingManagementService implementation
- Layer compatibility service
- Coverage validation service
- Basic equip/unequip actions

### Phase 3: Integration (Week 3)

- Anatomy system integration
- Event-driven workflows
- Conflict resolution
- Description system updates

### Phase 4: Advanced Features (Week 4)

- Complex layering rules
- Batch operations
- Performance optimizations
- Comprehensive testing

### Phase 5: Polish & Documentation (Week 5)

- User documentation
- Modding guide
- Performance tuning
- Final testing and validation

---

## Conclusion

The Clothing System represents a natural evolution of the Living Narrative Engine's anatomy system, providing comprehensive equipment mechanics while maintaining the engine's core principles of modularity, data-driven design, and total moddability.

By leveraging the existing socket infrastructure and ECS architecture, the clothing system integrates seamlessly while adding powerful new capabilities for character customization and gameplay mechanics.

The gender-flexible design and robust validation ensure the system can handle diverse anatomical configurations gracefully, making it suitable for a wide range of narrative and gameplay scenarios.

---

_Living Narrative Engine Clothing System Design v1.0_  
_Domain-Driven • Event-Driven • Modding-First_
