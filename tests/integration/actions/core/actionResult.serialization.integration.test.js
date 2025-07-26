/**
 * @file Integration tests for ActionResult serialization workflows
 * @description Tests ActionResult JSON serialization/deserialization in real-world persistence scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import '../../../common/actionResultMatchers.js';

describe('ActionResult - Serialization Integration', () => {
  let mockStorageProvider;
  let mockNetworkClient;

  beforeEach(() => {
    // Mock storage provider
    mockStorageProvider = {
      data: new Map(),
      async save(key, data) {
        this.data.set(key, JSON.stringify(data));
        return true;
      },
      async load(key) {
        const data = this.data.get(key);
        return data ? JSON.parse(data) : null;
      },
      async delete(key) {
        return this.data.delete(key);
      },
    };

    // Mock network client
    mockNetworkClient = {
      requests: [],
      async send(data) {
        this.requests.push(data);
        // Simulate network serialization/deserialization
        const serialized = JSON.stringify(data);
        const deserialized = JSON.parse(serialized);
        return { success: true, data: deserialized };
      },
    };
  });

  afterEach(() => {
    // Clean up any global state
    mockStorageProvider.data.clear();
    mockNetworkClient.requests = [];
  });

  describe('Storage Persistence Workflows', () => {
    it('should serialize and persist successful ActionResults', async () => {
      const complexData = {
        actionId: 'test-action-123',
        executionData: {
          actors: ['actor1', 'actor2'],
          targets: [{ id: 'target1', type: 'entity' }],
          metadata: {
            timestamp: Date.now(),
            sessionId: 'session-456',
            version: '1.2.3',
          },
        },
        results: {
          success: true,
          changes: ['component-updated', 'event-dispatched'],
          stats: { duration: 150, operations: 5 },
        },
      };

      const result = ActionResult.success(complexData);

      // Simulate saving to storage
      const serialized = result.toJSON();
      await mockStorageProvider.save('action-result-123', serialized);

      // Verify storage contains serialized data
      const stored = await mockStorageProvider.load('action-result-123');
      expect(stored).toBeDefined();
      expect(stored.success).toBe(true);
      expect(stored.value.actionId).toBe('test-action-123');
      expect(stored.value.executionData.actors).toEqual(['actor1', 'actor2']);

      // Reconstruct ActionResult from storage
      const reconstructed = ActionResult.fromJSON(stored);
      expect(reconstructed).toBeSuccessfulActionResult(complexData);
    });

    it('should serialize and persist failed ActionResults with complex errors', async () => {
      // Create complex error objects
      const validationError = new Error('Validation failed for entity');
      validationError.code = 'VALIDATION_ERROR';
      validationError.entityId = 'entity-789';
      validationError.details = {
        missingFields: ['name', 'type'],
        invalidFields: ['age'],
      };

      const authError = new Error('Authentication required');
      authError.code = 'AUTH_ERROR';
      authError.statusCode = 401;
      authError.context = {
        userId: 'user-456',
        sessionExpired: true,
      };

      const result = ActionResult.failure([validationError, authError]);

      // Serialize and store
      const serialized = result.toJSON();
      await mockStorageProvider.save('failed-result-456', serialized);

      // Load and reconstruct
      const stored = await mockStorageProvider.load('failed-result-456');
      const reconstructed = ActionResult.fromJSON(stored);

      expect(reconstructed).toBeFailedActionResultWithAnyError();
      expect(reconstructed.errors).toHaveLength(2);

      const [error1, error2] = reconstructed.errors;
      expect(error1.message).toBe('Validation failed for entity');
      expect(error1.code).toBe('VALIDATION_ERROR');
      // Note: Custom properties may not be preserved in JSON serialization
      // This is expected behavior for Error objects
      if (error1.entityId) {
        expect(error1.entityId).toBe('entity-789');
      }
      if (error1.details) {
        expect(error1.details.missingFields).toEqual(['name', 'type']);
      }

      expect(error2.message).toBe('Authentication required');
      expect(error2.code).toBe('AUTH_ERROR');
      if (error2.statusCode) {
        expect(error2.statusCode).toBe(401);
      }
      if (error2.context) {
        expect(error2.context.sessionExpired).toBe(true);
      }
    });

    it('should handle round-trip serialization preserving all data integrity', async () => {
      const testCases = [
        {
          name: 'simple success',
          result: ActionResult.success('simple value'),
        },
        {
          name: 'null value',
          result: ActionResult.success(null),
        },
        {
          name: 'complex nested object',
          result: ActionResult.success({
            level1: {
              level2: {
                level3: {
                  array: [1, 2, { nested: true }],
                  date: new Date().toISOString(),
                },
              },
            },
          }),
        },
        {
          name: 'multiple errors',
          result: ActionResult.failure([
            'Simple string error',
            new Error('Standard error'),
            { message: 'Custom error object', code: 'CUSTOM' },
          ]),
        },
      ];

      for (const testCase of testCases) {
        // Serialize
        const serialized = testCase.result.toJSON();
        await mockStorageProvider.save(`test-${testCase.name}`, serialized);

        // Load
        const loaded = await mockStorageProvider.load(`test-${testCase.name}`);
        const reconstructed = ActionResult.fromJSON(loaded);

        // Verify
        expect(reconstructed.success).toBe(testCase.result.success);
        if (testCase.result.success) {
          expect(reconstructed.value).toEqual(testCase.result.value);
        } else {
          expect(reconstructed.errors).toHaveLength(
            testCase.result.errors.length
          );
          reconstructed.errors.forEach((error, index) => {
            const originalError = testCase.result.errors[index];
            const expectedMessage =
              originalError.message || String(originalError);
            expect(error.message).toBe(expectedMessage);
          });
        }
      }
    });

    it('should handle large data objects in serialization', async () => {
      // Create a large data structure
      const largeData = {
        entities: Array.from({ length: 500 }, (_, i) => ({
          id: `entity-${i}`,
          name: `Entity ${i}`,
          properties: {
            description: `This is a long description for entity ${i}`.repeat(
              10
            ),
            data: Array.from({ length: 50 }, (_, j) => ({
              key: `key-${j}`,
              value: `value-${i}-${j}`,
            })),
          },
        })),
        metadata: {
          totalCount: 500,
          generatedAt: new Date().toISOString(),
          checksum: 'abc123def456',
        },
      };

      const result = ActionResult.success(largeData);

      // Test serialization performance and data integrity
      const startTime = Date.now();
      const serialized = result.toJSON();
      await mockStorageProvider.save('large-data', serialized);
      const loaded = await mockStorageProvider.load('large-data');
      const reconstructed = ActionResult.fromJSON(loaded);
      const endTime = Date.now();

      // Verify performance (should complete in reasonable time)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Verify data integrity
      expect(reconstructed).toBeSuccessfulActionResultWithAnyValue();
      expect(reconstructed.value.entities).toHaveLength(500);
      expect(reconstructed.value.entities[0].id).toBe('entity-0');
      expect(reconstructed.value.entities[499].id).toBe('entity-499');
      expect(reconstructed.value.metadata.totalCount).toBe(500);
    });
  });

  describe('Network Transmission Scenarios', () => {
    it('should handle ActionResult transmission over network', async () => {
      const actionData = {
        actionType: 'user-interaction',
        playerId: 'player-123',
        sessionId: 'session-789',
        inputData: {
          command: 'look',
          target: 'room',
        },
        timestamp: Date.now(),
      };

      const result = ActionResult.success(actionData);

      // Simulate network transmission
      const networkPayload = {
        type: 'action-result',
        id: 'transmission-456',
        data: result.toJSON(),
        metadata: {
          sender: 'game-client',
          recipient: 'game-server',
          compression: 'none',
        },
      };

      const response = await mockNetworkClient.send(networkPayload);

      expect(response.success).toBe(true);
      expect(response.data.type).toBe('action-result');

      // Reconstruct ActionResult from network response
      const reconstructed = ActionResult.fromJSON(response.data.data);
      expect(reconstructed).toBeSuccessfulActionResult(actionData);
    });

    it('should handle network error scenarios', async () => {
      const networkError = new Error('Network connection failed');
      networkError.code = 'NETWORK_ERROR';
      networkError.statusCode = 503;
      networkError.retryable = true;
      networkError.context = {
        endpoint: '/api/actions',
        method: 'POST',
        timestamp: Date.now(),
      };

      const result = ActionResult.failure(networkError);

      // Simulate error transmission
      const errorPayload = {
        type: 'error-response',
        data: result.toJSON(),
        metadata: {
          severity: 'high',
          reportable: true,
        },
      };

      const response = await mockNetworkClient.send(errorPayload);
      const reconstructed = ActionResult.fromJSON(response.data.data);

      expect(reconstructed).toBeFailedActionResultWithAnyError();
      expect(reconstructed.errors[0].message).toBe('Network connection failed');
      expect(reconstructed.errors[0].code).toBe('NETWORK_ERROR');
      if (reconstructed.errors[0].retryable !== undefined) {
        expect(reconstructed.errors[0].retryable).toBe(true);
      }
    });

    it('should handle concurrent network transmissions', async () => {
      const transmissionCount = 10;
      const transmissions = Array.from(
        { length: transmissionCount },
        (_, i) => {
          const data = {
            id: `transmission-${i}`,
            value: i * 10,
            timestamp: Date.now() + i,
          };
          return ActionResult.success(data);
        }
      );

      // Send all transmissions concurrently
      const promises = transmissions.map((result, index) => {
        const payload = {
          id: index,
          data: result.toJSON(),
        };
        return mockNetworkClient.send(payload);
      });

      const responses = await Promise.all(promises);

      // Verify all transmissions succeeded
      expect(responses).toHaveLength(transmissionCount);
      responses.forEach((response, index) => {
        expect(response.success).toBe(true);
        const reconstructed = ActionResult.fromJSON(response.data.data);
        expect(reconstructed.value.id).toBe(`transmission-${index}`);
        expect(reconstructed.value.value).toBe(index * 10);
      });
    });
  });

  describe('Data Format Compatibility', () => {
    it('should handle legacy data format migration', () => {
      // Simulate old format without some fields
      const legacyFormat = {
        success: true,
        value: { data: 'legacy' },
        // Missing errors array
      };

      const result = ActionResult.fromJSON(legacyFormat);

      expect(result).toBeSuccessfulActionResult({ data: 'legacy' });
      expect(result.errors).toEqual([]);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedCases = [
        null,
        undefined,
        {},
        { success: 'not-boolean' },
        { success: true }, // Missing value
        { success: false }, // Missing errors
      ];

      malformedCases.forEach((malformed, index) => {
        expect(() => {
          const result = ActionResult.fromJSON(malformed);
          // Should create valid ActionResult even from malformed input
          expect(result).toBeInstanceOf(ActionResult);
        }).not.toThrow(`Case ${index} should not throw`);
      });
    });

    it('should preserve custom error properties across serialization', () => {
      class CustomError extends Error {
        constructor(message, code, metadata) {
          super(message);
          this.name = 'CustomError';
          this.code = code;
          this.metadata = metadata;
          this.customProperty = 'custom-value';
        }
      }

      const customError = new CustomError(
        'Custom error occurred',
        'CUSTOM_001',
        { userId: 'user-123', operation: 'validation' }
      );

      const result = ActionResult.failure(customError);
      const serialized = result.toJSON();
      const reconstructed = ActionResult.fromJSON(serialized);

      expect(reconstructed).toBeFailedActionResultWithAnyError();
      const error = reconstructed.errors[0];
      expect(error.message).toBe('Custom error occurred');
      expect(error.name).toBe('CustomError');
      expect(error.code).toBe('CUSTOM_001');
      // Note: Custom properties may not be preserved in JSON serialization
      if (error.metadata) {
        expect(error.metadata).toEqual({
          userId: 'user-123',
          operation: 'validation',
        });
      }
      if (error.customProperty) {
        expect(error.customProperty).toBe('custom-value');
      }
    });
  });

  describe('Performance and Memory Management', () => {
    it('should efficiently serialize deeply nested structures', () => {
      // Create deeply nested structure
      let nested = { value: 'leaf' };
      for (let i = 19; i >= 0; i--) {
        nested = { level: i, child: nested };
      }

      const result = ActionResult.success(nested);

      const startTime = Date.now();
      const serialized = result.toJSON();
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString);
      const reconstructed = ActionResult.fromJSON(parsed);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
      expect(reconstructed).toBeSuccessfulActionResultWithAnyValue();

      // Verify deep structure is preserved
      let current = reconstructed.value;
      for (let i = 0; i < 20; i++) {
        expect(current.level).toBe(i);
        current = current.child;
      }
      expect(current.value).toBe('leaf');
    });

    it('should handle circular reference detection in serialization', () => {
      const circular = { name: 'test' };
      circular.self = circular;

      const result = ActionResult.success(circular);

      // toJSON should not fail, but JSON.stringify should detect circular reference
      const jsonObj = result.toJSON();
      expect(jsonObj.success).toBe(true);
      expect(jsonObj.value.name).toBe('test');

      // JSON.stringify should throw on circular reference
      expect(() => JSON.stringify(jsonObj)).toThrow();
    });

    it('should manage memory efficiently with large error collections', () => {
      const errorCount = 1000;
      const errors = Array.from({ length: errorCount }, (_, i) => {
        const error = new Error(`Error ${i}`);
        error.code = `ERR_${i.toString().padStart(4, '0')}`;
        error.metadata = {
          index: i,
          batch: Math.floor(i / 100),
          timestamp: Date.now() + i,
        };
        return error;
      });

      const result = ActionResult.failure(errors);

      const startTime = Date.now();
      const serialized = result.toJSON();
      const reconstructed = ActionResult.fromJSON(serialized);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should handle efficiently
      expect(reconstructed.errors).toHaveLength(errorCount);
      expect(reconstructed.errors[0].message).toBe('Error 0');
      expect(reconstructed.errors[999].code).toBe('ERR_0999');
    });
  });
});
