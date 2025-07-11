# Comprehensive Guide to the Living Narrative Engine Clothing System

## Table of Contents

1. [System Overview](#system-overview)
2. [Clothing Slots in Blueprints](#clothing-slots-in-blueprints)
3. [Clothing Definitions in Recipes](#clothing-definitions-in-recipes)
4. [Clothing Components](#clothing-components)
5. [Clothing Instantiation Process](#clothing-instantiation-process)
6. [Integration with Anatomy Graph Creation](#integration-with-anatomy-graph-creation)
7. [Practical Examples](#practical-examples)
8. [API Reference](#api-reference)
9. [Architecture Diagrams](#architecture-diagrams)

## System Overview

The Living Narrative Engine's clothing system is a sophisticated, modular architecture that seamlessly integrates with the anatomy system to provide flexible, layered clothing mechanics. The system follows the engine's "modding-first" philosophy, allowing all clothing definitions to be specified through JSON data files.

### Key Design Principles

1. **Separation of Concerns**: Anatomy structure is separate from clothing equipment
2. **Layered Clothing**: Support for multiple clothing layers (underwear → base → outer → armor → accessories)
3. **Slot-Based Equipment**: Clothing occupies specific anatomy slots with validation
4. **Size & Coverage Validation**: Ensures clothing fits properly on characters
5. **Full Moddability**: All clothing data defined in JSON files

### System Flow

```
Anatomy Blueprint → Clothing Slot Mappings → Recipe Definitions
                                                    ↓
Character Generation ← Clothing Instantiation ← Equipment Process
```

## Clothing Slots in Blueprints

### Schema Definition: `anatomy.blueprint.schema.json`

The anatomy blueprint schema defines how clothing slots are mapped to anatomical structures:

```json
{
  "clothingSlotMappings": {
    "type": "object",
    "description": "Maps anatomical sockets to clothing slots",
    "additionalProperties": {
      "type": "object",
      "properties": {
        "slotType": {
          "type": "string",
          "enum": [
            "head",
            "torso",
            "legs",
            "feet",
            "hands",
            "neck",
            "waist",
            "back",
            "fingers",
            "wrists",
            "ears"
          ]
        },
        "priority": {
          "type": "number",
          "description": "Higher priority slots are preferred when multiple slots could accept an item"
        },
        "allowedLayers": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["underwear", "base", "outer", "armor", "accessories"]
          }
        }
      }
    }
  }
}
```

### Blueprint Implementation Example

From `data/mods/anatomy/blueprints/humanoid.blueprint.json`:

```json
{
  "id": "anatomy:humanoid",
  "sockets": {
    "head": {
      "id": "head",
      "displayName": "Head",
      "maxConnections": 1,
      "acceptsLimbs": ["head"],
      "position": { "x": 0, "y": 180, "z": 0 }
    },
    "torso": {
      "id": "torso",
      "displayName": "Torso",
      "maxConnections": 5,
      "acceptsLimbs": ["torso"],
      "position": { "x": 0, "y": 120, "z": 0 }
    }
  },
  "clothingSlotMappings": {
    "head": {
      "slotType": "head",
      "priority": 10,
      "allowedLayers": ["base", "outer", "armor", "accessories"]
    },
    "torso": {
      "slotType": "torso",
      "priority": 20,
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "left_hand": {
      "slotType": "hands",
      "priority": 5,
      "allowedLayers": ["base", "armor", "accessories"]
    },
    "right_hand": {
      "slotType": "hands",
      "priority": 5,
      "allowedLayers": ["base", "armor", "accessories"]
    }
  }
}
```

### Socket-to-Slot Mapping Logic

The mapping system allows multiple sockets to share the same slot type (e.g., both hands map to "hands" slot type), enabling items that cover multiple body parts:

```
Socket ID    →    Slot Type    →    Clothing Item
---------         ----------         -------------
left_hand    →    hands        →    gloves (covers both)
right_hand   →    hands        →    gloves (covers both)
head         →    head         →    helmet
torso        →    torso        →    shirt
```

## Clothing Definitions in Recipes

### Schema Definition: `anatomy.recipe.schema.json`

The anatomy recipe schema includes a `clothing` section for specifying initial equipment:

```json
{
  "clothing": {
    "type": "array",
    "description": "Clothing entities to instantiate and equip",
    "items": {
      "type": "object",
      "properties": {
        "entityId": {
          "type": "string",
          "description": "ID for the created clothing entity"
        },
        "components": {
          "type": "object",
          "description": "Component data for the clothing item"
        },
        "autoEquip": {
          "type": "boolean",
          "description": "Whether to automatically equip after creation",
          "default": true
        }
      },
      "required": ["entityId", "components"]
    }
  }
}
```

### Recipe Example

Character recipe with clothing (`amaia_castillo.recipe.json` pattern):

```json
{
  "id": "characters:amaia_castillo",
  "anatomyBlueprint": "anatomy:humanoid",
  "limbSelection": {
    "head": "anatomy:human_head_female",
    "torso": "anatomy:human_torso_female",
    "left_arm": "anatomy:human_arm",
    "right_arm": "anatomy:human_arm",
    "left_leg": "anatomy:human_leg",
    "right_leg": "anatomy:human_leg"
  },
  "clothing": [
    {
      "entityId": "amaia_shirt",
      "components": {
        "clothing:wearable": {
          "displayName": "Silk Blouse",
          "description": "An elegant white silk blouse",
          "clothingType": "shirt",
          "layer": "base",
          "coverage": ["torso", "arms"],
          "size": "medium",
          "material": "silk",
          "condition": 1.0,
          "style": {
            "color": "white",
            "pattern": "solid",
            "fit": "tailored"
          }
        },
        "core:tags": {
          "tags": ["clothing", "formal", "silk", "white"]
        }
      }
    },
    {
      "entityId": "amaia_skirt",
      "components": {
        "clothing:wearable": {
          "displayName": "Pencil Skirt",
          "description": "A professional black pencil skirt",
          "clothingType": "skirt",
          "layer": "base",
          "coverage": ["waist", "hips", "legs"],
          "size": "medium",
          "material": "wool",
          "condition": 1.0,
          "style": {
            "color": "black",
            "pattern": "solid",
            "length": "knee"
          }
        }
      }
    }
  ]
}
```

## Clothing Components

### Core Components Overview

Located in `data/mods/clothing/components/`:

#### 1. `clothing:wearable` Component

Defines the core properties of a wearable item:

```json
{
  "id": "clothing:wearable",
  "dataSchema": {
    "type": "object",
    "properties": {
      "displayName": { "type": "string" },
      "description": { "type": "string" },
      "clothingType": {
        "type": "string",
        "enum": [
          "shirt",
          "pants",
          "dress",
          "shoes",
          "hat",
          "gloves",
          "jacket",
          "underwear",
          "accessories"
        ]
      },
      "layer": {
        "type": "string",
        "enum": ["underwear", "base", "outer", "armor", "accessories"],
        "description": "Clothing layer for stacking order"
      },
      "coverage": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Body parts this clothing covers"
      },
      "size": {
        "type": "string",
        "enum": [
          "extra_small",
          "small",
          "medium",
          "large",
          "extra_large",
          "adjustable"
        ]
      },
      "material": {
        "type": "string",
        "description": "Primary material (cotton, silk, leather, etc.)"
      },
      "condition": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "Item condition (0 = destroyed, 1 = perfect)"
      },
      "style": {
        "type": "object",
        "properties": {
          "color": { "type": "string" },
          "pattern": { "type": "string" },
          "fit": { "type": "string" }
        }
      }
    },
    "required": ["displayName", "clothingType", "layer", "coverage", "size"]
  }
}
```

#### 2. `clothing:clothing_slot` Component

Extends anatomy sockets for clothing-specific behavior:

```json
{
  "id": "clothing:clothing_slot",
  "dataSchema": {
    "type": "object",
    "properties": {
      "slotType": {
        "type": "string",
        "enum": [
          "head",
          "torso",
          "legs",
          "feet",
          "hands",
          "neck",
          "waist",
          "back"
        ]
      },
      "equippedItems": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entityId": { "type": "string" },
            "layer": { "type": "string" }
          }
        }
      },
      "slotRestrictions": {
        "type": "object",
        "properties": {
          "maxItemsPerLayer": { "type": "number" },
          "blockedLayers": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

#### 3. `clothing:equipment` Component

Manages equipment state and interactions:

```json
{
  "id": "clothing:equipment",
  "dataSchema": {
    "type": "object",
    "properties": {
      "equipped": {
        "type": "boolean",
        "description": "Whether this item is currently equipped"
      },
      "equippedTo": {
        "type": "string",
        "description": "Entity ID of the character wearing this"
      },
      "equippedSlots": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Socket IDs this item occupies"
      },
      "equipmentBonuses": {
        "type": "object",
        "description": "Stat bonuses or effects when equipped"
      }
    }
  }
}
```

## Clothing Instantiation Process

### Service Architecture

The clothing instantiation system consists of several key services in `src/clothing/`:

#### 1. `ClothingInstantiationService`

Main service responsible for creating clothing entities from recipes:

```javascript
class ClothingInstantiationService {
  constructor({ entityManager, componentRegistry, eventBus, logger }) {
    // Dependencies
  }

  async instantiateClothingFromRecipe(recipe, characterEntityId) {
    const clothingEntities = [];

    for (const clothingDef of recipe.clothing || []) {
      // 1. Create entity with specified ID
      const entityId = `${characterEntityId}_${clothingDef.entityId}`;
      await this.#entityManager.createEntity(entityId);

      // 2. Add components
      for (const [componentId, data] of Object.entries(
        clothingDef.components
      )) {
        await this.#entityManager.addComponent(entityId, componentId, data);
      }

      // 3. Dispatch creation event
      this.#eventBus.dispatch({
        type: 'CLOTHING_CREATED',
        payload: {
          entityId,
          characterId: characterEntityId,
          autoEquip: clothingDef.autoEquip ?? true,
        },
      });

      clothingEntities.push(entityId);
    }

    return clothingEntities;
  }
}
```

#### 2. `AnatomyClothingIntegrationService`

Bridges anatomy and clothing systems:

```javascript
class AnatomyClothingIntegrationService {
  async validateSlotCompatibility(clothingEntity, anatomyGraph, targetSocket) {
    // 1. Get clothing properties
    const wearable = await this.#entityManager.getComponent(
      clothingEntity,
      'clothing:wearable'
    );

    // 2. Get socket's clothing slot mapping
    const slotMapping = anatomyGraph.getSocketClothingMapping(targetSocket);

    // 3. Validate layer compatibility
    if (!slotMapping.allowedLayers.includes(wearable.layer)) {
      throw new Error(
        `Layer ${wearable.layer} not allowed on socket ${targetSocket}`
      );
    }

    // 4. Validate coverage matches socket type
    const requiredCoverage = this.#mapSlotTypeToCoverage(slotMapping.slotType);
    const hasRequiredCoverage = requiredCoverage.every((part) =>
      wearable.coverage.includes(part)
    );

    if (!hasRequiredCoverage) {
      throw new Error('Clothing does not cover required body parts');
    }

    // 5. Check for conflicts with existing equipment
    return this.#checkLayerConflicts(
      anatomyGraph,
      targetSocket,
      wearable.layer
    );
  }

  async equipClothingToAnatomyGraph(
    clothingEntity,
    anatomyGraph,
    characterEntity
  ) {
    // 1. Find compatible sockets
    const compatibleSockets = await this.#findCompatibleSockets(
      clothingEntity,
      anatomyGraph
    );

    // 2. Validate each socket
    for (const socket of compatibleSockets) {
      await this.validateSlotCompatibility(
        clothingEntity,
        anatomyGraph,
        socket
      );
    }

    // 3. Update equipment component
    await this.#entityManager.updateComponent(
      clothingEntity,
      'clothing:equipment',
      {
        equipped: true,
        equippedTo: characterEntity,
        equippedSlots: compatibleSockets,
      }
    );

    // 4. Update anatomy graph slots
    for (const socket of compatibleSockets) {
      await this.#updateSocketEquipment(anatomyGraph, socket, clothingEntity);
    }
  }
}
```

#### 3. `EquipmentOrchestrator`

Manages complex equipment workflows:

```javascript
class EquipmentOrchestrator {
  async processEquipmentRequest(request) {
    const workflow = this.#createWorkflow(request);

    try {
      // 1. Validate prerequisites
      await workflow.validatePrerequisites();

      // 2. Resolve conflicts (unequip conflicting items)
      const conflicts = await workflow.detectConflicts();
      for (const conflict of conflicts) {
        await this.#resolveConflict(conflict);
      }

      // 3. Execute equipment changes
      await workflow.execute();

      // 4. Update UI/notifications
      this.#eventBus.dispatch({
        type: 'EQUIPMENT_CHANGED',
        payload: workflow.getChanges(),
      });
    } catch (error) {
      await workflow.rollback();
      throw error;
    }
  }
}
```

### Instantiation Flow Diagram

```
┌─────────────────────┐
│   Recipe Loaded     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Parse Clothing Defs │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│ For Each Clothing Item: │
│ 1. Create Entity        │
│ 2. Add Components       │
│ 3. Validate Properties  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Auto-Equip Enabled?    │
└──────┬──────────────────┘
       │ Yes
       ▼
