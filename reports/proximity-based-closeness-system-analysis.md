# Proximity-Based Closeness System Architecture Analysis

**Report Date**: September 5, 2025  
**Focus**: Architecture analysis for implementing automatic closeness establishment based on sitting proximity  
**Scope**: Actions `sit_down`, `get_up_from_furniture`, `get_close`, `step_back` and `allows_sitting` component system

---

## Executive Summary

This report analyzes the Living Narrative Engine's positioning and closeness systems to implement automatic closeness establishment when characters sit adjacent to each other on furniture. The goal is to create natural social proximity relationships based on spatial positioning without requiring explicit player actions.

**Key Requirements**:

- Alice in spot 0, Bob sits in spot 1 → Both establish closeness
- Alicia (spot 0), Bob sits in spot 1, Zelda (spot 2) → Bob close to both, Alicia ≠ Zelda
- Automatic closeness removal when characters no longer sit adjacently
- Integration with existing closeness and movement systems

---

## Current System Architecture Analysis

### 1. Component Architecture

#### 1.1 `allows_sitting.component.json`

```json
{
  "id": "sitting:allows_sitting",
  "description": "Indicates furniture can be sat upon and tracks occupants in specific spots",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["spots"],
    "properties": {
      "spots": {
        "type": "array",
        "description": "Seating positions where null = empty, entity ID = occupied",
        "minItems": 1,
        "maxItems": 10,
        "items": {
          "oneOf": [
            { "type": "null" },
            {
              "type": "string",
              "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
            }
          ]
        },
        "default": [null]
      }
    }
  }
}
```

**Analysis**:

- Supports up to 10 spots with null/entityId tracking
- Linear array structure enables adjacency calculations
- No built-in proximity relationships

#### 1.2 `sitting_on.component.json`

```json
{
  "id": "positioning:sitting_on",
  "description": "Tracks which furniture entity this actor is currently sitting on",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["furniture_id", "spot_index"],
    "properties": {
      "furniture_id": {
        "description": "The furniture entity being sat upon",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "spot_index": {
        "type": "integer",
        "description": "Which spot in the furniture's spots array this actor occupies",
        "minimum": 0
      }
    }
  }
}
```

**Analysis**:

- Links actors to specific furniture and spot positions
- Critical for adjacency calculations
- No reference to other actors on same furniture

#### 1.3 `closeness.component.json`

```json
{
  "id": "positioning:closeness",
  "description": "A fully-connected, order-independent set of actors who have explicitly chosen to be 'close'. Its presence indicates an actor is part of a Closeness Circle.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["partners"],
    "properties": {
      "partners": {
        "type": "array",
        "description": "A list of entity IDs that are also in this closeness circle.",
        "uniqueItems": true,
        "default": [],
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        }
      }
    }
  }
}
```

**Analysis**:

- Manages bidirectional relationships
- Fully-connected partnership model
- Currently requires explicit actions to establish/remove

### 2. Action System Analysis

#### 2.1 `sit_down.action.json` + `handle_sit_down.rule.json`

**Current Behavior**:

1. **Atomic Sequential Spot Allocation**: Uses `ATOMIC_MODIFY_COMPONENT` to attempt claiming spots 0→1→2 with proper concurrency handling
2. **Conditional Logic**: Each spot attempt is wrapped in IF conditions to handle success/failure
3. **Component Assignment**: Adds `positioning:sitting_on` component with furniture_id and spot_index
4. **Movement Locking**: Uses `LOCK_MOVEMENT` operation to prevent movement while sitting
5. **Logging and Perception**: Creates perceptible events using `core:logSuccessAndEndTurn` macro
6. **No proximity detection or closeness establishment**

**Key Rule Actions**:

```json
{
  "type": "ATOMIC_MODIFY_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "sitting:allows_sitting",
    "field": "spots.0",
    "expected_value": null,
    "new_value": "{event.payload.actorId}"
  }
}
```

#### 2.2 `get_up_from_furniture.action.json` + `handle_get_up_from_furniture.rule.json`

**Current Behavior**:

1. Queries actor's `sitting_on` component for spot info
2. Clears appropriate spot in furniture's `allows_sitting` array
3. Removes `sitting_on` component from actor
4. Unlocks movement
5. **No closeness cleanup or proximity recalculation**

#### 2.3 `get_close.action.json` + `get_close.rule.json`

**Current Behavior**:

- Uses `MERGE_CLOSENESS_CIRCLE` operation
- Explicit player action required
- Merges existing closeness circles
- Locks movement for all participants

#### 2.4 `step_back.action.json` + `step_back.rule.json`

**Current Behavior**:

