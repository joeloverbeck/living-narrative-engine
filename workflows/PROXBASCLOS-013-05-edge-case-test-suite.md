# PROXBASCLOS-013-05: Edge Case Test Suite

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 5  
**Priority**: High  
**Complexity**: Medium-High  
**Dependencies**: PROXBASCLOS-013-01 through PROXBASCLOS-013-04  
**Estimated Time**: 2-3 hours

## Summary

Create a comprehensive edge case test suite that validates all the enhancements from previous tickets. This suite ensures the proximity-based closeness system handles malformed inputs, corrupted data, and extreme scenarios gracefully.

## Test File Structure

### Primary Test File
**New File**: `tests/unit/logic/operationHandlers/proximityEdgeCases.test.js`

This file will contain comprehensive edge case scenarios testing the integrated system.

### Supporting Test Updates
- Update existing handler tests to cover new validation paths
- Ensure all validators have their own test files with edge cases

## Test Categories

### 1. Input Validation Edge Cases

#### 1.1 Malformed Entity IDs
Test all invalid ID formats:
```javascript
describe('Input Validation Edge Cases', () => {
  describe('Malformed Entity IDs', () => {
    it('should handle malformed entity IDs gracefully', async () => {
      const invalidIds = [
        '',                    // Empty string
        '   ',                 // Whitespace only
        'no-colon',           // Missing namespace separator
        ':missing-mod',       // Missing mod ID
        'missing-id:',        // Missing identifier
        'mod::double-colon',  // Double colon
        'mod:id:extra',       // Extra colons
        'mod-dash:id',        // Invalid mod ID characters
        'mod:id@special',     // Invalid identifier characters
        null,                 // Null value
        undefined,            // Undefined value
        123,                  // Number
        {},                   // Object
        []                    // Array
      ];

      for (const invalidId of invalidIds) {
        await expect(handler.execute({
          furniture_id: invalidId,
          actor_id: 'game:alice',
          spot_index: 1
        }, executionContext)).rejects.toThrow(InvalidArgumentError);
        
        await expect(handler.execute({
          furniture_id: 'furniture:couch',
          actor_id: invalidId,
          spot_index: 1
        }, executionContext)).rejects.toThrow(InvalidArgumentError);
      }
    });
  });
});
```

#### 1.2 Extreme Spot Index Values
```javascript
describe('Spot Index Validation', () => {
  it('should handle extreme spot index values', async () => {
    const invalidSpotIndices = [
      -1,                   // Negative
      -999,                 // Large negative
      10,                   // Above maximum
      100,                  // Far above maximum
      1.5,                  // Decimal
      NaN,                  // Not a number
      Infinity,             // Infinity
      -Infinity,            // Negative infinity
      '0',                  // String number
      '1',                  // String number
      null,                 // Null
      undefined             // Undefined
    ];

    for (const invalidSpot of invalidSpotIndices) {
      await expect(handler.execute({
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: invalidSpot
      }, executionContext)).rejects.toThrow();
    }
  });
});
```

### 2. Component State Edge Cases

#### 2.1 Corrupted Component Data
```javascript
describe('Component State Edge Cases', () => {
  it('should handle corrupted furniture component', async () => {
    // Spots is not an array
    mockEntityManager.getComponentData.mockReturnValue({
      spots: 'not-an-array'
    });

    await expect(handler.execute({
      furniture_id: 'furniture:corrupted',
      actor_id: 'game:alice',
      spot_index: 1
    }, executionContext)).rejects.toThrow(InvalidArgumentError);
  });

  it('should handle furniture with empty spots array', async () => {
    mockEntityManager.getComponentData.mockReturnValue({
      spots: []
    });

    await expect(handler.execute({
      furniture_id: 'furniture:empty',
      actor_id: 'game:alice',
      spot_index: 0
    }, executionContext)).rejects.toThrow(InvalidArgumentError);
  });

  it('should handle furniture exceeding maximum capacity', async () => {
    mockEntityManager.getComponentData.mockReturnValue({
      spots: new Array(11).fill(null) // 11 spots (exceeds max of 10)
    });

    await expect(handler.execute({
      furniture_id: 'furniture:oversized',
      actor_id: 'game:alice',
      spot_index: 10
    }, executionContext)).rejects.toThrow(InvalidArgumentError);
  });
});
```