┌─────────────────────────┐
│ Find Compatible Slots   │
│ (Match coverage & type) │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Validate Fit:         │
│ - Size compatibility    │
│ - Layer conflicts       │
│ - Slot availability     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Equip to Slots:       │
│ - Update equipment comp │
│ - Update anatomy slots  │
│ - Dispatch events       │
└─────────────────────────┘
```

## Integration with Anatomy Graph Creation

### Anatomy Graph Generation Flow

The clothing system integrates during anatomy graph creation in `src/anatomy/`:

#### 1. `AnatomyGraphBuilder`

Incorporates clothing slot mappings during graph construction:

```javascript
class AnatomyGraphBuilder {
  async buildFromRecipe(recipe) {
    // 1. Load blueprint
    const blueprint = await this.#loadBlueprint(recipe.anatomyBlueprint);

    // 2. Create base graph structure
    const graph = new AnatomyGraph();

    // 3. Add sockets with clothing mappings
    for (const [socketId, socketDef] of Object.entries(blueprint.sockets)) {
      const socket = graph.addSocket(socketId, socketDef);

      // Add clothing slot mapping if present
      if (blueprint.clothingSlotMappings?.[socketId]) {
        socket.setClothingMapping(blueprint.clothingSlotMappings[socketId]);
      }
    }

    // 4. Add limbs based on recipe selection
    await this.#addLimbs(graph, recipe.limbSelection);

    // 5. Initialize clothing slots
    await this.#initializeClothingSlots(graph);

    return graph;
  }

