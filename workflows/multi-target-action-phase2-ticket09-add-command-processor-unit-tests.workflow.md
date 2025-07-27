# Ticket 09: Add Command Processor Unit Tests

## Overview

Create comprehensive unit tests for the enhanced CommandProcessor to ensure multi-target functionality works correctly, backward compatibility is maintained, and performance requirements are met. This includes testing the integration between the CommandProcessor and the new multi-target services.

## Dependencies

- Ticket 07: Implement Multi-Target Data Extraction (must be completed)
- Ticket 08: Update Attempt Action Payload Creation (must be completed)

## Blocks

- Ticket 10: Implement Backward Compatibility Layer
- Ticket 14: Comprehensive Integration Testing

## Priority: High

## Estimated Time: 8-10 hours

## Background

The enhanced CommandProcessor now includes multi-target data extraction and payload creation capabilities. Comprehensive testing is critical to ensure the new functionality works correctly while maintaining compatibility with existing single-target actions and meeting performance requirements.

## Implementation Details

### 1. Create Comprehensive CommandProcessor Tests

**File**: `tests/unit/commands/commandProcessor.multiTarget.test.js`

```javascript
/**
 * @file Comprehensive tests for CommandProcessor multi-target functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import TargetExtractionService from '../../../src/services/targetExtractionService.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';

describe('CommandProcessor - Multi-Target Functionality', () => {
  let testBed;
  let commandProcessor;
  let mockEventBus;
  let mockLogger;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();
    
    // Create comprehensive mocks
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMockEventBus();
    
    commandProcessor = new CommandProcessor({ 
      logger: mockLogger, 
      eventBus: mockEventBus 
    });
    
    mockActor = {
      id: 'test_actor_123',
      name: 'Test Actor',
      components: new Map()
    };
  });

  afterEach(() => {
    testBed.cleanup();
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
            tool: ['shield_012']
          }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      expect(payload.targets).toEqual({
        target: 'goblin_456',
        weapon: 'sword_123', // First option selected
        tool: 'shield_012'
      });

      expect(payload.targetId).toBe('goblin_456'); // Primary target
      expect(payload.eventName).toBe('core:attempt_action');
      expect(payload.actorId).toBe('test_actor_123');
      expect(payload.actionId).toBe('combat:complex_attack');
    });

    it('should handle mixed target formats in targetIds', async () => {
      const turnAction = {
        actionDefinitionId: 'interaction:give',
        commandString: 'give coin to merchant',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: 'coin_123', // String format
            recipient: ['merchant_456'], // Array format
            location: [] // Empty array
          }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      expect(payload.targets).toEqual({
        item: 'coin_123',
        recipient: 'merchant_456'
        // location should be omitted due to empty array
      });

      expect(payload.targetId).toBe('merchant_456'); // 'recipient' preferred as primary
    });

    it('should handle single target through multi-target path', async () => {
      const turnAction = {
        actionDefinitionId: 'core:examine',
        commandString: 'examine book',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['book_123']
          }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      // Single target should not create targets object
      expect(payload.targets).toBeUndefined();
      expect(payload.targetId).toBe('book_123');
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
            output_container: ['chest_012']
          }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      expect(payload.targets).toEqual({
        primary_material: 'iron_ore_123',
        secondary_material: 'coal_456',
        crafting_station: 'forge_789',
        output_container: 'chest_012'
      });

      expect(payload.targetId).toBe('iron_ore_123'); // First alphabetically in absence of standard patterns
    });
  });

  describe('Legacy Compatibility Testing', () => {
    it('should process legacy single-target actions unchanged', async () => {
      const turnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789'
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      // Verify exact legacy format
      expect(payload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'test_actor_123',
        actionId: 'core:follow',
        targetId: 'alice_789',
        originalInput: 'follow Alice',
        timestamp: expect.any(Number)
      });

      // Ensure no additional fields
      expect(Object.keys(payload)).toHaveLength(6);
      expect(payload.targets).toBeUndefined();
    });

    it('should handle legacy actions with null targets', async () => {
      const turnAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {
          targetId: null
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      expect(payload.targetId).toBe(null);
      expect(payload.targets).toBeUndefined();
      expect(payload.originalInput).toBe('smile');
    });

    it('should handle legacy actions without resolved parameters', async () => {
      const turnAction = {
        actionDefinitionId: 'core:rest',
        commandString: 'rest',
        resolvedParameters: {}
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      expect(payload.targetId).toBe(null);
      expect(payload.targets).toBeUndefined();
    });

    it('should maintain performance parity with legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'core:move',
        commandString: 'move north',
        resolvedParameters: {
          targetId: 'north_exit_123'
        }
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor._testCreateAttemptActionPayload(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(5); // Should average less than 5ms
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
            '123numeric': ['target_789']
          }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      // Should extract valid targets only
      expect(payload.targets).toEqual({
        invalid: 'valid_target_123',
        'bad-name': 'target_456',
        '123numeric': 'target_789'
      });

      expect(payload.targetId).toBe('valid_target_123'); // First valid target
    });

    it('should handle extraction service failures gracefully', async () => {
      // Mock extraction service to throw error
      const originalService = commandProcessor._targetExtractionService;
      commandProcessor._targetExtractionService = {
        extractTargets: jest.fn().mockRejectedValue(new Error('Extraction failed'))
      };

      const turnAction = {
        actionDefinitionId: 'test:failing',
        commandString: 'failing action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: { target: ['target_123'] }
        }
      };

      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);

      // Should create fallback payload
      expect(payload.eventName).toBe('core:attempt_action');
      expect(payload.actorId).toBe('test_actor_123');
      expect(payload.actionId).toBe('test:failing');

      // Restore original service
      commandProcessor._targetExtractionService = originalService;
    });

    it('should validate required inputs and provide clear errors', async () => {
      // Test invalid actor
      await expect(
        commandProcessor._testCreateAttemptActionPayload(null, {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {}
        })
      ).rejects.toThrow('Valid actor with ID is required');

      // Test actor without ID
      await expect(
        commandProcessor._testCreateAttemptActionPayload({}, {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {}
        })
      ).rejects.toThrow('Valid actor with ID is required');

      // Test invalid turn action
      await expect(
        commandProcessor._testCreateAttemptActionPayload(mockActor, null)
      ).rejects.toThrow('Valid turn action with actionDefinitionId is required');

      // Test turn action without actionDefinitionId
      await expect(
        commandProcessor._testCreateAttemptActionPayload(mockActor, {
          commandString: 'test',
          resolvedParameters: {}
        })
      ).rejects.toThrow('Valid turn action with actionDefinitionId is required');
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
          targetIds: largeTargetIds
        }
      };

      const startTime = performance.now();
      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, turnAction);
      const duration = performance.now() - startTime;

      expect(Object.keys(payload.targets)).toHaveLength(50);
      expect(duration).toBeLessThan(20); // Should handle large sets efficiently
    });
  });

  describe('Performance and Metrics', () => {
    it('should track detailed performance metrics', async () => {
      const actions = [
        {
          actionDefinitionId: 'test:legacy1',
          commandString: 'legacy action 1',
          resolvedParameters: { targetId: 'target_1' }
        },
        {
          actionDefinitionId: 'test:multi1',
          commandString: 'multi action 1',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { item: ['item_1'], target: ['target_1'] }
          }
        },
        {
          actionDefinitionId: 'test:legacy2',
          commandString: 'legacy action 2',
          resolvedParameters: { targetId: 'target_2' }
        },
        {
          actionDefinitionId: 'test:multi2',
          commandString: 'multi action 2',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { 
              primary: ['primary_1'], 
              secondary: ['secondary_1'],
              tool: ['tool_1']
            }
          }
        }
      ];

      // Process multiple actions
      for (const action of actions) {
        await commandProcessor._testCreateAttemptActionPayload(mockActor, action);
      }

      const stats = commandProcessor._getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(4);
      expect(stats.multiTargetPayloads).toBe(2);
      expect(stats.legacyPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
      expect(stats.extractionStatistics).toBeDefined();
    });

    it('should meet performance targets for various scenarios', async () => {
      const scenarios = [
        {
          name: 'simple legacy',
          action: {
            actionDefinitionId: 'simple:legacy',
            commandString: 'simple',
            resolvedParameters: { targetId: 'target_1' }
          },
          maxTime: 5
        },
        {
          name: 'simple multi-target',
          action: {
            actionDefinitionId: 'simple:multi',
            commandString: 'simple multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: { item: ['item_1'], target: ['target_1'] }
            }
          },
          maxTime: 10
        },
        {
          name: 'complex multi-target',
          action: {
            actionDefinitionId: 'complex:multi',
            commandString: 'complex multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: {
                primary: ['p1'], secondary: ['s1'], tertiary: ['t1'],
                item1: ['i1'], item2: ['i2'], tool: ['tool1'], location: ['loc1']
              }
            }
          },
          maxTime: 15
        }
      ];

      for (const scenario of scenarios) {
        const startTime = performance.now();
        
        const payload = await commandProcessor._testCreateAttemptActionPayload(
          mockActor, 
          scenario.action
        );
        
        const duration = performance.now() - startTime;

        expect(payload).toBeDefined();
        expect(duration).toBeLessThan(scenario.maxTime);
        
        console.log(`${scenario.name}: ${duration.toFixed(2)}ms (target: <${scenario.maxTime}ms)`);
      }
    });

    it('should handle burst loads without performance degradation', async () => {
      const burstSize = 50;
      const actions = Array.from({ length: burstSize }, (_, i) => ({
        actionDefinitionId: `burst:action_${i}`,
        commandString: `burst action ${i}`,
        resolvedParameters: i % 2 === 0 
          ? { targetId: `target_${i}` }
          : {
              isMultiTarget: true,
              targetIds: { 
                item: [`item_${i}`], 
                target: [`target_${i}`] 
              }
            }
      }));

      const startTime = performance.now();
      const results = [];

      for (const action of actions) {
        const actionStart = performance.now();
        const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, action);
        const actionTime = performance.now() - actionStart;
        
        results.push({ payload, duration: actionTime });
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / burstSize;
      const maxTime = Math.max(...results.map(r => r.duration));

      expect(averageTime).toBeLessThan(10); // Average should be fast
      expect(maxTime).toBeLessThan(25); // Even slowest should be reasonable
      expect(results.every(r => r.payload)).toBe(true); // All should succeed
    });
  });

  describe('Integration with Event Bus', () => {
    it('should dispatch enhanced events correctly', async () => {
      const turnAction = {
        actionDefinitionId: 'integration:test',
        commandString: 'integration test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['item_123'],
            target: ['target_456']
          }
        }
      };

      // Mock the process method to test full integration
      await commandProcessor.processCommand(mockActor, turnAction);

      // Verify event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: 'test_actor_123',
          actionId: 'integration:test',
          targets: {
            item: 'item_123',
            target: 'target_456'
          },
          targetId: 'target_456'
        })
      );
    });

    it('should maintain event dispatch format for legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'integration:legacy',
        commandString: 'legacy integration test',
        resolvedParameters: {
          targetId: 'legacy_target_123'
        }
      };

      await commandProcessor.processCommand(mockActor, legacyAction);

      // Verify legacy event format
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: 'test_actor_123',
          actionId: 'integration:legacy',
          targetId: 'legacy_target_123'
        })
      );

      // Verify no targets object for legacy
      const dispatchedEvent = mockEventBus.dispatch.mock.calls[0][0];
      expect(dispatchedEvent.targets).toBeUndefined();
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
      name: 'Compatibility Test Actor'
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
          resolvedParameters: { targetId: 'alice_123' }
        },
        {
          actionDefinitionId: 'core:attack',
          commandString: 'attack goblin',
          resolvedParameters: { targetId: 'goblin_456' }
        },
        {
          actionDefinitionId: 'core:examine',
          commandString: 'examine book',
          resolvedParameters: { targetId: 'book_789' }
        },
        {
          actionDefinitionId: 'core:emote',
          commandString: 'smile',
          resolvedParameters: { targetId: null }
        }
      ];

      for (const action of legacyActions) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, action);

        // Verify exact legacy structure
        expect(payload).toMatchObject({
          eventName: 'core:attempt_action',
          actorId: 'compatibility_actor',
          actionId: action.actionDefinitionId,
          targetId: action.resolvedParameters.targetId,
          originalInput: action.commandString,
          timestamp: expect.any(Number)
        });

        // Verify no extra fields
        const expectedKeys = ['eventName', 'actorId', 'actionId', 'targetId', 'originalInput', 'timestamp'];
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
        { targetId: 'core:namespaced_target', expected: 'core:namespaced_target' }
      ];

      for (const variation of targetVariations) {
        const action = {
          actionDefinitionId: 'test:target_variation',
          commandString: 'test action',
          resolvedParameters: { targetId: variation.targetId }
        };

        const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, action);

        expect(payload.targetId).toBe(variation.expected);
        expect(payload.targets).toBeUndefined();
      }
    });

    it('should maintain exact timestamp behavior', async () => {
      const action = {
        actionDefinitionId: 'test:timestamp',
        commandString: 'timestamp test',
        resolvedParameters: { targetId: 'target_123' }
      };

      const beforeTime = Date.now();
      const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, action);
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
        resolvedParameters: { targetId: 'target_123' }
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor._testCreateAttemptActionPayload(mockActor, legacyAction);
      }

      // Measure performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor._testCreateAttemptActionPayload(mockActor, legacyAction);
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
        resolvedParameters: { targetId: 'target_123' }
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Create many payloads
      for (let i = 0; i < 1000; i++) {
        await commandProcessor._testCreateAttemptActionPayload(mockActor, action);
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
            resolvedParameters: { targetId: 'target_123' }
          },
          expectedInput: 'test:missing_command'
        },
        {
          name: 'missing resolvedParameters',
          action: {
            actionDefinitionId: 'test:missing_params',
            commandString: 'test command'
          },
          expectedTargetId: null
        },
        {
          name: 'empty resolvedParameters',
          action: {
            actionDefinitionId: 'test:empty_params',
            commandString: 'test command',
            resolvedParameters: {}
          },
          expectedTargetId: null
        }
      ];

      for (const edgeCase of edgeCases) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, edgeCase.action);

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
          resolvedParameters: { targetId: 123 } // Number instead of string
        },
        {
          actionDefinitionId: 'test:malformed2',
          commandString: 'test',
          resolvedParameters: { targetId: {} } // Object instead of string
        },
        {
          actionDefinitionId: 'test:malformed3',
          commandString: 'test',
          resolvedParameters: { targetId: ['array'] } // Array instead of string
        }
      ];

      for (const malformedCase of malformedCases) {
        const payload = await commandProcessor._testCreateAttemptActionPayload(mockActor, malformedCase);

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
        eventBus: mockEventBus 
      });

      const legacyAction = {
        actionDefinitionId: 'compatibility:dispatch',
        commandString: 'dispatch test',
        resolvedParameters: { targetId: 'target_123' }
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
        timestamp: expect.any(Number)
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
import { TestBedClass } from '../common/testbed.js';
import { PerformanceTestBase } from '../common/performanceTestBase.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';

describe('CommandProcessor - Performance Benchmarks', () => {
  let testBed;
  let performanceTest;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();
    performanceTest = new PerformanceTestBase('CommandProcessor Benchmarks');
    
    commandProcessor = new CommandProcessor({
      logger: testBed.createMockLogger(),
      eventBus: testBed.createMockEventBus()
    });

    mockActor = { id: 'perf_actor_123', name: 'Performance Actor' };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Payload Creation Performance', () => {
    it('should meet performance targets for legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'perf:legacy',
        commandString: 'performance test legacy',
        resolvedParameters: { targetId: 'target_123' }
      };

      const result = await performanceTest.runBenchmark(
        () => commandProcessor._testCreateAttemptActionPayload(mockActor, legacyAction),
        {
          iterations: 1000,
          warmupIterations: 100,
          description: 'Legacy Action Payload Creation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 2,      // 2ms mean
        maxP95Time: 5,       // 5ms P95
        maxP99Time: 10,      // 10ms P99
        maxErrorRate: 0,     // No errors allowed
        maxMemoryPerOp: 1024 // 1KB per operation
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
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
            tool: ['tool_789']
          }
        }
      };

      const result = await performanceTest.runBenchmark(
        () => commandProcessor._testCreateAttemptActionPayload(mockActor, multiTargetAction),
        {
          iterations: 1000,
          warmupIterations: 100,
          description: 'Multi-Target Action Payload Creation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 5,      // 5ms mean
        maxP95Time: 10,      // 10ms P95
        maxP99Time: 20,      // 20ms P99
        maxErrorRate: 0,     // No errors allowed
        maxMemoryPerOp: 2048 // 2KB per operation
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
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
            ally: ['ally_567']
          }
        }
      };

      const result = await performanceTest.runBenchmark(
        () => commandProcessor._testCreateAttemptActionPayload(mockActor, complexAction),
        {
          iterations: 500,
          warmupIterations: 50,
          description: 'Complex Multi-Target Action'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 10,     // 10ms mean for complex
        maxP95Time: 20,      // 20ms P95
        maxP99Time: 40,      // 40ms P99
        maxErrorRate: 0,
        maxMemoryPerOp: 4096 // 4KB for complex operations
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
    });
  });

  describe('Comparative Performance Analysis', () => {
    it('should not degrade legacy performance significantly', async () => {
      const legacyAction = {
        actionDefinitionId: 'compare:legacy',
        commandString: 'comparison test',
        resolvedParameters: { targetId: 'target_123' }
      };

      // Measure enhanced system performance
      const enhancedTest = new PerformanceTestBase('Enhanced System');
      await enhancedTest.runBenchmark(
        () => commandProcessor._testCreateAttemptActionPayload(mockActor, legacyAction),
        { iterations: 1000, description: 'Enhanced Legacy Performance' }
      );

      const enhancedMetrics = enhancedTest.getDetailedMetrics();

      // The enhanced system should be within 20% of baseline performance
      // This would ideally be compared against a baseline measurement
      expect(enhancedMetrics.timing.mean).toBeLessThan(3); // Should be very fast
      
      console.log('Enhanced system legacy performance:', enhancedMetrics.timing.mean.toFixed(2) + 'ms');
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
            targetId: count === 1 ? 'entity_1' : undefined
          }
        };

        const testRunner = new PerformanceTestBase(`Scaling Test - ${count} targets`);
        await testRunner.runBenchmark(
          () => commandProcessor._testCreateAttemptActionPayload(mockActor, action),
          { iterations: 200, description: `${count} targets` }
        );

        const metrics = testRunner.getDetailedMetrics();
        results.push({
          targetCount: count,
          meanTime: metrics.timing.mean,
          p95Time: metrics.timing.p95
        });
      }

      // Verify scaling is reasonable
      for (const result of results) {
        expect(result.meanTime).toBeLessThan(result.targetCount * 2); // Linear scaling assumption
        console.log(`${result.targetCount} targets: ${result.meanTime.toFixed(2)}ms mean`);
      }
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should not leak memory during extended operation', async () => {
      const actions = [
        {
          actionDefinitionId: 'memory:legacy',
          commandString: 'memory test legacy',
          resolvedParameters: { targetId: 'target_123' }
        },
        {
          actionDefinitionId: 'memory:multi',
          commandString: 'memory test multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
              tool: ['tool_789']
            }
          }
        }
      ];

      const initialMemory = process.memoryUsage().heapUsed;

      // Run many operations
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 100; i++) {
          const action = actions[i % actions.length];
          await commandProcessor._testCreateAttemptActionPayload(mockActor, action);
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
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB increase

      console.log(`Memory increase over 1000 operations: ${(memoryIncrease / 1024).toFixed(2)}KB`);
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

- **Benchmark targets**: <2ms legacy, <5ms multi-target, <10ms complex
- **Scaling analysis**: Performance vs target count relationship
- **Memory testing**: No leaks during extended operation
- **Comparative analysis**: No significant regression for legacy actions

### 3. Compatibility Testing

- **Exact format preservation**: Legacy payloads unchanged
- **Performance parity**: Legacy actions maintain or improve performance
- **Edge case handling**: Malformed legacy data handled gracefully

## Success Criteria

1. **Functionality**: >95% test coverage with all scenarios passing
2. **Performance**: All performance targets consistently met
3. **Compatibility**: 100% backward compatibility preservation
4. **Reliability**: Graceful handling of all error conditions
5. **Integration**: Seamless operation with existing event system

## Files Created

- `tests/unit/commands/commandProcessor.multiTarget.test.js`
- `tests/unit/commands/commandProcessor.compatibility.test.js`
- `tests/performance/commandProcessor.benchmark.test.js`

## Files Modified

- None (comprehensive testing only)

## Validation Steps

1. Run all CommandProcessor tests and verify 100% pass rate
2. Execute performance benchmarks and validate targets
3. Test backward compatibility scenarios extensively
4. Validate memory usage and leak detection
5. Test integration with existing event bus and services

## Notes

- Tests cover both positive and negative scenarios comprehensively
- Performance benchmarks establish baselines for monitoring
- Compatibility tests ensure no breaking changes to legacy functionality
- Memory testing prevents resource leaks during extended operation

## Risk Assessment

**Low Risk**: Comprehensive testing only, no production code changes. Tests validate that enhanced functionality works correctly while preserving existing behavior.

## Next Steps

After this ticket completion:
1. Move to Ticket 10: Implement Backward Compatibility Layer
2. Finalize Phase 2 with complete CommandProcessor enhancement
3. Begin Phase 3: Rules System Integration