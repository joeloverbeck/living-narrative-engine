/**
 * @file Performance benchmarks for schema validation
 * @description Tests the performance characteristics of event schema validation
 * to ensure validation operations complete within acceptable time limits.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

describe('Schema Validation Performance', () => {
  let ajv;
  let validate;
  let attemptActionEvent;

  beforeAll(() => {
    // Load the event definition
    const eventPath = path.join(
      process.cwd(),
      'data/mods/core/events/attempt_action.event.json'
    );
    attemptActionEvent = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));

    // Setup AJV with the schema (non-strict mode for anyOf patterns)
    ajv = new Ajv({ strict: false, allErrors: true });

    // Add common schema for reference resolution
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    ajv.addSchema(commonSchema, commonSchema.$id);

    validate = ajv.compile(attemptActionEvent.payloadSchema);
  });

  describe('Performance validation', () => {
    it('should validate events within performance requirements', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          item: 'knife_789',
          target: 'goblin_012',
        },
        targetId: 'knife_789',
        originalInput: 'throw knife at goblin',
        timestamp: 1640995200000,
      };

      const startTime = performance.now();
      const valid = validate(payload);
      const endTime = performance.now();
      const validationTime = endTime - startTime;

      expect(valid).toBe(true);
      expect(validationTime).toBeLessThan(5); // Should complete within 5ms
    });

    it('should validate multiple events efficiently', () => {
      const payloads = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_1',
          actionId: 'core:action',
          targetId: 'target_1',
          originalInput: 'test 1',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_2',
          actionId: 'core:action',
          targets: { primary: 'target_2' },
          targetId: 'target_2',
          originalInput: 'test 2',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_3',
          actionId: 'core:action',
          targets: { item: 'item_3', target: 'target_3' },
          targetId: 'item_3',
          originalInput: 'test 3',
        },
      ];

      const startTime = performance.now();
      for (const payload of payloads) {
        validate(payload);
      }
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / payloads.length;

      expect(averageTime).toBeLessThan(5); // Each validation should average under 5ms
    });
  });
});