  async #initializeClothingSlots(graph) {
    for (const socket of graph.getAllSockets()) {
      if (socket.hasClothingMapping()) {
        // Add clothing slot component to track equipment
        await this.#entityManager.addComponent(
          socket.entityId,
          'clothing:clothing_slot',
          {
            slotType: socket.clothingMapping.slotType,
            equippedItems: [],
            slotRestrictions: {
              maxItemsPerLayer: 1,
              blockedLayers: [],
            },
          }
        );
      }
    }
  }
}
```

#### 2. `CharacterGenerationService`

Orchestrates the complete character creation including clothing:

```javascript
class CharacterGenerationService {
  async generateCharacter(recipe, entityId) {
    try {
      // 1. Create anatomy graph
      const anatomyGraph =
        await this.#anatomyGraphBuilder.buildFromRecipe(recipe);

      // 2. Attach graph to character entity
      await this.#attachAnatomyToEntity(entityId, anatomyGraph);

      // 3. Instantiate clothing items
      const clothingEntities =
        await this.#clothingInstantiationService.instantiateClothingFromRecipe(
          recipe,
          entityId
        );

      // 4. Auto-equip clothing
      for (const clothingId of clothingEntities) {
        const clothingDef = recipe.clothing.find(
          (c) => `${entityId}_${c.entityId}` === clothingId
        );

        if (clothingDef?.autoEquip !== false) {
          await this.#equipClothing(clothingId, anatomyGraph, entityId);
        }
      }

      // 5. Finalize and validate
      await this.#finalizeCharacter(entityId, anatomyGraph);

      return { entityId, anatomyGraph, clothingEntities };
    } catch (error) {
      this.#logger.error('Character generation failed', error);
      throw new CharacterGenerationError(error.message);
    }
  }

  async #equipClothing(clothingId, anatomyGraph, characterId) {
    await this.#equipmentOrchestrator.processEquipmentRequest({
      action: 'equip',
      itemId: clothingId,
      targetId: characterId,
      anatomyGraph,
      options: {
        autoResolveConflicts: true,
        validateFit: true,
      },
    });
  }
}
```

### Complete Integration Flow

```
Character Recipe
       │
       ▼
