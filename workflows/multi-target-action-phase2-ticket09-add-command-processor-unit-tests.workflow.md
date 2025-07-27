# Ticket 09: Add Command Processor Unit Tests

## Overview

Create comprehensive unit tests for the enhanced CommandProcessor to ensure multi-target functionality works correctly, backward compatibility is maintained, and performance requirements are met. This includes testing the integration between the CommandProcessor and the new multi-target services.

## Dependencies

- Ticket 07: Implement Multi-Target Data Extraction (completed - TargetExtractionResult.fromResolvedParameters implemented)
- Ticket 08: Update Attempt Action Payload Creation (completed - CommandProcessor enhanced with multi-target support)

## Blocks

- Ticket 10: Implement Backward Compatibility Layer
- Ticket 14: Comprehensive Integration Testing

## Priority: High

## Estimated Time: 8-10 hours

## Current State

The CommandProcessor has been enhanced with:
- Multi-target payload creation using TargetExtractionResult and MultiTargetEventBuilder
- Backward compatibility for legacy single-target actions
- Performance metrics tracking
- Fallback payload creation for error cases
- Basic test coverage in commandProcessor.enhanced.test.js

## Background

The enhanced CommandProcessor now includes multi-target data extraction and payload creation capabilities. Additional comprehensive testing is needed to ensure robustness, edge case handling, and performance requirements are met.

## Implementation Details

**Note**: The CommandProcessor has already been enhanced with multi-target support. The following test files provide additional comprehensive coverage beyond the existing commandProcessor.enhanced.test.js.

### 1. Create Additional Multi-Target Tests

**File**: `tests/unit/commands/commandProcessor.multiTarget.test.js`

