# PROXBASCLOS-003: Create EstablishSittingClosenessHandler

**Phase**: Foundation Layer  
**Priority**: High  
**Complexity**: High  
**Dependencies**: PROXBASCLOS-001 (proximity utilities), PROXBASCLOS-002 (operation schemas)  
**Estimated Time**: 8-10 hours

## Summary

Implement the `EstablishSittingClosenessHandler` operation handler that automatically creates closeness relationships when an actor sits in a spot adjacent to other actors. This handler integrates with the existing closeness circle system while preserving manual closeness relationships.

## Technical Requirements

### File to Create
- `src/logic/operationHandlers/establishSittingClosenessHandler.js`

### Operation Handler Architecture

#### Class Structure
```javascript
class EstablishSittingClosenessHandler {
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
  1. Validate parameters and retrieve components
  2. Find adjacent occupants using proximity utilities
  3. Establish closeness relationships with adjacent actors
  4. Update movement locks for all affected actors
  5. Store result in context if result_variable provided
- **Output**: Operation success/failure, updated closeness components

##### `#getAdjacentOccupants(furnitureId, spotIndex)` - Adjacent Actor Discovery  
- **Input**: Furniture entity ID and spot index
- **Process**:
  1. Retrieve furniture's `allows_sitting` component
  2. Use `proximityUtils.findAdjacentOccupants()` to get adjacent actors
  3. Filter out null/invalid entity IDs
- **Output**: Array of adjacent actor entity IDs

##### `#establishClosenessRelationships(actorId, adjacentActors)` - Closeness Management
- **Input**: Main actor ID and array of adjacent actor IDs  
- **Process**:
  1. For each adjacent actor, merge closeness circles using `closenessCircleService.merge()`
  2. Handle existing closeness relationships (preserve and extend)
  3. Update `positioning:closeness` components for all affected actors
  4. Apply movement locks using `updateMovementLock()` utility
- **Output**: Updated closeness components, movement lock status

### Integration Points

#### Dependencies Required
```javascript
import { validateDependency, assertPresent, assertNonBlankString } from '../../../utils/dependencyUtils.js';
import { findAdjacentOccupants, validateProximityParameters } from '../../../utils/proximityUtils.js';  
import { safeDispatchError } from '../../../utils/errorHandling.js';
import { updateMovementLock } from '../../../utils/movementUtils.js';
```

#### Service Integration
- **ClosenessCircleService**: Use `merge()` method to combine partner lists
- **EntityManager**: Retrieve and update component data
- **EventBus**: Dispatch success/error events
- **OperationContext**: Store results for rule conditions

#### Error Handling Pattern
```javascript
try {
  // Operation logic
} catch (error) {
  this.#logger.error('Failed to establish sitting closeness', { 
    furnitureId, actorId, spotIndex, error: error.message 
  });
  
  safeDispatchError(this.#eventBus, 'ESTABLISH_SITTING_CLOSENESS_FAILED', {
    furnitureId, actorId, spotIndex, reason: error.message
  });
  
  if (parameters.result_variable) {
    this.#operationContext.setVariable(parameters.result_variable, false);
  }
  
  return;
}
```

## Acceptance Criteria

### Core Functionality Requirements
- [ ] **Adjacent Detection**: Correctly identifies actors in adjacent spots (N±1)
- [ ] **Closeness Creation**: Establishes bidirectional closeness relationships  
- [ ] **Circle Merging**: Properly merges existing closeness circles when actors join
- [ ] **Movement Locking**: Updates movement locks for all affected actors
- [ ] **Component Updates**: Updates `positioning:closeness` components correctly

### Integration Requirements  
- [ ] **Service Integration**: Uses `ClosenessCircleService.merge()` for relationship management
- [ ] **Utility Integration**: Uses proximity utilities for adjacency calculations
- [ ] **Error Handling**: Follows existing error handling patterns with `safeDispatchError()`
- [ ] **Context Integration**: Stores results in operation context when requested

### Edge Case Handling
- [ ] **No Adjacent Actors**: Handles empty furniture gracefully (no operation needed)
- [ ] **Single Spot Furniture**: Handles furniture with no possible adjacent spots
- [ ] **Invalid Parameters**: Validates all inputs and provides clear error messages
- [ ] **Missing Components**: Handles actors or furniture missing required components

### Data Consistency Requirements
- [ ] **Bidirectional Relationships**: All closeness relationships are properly bidirectional
- [ ] **Partner List Integrity**: Partner lists remain consistent across all actors in circle
- [ ] **Duplicate Prevention**: No duplicate entries in partner lists
- [ ] **Atomic Updates**: All component updates succeed or all fail (no partial state)

## Detailed Algorithm

### Step-by-Step Process Flow

#### Phase 1: Parameter Validation and Setup
```javascript
async execute(parameters) {
  // 1. Validate parameters
  validateProximityParameters(parameters.furniture_id, parameters.actor_id, 
                             parameters.spot_index, this.#logger);
  
  // 2. Verify actor and furniture exist
  const furnitureComponent = this.#entityManager.getComponent(
    parameters.furniture_id, 'positioning:allows_sitting'
  );
  
  if (!furnitureComponent) {
    throw new Error(`Furniture ${parameters.furniture_id} does not have allows_sitting component`);
  }
```

#### Phase 2: Adjacent Actor Discovery  
```javascript
  // 3. Find adjacent occupants
  const adjacentActors = this.#getAdjacentOccupants(
    parameters.furniture_id, 
    parameters.spot_index
  );
  
  if (adjacentActors.length === 0) {
    // No adjacent actors - operation succeeds but no action needed
    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, true);
    }
    return;
  }
```