┌──────────────────────┐     ┌─────────────────────┐
│  Anatomy Blueprint   │────▶│  Clothing Mappings  │
└──────────┬───────────┘     └──────────┬──────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐     ┌─────────────────────┐
│  Build Anatomy Graph │────▶│ Initialize Clothing │
│  - Create sockets    │     │ Slots on Sockets    │
│  - Add limbs         │     └─────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Instantiate Clothing │
│ From Recipe Defs     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Auto-Equip Process  │
│  - Find slots        │
│  - Validate fit      │
│  - Update components │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Complete Character  │
│  With Equipped Items │
└──────────────────────┘
```

## Practical Examples

### Example 1: Defining a Complete Outfit

For a character like Amaia Castillo, you would define clothing in the recipe:

```json
{
  "id": "characters:amaia_castillo",
  "clothing": [
    {
      "entityId": "designer_blouse",
      "components": {
        "clothing:wearable": {
          "displayName": "Designer Silk Blouse",
          "description": "An elegant ivory silk blouse with pearl buttons",
          "clothingType": "shirt",
          "layer": "base",
          "coverage": ["torso", "arms"],
          "size": "medium",
          "material": "silk",
          "condition": 1.0,
          "style": {
            "color": "ivory",
            "pattern": "solid",
            "fit": "tailored",
            "details": ["pearl_buttons", "french_cuffs"]
          }
        },
        "clothing:valuable": {
          "baseValue": 500,
          "currency": "USD"
        }
      }
    },
    {
      "entityId": "pencil_skirt",
      "components": {
        "clothing:wearable": {
          "displayName": "Charcoal Pencil Skirt",
          "description": "A professional knee-length pencil skirt",
          "clothingType": "skirt",
          "layer": "base",
          "coverage": ["waist", "hips", "legs"],
          "size": "medium",
          "material": "wool_blend",
          "condition": 1.0,
          "style": {
            "color": "charcoal",
            "pattern": "solid",
            "length": "knee",
            "fit": "fitted"
          }
        }
      }
    },
    {
      "entityId": "designer_heels",
      "components": {
        "clothing:wearable": {
          "displayName": "Louboutin Heels",
          "description": "Black patent leather pumps with red soles",
          "clothingType": "shoes",
          "layer": "base",
          "coverage": ["feet"],
          "size": "medium",
          "material": "patent_leather",
          "condition": 0.95,
          "style": {
            "color": "black",
            "heel_height": "4_inch",
            "brand": "louboutin"
          }
        }
      }
    }
  ]
}
```

### Example 2: Layered Clothing System

Demonstrating the layer system with underwear → base → outer:

```json
{
  "clothing": [
    {
      "entityId": "lace_bra",
      "components": {
        "clothing:wearable": {
          "displayName": "Black Lace Bra",
          "clothingType": "underwear",
          "layer": "underwear",
          "coverage": ["chest"],
          "size": "medium"
        }
      }
    },
    {
      "entityId": "silk_camisole",
      "components": {
        "clothing:wearable": {
          "displayName": "Silk Camisole",
          "clothingType": "shirt",
          "layer": "base",
          "coverage": ["torso"],
          "size": "medium"
        }
      }
    },
    {
      "entityId": "blazer",
      "components": {
        "clothing:wearable": {
          "displayName": "Tailored Blazer",
          "clothingType": "jacket",
          "layer": "outer",
          "coverage": ["torso", "arms"],
          "size": "medium"
        }
      }
    }
  ]
}
```

### Example 3: Slot Conflict Resolution

When equipping items that conflict:

```javascript
// Scenario: Equipping gloves when rings are equipped
const equipmentRequest = {
  action: 'equip',
  itemId: 'leather_gloves',
  targetId: 'character_001',
};

