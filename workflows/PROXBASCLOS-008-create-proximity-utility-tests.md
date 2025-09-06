# PROXBASCLOS-008: Create Unit Tests for Proximity Utilities

**Phase**: Testing Layer  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-001 (proximity utilities)  
**Estimated Time**: 4-5 hours

## Summary

Create comprehensive unit tests for the proximity utility functions to ensure correct adjacency calculations, occupant detection, and parameter validation. These tests form the foundation for validating the core logic used by the operation handlers.

## Technical Requirements

### File to Create
- `tests/unit/utils/proximityUtils.test.js`

### Test Coverage Requirements

#### Core Functions to Test
1. **`getAdjacentSpots(spotIndex, totalSpots)`** - Adjacency calculation logic
2. **`findAdjacentOccupants(furnitureComponent, spotIndex)`** - Occupant detection
3. **`validateProximityParameters(furnitureId, actorId, spotIndex, logger)`** - Parameter validation

#### Coverage Targets
- **Branch Coverage**: 100% (all code paths tested)
- **Function Coverage**: 100% (all functions tested)
- **Line Coverage**: 95%+ (high line coverage standard)
- **Edge Cases**: All edge cases and error scenarios covered

## Test Structure and Implementation

### Test File Organization

#### Import Section
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  getAdjacentSpots, 
  findAdjacentOccupants, 
  validateProximityParameters 
} from '../../../src/utils/proximityUtils.js';
import { createTestBed } from '../../common/testBed.js';
```

#### Test Suite Structure
```javascript
describe('ProximityUtils', () => {
  let testBed;
  
  beforeEach(() => {
    testBed = createTestBed();
  });
  
  afterEach(() => {
    testBed.cleanup();
  });
  
  describe('getAdjacentSpots', () => {
    // Adjacency calculation tests
  });
  
  describe('findAdjacentOccupants', () => {
    // Occupant detection tests
  });
  
  describe('validateProximityParameters', () => {
    // Parameter validation tests
  });
});
```

### Test Cases for `getAdjacentSpots()`

#### Basic Adjacency Tests
```javascript
describe('getAdjacentSpots - Basic Adjacency', () => {
  it('should return both adjacent spots for middle position', () => {
    const result = getAdjacentSpots(1, 3);
    expect(result).toEqual([0, 2]);
  });
  
  it('should return only right adjacent for first spot', () => {
    const result = getAdjacentSpots(0, 3);
    expect(result).toEqual([1]);
  });
  
  it('should return only left adjacent for last spot', () => {
    const result = getAdjacentSpots(2, 3);
    expect(result).toEqual([1]);
  });
  
  it('should return adjacent spots in ascending order', () => {
    const result = getAdjacentSpots(4, 7);
    expect(result).toEqual([3, 5]);
    expect(result).toBeSorted();
  });
});
```

#### Edge Cases and Boundary Conditions
```javascript
describe('getAdjacentSpots - Edge Cases', () => {
  it('should return empty array for single-spot furniture', () => {
    const result = getAdjacentSpots(0, 1);
    expect(result).toEqual([]);
  });
  
  it('should handle two-spot furniture correctly', () => {
    expect(getAdjacentSpots(0, 2)).toEqual([1]);
    expect(getAdjacentSpots(1, 2)).toEqual([0]);
  });
  
  it('should handle maximum furniture size (10 spots)', () => {
    expect(getAdjacentSpots(0, 10)).toEqual([1]);
    expect(getAdjacentSpots(5, 10)).toEqual([4, 6]);
    expect(getAdjacentSpots(9, 10)).toEqual([8]);
  });
});
```

#### Error Handling and Validation
```javascript
describe('getAdjacentSpots - Error Handling', () => {
  it('should throw error for negative spot index', () => {
    expect(() => getAdjacentSpots(-1, 3)).toThrow('Spot index must be non-negative');
  });
  
  it('should throw error for spot index >= total spots', () => {
    expect(() => getAdjacentSpots(3, 3)).toThrow('Spot index must be less than total spots');
  });
  
  it('should throw error for zero total spots', () => {
    expect(() => getAdjacentSpots(0, 0)).toThrow('Total spots must be positive');
  });
  
  it('should throw error for non-integer parameters', () => {
    expect(() => getAdjacentSpots(1.5, 3)).toThrow('Spot index must be an integer');
    expect(() => getAdjacentSpots(1, 3.5)).toThrow('Total spots must be an integer');
  });
});
```

### Test Cases for `findAdjacentOccupants()`

#### Occupant Detection Tests
```javascript
describe('findAdjacentOccupants - Occupant Detection', () => {
  it('should find single adjacent occupant', () => {
    const furnitureComponent = {
      spots: ['game:alice', null, null]
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 1);
    expect(result).toEqual(['game:alice']);
  });
  
  it('should find multiple adjacent occupants', () => {
    const furnitureComponent = {
      spots: ['game:alice', null, 'game:charlie']
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 1);
    expect(result).toEqual(['game:alice', 'game:charlie']);
  });
  
  it('should return empty array when no adjacent occupants', () => {
    const furnitureComponent = {
      spots: [null, 'game:bob', null]
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 1);
    expect(result).toEqual([]);
  });
  
  it('should filter out null values from adjacent spots', () => {
    const furnitureComponent = {
      spots: ['game:alice', null, null, 'game:diana']
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 2);
    expect(result).toEqual(['game:diana']); // spot 1 is null, spot 3 has Diana
  });
});
```

#### Complex Furniture Scenarios
```javascript
describe('findAdjacentOccupants - Complex Scenarios', () => {
  it('should handle fully occupied furniture', () => {
    const furnitureComponent = {
      spots: ['game:alice', 'game:bob', 'game:charlie', 'game:diana']
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 1);
    expect(result).toEqual(['game:alice', 'game:charlie']);
  });
  
  it('should handle sparse occupancy patterns', () => {
    const furnitureComponent = {
      spots: ['game:alice', null, null, null, 'game:eve', null]
    };
    
    const result = findAdjacentOccupants(furnitureComponent, 4);
    expect(result).toEqual([]); // spots 3 and 5 are both null
  });
  
  it('should handle maximum furniture size correctly', () => {
    const spots = new Array(10).fill(null);
    spots[0] = 'game:alice';
    spots[2] = 'game:charlie';
    spots[8] = 'game:helen';
    spots[9] = 'game:ivan';
    
    const furnitureComponent = { spots };
    
    expect(findAdjacentOccupants(furnitureComponent, 1)).toEqual(['game:alice', 'game:charlie']);
    expect(findAdjacentOccupants(furnitureComponent, 8)).toEqual(['game:ivan']); // spot 7 is null
  });
});
```

#### Error Handling for Invalid Input
```javascript
describe('findAdjacentOccupants - Error Handling', () => {
  it('should throw error for missing furniture component', () => {
    expect(() => findAdjacentOccupants(null, 1)).toThrow('Furniture component is required');
  });
  
  it('should throw error for missing spots array', () => {
    const furnitureComponent = {};
    expect(() => findAdjacentOccupants(furnitureComponent, 1)).toThrow('Furniture component must have spots array');
  });
  
  it('should throw error for empty spots array', () => {
    const furnitureComponent = { spots: [] };
    expect(() => findAdjacentOccupants(furnitureComponent, 0)).toThrow('Spots array cannot be empty');
  });
  
  it('should throw error for invalid spot index', () => {
    const furnitureComponent = { spots: [null, null, null] };
    expect(() => findAdjacentOccupants(furnitureComponent, -1)).toThrow('Invalid spot index');
    expect(() => findAdjacentOccupants(furnitureComponent, 3)).toThrow('Spot index out of bounds');
  });
});
```

### Test Cases for `validateProximityParameters()`

#### Valid Parameter Validation
```javascript
describe('validateProximityParameters - Valid Parameters', () => {
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = testBed.createMockLogger();
  });
  
  it('should validate correct parameters without throwing', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', 'game:alice', 2, mockLogger);
    }).not.toThrow();
  });
  
  it('should handle zero spot index', () => {
    expect(() => {
      validateProximityParameters('furniture:chair', 'game:bob', 0, mockLogger);
    }).not.toThrow();
  });
  
  it('should handle maximum spot index (9)', () => {
    expect(() => {
      validateProximityParameters('furniture:bench', 'game:charlie', 9, mockLogger);
    }).not.toThrow();
  });
});
```

#### Invalid Parameter Detection
```javascript
describe('validateProximityParameters - Invalid Parameters', () => {
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = testBed.createMockLogger();
  });
  
  it('should throw for null furniture ID', () => {
    expect(() => {
      validateProximityParameters(null, 'game:alice', 1, mockLogger);
    }).toThrow('Furniture ID is required');
    
    expect(mockLogger.error).toHaveBeenCalledWith('Parameter validation failed', expect.any(Object));
  });
  
  it('should throw for blank furniture ID', () => {
    expect(() => {
      validateProximityParameters('', 'game:alice', 1, mockLogger);
    }).toThrow('Furniture ID cannot be blank');
  });
  
  it('should throw for invalid furniture ID format', () => {
    expect(() => {
      validateProximityParameters('invalid-id', 'game:alice', 1, mockLogger);
    }).toThrow('Furniture ID must be in format modId:identifier');
  });
  
  it('should throw for null actor ID', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', null, 1, mockLogger);
    }).toThrow('Actor ID is required');
  });
  
  it('should throw for invalid actor ID format', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', 'invalid-actor', 1, mockLogger);
    }).toThrow('Actor ID must be in format modId:identifier');
  });
  
  it('should throw for negative spot index', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', 'game:alice', -1, mockLogger);
    }).toThrow('Spot index must be non-negative');
  });
  
  it('should throw for non-integer spot index', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', 'game:alice', 1.5, mockLogger);
    }).toThrow('Spot index must be an integer');
  });
  
  it('should throw for missing logger', () => {
    expect(() => {
      validateProximityParameters('furniture:couch', 'game:alice', 1, null);
    }).toThrow('Logger is required');
  });
});
```

#### Logger Integration Tests
```javascript
describe('validateProximityParameters - Logger Integration', () => {
  it('should log validation success at debug level', () => {
    const mockLogger = testBed.createMockLogger();
    
    validateProximityParameters('furniture:couch', 'game:alice', 1, mockLogger);
    
    expect(mockLogger.debug).toHaveBeenCalledWith('Proximity parameters validated successfully', {
      furnitureId: 'furniture:couch',
      actorId: 'game:alice',
      spotIndex: 1
    });
  });
  
  it('should log validation errors with context', () => {
    const mockLogger = testBed.createMockLogger();
    
    try {
      validateProximityParameters(null, 'game:alice', 1, mockLogger);
    } catch (error) {
      // Expected to throw
    }
    
    expect(mockLogger.error).toHaveBeenCalledWith('Parameter validation failed', {
      furnitureId: null,
      actorId: 'game:alice',
      spotIndex: 1,
      error: expect.any(String)
    });
  });
});
```

## Performance and Memory Tests

### Performance Benchmarks
```javascript
describe('ProximityUtils - Performance', () => {
  it('should execute getAdjacentSpots quickly', () => {
    const startTime = performance.now();
    
    for (let i = 0; i < 10000; i++) {
      getAdjacentSpots(Math.floor(Math.random() * 10), 10);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100); // Should complete 10k operations in <100ms
  });
  
  it('should not create memory leaks in repeated calls', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 1000; i++) {
      const furnitureComponent = { spots: new Array(10).fill(null) };
      furnitureComponent.spots[0] = 'game:alice';
      furnitureComponent.spots[2] = 'game:charlie';
      
      findAdjacentOccupants(furnitureComponent, 1);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    expect(memoryIncrease).toBeLessThan(1024 * 1024); // Should not increase by more than 1MB
  });
});
```

## Test Data and Mock Utilities

### Test Data Factory
```javascript
// Helper functions for creating test data
function createFurnitureComponent(occupants) {
  return {
    spots: occupants
  };
}