#### Phase 3: Closeness Relationship Establishment
```javascript
  // 4. Establish closeness with each adjacent actor
  for (const adjacentActorId of adjacentActors) {
    await this.#establishClosenessRelationships(
      parameters.actor_id, 
      adjacentActorId
    );
  }
  
  // 5. Update movement locks for all affected actors
  const allAffectedActors = [parameters.actor_id, ...adjacentActors];
  await this.#updateMovementLocksForActors(allAffectedActors);
```

#### Phase 4: Success Handling and Context Updates
```javascript
  // 6. Log success and store result
  this.#logger.info('Sitting closeness established successfully', {
    actorId: parameters.actor_id,
    furnitureId: parameters.furniture_id, 
    spotIndex: parameters.spot_index,
    adjacentActors: adjacentActors
  });
  
  if (parameters.result_variable) {
    this.#operationContext.setVariable(parameters.result_variable, true);
  }
}
```

### Helper Method Implementation

#### `#establishClosenessRelationships(actorId, adjacentActorId)`
```javascript
async #establishClosenessRelationships(actorId, adjacentActorId) {
  // Get existing closeness components
  const actorCloseness = this.#entityManager.getComponent(actorId, 'positioning:closeness');
  const adjacentCloseness = this.#entityManager.getComponent(adjacentActorId, 'positioning:closeness');
  
  // Merge partner lists using closeness circle service
  const mergedPartners = this.#closenessCircleService.merge(
    actorCloseness?.partners || [],
    adjacentCloseness?.partners || [], 
    actorId,
    adjacentActorId
  );
  
  // Update all actors in the merged circle
  for (const [entityId, partners] of Object.entries(mergedPartners)) {
    this.#entityManager.upsertComponent(entityId, 'positioning:closeness', {
      partners: partners
    });
  }
}
```

## Testing Strategy

### Unit Test Structure
File: `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`

#### Test Suites

##### 1. Parameter Validation Tests
```javascript
describe('EstablishSittingClosenessHandler - Parameter Validation', () => {
  it('should validate required parameters', () => {
    const invalidParams = { furniture_id: 'couch:1' }; // Missing actor_id, spot_index
    expect(() => handler.execute(invalidParams)).toThrow();
  });
  
  it('should validate furniture exists with allows_sitting component', () => {
    // Test with non-existent furniture
    // Test with furniture missing allows_sitting component
  });
});
```

##### 2. Adjacent Actor Detection Tests  
```javascript
describe('EstablishSittingClosenessHandler - Adjacent Detection', () => {
  it('should identify single adjacent actor correctly', () => {
    // Setup: [alice, null, null], bob sits in spot 1
    // Expected: Bob finds Alice as adjacent
  });
  
  it('should identify multiple adjacent actors for middle position', () => {
    // Setup: [alice, null, charlie], bob sits in spot 1  
    // Expected: Bob finds both Alice and Charlie as adjacent
  });
  
  it('should handle no adjacent actors gracefully', () => {
    // Setup: [null, null, null], alice sits in spot 1
    // Expected: No operation needed, success result
  });
});
```

##### 3. Closeness Establishment Tests
```javascript
describe('EstablishSittingClosenessHandler - Closeness Creation', () => {
  it('should create bidirectional closeness between two actors', () => {
    // Verify both actors get each other in partner lists
  });
  
  it('should merge existing closeness circles correctly', () => {
    // Setup: Alice-Bob circle, Charlie sits adjacent to Alice
    // Expected: All three actors in same circle
  });
  
  it('should preserve manual closeness relationships', () => {
    // Setup: Alice-Bob manual closeness, Charlie sits adjacent
    // Expected: Alice has both Bob and Charlie, relationships preserved
  });
});
```

##### 4. Error Handling and Edge Cases
```javascript
describe('EstablishSittingClosenessHandler - Error Handling', () => {
  it('should handle missing furniture component gracefully', () => {
    // Test error dispatching and context updates
  });
  
  it('should handle single-spot furniture with no adjacent possibilities', () => {
    // Verify operation succeeds but no action taken
  });
});
```

### Integration Testing
File: `tests/integration/mods/positioning/establishSittingCloseness.integration.test.js`

#### Integration Scenarios
1. **Complete Workflow Integration**
   - Setup furniture with multiple spots
   - Place actors and verify closeness establishment
   - Test movement lock updates
   - Verify event dispatching

2. **Service Integration**
   - Test `ClosenessCircleService.merge()` integration
   - Verify component updates through `EntityManager`
   - Test error handling through event bus

3. **Cross-Handler Integration**  
   - Test interaction with `mergeClosenessCircleHandler` (manual closeness)
   - Verify compatibility with existing closeness workflows

## Performance Considerations

### Efficiency Requirements
- **O(k) Complexity**: Where k = number of adjacent actors (max 2)
- **Minimal Component Queries**: Cache components when possible
- **Batch Updates**: Update all affected components in single transaction
- **Memory Management**: No object leaks, efficient garbage collection

### Optimization Strategies
- Cache furniture component data during operation
- Use Set operations for partner list management
- Minimize event dispatching overhead
- Reuse existing service utilities

## Definition of Done
- [ ] Handler class implemented with all required methods
- [ ] Dependency injection properly configured
- [ ] Parameter validation working correctly
- [ ] Adjacent actor detection functioning
- [ ] Closeness relationship establishment working
- [ ] Movement lock integration complete
- [ ] Error handling implemented with proper patterns
- [ ] Unit tests written with >90% coverage
- [ ] Integration tests passing
- [ ] Performance benchmarks meet requirements
- [ ] Code reviewed and follows project standards