// The EquipmentOrchestrator will:
// 1. Detect that gloves conflict with rings on finger slots
// 2. Present options:
//    a) Remove rings first
//    b) Cancel glove equipping
//    c) Force equip (if allowed by game rules)

// Resolution workflow:
orchestrator.processEquipmentRequest(equipmentRequest).then((result) => {
  // result.unequipped = ['ring_1', 'ring_2']
  // result.equipped = ['leather_gloves']
});
```

## API Reference

### ClothingInstantiationService

```javascript
class ClothingInstantiationService {
  /**
   * Create clothing entities from a recipe definition
   * @param {Object} recipe - Character recipe with clothing array
   * @param {string} characterEntityId - Target character entity
   * @returns {Promise<string[]>} Created clothing entity IDs
   */
  async instantiateClothingFromRecipe(recipe, characterEntityId)

  /**
   * Create a single clothing item
   * @param {Object} clothingDef - Clothing definition object
   * @param {string} ownerId - Owner entity ID
   * @returns {Promise<string>} Created entity ID
   */
  async createClothingItem(clothingDef, ownerId)
}
```

### AnatomyClothingIntegrationService

```javascript
class AnatomyClothingIntegrationService {
  /**
   * Validate if clothing can be equipped to a socket
   * @param {string} clothingEntity - Clothing entity ID
   * @param {AnatomyGraph} anatomyGraph - Target anatomy graph
   * @param {string} targetSocket - Socket ID to check
   * @returns {Promise<boolean>} Whether slot is compatible
   */
  async validateSlotCompatibility(clothingEntity, anatomyGraph, targetSocket)

