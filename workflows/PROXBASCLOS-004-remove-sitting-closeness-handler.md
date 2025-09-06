# PROXBASCLOS-004: Create RemoveSittingClosenessHandler

**Phase**: Foundation Layer  
**Priority**: High  
**Complexity**: High  
**Dependencies**: PROXBASCLOS-001 (proximity utilities), PROXBASCLOS-002 (operation schemas)  
**Estimated Time**: 8-10 hours

## Summary

Implement the `RemoveSittingClosenessHandler` operation handler that removes automatic closeness relationships when an actor stands up from furniture, while preserving manually-established closeness relationships created through `get_close` actions.

## Technical Requirements

### File to Create
- `src/logic/operationHandlers/removeSittingClosenessHandler.js`

### Operation Handler Architecture  

#### Class Structure
```javascript
class RemoveSittingClosenessHandler {
  #logger;
  #entityManager;
  #eventBus; 
  #closenessCircleService;
  #operationContext;

  constructor({ logger, entityManager, eventBus, closenessCircleService, operationContext }) {
    // Dependency validation and initialization
  }

  async execute(parameters) {
    // Main operation logic
  }

  // Private helper methods
}
```

#### Core Functionality

##### `execute(parameters)` - Main Operation Method
- **Input**: `{ furniture_id, actor_id, spot_index, result_variable? }`
- **Process**:
  1. Validate parameters and get furniture component
  2. Identify who was previously adjacent to the departing actor
  3. Remove only sitting-based closeness relationships
  4. Preserve explicit manual closeness relationships  
  5. Repair remaining closeness circles and update movement locks
  6. Store result in context if result_variable provided
- **Output**: Updated closeness components, movement lock adjustments

##### `#getFormerAdjacentOccupants(furnitureId, spotIndex)` - Former Adjacent Discovery
- **Input**: Furniture entity ID and the spot the actor just vacated
- **Process**:
  1. Retrieve current furniture `allows_sitting` component state
  2. Calculate which spots were adjacent to the now-empty spot
  3. Identify actors currently occupying those adjacent spots  
- **Output**: Array of actor IDs who were adjacent to the departing actor

##### `#removeSittingBasedCloseness(departingActorId, formerAdjacentActors)` - Selective Removal
- **Input**: Actor leaving and array of formerly adjacent actors
- **Process**:
  1. For each formerly adjacent actor, check if closeness was sitting-based or manual
  2. Remove only automatic/sitting-based relationships 
  3. Preserve relationships established through explicit `get_close` actions
  4. Use `closenessCircleService.repair()` to maintain valid circles after removal
- **Output**: Updated partner lists, repaired closeness circles

### Relationship Type Detection Strategy

#### Challenge: Distinguishing Automatic vs Manual Closeness
Since the current `positioning:closeness` component doesn't track relationship origins, the handler must use heuristics:

1. **Timing-Based Detection**: Closeness established in same rule execution as sitting = automatic
2. **Adjacency-Based Detection**: If actors are no longer adjacent and only became close through sitting proximity = automatic  
3. **Conservative Approach**: When uncertain, preserve the relationship (bias toward keeping connections)

#### Alternative: Enhanced Component Structure (Optional)
```json
{
  "partners": [
    {
      "entity_id": "game:character_bob", 
      "relationship_type": "sitting_proximity",
      "established_timestamp": "2025-09-05T10:30:00Z"
    },
    {
      "entity_id": "game:character_charlie",
      "relationship_type": "explicit_closeness", 
      "established_timestamp": "2025-09-05T09:15:00Z"
    }
  ]
}
```

### Integration Points

#### Dependencies Required
```javascript
import { validateDependency, assertPresent, assertNonBlankString } from '../../../utils/dependencyUtils.js';
import { getAdjacentSpots, validateProximityParameters } from '../../../utils/proximityUtils.js';
import { safeDispatchError } from '../../../utils/errorHandling.js';
import { updateMovementLock } from '../../../utils/movementUtils.js';
```