```javascript
/**
 * @file Additional comprehensive tests for CommandProcessor multi-target functionality
 * @description Extends existing test coverage with edge cases and complex scenarios
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor - Additional Multi-Target Tests', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    mockActor = {
      id: 'test_actor_123',
      name: 'Test Actor',
    };
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Target Data Extraction Integration', () => {
    it('should extract multi-target data from complex formatting results', async () => {
      const turnAction = {
        actionDefinitionId: 'combat:complex_attack',
        commandString: 'attack goblin with sword using shield',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            target: ['goblin_456'],
            weapon: ['sword_123', 'axe_789'], // Multiple options
            tool: ['shield_012'],
          },
        },
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: 'test_actor_123',
          actionId: 'combat:complex_attack',
          targetId: 'goblin_456', // Primary target
          targets: {
            target: 'goblin_456',
            weapon: 'sword_123', // First option selected
            tool: 'shield_012',
          },
          originalInput: 'attack goblin with sword using shield',
          timestamp: expect.any(Number),
        }),
        'ATTEMPT_ACTION_ID dispatch for pre-resolved action combat:complex_attack'
      );
    });

    it('should handle mixed target formats in targetIds', async () => {
      const turnAction = {
        actionDefinitionId: 'interaction:give',
        commandString: 'give coin to merchant',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: 'coin_123', // String format (invalid - should be array)
            recipient: ['merchant_456'], // Array format
            location: [], // Empty array
          },
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Note: TargetExtractionResult expects arrays, so string values may be ignored
      expect(dispatchedPayload.targets).toEqual({
        recipient: 'merchant_456',
        // item and location omitted - item due to invalid format, location due to empty array
      });

      expect(dispatchedPayload.targetId).toBe('merchant_456');
    });

    it('should handle single target through multi-target path', async () => {
      const turnAction = {
        actionDefinitionId: 'core:examine',
        commandString: 'examine book',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['book_123'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Single target still creates targets object with current implementation
      expect(dispatchedPayload.targets).toEqual({
        primary: 'book_123',
      });
      expect(dispatchedPayload.targetId).toBe('book_123');
    });

    it('should extract targets with complex category names', async () => {
      const turnAction = {
        actionDefinitionId: 'crafting:combine',
        commandString: 'combine materials to create item',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary_material: ['iron_ore_123'],
            secondary_material: ['coal_456'],
            crafting_station: ['forge_789'],
            output_container: ['chest_012'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targets).toEqual({
        primary_material: 'iron_ore_123',
        secondary_material: 'coal_456',
        crafting_station: 'forge_789',
        output_container: 'chest_012',
      });

      expect(dispatchedPayload.targetId).toBe('iron_ore_123'); // First target found
    });
  });

  describe('Legacy Compatibility Testing', () => {
    it('should process legacy single-target actions unchanged', async () => {
      const turnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789',
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Verify exact legacy format
      expect(dispatchedPayload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'test_actor_123',
        actionId: 'core:follow',
        targetId: 'alice_789',
        originalInput: 'follow Alice',
        timestamp: expect.any(Number),
      });

      // Ensure no additional fields
      expect(Object.keys(dispatchedPayload)).toHaveLength(6);
      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should handle legacy actions with null targets', async () => {
      const turnAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {
          targetId: null,
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();
      expect(dispatchedPayload.originalInput).toBe('smile');
    });

    it('should handle legacy actions without resolved parameters', async () => {
      const turnAction = {
        actionDefinitionId: 'core:rest',
        commandString: 'rest',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should maintain performance parity with legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'core:move',
        commandString: 'move north',
        resolvedParameters: {
          targetId: 'north_exit_123',
        },
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(50); // Should average less than 50ms
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed targetIds gracefully', async () => {
      const turnAction = {
        actionDefinitionId: 'test:malformed',
        commandString: 'malformed action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            invalid: [null, undefined, '', 'valid_target_123'],
            empty: [],
            'bad-name': ['target_456'],
            '123numeric': ['target_789'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Should extract valid targets only
      expect(dispatchedPayload.targets).toEqual({
        invalid: 'valid_target_123',
        'bad-name': 'target_456',
        '123numeric': 'target_789',
      });

      expect(dispatchedPayload.targetId).toBe('valid_target_123'); // First valid target
    });

    it('should handle extraction failures with fallback payload', async () => {
      // Create a turnAction that will cause the builder to fail
      const turnAction = {
        actionDefinitionId: 'test:failing',
        commandString: 'failing action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            target: [{}], // Invalid target structure
          },
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, turnAction);

      // Should still succeed with fallback payload
      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Fallback payload structure
      expect(dispatchedPayload.eventName).toBe('core:attempt_action');
      expect(dispatchedPayload.actorId).toBe('test_actor_123');
      expect(dispatchedPayload.actionId).toBe('test:failing');
      expect(dispatchedPayload.targetId).toBe(null);
    });

    it('should validate required inputs and provide clear errors', async () => {
      // Test invalid actor
      const result1 = await commandProcessor.dispatchAction(null, {
        actionDefinitionId: 'test:action',
        commandString: 'test',
        resolvedParameters: {},
      });
      
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Internal error: Malformed action prevented execution.');

      // Test actor without ID
      const result2 = await commandProcessor.dispatchAction({}, {
        actionDefinitionId: 'test:action',
        commandString: 'test',
        resolvedParameters: {},
      });
      
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Internal error: Malformed action prevented execution.');

      // Test invalid turn action
      const result3 = await commandProcessor.dispatchAction(mockActor, null);
      
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Internal error: Malformed action prevented execution.');

      // Test turn action without actionDefinitionId
      const result4 = await commandProcessor.dispatchAction(mockActor, {
        commandString: 'test',
        resolvedParameters: {},
      });
      
      expect(result4.success).toBe(false);
      expect(result4.error).toBe('Internal error: Malformed action prevented execution.');
    });

    it('should handle extremely large target sets', async () => {
      // Create action with many targets
      const largeTargetIds = {};
      for (let i = 1; i <= 50; i++) {
        largeTargetIds[`target_${i}`] = [`entity_${i}`];
      }

      const turnAction = {
        actionDefinitionId: 'test:large',
        commandString: 'action with many targets',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: largeTargetIds,
        },
      };

      const startTime = performance.now();
      const result = await commandProcessor.dispatchAction(mockActor, turnAction);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
      expect(Object.keys(dispatchedPayload.targets)).toHaveLength(50);
      expect(duration).toBeLessThan(200); // Should handle large sets efficiently
    });
  });

  describe('Performance and Metrics', () => {
    it('should track detailed performance metrics', async () => {
      const actions = [
        {
          actionDefinitionId: 'test:legacy1',
          commandString: 'legacy action 1',
          resolvedParameters: { targetId: 'target_1' },
        },
        {
          actionDefinitionId: 'test:multi1',
          commandString: 'multi action 1',
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
        {
          actionDefinitionId: 'test:multi2',
          commandString: 'multi action 2',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              primary: ['primary_1'],
              secondary: ['secondary_1'],
              tool: ['tool_1'],
            },
          },
        },
      ];

      // Process multiple actions
      for (const action of actions) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(4);
      expect(stats.multiTargetPayloads).toBe(2);
      expect(stats.legacyPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should meet performance targets for various scenarios', async () => {
      const scenarios = [
        {
          name: 'simple legacy',
          action: {
            actionDefinitionId: 'simple:legacy',
            commandString: 'simple',
            resolvedParameters: { targetId: 'target_1' },
          },
          maxTime: 5,
        },
        {
          name: 'simple multi-target',
          action: {
            actionDefinitionId: 'simple:multi',
            commandString: 'simple multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: { item: ['item_1'], target: ['target_1'] },
            },
          },
          maxTime: 10,
        },
        {
          name: 'complex multi-target',
          action: {
            actionDefinitionId: 'complex:multi',
            commandString: 'complex multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: {
                primary: ['p1'],
                secondary: ['s1'],
                tertiary: ['t1'],
                item1: ['i1'],
                item2: ['i2'],
                tool: ['tool1'],
                location: ['loc1'],
              },
            },
          },
          maxTime: 15,
        },
      ];

      for (const scenario of scenarios) {
        const startTime = performance.now();

        const result = await commandProcessor.dispatchAction(
          mockActor,
          scenario.action
        );

        const duration = performance.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(scenario.maxTime);
      }
    });

    it('should handle burst loads without performance degradation', async () => {
      const burstSize = 50;
      const actions = Array.from({ length: burstSize }, (_, i) => ({
        actionDefinitionId: `burst:action_${i}`,
        commandString: `burst action ${i}`,
        resolvedParameters:
          i % 2 === 0
            ? { targetId: `target_${i}` }
            : {
                isMultiTarget: true,
                targetIds: {
                  item: [`item_${i}`],
                  target: [`target_${i}`],
                },
              },
      }));

      const startTime = performance.now();
      const results = [];

      for (const action of actions) {
        const actionStart = performance.now();
        const result = await commandProcessor.dispatchAction(mockActor, action);
        const actionTime = performance.now() - actionStart;

        results.push({ result, duration: actionTime });
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / burstSize;
      const maxTime = Math.max(...results.map((r) => r.duration));

      expect(averageTime).toBeLessThan(100); // Average should be reasonable
      expect(maxTime).toBeLessThan(250); // Even slowest should be reasonable
      expect(results.every((r) => r.result.success)).toBe(true); // All should succeed
    });
  });
});
```

