/**
 * @file Unit tests for Cliche model
 * @see src/characterBuilder/models/cliche.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  Cliche,
  createClichesFromLLMResponse,
} from '../../../../src/characterBuilder/models/cliche.js';

describe('Cliche Model', () => {
  let validData;

  beforeEach(() => {
    validData = {
      directionId: 'dir-123',
      conceptId: 'concept-456',
      categories: {
        names: ['John', 'Mary'],
        physicalDescriptions: ['Tall, dark, handsome'],
        personalityTraits: ['Brooding'],
        skillsAbilities: ['Master swordsman'],
        typicalLikes: ['Justice'],
        typicalDislikes: ['Injustice'],
        commonFears: ['Losing loved ones'],
        genericGoals: ['Save the world'],
        backgroundElements: ['Orphaned as a child'],
        overusedSecrets: ['Secret royal bloodline'],
        speechPatterns: ['...'],
      },
      tropesAndStereotypes: ['The Chosen One'],
    };
  });

  describe('Constructor', () => {
    it('should create valid cliche with all fields', () => {
      const cliche = new Cliche(validData);

      expect(cliche.directionId).toBe('dir-123');
      expect(cliche.conceptId).toBe('concept-456');
      expect(cliche.categories.names).toEqual(['John', 'Mary']);
      expect(cliche.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('should generate UUID if id not provided', () => {
      const cliche = new Cliche(validData);
      expect(cliche.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should use provided id if given', () => {
      validData.id = 'custom-id-123';
      const cliche = new Cliche(validData);
      expect(cliche.id).toBe('custom-id-123');
    });

    it('should validate required fields', () => {
      expect(() => new Cliche()).toThrow('Cliche data is required');
      expect(() => new Cliche(null)).toThrow('Cliche data is required');
      expect(() => new Cliche({})).toThrow('Direction ID is required');
      expect(() => new Cliche({ directionId: '' })).toThrow(
        'Direction ID is required'
      );
      expect(() => new Cliche({ directionId: 'dir-1', conceptId: '' })).toThrow(
        'Concept ID is required'
      );
      expect(
        () => new Cliche({ directionId: 'dir-1', conceptId: 'concept-1' })
      ).toThrow('Categories are required');
    });

    it('should normalize category arrays', () => {
      validData.categories.names = ['  John  ', '', '  ', 'Mary'];
      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John', 'Mary']);
    });

    it('should handle missing categories gracefully', () => {
      validData.categories = {
        names: ['John'],
        // Missing other categories
      };
      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John']);
      expect(cliche.categories.physicalDescriptions).toEqual([]);
      expect(cliche.categories.personalityTraits).toEqual([]);
      expect(cliche.categories.skillsAbilities).toEqual([]);
      expect(cliche.categories.typicalLikes).toEqual([]);
      expect(cliche.categories.typicalDislikes).toEqual([]);
      expect(cliche.categories.commonFears).toEqual([]);
      expect(cliche.categories.genericGoals).toEqual([]);
      expect(cliche.categories.backgroundElements).toEqual([]);
      expect(cliche.categories.overusedSecrets).toEqual([]);
      expect(cliche.categories.speechPatterns).toEqual([]);
    });

    it('should set default values for optional fields', () => {
      const minimalData = {
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
      };
      const cliche = new Cliche(minimalData);

      expect(cliche.tropesAndStereotypes).toEqual([]);
      expect(cliche.createdAt).toBeTruthy();
      expect(cliche.llmMetadata).toEqual({});
    });

    it('should freeze object to prevent mutation', () => {
      const cliche = new Cliche(validData);

      // Test that object is frozen
      expect(Object.isFrozen(cliche)).toBe(true);
      expect(Object.isFrozen(cliche.categories)).toBe(true);
      expect(Object.isFrozen(cliche.tropesAndStereotypes)).toBe(true);
      expect(Object.isFrozen(cliche.llmMetadata)).toBe(true);

      // Test that properties cannot be changed
      const originalDirectionId = cliche.directionId;
      const originalCategoriesNames = cliche.categories.names;
      const originalTropes = cliche.tropesAndStereotypes;

      // In strict mode these would throw, but in non-strict they silently fail
      // We just verify the values don't change
      try {
        cliche.directionId = 'new-id';
        cliche.categories.names = ['Different', 'Names'];
        cliche.tropesAndStereotypes = ['Different Trope'];
        cliche.llmMetadata.model = 'new-model';
      } catch (e) {
        // In strict mode, assignment to frozen object throws
      }

      expect(cliche.directionId).toBe(originalDirectionId);
      expect(cliche.categories.names).toBe(originalCategoriesNames);
      expect(cliche.tropesAndStereotypes).toBe(originalTropes);
      expect(cliche.llmMetadata.model).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    it('should calculate total count correctly', () => {
      const cliche = new Cliche(validData);
      const count = cliche.getTotalCount();

      // 2 names + 1 physical + 1 personality + 1 skill + 1 like + 1 dislike +
      // 1 fear + 1 goal + 1 background + 1 secret + 1 speech + 1 trope = 13
      expect(count).toBe(13);
    });

    it('should calculate total count for empty cliche', () => {
      const emptyData = {
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
      };
      const cliche = new Cliche(emptyData);
      expect(cliche.getTotalCount()).toBe(0);
    });

    it('should generate category statistics', () => {
      const cliche = new Cliche(validData);
      const stats = cliche.getCategoryStats();

      expect(stats.names).toBe(2);
      expect(stats.physicalDescriptions).toBe(1);
      expect(stats.personalityTraits).toBe(1);
      expect(stats.skillsAbilities).toBe(1);
      expect(stats.typicalLikes).toBe(1);
      expect(stats.typicalDislikes).toBe(1);
      expect(stats.commonFears).toBe(1);
      expect(stats.genericGoals).toBe(1);
      expect(stats.backgroundElements).toBe(1);
      expect(stats.overusedSecrets).toBe(1);
      expect(stats.speechPatterns).toBe(1);
      expect(stats.tropesAndStereotypes).toBe(1);
      expect(stats.total).toBe(13);
    });

    it('should detect empty clichés', () => {
      validData.categories = {
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
      validData.tropesAndStereotypes = [];

      const cliche = new Cliche(validData);
      expect(cliche.isEmpty()).toBe(true);
    });

    it('should detect non-empty clichés', () => {
      const cliche = new Cliche(validData);
      expect(cliche.isEmpty()).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const cliche = new Cliche(validData);
      const json = cliche.toJSON();

      expect(json).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          directionId: 'dir-123',
          conceptId: 'concept-456',
          categories: expect.objectContaining({
            names: ['John', 'Mary'],
            physicalDescriptions: ['Tall, dark, handsome'],
          }),
          tropesAndStereotypes: ['The Chosen One'],
          createdAt: expect.any(String),
          llmMetadata: expect.any(Object),
        })
      );
    });

    it('should create from raw data', () => {
      const cliche = Cliche.fromRawData(validData);

      expect(cliche).toBeInstanceOf(Cliche);
      expect(cliche.directionId).toBe('dir-123');
    });

    it('should handle raw data with all fields', () => {
      const fullData = {
        ...validData,
        id: 'test-id',
        createdAt: '2024-01-01T00:00:00.000Z',
        llmMetadata: {
          model: 'gpt-4',
          temperature: 0.7,
          tokens: 1000,
          responseTime: 500,
          promptVersion: 'v1',
        },
      };

      const cliche = Cliche.fromRawData(fullData);
      expect(cliche.id).toBe('test-id');
      expect(cliche.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(cliche.llmMetadata.model).toBe('gpt-4');
    });
  });

  describe('Display Formatting', () => {
    it('should format for display', () => {
      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();

      expect(display.categories).toBeInstanceOf(Array);
      expect(display.tropesAndStereotypes).toEqual(['The Chosen One']);
      expect(display.metadata.totalCount).toBe(13);
      expect(display.metadata.model).toBe('Unknown');
    });

    it('should format categories with human-readable names', () => {
      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();

      const namesCategory = display.categories.find((c) => c.id === 'names');
      expect(namesCategory).toEqual({
        id: 'names',
        title: 'Common Names',
        items: ['John', 'Mary'],
        count: 2,
      });

      const physicalCategory = display.categories.find(
        (c) => c.id === 'physicalDescriptions'
      );
      expect(physicalCategory).toEqual({
        id: 'physicalDescriptions',
        title: 'Physical Descriptions',
        items: ['Tall, dark, handsome'],
        count: 1,
      });
    });

    it('should only include non-empty categories in display', () => {
      validData.categories = {
        names: ['John'],
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

      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();

      expect(display.categories).toHaveLength(1);
      expect(display.categories[0].id).toBe('names');
    });

    it('should format metadata with model info', () => {
      validData.llmMetadata = {
        model: 'claude-3',
      };

      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();

      expect(display.metadata.model).toBe('claude-3');
    });

    it('should format date in display metadata', () => {
      validData.createdAt = '2024-01-15T10:30:00.000Z';
      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();

      // Date format depends on locale, so just check it's a string
      expect(typeof display.metadata.createdAt).toBe('string');
      expect(display.metadata.createdAt).toBeTruthy();
    });
  });

  describe('Immutable mutations', () => {
    it('should create new instance with item removed', () => {
      const cliche = new Cliche(validData);
      const updated = cliche.createWithItemRemoved('names', 'John');

      expect(updated).not.toBe(cliche);
      expect(updated.categories.names).toEqual(['Mary']);
      expect(cliche.categories.names).toEqual(['John', 'Mary']);
    });

    it('should throw when removing missing item', () => {
      const cliche = new Cliche(validData);

      expect(() =>
        cliche.createWithItemRemoved('names', 'Nonexistent')
      ).toThrow('Item "Nonexistent" not found in category "names"');
    });

    it('should throw when removing from missing category', () => {
      const cliche = new Cliche(validData);

      expect(() =>
        cliche.createWithItemRemoved('unknownCategory', 'John')
      ).toThrow('Category "unknownCategory" not found');
    });

    it('should remove trope immutably', () => {
      validData.tropesAndStereotypes = ['The Chosen One', 'Secret Heir'];
      const cliche = new Cliche(validData);
      const updated = cliche.createWithTropeRemoved('Secret Heir');

      expect(updated.tropesAndStereotypes).toEqual(['The Chosen One']);
      expect(cliche.tropesAndStereotypes).toEqual([
        'The Chosen One',
        'Secret Heir',
      ]);
    });

    it('should validate inputs when removing trope', () => {
      const cliche = new Cliche(validData);

      expect(() => cliche.createWithTropeRemoved('Unknown')).toThrow(
        'Trope "Unknown" not found'
      );
      expect(() => cliche.createWithTropeRemoved('')).toThrow(
        'tropeText must be a non-empty string'
      );
    });

    it('should validate inputs when removing category item', () => {
      const cliche = new Cliche(validData);

      expect(() => cliche.createWithItemRemoved('', 'John')).toThrow(
        'categoryId must be a non-empty string'
      );
      expect(() => cliche.createWithItemRemoved('names', '')).toThrow(
        'itemText must be a non-empty string'
      );
    });
  });

  describe('LLM response helpers', () => {
    it('should create cliche from LLM response data', () => {
      const [cliche] = createClichesFromLLMResponse(
        'concept-456',
        validData.categories,
        validData.tropesAndStereotypes,
        { model: 'gpt-4o' },
        'dir-123'
      );

      expect(cliche).toBeInstanceOf(Cliche);
      expect(cliche.directionId).toBe('dir-123');
      expect(cliche.llmMetadata.model).toBe('gpt-4o');
    });

    it('should generate temporary direction id when missing', () => {
      const [cliche] = createClichesFromLLMResponse(
        'concept-456',
        validData.categories,
        validData.tropesAndStereotypes
      );

      expect(cliche.directionId).toMatch(/^temp-direction-/);
    });

    it('should validate concept id input', () => {
      expect(() =>
        createClichesFromLLMResponse('', validData.categories, [])
      ).toThrow('conceptId must be a non-empty string');
    });

    it('should validate categories input', () => {
      expect(() =>
        createClichesFromLLMResponse('concept-456', null, [])
      ).toThrow('categories must be a valid object');
    });

    it('should validate tropes array input', () => {
      expect(() =>
        createClichesFromLLMResponse('concept-456', validData.categories, null)
      ).toThrow('tropesAndStereotypes must be an array');
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-string items in categories', () => {
      validData.categories.names = ['John', 123, null, undefined, 'Mary'];
      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John', 'Mary']);
    });

    it('should handle whitespace-only strings', () => {
      validData.categories.names = ['  ', '\t', '\n', 'John'];
      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John']);
    });

    it('should handle null/undefined categories', () => {
      validData.categories.names = null;
      validData.categories.physicalDescriptions = undefined;

      const cliche = new Cliche(validData);
      expect(cliche.categories.names).toEqual([]);
      expect(cliche.categories.physicalDescriptions).toEqual([]);
    });
  });
});
