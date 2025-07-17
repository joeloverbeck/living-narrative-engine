# Clothing Entity Instantiation and Retrieval Analysis Report

## Executive Summary

This report analyzes the clothing entity instantiation and storage workflow during anatomy graph generation in the Living Narrative Engine. The analysis covers how clothing entities are created, stored, and can be retrieved for display in the anatomy visualizer panel.

## Architecture Overview

The clothing system follows a modular architecture with clear separation of concerns:

### Core Components

- **ClothingInstantiationService**: Handles clothing entity creation and equipment
- **EquipmentOrchestrator**: Manages complex equipment workflows
- **ClothingManagementService**: Provides high-level API for clothing operations
- **AnatomyGenerationWorkflow**: Orchestrates anatomy graph generation including clothing

### Data Flow

```
Recipe Definition → Clothing Instantiation → Equipment Storage → Retrieval via API
```

## Clothing Entity Instantiation Process

### 1. Trigger Point

Clothing instantiation occurs during anatomy graph generation in **`AnatomyGenerationWorkflow.generate()`** at lines 124-156:

```javascript
// Phase 4: Instantiate clothing if specified in recipe
if (this.#clothingInstantiationService) {
  const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
  if (recipe && recipe.clothingEntities && recipe.clothingEntities.length > 0) {
    clothingResult =
      await this.#clothingInstantiationService.instantiateRecipeClothing(
        ownerId,
        recipe,
        { partsMap, slotEntityMappings }
      );
  }
}
```

### 2. Instantiation Workflow

The **`ClothingInstantiationService.instantiateRecipeClothing()`** method follows these steps:

1. **Validation**: Validates input parameters and recipe structure
2. **Slot Resolution**: Sets up slot-entity mappings for proper equipment placement
3. **Entity Creation**: For each clothing item in the recipe:
   - Creates entity instance via `#instantiateClothing()`
   - Applies layer resolution using precedence hierarchy
   - Performs post-instantiation validation
   - Attempts equipment if `equip !== false`

### 3. Entity Creation Details

**`#instantiateClothing()`** method (lines 540-613):

- Loads entity definition from data registry
- Applies layer resolution hierarchy: Recipe > Entity > Blueprint
- Creates entity instance with property overrides
- Returns entity ID (handles both string and Entity object returns)

## Clothing Entity Storage Structure

### Storage Location

Clothing entities are stored in the **`clothing:equipment`** component attached to the actor entity.

### Data Structure

```javascript
{
  "equipped": {
    "clothing_slot_id": {
      "layer_name": "clothing_entity_id"
    }
  }
}
```

### Storage Process

Equipment storage occurs in **`EquipmentOrchestrator.#performEquipment()`** (lines 436-476):

1. **Component Retrieval**: Gets or creates `clothing:equipment` component
2. **Slot Initialization**: Creates slot structure if needed
3. **Item Assignment**: Stores clothing entity ID in appropriate slot/layer
4. **Component Update**: Updates entity component with new equipment data

## Clothing Entity Properties

### Core Properties Available for Retrieval

#### 1. Component: `clothing:wearable`

- **layer**: Layer priority ("underwear", "base", "outer", "accessories")
- **size**: Size compatibility ("xs", "s", "m", "l", "xl", "xxl")
- **material**: Material composition (e.g., "silk", "stretch-silk")
- **equipmentSlots**: Primary and secondary slots
- **allowedLayers**: Valid layers for this item

#### 2. Component: `core:name`

- **text**: Display name of the clothing item

#### 3. Component: `core:description`

- **text**: Detailed description of the clothing item

#### 4. Component: `descriptors:color_*`

- **color**: Color information (basic, extended variants)

#### 5. Component: `descriptors:texture`

- **texture**: Surface texture properties

### Example Entity Structure

```javascript
{
  "id": "clothing:underwired_plunge_bra_nude_silk",
  "components": {
    "clothing:wearable": {
      "layer": "underwear",
      "size": "m",
      "material": "silk",
      "equipmentSlots": { "primary": "underwear_upper" },
      "allowedLayers": ["underwear"]
    },
    "core:name": {
      "text": "underwired plunge bra"
    },
    "core:description": {
      "text": "A luxurious underwired plunge bra..."
    },
    "descriptors:color_extended": {
      "color": "nude"
    },
    "descriptors:texture": {
      "texture": "silky"
    }
  }
}
```

## Clothing Entity Retrieval Methods

### 1. Via ClothingManagementService API

**`getEquippedItems(entityId)`** (lines 231-271):

```javascript
const result = await clothingManagementService.getEquippedItems(actorId);
// Returns: { success: boolean, equipped: object, errors?: string[] }
```

### 2. Direct Component Access

```javascript
const equipmentData = entityManager.getComponentData(
  entityId,
  'clothing:equipment'
);
const equippedItems = equipmentData?.equipped || {};
```

### 3. Detailed Entity Information Retrieval

For each equipped clothing entity ID, retrieve detailed information:

```javascript
// Get clothing entity instance
const clothingEntity = entityManager.getEntityInstance(clothingEntityId);

// Extract properties
const wearableComponent = clothingEntity.getComponentData('clothing:wearable');
const nameComponent = clothingEntity.getComponentData('core:name');
const descriptionComponent =
  clothingEntity.getComponentData('core:description');
const colorComponent =
  clothingEntity.getComponentData('descriptors:color_extended') ||
  clothingEntity.getComponentData('descriptors:color_basic');
const textureComponent = clothingEntity.getComponentData('descriptors:texture');
```

## Retrieval for Anatomy Visualizer Panel

### Recommended Implementation Strategy

1. **Get Equipped Items**: Use `ClothingManagementService.getEquippedItems(actorId)`
2. **Process Equipment Data**: Extract clothing entity IDs from equipped structure
3. **Retrieve Entity Details**: For each clothing entity, gather required properties
4. **Format for Display**: Structure data for visualizer panel

### Sample Retrieval Function

```javascript
async function getClothingDetailsForVisualizer(
  actorId,
  entityManager,
  clothingService
) {
  const clothingDetails = [];

  // Get equipped items
  const equipmentResult = await clothingService.getEquippedItems(actorId);
  if (!equipmentResult.success) {
    return { success: false, errors: equipmentResult.errors };
  }

  const equipped = equipmentResult.equipped;

  // Process each slot
  for (const [slotId, layers] of Object.entries(equipped)) {
    for (const [layer, clothingEntityId] of Object.entries(layers)) {
      const entity = entityManager.getEntityInstance(clothingEntityId);
      if (entity) {
        const wearable = entity.getComponentData('clothing:wearable');
        const name = entity.getComponentData('core:name');
        const description = entity.getComponentData('core:description');
        const color =
          entity.getComponentData('descriptors:color_extended') ||
          entity.getComponentData('descriptors:color_basic');
        const texture = entity.getComponentData('descriptors:texture');

        clothingDetails.push({
          entityId: clothingEntityId,
          definitionId: entity.definitionId,
          name: name?.text || 'Unknown',
          description: description?.text || '',
          slotId: slotId,
          layer: layer,
          material: wearable?.material || 'Unknown',
          size: wearable?.size || 'Unknown',
          color: color?.color || 'Unknown',
          texture: texture?.texture || 'Unknown',
          allowedLayers: wearable?.allowedLayers || [],
        });
      }
    }
  }

  return { success: true, clothingDetails };
}
```

### Panel Data Structure

The visualizer panel should display:

```javascript
{
  slotId: "underwear_upper",
  layer: "underwear",
  items: [
    {
      entityId: "generated_entity_id",
      definitionId: "clothing:underwired_plunge_bra_nude_silk",
      name: "underwired plunge bra",
      description: "A luxurious underwired plunge bra...",
      material: "silk",
      size: "m",
      color: "nude",
      texture: "silky",
      allowedLayers: ["underwear"]
    }
  ]
}
```

## Caching and Performance Considerations

### AnatomyClothingCache

The system includes an optimized LRU cache (`AnatomyClothingCache`) for performance:

- **Cache Types**: Available slots, slot resolution, blueprints, validation results
- **Key Strategies**: Entity-specific keys with TTL and size limits
- **Invalidation**: Entity-based and pattern-based invalidation

### Cache Usage for Retrieval

```javascript
// Check cache first
const cacheKey = AnatomyClothingCache.createAvailableSlotsKey(entityId);
const cached = cache.get(CacheKeyTypes.AVAILABLE_SLOTS, cacheKey);
```

## Error Handling and Validation

### Instantiation Errors

- Entity definition not found
- Layer resolution failures
- Slot validation failures
- Equipment conflicts

### Retrieval Safeguards

- Null checks for equipment components
- Entity existence validation
- Component data validation
- Graceful fallbacks for missing data

## Integration Points

### Key Service Dependencies

- **EntityManager**: Entity creation and component management
- **DataRegistry**: Access to entity definitions and recipes
- **SlotResolver**: Slot-to-socket mapping resolution
- **BodyGraphService**: Anatomy structure queries

### Event System Integration

- `clothing:instantiation_completed`: Fired after clothing creation
- `clothing:equipped`: Fired after successful equipment
- `clothing:unequipped`: Fired after unequipment

## Recommendations for Anatomy Visualizer Implementation

1. **Use High-Level API**: Prefer `ClothingManagementService.getEquippedItems()` over direct component access
2. **Cache Results**: Implement client-side caching for frequent queries
3. **Error Boundaries**: Handle cases where clothing entities may not exist
4. **Real-time Updates**: Subscribe to clothing events for live updates
5. **Performance**: Use batch operations when retrieving multiple entities
6. **Validation**: Validate entity existence before attempting property access

## Conclusion

The clothing entity system provides a robust foundation for the anatomy visualizer panel. The modular architecture, comprehensive property system, and well-defined retrieval APIs enable efficient implementation of clothing detail display functionality. The recommended retrieval patterns ensure both performance and reliability for the visualizer use case.