  /**
   * Equip clothing to anatomy graph
   * @param {string} clothingEntity - Item to equip
   * @param {AnatomyGraph} anatomyGraph - Target anatomy
   * @param {string} characterEntity - Character entity ID
   * @returns {Promise<void>}
   */
  async equipClothingToAnatomyGraph(clothingEntity, anatomyGraph, characterEntity)

  /**
   * Find all compatible sockets for a clothing item
   * @param {string} clothingEntity - Clothing entity ID
   * @param {AnatomyGraph} anatomyGraph - Anatomy to check
   * @returns {Promise<string[]>} Compatible socket IDs
   */
  async findCompatibleSockets(clothingEntity, anatomyGraph)
}
```

### EquipmentOrchestrator

```javascript
class EquipmentOrchestrator {
  /**
   * Process complex equipment request with conflict resolution
   * @param {Object} request - Equipment request object
   * @param {string} request.action - 'equip' | 'unequip' | 'swap'
   * @param {string} request.itemId - Item entity ID
   * @param {string} request.targetId - Target character ID
   * @param {Object} request.options - Additional options
   * @returns {Promise<EquipmentResult>} Result with changes
   */
  async processEquipmentRequest(request)

  /**
   * Detect equipment conflicts for an item
   * @param {string} itemId - Item to check
   * @param {string} characterId - Character to check on
   * @returns {Promise<Conflict[]>} Array of conflicts
   */
  async detectConflicts(itemId, characterId)
}
```

## Architecture Diagrams

### Component Relationships

```
┌─────────────────────────────────────────────────────────┐
│                   Character Entity                      │
├─────────────────────────────────────────────────────────┤
│ Components:                                             │
│ - core:identity                                         │
│ - anatomy:anatomy_owner                                 │
│ - character:attributes                                  │
└────────────────────┬────────────────────────────────────┘
                     │ owns
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Anatomy Graph                         │
├─────────────────────────────────────────────────────────┤
│ Sockets with Clothing Mappings:                        │
│ - head → head slot (accessories, armor)                │
│ - torso → torso slot (all layers)                      │
│ - left_hand + right_hand → hands slot                  │
└────────────────────┬────────────────────────────────────┘
                     │ equipped to
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Clothing Entities                      │
├─────────────────────────────────────────────────────────┤
│ Components:                                             │
│ - clothing:wearable (properties)                        │
│ - clothing:equipment (equipped state)                   │
│ - clothing:valuable (optional)                          │
│ - core:tags (categorization)                           │
└─────────────────────────────────────────────────────────┘
```

### Service Interaction Flow

```
                    ┌─────────────────┐
                    │ CharacterGen    │
                    │ Service         │
                    └────────┬────────┘
                             │
                             ▼
        ┌────────────────────┴───────────────────┐
        │                                        │
        ▼                                        ▼