- Uses `REMOVE_FROM_CLOSENESS_CIRCLE` operation
- Removes actor from closeness circle
- Cleans up isolated partners
- Unlocks movement if appropriate

### 3. Operation Handler Analysis

#### 3.1 `mergeClosenessCircleHandler.js`

**Located at**: `src/logic/operationHandlers/mergeClosenessCircleHandler.js`

**Key Functionality**:

- **Input Validation**: Validates actor_id and target_id parameters with error dispatching
- **Partner List Merging**: Uses `closenessCircleService.merge()` to combine existing partner lists
- **Component Updates**: Updates `positioning:closeness` components for all merged members
- **Movement Locking**: Uses `updateMovementLock()` utility to lock movement for all participants
- **Error Handling**: Comprehensive error handling with `safeDispatchError()` for all operations
- **Result Tracking**: Optional result_variable parameter for operation outcome tracking

#### 3.2 `removeFromClosenessCircleHandler.js`

**Located at**: `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`

**Key Functionality**:

- **Partner Removal**: Removes actor from all partner lists and gathers affected partners
- **Circle Repair**: Uses `closenessCircleService.repair()` to maintain valid circle connections
- **Component Cleanup**: Removes `positioning:closeness` components when circles dissolve
- **Movement Unlocking**: Uses `updateMovementLock()` to unlock movement for affected entities
- **Atomic Operations**: Ensures proper cleanup with transaction-like behavior
- **Error Handling**: Comprehensive error handling throughout the removal process

---

## Requirements Analysis

### 1. Proximity Logic Definition

#### 1.1 Adjacency Rules

```
Spot Adjacency Matrix:
- Spot 0 is adjacent to Spot 1
- Spot 1 is adjacent to Spot 0 and Spot 2
- Spot 2 is adjacent to Spot 1
- Spot N is adjacent to Spot N-1 and Spot N+1 (general case)
- Non-adjacent spots do NOT establish direct closeness
```

#### 1.2 Closeness Establishment Scenarios

**Scenario A**: Simple Adjacent Sitting

```
Initial: [null, null, null]
Alice sits → [Alice, null, null]
Bob sits → [Alice, Bob, null]
Result: Alice ↔ Bob closeness established
```

**Scenario B**: Middle Position Bridging

```
Initial: [Alicia, null, Zelda]
Bob sits → [Alicia, Bob, Zelda]
Result: Alicia ↔ Bob, Bob ↔ Zelda established
Note: Alicia and Zelda remain non-adjacent (no direct closeness)
```

**Scenario C**: Closeness Removal on Standing

```
Initial: [Alice, Bob, null] (Alice ↔ Bob)
Alice stands → [null, Bob, null]
Result: Alice ↔ Bob closeness removed
```

#### 1.3 Complex Scenario Handling

- **Existing Closeness**: Merge with sitting-based closeness
- **Multiple Furniture**: Handle actors sitting on different furniture pieces
- **Circle Expansion**: Handle when actors join existing closeness circles

### 2. Integration Requirements

#### 2.1 Backward Compatibility

- Existing explicit `get_close`/`step_back` actions must continue working
- Manual closeness should merge with automatic sitting-based closeness
- No disruption to existing movement lock systems

#### 2.2 Performance Considerations

- Efficient adjacency calculations
- Minimal component queries during sit/stand actions
- Avoid unnecessary closeness updates

---

## Implementation Strategy

### 1. Required Modifications

#### 1.1 Enhanced `handle_sit_down.rule.json`

**New Actions Required After Successful Sitting**:

```json
{
  "type": "ESTABLISH_SITTING_CLOSENESS",
  "comment": "Check for adjacent actors and establish closeness relationships",
  "parameters": {
    "furniture_id": "{event.payload.targetId}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.spotIndex}"
  }
}
```

#### 1.2 Enhanced `handle_get_up_from_furniture.rule.json`

**New Actions Required After Standing Up**:

```json
{
  "type": "REMOVE_SITTING_CLOSENESS",
  "comment": "Remove closeness relationships based on sitting proximity",
  "parameters": {
    "furniture_id": "{context.sittingInfo.furniture_id}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.sittingInfo.spot_index}"
  }
}
```

### 2. New Operation Handlers

#### 2.1 `establishSittingClosenessHandler.js`

**Purpose**: Establish closeness between actors sitting in adjacent spots

**Key Methods**:

- `#getAdjacentOccupants(furnitureId, spotIndex)`: Find actors in adjacent spots
- `#establishCloseness(actorId, adjacentActors)`: Create/merge closeness relationships using `closenessCircleService.merge()`
- `#handleExistingCloseness(actorId, newPartners)`: Merge with existing closeness circles
- Integration with existing `ClosenessCircleService` (`src/logic/services/closenessCircleService.js`)

