// tests/unit/schemas/senseAwareOperationSchemas.test.js

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schemas - using ESM imports
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import baseOperationSchema from '../../../data/schemas/base-operation.schema.json';
import dispatchPerceptibleEventSchema from '../../../data/schemas/operations/dispatchPerceptibleEvent.schema.json';
import addPerceptionLogEntrySchema from '../../../data/schemas/operations/addPerceptionLogEntry.schema.json';

describe('Sense-Aware Operation Schema Extensions', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateDispatch;
  /** @type {import('ajv').ValidateFunction} */
  let validateLogEntry;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
    addFormats(ajv);

    // Register dependent schemas by their $id
    ajv.addSchema(commonSchema, commonSchema.$id);
    ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
    ajv.addSchema(conditionContainerSchema, conditionContainerSchema.$id);
    ajv.addSchema(baseOperationSchema, baseOperationSchema.$id);

    // Compile operation schemas
    validateDispatch = ajv.compile(dispatchPerceptibleEventSchema);
    validateLogEntry = ajv.compile(addPerceptionLogEntrySchema);
  });

  describe('DISPATCH_PERCEPTIBLE_EVENT schema', () => {
    it('validates existing operation without new fields (backward compatibility)', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with alternate_descriptions', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves his hand in greeting.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
          alternate_descriptions: {
            auditory: 'You hear rustling fabric as someone gestures nearby.',
            tactile: 'You feel a slight breeze from movement nearby.',
            limited: 'You sense activity nearby.',
          },
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with partial alternate_descriptions (auditory only)', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'A door slams shut.',
          perception_type: 'state.observable_change',
          actor_id: 'actor:bob',
          alternate_descriptions: {
            auditory: 'You hear a loud bang.',
          },
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with olfactory alternate_description', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:kitchen',
          description_text: 'The chef is cooking steak.',
          perception_type: 'state.observable_change',
          actor_id: 'actor:chef',
          alternate_descriptions: {
            olfactory: 'A rich smell of cooking meat wafts through the air.',
          },
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with sense_aware set to true (explicit default)', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
          sense_aware: true,
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with sense_aware set to false (bypass filtering)', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'The ground shakes.',
          perception_type: 'state.observable_change',
          actor_id: 'actor:bob',
          sense_aware: false,
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with both alternate_descriptions and sense_aware', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves his hand.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
          alternate_descriptions: {
            auditory: 'You hear rustling.',
            tactile: 'You feel movement.',
            olfactory: 'A faint scent of cologne.',
            limited: 'You sense activity.',
          },
          sense_aware: true,
        },
      };

      const valid = validateDispatch(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateDispatch.errors);
      }
      expect(valid).toBe(true);
    });

    it('rejects alternate_descriptions with additional properties', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
          alternate_descriptions: {
            auditory: 'Valid field.',
            unknown_sense: 'This should be rejected.',
          },
        },
      };

      const valid = validateDispatch(operation);
      expect(valid).toBe(false);
      expect(validateDispatch.errors).toBeDefined();
    });

    it('rejects sense_aware with non-boolean value', () => {
      const operation = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: 'loc:test_area',
          description_text: 'Bob waves.',
          perception_type: 'social.gesture',
          actor_id: 'actor:bob',
          sense_aware: 'yes',
        },
      };

      const valid = validateDispatch(operation);
      expect(valid).toBe(false);
      expect(validateDispatch.errors).toBeDefined();
    });
  });

  describe('ADD_PERCEPTION_LOG_ENTRY schema', () => {
    it('validates existing operation without new fields (backward compatibility)', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'A thing happens.',
          },
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with entry containing perceivedVia', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'A thing happens.',
            perceivedVia: 'auditory',
          },
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with entry containing originalDescription', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'You hear rustling.',
            originalDescription: 'Bob waves his hand.',
          },
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with entry containing both perceivedVia and originalDescription', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'You hear rustling.',
            perceivedVia: 'auditory',
            originalDescription: 'Bob waves his hand.',
          },
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with top-level alternate_descriptions', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'Something happens.',
          },
          alternate_descriptions: {
            auditory: 'You hear something.',
            tactile: 'You feel something.',
          },
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with top-level sense_aware', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'Something happens.',
          },
          sense_aware: false,
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with all new fields combined', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'You hear rustling.',
            perceivedVia: 'auditory',
            originalDescription: 'Bob waves his hand.',
          },
          alternate_descriptions: {
            auditory: 'Sound description.',
            tactile: 'Touch description.',
          },
          sense_aware: true,
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });

    it('validates operation with placeholder recipient_ids string (existing behavior)', () => {
      const operation = {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: 'loc:test_area',
          entry: {
            descriptionText: 'A thing happens.',
          },
          recipient_ids: '{event.payload.contextualData.recipientIds}',
        },
      };

      const valid = validateLogEntry(operation);
      if (!valid) {
        console.error('AJV validation errors:', validateLogEntry.errors);
      }
      expect(valid).toBe(true);
    });
  });
});
