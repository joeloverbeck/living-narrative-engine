# PROXBASCLOS-009: Create Unit Tests for Operation Handlers

**Phase**: Testing Layer  
**Priority**: High  
**Complexity**: High  
**Dependencies**: PROXBASCLOS-003, PROXBASCLOS-004 (operation handlers)  
**Estimated Time**: 10-12 hours

## Summary

Create comprehensive unit tests for the `EstablishSittingClosenessHandler` and `RemoveSittingClosenessHandler` operation handlers. These tests ensure correct closeness relationship management, error handling, and integration with existing services.

## Technical Requirements

### Files to Create

#### 1. `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`
- Complete test coverage for establishment logic
- Mock dependencies and service integration
- Error handling and edge case scenarios
- Performance and memory validation

#### 2. `tests/unit/logic/operationHandlers/removeSittingClosenessHandler.test.js`  
- Complete test coverage for removal logic
- Selective relationship removal validation
- Circle repair functionality testing
- Complex scenario handling

### Test Coverage Requirements

#### Coverage Targets
- **Branch Coverage**: 100% (all conditional logic paths)
- **Function Coverage**: 100% (all methods tested)
- **Line Coverage**: ≥95% (comprehensive line coverage)
- **Integration Points**: All service dependencies tested

#### Critical Test Areas
- **Parameter Validation**: All input validation scenarios
- **Adjacent Detection**: Adjacency calculation accuracy
- **Service Integration**: Proper use of ClosenessCircleService
- **Error Handling**: Comprehensive error scenarios
- **Component Management**: Proper component CRUD operations
- **Movement Lock Integration**: Correct lock/unlock behavior

## EstablishSittingClosenessHandler Test Implementation

### Test Structure and Setup

#### Import Section and Test Setup
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EstablishSittingClosenessHandler from '../../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import { createTestBed } from '../../../common/testBed.js';
import { createMockClosenessCircleService } from '../../../common/mocks/mockClosenessCircleService.js';

