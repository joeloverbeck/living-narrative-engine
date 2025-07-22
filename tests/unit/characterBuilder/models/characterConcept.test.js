/**
 * @file Unit tests for CharacterConcept model
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { 
  createCharacterConcept,
  updateCharacterConcept,
  validateCharacterConcept,
  serializeCharacterConcept,
  deserializeCharacterConcept,
  CHARACTER_CONCEPT_STATUS
} from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterConcept Model', () => {
  let mockSchemaValidator;

  beforeEach(() => {
    // Create a mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    };
  });

  describe('createCharacterConcept', () => {
    test('should create character concept with valid data', () => {
      const conceptText = 'A brave adventurer with a mysterious past who seeks redemption';
      const options = {
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        metadata: { source: 'user' }
      };

      const result = createCharacterConcept(conceptText, options);

      expect(result).toMatchObject({
        id: expect.any(String),
        concept: 'A brave adventurer with a mysterious past who seeks redemption',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        thematicDirections: [],
        metadata: { source: 'user' }
      });

      // Verify timestamps are Date objects
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      
      // Verify ID is a valid UUID format
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should create concept with minimal required data', () => {
      const conceptText = 'Simple hero concept that is long enough';

      const result = createCharacterConcept(conceptText);

      expect(result).toMatchObject({
        id: expect.any(String),
        concept: 'Simple hero concept that is long enough',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        thematicDirections: [],
        metadata: {}
      });
    });

    test('should throw error if concept is missing', () => {
      expect(() => createCharacterConcept()).toThrow('concept must be a non-empty string');
      expect(() => createCharacterConcept(null)).toThrow('concept must be a non-empty string');
    });

    test('should throw error if concept is empty', () => {
      expect(() => createCharacterConcept('')).toThrow('concept must be a non-empty string');
      expect(() => createCharacterConcept('   ')).toThrow('concept must be a non-empty string');
    });

    test('should throw error if concept is too short', () => {
      expect(() => createCharacterConcept('Too short')).toThrow('concept must be at least 10 characters long');
    });

    test('should throw error if concept exceeds maximum length', () => {
      const longConcept = 'a'.repeat(1001);
      
      expect(() => createCharacterConcept(longConcept)).toThrow('concept must be no more than 1000 characters long');
    });

    test('should sanitize input data', () => {
      const conceptText = '  A brave adventurer with whitespace padding  ';

      const result = createCharacterConcept(conceptText);

      expect(result.concept).toBe('A brave adventurer with whitespace padding');
    });

    test('should generate unique IDs for different concepts', () => {
      const concept1 = 'First hero concept that is long enough';
      const concept2 = 'Second hero concept that is long enough';

      const result1 = createCharacterConcept(concept1);
      const result2 = createCharacterConcept(concept2);

      expect(result1.id).not.toBe(result2.id);
    });

    test('should set createdAt and updatedAt to same value on creation', () => {
      const conceptText = 'A brave adventurer with a mysterious past';

      const result = createCharacterConcept(conceptText);

      expect(result.createdAt).toEqual(result.updatedAt);
    });

    test('should accept custom ID in options', () => {
      const conceptText = 'A brave adventurer with a mysterious past';
      const customId = '12345678-1234-1234-1234-123456789abc';

      const result = createCharacterConcept(conceptText, { id: customId });

      expect(result.id).toBe(customId);
    });

    test('should accept thematic directions in options', () => {
      const conceptText = 'A brave adventurer with a mysterious past';
      const thematicDirections = [
        { id: 'td-1', title: 'Direction 1' },
        { id: 'td-2', title: 'Direction 2' }
      ];

      const result = createCharacterConcept(conceptText, { thematicDirections });

      expect(result.thematicDirections).toEqual(thematicDirections);
    });
  });

  describe('updateCharacterConcept', () => {
    let existingConcept;

    beforeEach(() => {
      existingConcept = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Original concept that is long enough',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        thematicDirections: [],
        metadata: {}
      };
    });

    test('should update concept text', () => {
      const updates = {
        concept: 'Updated concept that is much longer and better'
      };

      const result = updateCharacterConcept(existingConcept, updates);

      expect(result.concept).toBe('Updated concept that is much longer and better');
      expect(result.updatedAt).not.toEqual(existingConcept.updatedAt);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should update status', () => {
      const updates = {
        status: CHARACTER_CONCEPT_STATUS.PROCESSING
      };

      const result = updateCharacterConcept(existingConcept, updates);

      expect(result.status).toBe(CHARACTER_CONCEPT_STATUS.PROCESSING);
      expect(result.updatedAt).not.toEqual(existingConcept.updatedAt);
    });

    test('should update thematic directions', () => {
      const updates = {
        thematicDirections: [{ id: 'td-new', title: 'New Direction' }]
      };

      const result = updateCharacterConcept(existingConcept, updates);

      expect(result.thematicDirections).toEqual([{ id: 'td-new', title: 'New Direction' }]);
    });

    test('should update metadata', () => {
      const updates = {
        metadata: { updated: true, version: 2 }
      };

      const result = updateCharacterConcept(existingConcept, updates);

      expect(result.metadata).toEqual({ updated: true, version: 2 });
    });

    test('should throw error for invalid concept update', () => {
      expect(() => updateCharacterConcept(existingConcept, { concept: '' }))
        .toThrow('concept must be a non-empty string');
      
      expect(() => updateCharacterConcept(existingConcept, { concept: 'Too short' }))
        .toThrow('concept must be between 10 and 1000 characters');
    });

    test('should throw error for invalid status', () => {
      expect(() => updateCharacterConcept(existingConcept, { status: 'invalid-status' }))
        .toThrow('invalid status');
    });

    test('should throw error for invalid existingConcept', () => {
      expect(() => updateCharacterConcept(null, {}))
        .toThrow('existingConcept must be a valid object');
      
      expect(() => updateCharacterConcept(undefined, {}))
        .toThrow('existingConcept must be a valid object');
    });

    test('should throw error for invalid updates', () => {
      expect(() => updateCharacterConcept(existingConcept, null))
        .toThrow('updates must be a valid object');
      
      expect(() => updateCharacterConcept(existingConcept, undefined))
        .toThrow('updates must be a valid object');
    });

    test('should preserve existing fields not in updates', () => {
      const updates = {
        status: CHARACTER_CONCEPT_STATUS.COMPLETED
      };

      const result = updateCharacterConcept(existingConcept, updates);

      expect(result.id).toBe(existingConcept.id);
      expect(result.concept).toBe(existingConcept.concept);
      expect(result.createdAt).toEqual(existingConcept.createdAt);
      expect(result.thematicDirections).toEqual(existingConcept.thematicDirections);
      expect(result.metadata).toEqual(existingConcept.metadata);
    });
  });

  describe('validateCharacterConcept', () => {
    test('should return true for valid character concept', async () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'A brave adventurer with a mysterious past',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        thematicDirections: [],
        metadata: {}
      };

      const result = await validateCharacterConcept(concept, mockSchemaValidator);
      
      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'character-concept.schema.json',
        expect.objectContaining({
          id: concept.id,
          concept: concept.concept,
          status: concept.status,
          createdAt: expect.any(String), // Date converted to ISO string
          updatedAt: expect.any(String)
        })
      );
    });

    test('should throw error for invalid concept', async () => {
      const concept = {
        id: 'invalid-id',
        // Missing required fields
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          { instancePath: '/concept', message: 'must be string' },
          { instancePath: '/status', message: 'must be string' }
        ]
      });

      await expect(validateCharacterConcept(concept, mockSchemaValidator))
        .rejects.toThrow('CharacterConcept validation failed: /concept: must be string, /status: must be string');
    });

    test('should throw error for null or undefined concept', async () => {
      await expect(validateCharacterConcept(null, mockSchemaValidator))
        .rejects.toThrow('concept must be a valid object');
      await expect(validateCharacterConcept(undefined, mockSchemaValidator))
        .rejects.toThrow('concept must be a valid object');
    });

    test('should throw error if schemaValidator is missing', async () => {
      const concept = { id: 'test' };
      
      await expect(validateCharacterConcept(concept, null))
        .rejects.toThrow('Missing required dependency: ISchemaValidator');
    });
  });

  describe('serializeCharacterConcept', () => {
    test('should serialize concept with Date objects', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T12:00:00Z'),
        thematicDirections: [],
        metadata: {}
      };

      const result = serializeCharacterConcept(concept);

      expect(result).toEqual({
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T12:00:00.000Z',
        thematicDirections: [],
        metadata: {}
      });
    });

    test('should handle concept already serialized', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T12:00:00.000Z',
        thematicDirections: [],
        metadata: {}
      };

      const result = serializeCharacterConcept(concept);

      expect(result).toEqual(concept);
    });

    test('should throw error for invalid input', () => {
      expect(() => serializeCharacterConcept(null))
        .toThrow('concept must be a valid object');
      expect(() => serializeCharacterConcept(undefined))
        .toThrow('concept must be a valid object');
    });
  });

  describe('deserializeCharacterConcept', () => {
    test('should deserialize concept with ISO date strings', () => {
      const data = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T12:00:00.000Z',
        thematicDirections: [],
        metadata: {}
      };

      const result = deserializeCharacterConcept(data);

      expect(result).toEqual({
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T12:00:00.000Z'),
        thematicDirections: [],
        metadata: {}
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle concept already deserialized', () => {
      const data = {
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'Test concept',
        status: CHARACTER_CONCEPT_STATUS.DRAFT,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T12:00:00Z'),
        thematicDirections: [],
        metadata: {}
      };

      const result = deserializeCharacterConcept(data);

      expect(result).toEqual(data);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should throw error for invalid input', () => {
      expect(() => deserializeCharacterConcept(null))
        .toThrow('data must be a valid object');
      expect(() => deserializeCharacterConcept(undefined))
        .toThrow('data must be a valid object');
    });
  });

  describe('CHARACTER_CONCEPT_STATUS', () => {
    test('should have correct status constants', () => {
      expect(CHARACTER_CONCEPT_STATUS).toEqual({
        DRAFT: 'draft',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        ERROR: 'error'
      });
    });
  });

  describe('edge cases', () => {
    test('should handle unicode characters in concept', () => {
      const conceptText = 'Héro Tëst 🧙‍♂️ with émojis 🗡️⚔️';

      const result = createCharacterConcept(conceptText);

      expect(result.concept).toBe('Héro Tëst 🧙‍♂️ with émojis 🗡️⚔️');
    });

    test('should handle concept with exact minimum length', () => {
      const conceptText = '1234567890'; // Exactly 10 characters

      const result = createCharacterConcept(conceptText);

      expect(result.concept).toBe('1234567890');
    });

    test('should handle concept with exact maximum length', () => {
      const conceptText = 'a'.repeat(1000); // Exactly 1000 characters

      const result = createCharacterConcept(conceptText);

      expect(result.concept).toBe(conceptText);
    });

    test('should handle HTML-like content in concept', () => {
      const conceptText = 'A <strong>hero</strong> with <script>alert("test")</script> content';

      const result = createCharacterConcept(conceptText);

      // Should preserve the content as-is (sanitization should happen at display time)
      expect(result.concept).toBe('A <strong>hero</strong> with <script>alert("test")</script> content');
    });

    test('should handle newlines and special characters in concept', () => {
      const conceptText = 'A hero with\nmultiple lines\tand tabs';

      const result = createCharacterConcept(conceptText);

      expect(result.concept).toBe('A hero with\nmultiple lines\tand tabs');
    });
  });
});