function createFullFurniture(size = 5) {
  const spots = [];
  for (let i = 0; i < size; i++) {
    spots.push(`game:actor_${i}`);
  }
  return { spots };
}

function createSparseFurniture(size = 5, occupiedIndices = [0, 2]) {
  const spots = new Array(size).fill(null);
  occupiedIndices.forEach(index => {
    spots[index] = `game:actor_${index}`;
  });
  return { spots };
}
```

### Mock Logger Utilities
```javascript
function createMockLoggerWithAssertion() {
  const mockLogger = testBed.createMockLogger();
  
  mockLogger.assertDebugCalled = (expectedMessage, expectedContext) => {
    expect(mockLogger.debug).toHaveBeenCalledWith(expectedMessage, expectedContext);
  };
  
  mockLogger.assertErrorCalled = (expectedMessage) => {
    expect(mockLogger.error).toHaveBeenCalledWith(expectedMessage, expect.any(Object));
  };
  
  return mockLogger;
}
```

## Implementation Checklist

### Phase 1: Test Structure Setup
- [ ] Create test file with proper imports and structure
- [ ] Set up test bed integration for mock utilities
- [ ] Create helper functions for test data generation
- [ ] Implement mock logger utilities

### Phase 2: Core Function Tests
- [ ] Implement all `getAdjacentSpots()` test cases
- [ ] Implement all `findAdjacentOccupants()` test cases  
- [ ] Implement all `validateProximityParameters()` test cases
- [ ] Verify 100% function coverage

### Phase 3: Edge Cases and Error Handling
- [ ] Test all boundary conditions and edge cases
- [ ] Test all error scenarios with proper exception handling
- [ ] Test parameter validation with various invalid inputs
- [ ] Verify error messages are descriptive and helpful

### Phase 4: Performance and Integration
- [ ] Implement performance benchmark tests
- [ ] Test memory usage and leak prevention
- [ ] Test logger integration and proper context
- [ ] Verify all tests pass consistently

## Acceptance Criteria

### Code Coverage Requirements
- [ ] **Branch Coverage**: 100% (all conditional paths tested)
- [ ] **Function Coverage**: 100% (all exported functions tested)
- [ ] **Line Coverage**: ≥95% (comprehensive line coverage)
- [ ] **Statement Coverage**: ≥95% (all statements executed in tests)

### Test Quality Requirements
- [ ] **Descriptive Test Names**: All tests have clear, descriptive names explaining what they test
- [ ] **Isolated Tests**: Each test is independent and doesn't rely on others
- [ ] **Fast Execution**: All tests complete in <100ms total
- [ ] **Deterministic**: Tests produce same results on every run

### Error Handling Requirements
- [ ] **Exception Testing**: All error conditions tested with proper exception expectations
- [ ] **Error Messages**: Error message clarity and usefulness validated
- [ ] **Logger Integration**: Error logging tested with proper context
- [ ] **Graceful Degradation**: Invalid input handling doesn't cause crashes

### Integration Requirements
- [ ] **TestBed Usage**: Proper integration with existing test utilities
- [ ] **Mock Utilities**: Effective use of mock loggers and test helpers
- [ ] **Project Standards**: Tests follow existing project testing patterns
- [ ] **CI/CD Compatibility**: Tests run successfully in continuous integration environment

## Definition of Done
- [ ] All test cases implemented with comprehensive coverage
- [ ] 100% function coverage and ≥95% line coverage achieved
- [ ] All edge cases and error scenarios tested
- [ ] Performance benchmarks meet requirements (<100ms for 10k operations)
- [ ] Memory leak tests pass (no excessive memory growth)
- [ ] Tests integrate properly with existing test bed utilities
- [ ] All tests pass consistently in local and CI environments
- [ ] Test code follows project standards and conventions
- [ ] Documentation updated with testing approach and coverage details