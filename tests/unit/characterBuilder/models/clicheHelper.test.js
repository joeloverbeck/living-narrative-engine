/**
 * @file Unit tests for createClichesFromLLMResponse helper function
 * @see src/characterBuilder/models/cliche.js
 */

import { describe, it, expect } from '@jest/globals';
import { createClichesFromLLMResponse } from '../../../../src/characterBuilder/models/cliche.js';

describe('createClichesFromLLMResponse', () => {
  // Sample valid inputs
  const validConceptId = 'concept-123';
  const validCategories = {
    names: ['John', 'Mary', 'Bob'],
    physicalDescriptions: ['tall and dark', 'blonde hair'],
    personalityTraits: ['brooding', 'cheerful'],
    skillsAbilities: ['swordsmanship', 'magic'],
    typicalLikes: ['justice', 'freedom'],
    typicalDislikes: ['evil', 'tyranny'],
    commonFears: ['death', 'failure'],
    genericGoals: ['save the world', 'find love'],
    backgroundElements: ['orphaned', 'royal bloodline'],
    overusedSecrets: ['secret power', 'hidden identity'],
    speechPatterns: ['ye olde english', 'catchphrases'],
  };
  const validTropesAndStereotypes = ['chosen one', 'reluctant hero'];
  const validLlmMetadata = {
    modelId: 'test-model',
    promptTokens: 100,
    responseTokens: 50,
    processingTime: 1500,
  };

  describe('successful creation', () => {
    it('should create cliche array with valid inputs', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);

      const cliche = result[0];
      expect(cliche).toHaveProperty('id');
      expect(cliche).toHaveProperty('conceptId', validConceptId);
      expect(cliche).toHaveProperty('directionId');
      expect(cliche).toHaveProperty('categories', validCategories);
      expect(cliche).toHaveProperty(
        'tropesAndStereotypes',
        validTropesAndStereotypes
      );
      expect(cliche).toHaveProperty('llmMetadata', validLlmMetadata);
      expect(cliche).toHaveProperty('createdAt');
    });

    it('should create cliche with optional directionId', () => {
      const directionId = 'direction-456';
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata,
        directionId
      );

      const cliche = result[0];
      expect(cliche.directionId).toBe(directionId);
    });

    it('should create temporary directionId when not provided', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.directionId).toMatch(/^temp-direction-\d+$/);
    });

    it('should use empty metadata when not provided', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes
      );

      const cliche = result[0];
      expect(cliche.llmMetadata).toEqual({});
    });

    it('should trim conceptId whitespace', () => {
      const conceptIdWithSpaces = '  ' + validConceptId + '  ';
      const result = createClichesFromLLMResponse(
        conceptIdWithSpaces,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.conceptId).toBe(validConceptId);
    });

    it('should create immutable cliche objects', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(Object.isFrozen(cliche)).toBe(true);
      expect(Object.isFrozen(cliche.categories)).toBe(true);
      expect(Object.isFrozen(cliche.tropesAndStereotypes)).toBe(true);
      expect(Object.isFrozen(cliche.llmMetadata)).toBe(true);
    });

    it('should generate valid timestamps', () => {
      const beforeTime = Date.now();
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );
      const afterTime = Date.now();

      const cliche = result[0];
      const createdAtTime = new Date(cliche.createdAt).getTime();
      expect(createdAtTime).toBeGreaterThanOrEqual(beforeTime);
      expect(createdAtTime).toBeLessThanOrEqual(afterTime);
      expect(cliche.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should create unique IDs for each call', () => {
      const result1 = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );
      const result2 = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      expect(result1[0].id).not.toBe(result2[0].id);
    });
  });

  describe('input validation', () => {
    it('should throw error for empty conceptId', () => {
      expect(() => {
        createClichesFromLLMResponse(
          '',
          validCategories,
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('conceptId must be a non-empty string');
    });

    it('should throw error for whitespace-only conceptId', () => {
      expect(() => {
        createClichesFromLLMResponse(
          '   ',
          validCategories,
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('conceptId must be a non-empty string');
    });

    it('should throw error for null conceptId', () => {
      expect(() => {
        createClichesFromLLMResponse(
          null,
          validCategories,
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('conceptId must be a non-empty string');
    });

    it('should throw error for non-string conceptId', () => {
      expect(() => {
        createClichesFromLLMResponse(
          123,
          validCategories,
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('conceptId must be a non-empty string');
    });

    it('should throw error for null categories', () => {
      expect(() => {
        createClichesFromLLMResponse(
          validConceptId,
          null,
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('categories must be a valid object');
    });

    it('should throw error for non-object categories', () => {
      expect(() => {
        createClichesFromLLMResponse(
          validConceptId,
          'invalid',
          validTropesAndStereotypes,
          validLlmMetadata
        );
      }).toThrow('categories must be a valid object');
    });

    it('should throw error for null tropesAndStereotypes', () => {
      expect(() => {
        createClichesFromLLMResponse(
          validConceptId,
          validCategories,
          null,
          validLlmMetadata
        );
      }).toThrow('tropesAndStereotypes must be an array');
    });

    it('should throw error for non-array tropesAndStereotypes', () => {
      expect(() => {
        createClichesFromLLMResponse(
          validConceptId,
          validCategories,
          'invalid',
          validLlmMetadata
        );
      }).toThrow('tropesAndStereotypes must be an array');
    });
  });

  describe('category validation through Cliche constructor', () => {
    it('should handle empty categories gracefully', () => {
      const emptyCategories = {
        names: [],
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: [],
      };

      const result = createClichesFromLLMResponse(
        validConceptId,
        emptyCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.categories).toEqual(emptyCategories);
      expect(cliche.getTotalCount()).toBe(validTropesAndStereotypes.length);
    });

    it('should filter out empty strings from categories', () => {
      const categoriesWithEmptyStrings = {
        ...validCategories,
        names: ['John', '', 'Mary', '   ', 'Bob'],
      };

      const result = createClichesFromLLMResponse(
        validConceptId,
        categoriesWithEmptyStrings,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.categories.names).toEqual(['John', 'Mary', 'Bob']);
    });

    it('should convert non-string category items to empty arrays', () => {
      const categoriesWithNonStrings = {
        ...validCategories,
        names: ['John', 123, null, 'Mary'],
      };

      const result = createClichesFromLLMResponse(
        validConceptId,
        categoriesWithNonStrings,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.categories.names).toEqual(['John', 'Mary']);
    });

    it('should handle missing category properties', () => {
      const incompleteCategories = {
        names: ['John', 'Mary'],
        physicalDescriptions: ['tall and dark'],
        // Missing other required categories
      };

      const result = createClichesFromLLMResponse(
        validConceptId,
        incompleteCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.categories.names).toEqual(['John', 'Mary']);
      expect(cliche.categories.physicalDescriptions).toEqual(['tall and dark']);
      expect(cliche.categories.personalityTraits).toEqual([]);
      expect(cliche.categories.skillsAbilities).toEqual([]);
    });
  });

  describe('utility methods', () => {
    it('should provide category statistics', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      const stats = cliche.getCategoryStats();

      expect(stats.names).toBe(3);
      expect(stats.physicalDescriptions).toBe(2);
      expect(stats.tropesAndStereotypes).toBe(2);
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should detect empty cliches', () => {
      const emptyCategories = {
        names: [],
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: [],
      };
      const emptyTropes = [];

      const result = createClichesFromLLMResponse(
        validConceptId,
        emptyCategories,
        emptyTropes,
        validLlmMetadata
      );

      const cliche = result[0];
      expect(cliche.isEmpty()).toBe(true);
    });

    it('should provide display-formatted data', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      const displayData = cliche.getDisplayData();

      expect(displayData).toHaveProperty('categories');
      expect(displayData).toHaveProperty('tropesAndStereotypes');
      expect(displayData).toHaveProperty('metadata');
      expect(displayData.metadata).toHaveProperty('createdAt');
      expect(displayData.metadata).toHaveProperty('totalCount');
      expect(displayData.metadata).toHaveProperty('model');
    });

    it('should convert to JSON for storage', () => {
      const result = createClichesFromLLMResponse(
        validConceptId,
        validCategories,
        validTropesAndStereotypes,
        validLlmMetadata
      );

      const cliche = result[0];
      const jsonData = cliche.toJSON();

      expect(jsonData).toHaveProperty('id');
      expect(jsonData).toHaveProperty('conceptId', validConceptId);
      expect(jsonData).toHaveProperty('directionId');
      expect(jsonData).toHaveProperty('categories');
      expect(jsonData).toHaveProperty('tropesAndStereotypes');
      expect(jsonData).toHaveProperty('llmMetadata');
      expect(jsonData).toHaveProperty('createdAt');
    });
  });
});
