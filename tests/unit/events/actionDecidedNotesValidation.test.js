/**
 * @file Focused tests for action_decided event notes validation with subjectType
 * @see data/mods/core/events/action_decided.event.json
 * @see data/mods/core/components/notes.component.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';

describe('action_decided event - notes validation with subjectType', () => {
  let ajv;
  let validate;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true, strict: false });

    // Define the schema directly to avoid reference resolution issues
    const schema = {
      type: 'object',
      properties: {
        actorId: { type: 'string' },
        actorType: {
          type: 'string',
          enum: ['ai', 'human'],
        },
        extractedData: {
          type: 'object',
          properties: {
            thoughts: { type: 'string' },
            notes: {
              type: 'array',
              items: {
                oneOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      text: {
                        type: 'string',
                        minLength: 1,
                      },
                      subject: {
                        type: 'string',
                        minLength: 1,
                      },
                      subjectType: {
                        type: 'string',
                        enum: [
                          'character',
                          'location',
                          'item',
                          'creature',
                          'event',
                          'concept',
                          'relationship',
                          'organization',
                          'quest',
                          'skill',
                          'emotion',
                          'other',
                        ],
                      },
                      context: { type: 'string' },
                      tags: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                    required: ['text', 'subject', 'subjectType'],
                    additionalProperties: false,
                  },
                ],
              },
            },
          },
          additionalProperties: true,
        },
      },
      required: ['actorId', 'actorType'],
      additionalProperties: false,
    };

    validate = ajv.compile(schema);
  });

  describe('Valid notes with subjectType', () => {
    it('should accept notes with all required fields including subjectType', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            {
              text: 'Young man observed at cafe',
              subject: 'Iker Aguirre',
              subjectType: 'character',
              context: 'The Gilded Bean terrace',
              tags: ['potential', 'young'],
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept notes with minimal required fields', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            {
              text: 'Basic observation',
              subject: 'Test Subject',
              subjectType: 'other',
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });

    it('should accept all valid subjectType enum values', () => {
      const validTypes = [
        'character',
        'location',
        'item',
        'creature',
        'event',
        'concept',
        'relationship',
        'organization',
        'quest',
        'skill',
        'emotion',
        'other',
      ];

      validTypes.forEach((type) => {
        const payload = {
          actorId: 'test:actor',
          actorType: 'ai',
          extractedData: {
            notes: [
              {
                text: `Note about ${type}`,
                subject: 'Test',
                subjectType: type,
              },
            ],
          },
        };

        const isValid = validate(payload);
        expect(isValid).toBe(true);
      });
    });

    it('should accept legacy string-only notes format', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: ['Simple string note', 'Another string note'],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });

    it('should accept mixed string and object notes', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            'String note',
            {
              text: 'Object note',
              subject: 'Test',
              subjectType: 'character',
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });
  });

  describe('Invalid notes - missing subjectType', () => {
    it('should reject object notes missing subjectType field', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            {
              text: 'Note without subjectType',
              subject: 'Test Subject',
              // Missing subjectType
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(
        validate.errors.some((err) => err.message.includes('required'))
      ).toBe(true);
    });

    it('should reject object notes with invalid subjectType', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            {
              text: 'Note with invalid type',
              subject: 'Test',
              subjectType: 'invalid_type',
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(
        validate.errors.some(
          (err) =>
            err.message.includes('enum') ||
            err.message.includes('must be equal to one of the allowed values')
        )
      ).toBe(true);
    });

    it('should reject notes with additional properties', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [
            {
              text: 'Note',
              subject: 'Test',
              subjectType: 'character',
              extraField: 'not allowed',
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(
        validate.errors.some((err) =>
          err.message.includes('additional properties')
        )
      ).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should accept empty notes array', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          notes: [],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });

    it('should accept missing extractedData', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'human',
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });

    it('should accept extractedData without notes', () => {
      const payload = {
        actorId: 'test:actor',
        actorType: 'ai',
        extractedData: {
          thoughts: 'Some thoughts',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
    });
  });

  describe('Real-world scenario from error log', () => {
    it('should accept the actual LLM response that was failing', () => {
      const payload = {
        actorId: 'p_erotica:amaia_castillo_instance',
        actorType: 'ai',
        extractedData: {
          speech:
            "*adjusts the line of her blazer with deliberate precision, then approaches with measured steps* That view... it pulls at something, doesn't it? The way the light fractures across the water.",
          thoughts:
            'Young, athletic build visible even through casual clothing. The quiet contemplation... interesting. Not performing for anyone, genuinely absorbed. This bears closer examination. The isolated positioning suggests either shyness or confidence - need to determine which. My opening gambit should test his receptiveness to sophisticated conversation while maintaining plausible deniability.',
          notes: [
            {
              text: 'Young man, athletic build, contemplating bay view alone - appears genuinely absorbed rather than positioning',
              subject: 'Iker Aguirre',
              subjectType: 'character',
              context: 'The Gilded Bean terrace observation',
              tags: ['potential', 'young', 'solitary'],
            },
          ],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });
});
