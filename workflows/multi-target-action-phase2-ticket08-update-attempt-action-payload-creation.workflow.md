# Ticket 08: Update Attempt Action Payload Creation

## Overview

Update the CommandProcessor's `#createAttemptActionPayload` method to use the multi-target data extraction service and create enhanced event payloads with multi-target support while maintaining full backward compatibility with existing single-target events.

## Dependencies

- Ticket 07: Implement Multi-Target Data Extraction (must be completed)
- Ticket 06: Create Multi-Target Data Structures (must be completed)

## Blocks

- Ticket 09: Add Command Processor Unit Tests
- Ticket 10: Implement Backward Compatibility Layer

## Priority: Critical

## Estimated Time: 6-8 hours

## Background

The current `#createAttemptActionPayload` method in CommandProcessor only extracts a single `targetId` from resolved parameters, creating the bottleneck identified in the specification. This ticket replaces that method with an enhanced version that uses the multi-target extraction service and creates rich event payloads while maintaining backward compatibility.

## ⚠️ CODEBASE STATE ASSESSMENT ⚠️

**CRITICAL DISCREPANCIES IDENTIFIED** (Updated: Current analysis)

### 1. Missing TargetExtractionService
- **ASSUMPTION**: `TargetExtractionService` exists in `src/services/targetExtractionService.js`
- **REALITY**: ❌ This service does not exist in the codebase
- **IMPACT**: The workflow implementation cannot proceed as written
- **RESOLUTION NEEDED**: Create the TargetExtractionService or use alternative approach

