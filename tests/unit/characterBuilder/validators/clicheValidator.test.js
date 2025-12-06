/**
 * @file Unit tests for cliché validation utilities
 *
 * Tests comprehensive validation functions for cliché operations including:
 * - Direction selection validation
 * - Generation prerequisite validation
 * - LLM response structure validation
 * - Data sanitization and security
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateDirectionSelection,
  validateGenerationPrerequisites,
  validateLLMResponse,
  validateClicheData,
  sanitizeInput,
  validateAndSanitizeDirectionSelection,
  VALIDATION_CONFIG,
} from '../../../../src/characterBuilder/validators/clicheValidator.js';
import {
  ClicheValidationError,
  ClicheDataIntegrityError,
  ClichePrerequisiteError,
} from '../../../../src/errors/clicheErrors.js';

describe('Cliché Validators', () => {
  let mockDirectionsData;

  beforeEach(() => {
    // Reset validation config
    VALIDATION_CONFIG.updateConfig({
      categories: {
        minItems: 3,
        maxItems: 5,
        minTropes: 3,
        maxTropes: 10,
      },
      requiredCategories: [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ],
    });

    // Mock directions data structure
    mockDirectionsData = [
      {
        conceptId: 'concept-1',
        conceptText: 'A mysterious figure who appears at crossroads.',
        conceptTitle: 'Mysterious Figure',
        directions: [
          {
            id: 'direction-1',
            title: 'The Wise Mentor',
            description: 'An ancient mentor with deep wisdom',
            coreTension: 'Knowledge vs. Age',
          },
          {
            id: 'direction-2',
            title: 'The Trickster Guide',
            description: 'A playful but unreliable guide',
          },
        ],
      },
      {
        conceptId: 'concept-2',
        conceptText: 'A warrior from a distant land seeking redemption.',
        conceptTitle: 'Redemption Seeker',
        directions: [
          {
            id: 'direction-3',
            title: 'The Fallen Hero',
            description: 'Once great, now seeking to make amends',
          },
        ],
      },
    ];
  });

  describe('validateDirectionSelection', () => {
    it('should validate correct direction selection', () => {
      const result = validateDirectionSelection(
        'direction-1',
        mockDirectionsData
      );

      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('concept');
      expect(result.direction.id).toBe('direction-1');
      expect(result.direction.title).toBe('The Wise Mentor');
      expect(result.concept.id).toBe('concept-1');
      expect(result.concept.text).toBe(
        'A mysterious figure who appears at crossroads.'
      );
    });

    it('should throw ClicheValidationError for empty direction ID', () => {
      expect(() => {
        validateDirectionSelection('', mockDirectionsData);
      }).toThrow(ClicheValidationError);

      expect(() => {
        validateDirectionSelection('   ', mockDirectionsData);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for null/undefined direction ID', () => {
      expect(() => {
        validateDirectionSelection(null, mockDirectionsData);
      }).toThrow(ClicheValidationError);

      expect(() => {
        validateDirectionSelection(undefined, mockDirectionsData);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheDataIntegrityError for invalid directions data', () => {
      expect(() => {
        validateDirectionSelection('direction-1', null);
      }).toThrow(ClicheDataIntegrityError);

      expect(() => {
        validateDirectionSelection('direction-1', []);
      }).toThrow(ClicheDataIntegrityError);

      expect(() => {
        validateDirectionSelection('direction-1', 'invalid');
      }).toThrow(ClicheDataIntegrityError);
    });

    it('should throw ClicheValidationError for non-existent direction', () => {
      expect(() => {
        validateDirectionSelection('non-existent-id', mockDirectionsData);
      }).toThrow(ClicheValidationError);

      const error = (() => {
        try {
          validateDirectionSelection('non-existent-id', mockDirectionsData);
        } catch (e) {
          return e;
        }
      })();

      expect(error.validationErrors[0]).toContain('non-existent-id');
      expect(error.details.availableIds).toBeDefined();
      expect(error.details.availableIds).toContain('direction-1');
    });

    it('should throw ClicheDataIntegrityError for direction with missing required fields', () => {
      const invalidDirectionsData = [
        {
          conceptId: 'concept-1',
          conceptText: 'Valid concept',
          conceptTitle: 'Valid Title',
          directions: [
            {
              id: 'direction-1',
              // Missing title and description
            },
          ],
        },
      ];

      expect(() => {
        validateDirectionSelection('direction-1', invalidDirectionsData);
      }).toThrow(ClicheDataIntegrityError);
    });

    it('should detect directions that lose required identifiers after retrieval', () => {
      const dynamicDirection = {
        title: 'Fluxing Title',
        description: 'Fluxing',
      };
      let accessCount = 0;
      Object.defineProperty(dynamicDirection, 'id', {
        configurable: true,
        enumerable: true,
        get() {
          accessCount += 1;
          return accessCount === 1 ? 'direction-dynamic' : '';
        },
      });

      const data = [
        {
          conceptId: 'concept-flux',
          conceptText: 'Temporal anomalies everywhere.',
          conceptTitle: 'Temporal Flux',
          directions: [dynamicDirection],
        },
      ];

      expect(() => {
        validateDirectionSelection('direction-dynamic', data);
      }).toThrow(ClicheDataIntegrityError);
    });

    it('should handle malformed directions data gracefully', () => {
      const malformedData = [
        {
          conceptId: 'concept-1',
          directions: null, // Invalid directions array
        },
      ];

      expect(() => {
        validateDirectionSelection('direction-1', malformedData);
      }).toThrow(ClicheValidationError);
    });

    it('should find direction across multiple concept groups', () => {
      const result = validateDirectionSelection(
        'direction-3',
        mockDirectionsData
      );

      expect(result.direction.id).toBe('direction-3');
      expect(result.concept.id).toBe('concept-2');
    });
  });

  describe('validateGenerationPrerequisites', () => {
    let mockDirection, mockConcept;

    beforeEach(() => {
      mockDirection = {
        id: 'direction-1',
        title: 'Test Direction',
        description: 'Test description',
      };

      mockConcept = {
        id: 'concept-1',
        text: 'Test concept text',
      };
    });

    it('should pass validation with all prerequisites met', () => {
      expect(() => {
        validateGenerationPrerequisites(mockDirection, mockConcept, false);
      }).not.toThrow();
    });

    it('should throw ClicheValidationError if generation is in progress', () => {
      expect(() => {
        validateGenerationPrerequisites(mockDirection, mockConcept, true);
      }).toThrow(ClicheValidationError);

      const error = (() => {
        try {
          validateGenerationPrerequisites(mockDirection, mockConcept, true);
        } catch (e) {
          return e;
        }
      })();

      expect(error.validationErrors[0]).toContain('another is running');
    });

    it('should throw ClichePrerequisiteError for missing direction', () => {
      expect(() => {
        validateGenerationPrerequisites(null, mockConcept, false);
      }).toThrow(ClichePrerequisiteError);

      expect(() => {
        validateGenerationPrerequisites(undefined, mockConcept, false);
      }).toThrow(ClichePrerequisiteError);
    });

    it('should throw ClichePrerequisiteError for missing concept', () => {
      expect(() => {
        validateGenerationPrerequisites(mockDirection, null, false);
      }).toThrow(ClichePrerequisiteError);
    });

    it('should throw ClichePrerequisiteError for invalid direction structure', () => {
      const invalidDirection = { id: 'test' }; // Missing title

      expect(() => {
        validateGenerationPrerequisites(invalidDirection, mockConcept, false);
      }).toThrow(ClichePrerequisiteError);
    });

    it('should throw ClichePrerequisiteError for invalid concept structure', () => {
      const invalidConcept = { id: 'test' }; // Missing text

      expect(() => {
        validateGenerationPrerequisites(mockDirection, invalidConcept, false);
      }).toThrow(ClichePrerequisiteError);
    });

    it('should handle additional checks for LLM availability', () => {
      const additionalChecks = {
        requiresLLMAvailability: true,
        llmAvailable: false,
      };

      expect(() => {
        validateGenerationPrerequisites(
          mockDirection,
          mockConcept,
          false,
          additionalChecks
        );
      }).toThrow(ClichePrerequisiteError);

      const error = (() => {
        try {
          validateGenerationPrerequisites(
            mockDirection,
            mockConcept,
            false,
            additionalChecks
          );
        } catch (e) {
          return e;
        }
      })();

      expect(error.missingPrerequisites).toContain('LLM service availability');
    });

    it('should handle additional checks for storage availability', () => {
      const additionalChecks = {
        requiresStorageAccess: true,
        storageAvailable: false,
      };

      expect(() => {
        validateGenerationPrerequisites(
          mockDirection,
          mockConcept,
          false,
          additionalChecks
        );
      }).toThrow(ClichePrerequisiteError);
    });

    it('should collect all missing prerequisites', () => {
      const additionalChecks = {
        requiresLLMAvailability: true,
        llmAvailable: false,
        requiresStorageAccess: true,
        storageAvailable: false,
      };

      const error = (() => {
        try {
          validateGenerationPrerequisites(null, null, false, additionalChecks);
        } catch (e) {
          return e;
        }
      })();

      expect(error.missingPrerequisites).toContain('direction selection');
      expect(error.missingPrerequisites).toContain('concept data');
      expect(error.missingPrerequisites).toContain('LLM service availability');
      expect(error.missingPrerequisites).toContain('storage access');
    });
  });

  describe('validateLLMResponse', () => {
    let validResponse;

    beforeEach(() => {
      validResponse = {
        categories: {
          names: ['John', 'Mary', 'Bob'],
          physicalDescriptions: ['Tall', 'Dark hair', 'Green eyes'],
          personalityTraits: ['Brave', 'Kind', 'Stubborn'],
          skillsAbilities: ['Swordsmanship', 'Magic', 'Leadership'],
          typicalLikes: ['Adventure', 'Justice', 'Music'],
          typicalDislikes: ['Injustice', 'Cowardice', 'Lies'],
          commonFears: ['Death', 'Failure', 'Betrayal'],
          genericGoals: ['Save the world', 'Find love', 'Gain power'],
          backgroundElements: ['Noble birth', 'Tragic past', 'Secret identity'],
          overusedSecrets: ['Hidden royalty', 'Lost memory', 'Cursed'],
          speechPatterns: ['Formal speech', 'Slang', 'Accent'],
        },
        tropesAndStereotypes: [
          'The chosen one',
          'The dark past',
          'The mentor dies',
        ],
      };
    });

    it('should validate correct LLM response', () => {
      expect(() => {
        validateLLMResponse(validResponse);
      }).not.toThrow();

      const result = validateLLMResponse(validResponse);
      expect(result).toBe(true);
    });

    it('should throw ClicheValidationError for null/undefined response', () => {
      expect(() => {
        validateLLMResponse(null);
      }).toThrow(ClicheValidationError);

      expect(() => {
        validateLLMResponse(undefined);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for non-object response', () => {
      expect(() => {
        validateLLMResponse('string response');
      }).toThrow(ClicheValidationError);

      expect(() => {
        validateLLMResponse(123);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for missing categories', () => {
      const responseWithoutCategories = { tropesAndStereotypes: ['test'] };

      expect(() => {
        validateLLMResponse(responseWithoutCategories);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError when categories container is not an object', () => {
      const malformedResponse = {
        categories: 'not-an-object',
        tropesAndStereotypes: [
          'Valid trope',
          'Another trope',
          'Yet another trope',
        ],
      };

      expect(() => {
        validateLLMResponse(malformedResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for missing required category', () => {
      const incompleteResponse = { ...validResponse };
      delete incompleteResponse.categories.names;

      expect(() => {
        validateLLMResponse(incompleteResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category with wrong type', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = 'not an array';

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category with too few items', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = ['Only', 'Two']; // Need minimum 3

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category with too many items', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = [
        'One',
        'Two',
        'Three',
        'Four',
        'Five',
        'Six',
      ]; // Max 5

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category with invalid items', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = ['Valid', '', null]; // Empty string and null

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category entries with unreasonable length', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = [
        'A',
        'Sufficiently descriptive entry',
        'Another descriptive entry',
      ];

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for category with duplicate items', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.categories.names = ['John', 'Mary', 'John']; // Duplicate

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for missing tropesAndStereotypes', () => {
      const responseWithoutTropes = { categories: validResponse.categories };

      expect(() => {
        validateLLMResponse(responseWithoutTropes);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for too few tropes', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.tropesAndStereotypes = ['Only one', 'Only two']; // Need minimum 3

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for too many tropes', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.tropesAndStereotypes = Array.from(
        { length: 11 },
        () => 'A remarkably descriptive trope'
      );

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for invalid trope items', () => {
      const invalidResponse = { ...validResponse };
      invalidResponse.tropesAndStereotypes = ['Valid trope', '', 'X']; // Empty and too short

      expect(() => {
        validateLLMResponse(invalidResponse);
      }).toThrow(ClicheValidationError);
    });

    it('should collect multiple validation errors', () => {
      const badResponse = {
        categories: {
          names: ['Only one'], // Too few
          physicalDescriptions: 'not an array', // Wrong type
          // Missing other required categories
        },
        tropesAndStereotypes: ['Single trope'], // Too few
      };

      const error = (() => {
        try {
          validateLLMResponse(badResponse);
        } catch (e) {
          return e;
        }
      })();

      expect(error.validationErrors.length).toBeGreaterThan(3);
      expect(error.validationErrors.some((err) => err.includes('names'))).toBe(
        true
      );
      expect(
        error.validationErrors.some((err) =>
          err.includes('physicalDescriptions')
        )
      ).toBe(true);
      expect(
        error.validationErrors.some((err) =>
          err.includes('tropesAndStereotypes')
        )
      ).toBe(true);
    });
  });

  describe('validateClicheData', () => {
    let validClicheData;

    beforeEach(() => {
      validClicheData = {
        id: 'cliche-123',
        directionId: 'direction-456',
        conceptId: 'concept-789',
        categories: {
          names: ['Test', 'Names', 'Here'],
          physicalDescriptions: ['Desc1', 'Desc2', 'Desc3'],
          personalityTraits: ['Trait1', 'Trait2', 'Trait3'],
          skillsAbilities: ['Skill1', 'Skill2', 'Skill3'],
          typicalLikes: ['Like1', 'Like2', 'Like3'],
          typicalDislikes: ['Dislike1', 'Dislike2', 'Dislike3'],
          commonFears: ['Fear1', 'Fear2', 'Fear3'],
          genericGoals: ['Goal1', 'Goal2', 'Goal3'],
          backgroundElements: ['Element1', 'Element2', 'Element3'],
          overusedSecrets: ['Secret1', 'Secret2', 'Secret3'],
          speechPatterns: ['Pattern1', 'Pattern2', 'Pattern3'],
        },
        tropesAndStereotypes: ['Trope1', 'Trope2', 'Trope3'],
        createdAt: new Date().toISOString(),
      };
    });

    it('should validate correct cliché data', () => {
      expect(() => {
        validateClicheData(validClicheData);
      }).not.toThrow();

      const result = validateClicheData(validClicheData);
      expect(result).toBe(true);
    });

    it('should throw ClicheValidationError for null/undefined data', () => {
      expect(() => {
        validateClicheData(null);
      }).toThrow(ClicheValidationError);

      expect(() => {
        validateClicheData(undefined);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for non-object data', () => {
      expect(() => {
        validateClicheData('string');
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for missing required fields', () => {
      const incompleteData = { ...validClicheData };
      delete incompleteData.id;

      expect(() => {
        validateClicheData(incompleteData);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for empty string fields', () => {
      const invalidData = { ...validClicheData };
      invalidData.directionId = '';

      expect(() => {
        validateClicheData(invalidData);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError when tropes data is not an array', () => {
      const invalidData = { ...validClicheData };
      invalidData.tropesAndStereotypes = { unexpected: 'structure' };

      expect(() => {
        validateClicheData(invalidData);
      }).toThrow(ClicheValidationError);
    });

    it('should throw ClicheValidationError for invalid timestamp', () => {
      const invalidData = { ...validClicheData };
      invalidData.createdAt = 'invalid date';

      expect(() => {
        validateClicheData(invalidData);
      }).toThrow(ClicheValidationError);
    });

    it('should validate categories structure through LLM validation', () => {
      const invalidData = { ...validClicheData };
      invalidData.categories.names = ['Only one']; // Too few items

      expect(() => {
        validateClicheData(invalidData);
      }).toThrow(ClicheValidationError);
    });

    it('should surface unexpected errors from nested validation checks', () => {
      const invalidData = { ...validClicheData };
      const erroringCategories = {};

      Object.keys(validClicheData.categories).forEach((categoryKey) => {
        Object.defineProperty(erroringCategories, categoryKey, {
          configurable: true,
          enumerable: true,
          get() {
            throw new Error('Unexpected failure');
          },
        });
      });

      invalidData.categories = erroringCategories;

      const error = (() => {
        try {
          validateClicheData(invalidData);
        } catch (err) {
          return err;
        }
        return null;
      })();

      expect(error).toBeInstanceOf(ClicheValidationError);
      expect(error.validationErrors).toContain(
        'Categories validation failed: Unexpected failure'
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should return non-string input unchanged', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
      expect(sanitizeInput({})).toEqual({});
      expect(sanitizeInput([])).toEqual([]);
    });

    it('should remove script tags', () => {
      const maliciousInput = 'Hello <script>alert("xss")</script> World';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const maliciousInput =
        'Content <iframe src="evil.com"></iframe> more content';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).toBe('Content more content');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should remove javascript: protocol', () => {
      const maliciousInput = 'Click <a href="javascript:alert(1)">here</a>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousInput = 'Text <div onclick="badFunction()">content</div>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('onclick=');
      // The event handler content may still be partially present after attribute removal
      expect(sanitized).not.toContain('onclick=');
    });

    it('should remove data: URLs', () => {
      const maliciousInput =
        'Image <img src="data:text/html,<script>alert(1)</script>">';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('data:');
    });

    it('should remove vbscript: protocol', () => {
      const maliciousInput = 'Link <a href="vbscript:msgbox(1)">click</a>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('vbscript:');
    });

    it('should clean up excessive whitespace', () => {
      const messyInput = 'Too     many   \n\n  spaces\t\tand   tabs';
      const sanitized = sanitizeInput(messyInput);

      expect(sanitized).toBe('Too many spaces and tabs');
    });

    it('should handle complex nested attacks', () => {
      const complexAttack = '<script><script>alert(1)</script></script>';
      const sanitized = sanitizeInput(complexAttack);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should preserve legitimate content', () => {
      const legitimateInput =
        'This is a normal text with <em>emphasis</em> and numbers 123.';
      const sanitized = sanitizeInput(legitimateInput);

      expect(sanitized).toContain('normal text');
      expect(sanitized).toContain('emphasis');
      expect(sanitized).toContain('123');
    });
  });

  describe('validateAndSanitizeDirectionSelection', () => {
    it('should validate and sanitize direction selection', () => {
      const result = validateAndSanitizeDirectionSelection(
        'direction-1',
        mockDirectionsData
      );

      expect(result.direction.id).toBe('direction-1');
      expect(result.concept.id).toBe('concept-1');
      expect(result.sanitizedDirectionId).toBe('direction-1');
    });

    it('should sanitize malicious direction ID', () => {
      const maliciousId = 'direction-1<script>alert("xss")</script>';
      const result = validateAndSanitizeDirectionSelection(
        maliciousId,
        mockDirectionsData
      );

      expect(result.sanitizedDirectionId).not.toContain('<script>');
      expect(result.sanitizedDirectionId).not.toContain('alert');
    });

    it('should throw validation errors for invalid input after sanitization', () => {
      expect(() => {
        validateAndSanitizeDirectionSelection(
          '<script>bad</script>',
          mockDirectionsData
        );
      }).toThrow(ClicheValidationError);
    });
  });

  describe('VALIDATION_CONFIG', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        categories: {
          minItems: 2,
          maxItems: 6,
        },
        requiredCategories: ['names', 'descriptions'],
      };

      VALIDATION_CONFIG.updateConfig(newConfig);

      expect(VALIDATION_CONFIG.categories.minItems).toBe(2);
      expect(VALIDATION_CONFIG.categories.maxItems).toBe(6);
      expect(VALIDATION_CONFIG.requiredCategories).toEqual([
        'names',
        'descriptions',
      ]);
    });

    it('should handle partial configuration updates', () => {
      const originalMinItems = VALIDATION_CONFIG.categories.minItems;

      VALIDATION_CONFIG.updateConfig({
        categories: {
          maxItems: 8, // Only update maxItems
        },
      });

      expect(VALIDATION_CONFIG.categories.minItems).toBe(originalMinItems); // Unchanged
      expect(VALIDATION_CONFIG.categories.maxItems).toBe(8); // Updated
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long input strings', () => {
      const longString = 'x'.repeat(10000);
      const sanitized = sanitizeInput(longString);

      expect(typeof sanitized).toBe('string');
      expect(sanitized.length).toBeLessThanOrEqual(longString.length);
    });

    it('should handle unicode characters safely', () => {
      const unicodeInput = 'Hello 世界 🌍 ñoël';
      const sanitized = sanitizeInput(unicodeInput);

      expect(sanitized).toContain('世界');
      expect(sanitized).toContain('🌍');
      expect(sanitized).toContain('ñoël');
    });

    it('should handle empty directions data array gracefully', () => {
      expect(() => {
        validateDirectionSelection('any-id', []);
      }).toThrow(ClicheDataIntegrityError);
    });

    it('should handle malformed category data in LLM response', () => {
      const malformedResponse = {
        categories: {
          names: [null, undefined, '', 'valid'],
          physicalDescriptions: [1, 2, 3], // Numbers instead of strings
        },
        tropesAndStereotypes: [],
      };

      expect(() => {
        validateLLMResponse(malformedResponse);
      }).toThrow(ClicheValidationError);
    });
  });
});
