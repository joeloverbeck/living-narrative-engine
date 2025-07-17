# Anatomy Visualizer Equipment Panel Specification

## Overview

This specification defines the implementation requirements for adding an equipment panel to the anatomy visualizer. The panel will display clothing and equipment information for entities that have the `clothing:equipment` component.

## Feature Description

### Purpose

Display equipped clothing items organized by slot and layer for entities that have equipment components, providing a visual representation of what the entity is wearing alongside their anatomy structure.

### User Experience

- When viewing an entity in the anatomy visualizer, users will see an equipment panel above the entity description panel
- If the entity has equipment, the panel displays all equipped items organized by slot and layer
- If the entity lacks equipment, the panel displays an appropriate message

## UI Design

### Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Anatomy Visualizer                        │
├─────────────────────────────────────────────────────────────┤
│ Entity Selector: [Dropdown]                                  │
├─────────────────────┬───────────────────────────────────────┤
│                     │ Equipment                              │
│  Body Parts Graph   │ ┌───────────────────────────────────┐ │
│                     │ │ Slot: underwear_upper             │ │
│   [SVG Graph]       │ │   Layer: underwear                │ │
│                     │ │   • Underwired plunge bra (silk)  │ │
│                     │ ├───────────────────────────────────┤ │
│                     │ │ Slot: lower_body                  │ │
│                     │ │   Layer: underwear                │ │
│                     │ │   • Thong panties (silk)          │ │
│                     │ └───────────────────────────────────┘ │
│                     ├───────────────────────────────────────┤
│                     │ Entity Description                     │
│                     │ [Entity description text...]          │
└─────────────────────┴───────────────────────────────────────┘
```

### Panel Structure

1. **Panel Container**
   - ID: `equipment-panel`
   - Class: `panel`
   - Position: Above entity description panel, on the right side

2. **Panel Header**
   - Title: "Equipment"
   - Consistent with other panel headers (h2 element)

3. **Content Area**
   - ID: `equipment-content`
   - Scrollable if content exceeds panel height

## Data Structure

### Equipment Display Format

```javascript
{
  slotId: string,           // e.g., "underwear_upper"
  layers: {
    layerName: string,      // e.g., "underwear"
    items: [{
      entityId: string,     // Unique entity ID
      definitionId: string, // e.g., "clothing:underwired_plunge_bra_nude_silk"
      name: string,         // e.g., "underwired plunge bra"
      material: string,     // e.g., "silk"
      color: string,        // e.g., "nude"
      size: string,         // e.g., "m"
      texture: string       // e.g., "silky"
    }]
  }[]
}[]
```

## Technical Implementation

### HTML Modifications

Update `anatomy-visualizer.html` to include the equipment panel:

```html
<div id="anatomy-content">
  <div id="anatomy-graph-panel" class="panel">
    <h2>Body Parts Graph</h2>
    <div id="anatomy-graph-container">
      <!-- SVG will be dynamically created here -->
    </div>
  </div>

  <div id="right-panels-container">
    <div id="equipment-panel" class="panel">
      <h2>Equipment</h2>
      <div id="equipment-content">
        <p class="message">Loading equipment...</p>
      </div>
    </div>

    <div id="entity-description-panel" class="panel">
      <h2>Entity Description</h2>
      <div id="entity-description-content">
        <p>Select an entity to view its description.</p>
      </div>
    </div>
  </div>
</div>
```

### CSS Requirements

Add styles to `anatomy-visualizer.css`:

```css
/* Right panels container */
#right-panels-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Equipment Panel */
#equipment-panel {
  flex: 0 0 auto;
  max-height: 40%;
  background: var(--secondary-bg-color);
  border-bottom: 1px solid var(--border-color-subtle);
  display: flex;
  flex-direction: column;
}

#equipment-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

/* Equipment slot styling */
.equipment-slot {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--primary-bg-color);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-color-subtle);
}

.equipment-slot-header {
  font-weight: 600;
  color: var(--secondary-text-color);
  margin-bottom: var(--spacing-xs);
}

.equipment-layer {
  margin-left: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
}

.equipment-layer-name {
  font-size: var(--font-size-small);
  color: var(--secondary-text-color);
  font-style: italic;
}

.equipment-item {
  margin-left: var(--spacing-lg);
  padding: var(--spacing-xs) 0;
  color: var(--primary-text-color);
}

.equipment-item-name {
  font-weight: 500;
}

.equipment-item-details {
  font-size: var(--font-size-small);
  color: var(--secondary-text-color);
  margin-left: var(--spacing-xs);
}

