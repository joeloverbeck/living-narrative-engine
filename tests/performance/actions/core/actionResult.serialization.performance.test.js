/**
 * @file Performance benchmarks for ActionResult serialization
 * @description Performance tests for ActionResult JSON serialization/deserialization operations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('ActionResult - Serialization Performance', () => {
  let mockStorageProvider;

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
  });

  describe('Large Data Serialization Performance', () => {
    it('should handle large data objects in serialization (target: <5s for 500 entities)', async () => {
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

      const duration = endTime - startTime;

      // Verify performance (should complete in reasonable time)
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Verify data integrity
      expect(reconstructed.success).toBe(true);
      expect(reconstructed.value.entities).toHaveLength(500);
      expect(reconstructed.value.entities[0].id).toBe('entity-0');
      expect(reconstructed.value.entities[499].id).toBe('entity-499');
      expect(reconstructed.value.metadata.totalCount).toBe(500);

      // Log performance metrics for monitoring
      console.log(
        `Large data serialization: ${duration}ms for 500 entities with nested data`
      );
    });
  });

  describe('Deep Nesting Serialization Performance', () => {
    it('should efficiently serialize deeply nested structures (target: <1s for 20 levels)', () => {
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

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete quickly
      expect(reconstructed.success).toBe(true);

      // Verify deep structure is preserved
      let current = reconstructed.value;
      for (let i = 0; i < 20; i++) {
        expect(current.level).toBe(i);
        current = current.child;
      }
      expect(current.value).toBe('leaf');

      // Log performance metrics
      console.log(
        `Deep nesting serialization: ${duration}ms for 20-level nested structure`
      );
    });
  });

  describe('Large Error Collection Performance', () => {
    it('should manage memory efficiently with large error collections (target: <2s for 1000 errors)', () => {
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

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should handle efficiently
      expect(reconstructed.errors).toHaveLength(errorCount);
      expect(reconstructed.errors[0].message).toBe('Error 0');
      expect(reconstructed.errors[999].code).toBe('ERR_0999');

      // Log performance metrics
      console.log(
        `Large error collection: ${duration}ms for ${errorCount} errors with metadata`
      );
    });
  });
});