┌──────────────┐                      ┌─────────────────┐
│ AnatomyGraph │                      │ ClothingInst.   │
│ Builder      │                      │ Service         │
└──────┬───────┘                      └────────┬────────┘
       │                                       │
       │                                       │
       └───────────────┬───────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Integration    │
              │ Service        │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Equipment      │
              │ Orchestrator   │
              └────────────────┘
```

### Data Flow Through System

```
JSON Files                 Runtime Objects              Services
──────────                 ───────────────              ────────

blueprint.json      ──▶    Blueprint Object      ──▶    AnatomyGraphBuilder
  ├─ sockets                ├─ Socket defs              ├─ Creates graph
  └─ clothingMappings       └─ Slot mappings            └─ Init slots

recipe.json         ──▶    Recipe Object         ──▶    ClothingInstService
  ├─ anatomy                ├─ Blueprint ref            ├─ Creates entities
  └─ clothing[]             └─ Clothing defs            └─ Adds components

components/         ──▶    Component Registry   ──▶    EntityManager
  ├─ wearable              ├─ Schemas                  ├─ Validates data
  └─ equipment             └─ Validators               └─ Stores state
```

## Summary

The Living Narrative Engine's clothing system provides a sophisticated, fully-moddable approach to character equipment:

1. **Blueprints** define which anatomy sockets can accept clothing and their constraints
2. **Recipes** specify initial clothing items for characters with full customization
3. **Components** provide the data structure for clothing properties and state
4. **Services** handle the complex orchestration of instantiation and equipment
5. **Integration** with anatomy system ensures proper validation and state management

This architecture allows for:

- Complex layered clothing systems
- Size and fit validation
- Slot conflict resolution
- Full modding support
- Event-driven state changes
- Extensible component system

When defining clothes for a character like Amaia Castillo, you would:

1. Define clothing items in the recipe's `clothing` array
2. Specify components especially `clothing:wearable` with all properties
3. Set `autoEquip: true` for initial equipment
4. Let the system handle instantiation and slot assignment during character generation
