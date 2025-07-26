/**
 * @file Unit tests for ThematicDirection model functions
 * @see src/characterBuilder/models/thematicDirection.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import {
  createThematicDirection,
  createThematicDirectionsFromLLMResponse,
  validateThematicDirection,
  serializeThematicDirection,
  deserializeThematicDirection,
  validateThematicDirections,
} from '../../../../src/characterBuilder/models/thematicDirection.js';
import { BaseTestBed } from '../../../common/baseTestBed.js';

describe('ThematicDirection Model', () => {
  let testBed;
  let mockSchemaValidator;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    testBed = new BaseTestBed();
    
    // Create mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    testBed.cleanup();
  });

  describe('createThematicDirection', () => {
    const validData = {
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
    };

    describe('successful creation', () => {
      it('should create thematic direction with valid input', () => {
        const conceptId = uuidv4();
        const result = createThematicDirection(conceptId, validData);

        expect(result).toEqual({
          id: expect.any(String),
          conceptId: conceptId,
          title: validData.title,
          description: validData.description,
          coreTension: validData.coreTension,
          uniqueTwist: validData.uniqueTwist,
          narrativePotential: validData.narrativePotential,
          createdAt: '2024-01-15T12:00:00.000Z',
          llmMetadata: {},
        });
        expect(result.id).toMatch(/^[a-f0-9\-]{36}$/); // UUID format
      });

      it('should create thematic direction with custom ID', () => {
        const conceptId = uuidv4();
        const customId = uuidv4();
        const result = createThematicDirection(conceptId, validData, { id: customId });

        expect(result.id).toBe(customId);
      });

      it('should create thematic direction with llmMetadata', () => {
        const conceptId = uuidv4();
        const llmMetadata = {
          modelId: 'gpt-4',
          promptTokens: 100,
          responseTokens: 200,
          processingTime: 1500,
        };
        const result = createThematicDirection(conceptId, validData, { llmMetadata });

        expect(result.llmMetadata).toEqual(llmMetadata);
      });

      it('should trim all string fields', () => {
        const conceptId = '  ' + uuidv4() + '  ';
        const dataWithWhitespace = {
          title: '  The Reluctant Hero  ',
          description: '  A character who must overcome their fears to become the hero  ',
          coreTension: '  Fear vs. Duty - Internal struggle  ',
          uniqueTwist: '  The hero gains power from their fears  ',
          narrativePotential: '  Rich character development arc  ',
        };

        const result = createThematicDirection(conceptId, dataWithWhitespace);

        expect(result.conceptId).toBe(conceptId.trim());
        expect(result.title).toBe('The Reluctant Hero');
        expect(result.description).toBe('A character who must overcome their fears to become the hero');
        expect(result.coreTension).toBe('Fear vs. Duty - Internal struggle');
        expect(result.uniqueTwist).toBe('The hero gains power from their fears');
        expect(result.narrativePotential).toBe('Rich character development arc');
      });

      it('should generate unique IDs when no custom ID provided', () => {
        const conceptId = uuidv4();
        const result1 = createThematicDirection(conceptId, validData);
        const result2 = createThematicDirection(conceptId, validData);

        expect(result1.id).not.toBe(result2.id);
        expect(result1.id).toMatch(/^[a-f0-9\-]{36}$/);
        expect(result2.id).toMatch(/^[a-f0-9\-]{36}$/);
      });
    });

    describe('parameter validation', () => {
      it('should throw error for null conceptId', () => {
        expect(() => {
          createThematicDirection(null, validData);
        }).toThrow('ThematicDirection: conceptId must be a non-empty string');
      });

      it('should throw error for empty string conceptId', () => {
        expect(() => {
          createThematicDirection('', validData);
        }).toThrow('ThematicDirection: conceptId must be a non-empty string');
      });

      it('should throw error for whitespace-only conceptId', () => {
        expect(() => {
          createThematicDirection('   ', validData);
        }).toThrow('ThematicDirection: conceptId must be a non-empty string');
      });

      it('should throw error for non-string conceptId', () => {
        expect(() => {
          createThematicDirection(123, validData);
        }).toThrow('ThematicDirection: conceptId must be a non-empty string');
      });

      it('should throw error for null data', () => {
        const conceptId = uuidv4();
        expect(() => {
          createThematicDirection(conceptId, null);
        }).toThrow('ThematicDirection: data must be a valid object');
      });

      it('should throw error for non-object data', () => {
        const conceptId = uuidv4();
        expect(() => {
          createThematicDirection(conceptId, 'not an object');
        }).toThrow('ThematicDirection: data must be a valid object');
      });
    });

    describe('required field validation', () => {
      const requiredFields = ['title', 'description', 'coreTension', 'uniqueTwist', 'narrativePotential'];

      requiredFields.forEach(field => {
        it(`should throw error for missing ${field}`, () => {
          const conceptId = uuidv4();
          const invalidData = { ...validData };
          delete invalidData[field];

          expect(() => {
            createThematicDirection(conceptId, invalidData);
          }).toThrow(`ThematicDirection: ${field} must be a non-empty string`);
        });

        it(`should throw error for empty ${field}`, () => {
          const conceptId = uuidv4();
          const invalidData = { ...validData, [field]: '' };

          expect(() => {
            createThematicDirection(conceptId, invalidData);
          }).toThrow(`ThematicDirection: ${field} must be a non-empty string`);
        });

        it(`should throw error for whitespace-only ${field}`, () => {
          const conceptId = uuidv4();
          const invalidData = { ...validData, [field]: '   ' };

          expect(() => {
            createThematicDirection(conceptId, invalidData);
          }).toThrow(`ThematicDirection: ${field} must be a non-empty string`);
        });

        it(`should throw error for non-string ${field}`, () => {
          const conceptId = uuidv4();
          const invalidData = { ...validData, [field]: 123 };

          expect(() => {
            createThematicDirection(conceptId, invalidData);
          }).toThrow(`ThematicDirection: ${field} must be a non-empty string`);
        });
      });
    });

    describe('field length validation', () => {
      const conceptId = uuidv4();

      it('should throw error for title too short', () => {
        const invalidData = { ...validData, title: 'Shrt' }; // 4 chars, min is 5

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: title must be between 5 and 200 characters');
      });

      it('should throw error for title too long', () => {
        const invalidData = { ...validData, title: 'A'.repeat(201) }; // 201 chars, max is 200

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: title must be between 5 and 200 characters');
      });

      it('should accept title at minimum length', () => {
        const data = { ...validData, title: 'Title' }; // Exactly 5 chars
        const result = createThematicDirection(conceptId, data);
        expect(result.title).toBe('Title');
      });

      it('should accept title at maximum length', () => {
        const data = { ...validData, title: 'A'.repeat(200) }; // Exactly 200 chars
        const result = createThematicDirection(conceptId, data);
        expect(result.title).toBe('A'.repeat(200));
      });

      it('should throw error for description too short', () => {
        const invalidData = { ...validData, description: 'Short description.' }; // 18 chars, min is 20

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: description must be between 20 and 2000 characters');
      });

      it('should throw error for description too long', () => {
        const invalidData = { ...validData, description: 'A'.repeat(2001) }; // 2001 chars, max is 2000

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: description must be between 20 and 2000 characters');
      });

      it('should accept description at minimum length', () => {
        const data = { ...validData, description: 'A'.repeat(20) }; // Exactly 20 chars
        const result = createThematicDirection(conceptId, data);
        expect(result.description).toBe('A'.repeat(20));
      });

      it('should accept description at maximum length', () => {
        const data = { ...validData, description: 'A'.repeat(2000) }; // Exactly 2000 chars
        const result = createThematicDirection(conceptId, data);
        expect(result.description).toBe('A'.repeat(2000));
      });

      it('should throw error for coreTension too short', () => {
        const invalidData = { ...validData, coreTension: 'Too short' }; // 9 chars, min is 10

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: coreTension must be between 10 and 500 characters');
      });

      it('should throw error for coreTension too long', () => {
        const invalidData = { ...validData, coreTension: 'A'.repeat(501) }; // 501 chars, max is 500

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: coreTension must be between 10 and 500 characters');
      });

      it('should throw error for uniqueTwist too short', () => {
        const invalidData = { ...validData, uniqueTwist: 'Too short' }; // 9 chars, min is 10

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: uniqueTwist must be between 10 and 500 characters');
      });

      it('should throw error for uniqueTwist too long', () => {
        const invalidData = { ...validData, uniqueTwist: 'A'.repeat(501) }; // 501 chars, max is 500

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: uniqueTwist must be between 10 and 500 characters');
      });

      it('should throw error for narrativePotential too short', () => {
        const invalidData = { ...validData, narrativePotential: 'Too short' }; // 9 chars, min is 10

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: narrativePotential must be between 10 and 1000 characters');
      });

      it('should throw error for narrativePotential too long', () => {
        const invalidData = { ...validData, narrativePotential: 'A'.repeat(1001) }; // 1001 chars, max is 1000

        expect(() => {
          createThematicDirection(conceptId, invalidData);
        }).toThrow('ThematicDirection: narrativePotential must be between 10 and 1000 characters');
      });
    });
  });

  describe('createThematicDirectionsFromLLMResponse', () => {
    const validData = {
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
    };

    it('should create multiple thematic directions from array', () => {
      const conceptId = uuidv4();
      const directionsData = [
        validData,
        {
          ...validData,
          title: 'The Fallen Saint',
          description: 'A once-pure character who has been corrupted by the very power they sought to protect',
        },
      ];
      const llmMetadata = { modelId: 'gpt-4', promptTokens: 100 };

      const results = createThematicDirectionsFromLLMResponse(conceptId, directionsData, llmMetadata);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('The Reluctant Hero');
      expect(results[1].title).toBe('The Fallen Saint');
      expect(results[0].llmMetadata).toEqual(llmMetadata);
      expect(results[1].llmMetadata).toEqual(llmMetadata);
    });

    it('should create single thematic direction from array with one item', () => {
      const conceptId = uuidv4();
      const directionsData = [validData];

      const results = createThematicDirectionsFromLLMResponse(conceptId, directionsData);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('The Reluctant Hero');
    });

    it('should throw error for non-array input', () => {
      const conceptId = uuidv4();

      expect(() => {
        createThematicDirectionsFromLLMResponse(conceptId, 'not an array');
      }).toThrow('ThematicDirection: directionsData must be an array');
    });

    it('should throw error for empty array', () => {
      const conceptId = uuidv4();

      expect(() => {
        createThematicDirectionsFromLLMResponse(conceptId, []);
      }).toThrow('ThematicDirection: directionsData cannot be empty');
    });

    it('should propagate errors from createThematicDirection', () => {
      const conceptId = uuidv4();
      const invalidData = { ...validData, title: '' }; // Invalid: empty title

      expect(() => {
        createThematicDirectionsFromLLMResponse(conceptId, [invalidData]);
      }).toThrow('ThematicDirection: title must be a non-empty string');
    });
  });

  describe('validateThematicDirection', () => {
    const validDirection = {
      id: uuidv4(),
      conceptId: uuidv4(),
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
      createdAt: '2024-01-15T12:00:00.000Z',
      llmMetadata: {},
    };

    it('should validate a valid thematic direction', async () => {
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = await validateThematicDirection(validDirection, mockSchemaValidator);

      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'thematic-direction.schema.json',
        validDirection
      );
    });

    it('should throw error for invalid schema validator', async () => {
      const invalidValidator = {}; // Missing required 'validate' method

      await expect(
        validateThematicDirection(validDirection, invalidValidator)
      ).rejects.toThrow();
    });

    it('should throw error for null direction', async () => {
      await expect(
        validateThematicDirection(null, mockSchemaValidator)
      ).rejects.toThrow('ThematicDirection: direction must be a valid object');
    });

    it('should throw error for non-object direction', async () => {
      await expect(
        validateThematicDirection('not an object', mockSchemaValidator)
      ).rejects.toThrow('ThematicDirection: direction must be a valid object');
    });

    it('should throw error with formatted validation errors', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          { instancePath: '/title', message: 'must be string' },
          { instancePath: '/description', message: 'must have minimum length of 20' },
          { instancePath: '', message: 'must have required property \'coreTension\'' },
        ],
      });

      await expect(
        validateThematicDirection(validDirection, mockSchemaValidator)
      ).rejects.toThrow(
        'ThematicDirection validation failed: /title: must be string, /description: must have minimum length of 20, root: must have required property \'coreTension\''
      );
    });

    it('should handle validation errors without instancePath', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          { message: 'invalid format' },
        ],
      });

      await expect(
        validateThematicDirection(validDirection, mockSchemaValidator)
      ).rejects.toThrow('ThematicDirection validation failed: root: invalid format');
    });
  });

  describe('serializeThematicDirection', () => {
    const validDirection = {
      id: uuidv4(),
      conceptId: uuidv4(),
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
      createdAt: '2024-01-15T12:00:00.000Z',
      llmMetadata: { modelId: 'gpt-4' },
    };

    it('should serialize a valid thematic direction', () => {
      const result = serializeThematicDirection(validDirection);

      expect(result).toEqual(validDirection);
      // Ensure it's a new object
      expect(result).not.toBe(validDirection);
    });

    it('should throw error for null direction', () => {
      expect(() => {
        serializeThematicDirection(null);
      }).toThrow('ThematicDirection: direction must be a valid object');
    });

    it('should throw error for non-object direction', () => {
      expect(() => {
        serializeThematicDirection('not an object');
      }).toThrow('ThematicDirection: direction must be a valid object');
    });
  });

  describe('deserializeThematicDirection', () => {
    const serializedData = {
      id: uuidv4(),
      conceptId: uuidv4(),
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
      createdAt: '2024-01-15T12:00:00.000Z',
      llmMetadata: { modelId: 'gpt-4' },
    };

    it('should deserialize valid data', () => {
      const result = deserializeThematicDirection(serializedData);

      expect(result).toEqual(serializedData);
      // Ensure it's a new object
      expect(result).not.toBe(serializedData);
    });

    it('should throw error for null data', () => {
      expect(() => {
        deserializeThematicDirection(null);
      }).toThrow('ThematicDirection: data must be a valid object');
    });

    it('should throw error for non-object data', () => {
      expect(() => {
        deserializeThematicDirection('not an object');
      }).toThrow('ThematicDirection: data must be a valid object');
    });
  });

  describe('validateThematicDirections', () => {
    const validDirection1 = {
      id: uuidv4(),
      conceptId: uuidv4(),
      title: 'The Reluctant Hero',
      description: 'A character who must overcome their fears to become the hero they never wanted to be',
      coreTension: 'Fear vs. Duty - Internal struggle between self-preservation and moral obligation',
      uniqueTwist: 'The hero gains power from their fears rather than overcoming them',
      narrativePotential: 'Rich character development arc exploring the nature of courage and sacrifice',
      createdAt: '2024-01-15T12:00:00.000Z',
      llmMetadata: {},
    };

    const validDirection2 = {
      ...validDirection1,
      id: uuidv4(),
      title: 'The Fallen Saint',
    };

    it('should validate an array of valid thematic directions', async () => {
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = await validateThematicDirections([validDirection1, validDirection2], mockSchemaValidator);

      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(2);
    });

    it('should throw error for non-array input', async () => {
      await expect(
        validateThematicDirections('not an array', mockSchemaValidator)
      ).rejects.toThrow('ThematicDirection: directions must be an array');
    });

    it('should throw error with index for invalid direction', async () => {
      mockSchemaValidator.validate
        .mockReturnValueOnce({ isValid: true }) // First direction is valid
        .mockReturnValueOnce({
          isValid: false,
          errors: [{ instancePath: '/title', message: 'must be string' }],
        }); // Second direction is invalid

      await expect(
        validateThematicDirections([validDirection1, validDirection2], mockSchemaValidator)
      ).rejects.toThrow(
        'ThematicDirection validation failed at index 1: ThematicDirection validation failed: /title: must be string'
      );
    });

    it('should validate empty array', async () => {
      const result = await validateThematicDirections([], mockSchemaValidator);

      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
    });
  });
});