#### 2.2 Circular and Complex Relationships
```javascript
describe('Complex Relationship Scenarios', () => {
  it('should handle circular closeness references', async () => {
    // Setup circular reference: A → B → C → A
    mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:closeness') {
        switch (entityId) {
          case 'game:alice': return { partners: ['game:bob'] };
          case 'game:bob': return { partners: ['game:charlie'] };
          case 'game:charlie': return { partners: ['game:alice'] };
        }
      }
      if (componentType === 'positioning:allows_sitting') {
        return { spots: ['game:alice', 'game:bob', 'game:charlie'] };
      }
      return null;
    });

    // Should handle gracefully without infinite loops
    const result = await handler.execute({
      furniture_id: 'furniture:couch',
      actor_id: 'game:dave',
      spot_index: 3
    }, executionContext);

    expect(result.success).toBeDefined();
    // Verify no infinite loop occurred (test completes)
  });

  it('should handle self-referential closeness', async () => {
    mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:closeness' && entityId === 'game:alice') {
        return { partners: ['game:alice'] }; // Self-reference
      }
      return null;
    });

    const validator = new ComponentStateValidator(mockLogger);
    
    expect(() => {
      validator.validateClosenessComponent('game:alice', { 
        partners: ['game:alice'] 
      });
    }).toThrow(InvalidArgumentError);
  });
});
```

### 3. JavaScript Single-Threaded Model

#### 3.1 Sequential Operation Consistency
```javascript
describe('JavaScript Single-Threaded Model', () => {
  it('should handle sequential operations correctly', async () => {
    // JavaScript is single-threaded, operations are inherently atomic
    const operations = [];
    
    // Setup furniture with 3 spots
    mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        return { spots: [null, null, null] };
      }
      return null;
    });
    
    // Execute multiple operations in parallel
    for (let i = 0; i < 10; i++) {
      operations.push(handler.execute({
        furniture_id: 'furniture:shared',
        actor_id: `game:actor_${i}`,
        spot_index: i % 3
      }, executionContext).catch(err => ({ error: err })));
    }

    const results = await Promise.all(operations);
    
    // All operations should complete without data corruption
    results.forEach(result => {
      expect(result).toBeDefined();
      // Either success or controlled error
      expect(result.success !== undefined || result.error !== undefined).toBe(true);
    });
  });

  it('should maintain data consistency across async operations', async () => {
    const updateLog = [];
    
    // Track all component updates
    mockEntityManager.addComponent.mockImplementation((entityId, componentType, data) => {
      updateLog.push({ entityId, componentType, data, timestamp: Date.now() });
      return Promise.resolve();
    });

    // Execute operations that modify shared state
    await Promise.all([
      handler.execute({
        furniture_id: 'furniture:bench',
        actor_id: 'game:actor1',
        spot_index: 0
      }, executionContext),
      handler.execute({
        furniture_id: 'furniture:bench',
        actor_id: 'game:actor2',
        spot_index: 1
      }, executionContext)
    ]);

    // Verify updates occurred in sequence (timestamps should be different)
    const timestamps = updateLog.map(entry => entry.timestamp);
    const uniqueTimestamps = new Set(timestamps);
    expect(uniqueTimestamps.size).toBeGreaterThan(1);
  });
});
```

### 4. Edge Furniture Configurations

#### 4.1 Single-Spot Furniture
```javascript
describe('Edge Furniture Configurations', () => {
  it('should handle single-spot furniture correctly', async () => {
    mockEntityManager.getComponentData.mockReturnValue({
      spots: [null] // Single spot
    });

    const result = await handler.execute({
      furniture_id: 'furniture:stool',
      actor_id: 'game:alice',
      spot_index: 0
    }, executionContext);

    // Should succeed but establish no closeness (no adjacent spots)
    expect(result.success).toBe(true);
    expect(result.adjacentActors).toEqual([]);
  });

  it('should handle furniture at maximum capacity', async () => {
    const maxSpots = new Array(10).fill('game:actor');
    maxSpots[5] = null; // One empty spot
    
    mockEntityManager.getComponentData.mockReturnValue({
      spots: maxSpots
    });

    const result = await handler.execute({
      furniture_id: 'furniture:large-couch',
      actor_id: 'game:alice',
      spot_index: 5
    }, executionContext);

    expect(result.success).toBe(true);
    expect(result.adjacentActors).toHaveLength(2); // Actors at spots 4 and 6
  });
});
```

### 5. Error Recovery Scenarios