### 2. Create Backward Compatibility Test Suite

**File**: `tests/unit/commands/commandProcessor.compatibility.test.js`

```javascript
/**
 * @file Backward compatibility tests for CommandProcessor
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';

describe('CommandProcessor - Backward Compatibility', () => {
  let testBed;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();

    const logger = testBed.createMockLogger();
    const eventBus = testBed.createMockEventBus();

    commandProcessor = new CommandProcessor({ logger, eventBus });

    mockActor = {
      id: 'compatibility_actor',
      name: 'Compatibility Test Actor',
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Exact Legacy Format Preservation', () => {
    it('should preserve exact field structure for legacy actions', async () => {
      const legacyActions = [
        {
          actionDefinitionId: 'core:follow',
          commandString: 'follow Alice',
          resolvedParameters: { targetId: 'alice_123' },
        },
        {
          actionDefinitionId: 'core:attack',
          commandString: 'attack goblin',
          resolvedParameters: { targetId: 'goblin_456' },
        },
        {
          actionDefinitionId: 'core:examine',
          commandString: 'examine book',
          resolvedParameters: { targetId: 'book_789' },
        },
        {
          actionDefinitionId: 'core:emote',
          commandString: 'smile',
          resolvedParameters: { targetId: null },
        },
      ];

      for (const action of legacyActions) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          action
        );

        // Verify exact legacy structure
        expect(payload).toMatchObject({
          eventName: 'core:attempt_action',
          actorId: 'compatibility_actor',
          actionId: action.actionDefinitionId,
          targetId: action.resolvedParameters.targetId,
          originalInput: action.commandString,
          timestamp: expect.any(Number),
        });

        // Verify no extra fields
        const expectedKeys = [
          'eventName',
          'actorId',
          'actionId',
          'targetId',
          'originalInput',
          'timestamp',
        ];
        expect(Object.keys(payload).sort()).toEqual(expectedKeys.sort());

        // Verify no targets object
        expect(payload.targets).toBeUndefined();
      }
    });

    it('should handle all legacy targetId variations', async () => {
      const targetVariations = [
        { targetId: 'valid_target_123', expected: 'valid_target_123' },
        { targetId: null, expected: null },
        { targetId: undefined, expected: null },
        { targetId: '', expected: null },
        { targetId: '   ', expected: null },
        {
          targetId: 'core:namespaced_target',
          expected: 'core:namespaced_target',
        },
      ];

      for (const variation of targetVariations) {
        const action = {
          actionDefinitionId: 'test:target_variation',
          commandString: 'test action',
          resolvedParameters: { targetId: variation.targetId },
        };

        const payload = await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          action
        );

        expect(payload.targetId).toBe(variation.expected);
        expect(payload.targets).toBeUndefined();
      }
    });

    it('should maintain exact timestamp behavior', async () => {
      const action = {
        actionDefinitionId: 'test:timestamp',
        commandString: 'timestamp test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const beforeTime = Date.now();
      const payload = await commandProcessor._testCreateAttemptActionPayload(
        mockActor,
        action
      );
      const afterTime = Date.now();

      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('Legacy Performance Characteristics', () => {
    it('should maintain or improve legacy action performance', async () => {
      const legacyAction = {
        actionDefinitionId: 'performance:legacy',
        commandString: 'performance test',
        resolvedParameters: { targetId: 'target_123' },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          legacyAction
        );
      }

      // Measure performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          legacyAction
        );
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should be very fast for legacy actions
      expect(averageTime).toBeLessThan(2); // Less than 2ms average
    });

    it('should have consistent memory usage for legacy actions', async () => {
      const action = {
        actionDefinitionId: 'memory:test',
        commandString: 'memory test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Create many payloads
      for (let i = 0; i < 1000; i++) {
        await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          action
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not significantly increase memory for legacy actions
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
    });
  });

  describe('Edge Case Compatibility', () => {
    it('should handle legacy actions with missing fields', async () => {
      const edgeCases = [
        {
          name: 'missing commandString',
          action: {
            actionDefinitionId: 'test:missing_command',
            resolvedParameters: { targetId: 'target_123' },
          },
          expectedInput: 'test:missing_command',
        },
        {
          name: 'missing resolvedParameters',
          action: {
            actionDefinitionId: 'test:missing_params',
            commandString: 'test command',
          },
          expectedTargetId: null,
        },
        {
          name: 'empty resolvedParameters',
          action: {
            actionDefinitionId: 'test:empty_params',
            commandString: 'test command',
            resolvedParameters: {},
          },
          expectedTargetId: null,
        },
      ];

      for (const edgeCase of edgeCases) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          edgeCase.action
        );

        expect(payload.eventName).toBe('core:attempt_action');
        expect(payload.actorId).toBe('compatibility_actor');
        expect(payload.actionId).toBe(edgeCase.action.actionDefinitionId);

        if (edgeCase.expectedInput) {
          expect(payload.originalInput).toBe(edgeCase.expectedInput);
        }

        if (edgeCase.hasOwnProperty('expectedTargetId')) {
          expect(payload.targetId).toBe(edgeCase.expectedTargetId);
        }

        expect(payload.targets).toBeUndefined();
      }
    });

    it('should handle legacy actions with malformed data gracefully', async () => {
      const malformedCases = [
        {
          actionDefinitionId: 'test:malformed1',
          commandString: 'test',
          resolvedParameters: { targetId: 123 }, // Number instead of string
        },
        {
          actionDefinitionId: 'test:malformed2',
          commandString: 'test',
          resolvedParameters: { targetId: {} }, // Object instead of string
        },
        {
          actionDefinitionId: 'test:malformed3',
          commandString: 'test',
          resolvedParameters: { targetId: ['array'] }, // Array instead of string
        },
      ];

      for (const malformedCase of malformedCases) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(
          mockActor,
          malformedCase
        );

        expect(payload.eventName).toBe('core:attempt_action');
        expect(payload.targetId).toBe(null); // Should convert invalid to null
        expect(payload.targets).toBeUndefined();
      }
    });
  });

  describe('Event Bus Integration Compatibility', () => {
    it('should dispatch legacy events in exact same format', async () => {
      const mockEventBus = testBed.createMockEventBus();
      const processor = new CommandProcessor({
        logger: testBed.createMockLogger(),
        eventBus: mockEventBus,
      });

      const legacyAction = {
        actionDefinitionId: 'compatibility:dispatch',
        commandString: 'dispatch test',
        resolvedParameters: { targetId: 'target_123' },
      };

      await processor.processCommand(mockActor, legacyAction);

      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
      const dispatchedEvent = mockEventBus.dispatch.mock.calls[0][0];

      // Verify exact legacy event format
      expect(dispatchedEvent).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'compatibility_actor',
        actionId: 'compatibility:dispatch',
        targetId: 'target_123',
        originalInput: 'dispatch test',
        timestamp: expect.any(Number),
      });

      // Verify no additional fields
      expect(Object.keys(dispatchedEvent)).toHaveLength(6);
    });
  });
});
```

