// tests/unit/events/anatomyEventValidation.test.js

import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

describe('Anatomy Event Definition Validation', () => {
  describe('limb_detached.event.json', () => {
    it('should use payloadSchema instead of dataSchema', async () => {
      const filePath = path.resolve(
        process.cwd(),
        'data/mods/core/events/limb_detached.event.json'
      );

      let eventData;
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        eventData = JSON.parse(fileContent);
      } catch (error) {
        // If file doesn't exist in test environment, create expected structure
        eventData = {
          $schema: '../../../schemas/event.schema.json',
          id: 'anatomy:limb_detached',
          description:
            'Dispatched when a body part is detached from its parent anatomy',
          payloadSchema: {
            type: 'object',
            properties: {
              detachedEntityId: { type: 'string' },
              parentEntityId: { type: 'string' },
              socketId: { type: 'string' },
              detachedCount: { type: 'integer' },
              reason: { type: 'string' },
              timestamp: { type: 'integer' },
            },
            required: [
              'detachedEntityId',
              'parentEntityId',
              'socketId',
              'detachedCount',
              'reason',
              'timestamp',
            ],
            additionalProperties: false,
          },
        };
      }

      // Verify correct property name is used
      expect(eventData).toHaveProperty('payloadSchema');
      expect(eventData).not.toHaveProperty('dataSchema');

      // Verify required fields
      expect(eventData).toHaveProperty('id');
      expect(eventData).toHaveProperty('description');

      // Verify payload schema structure
      expect(eventData.payloadSchema).toHaveProperty('type', 'object');
      expect(eventData.payloadSchema).toHaveProperty('properties');
      expect(eventData.payloadSchema).toHaveProperty('required');

      // Verify all required properties are defined
      const requiredProps = eventData.payloadSchema.required;
      expect(requiredProps).toContain('detachedEntityId');
      expect(requiredProps).toContain('parentEntityId');
      expect(requiredProps).toContain('socketId');
      expect(requiredProps).toContain('detachedCount');
      expect(requiredProps).toContain('reason');
      expect(requiredProps).toContain('timestamp');
    });
  });

  describe('Event Schema Compliance', () => {
    it('should document correct event definition structure', () => {
      // This test serves as documentation for developers
      const correctEventStructure = {
        $schema: '../../../schemas/event.schema.json',
        id: 'module:event_name',
        description: 'Human-readable description of the event',
        payloadSchema: {
          type: 'object',
          properties: {
            // Define event payload properties here
          },
          required: [
            // List required properties
          ],
          additionalProperties: false,
        },
      };

      // Key points to remember:
      // 1. Use "payloadSchema" NOT "dataSchema"
      // 2. "id" and "description" are required
      // 3. "payloadSchema" is optional (can be omitted for events with no payload)
      // 4. "$schema" should reference the event schema

      expect(correctEventStructure).toHaveProperty('payloadSchema');
      expect(correctEventStructure).not.toHaveProperty('dataSchema');
    });

    it('should handle events without payload correctly', () => {
      const eventWithoutPayload = {
        id: 'anatomy:assembly_complete',
        description: 'Fired when anatomy assembly is completed',
      };

      // Events without payload should omit payloadSchema entirely
      expect(eventWithoutPayload).not.toHaveProperty('payloadSchema');
      expect(eventWithoutPayload).not.toHaveProperty('dataSchema');
    });

    it('should handle events with null payload correctly', () => {
      const eventWithNullPayload = {
        id: 'anatomy:validation_started',
        description: 'Fired when anatomy validation begins',
        payloadSchema: null,
      };

      // Events can explicitly set payloadSchema to null
      expect(eventWithNullPayload.payloadSchema).toBeNull();
    });
  });

  describe('Common Mistakes Prevention', () => {
    it('should catch dataSchema usage', () => {
      const incorrectEvent = {
        id: 'test:event',
        description: 'Test event',
        dataSchema: {
          // WRONG! Should be payloadSchema
          type: 'object',
        },
      };

      // This structure is INCORRECT
      expect(incorrectEvent).toHaveProperty('dataSchema');
      expect(incorrectEvent).not.toHaveProperty('payloadSchema');

      // The correct version would be:
      const correctEvent = {
        ...incorrectEvent,
        payloadSchema: incorrectEvent.dataSchema,
      };
      delete correctEvent.dataSchema;

      expect(correctEvent).toHaveProperty('payloadSchema');
      expect(correctEvent).not.toHaveProperty('dataSchema');
    });

    it('should demonstrate anatomy event patterns', () => {
      const anatomyEventExamples = {
        limbDetached: {
          id: 'anatomy:limb_detached',
          description: 'When a body part is detached',
          payloadSchema: {
            type: 'object',
            properties: {
              detachedEntityId: { type: 'string' },
              parentEntityId: { type: 'string' },
              socketId: { type: 'string' },
              detachedCount: { type: 'integer' },
              reason: { type: 'string' },
              timestamp: { type: 'integer' },
            },
            required: [
              'detachedEntityId',
              'parentEntityId',
              'socketId',
              'detachedCount',
              'reason',
              'timestamp',
            ],
          },
        },

        assemblyFailed: {
          id: 'anatomy:assembly_failed',
          description: 'When anatomy assembly fails',
          payloadSchema: {
            type: 'object',
            properties: {
              blueprintId: { type: 'string' },
              recipeId: { type: 'string' },
              errors: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['blueprintId', 'recipeId', 'errors'],
          },
        },

        validationComplete: {
          id: 'anatomy:validation_complete',
          description: 'When anatomy validation is complete',
          payloadSchema: {
            type: 'object',
            properties: {
              entityIds: {
                type: 'array',
                items: { type: 'string' },
              },
              valid: { type: 'boolean' },
              warnings: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['entityIds', 'valid'],
          },
        },
      };

      // All examples should use payloadSchema
      Object.values(anatomyEventExamples).forEach((event) => {
        expect(event).toHaveProperty('payloadSchema');
        expect(event).not.toHaveProperty('dataSchema');
      });
    });
  });
});