/* Adjust description panel */
#entity-description-panel {
  flex: 1;
  min-height: 0;
}
```

### JavaScript Implementation

#### 1. Service Integration

The `AnatomyVisualizerUI` class needs to be updated to:

- Accept `clothingManagementService` as a dependency
- Retrieve equipment data when an entity is selected
- Update the equipment panel display

#### 2. Equipment Retrieval Method

```javascript
async _retrieveEquipmentData(entityId) {
  if (!this._clothingManagementService) {
    return { success: false, message: 'Clothing service not available' };
  }

  try {
    // Check if entity has equipment component
    const hasEquipment = this._entityManager.hasComponent(entityId, 'clothing:equipment');

    if (!hasEquipment) {
      return { success: true, hasEquipment: false };
    }

    // Get equipped items
    const equipmentResult = await this._clothingManagementService.getEquippedItems(entityId);

    if (!equipmentResult.success) {
      return { success: false, errors: equipmentResult.errors };
    }

    // Process and structure equipment data
    const structuredData = await this._processEquipmentData(
      equipmentResult.equipped,
      entityId
    );

    return {
      success: true,
      hasEquipment: true,
      equipmentData: structuredData
    };
  } catch (error) {
    this._logger.error('Failed to retrieve equipment data', error);
    return { success: false, error: error.message };
  }
}
```

#### 3. Equipment Processing Method

```javascript
async _processEquipmentData(equipped, ownerId) {
  const processedSlots = [];

  for (const [slotId, layers] of Object.entries(equipped)) {
    const slotData = {
      slotId,
      layers: []
    };

    for (const [layerName, clothingEntityId] of Object.entries(layers)) {
      const items = Array.isArray(clothingEntityId)
        ? clothingEntityId
        : [clothingEntityId];

      const layerData = {
        layerName,
        items: []
      };

      for (const entityId of items) {
        const itemData = await this._getClothingItemDetails(entityId);
        if (itemData) {
          layerData.items.push(itemData);
        }
      }

      if (layerData.items.length > 0) {
        slotData.layers.push(layerData);
      }
    }

    if (slotData.layers.length > 0) {
      processedSlots.push(slotData);
    }
  }

  return processedSlots;
}
```

#### 4. Display Update Method

```javascript
_updateEquipmentDisplay(equipmentResult) {
  const container = this._document.getElementById('equipment-content');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  if (!equipmentResult.success) {
    container.innerHTML = '<p class="message error">Failed to load equipment data</p>';
    return;
  }

  if (!equipmentResult.hasEquipment) {
    container.innerHTML = '<p class="message">This entity has no equipment</p>';
    return;
  }

  if (!equipmentResult.equipmentData || equipmentResult.equipmentData.length === 0) {
    container.innerHTML = '<p class="message">No items equipped</p>';
    return;
  }

  // Render equipment data
  const fragment = this._createEquipmentFragment(equipmentResult.equipmentData);
  container.appendChild(fragment);
}
```

### Event Handling

1. **Entity Selection**: When a new entity is selected, retrieve and display equipment
2. **Equipment Changes**: Subscribe to equipment-related events:
   - `clothing:equipped`
   - `clothing:unequipped`
   - `clothing:equipment_updated`

### State Management

Equipment panel state should be managed alongside other visualizer state:

```javascript
// In VisualizerStateController
state = {
  currentState: 'idle',
  selectedEntity: null,
  anatomyData: null,
  equipmentData: null,
  error: null,
};
```

## Error Handling

### Common Error Scenarios

1. **Missing Equipment Component**
   - Display: "This entity has no equipment"
   - No error logging required

2. **Service Unavailable**
   - Display: "Equipment information unavailable"
   - Log warning

3. **Failed Equipment Retrieval**
   - Display: "Failed to load equipment data"
   - Log error with details

4. **Invalid Clothing Entity**
   - Skip the item
   - Log warning with entity ID

## Performance Considerations

1. **Caching**
   - Cache equipment data per entity to avoid repeated API calls
   - Invalidate cache on equipment change events

2. **Lazy Loading**
   - Only retrieve equipment data when entity is selected
   - Don't preload equipment for all entities

3. **Batch Operations**
   - Retrieve all clothing entity details in batch when possible
   - Use entity manager's batch retrieval methods

## Testing Requirements

### Unit Tests

1. **Equipment Retrieval**
   - Test successful equipment retrieval
   - Test handling of missing equipment component
   - Test error handling

2. **Data Processing**
   - Test equipment data structuring
   - Test handling of multi-item slots
   - Test missing entity handling

3. **Display Updates**
   - Test correct rendering of equipment data
   - Test empty state messages
   - Test error state displays

### Integration Tests

1. **Service Integration**
   - Test with real ClothingManagementService
   - Test equipment change event handling
   - Test state synchronization

2. **UI Integration**
   - Test panel visibility and layout
   - Test scrolling behavior
   - Test responsive design

## Accessibility

1. **Semantic HTML**
   - Use appropriate heading hierarchy
   - Use lists for equipment items
   - Include descriptive text

2. **ARIA Labels**
   - Label equipment sections
   - Provide context for screen readers

3. **Keyboard Navigation**
   - Ensure panel is keyboard accessible
   - Maintain focus management

## Future Enhancements

1. **Interactive Features**
   - Click to highlight clothing on anatomy graph
   - Expand/collapse slot sections
   - Quick actions (unequip)

2. **Visual Enhancements**
   - Icons for clothing types
   - Color swatches for items
   - Material indicators

3. **Advanced Information**
   - Show clothing stats/properties
   - Display compatibility warnings
   - Show layering conflicts

## Implementation Checklist

- [ ] Update HTML structure
- [ ] Add CSS styles
- [ ] Update AnatomyVisualizerUI dependencies
- [ ] Implement equipment retrieval methods
- [ ] Implement data processing methods
- [ ] Implement display update methods
- [ ] Add event handlers
- [ ] Update state management
- [ ] Add error handling
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test accessibility
- [ ] Update documentation

## Dependencies

- `ClothingManagementService` - For equipment retrieval
- `EntityManager` - For component checks
- `DataRegistry` - For entity definitions
- `Logger` - For error logging
- `EventDispatcher` - For event subscription

## References

- Equipment Component Schema: `data/mods/clothing/components/equipment.component.json`
- Clothing Analysis Report: `reports/clothing-entity-instantiation-and-retrieval-analysis.md`
- Anatomy Visualizer: `src/anatomy-visualizer.js`, `src/domUI/AnatomyVisualizerUI.js`