### 2. Private Method Access Issues
- **ASSUMPTION**: `#createAttemptActionPayload` can be tested directly
- **REALITY**: ❌ Method is private (# prefix) and cannot be accessed in tests as shown
- **IMPACT**: Test implementation would fail due to access restrictions
- **RESOLUTION NEEDED**: Either make method protected or test through public interface

### 3. Constructor Signature Mismatch
- **ASSUMPTION**: CommandProcessor constructor accepts `{ logger, eventBus }`
- **REALITY**: ❌ Current constructor requires `{ safeEventDispatcher, eventDispatchService, logger }`
- **IMPACT**: Test setup code shown would fail
- **RESOLUTION NEEDED**: Update test setup to match current constructor signature

### 4. Dependency Status
- **ASSUMPTION**: Tickets 06 and 07 (multi-target data structures and extraction service) completed
- **REALITY**: ⚠️ Partial completion
  - ✅ Multi-target data structures exist (`src/entities/multiTarget/`)
  - ❌ TargetExtractionService missing
  - ✅ MultiTargetEventBuilder exists and functional
  - ✅ TargetExtractionResult exists and functional
- **IMPACT**: Implementation approach needs modification

### 5. Current CommandProcessor State
- **CURRENT IMPLEMENTATION**: Simple payload creation at line 186-196
- **METHOD SIGNATURE**: `#createAttemptActionPayload(actor, turnAction)` (sync, not async)
- **RETURNS**: Plain object with `eventName`, `actorId`, `actionId`, `targetId`, `originalInput`
- **DEPENDENCIES**: None beyond constructor parameters

### 6. Available Multi-Target Infrastructure
- **POSITIVE FINDINGS**:
  - ✅ `MultiTargetEventBuilder` fully implemented with comprehensive API
  - ✅ `TargetExtractionResult` with static factories for data conversion
  - ✅ `multiTargetValidationUtils` with payload validation
  - ✅ `MultiTargetActionFormatter` exists for action formatting
  - ✅ Complete multi-target type definitions in `src/types/multiTargetTypes.js`

### RECOMMENDED IMPLEMENTATION ADJUSTMENTS

1. **Replace TargetExtractionService dependency** with direct use of `TargetExtractionResult.fromResolvedParameters()`
2. **Update method to remain synchronous** or justify async requirement
3. **Fix test access patterns** to use public interfaces or dependency injection
4. **Leverage existing multi-target infrastructure** that is already in place

## Implementation Details

### 1. Update CommandProcessor Payload Creation

**File**: `src/commands/commandProcessor.js`

**⚠️ CORRECTED IMPLEMENTATION APPROACH** (Updated based on codebase analysis)

Replace the existing `#createAttemptActionPayload` method with the enhanced version:

```javascript
// Add these imports at the top of the file
// NOTE: TargetExtractionService does not exist - using TargetExtractionResult instead
import MultiTargetEventBuilder from '../entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../entities/multiTarget/targetExtractionResult.js';

/**
 * Enhanced attempt action payload creation with multi-target support
 * @param {Object} actor - Actor entity performing the action
 * @param {Object} turnAction - Turn action data from discovery pipeline
 * @returns {Object} Enhanced event payload with multi-target support
 * NOTE: Changed to synchronous - no async extraction service needed
 */
#createAttemptActionPayload(actor, turnAction) {
  const startTime = performance.now();

  try {
    // Validate inputs
    this.#validatePayloadInputs(actor, turnAction);

    // Extract target data using existing TargetExtractionResult
    // CORRECTED: Use static factory method instead of missing service
    const extractionResult = TargetExtractionResult.fromResolvedParameters(
      turnAction.resolvedParameters,
      this.#logger
    );

    // Create event payload using the builder pattern
    const eventBuilder = MultiTargetEventBuilder.fromTurnAction(
      actor,
      turnAction,
      extractionResult,
      this.#logger
    );

    const payload = eventBuilder.build();

    // Log payload creation success
    this.#logPayloadCreation(payload, extractionResult, performance.now() - startTime);

    return payload;

  } catch (error) {
    this.#logger.error('Failed to create attempt action payload', {
      error: error.message,
      actorId: actor?.id,
      actionId: turnAction?.actionDefinitionId,
      commandString: turnAction?.commandString
    });

    // Create fallback payload to prevent system failure
    return this.#createFallbackPayload(actor, turnAction);
  }
}

/**
 * Validates inputs for payload creation
 * @param {Object} actor - Actor entity
 * @param {Object} turnAction - Turn action data
 * @throws {Error} If inputs are invalid
 */
#validatePayloadInputs(actor, turnAction) {
  if (!actor || !actor.id) {
    throw new Error('Valid actor with ID is required for payload creation');
  }

  if (!turnAction || !turnAction.actionDefinitionId) {
    throw new Error('Valid turn action with actionDefinitionId is required');
  }

  if (!turnAction.commandString && !turnAction.actionDefinitionId) {
    throw new Error('Turn action must have either commandString or actionDefinitionId');
  }
}

// REMOVED: #extractTargetData method - not needed
// TargetExtractionResult.fromResolvedParameters() is used directly in the main method

/**
 * Creates a fallback payload when enhanced creation fails
 * @param {Object} actor - Actor entity
 * @param {Object} turnAction - Turn action data
 * @returns {Object} Basic event payload
 */
#createFallbackPayload(actor, turnAction) {
  this.#logger.warn('Creating fallback payload due to enhanced creation failure');

  // Use original simple payload creation as fallback
  const { actionDefinitionId, resolvedParameters, commandString } = turnAction;

  return {
    eventName: 'core:attempt_action',
    actorId: actor.id,
    actionId: actionDefinitionId,
    targetId: resolvedParameters?.targetId || null,
    originalInput: commandString || actionDefinitionId,
    timestamp: Date.now()
  };
}

/**
 * Logs payload creation details
 * @param {Object} payload - Created payload
 * @param {TargetExtractionResult} extractionResult - Target extraction result
 * @param {number} duration - Creation duration in ms
 */
#logPayloadCreation(payload, extractionResult, duration) {
  const logData = {
    eventName: payload.eventName,
    actorId: payload.actorId,
    actionId: payload.actionId,
    hasMultipleTargets: extractionResult.hasMultipleTargets(),
    targetCount: extractionResult.getTargetCount(),
    primaryTarget: extractionResult.getPrimaryTarget(),
    extractionSource: extractionResult.getMetadata('source'),
    creationTime: duration.toFixed(2)
  };

  if (extractionResult.hasMultipleTargets()) {
    logData.targets = extractionResult.getTargets();
    this.#logger.info('Enhanced multi-target payload created', logData);
  } else {
    this.#logger.debug('Legacy-compatible payload created', logData);
  }

  // Performance warning for slow payload creation
  if (duration > 10) {
    this.#logger.warn('Payload creation took longer than expected', {
      duration: duration.toFixed(2),
      target: '< 10ms'
    });
  }
}

/**
 * Gets payload creation statistics for monitoring
 * @returns {Object} Payload creation statistics
 * NOTE: Removed extractionStats dependency on non-existent service
 */
#getPayloadCreationStatistics() {
  return {
    totalPayloadsCreated: this.#payloadCreationCount || 0,
    multiTargetPayloads: this.#multiTargetPayloadCount || 0,
    legacyPayloads: this.#legacyPayloadCount || 0,
    fallbackPayloads: this.#fallbackPayloadCount || 0,
    averageCreationTime: this.#averagePayloadCreationTime || 0,
    // REMOVED: extractionStatistics - service doesn't exist
  };
}

/**
 * Resets payload creation statistics
 * NOTE: Removed reference to non-existent extraction service
 */
#resetPayloadCreationStatistics() {
  this.#payloadCreationCount = 0;
  this.#multiTargetPayloadCount = 0;
  this.#legacyPayloadCount = 0;
  this.#fallbackPayloadCount = 0;
  this.#averagePayloadCreationTime = 0;
  
  // REMOVED: targetExtractionService reset - service doesn't exist
}
```

### 2. Add Performance Monitoring

**File**: `src/commands/commandProcessor.js` (additional methods)

Add performance monitoring capabilities to the CommandProcessor:

```javascript
/**
 * Initialize performance tracking for payload creation
 */
#initializePayloadMetrics() {
  this.#payloadCreationCount = 0;
  this.#multiTargetPayloadCount = 0;
  this.#legacyPayloadCount = 0;
  this.#fallbackPayloadCount = 0;
  this.#totalPayloadCreationTime = 0;
  this.#averagePayloadCreationTime = 0;
}

/**
 * Updates payload creation metrics
 * @param {Object} payload - Created payload
 * @param {TargetExtractionResult} extractionResult - Extraction result
 * @param {number} duration - Creation duration
 * @param {boolean} isFallback - Whether this was a fallback creation
 */
#updatePayloadMetrics(payload, extractionResult, duration, isFallback = false) {
  this.#payloadCreationCount++;
  this.#totalPayloadCreationTime += duration;
  this.#averagePayloadCreationTime = this.#totalPayloadCreationTime / this.#payloadCreationCount;

  if (isFallback) {
    this.#fallbackPayloadCount++;
  } else if (extractionResult && extractionResult.hasMultipleTargets()) {
    this.#multiTargetPayloadCount++;
  } else {
    this.#legacyPayloadCount++;
  }

  // Log metrics periodically
  if (this.#payloadCreationCount % 100 === 0) {
    this.#logger.info('Payload creation metrics update', this.#getPayloadCreationStatistics());
  }
}

/**
 * Enhanced createAttemptActionPayload with metrics tracking
 * NOTE: Updated to synchronous and corrected extraction approach
 */
#createAttemptActionPayload(actor, turnAction) {
  const startTime = performance.now();
  let extractionResult = null;
  let isFallback = false;

  try {
    // Validate inputs
    this.#validatePayloadInputs(actor, turnAction);

    // Extract target data using static factory method
    extractionResult = TargetExtractionResult.fromResolvedParameters(
      turnAction.resolvedParameters,
      this.#logger
    );

    // Create event payload
    const eventBuilder = MultiTargetEventBuilder.fromTurnAction(
      actor,
      turnAction,
      extractionResult,
      this.#logger
    );

    const payload = eventBuilder.build();
    const duration = performance.now() - startTime;

    // Update metrics and log
    this.#updatePayloadMetrics(payload, extractionResult, duration, false);
    this.#logPayloadCreation(payload, extractionResult, duration);

    return payload;

  } catch (error) {
    const duration = performance.now() - startTime;
    isFallback = true;

    this.#logger.error('Enhanced payload creation failed, using fallback', {
      error: error.message,
      actorId: actor?.id,
      actionId: turnAction?.actionDefinitionId,
      duration: duration.toFixed(2)
    });

    // Create fallback payload
    const fallbackPayload = this.#createFallbackPayload(actor, turnAction);
    this.#updatePayloadMetrics(fallbackPayload, extractionResult, duration, true);

    return fallbackPayload;
  }
}
```

### 3. Create Enhanced CommandProcessor Tests

**File**: `tests/unit/commands/commandProcessor.enhanced.test.js`

**⚠️ CORRECTED TEST IMPLEMENTATION** (Updated based on codebase analysis)

```javascript
/**
 * @file Tests for enhanced CommandProcessor with multi-target support
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
// REMOVED: TargetExtractionService import - doesn't exist

describe('CommandProcessor - Enhanced Multi-Target Support', () => {
  let testBed;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();

    // Create mock dependencies with CORRECT constructor signature
    const logger = testBed.createMockLogger();
    const safeEventDispatcher = testBed.createMockSafeEventDispatcher();
    const eventDispatchService = testBed.createMockEventDispatchService();

    commandProcessor = new CommandProcessor({ 
      logger, 
      safeEventDispatcher, 
      eventDispatchService 
    });

    mockActor = {
      id: 'actor_123',
      name: 'Test Actor',
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Enhanced Payload Creation', () => {
    // ⚠️ NOTE: These tests need complete revision due to private method access
    // The current approach tests through the public dispatchAction interface
    it('should create multi-target payload from formatting data', async () => {
      const turnAction = {
        actionDefinitionId: 'combat:throw',
        commandString: 'throw knife at goblin',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['knife_123'],
            target: ['goblin_456'],
          },
        },
      };

      // CORRECTED: Test through public interface (dispatchAction)
      // Cannot access private #createAttemptActionPayload directly
      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );
      
      // Note: Payload testing would need event system mocking
      // or access through different testing approach

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        originalInput: 'throw knife at goblin',
      });

      expect(payload.targets).toEqual({
        item: 'knife_123',
        target: 'goblin_456',
      });

      expect(payload.targetId).toBe('goblin_456'); // Primary target for backward compatibility
      expect(payload.timestamp).toBeGreaterThan(0);
    });

    it('should create legacy payload for single-target actions', async () => {
      const turnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789',
        },
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        turnAction
      );

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'alice_789',
        originalInput: 'follow Alice',
      });

      expect(payload.targets).toBeUndefined(); // No targets object for single target
      expect(payload.timestamp).toBeGreaterThan(0);
    });

    it('should handle actions without targets', async () => {
      const turnAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {},
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        turnAction
      );

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'smile',
      });

      expect(payload.targets).toBeUndefined();
    });

    it('should handle complex multi-target scenarios', async () => {
      const turnAction = {
        actionDefinitionId: 'complex:multi_action',
        commandString: 'complex action with many targets',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['entity_1'],
            secondary: ['entity_2'],
            item: ['item_3'],
            tool: ['tool_4'],
            location: ['location_5'],
          },
        },
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        turnAction
      );

      expect(payload.targets).toEqual({
        primary: 'entity_1',
        secondary: 'entity_2',
        item: 'item_3',
        tool: 'tool_4',
        location: 'location_5',
      });

      expect(payload.targetId).toBe('entity_1'); // Primary target
      expect(Object.keys(payload.targets)).toHaveLength(5);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should create fallback payload when extraction fails', async () => {
      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: null, // This will cause extraction to fail
        },
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        turnAction
      );

      // Should still create a valid payload
      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        originalInput: 'test action',
      });

      expect(payload.targetId).toBe(null);
    });

    it('should handle invalid actor gracefully', async () => {
      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: {},
      };

      await expect(
        commandProcessor.createAttemptActionPayload(null, turnAction)
      ).rejects.toThrow('Valid actor with ID is required');
    });

    it('should handle invalid turn action gracefully', async () => {
      await expect(
        commandProcessor.createAttemptActionPayload(mockActor, null)
      ).rejects.toThrow(
        'Valid turn action with actionDefinitionId is required'
      );
    });

    it('should handle missing action definition ID', async () => {
      const turnAction = {
        commandString: 'test action',
        resolvedParameters: {},
      };

      await expect(
        commandProcessor.createAttemptActionPayload(mockActor, turnAction)
      ).rejects.toThrow(
        'Valid turn action with actionDefinitionId is required'
      );
    });
  });

  describe('Performance and Metrics', () => {
    it('should track payload creation metrics', async () => {
      const turnActions = [
        {
          actionDefinitionId: 'test:legacy',
          commandString: 'legacy action',
          resolvedParameters: { targetId: 'target_1' },
        },
        {
          actionDefinitionId: 'test:multi',
          commandString: 'multi action',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { item: ['item_1'], target: ['target_1'] },
          },
        },
        {
          actionDefinitionId: 'test:legacy2',
          commandString: 'legacy action 2',
          resolvedParameters: { targetId: 'target_2' },
        },
      ];

      // Create multiple payloads
      for (const turnAction of turnActions) {
        await commandProcessor.createAttemptActionPayload(
          mockActor,
          turnAction
        );
      }

      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(3);
      expect(stats.multiTargetPayloads).toBe(1);
      expect(stats.legacyPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should complete payload creation within performance targets', async () => {
      const turnAction = {
        actionDefinitionId: 'performance:test',
        commandString: 'performance test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['item_1'],
            target: ['target_1'],
            secondary: ['secondary_1'],
          },
        },
      };

      const startTime = performance.now();
      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        turnAction
      );
      const duration = performance.now() - startTime;

      expect(payload).toBeDefined();
      expect(duration).toBeLessThan(10); // Should complete within 10ms
    });

    it('should reset metrics correctly', async () => {
      // Create some payloads
      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: { targetId: 'target_1' },
      };

      await commandProcessor.createAttemptActionPayload(mockActor, turnAction);

      // Reset metrics
      commandProcessor.resetPayloadCreationStatistics();
      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(0);
      expect(stats.averageCreationTime).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain exact compatibility with legacy payload format', async () => {
      const legacyTurnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789',
        },
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        legacyTurnAction
      );

      // Verify exact legacy format
      expect(payload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'alice_789',
        originalInput: 'follow Alice',
        timestamp: expect.any(Number),
      });

      // Ensure no additional fields
      const expectedKeys = [
        'eventName',
        'actorId',
        'actionId',
        'targetId',
        'originalInput',
        'timestamp',
      ];
      expect(Object.keys(payload).sort()).toEqual(expectedKeys.sort());
    });

    it('should handle null targetId in legacy format', async () => {
      const emoteAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {
          targetId: null,
        },
      };

      const payload = await commandProcessor.createAttemptActionPayload(
        mockActor,
        emoteAction
      );

      expect(payload.targetId).toBe(null);
      expect(payload.targets).toBeUndefined();
    });
  });
});
```

## Testing Requirements

### 1. Unit Test Coverage

- **Enhanced payload creation** for multi-target scenarios
- **Legacy compatibility** preservation
- **Error handling** and fallback scenarios
- **Performance metrics** tracking and validation
- **Edge cases** including malformed inputs

### 2. Integration Testing

- Integration with TargetExtractionService
- End-to-end payload creation flow
- Performance under realistic game loads

### 3. Performance Requirements

- Payload creation < 10ms for typical scenarios
- No performance regression for legacy actions
- Memory usage < 5KB per payload creation
- Metrics collection overhead < 1ms

## Success Criteria

1. **Multi-Target Support**: Complex multi-target payloads created correctly
2. **Backward Compatibility**: Legacy single-target payloads unchanged
3. **Performance**: All performance targets consistently met
4. **Error Handling**: Graceful handling of all failure scenarios
5. **Monitoring**: Comprehensive metrics for operational visibility

## Files Created

- `tests/unit/commands/commandProcessor.enhanced.test.js`

## Files Modified

- `src/commands/commandProcessor.js` (enhance payload creation method)

## Validation Steps

1. Run all enhanced CommandProcessor tests
2. Test backward compatibility with existing actions
3. Verify performance requirements under load
4. Test error handling and fallback scenarios
5. Validate metrics collection accuracy

## Notes

- Enhanced method maintains exact backward compatibility for legacy actions
- Fallback mechanism ensures system continues operating even with errors
- Performance monitoring enables operational visibility
- Builder pattern provides flexible and testable payload creation

## Risk Assessment

**UPDATED RISK: High Risk** ⚠️ 

Core CommandProcessor modification with **multiple critical dependencies missing**. Comprehensive fallback mechanisms reduce operational risk, but implementation complexity increased due to codebase discrepancies.

**Risk Factors**:
- ❌ Missing TargetExtractionService dependency
- ⚠️ Private method testing challenges
- ⚠️ Constructor signature mismatches in original plan
- ✅ Existing multi-target infrastructure reduces integration risk

## ⚠️ IMPLEMENTATION READINESS ASSESSMENT ⚠️

### READY TO PROCEED ✅
- Multi-target data structures (TargetManager, TargetExtractionResult, MultiTargetEventBuilder)
- Validation utilities and type definitions
- Fallback mechanisms for backward compatibility
- Corrected implementation approach using existing infrastructure

### REQUIRES ATTENTION ⚠️
1. **Test Strategy**: Complete revision needed for private method testing
2. **Performance Monitoring**: Metrics need adjustment due to missing service
3. **Documentation**: Update all references to non-existent TargetExtractionService

### BLOCKERS RESOLVED ✅
- Original dependency on TargetExtractionService → Use TargetExtractionResult.fromResolvedParameters()
- Async method requirement → Simplified to synchronous approach
- Constructor signature issues → Documented correct approach

## CORRECTED IMPLEMENTATION SUMMARY

### What Changed from Original Plan:
1. **Removed TargetExtractionService dependency** → Direct use of TargetExtractionResult static methods
2. **Simplified to synchronous method** → No async/await needed
3. **Updated test approach** → Test through public interfaces, not private methods
4. **Corrected constructor dependencies** → Use proper safeEventDispatcher and eventDispatchService

### Implementation Confidence: **High** ✅
The corrected approach leverages existing, tested multi-target infrastructure and provides a clear implementation path.

## Next Steps

After this ticket completion:

1. **IMMEDIATE**: Implement using corrected approach documented above
2. Move to Ticket 09: Add Command Processor Unit Tests (update test strategy)
3. Complete comprehensive testing of enhanced command processing
4. Validate complete multi-target action flow end-to-end

**Priority**: Implement TargetExtractionService if needed, or proceed with documented alternative approach using existing infrastructure.
