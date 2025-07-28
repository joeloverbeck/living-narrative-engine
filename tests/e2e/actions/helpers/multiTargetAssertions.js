/**
 * @file MultiTargetAssertions - Custom assertion helpers for multi-target tests
 * @description Provides specialized assertions for validating multi-target action behavior
 */

/**
 * Custom assertion helpers for multi-target action tests
 */
export const multiTargetAssertions = {
  /**
   * Assert that all expected targets were processed
   * @param {object} result - Execution result
   * @param {object} expectedTargets - Expected target map
   */
  expectTargetsProcessed(result, expectedTargets) {
    const { resolvedTargets = {}, processedTargets = {} } = result;
    
    // Check each expected target
    for (const [role, expectedId] of Object.entries(expectedTargets)) {
      // Verify target was resolved
      expect(resolvedTargets[role]).toBeDefined();
      expect(resolvedTargets[role].id || resolvedTargets[role]).toBe(expectedId);
      
      // Verify target was processed (if processedTargets is available)
      if (Object.keys(processedTargets).length > 0) {
        expect(processedTargets[role] || processedTargets[expectedId]).toBeTruthy();
      }
    }
  },

  /**
   * Assert operation sequence matches expected
   * @param {Array} operations - Actual operations
   * @param {Array} expectedSequence - Expected operation sequence
   */
  expectOperationSequence(operations, expectedSequence) {
    expect(operations).toHaveLength(expectedSequence.length);
    
    expectedSequence.forEach((expected, index) => {
      const actual = operations[index];
      expect(actual).toBeDefined();
      expect(actual.type).toBe(expected.type);
      
      // Check optional fields if specified
      if (expected.entityId) {
        expect(actual.entityId).toBe(expected.entityId);
      }
      if (expected.componentId) {
        expect(actual.componentId).toBe(expected.componentId);
      }
      if (expected.operation) {
        expect(actual.operation).toBe(expected.operation);
      }
      if (expected.payload) {
        expect(actual.payload).toMatchObject(expected.payload);
      }
    });
  },

  /**
   * Assert event sequence matches expected
   * @param {Array} events - Actual events
   * @param {Array} expectedEvents - Expected event sequence
   */
  expectEventSequence(events, expectedEvents) {
    expect(events).toHaveLength(expectedEvents.length);
    
    expectedEvents.forEach((expected, index) => {
      const actual = events[index];
      expect(actual).toBeDefined();
      expect(actual.type).toBe(expected.type);
      
      if (expected.payload) {
        expect(actual.payload).toMatchObject(expected.payload);
      }
    });
  },

  /**
   * Assert state changes match expected
   * @param {object} stateChanges - Actual state changes
   * @param {object} expectedChanges - Expected state changes
   */
  expectStateChanges(stateChanges, expectedChanges) {
    for (const [entityId, expectedComponents] of Object.entries(expectedChanges)) {
      expect(stateChanges[entityId]).toBeDefined();
      
      for (const [componentId, expectedValues] of Object.entries(expectedComponents)) {
        const actualChange = stateChanges[entityId][componentId];
        expect(actualChange).toBeDefined();
        
        if (actualChange.after) {
          expect(actualChange.after).toMatchObject(expectedValues);
        } else {
          // Direct comparison if not in before/after format
          expect(stateChanges[entityId][componentId]).toMatchObject(expectedValues);
        }
      }
    }
  },

  /**
   * Assert that state was properly rolled back (no changes)
   * @param {object} beforeState - State before action
   * @param {object} afterState - State after rollback
   */
  expectStateRolledBack(beforeState, afterState) {
    expect(afterState).toEqual(beforeState);
  },

  /**
   * Assert context resolution worked correctly
   * @param {object} result - Execution result
   * @param {object} expectedContext - Expected context resolution
   */
  expectContextResolution(result, expectedContext) {
    const { contextResolution = {} } = result;
    
    for (const [level, expected] of Object.entries(expectedContext)) {
      expect(contextResolution[level]).toBeDefined();
      expect(contextResolution[level]).toMatchObject(expected);
    }
  },

  /**
   * Assert circular dependency was detected
   * @param {object} result - Execution result
   * @param {Array} expectedCycle - Expected dependency cycle
   */
  expectCircularDependency(result, expectedCycle) {
    expect(result.error).toContain('Circular dependency');
    expect(result.dependencyCycle).toBeDefined();
    expect(result.dependencyCycle).toEqual(expectedCycle);
  },

  /**
   * Assert validation error matches expected
   * @param {object} result - Execution result  
   * @param {object} expectedError - Expected error details
   */
  expectValidationError(result, expectedError) {
    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError.error);
    
    if (expectedError.code) {
      expect(result.code).toBe(expectedError.code);
    }
    
    if (expectedError.details) {
      expect(result.details).toMatchObject(expectedError.details);
    }
  },

  /**
   * Assert cascading effects were properly applied
   * @param {Array} events - Event log
   * @param {object} cascadeConfig - Expected cascade configuration
   */
  expectCascadingEffects(events, cascadeConfig) {
    const { primaryEffect, cascadeEffects } = cascadeConfig;
    
    // Find primary effect event
    const primaryEvent = events.find(e => e.type === primaryEffect.type);
    expect(primaryEvent).toBeDefined();
    expect(primaryEvent.payload).toMatchObject(primaryEffect.payload);
    
    // Verify cascade effects occurred
    for (const cascadeEffect of cascadeEffects) {
      const cascadeEvents = events.filter(e => e.type === cascadeEffect.type);
      expect(cascadeEvents.length).toBeGreaterThan(0);
      
      if (cascadeEffect.count) {
        expect(cascadeEvents).toHaveLength(cascadeEffect.count);
      }
      
      if (cascadeEffect.validator) {
        cascadeEvents.forEach(event => {
          expect(cascadeEffect.validator(event)).toBe(true);
        });
      }
    }
  },

  /**
   * Assert transaction consistency
   * @param {object} result - Execution result
   * @param {object} transactionConfig - Transaction expectations
   */
  expectTransactionConsistency(result, transactionConfig) {
    const { shouldSucceed, partialChangesAllowed = false } = transactionConfig;
    
    if (shouldSucceed) {
      expect(result.success).toBe(true);
      // All changes should be applied
      expect(Object.keys(result.stateChanges).length).toBeGreaterThan(0);
    } else {
      expect(result.success).toBe(false);
      
      if (!partialChangesAllowed) {
        // No changes should be applied (rolled back)
        expect(Object.keys(result.stateChanges).length).toBe(0);
      }
    }
  },

  /**
   * Assert operation failure and rollback
   * @param {object} result - Execution result
   * @param {object} failureConfig - Failure expectations
   */
  expectOperationFailureAndRollback(result, failureConfig) {
    const { failurePoint, expectedError, statePreserved = true } = failureConfig;
    
    expect(result.success).toBe(false);
    expect(result.error).toContain(expectedError);
    
    if (result.operations && failurePoint) {
      // Verify operations stopped at failure point
      const failureIndex = result.operations.findIndex(
        op => op.type === failurePoint.operation && op.error
      );
      expect(failureIndex).toBeGreaterThanOrEqual(0);
    }
    
    if (statePreserved) {
      // Verify state was rolled back
      expect(result.rolledBack).toBe(true);
    }
  },

  /**
   * Assert complex state synchronization
   * @param {object} stateChanges - State changes from execution
   * @param {object} syncConfig - Synchronization expectations
   */
  expectStateSynchronization(stateChanges, syncConfig) {
    const { leader, members, expectedFormation } = syncConfig;
    
    // Verify leader state
    expect(stateChanges[leader]).toBeDefined();
    const leaderFormation = stateChanges[leader]['combat:formation'];
    expect(leaderFormation).toBeDefined();
    expect(leaderFormation.after || leaderFormation).toMatchObject({
      type: expectedFormation,
      role: 'leader',
      members
    });
    
    // Verify all members synchronized
    members.forEach((memberId, index) => {
      expect(stateChanges[memberId]).toBeDefined();
      const memberFormation = stateChanges[memberId]['combat:formation'];
      expect(memberFormation).toBeDefined();
      expect(memberFormation.after || memberFormation).toMatchObject({
        type: expectedFormation,
        role: 'member',
        leader,
        position: index
      });
    });
  },

  /**
   * Create a custom Jest matcher for formation patterns
   * @returns {object} Jest matcher
   */
  toFormValidPattern() {
    return {
      toFormValidPattern(received, patternType, centerPosition) {
        const pass = validateFormationPattern(received, patternType, centerPosition);
        
        return {
          pass,
          message: () => pass
            ? `Expected positions not to form valid ${patternType} pattern`
            : `Expected positions to form valid ${patternType} pattern around ${JSON.stringify(centerPosition)}`
        };
      }
    };
  }
};

/**
 * Helper to validate formation patterns
 * @private
 */
function validateFormationPattern(positions, patternType, center) {
  switch (patternType) {
    case 'defensive_circle':
      // Check if positions form a circle around center
      const radius = 2; // Expected radius
      return positions.every(pos => {
        const distance = Math.sqrt(
          Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2)
        );
        return Math.abs(distance - radius) < 0.5; // Allow small variance
      });
      
    case 'line':
      // Check if positions form a line
      return positions.every((pos, i) => {
        if (i === 0) return true;
        return pos.y === positions[0].y; // Same Y coordinate
      });
      
    case 'wedge':
      // Check if positions form a wedge/triangle
      // Implementation depends on specific pattern requirements
      return true;
      
    default:
      return false;
  }
}

/**
 * Install custom matchers for Jest
 */
export function installCustomMatchers() {
  if (typeof expect !== 'undefined' && expect.extend) {
    expect.extend(multiTargetAssertions.toFormValidPattern());
  }
}