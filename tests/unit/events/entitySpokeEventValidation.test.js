import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import {
  createValidNote,
  createNotesArray,
  NOTE_TEMPLATES,
} from '../../common/structuredNotesHelper.js';

describe('Entity Spoke Event - Schema Validation', () => {
  let ajv;
  let payloadSchema;
  let validate;

  beforeEach(() => {
    // Set up AJV with formats support for structured note validation
    ajv = new Ajv({ strict: false });
    addFormats(ajv);

    // Load the common schema for structured note definition
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf8'));
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Load the actual event schema
    const eventSchemaPath = path.join(
      process.cwd(),
      'data/mods/core/events/entity_spoke.event.json'
    );
    const eventSchema = JSON.parse(fs.readFileSync(eventSchemaPath, 'utf8'));

    // Extract and simplify the payload schema for testing
    payloadSchema = { ...eventSchema.payloadSchema };

    // Replace the external reference with inline definition for entityId
    payloadSchema.properties.entityId = {
      type: 'string',
      description: 'The ID of the entity that spoke.',
    };

    validate = ajv.compile(payloadSchema);
  });

  describe('Payload validation with structured notes', () => {
    it('should validate successfully with structured notes array (empty)', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes: [],
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate successfully with structured notes array (single note)', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes: [
          NOTE_TEMPLATES.characterObservation(
            'Alice',
            'Character observation text'
          ),
        ],
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate successfully with structured notes array (multiple notes)', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes: [
          NOTE_TEMPLATES.characterObservation('Alice', 'First observation'),
          NOTE_TEMPLATES.locationDescription('Tavern', 'Second observation'),
        ],
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate successfully with minimal required fields only', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        notes: [
          {
            text: 'Minimal note',
            subject: 'someone',
            subjectType: 'other',
          },
        ],
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate with complex structured notes with all fields', () => {
      const payload = {
        entityId: 'p_erotica:amaia_castillo_instance',
        speechContent:
          "Bonsoir. The view from here... quite stunning, n'est-ce pas?",
        thoughts:
          'There. A young man, lean muscle wrapped in casual indifference...',
        notes: [
          {
            text: 'Young man positioned strategically near café tables, observing bay with confident posture',
            subject: 'Iker Aguirre',
            subjectType: 'entity',
            context: 'outside The Gilded Bean',
          },
        ],
      };

      // This should pass validation with the new structured format
      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
        console.error('Payload:', JSON.stringify(payload, null, 2));
      }
      expect(isValid).toBe(true);
    });

    it('should reject payload with invalid notes structure', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        notes: [{ invalidField: 'not allowed' }], // Missing required fields
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject payload with invalid subjectType', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        notes: [
          {
            text: 'Some note',
            subject: 'test',
            subjectType: 'invalid_type', // Not in enum
          },
        ],
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject payload with extra properties', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        extraField: 'not allowed', // This should cause validation failure
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });
});
