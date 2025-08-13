/**
 * @file Unit tests for ClicheFilterService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClicheFilterService } from '../../../../src/clichesGenerator/services/ClicheFilterService.js';

describe('ClicheFilterService', () => {
  let filterService;
  let mockData;

  beforeEach(() => {
    filterService = new ClicheFilterService();

    mockData = {
      categories: [
        {
          id: 'names',
          title: 'Common Names',
          items: ['John Smith', 'Jane Doe', 'Bob Johnson'],
          count: 3,
        },
        {
          id: 'traits',
          title: 'Personality Traits',
          items: ['Brooding', 'Mysterious', 'Dark Past'],
          count: 3,
        },
        {
          id: 'skills',
          title: 'Skills',
          items: ['Master Swordsman', 'Expert Marksman', 'Skilled Fighter'],
          count: 3,
        },
      ],
      tropesAndStereotypes: [
        'The Chosen One',
        'Dark and Troubled Past',
        'Mysterious Stranger',
      ],
      metadata: {
        createdAt: '12/13/2024',
        totalCount: 9,
        model: 'Test Model',
      },
    };
  });

  describe('Search Functionality', () => {
    it('should filter items by search term', () => {
      const result = filterService.search(mockData, 'John');

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('names');
      expect(result.categories[0].items).toContain('John Smith');
      expect(result.categories[0].items).toContain('Bob Johnson');
      expect(result.categories[0].count).toBe(2);
    });

    it('should search case-insensitively', () => {
      const result = filterService.search(mockData, 'DARK');

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('traits');
      expect(result.categories[0].items).toContain('Dark Past');
    });

    it('should search in tropes', () => {
      const result = filterService.search(mockData, 'Chosen');

      expect(result.tropesAndStereotypes).toContain('The Chosen One');
      expect(result.tropesAndStereotypes.length).toBe(1);
    });

    it('should return empty categories when no matches', () => {
      const result = filterService.search(mockData, 'xyz123');

      expect(result.categories.length).toBe(0);
      expect(result.tropesAndStereotypes.length).toBe(0);
    });

    it('should handle empty search term', () => {
      const result = filterService.search(mockData, '');

      expect(result).toEqual(mockData);
    });

    it('should handle null search term', () => {
      const result = filterService.search(mockData, null);

      expect(result).toEqual(mockData);
    });

    it('should handle null data', () => {
      const result = filterService.search(null, 'test');

      expect(result).toBeNull();
    });

    it('should trim search term', () => {
      const result = filterService.search(mockData, '  John  ');

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].items).toContain('John Smith');
    });

    it('should handle partial matches', () => {
      const result = filterService.search(mockData, 'Myst');

      expect(result.categories.length).toBe(1); // Only traits category matches
      expect(result.categories.some((c) => c.id === 'traits')).toBe(true);
      expect(result.tropesAndStereotypes).toContain('Mysterious Stranger');
    });

    it('should update count after filtering', () => {
      const result = filterService.search(mockData, 'Master');

      expect(result.categories[0].count).toBe(1);
      expect(result.categories[0].items.length).toBe(1);
    });
  });

  describe('Category Filtering', () => {
    it('should filter by active categories', () => {
      const result = filterService.filterByCategories(mockData, [
        'names',
        'skills',
      ]);

      expect(result.categories.length).toBe(2);
      expect(result.categories.map((c) => c.id)).toEqual(['names', 'skills']);
    });

    it('should return empty when no categories active', () => {
      const result = filterService.filterByCategories(mockData, []);

      expect(result.categories.length).toBe(0);
    });

    it('should handle non-existent category IDs', () => {
      const result = filterService.filterByCategories(mockData, [
        'names',
        'nonexistent',
      ]);

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('names');
    });

    it('should preserve other data properties', () => {
      const result = filterService.filterByCategories(mockData, ['names']);

      expect(result.tropesAndStereotypes).toEqual(
        mockData.tropesAndStereotypes
      );
      expect(result.metadata).toEqual(mockData.metadata);
    });

    it('should handle null active categories', () => {
      const result = filterService.filterByCategories(mockData, null);

      expect(result).toEqual(mockData);
    });

    it('should handle null data', () => {
      const result = filterService.filterByCategories(null, ['names']);

      expect(result).toBeNull();
    });
  });

  describe('Combined Filters', () => {
    it('should apply both search and category filters', () => {
      const result = filterService.applyFilters(mockData, 'John', ['names']);

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('names');
      expect(result.categories[0].items.length).toBe(2); // John Smith, Bob Johnson
    });

    it('should apply category filter first, then search', () => {
      const result = filterService.applyFilters(mockData, 'Expert', [
        'names',
        'skills',
      ]);

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('skills');
      expect(result.categories[0].items).toContain('Expert Marksman');
    });

    it('should handle no filters', () => {
      const result = filterService.applyFilters(mockData, null, null);

      expect(result).toEqual(mockData);
    });

    it('should handle only search filter', () => {
      const result = filterService.applyFilters(mockData, 'Dark', null);

      expect(result.categories.some((c) => c.id === 'traits')).toBe(true);
    });

    it('should handle only category filter', () => {
      const result = filterService.applyFilters(mockData, null, ['skills']);

      expect(result.categories.length).toBe(1);
      expect(result.categories[0].id).toBe('skills');
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics for full data', () => {
      const stats = filterService.getStatistics(mockData);

      expect(stats.totalCategories).toBe(3);
      expect(stats.totalItems).toBe(9);
      expect(stats.totalTropes).toBe(3);
    });

    it('should calculate statistics for filtered data', () => {
      const filtered = filterService.search(mockData, 'John');
      const stats = filterService.getStatistics(filtered);

      expect(stats.totalCategories).toBe(1);
      expect(stats.totalItems).toBe(2);
    });

    it('should handle empty data', () => {
      const emptyData = {
        categories: [],
        tropesAndStereotypes: [],
      };
      const stats = filterService.getStatistics(emptyData);

      expect(stats.totalCategories).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.totalTropes).toBe(0);
    });

    it('should handle null data', () => {
      const stats = filterService.getStatistics(null);

      expect(stats.totalCategories).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.totalTropes).toBe(0);
    });

    it('should handle missing tropes', () => {
      const dataWithoutTropes = {
        ...mockData,
        tropesAndStereotypes: null,
      };
      const stats = filterService.getStatistics(dataWithoutTropes);

      expect(stats.totalTropes).toBe(0);
    });
  });

  describe('Highlight Term', () => {
    it('should highlight search term in text', () => {
      const result = filterService.highlightTerm('John Smith', 'John');

      expect(result).toBe('<mark>John</mark> Smith');
    });

    it('should highlight case-insensitively', () => {
      const result = filterService.highlightTerm('John Smith', 'john');

      expect(result).toBe('<mark>John</mark> Smith');
    });

    it('should highlight multiple occurrences', () => {
      const result = filterService.highlightTerm('Dark and dark past', 'dark');

      expect(result).toBe('<mark>Dark</mark> and <mark>dark</mark> past');
    });

    it('should handle empty search term', () => {
      const result = filterService.highlightTerm('John Smith', '');

      expect(result).toBe('John Smith');
    });

    it('should handle null text', () => {
      const result = filterService.highlightTerm(null, 'test');

      expect(result).toBeNull();
    });

    it('should handle null search term', () => {
      const result = filterService.highlightTerm('John Smith', null);

      expect(result).toBe('John Smith');
    });

    it('should escape special regex characters', () => {
      const result = filterService.highlightTerm('Cost: $100.00', '$100.');

      // Should still match despite special characters
      expect(result).toContain('mark');
    });
  });

  describe('Edge Cases', () => {
    it('should handle categories with empty items array', () => {
      const dataWithEmpty = {
        categories: [
          {
            id: 'empty',
            title: 'Empty',
            items: [],
            count: 0,
          },
          ...mockData.categories,
        ],
        tropesAndStereotypes: [],
      };

      const result = filterService.search(dataWithEmpty, 'test');
      expect(result.categories).not.toContainEqual(
        expect.objectContaining({ id: 'empty' })
      );
    });

    it('should handle malformed category objects', () => {
      const malformed = {
        categories: [
          { id: 'bad' }, // Missing items
          { id: 'worse', items: null }, // Null items
        ],
      };

      expect(() => {
        filterService.search(malformed, 'test');
      }).not.toThrow();
    });

    it('should preserve original data structure', () => {
      const originalData = JSON.parse(JSON.stringify(mockData));
      filterService.search(mockData, 'test');

      // Original data should not be modified
      expect(mockData).toEqual(originalData);
    });

    it('should handle very long search terms', () => {
      const longTerm = 'a'.repeat(1000);

      expect(() => {
        filterService.search(mockData, longTerm);
      }).not.toThrow();
    });

    it('should handle special characters in search', () => {
      const specialData = {
        categories: [
          {
            id: 'special',
            title: 'Special',
            items: ['Item (with) [special] {chars}'],
            count: 1,
          },
        ],
      };

      const result = filterService.search(specialData, '(with)');
      expect(result.categories[0].items).toContain(
        'Item (with) [special] {chars}'
      );
    });
  });
});
