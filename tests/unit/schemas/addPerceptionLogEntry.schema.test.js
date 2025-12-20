/**
 * @file addPerceptionLogEntry.schema.test.js
 * @description Tests for ADD_PERCEPTION_LOG_ENTRY operation schema validation,
 * particularly the sense_aware field which must accept both boolean literals
 * and string placeholders that resolve at runtime.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema imports
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import baseOperationSchema from '../../../data/schemas/base-operation.schema.json';
import addPerceptionLogEntrySchema from '../../../data/schemas/operations/addPerceptionLogEntry.schema.json';

describe('addPerceptionLogEntry.schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      allowUnionTypes: true,
    });
    addFormats(ajv);

    // Register dependent schemas by their $id
    ajv.addSchema(commonSchema, commonSchema.$id);
    ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
    ajv.addSchema(conditionContainerSchema, conditionContainerSchema.$id);
    ajv.addSchema(baseOperationSchema, baseOperationSchema.$id);

    // Compile the operation schema
    validate = ajv.compile(addPerceptionLogEntrySchema);
  });

  /**
   * Helper to create a valid base operation with required fields
   * @param {Object} overrides - Properties to override or add
   * @returns {Object} Complete operation object
   */
  const createOperation = (overrides = {}) => ({
    type: 'ADD_PERCEPTION_LOG_ENTRY',
    parameters: {
      location_id: 'test:location1',
      entry: {
        descriptionText: 'Test description',
        timestamp: '2024-01-01T00:00:00Z',
        perceptionType: 'visual',
      },
      ...overrides,
    },
  });

  describe('sense_aware field validation', () => {
    it('should accept sense_aware: true (boolean literal)', () => {
      const operation = createOperation({ sense_aware: true });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept sense_aware: false (boolean literal)', () => {
      const operation = createOperation({ sense_aware: false });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept string placeholder for sense_aware (runtime resolution)', () => {
      // This is the critical test - reproduces the original validation failure
      // The log_perceptible_events.rule.json uses this pattern:
      // "sense_aware": "{event.payload.senseAware}"
      const operation = createOperation({
        sense_aware: '{event.payload.senseAware}',
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should reject sense_aware with number type', () => {
      const operation = createOperation({ sense_aware: 123 });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject sense_aware with null', () => {
      const operation = createOperation({ sense_aware: null });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject sense_aware with object type', () => {
      const operation = createOperation({ sense_aware: {} });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject sense_aware with empty string', () => {
      const operation = createOperation({ sense_aware: '' });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should accept operation without sense_aware (uses default)', () => {
      const operation = createOperation();
      // sense_aware not specified, should use default: true

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });
  });

  describe('required fields validation', () => {
    it('should require location_id', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          entry: { descriptionText: 'Test' },
        },
      };

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should require entry object', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'test:location1',
        },
      };

      const valid = validate(operation);

      expect(valid).toBe(false);
    });
  });

  describe('origin_location_id field validation', () => {
    it('should accept origin_location_id as a string', () => {
      const operation = createOperation({
        origin_location_id: 'test:origin',
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should reject origin_location_id as empty string', () => {
      const operation = createOperation({
        origin_location_id: '',
      });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });
  });

  describe('recipient_ids and excluded_actor_ids (existing oneOf pattern)', () => {
    it('should accept recipient_ids as array', () => {
      const operation = createOperation({
        recipient_ids: ['actor1', 'actor2'],
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept recipient_ids as string placeholder', () => {
      const operation = createOperation({
        recipient_ids: '{event.payload.contextualData.recipientIds}',
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept excluded_actor_ids as array', () => {
      const operation = createOperation({
        excluded_actor_ids: ['actor1'],
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept excluded_actor_ids as string placeholder', () => {
      const operation = createOperation({
        excluded_actor_ids: '{event.payload.contextualData.excludedActorIds}',
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });
  });

  describe('alternate_descriptions field validation', () => {
    it('should accept alternate_descriptions as object literal', () => {
      const operation = createOperation({
        alternate_descriptions: {
          auditory: 'I hear something.',
          limited: 'Something happens nearby.',
        },
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept alternate_descriptions as string placeholder (runtime resolution)', () => {
      // This is the critical test - reproduces the original validation failure
      // The log_perceptible_events.rule.json uses this pattern:
      // "alternate_descriptions": "{event.payload.alternateDescriptions}"
      const operation = createOperation({
        alternate_descriptions: '{event.payload.alternateDescriptions}',
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should accept empty object for alternate_descriptions', () => {
      const operation = createOperation({
        alternate_descriptions: {},
      });

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });

    it('should reject alternate_descriptions with number type', () => {
      const operation = createOperation({ alternate_descriptions: 123 });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject alternate_descriptions with null', () => {
      const operation = createOperation({ alternate_descriptions: null });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject alternate_descriptions with array type', () => {
      const operation = createOperation({ alternate_descriptions: [] });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should reject alternate_descriptions with empty string', () => {
      const operation = createOperation({ alternate_descriptions: '' });

      const valid = validate(operation);

      expect(valid).toBe(false);
    });

    it('should accept operation without alternate_descriptions', () => {
      const operation = createOperation();
      // alternate_descriptions not specified - should be allowed since it's optional

      const valid = validate(operation);
      if (!valid) {
        console.error('AJV validation errors:', validate.errors);
      }

      expect(valid).toBe(true);
    });
  });
});