#### 5.1 Partial Failure Handling
```javascript
describe('Error Recovery Scenarios', () => {
  it('should recover from partial update failures', async () => {
    let callCount = 0;
    
    // Fail on third call
    mockEntityManager.addComponent.mockImplementation(() => {
      callCount++;
      if (callCount === 3) {
        return Promise.reject(new Error('Database error'));
      }
      return Promise.resolve();
    });

    const result = await handler.execute({
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 1
    }, executionContext);

    // Should handle the error gracefully
    expect(result.success).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should validate final state even after successful updates', async () => {
    // Setup successful updates but inconsistent final state
    mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:closeness') {
        // Return unidirectional relationship after update
        if (entityId === 'game:alice') {
          return { partners: ['game:bob'] };
        }
        if (entityId === 'game:bob') {
          return { partners: [] }; // Missing reverse relationship
        }
      }
      return null;
    });

    // Execute with final state validation
    const handler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: mockClosenessCircleService
    });

    // Should log warning about inconsistency but not throw
    await handler.execute({
      furniture_id: 'furniture:couch',
      actor_id: 'game:alice',
      spot_index: 1
    }, executionContext);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Final state validation failed'),
      expect.any(Object)
    );
  });
});
```

### 6. Boundary Conditions

#### 6.1 Null and Undefined Handling
```javascript
describe('Boundary Conditions', () => {
  it('should handle null closeness components gracefully', async () => {
    mockEntityManager.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:closeness') {
        return null; // No closeness component
      }
      if (componentType === 'positioning:allows_sitting') {
        return { spots: ['game:alice', null, 'game:bob'] };
      }
      return null;
    });

    const result = await handler.execute({
      furniture_id: 'furniture:bench',
      actor_id: 'game:charlie',
      spot_index: 1
    }, executionContext);

    expect(result.success).toBe(true);
  });

  it('should handle missing logger methods', () => {
    const invalidLoggers = [
      null,
      undefined,
      {},
      { info: 'not-a-function' },
      { info: jest.fn(), warn: jest.fn() }, // Missing error and debug
    ];

    for (const invalidLogger of invalidLoggers) {
      expect(() => {
        validateProximityParameters(
          'furniture:couch',
          'game:alice',
          1,
          invalidLogger
        );
      }).toThrow();
    }
  });
});
```

## Test Utilities

### Helper Functions
```javascript
// Test helper to create valid execution context
function createExecutionContext() {
  return {
    evaluationContext: {
      context: {}
    }
  };
}

// Helper to setup entity manager with realistic data
function setupEntityManager(scenario) {
  switch (scenario) {
    case 'empty-furniture':
      return {
        getComponentData: jest.fn().mockReturnValue({ spots: [] })
      };
    case 'full-furniture':
      return {
        getComponentData: jest.fn().mockReturnValue({ 
          spots: ['actor:1', 'actor:2', 'actor:3'] 
        })
      };
    // Add more scenarios
  }
}
```

## Acceptance Criteria

- [ ] **Malformed Input Tests**: All invalid input formats tested
- [ ] **Component Corruption Tests**: Handle corrupted component data
- [ ] **Relationship Edge Cases**: Circular and self-references handled
- [ ] **Concurrency Tests**: JavaScript single-threaded model verified
- [ ] **Furniture Configuration Tests**: Single-spot and max capacity tested
- [ ] **Error Recovery Tests**: Partial failures handled gracefully
- [ ] **Boundary Tests**: Null/undefined cases covered
- [ ] **Test Coverage**: 95%+ branch coverage for edge cases
- [ ] **Performance**: All tests complete in <5 seconds

## Files to Create/Modify

1. **Create**: `tests/unit/logic/operationHandlers/proximityEdgeCases.test.js`
2. **Update**: `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`
3. **Update**: `tests/unit/utils/proximityUtils.test.js`
4. **Update**: `tests/unit/utils/componentStateValidator.test.js`
5. **Update**: `tests/unit/utils/stateConsistencyValidator.test.js`

## Test Execution

Run tests with:
```bash
npm run test:unit tests/unit/logic/operationHandlers/proximityEdgeCases.test.js
npm run test:unit -- --coverage
```

## Definition of Done

- [ ] All edge case scenarios implemented
- [ ] Tests cover malformed inputs comprehensively
- [ ] Component corruption scenarios tested
- [ ] JavaScript execution model verified
- [ ] Error recovery validated
- [ ] All tests pass consistently
- [ ] Coverage report shows 95%+ for edge cases
- [ ] No flaky tests

## Notes for Implementation

- Use descriptive test names that explain the scenario
- Group related tests using describe blocks
- Include comments explaining why edge cases matter
- Mock external dependencies consistently
- Test both success and failure paths
- Verify error messages are helpful

## Next Steps

After completing this ticket, proceed to:
- **PROXBASCLOS-013-06**: Integration and Documentation (final integration)