**Algorithm**:

1. Query furniture's `allows_sitting` component
2. Calculate adjacent spot indices (spotIndex ± 1)
3. Identify non-null adjacent occupants
4. For each adjacent occupant:
   - Check existing closeness relationships
   - Merge or establish new closeness circle
   - Update all affected partners

#### 2.2 `removeSittingClosenessHandler.js`

**Purpose**: Remove closeness relationships when actors stand up from furniture

**Key Methods**:

- `#getFormerAdjacentOccupants(furnitureId, spotIndex)`: Find previously adjacent actors
- `#removeSpecificCloseness(actorId, formerPartners)`: Remove only sitting-based closeness
- `#preserveExplicitCloseness(actorId, partnerId)`: Maintain manually-established closeness

**Algorithm**:

1. Identify who was previously adjacent based on former spot
2. For each former adjacent partner:
   - Check if closeness was sitting-based or explicit
   - Remove only sitting-based closeness relationships
   - Preserve manually-established closeness (via `get_close` action)
   - Update remaining partner lists

### 3. New Components (Optional)

#### 3.1 Enhanced Closeness Tracking

Consider extending `closeness.component.json` to track relationship origins:

```json
{
  "partners": [
    {
      "entity_id": "game:character_bob",
      "relationship_type": "sitting_proximity",
      "established_by": "automatic"
    },
    {
      "entity_id": "game:character_charlie",
      "relationship_type": "explicit_closeness",
      "established_by": "manual"
    }
  ]
}
```

**Alternative**: Use separate component `sitting_closeness.component.json` to track proximity-based relationships independently.

---

## Test Strategy

### 1. Unit Tests

#### 1.1 `establishSittingClosenessHandler.test.js`

```javascript
describe('EstablishSittingClosenessHandler', () => {
  describe('adjacency calculation', () => {
    it('should identify spot 1 as adjacent to spot 0', () => {
      // Test adjacency logic
    });

    it('should identify spots 0 and 2 as adjacent to spot 1', () => {
      // Test middle position logic
    });

    it('should not identify spot 0 as adjacent to spot 2', () => {
      // Test non-adjacency
    });
  });

  describe('closeness establishment', () => {
    it('should establish closeness between two adjacent actors', () => {
      // Scenario A test
    });

    it('should establish multiple relationships for middle positions', () => {
      // Scenario B test
    });

    it('should merge with existing closeness circles', () => {
      // Complex merging test
    });
  });
});
```

#### 1.2 `removeSittingClosenessHandler.test.js`

```javascript
describe('RemoveSittingClosenessHandler', () => {
  describe('closeness removal', () => {
    it('should remove sitting-based closeness when actor stands', () => {
      // Scenario C test
    });

    it('should preserve explicit closeness relationships', () => {
      // Mixed relationship test
    });

    it('should handle complex circle dissolution', () => {
      // Multi-actor standing test
    });
  });
});
```

### 2. Integration Tests

#### 2.1 `sittingProximityWorkflow.integration.test.js`

**Test Scenarios**:

```javascript
describe('Sitting Proximity Workflow', () => {
  it('should establish closeness when Bob sits next to Alice', async () => {
    // Setup: Alice in spot 0
    // Action: Bob sits down (should claim spot 1)
    // Assert: Both have closeness components with each other as partners
  });

  it('should create bridging relationships for middle positions', async () => {
    // Setup: Alicia in spot 0, Zelda in spot 2
    // Action: Bob sits down (should claim spot 1)
    // Assert: Bob ↔ Alicia, Bob ↔ Zelda, but NOT Alicia ↔ Zelda
  });

  it('should remove closeness when actors stand up', async () => {
    // Setup: Alice and Bob sitting adjacent with closeness
    // Action: Alice stands up
    // Assert: Closeness components removed from both
  });

  it('should handle mixed explicit and automatic closeness', async () => {
    // Setup: Alice and Bob with explicit closeness (get_close action)
    // Action: Charlie sits adjacent to Alice
    // Assert: Alice has closeness with both Bob and Charlie
    // Action: Charlie stands up
    // Assert: Alice retains closeness with Bob, loses closeness with Charlie
  });
});
```

#### 2.2 `furnitureCapacityAndProximity.integration.test.js`

**Edge Case Scenarios**:

```javascript
describe('Furniture Capacity and Proximity Edge Cases', () => {
  it('should handle full furniture with no available adjacent spots', async () => {
    // Setup: All spots occupied
    // Action: New actor attempts to sit
    // Assert: Action fails, no closeness changes
  });

  it('should handle single-spot furniture (no adjacency possible)', async () => {
    // Setup: Furniture with only one spot
    // Action: Actor sits down
    // Assert: No closeness established (no adjacent spots exist)
  });

  it('should handle dynamic furniture spot expansion', async () => {
    // Setup: Furniture spots modified during gameplay
    // Test: Adjacency calculations adapt to new configuration
  });
});
```

### 3. End-to-End Tests

#### 3.1 Complete Workflow Validation

```javascript
describe('Proximity-Based Closeness E2E', () => {
  it('should demonstrate complete Alice/Bob scenario', async () => {
    // Multi-step workflow test covering:
    // 1. Initial furniture setup
    // 2. Alice sits down
    // 3. Bob sits down adjacent to Alice
    // 4. Verify closeness established
    // 5. Alice stands up
    // 6. Verify closeness removed
  });

  it('should demonstrate complex multi-actor scenario', async () => {
    // Multi-step workflow test covering:
    // 1. Alicia and Zelda sit on opposite ends
    // 2. Bob sits in middle
    // 3. Verify Bob is close to both, Alicia/Zelda not close
    // 4. Diana sits next to Zelda
    // 5. Verify Diana/Zelda closeness, Bob relationships unchanged
  });
});
```

### 4. Performance Tests

#### 4.1 `sittingClosenessPerformance.test.js`

```javascript
describe('Sitting Closeness Performance', () => {
  it('should handle 10-spot furniture efficiently', async () => {
    // Test performance with maximum furniture capacity
    // Measure operation execution time
    // Verify memory usage remains bounded
  });

  it('should scale linearly with number of actors', async () => {
    // Test performance scaling as more actors sit/stand
    // Verify O(n) or better performance characteristics
  });
});
```

---

## Implementation Files Overview

### Files to Create

1. **Operation Handlers**:
   - `src/logic/operationHandlers/establishSittingClosenessHandler.js`
   - `src/logic/operationHandlers/removeSittingClosenessHandler.js`

2. **Operation Schemas**:
   - `data/schemas/operations/establishSittingCloseness.schema.json`
   - `data/schemas/operations/removeSittingCloseness.schema.json`

3. **Utility Functions**:
   - `src/utils/proximityUtils.js` (adjacency calculations, spot management)
   - `src/utils/sittingClosenessUtils.js` (relationship type detection, merging logic)

4. **Test Files**:
   - `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`
   - `tests/unit/logic/operationHandlers/removeSittingClosenessHandler.test.js`
   - `tests/unit/utils/proximityUtils.test.js`
   - `tests/unit/utils/sittingClosenessUtils.test.js`
   - `tests/integration/mods/positioning/sittingProximityWorkflow.integration.test.js`
   - `tests/integration/mods/positioning/furnitureCapacityAndProximity.integration.test.js`
   - `tests/e2e/positioning/proximityBasedCloseness.e2e.test.js` (new directory)
   - `tests/performance/positioning/sittingClosenessPerformance.test.js` (new directory)

### Files to Modify

1. **Rule Definitions**:
   - `data/mods/positioning/rules/handle_sit_down.rule.json`
   - `data/mods/positioning/rules/handle_get_up_from_furniture.rule.json`

2. **Dependency Injection**:
   - `src/dependencyInjection/registrations/operationHandlerRegistrations.js` ✅ (exists, follows established patterns)

3. **Token Definitions**:
   - Update `src/dependencyInjection/tokens.js` to include new handler tokens

4. **Operation Schema Registration**:
   - Schemas automatically loaded from `data/schemas/operations/` directory

---

## Integration Considerations

### 1. Compatibility Matrix

| Existing Feature   | Integration Impact                       | Mitigation Strategy                                   |
| ------------------ | ---------------------------------------- | ----------------------------------------------------- |
| Manual `get_close` | Could conflict with automatic closeness  | Merge relationship types, preserve explicit closeness |
| Movement locking   | Automatic closeness should respect locks | Use existing movement lock utilities                  |
| Closeness circles  | Multiple relationships per actor         | Extend existing circle merging logic                  |
| Multiple furniture | Actors could sit on different pieces     | Scope proximity calculations per furniture            |

### 2. Data Migration

**No data migration required** - new system extends existing components without schema changes.

### 3. Performance Impact

- **Minimal impact expected**: Operations only execute during sit/stand actions
- **Adjacency calculations**: O(1) for spot-based furniture
- **Component updates**: O(n) where n = number of affected actors
- **Memory overhead**: Negligible (reuses existing closeness components)

---

## Risk Assessment

### 1. Technical Risks