### 3. Create Performance Benchmark Tests

**File**: `tests/performance/commandProcessor.benchmark.test.js`

```javascript
/**
 * @file Performance benchmark tests for CommandProcessor
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPerformanceTestBed } from '../common/performanceTestBed.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import { safeDispatchError } from '../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor - Performance Benchmarks', () => {
  let performanceTestBed;
  let performanceTracker;
  let commandProcessor;
  let mockActor;
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;

  beforeEach(() => {
    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
    
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    mockActor = { id: 'perf_actor_123', name: 'Performance Actor' };
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    performanceTestBed.cleanup();
  });

  describe('Payload Creation Performance', () => {
    it('should meet performance targets for legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'perf:legacy',
        commandString: 'performance test legacy',
        resolvedParameters: { targetId: 'target_123' },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const benchmark = performanceTracker.startBenchmark('Legacy Action Performance', {
        trackMemory: true,
      });

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(50); // 50ms mean
      expect(metrics.totalTime).toBeLessThan(5000); // Total time under 5 seconds
    });

    it('should meet performance targets for multi-target actions', async () => {
      const multiTargetAction = {
        actionDefinitionId: 'perf:multi',
        commandString: 'performance test multi-target',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['item_123'],
            target: ['target_456'],
            tool: ['tool_789'],
          },
        },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, multiTargetAction);
      }

      const benchmark = performanceTracker.startBenchmark('Multi-Target Action Performance', {
        trackMemory: true,
      });

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, multiTargetAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(75); // 75ms mean for multi-target
      expect(metrics.totalTime).toBeLessThan(7500); // Total time under 7.5 seconds
    });

    it('should handle complex multi-target scenarios efficiently', async () => {
      const complexAction = {
        actionDefinitionId: 'perf:complex',
        commandString: 'complex performance test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary_target: ['primary_123'],
            secondary_target: ['secondary_456'],
            weapon: ['sword_789', 'axe_012'], // Multiple options
            tool: ['shield_345'],
            consumable: ['potion_678'],
            location: ['room_901'],
            container: ['chest_234'],
            ally: ['ally_567'],
          },
        },
      };

      const benchmark = performanceTracker.startBenchmark('Complex Multi-Target Action', {
        trackMemory: true,
      });

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, complexAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(100); // 100ms mean for complex
      expect(metrics.totalTime).toBeLessThan(5000); // Total time under 5 seconds
    });
  });

  describe('Comparative Performance Analysis', () => {
    it('should not degrade legacy performance significantly', async () => {
      const legacyAction = {
        actionDefinitionId: 'compare:legacy',
        commandString: 'comparison test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const benchmark = performanceTracker.startBenchmark('Enhanced Legacy Performance');
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      // The enhanced system should maintain reasonable performance
      expect(averageTime).toBeLessThan(50); // Should be fast
    });

    it('should scale efficiently with target count', async () => {
      const targetCounts = [1, 2, 5, 10, 20];
      const results = [];

      for (const count of targetCounts) {
        const targetIds = {};
        for (let i = 1; i <= count; i++) {
          targetIds[`target_${i}`] = [`entity_${i}`];
        }

        const action = {
          actionDefinitionId: 'scale:test',
          commandString: `scaling test with ${count} targets`,
          resolvedParameters: {
            isMultiTarget: count > 1,
            targetIds: count > 1 ? targetIds : undefined,
            targetId: count === 1 ? 'entity_1' : undefined,
          },
        };

        const benchmark = performanceTracker.startBenchmark(
          `Scaling Test - ${count} targets`
        );

        const iterations = 20;
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          await commandProcessor.dispatchAction(mockActor, action);
        }

        const endTime = performance.now();
        const metrics = benchmark.end();
        const averageTime = (endTime - startTime) / iterations;

        results.push({
          targetCount: count,
          meanTime: averageTime,
        });
      }

      // Verify scaling is reasonable
      for (const result of results) {
        expect(result.meanTime).toBeLessThan(result.targetCount * 50); // Reasonable scaling
      }
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should not leak memory during extended operation', async () => {
      const actions = [
        {
          actionDefinitionId: 'memory:legacy',
          commandString: 'memory test legacy',
          resolvedParameters: { targetId: 'target_123' },
        },
        {
          actionDefinitionId: 'memory:multi',
          commandString: 'memory test multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
              tool: ['tool_789'],
            },
          },
        },
      ];

      const initialMemory = process.memoryUsage().heapUsed;

      // Run many operations
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 100; i++) {
          const action = actions[i % actions.length];
          await commandProcessor.dispatchAction(mockActor, action);
        }

        // Periodic garbage collection
        if (global.gc && cycle % 2 === 0) {
          global.gc();
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory significantly
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });
});
```

