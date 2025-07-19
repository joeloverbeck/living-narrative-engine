# Clothing System to Anatomy Socket Mapping Architecture Report

## Executive Summary

The Living Narrative Engine's clothing system currently loses critical mapping information between clothing slots and the anatomy sockets they cover during the anatomy graph creation process. This report analyzes the current architecture, identifies where information is lost, and proposes solutions to retain socket coverage information while maintaining blueprint/recipe agnosticism.

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Information Flow Analysis](#information-flow-analysis)
3. [Problem Identification](#problem-identification)
4. [Current Workaround Issues](#current-workaround-issues)
5. [Proposed Solutions](#proposed-solutions)
6. [Recommendation](#recommendation)
7. [Implementation Considerations](#implementation-considerations)

## Current Architecture Overview

### Key Components

1. **Anatomy Blueprints** (`data/mods/anatomy/blueprints/`)
   - Define anatomy structure and clothing slot mappings
   - Contains `clothingSlotMappings` that map slots to anatomy sockets
   - Example: `torso_upper` maps to sockets like `left_chest`, `right_chest`, etc.

2. **Anatomy Graph Creation** (`src/anatomy/workflows/anatomyGenerationWorkflow.js`)
   - Creates anatomy entities from blueprints and recipes
   - Builds the physical anatomy structure
   - Currently doesn't preserve clothing slot mapping information

3. **Equipment Component** (`data/mods/clothing/components/equipment.component.json`)
   - Tracks equipped clothing by slot and layer
   - Structure: `equipped[slot][layer] = itemId`
   - Has no knowledge of what anatomy sockets each slot covers

4. **Custom JsonLogic Operator** (`src/logic/operators/isSocketCoveredOperator.js`)
   - Checks if an anatomy socket is covered by clothing
   - Currently uses hardcoded mapping that is incomplete and incorrect

### Data Flow

```
Blueprint Definition → Anatomy Graph Creation → Equipment Component → JsonLogic Evaluation
(has mappings)        (mappings not used)      (no mappings)        (hardcoded mappings)
```

## Information Flow Analysis

### 1. Blueprint Definition Stage

The anatomy blueprints contain comprehensive mapping information:

```json
// human_female.blueprint.json
"clothingSlotMappings": {
  "torso_upper": {
    "anatomySockets": [
      "left_breast",    // Note: Should be left_chest based on slot definitions
      "right_breast",   // Note: Should be right_chest based on slot definitions
      "left_chest",
      "right_chest",
      "chest_center",
      "left_shoulder",
      "right_shoulder"
    ],
    "allowedLayers": ["underwear", "base", "outer", "armor"]
  }
}
```

### 2. Anatomy Graph Creation Stage

During anatomy graph creation (`anatomyGenerationWorkflow.js`):
- Blueprint slots are created as entities
- Parts map is built for socket-based access
- **Critical Issue**: `clothingSlotMappings` from blueprints are not preserved or passed forward

### 3. Equipment Component Creation

The equipment component is created with a simple structure:
```json
{
  "equipped": {
    "torso_upper": {
      "base": "white_cotton_crew_tshirt"
    }
  }
}
```

**Missing Information**: No indication of which anatomy sockets are covered by items in `torso_upper`

### 4. Runtime Evaluation

The `isSocketCoveredOperator` attempts to determine coverage using hardcoded mappings:
```javascript
#getSocketToSlotMapping() {
  return {
    // Hardcoded and potentially incorrect mappings
    left_breast: ['torso_upper'],  // Should be left_chest
    right_breast: ['torso_upper'], // Should be right_chest
    // ... more mappings
  };
}
```

## Problem Identification

### Primary Issues

1. **Information Loss**: The `clothingSlotMappings` defined in blueprints are not preserved during anatomy graph creation
2. **Hardcoded Mappings**: The current solution relies on incomplete, hardcoded mappings
3. **Incorrect Mappings**: The hardcoded mappings have errors (e.g., `left_breast` instead of `left_chest`)
4. **Maintenance Burden**: Any changes to blueprints require manual updates to hardcoded mappings
5. **Blueprint Agnosticism Lost**: The equipment component cannot remain agnostic while needing blueprint-specific information

### Root Cause

The anatomy generation workflow doesn't create any persistent mapping between:
- Clothing slots (e.g., `torso_upper`)
- Anatomy sockets they cover (e.g., `left_chest`, `right_chest`)

This information exists in blueprints but is never transferred to a runtime-accessible location.

## Current Workaround Issues

The hardcoded mapping in `isSocketCoveredOperator.js` has several problems:

1. **Naming Inconsistencies**:
   - Uses `left_breast` when the actual socket is `left_chest`
   - Uses `right_breast` when the actual socket is `right_chest`

2. **Incomplete Coverage**:
   - Missing many socket mappings
   - Doesn't account for all blueprint variations

3. **Maintenance Nightmare**:
   - Must be manually updated for new blueprints
   - No validation against actual blueprint definitions

## Proposed Solutions

### Solution 1: Enriched Equipment Component

**Approach**: Extend the equipment component to include socket coverage information

```json
{
  "equipped": {
    "torso_upper": {
      "base": "white_cotton_crew_tshirt"
    }
  },
  "slotCoverage": {
    "torso_upper": ["left_chest", "right_chest", "chest_center", "left_shoulder", "right_shoulder"]
  }
}
```

**Pros**:
- Simple to implement
- Self-contained information
- Fast runtime lookup

**Cons**:
- Duplicates data across entities
- Increases component size
- Must be kept in sync with blueprint changes

### Solution 2: Coverage Mapping Service

**Approach**: Create a dedicated service that maintains slot-to-socket mappings

```javascript
class ClothingCoverageService {
  constructor({ anatomyBlueprintRepository }) {
    this.#coverageCache = new Map();
  }
  
  async getSocketsForSlot(entityId, slotName) {
    const blueprintId = await this.#getBlueprintForEntity(entityId);
    return this.#getCoverageFromBlueprint(blueprintId, slotName);
  }
}
```

**Pros**:
- Centralized mapping logic
- Can cache results efficiently
- Maintains blueprint agnosticism in equipment component

**Cons**:
- Requires blueprint lookup at runtime
- Additional service dependency
- Performance overhead for first lookup

### Solution 3: Clothing Slot Metadata Component

**Approach**: Create a new component that stores slot metadata for each entity

```json
// New component: clothing:slot_metadata
{
  "slotMappings": {
    "torso_upper": {
      "coveredSockets": ["left_chest", "right_chest", "chest_center"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    }
  }
}
```

**Pros**:
- Separates concerns cleanly
- Can be created during anatomy generation
- Efficient runtime lookup

**Cons**:
- Additional component to manage
- Must be created for all entities with anatomy

### Solution 4: Anatomy-Aware Equipment Component

**Approach**: Make the equipment component anatomy-aware by storing coverage per equipped item

```json
{
  "equipped": {
    "torso_upper": {
      "base": {
        "itemId": "white_cotton_crew_tshirt",
        "coversSockets": ["left_chest", "right_chest", "chest_center"]
      }
    }
  }
}
```

**Pros**:
- Most accurate - tracks actual coverage per item
- Supports items that partially cover slots

**Cons**:
- Most complex to implement
- Requires significant refactoring
- Larger data structure

## Recommendation

**Recommended Solution: Solution 3 - Clothing Slot Metadata Component**

This approach provides the best balance of:
- Clean separation of concerns
- Efficient runtime performance
- Maintainability
- Blueprint agnosticism in equipment component

### Implementation Strategy

1. **Create New Component Schema** (`clothing:slot_metadata`)
   ```json
   {
     "id": "clothing:slot_metadata",
     "description": "Metadata about clothing slots and their anatomy socket coverage",
     "dataSchema": {
       "type": "object",
       "properties": {
         "slotMappings": {
           "type": "object",
           "patternProperties": {
             "^[a-zA-Z][a-zA-Z0-9_]*$": {
               "type": "object",
               "properties": {
                 "coveredSockets": {
                   "type": "array",
                   "items": { "type": "string" }
                 },
                 "allowedLayers": {
                   "type": "array",
                   "items": { "type": "string" }
                 }
               }
             }
           }
         }
       }
     }
   }
   ```

2. **Modify Anatomy Generation Workflow**
   - Extract `clothingSlotMappings` from blueprint during generation
   - Create `clothing:slot_metadata` component on the entity
   - Populate with relevant mappings

3. **Update `isSocketCoveredOperator`**
   - Remove hardcoded mappings
   - Query `clothing:slot_metadata` component
   - Use cached lookups for performance

4. **Migration Strategy**
   - Add backward compatibility for existing entities
   - Provide migration tool to add metadata to existing anatomy

## Implementation Considerations

### Performance

- Cache slot metadata lookups aggressively
- Consider memory vs. computation trade-offs
- Profile actual usage patterns

### Validation

- Validate socket names against actual anatomy structure
- Ensure slot names match between metadata and equipment
- Add schema validation for the new component

### Testing

- Unit tests for metadata component creation
- Integration tests for the full pipeline
- Performance tests for JsonLogic evaluation

### Documentation

- Update blueprint documentation
- Document the metadata component structure
- Provide migration guide for existing content

### Future Enhancements

- Support for partial slot coverage
- Dynamic coverage based on clothing size/fit
- Override mechanisms for special clothing items

## Conclusion

The current architecture loses critical mapping information between clothing slots and anatomy sockets. By implementing a dedicated slot metadata component, we can preserve this information from blueprints while maintaining clean separation of concerns and blueprint agnosticism in the equipment component. This solution provides the best balance of performance, maintainability, and architectural cleanliness.