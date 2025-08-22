/**
 * @file Performance benchmarks for attempt_action event schema validation
 * @description Tests the performance characteristics of event schema validation
 * to ensure validation operations complete within acceptable time limits.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

describe('core:attempt_action Event Schema Validation Performance', () => {
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

    it('should validate complex multi-target events within 10ms', () => {
      const complexPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'complex:orchestrated_action',
        targets: {
          primary: 'entity_1',
          secondary: 'entity_2',
          tertiary: 'entity_3',
          quaternary: 'entity_4',
          tool: 'tool_5',
          location: 'location_6',
          container: 'container_7',
          recipient: 'recipient_8',
        },
        targetId: 'entity_1',
        originalInput: 'complex orchestrated multi-target action',
        timestamp: Date.now(),
      };

      const startTime = performance.now();
      const valid = validate(complexPayload);
      const endTime = performance.now();
      const validationTime = endTime - startTime;

      expect(valid).toBe(true);
      expect(validationTime).toBeLessThan(10); // 10ms for complex events
    });

    it('should handle batch validation of complex events efficiently', () => {
      const complexEvents = [];
      for (let i = 0; i < 50; i++) {
        complexEvents.push({
          eventName: 'core:attempt_action',
          actorId: `actor_${i}`,
          actionId: 'complex:action',
          targets: {
            primary: `target_${i}_1`,
            secondary: `target_${i}_2`,
            item1: `item_${i}_1`,
            item2: `item_${i}_2`,
            location: `location_${i}`,
            tool: `tool_${i}`,
          },
          targetId: `target_${i}_1`,
          originalInput: `complex action ${i} with many targets`,
          timestamp: 1640995200000,
        });
      }

      const startTime = performance.now();
      for (const event of complexEvents) {
        validate(event);
      }
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / complexEvents.length;

      expect(averageTime).toBeLessThan(10); // 10ms average for complex events
    });
  });
});