describe('EstablishSittingClosenessHandler', () => {
  let testBed;
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockClosenessCircleService;
  let mockOperationContext;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMockEntityManager();
    mockEventBus = testBed.createMockEventBus();
    mockClosenessCircleService = createMockClosenessCircleService();
    mockOperationContext = testBed.createMockOperationContext();

    handler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      closenessCircleService: mockClosenessCircleService,
      operationContext: mockOperationContext,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });
});
```

### Parameter Validation Tests

#### Constructor and Dependency Validation
```javascript
describe('EstablishSittingClosenessHandler - Constructor and Dependencies', () => {
  it('should validate required dependencies in constructor', () => {
    expect(() => {
      new EstablishSittingClosenessHandler({
        logger: null, // Invalid
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
        closenessCircleService: mockClosenessCircleService,
        operationContext: mockOperationContext,
      });
    }).toThrow('Logger is required');
  });

  it('should validate EntityManager has required methods', () => {
    const invalidEntityManager = {};

    expect(() => {
      new EstablishSittingClosenessHandler({
        logger: mockLogger,
        entityManager: invalidEntityManager,
        eventBus: mockEventBus,
        closenessCircleService: mockClosenessCircleService,
        operationContext: mockOperationContext,
      });
    }).toThrow('IEntityManager must have required methods');
  });

  it('should initialize successfully with valid dependencies', () => {
    expect(handler).toBeInstanceOf(EstablishSittingClosenessHandler);
  });
});
```

#### Execute Parameter Validation
```javascript
describe('EstablishSittingClosenessHandler - Parameter Validation', () => {
  it('should validate required parameters', async () => {
    const invalidParams = {
      furniture_id: 'furniture:couch',
      // Missing actor_id and spot_index
    };

    await expect(handler.execute(invalidParams)).rejects.toThrow('Actor ID is required');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to establish sitting closeness',
      expect.objectContaining({
        error: expect.stringContaining('Actor ID is required')
      })
    );
  });

  it('should validate furniture exists with allows_sitting component', async () => {
    mockEntityManager.getComponent.mockReturnValue(null);

    const params = {
      furniture_id: 'furniture:nonexistent',
      actor_id: 'game:alice',
      spot_index: 1,
    };

    await expect(handler.execute(params)).rejects.toThrow('does not have allows_sitting component');
  });

  it('should validate spot index bounds', async () => {
    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: -1, // Invalid
    };

    await expect(handler.execute(params)).rejects.toThrow('Spot index must be non-negative');
  });
});
```

### Adjacent Actor Detection Tests

#### Basic Adjacency Scenarios
```javascript
describe('EstablishSittingClosenessHandler - Adjacent Detection', () => {
  beforeEach(() => {
    // Mock furniture component with occupants
    mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        return {
          spots: ['game:alice', null, 'game:charlie', null, null]
        };
      }
      return null;
    });
  });

  it('should identify single adjacent actor correctly', async () => {
    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1, // Adjacent to Alice in spot 0
    };

    // Mock closeness circle service
    mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    await handler.execute(params);

    expect(mockClosenessCircleService.merge).toHaveBeenCalledWith(
      [], // Alice's current partners (empty)
      [], // Bob's current partners (empty)  
      'game:alice',
      'game:bob'
    );
  });

  it('should identify multiple adjacent actors for middle position', async () => {
    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 2, // Adjacent to Alice (spot 1) and Charlie (spot 3)
    };

    // Update mock to have Alice in spot 1, Charlie in spot 3
    mockEntityManager.getComponent.mockReturnValue({
      spots: [null, 'game:alice', null, 'game:charlie', null]
    });

    mockClosenessCircleService.merge
      .mockReturnValueOnce({
        'game:alice': ['game:bob'],
        'game:bob': ['game:alice']
      })
      .mockReturnValueOnce({
        'game:alice': ['game:bob'],
        'game:bob': ['game:alice', 'game:charlie'],
        'game:charlie': ['game:bob']
      });

    await handler.execute(params);

    expect(mockClosenessCircleService.merge).toHaveBeenCalledTimes(2);
  });

  it('should handle no adjacent actors gracefully', async () => {
    mockEntityManager.getComponent.mockReturnValue({
      spots: [null, null, null, null, null] // All empty
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 2,
    };

    await handler.execute(params);

    expect(mockClosenessCircleService.merge).not.toHaveBeenCalled();
    expect(mockOperationContext.setVariable).toHaveBeenCalledWith(undefined, true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sitting closeness established successfully',
      expect.objectContaining({
        adjacentActors: []
      })
    );
  });
});
```

### Closeness Relationship Management Tests

#### Simple Relationship Creation
```javascript
describe('EstablishSittingClosenessHandler - Closeness Creation', () => {
  it('should establish bidirectional closeness between two actors', async () => {
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: ['game:alice', null, null] }) // Furniture component
      .mockReturnValueOnce(null) // Alice has no existing closeness
      .mockReturnValueOnce(null); // Bob has no existing closeness

    mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
      result_variable: 'closenessResult'
    };

    await handler.execute(params);

    // Verify both actors get closeness components
    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:alice',
      'positioning:closeness',
      { partners: ['game:bob'] }
    );

    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:bob',
      'positioning:closeness', 
      { partners: ['game:alice'] }
    );

    expect(mockOperationContext.setVariable).toHaveBeenCalledWith('closenessResult', true);
  });

  it('should merge with existing closeness circles', async () => {
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: ['game:alice', null, 'game:charlie'] }) // Furniture
      .mockReturnValueOnce({ partners: ['game:david'] }) // Alice has existing closeness with David
      .mockReturnValueOnce(null); // Bob has no existing closeness

    mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:david', 'game:bob'],
      'game:bob': ['game:alice', 'game:david'],
      'game:david': ['game:alice', 'game:bob']
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await handler.execute(params);

    // Verify all three actors are in merged circle
    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:alice',
      'positioning:closeness',
      { partners: ['game:david', 'game:bob'] }
    );

    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:bob', 
      'positioning:closeness',
      { partners: ['game:alice', 'game:david'] }
    );

    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:david',
      'positioning:closeness',
      { partners: ['game:alice', 'game:bob'] }
    );
  });
});
```

#### Movement Lock Integration
```javascript
describe('EstablishSittingClosenessHandler - Movement Lock Integration', () => {
  it('should update movement locks for all affected actors', async () => {
    mockEntityManager.getComponent.mockReturnValue({ spots: ['game:alice', null, null] });
    mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    // Mock the movement lock utility
    const mockUpdateMovementLock = jest.fn();
    handler.__setMovementLockUtility(mockUpdateMovementLock);

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await handler.execute(params);

    expect(mockUpdateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      ['game:bob', 'game:alice'],
      mockLogger
    );
  });
});
```

### Error Handling and Edge Cases

#### Component Access Errors  
```javascript
describe('EstablishSittingClosenessHandler - Error Handling', () => {
  it('should handle EntityManager component access failures', async () => {
    mockEntityManager.getComponent.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 1,
      result_variable: 'result'
    };

    await expect(handler.execute(params)).rejects.toThrow('Database connection failed');

    expect(mockEventBus.dispatch).toHaveBeenCalledWith({
      type: 'ESTABLISH_SITTING_CLOSENESS_FAILED',
      payload: expect.objectContaining({
        furnitureId: 'furniture:couch',
        actorId: 'game:alice',
        reason: 'Database connection failed'
      })
    });

    expect(mockOperationContext.setVariable).toHaveBeenCalledWith('result', false);
  });

  it('should handle ClosenessCircleService failures gracefully', async () => {
    mockEntityManager.getComponent.mockReturnValue({ spots: ['game:alice', null, null] });
    mockClosenessCircleService.merge.mockImplementation(() => {
      throw new Error('Circle merge failed');
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await expect(handler.execute(params)).rejects.toThrow('Circle merge failed');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to establish sitting closeness',
      expect.objectContaining({
        error: 'Circle merge failed'
      })
    );
  });

  it('should handle component update failures', async () => {
    mockEntityManager.getComponent.mockReturnValue({ spots: ['game:alice', null, null] });
    mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    mockEntityManager.upsertComponent.mockImplementation(() => {
      throw new Error('Component update failed');
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await expect(handler.execute(params)).rejects.toThrow('Component update failed');
  });
});
```

## RemoveSittingClosenessHandler Test Implementation

### Test Structure and Setup
```javascript
import RemoveSittingClosenessHandler from '../../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';

describe('RemoveSittingClosenessHandler', () => {
  let testBed;
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockClosenessCircleService;
  let mockOperationContext;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMockEntityManager();
    mockEventBus = testBed.createMockEventBus();
    mockClosenessCircleService = createMockClosenessCircleService();
    mockOperationContext = testBed.createMockOperationContext();

    handler = new RemoveSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      closenessCircleService: mockClosenessCircleService,
      operationContext: mockOperationContext,
    });
  });
});
```

### Former Adjacent Detection Tests
```javascript
describe('RemoveSittingClosenessHandler - Former Adjacent Detection', () => {
  it('should identify formerly adjacent actors correctly', async () => {
    // Setup: Bob was in spot 1, Alice in spot 0, Charlie in spot 2
    // After Bob stands up: [Alice, null, Charlie]
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: ['game:alice', null, 'game:charlie'] }) // Current furniture state
      .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }); // Bob's current closeness

    mockClosenessCircleService.repair.mockReturnValue({
      'game:alice': [],
      'game:charlie': []
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1, // Bob's former spot
    };

    await handler.execute(params);

    expect(mockClosenessCircleService.repair).toHaveBeenCalled();
  });

  it('should handle edge position departures', async () => {
    // Alice was in spot 0, Bob in spot 1
    // After Alice stands up: [null, Bob]
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: [null, 'game:bob'] })
      .mockReturnValueOnce({ partners: ['game:bob'] });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 0,
    };

    await handler.execute(params);

    // Bob should be identified as formerly adjacent to Alice
    expect(mockClosenessCircleService.repair).toHaveBeenCalled();
  });
});
```

### Selective Closeness Removal Tests
```javascript
describe('RemoveSittingClosenessHandler - Selective Removal', () => {
  it('should remove only sitting-based relationships', async () => {
    // Setup: Alice has both sitting closeness with Bob and manual closeness with Charlie
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: [null, 'game:bob'] }) // Alice stood up from spot 0
      .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Alice's closeness
      .mockReturnValueOnce({ partners: ['game:alice'] }) // Bob's closeness
      .mockReturnValueOnce({ partners: ['game:alice'] }); // Charlie's closeness

    // Mock repair to simulate preserving manual relationship with Charlie
    mockClosenessCircleService.repair.mockReturnValue({
      'game:alice': ['game:charlie'],
      'game:charlie': ['game:alice'],
      'game:bob': []
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 0,
    };

    await handler.execute(params);

    // Verify Alice-Charlie relationship preserved, Alice-Bob removed
    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:alice',
      'positioning:closeness',
      { partners: ['game:charlie'] }
    );

    expect(mockEntityManager.upsertComponent).toHaveBeenCalledWith(
      'game:charlie',
      'positioning:closeness',
      { partners: ['game:alice'] }
    );

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      'game:bob',
      'positioning:closeness'
    );
  });

  it('should maintain bidirectional relationship consistency', async () => {
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: ['game:alice', null] }) // Bob stood up from spot 1
      .mockReturnValueOnce({ partners: ['game:alice'] }); // Bob's closeness

    mockClosenessCircleService.repair.mockReturnValue({
      'game:alice': [],
      'game:bob': []
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await handler.execute(params);

    // Both actors should have closeness components removed
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith('game:alice', 'positioning:closeness');
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith('game:bob', 'positioning:closeness');
  });
});
```

### Circle Repair and Component Management Tests
```javascript
describe('RemoveSittingClosenessHandler - Circle Repair', () => {
  it('should repair closeness circles after removal', async () => {
    const mockCircleData = {
      'game:alice': ['game:charlie'],
      'game:bob': [],
      'game:charlie': ['game:alice']
    };

    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: ['game:alice', null, 'game:charlie'] })
      .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] });

    mockClosenessCircleService.repair.mockReturnValue(mockCircleData);

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:bob',
      spot_index: 1,
    };

    await handler.execute(params);

    expect(mockClosenessCircleService.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        'game:bob': expect.any(Array)
      })
    );
  });

  it('should remove empty closeness components', async () => {
    mockEntityManager.getComponent
      .mockReturnValueOnce({ spots: [null] })
      .mockReturnValueOnce({ partners: [] }); // Empty partners list

    mockClosenessCircleService.repair.mockReturnValue({
      'game:alice': []
    });

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 0,
    };

    await handler.execute(params);

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      'game:alice',
      'positioning:closeness'
    );
  });
});
```

## Performance and Integration Tests

### Performance Validation
```javascript
describe('Operation Handlers - Performance', () => {
  it('should execute establish operation quickly', async () => {
    const startTime = performance.now();

    const params = {
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 1,
    };

    await handler.execute(params);

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(50); // Should complete in <50ms
  });

  it('should not create memory leaks in repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const params = {
        furniture_id: `furniture:couch_${i}`,
        actor_id: `game:actor_${i}`,
        spot_index: 1,
      };

      await handler.execute(params);
    }

    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(1024 * 1024); // <1MB increase
  });
});
```

## Mock Service Utilities

### ClosenessCircleService Mock
```javascript
// tests/common/mocks/mockClosenessCircleService.js
export function createMockClosenessCircleService() {
  return {
    merge: jest.fn().mockReturnValue({}),
    repair: jest.fn().mockReturnValue({}),
    dedupe: jest.fn().mockImplementation(partners => partners),
  };
}
```

### EntityManager Mock Extensions
```javascript
function setupEntityManagerForProximityTests(mockEntityManager) {
  mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
    // Default furniture component
    if (componentType === 'positioning:allows_sitting') {
      return { spots: [null, null, null] };
    }
    
    // Default closeness component (none)
    if (componentType === 'positioning:closeness') {
      return null;
    }
    
    return null;
  });

  mockEntityManager.upsertComponent.mockImplementation((entityId, componentType, data) => {
    // Track component updates for verification
  });

  mockEntityManager.removeComponent.mockImplementation((entityId, componentType) => {
    // Track component removals for verification
  });
}
```

## Implementation Checklist

### Phase 1: Test Structure and Dependencies
- [ ] Create both test files with proper imports and setup
- [ ] Implement comprehensive mock utilities
- [ ] Set up test bed integration
- [ ] Create helper functions for common test scenarios

### Phase 2: EstablishSittingClosenessHandler Tests
- [ ] Implement constructor and dependency validation tests
- [ ] Implement parameter validation tests
- [ ] Implement adjacent detection tests
- [ ] Implement closeness creation tests
- [ ] Implement error handling tests

### Phase 3: RemoveSittingClosenessHandler Tests
- [ ] Implement parameter validation tests
- [ ] Implement former adjacent detection tests
- [ ] Implement selective removal tests
- [ ] Implement circle repair tests
- [ ] Implement component cleanup tests

### Phase 4: Performance and Integration
- [ ] Implement performance benchmark tests
- [ ] Implement memory leak prevention tests
- [ ] Test service integration points
- [ ] Verify error event dispatching

## Definition of Done
- [ ] Both handler test files created with comprehensive coverage
- [ ] 100% function coverage and ≥95% line coverage achieved
- [ ] All error scenarios and edge cases tested
- [ ] Service integration properly mocked and tested
- [ ] Performance benchmarks meet requirements (<50ms per operation)
- [ ] Memory leak tests pass (no excessive memory growth)
- [ ] Mock utilities created and reusable for other tests
- [ ] All tests pass consistently in local and CI environments
- [ ] Test code follows project standards and conventions
- [ ] Integration with existing test bed utilities verified