## Testing Requirements

### 1. Comprehensive Unit Test Coverage

- **Multi-target functionality**: All extraction and payload creation scenarios
- **Legacy compatibility**: Exact format preservation and performance parity
- **Error handling**: Graceful failure and fallback mechanisms
- **Edge cases**: Malformed data, missing fields, extreme values
- **Integration**: Event bus dispatch and service coordination

### 2. Performance Testing

- **Benchmark targets**: <50ms legacy average, <75ms multi-target average, <100ms complex average
- **Scaling analysis**: Performance vs target count relationship
- **Memory testing**: No leaks during extended operation (<10MB increase)
- **Comparative analysis**: Maintain reasonable performance for all scenarios

### 3. Compatibility Testing

- **Exact format preservation**: Legacy payloads unchanged
- **Performance parity**: Legacy actions maintain reasonable performance
- **Edge case handling**: Malformed legacy data handled gracefully

## Success Criteria

1. **Functionality**: Comprehensive test coverage with all scenarios passing
2. **Performance**: All performance targets consistently met
3. **Compatibility**: 100% backward compatibility preservation
4. **Reliability**: Graceful handling of all error conditions
5. **Integration**: Seamless operation with existing event system

## Files to Create

- `tests/unit/commands/commandProcessor.multiTarget.test.js` - Additional comprehensive tests
- `tests/unit/commands/commandProcessor.compatibility.test.js` - Backward compatibility tests
- `tests/performance/commandProcessor.benchmark.test.js` - Performance benchmarks

## Current State

- CommandProcessor already enhanced with multi-target support
- Basic test coverage exists in `commandProcessor.enhanced.test.js`
- Performance metrics tracking implemented in CommandProcessor
- Fallback payload creation handles errors gracefully

## Implementation Notes

1. **Testing Approach**: Use `dispatchAction` method instead of internal methods
2. **Mock Setup**: Use consistent mock patterns with logger, safeEventDispatcher, and eventDispatchService
3. **Performance Testing**: Use performanceTestBed utilities for benchmarking
4. **Assertions**: Verify dispatched payloads from eventDispatchService mock calls

## Validation Steps

1. Run all CommandProcessor tests and verify pass rate
2. Execute performance benchmarks and validate targets
3. Test backward compatibility scenarios
4. Validate memory usage patterns
5. Test integration with existing event system

## Risk Assessment

**Low Risk**: Adding comprehensive test coverage to existing implementation. No production code changes required.

## Next Steps

After this ticket completion:

1. Review test coverage reports
2. Address any gaps in testing
3. Move to Ticket 10 if additional compatibility layer is needed
4. Document performance baselines for future monitoring