#### Service Integration  
- **ClosenessCircleService**: Use `repair()` method to fix circles after removal
- **EntityManager**: Query and update closeness components
- **EventBus**: Dispatch removal success/error events
- **OperationContext**: Store operation results for rule conditions

## Acceptance Criteria

### Core Functionality Requirements
- [ ] **Former Adjacent Detection**: Correctly identifies actors who were adjacent before standing
- [ ] **Selective Removal**: Removes only sitting-based closeness, preserves manual relationships
- [ ] **Circle Repair**: Maintains valid closeness circles after relationship removal  
- [ ] **Movement Unlock**: Updates movement locks appropriately after closeness changes
- [ ] **Component Cleanup**: Removes empty closeness components when no partners remain

### Preservation Requirements
- [ ] **Manual Closeness**: Never removes relationships established through `get_close` action
- [ ] **Mixed Relationships**: Handles actors with both sitting and manual closeness correctly
- [ ] **Chain Preservation**: Maintains closeness chains when middle actors stand up
- [ ] **Concurrent Operations**: Handles multiple actors standing simultaneously

### Edge Case Handling  
- [ ] **No Previous Adjacent**: Handles actor standing from isolated spot gracefully
- [ ] **All Actors Standing**: Handles entire group standing up simultaneously
- [ ] **Invalid Parameters**: Validates inputs and provides clear error messages
- [ ] **Missing Components**: Handles missing closeness components appropriately

### Data Consistency Requirements
- [ ] **Bidirectional Cleanup**: Removes actor from all former partners' lists
- [ ] **Circle Integrity**: Maintains fully-connected closeness circles
- [ ] **No Orphaned Data**: Cleans up components with empty partner lists
- [ ] **Atomic Operations**: All updates succeed or all fail

## Detailed Algorithm

### Step-by-Step Process Flow

#### Phase 1: Parameter Validation and Context Setup
```javascript
async execute(parameters) {
  // 1. Validate parameters
  validateProximityParameters(parameters.furniture_id, parameters.actor_id,
                             parameters.spot_index, this.#logger);
  
  // 2. Get current furniture state (after actor has stood up)
  const furnitureComponent = this.#entityManager.getComponent(
    parameters.furniture_id, 'positioning:allows_sitting'  
  );
  
  // 3. Get departing actor's current closeness state
  const departingActorCloseness = this.#entityManager.getComponent(
    parameters.actor_id, 'positioning:closeness'
  );
  
  if (!departingActorCloseness || departingActorCloseness.partners.length === 0) {
    // No closeness to remove - operation succeeds
    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, true);
    }
    return;
  }
```

#### Phase 2: Former Adjacent Actor Discovery
```javascript
  // 4. Identify who was adjacent before standing up
  const formerAdjacentActors = this.#getFormerAdjacentOccupants(
    parameters.furniture_id,
    parameters.spot_index  
  );
  
  if (formerAdjacentActors.length === 0) {
    // No adjacent actors affected - no closeness to remove
    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, true);
    }
    return;
  }
```

#### Phase 3: Selective Closeness Removal
```javascript
  // 5. Remove only sitting-based closeness relationships
  const updatedPartnerData = await this.#removeSittingBasedCloseness(
    parameters.actor_id,
    formerAdjacentActors,
    departingActorCloseness.partners
  );
  
  // 6. Apply component updates for all affected actors
  for (const [actorId, updatedPartners] of Object.entries(updatedPartnerData)) {
    if (updatedPartners.length === 0) {
      // Remove component if no partners remain
      this.#entityManager.removeComponent(actorId, 'positioning:closeness');
    } else {
      // Update component with remaining partners
      this.#entityManager.upsertComponent(actorId, 'positioning:closeness', {
        partners: updatedPartners
      });
    }
  }
```

