import { describe, it, expect } from '@jest/globals';
import { buildSpeechPayload } from '../../../src/turns/states/helpers/buildSpeechPayload.js';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

describe('Entity Spoke Event - Schema Validation', () => {
  let ajv;
  let payloadSchema;
  let validate;

  beforeEach(() => {
    // Set up AJV directly for simpler testing
    ajv = new Ajv({ strict: false });

    // Load the actual event schema
    const eventSchemaPath = path.join(
      process.cwd(),
      'data/mods/core/events/entity_spoke.event.json'
    );
    const eventSchema = JSON.parse(fs.readFileSync(eventSchemaPath, 'utf8'));

    // Extract and simplify the payload schema for testing
    payloadSchema = { ...eventSchema.payloadSchema };

    // Replace the external reference with inline definition
    payloadSchema.properties.entityId = {
      type: 'string',
      description: 'The ID of the entity that spoke.',
    };

    validate = ajv.compile(payloadSchema);
  });

  describe('Payload validation with structured notes', () => {
    it('should validate successfully with plain text notes', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes: 'Simple text note',
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate successfully with structured notes (single object)', () => {
      const notesRaw = {
        text: 'Character observation text',
        subject: 'Alice',
        subjectType: 'character',
        context: 'in the tavern',
        tags: ['suspicious', 'wealthy'],
      };

      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes:
          '[character] Alice: Character observation text (in the tavern) [suspicious, wealthy]',
        notesRaw: notesRaw,
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      // This was the failing case - should now pass
      expect(isValid).toBe(true);
    });

    it('should validate successfully with structured notes (array)', () => {
      const notesRaw = [
        {
          text: 'First observation',
          subject: 'Alice',
          subjectType: 'character',
        },
        {
          text: 'Second observation',
          subject: 'Tavern',
          subjectType: 'location',
          context: 'busy night',
          tags: ['crowded'],
        },
      ];

      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        thoughts: 'Internal thoughts',
        notes:
          '[character] Alice: First observation\n[location] Tavern: Second observation (busy night) [crowded]',
        notesRaw: notesRaw,
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate successfully with notesRaw as string (legacy support)', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        notesRaw: 'Legacy string note',
      };

      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should reproduce the original error case from logs and validate successfully', () => {
      // This is the exact payload structure from the error logs
      const decisionMeta = {
        speech: "Bonsoir. The view from here... quite stunning, n'est-ce pas?",
        thoughts:
          'There. A young man, lean muscle wrapped in casual indifference...',
        notes: [
          {
            text: 'Young man positioned strategically near café tables, observing bay with confident posture',
            subject: 'Iker Aguirre',
            subjectType: 'character',
            context: 'outside The Gilded Bean',
            tags: ['potential', 'observation', 'young'],
          },
        ],
      };

      // Build the payload using the same function that was failing
      const payloadBase = buildSpeechPayload(decisionMeta);
      expect(payloadBase).not.toBeNull();

      const payload = {
        entityId: 'p_erotica:amaia_castillo_instance',
        ...payloadBase,
      };

      // Verify the payload structure matches what was in the error
      expect(payload).toMatchObject({
        entityId: 'p_erotica:amaia_castillo_instance',
        speechContent: expect.any(String),
        thoughts: expect.any(String),
        notes: expect.any(String),
        notesRaw: expect.any(Array),
      });

      // This should now pass validation (the critical test!)
      const isValid = validate(payload);
      if (!isValid) {
        console.error('Validation errors:', validate.errors);
        console.error('Payload:', JSON.stringify(payload, null, 2));
      }
      expect(isValid).toBe(true);
    });

    it('should reject payload with invalid notesRaw structure', () => {
      const payload = {
        entityId: 'test:actor',
        speechContent: 'Hello world',
        notesRaw: { invalidField: 'not allowed' }, // Missing required 'text' field
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
