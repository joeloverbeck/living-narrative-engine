/**
 * @file Unit tests for CharacterConcept model functions
 * @see src/characterBuilder/models/characterConcept.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import {
  createCharacterConcept,
  updateCharacterConcept,
  validateCharacterConcept,
  serializeCharacterConcept,
  deserializeCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../../../../src/characterBuilder/models/characterConcept.js';
import { BaseTestBed } from '../../../common/baseTestBed.js';

describe('CharacterConcept Model', () => {
  let testBed;
  let mockSchemaValidator;

  beforeEach(() => {
    jest.useFakeTimers();
    testBed = new BaseTestBed();

    // Create mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('CHARACTER_CONCEPT_STATUS constants', () => {
    it('should export all status constants', () => {
      expect(CHARACTER_CONCEPT_STATUS.DRAFT).toBe('draft');
      expect(CHARACTER_CONCEPT_STATUS.PROCESSING).toBe('processing');
      expect(CHARACTER_CONCEPT_STATUS.COMPLETED).toBe('completed');
      expect(CHARACTER_CONCEPT_STATUS.ERROR).toBe('error');
    });
  });

  describe('createCharacterConcept', () => {
    describe('successful creation', () => {
      it('should create character concept with minimal valid input', () => {
        const concept = 'A brave warrior from the mountains';
        const result = createCharacterConcept(concept);

        expect(result).toEqual({
          id: expect.any(String),
          concept: concept,
          status: CHARACTER_CONCEPT_STATUS.DRAFT,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          thematicDirections: [],
          metadata: {},
        });
        expect(result.createdAt).toEqual(result.updatedAt);
      });

      it('should create character concept with custom options', () => {
        const concept = 'A wise mage with ancient knowledge';
        const customId = uuidv4();
        const options = {
          id: customId,
          status: CHARACTER_CONCEPT_STATUS.PROCESSING,
          thematicDirections: [{ id: 'test', direction: 'mystical' }],
          metadata: { source: 'test' },
        };

        const result = createCharacterConcept(concept, options);

        expect(result).toEqual({
          id: customId,
          concept: concept,
          status: CHARACTER_CONCEPT_STATUS.PROCESSING,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          thematicDirections: [{ id: 'test', direction: 'mystical' }],
          metadata: { source: 'test' },
        });
      });

      it('should trim whitespace from concept', () => {
        const concept = '  A character with surrounding whitespace  ';
        const result = createCharacterConcept(concept);

        expect(result.concept).toBe('A character with surrounding whitespace');
      });

      it('should create unique IDs when no custom ID provided', () => {
        const concept = 'Test character concept for uniqueness';
        const result1 = createCharacterConcept(concept);
        const result2 = createCharacterConcept(concept);

        expect(result1.id).not.toBe(result2.id);
        expect(result1.id).toMatch(/^[a-f0-9\-]{36}$/);
        expect(result2.id).toMatch(/^[a-f0-9\-]{36}$/);
      });
    });

    describe('validation errors', () => {
      it('should throw error for null concept', () => {
        expect(() => createCharacterConcept(null)).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should throw error for undefined concept', () => {
        expect(() => createCharacterConcept(undefined)).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should throw error for non-string concept', () => {
        expect(() => createCharacterConcept(123)).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );

        expect(() => createCharacterConcept({})).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );

        expect(() => createCharacterConcept([])).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should throw error for empty string concept', () => {
        expect(() => createCharacterConcept('')).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only concept', () => {
        expect(() => createCharacterConcept('   ')).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );

        expect(() => createCharacterConcept('\t\n  ')).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should throw error for concept shorter than 10 characters', () => {
        expect(() => createCharacterConcept('short')).toThrow(
          'CharacterConcept: concept must be at least 10 characters long'
        );

        expect(() => createCharacterConcept('9chars12')).toThrow(
          'CharacterConcept: concept must be at least 10 characters long'
        );
      });

      it('should throw error for concept longer than 6000 characters', () => {
        const longConcept = 'A'.repeat(6001);
        expect(() => createCharacterConcept(longConcept)).toThrow(
          'CharacterConcept: concept must be no more than 6000 characters long'
        );
      });

      it('should accept concept exactly at length boundaries', () => {
        // Exactly 10 characters
        const minConcept = '1234567890';
        expect(() => createCharacterConcept(minConcept)).not.toThrow();

        // Exactly 6000 characters
        const maxConcept = 'A'.repeat(6000);
        expect(() => createCharacterConcept(maxConcept)).not.toThrow();
      });
    });
  });

  describe('updateCharacterConcept', () => {
    let existingConcept;

    beforeEach(() => {
      existingConcept = createCharacterConcept(
        'Original concept for testing updates'
      );
    });

    describe('successful updates', () => {
      it('should update concept text and preserve other fields', () => {
        // Advance time to ensure different timestamp
        jest.advanceTimersByTime(100);
        const updates = {
          concept: 'Updated concept text with sufficient length',
        };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result).toEqual({
          ...existingConcept,
          concept: 'Updated concept text with sufficient length',
          updatedAt: expect.any(Date),
        });
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });

      it('should update status with valid value', () => {
        // Add a small delay to ensure different timestamps
        jest.advanceTimersByTime(1);
        const updates = { status: CHARACTER_CONCEPT_STATUS.COMPLETED };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.status).toBe(CHARACTER_CONCEPT_STATUS.COMPLETED);
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });

      it('should update thematic directions', () => {
        jest.advanceTimersByTime(50);
        const newDirections = [{ id: 'dir1', direction: 'heroic' }];
        const updates = { thematicDirections: newDirections };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.thematicDirections).toEqual(newDirections);
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });

      it('should update metadata', () => {
        jest.advanceTimersByTime(25);
        const newMetadata = { lastModified: 'user', version: 2 };
        const updates = { metadata: newMetadata };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.metadata).toEqual(newMetadata);
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });

      it('should update multiple fields simultaneously', () => {
        jest.advanceTimersByTime(75);
        const updates = {
          concept: 'New concept with enough characters for validation',
          status: CHARACTER_CONCEPT_STATUS.PROCESSING,
          metadata: { source: 'test' },
        };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.concept).toBe(
          'New concept with enough characters for validation'
        );
        expect(result.status).toBe(CHARACTER_CONCEPT_STATUS.PROCESSING);
        expect(result.metadata).toEqual({ source: 'test' });
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });

      it('should trim whitespace from updated concept', () => {
        jest.advanceTimersByTime(10);
        const updates = {
          concept: '  Updated concept with surrounding spaces  ',
        };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.concept).toBe('Updated concept with surrounding spaces');
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          existingConcept.updatedAt.getTime()
        );
      });
    });

    describe('validation errors', () => {
      it('should throw error for null existingConcept', () => {
        expect(() => updateCharacterConcept(null, {})).toThrow(
          'CharacterConcept: existingConcept must be a valid object'
        );
      });

      it('should throw error for undefined existingConcept', () => {
        expect(() => updateCharacterConcept(undefined, {})).toThrow(
          'CharacterConcept: existingConcept must be a valid object'
        );
      });

      it('should throw error for non-object existingConcept', () => {
        expect(() => updateCharacterConcept('string', {})).toThrow(
          'CharacterConcept: existingConcept must be a valid object'
        );

        expect(() => updateCharacterConcept(123, {})).toThrow(
          'CharacterConcept: existingConcept must be a valid object'
        );
      });

      it('should throw error for null updates', () => {
        expect(() => updateCharacterConcept(existingConcept, null)).toThrow(
          'CharacterConcept: updates must be a valid object'
        );
      });

      it('should throw error for undefined updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, undefined)
        ).toThrow('CharacterConcept: updates must be a valid object');
      });

      it('should throw error for non-object updates', () => {
        expect(() => updateCharacterConcept(existingConcept, 'string')).toThrow(
          'CharacterConcept: updates must be a valid object'
        );

        expect(() => updateCharacterConcept(existingConcept, 123)).toThrow(
          'CharacterConcept: updates must be a valid object'
        );
      });

      it('should throw error for empty concept in updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, { concept: '' })
        ).toThrow('CharacterConcept: concept must be a non-empty string');

        expect(() =>
          updateCharacterConcept(existingConcept, { concept: '   ' })
        ).toThrow('CharacterConcept: concept must be a non-empty string');
      });

      it('should throw error for null concept in updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, { concept: null })
        ).toThrow('CharacterConcept: concept must be a non-empty string');
      });

      it('should throw error for non-string concept in updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, { concept: 123 })
        ).toThrow('CharacterConcept: concept must be a non-empty string');
      });

      it('should throw error for concept with invalid length in updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, { concept: 'short' })
        ).toThrow(
          'CharacterConcept: concept must be between 10 and 6000 characters'
        );

        const longConcept = 'A'.repeat(6001);
        expect(() =>
          updateCharacterConcept(existingConcept, { concept: longConcept })
        ).toThrow(
          'CharacterConcept: concept must be between 10 and 6000 characters'
        );
      });

      it('should throw error for invalid status in updates', () => {
        expect(() =>
          updateCharacterConcept(existingConcept, { status: 'invalid' })
        ).toThrow(
          "CharacterConcept: invalid status 'invalid'. Must be one of: draft, processing, completed, error"
        );

        expect(() =>
          updateCharacterConcept(existingConcept, { status: null })
        ).toThrow(
          "CharacterConcept: invalid status 'null'. Must be one of: draft, processing, completed, error"
        );

        expect(() =>
          updateCharacterConcept(existingConcept, { status: 123 })
        ).toThrow(
          "CharacterConcept: invalid status '123'. Must be one of: draft, processing, completed, error"
        );
      });
    });
  });

  describe('validateCharacterConcept', () => {
    let mockConcept;

    beforeEach(() => {
      mockConcept = createCharacterConcept(
        'Valid concept for validation testing'
      );
    });

    describe('successful validation', () => {
      it('should validate concept with schema validator returning true', async () => {
        mockSchemaValidator.validate.mockReturnValue({ isValid: true });

        const result = await validateCharacterConcept(
          mockConcept,
          mockSchemaValidator
        );

        expect(result).toBe(true);
        expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
          'schema://living-narrative-engine/character-concept.schema.json',
          expect.objectContaining({
            id: mockConcept.id,
            concept: mockConcept.concept,
            status: mockConcept.status,
            createdAt: mockConcept.createdAt.toISOString(),
            updatedAt: mockConcept.updatedAt.toISOString(),
            thematicDirections: mockConcept.thematicDirections,
            metadata: mockConcept.metadata,
          })
        );
      });

      it('should convert Date objects to ISO strings for validation', async () => {
        const conceptWithDates = {
          ...mockConcept,
          createdAt: new Date('2023-01-01T10:00:00Z'),
          updatedAt: new Date('2023-01-02T15:30:00Z'),
        };
        mockSchemaValidator.validate.mockReturnValue({ isValid: true });

        await validateCharacterConcept(conceptWithDates, mockSchemaValidator);

        expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
          'schema://living-narrative-engine/character-concept.schema.json',
          expect.objectContaining({
            createdAt: '2023-01-01T10:00:00.000Z',
            updatedAt: '2023-01-02T15:30:00.000Z',
          })
        );
      });

      it('should preserve non-Date values in date fields during validation', async () => {
        const conceptWithStringDates = {
          ...mockConcept,
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-02T15:30:00Z',
        };
        mockSchemaValidator.validate.mockReturnValue({ isValid: true });

        await validateCharacterConcept(
          conceptWithStringDates,
          mockSchemaValidator
        );

        expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
          'schema://living-narrative-engine/character-concept.schema.json',
          expect.objectContaining({
            createdAt: '2023-01-01T10:00:00Z',
            updatedAt: '2023-01-02T15:30:00Z',
          })
        );
      });
    });

    describe('validation errors', () => {
      it('should throw error for invalid schema validator', async () => {
        const invalidValidator = {};

        await expect(
          validateCharacterConcept(mockConcept, invalidValidator)
        ).rejects.toThrow();
      });

      it('should throw error for null concept', async () => {
        await expect(
          validateCharacterConcept(null, mockSchemaValidator)
        ).rejects.toThrow('CharacterConcept: concept must be a valid object');
      });

      it('should throw error for undefined concept', async () => {
        await expect(
          validateCharacterConcept(undefined, mockSchemaValidator)
        ).rejects.toThrow('CharacterConcept: concept must be a valid object');
      });

      it('should throw error for non-object concept', async () => {
        await expect(
          validateCharacterConcept('string', mockSchemaValidator)
        ).rejects.toThrow('CharacterConcept: concept must be a valid object');

        await expect(
          validateCharacterConcept(123, mockSchemaValidator)
        ).rejects.toThrow('CharacterConcept: concept must be a valid object');
      });

      it('should throw error when schema validation fails', async () => {
        const validationErrors = [
          { instancePath: '/concept', message: 'should be string' },
          { instancePath: '/status', message: 'should be one of enum values' },
        ];
        mockSchemaValidator.validate.mockReturnValue({
          isValid: false,
          errors: validationErrors,
        });

        await expect(
          validateCharacterConcept(mockConcept, mockSchemaValidator)
        ).rejects.toThrow(
          'CharacterConcept validation failed: /concept: should be string, /status: should be one of enum values'
        );
      });

      it('should handle schema errors without instancePath', async () => {
        const validationErrors = [
          { message: 'should have required property id' },
        ];
        mockSchemaValidator.validate.mockReturnValue({
          isValid: false,
          errors: validationErrors,
        });

        await expect(
          validateCharacterConcept(mockConcept, mockSchemaValidator)
        ).rejects.toThrow(
          'CharacterConcept validation failed: root: should have required property id'
        );
      });

      it('should handle multiple schema validation errors', async () => {
        const validationErrors = [
          { instancePath: '/concept', message: 'should be string' },
          { instancePath: '/id', message: 'should be UUID' },
          { message: 'global error' },
        ];
        mockSchemaValidator.validate.mockReturnValue({
          isValid: false,
          errors: validationErrors,
        });

        await expect(
          validateCharacterConcept(mockConcept, mockSchemaValidator)
        ).rejects.toThrow(
          'CharacterConcept validation failed: /concept: should be string, /id: should be UUID, root: global error'
        );
      });
    });
  });

  describe('serializeCharacterConcept', () => {
    let mockConcept;

    beforeEach(() => {
      mockConcept = createCharacterConcept('Concept for serialization testing');
    });

    describe('successful serialization', () => {
      it('should serialize concept with Date objects to ISO strings', () => {
        const conceptWithDates = {
          ...mockConcept,
          createdAt: new Date('2023-01-01T10:00:00Z'),
          updatedAt: new Date('2023-01-02T15:30:00Z'),
        };

        const result = serializeCharacterConcept(conceptWithDates);

        expect(result).toEqual({
          ...conceptWithDates,
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-02T15:30:00.000Z',
        });
      });

      it('should preserve non-Date values in date fields', () => {
        const conceptWithStringDates = {
          ...mockConcept,
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-02T15:30:00Z',
        };

        const result = serializeCharacterConcept(conceptWithStringDates);

        expect(result).toEqual(conceptWithStringDates);
      });

      it('should handle invalid Date objects', () => {
        const conceptWithInvalidDates = {
          ...mockConcept,
          createdAt: new Date('invalid'),
          updatedAt: new Date('also-invalid'),
        };

        const result = serializeCharacterConcept(conceptWithInvalidDates);

        expect(result).toEqual({
          ...mockConcept,
          createdAt: conceptWithInvalidDates.createdAt,
          updatedAt: conceptWithInvalidDates.updatedAt,
        });
      });

      it('should serialize all concept properties', () => {
        const fullConcept = {
          id: 'test-id',
          concept: 'Full concept for comprehensive serialization',
          status: CHARACTER_CONCEPT_STATUS.COMPLETED,
          createdAt: new Date('2023-01-01T10:00:00Z'),
          updatedAt: new Date('2023-01-02T15:30:00Z'),
          thematicDirections: [{ id: 'dir1', direction: 'heroic' }],
          metadata: { source: 'test', version: 1 },
        };

        const result = serializeCharacterConcept(fullConcept);

        expect(result).toEqual({
          id: 'test-id',
          concept: 'Full concept for comprehensive serialization',
          status: CHARACTER_CONCEPT_STATUS.COMPLETED,
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-02T15:30:00.000Z',
          thematicDirections: [{ id: 'dir1', direction: 'heroic' }],
          metadata: { source: 'test', version: 1 },
        });
      });
    });

    describe('serialization errors', () => {
      it('should throw error for null concept', () => {
        expect(() => serializeCharacterConcept(null)).toThrow(
          'CharacterConcept: concept must be a valid object'
        );
      });

      it('should throw error for undefined concept', () => {
        expect(() => serializeCharacterConcept(undefined)).toThrow(
          'CharacterConcept: concept must be a valid object'
        );
      });

      it('should throw error for non-object concept', () => {
        expect(() => serializeCharacterConcept('string')).toThrow(
          'CharacterConcept: concept must be a valid object'
        );

        expect(() => serializeCharacterConcept(123)).toThrow(
          'CharacterConcept: concept must be a valid object'
        );

        // Arrays are objects in JavaScript, so they pass the validation
        expect(() => serializeCharacterConcept([])).not.toThrow();
      });
    });
  });

  describe('deserializeCharacterConcept', () => {
    describe('successful deserialization', () => {
      it('should deserialize concept with string dates to Date objects', () => {
        const serializedConcept = {
          id: 'test-id',
          concept: 'Concept for deserialization testing',
          status: CHARACTER_CONCEPT_STATUS.DRAFT,
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-02T15:30:00.000Z',
          thematicDirections: [],
          metadata: {},
        };

        const result = deserializeCharacterConcept(serializedConcept);

        expect(result).toEqual({
          id: 'test-id',
          concept: 'Concept for deserialization testing',
          status: CHARACTER_CONCEPT_STATUS.DRAFT,
          createdAt: new Date('2023-01-01T10:00:00.000Z'),
          updatedAt: new Date('2023-01-02T15:30:00.000Z'),
          thematicDirections: [],
          metadata: {},
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      it('should preserve non-string values in date fields', () => {
        const dataWithDateObjects = {
          id: 'test-id',
          concept: 'Concept with existing Date objects',
          status: CHARACTER_CONCEPT_STATUS.PROCESSING,
          createdAt: new Date('2023-01-01T10:00:00Z'),
          updatedAt: new Date('2023-01-02T15:30:00Z'),
          thematicDirections: [{ id: 'dir1', direction: 'mystical' }],
          metadata: { source: 'test' },
        };

        const result = deserializeCharacterConcept(dataWithDateObjects);

        expect(result).toEqual(dataWithDateObjects);
      });

      it('should handle null date values', () => {
        const dataWithNullDates = {
          id: 'test-id',
          concept: 'Concept with null date values',
          status: CHARACTER_CONCEPT_STATUS.ERROR,
          createdAt: null,
          updatedAt: null,
          thematicDirections: [],
          metadata: {},
        };

        const result = deserializeCharacterConcept(dataWithNullDates);

        expect(result).toEqual(dataWithNullDates);
      });

      it('should deserialize complete concept with all properties', () => {
        const fullSerializedConcept = {
          id: 'full-test-id',
          concept: 'Complete concept for full deserialization testing',
          status: CHARACTER_CONCEPT_STATUS.COMPLETED,
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-02T15:30:00.000Z',
          thematicDirections: [
            { id: 'dir1', direction: 'heroic' },
            { id: 'dir2', direction: 'mystical' },
          ],
          metadata: {
            source: 'test-suite',
            version: 2,
            tags: ['fantasy', 'adventure'],
          },
        };

        const result = deserializeCharacterConcept(fullSerializedConcept);

        expect(result).toEqual({
          id: 'full-test-id',
          concept: 'Complete concept for full deserialization testing',
          status: CHARACTER_CONCEPT_STATUS.COMPLETED,
          createdAt: new Date('2023-01-01T10:00:00.000Z'),
          updatedAt: new Date('2023-01-02T15:30:00.000Z'),
          thematicDirections: [
            { id: 'dir1', direction: 'heroic' },
            { id: 'dir2', direction: 'mystical' },
          ],
          metadata: {
            source: 'test-suite',
            version: 2,
            tags: ['fantasy', 'adventure'],
          },
        });
      });
    });

    describe('deserialization errors', () => {
      it('should throw error for null data', () => {
        expect(() => deserializeCharacterConcept(null)).toThrow(
          'CharacterConcept: data must be a valid object'
        );
      });

      it('should throw error for undefined data', () => {
        expect(() => deserializeCharacterConcept(undefined)).toThrow(
          'CharacterConcept: data must be a valid object'
        );
      });

      it('should throw error for non-object data', () => {
        expect(() => deserializeCharacterConcept('string')).toThrow(
          'CharacterConcept: data must be a valid object'
        );

        expect(() => deserializeCharacterConcept(123)).toThrow(
          'CharacterConcept: data must be a valid object'
        );

        // Arrays are objects in JavaScript, so they pass the validation
        expect(() => deserializeCharacterConcept([])).not.toThrow();
      });
    });
  });
});