#### Phase 4: Movement Lock Updates and Success Handling
```javascript
  // 7. Update movement locks for affected actors
  const allAffectedActors = [parameters.actor_id, ...formerAdjacentActors];
  await this.#updateMovementLocksAfterRemoval(allAffectedActors);
  
  // 8. Log success and store result
  this.#logger.info('Sitting closeness removed successfully', {
    departingActorId: parameters.actor_id,
    formerAdjacentActors: formerAdjacentActors,
    furnitureId: parameters.furniture_id
  });
  
  if (parameters.result_variable) {
    this.#operationContext.setVariable(parameters.result_variable, true);
  }
}
```

### Helper Method Implementation

#### `#getFormerAdjacentOccupants(furnitureId, vacatedSpotIndex)`
```javascript
async #getFormerAdjacentOccupants(furnitureId, vacatedSpotIndex) {
  const furnitureComponent = this.#entityManager.getComponent(furnitureId, 'positioning:allows_sitting');
  
  if (!furnitureComponent) {
    return [];
  }
  
  // Calculate which spots were adjacent to the vacated spot
  const adjacentSpotIndices = getAdjacentSpots(vacatedSpotIndex, furnitureComponent.spots.length);
  
  // Find actors currently occupying those adjacent spots
  const adjacentActors = [];
  for (const spotIndex of adjacentSpotIndices) {
    const occupant = furnitureComponent.spots[spotIndex];
    if (occupant && occupant !== null) {
      adjacentActors.push(occupant);
    }
  }
  
  return adjacentActors;
}
```

#### `#removeSittingBasedCloseness(departingActorId, formerAdjacentActors, currentPartners)`
```javascript
async #removeSittingBasedCloseness(departingActorId, formerAdjacentActors, currentPartners) {
  const updatedPartnerData = {};
  
  // Start with current partner relationships
  const partnersToProcess = new Set([departingActorId, ...currentPartners]);
  
  for (const actorId of partnersToProcess) {
    const actorCloseness = this.#entityManager.getComponent(actorId, 'positioning:closeness');
    if (!actorCloseness) continue;
    
    let updatedPartners = [...actorCloseness.partners];
    
    if (actorId === departingActorId) {
      // Remove former adjacent actors from departing actor's list
      updatedPartners = updatedPartners.filter(partner => 
        !this.#isSittingBasedRelationship(partner, formerAdjacentActors)
      );
    } else if (formerAdjacentActors.includes(actorId)) {
      // Remove departing actor from former adjacent actors' lists
      updatedPartners = updatedPartners.filter(partner => partner !== departingActorId);
    }
    
    updatedPartnerData[actorId] = updatedPartners;
  }
  
  // Use closeness circle service to repair any broken circles
  return this.#closenessCircleService.repair(updatedPartnerData);
}
```

#### `#isSittingBasedRelationship(partnerId, formerAdjacentActors)` - Heuristic Detection
```javascript
#isSittingBasedRelationship(partnerId, formerAdjacentActors) {
  // Conservative heuristic: Only remove if partner was adjacent and likely sitting-based
  // This could be enhanced with relationship type tracking in future versions
  return formerAdjacentActors.includes(partnerId);
}
```

## Testing Strategy

### Unit Test Structure  
File: `tests/unit/logic/operationHandlers/removeSittingClosenessHandler.test.js`

#### Test Suites

##### 1. Parameter Validation and Setup Tests
```javascript
describe('RemoveSittingClosenessHandler - Parameter Validation', () => {
  it('should validate required parameters', () => {
    const invalidParams = { furniture_id: 'couch:1' }; // Missing actor_id, spot_index
    expect(() => handler.execute(invalidParams)).toThrow();
  });
  
  it('should handle missing closeness component gracefully', () => {
    // Test actor with no existing closeness - should succeed with no action
  });
});
```

##### 2. Former Adjacent Detection Tests
```javascript
describe('RemoveSittingClosenessHandler - Adjacent Detection', () => {
  it('should identify formerly adjacent actors correctly', () => {
    // Setup: [alice, bob, charlie] - bob stands up
    // Expected: Alice and Charlie identified as formerly adjacent to Bob
  });
  
  it('should handle edge position departures', () => {
    // Setup: [alice, bob, null] - alice stands up 
    // Expected: Bob identified as formerly adjacent to Alice
  });
  
  it('should handle no formerly adjacent actors', () => {
    // Setup: [alice, null, null] - alice stands up
    // Expected: No former adjacents, operation succeeds with no action
  });
});
```