| Risk                       | Probability | Impact | Mitigation                                                |
| -------------------------- | ----------- | ------ | --------------------------------------------------------- |
| Complex closeness merging  | Medium      | Medium | Comprehensive unit testing, use existing merge utilities  |
| Performance degradation    | Low         | Medium | Performance testing, optimize adjacency calculations      |
| Backward compatibility     | Low         | High   | Extensive integration testing, preserve existing behavior |
| Race conditions in sitting | Medium      | Medium | Use existing atomic operations, test concurrency          |

### 2. Design Risks

| Risk                                 | Probability | Impact | Mitigation                                            |
| ------------------------------------ | ----------- | ------ | ----------------------------------------------------- |
| User confusion (automatic vs manual) | Medium      | Low    | Clear logging, maintain explicit action availability  |
| Unwanted closeness relationships     | Medium      | Medium | Preserve step_back action, make relationships obvious |
| Furniture configuration changes      | Low         | Medium | Design flexible adjacency calculations                |

---

## Implementation Priority

### Phase 1: Core Functionality

1. Create `establishSittingClosenessHandler.js` and `removeSittingClosenessHandler.js`
2. Add proximity calculation utilities
3. Update `handle_sit_down.rule.json` and `handle_get_up_from_furniture.rule.json`
4. Implement basic unit tests

### Phase 2: Integration Testing

1. Create integration test suites
2. Test complex scenarios (middle positions, existing closeness)
3. Validate backward compatibility
4. Performance testing and optimization

### Phase 3: Polish & Documentation

1. End-to-end test scenarios
2. Error handling and edge cases
3. User-facing documentation updates
4. Code review and refinement

---

## Architectural Alignment Validation

### ✅ **Validated Components and Schemas**

All referenced components exist and schemas match actual implementation:

- `allows_sitting.component.json`: Exact schema match with proper validation patterns
- `sitting_on.component.json`: Correct required fields and schema references
- `closeness.component.json`: Accurate description and partner list structure

### ✅ **Validated Operation Handlers**

Existing handlers confirmed with correct architecture:

- `mergeClosenessCircleHandler.js`: Uses established `ClosenessCircleService.merge()` pattern
- `removeFromClosenessCircleHandler.js`: Uses `ClosenessCircleService.repair()` for consistency
- Both follow standard error handling with `safeDispatchError()` and `updateMovementLock()` utilities

### ✅ **Validated Service Architecture**

Integration with existing `ClosenessCircleService` (`src/logic/services/closenessCircleService.js`):

- **Stateless**: Pure functions with no side effects
- **Set Operations**: `merge()`, `repair()`, and `dedupe()` utilities available
- **Canonical Representation**: Sorted partner lists for consistency
- **Established Patterns**: Already used by existing operation handlers

### ✅ **Validated Directory Structure**

- Operation handlers: `src/logic/operationHandlers/` ✓
- Operation schemas: `data/schemas/operations/` ✓ (auto-loaded)
- Dependency injection: `src/dependencyInjection/registrations/` ✓
- Test structure: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/performance/` ✓
- Positioning tests: `tests/integration/positioning/` ✓ (existing directory)

### ✅ **Validated Implementation Patterns**

- **Atomic Operations**: Consistent with `ATOMIC_MODIFY_COMPONENT` usage in existing rules
- **Movement Locking**: Uses established `updateMovementLock()` utility
- **Error Handling**: Follows `safeDispatchError()` pattern throughout codebase
- **Component Management**: Aligns with existing `EntityManager` patterns
- **Dependency Injection**: Matches established registration patterns in `operationHandlerRegistrations.js`

### 🔧 **Minor Corrections Applied**

- Updated schema references to use full URIs: `schema://living-narrative-engine/common.schema.json#/definitions/namespacedId`
- Clarified atomic operation flow in `sit_down` behavior description
- Added proper schema validation patterns and required fields
- Updated test directory references to indicate new positioning folders needed in e2e/performance

---

## Conclusion

The proximity-based closeness system can be successfully implemented by extending the existing positioning and closeness architecture. The key innovations are:

1. **Automatic Relationship Detection**: Use furniture spot adjacency to establish closeness
2. **Seamless Integration**: Work alongside existing manual closeness actions
3. **Intelligent Merging**: Handle complex scenarios like middle positions and existing relationships
4. **Performance Conscious**: Minimal impact on existing system performance

The implementation requires moderate complexity but provides significant user experience improvements by creating natural social proximity relationships based on spatial positioning.

**Next Steps**: Begin Phase 1 implementation with operation handler creation and rule modifications, supported by comprehensive unit testing to validate the core adjacency and closeness establishment logic.