##### 3. Selective Closeness Removal Tests
```javascript
describe('RemoveSittingClosenessHandler - Selective Removal', () => {
  it('should remove only sitting-based closeness relationships', () => {
    // Setup: Alice-Bob sitting closeness, Alice-Charlie manual closeness
    // Action: Alice stands up
    // Expected: Alice-Bob removed, Alice-Charlie preserved
  });
  
  it('should maintain bidirectional relationship consistency', () => {
    // Verify that when A-B relationship is removed, both actors lose the connection
  });
  
  it('should repair closeness circles after removal', () => {
    // Setup: Alice-Bob-Charlie circle, Bob stands up
    // Expected: Alice-Charlie direct relationship may be removed if no other connection
  });
});
```

##### 4. Movement Lock and Component Updates
```javascript
describe('RemoveSittingClosenessHandler - Component Management', () => {
  it('should remove closeness component when no partners remain', () => {
    // Test component cleanup for isolated actors
  });
  
  it('should update movement locks appropriately', () => {
    // Test movement unlock when closeness is removed
  });
  
  it('should handle concurrent standing operations', () => {
    // Test multiple actors standing simultaneously  
  });
});
```

### Integration Testing
File: `tests/integration/mods/positioning/removeSittingCloseness.integration.test.js`

#### Integration Scenarios
1. **Complete Workflow Integration**
   - Setup sitting actors with established closeness
   - Execute stand up action and verify closeness removal
   - Test movement lock updates
   - Verify event dispatching

2. **Mixed Relationship Handling**
   - Setup actors with both sitting and manual closeness  
   - Test selective removal preserves manual relationships
   - Verify circle integrity after partial removal

3. **Complex Furniture Scenarios**
   - Test multi-actor furniture with chain standing
   - Verify appropriate relationship preservation
   - Test edge position and middle position departures

## Performance Considerations

### Efficiency Requirements
- **O(n) Complexity**: Where n = number of actors in closeness circle
- **Minimal Queries**: Cache component data during operation
- **Batch Updates**: Apply all component changes atomically
- **Memory Efficient**: No unnecessary object creation or retention

### Optimization Strategies  
- Use Set operations for partner list filtering
- Cache closeness components for affected actors
- Minimize event dispatching overhead
- Reuse repair logic from `ClosenessCircleService`

## Error Handling Strategy

### Error Recovery Patterns
```javascript
try {
  // Operation logic
} catch (error) {
  this.#logger.error('Failed to remove sitting closeness', {
    departingActorId: parameters.actor_id,
    furnitureId: parameters.furniture_id,
    spotIndex: parameters.spot_index,
    error: error.message
  });
  
  safeDispatchError(this.#eventBus, 'REMOVE_SITTING_CLOSENESS_FAILED', {
    departingActorId: parameters.actor_id,
    furnitureId: parameters.furniture_id, 
    reason: error.message
  });
  
  if (parameters.result_variable) {
    this.#operationContext.setVariable(parameters.result_variable, false);
  }
}
```

### Graceful Degradation
- If relationship type detection fails, err on side of preserving relationships
- If circle repair fails, maintain individual relationships where possible
- Always ensure component consistency even on partial failures

## Definition of Done
- [ ] Handler class implemented with all required methods
- [ ] Dependency injection properly configured
- [ ] Parameter validation working correctly
- [ ] Former adjacent detection functioning properly
- [ ] Selective closeness removal implemented
- [ ] Circle repair integration working  
- [ ] Movement lock updates implemented
- [ ] Error handling following project patterns
- [ ] Unit tests written with >90% coverage
- [ ] Integration tests covering complex scenarios
- [ ] Performance benchmarks meet requirements
- [ ] Code follows project standards and conventions