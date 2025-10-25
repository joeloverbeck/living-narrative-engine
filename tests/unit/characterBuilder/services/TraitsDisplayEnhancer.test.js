/**
 * @file Unit tests for TraitsDisplayEnhancer service
 * @see ../../../../src/characterBuilder/services/TraitsDisplayEnhancer.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsDisplayEnhancer } from '../../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';

describe('TraitsDisplayEnhancer', () => {
  let enhancer;
  let mockLogger;

  const createMockTraitsData = (overrides = {}) => ({
    id: 'trait-123',
    names: [
      { name: 'John Doe', justification: 'Common name for anonymity' },
      { name: 'Shadow Walker', justification: 'Reflects stealthy nature' },
      { name: 'Marcus Vale', justification: 'Noble sounding for trust' },
    ],
    physicalDescription:
      'Tall and lean with piercing blue eyes, weathered face showing years of hardship',
    personality: [
      { trait: 'Cautious', explanation: 'Years of danger have made them wary' },
      {
        trait: 'Compassionate',
        explanation: 'Despite hardships, maintains empathy',
      },
      { trait: 'Determined', explanation: 'Never gives up on their goals' },
    ],
    strengths: ['Strategic thinking', 'Physical endurance', 'Loyalty'],
    weaknesses: ['Trust issues', 'Haunted by past', 'Impulsive when angry'],
    likes: ['Quiet moments', 'Old books', 'Mountain views', 'Hot coffee'],
    dislikes: ['Crowds', 'Dishonesty', 'Confined spaces', 'Cold weather'],
    fears: ['Losing loved ones', 'Being discovered'],
    goals: {
      shortTerm: ['Find safe haven', 'Gather information'],
      longTerm: 'Achieve redemption for past mistakes',
    },
    notes: ['Has a hidden talent for music', 'Speaks three languages'],
    profile:
      'A complex individual shaped by a difficult past, seeking redemption while struggling with trust. Their experiences have made them both cautious and compassionate.',
    secrets: ['Former assassin', "Has a child they've never met"],
    generatedAt: '2024-03-15T10:30:00Z',
    metadata: {
      model: 'gpt-4',
      temperature: 0.8,
      tokens: 3500,
      responseTime: 2500,
      promptVersion: '1.0.0',
    },
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    enhancer = new TraitsDisplayEnhancer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(enhancer).toBeInstanceOf(TraitsDisplayEnhancer);
    });

    it('should throw error without logger', () => {
      expect(() => new TraitsDisplayEnhancer({})).toThrow(
        'Missing required dependency: ILogger'
      );
    });

    it('should validate logger has required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other methods
      expect(
        () => new TraitsDisplayEnhancer({ logger: invalidLogger })
      ).toThrow('Invalid or missing method');
    });
  });

  describe('enhanceForDisplay', () => {
    it('should enhance valid traits data for display', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData);

      expect(result).toHaveProperty('id', 'trait-123');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('summary');
      expect(result.categories).toBeInstanceOf(Array);
      expect(result.categories.length).toBeGreaterThan(0);
    });

    it('should organize categories in priority order', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData);

      const categoryIds = result.categories.map((c) => c.id);
      const expectedOrder = [
        'names',
        'physical',
        'personality',
        'strengths',
        'weaknesses',
        'likes',
        'dislikes',
        'fears',
        'goals',
        'notes',
        'profile',
        'secrets',
      ];

      // Check that categories appear in expected order
      const actualOrder = expectedOrder.filter((id) =>
        categoryIds.includes(id)
      );
      expect(categoryIds).toEqual(actualOrder);
    });

    it('should expand structured data when option is true', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData, {
        expandStructuredData: true,
      });

      const namesCategory = result.categories.find((c) => c.id === 'names');
      expect(namesCategory.items[0]).toHaveProperty('primary');
      expect(namesCategory.items[0]).toHaveProperty('secondary');
      expect(namesCategory.items[0]).toHaveProperty(
        'type',
        'name-justification'
      );
    });

    it('should not expand structured data when option is false', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData, {
        expandStructuredData: false,
      });

      const namesCategory = result.categories.find((c) => c.id === 'names');
      expect(namesCategory.items[0]).toHaveProperty('name');
      expect(namesCategory.items[0]).toHaveProperty('justification');
    });

    it('should include metadata when option is true', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData, {
        includeMetadata: true,
      });

      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('model', 'gpt-4');
      expect(result.metadata).toHaveProperty('temperature', 0.8);
      expect(result.metadata).toHaveProperty('tokenCount', 3500);
      expect(result.metadata).toHaveProperty('generationTime', '2500ms');
      expect(result.metadata).toHaveProperty('promptVersion', '1.0.0');
    });

    it('should exclude metadata when option is false', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData, {
        includeMetadata: false,
      });

      expect(result).not.toHaveProperty('metadata');
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalTraits = {
        names: [{ name: 'Test', justification: 'Testing' }],
        physicalDescription: 'Test description',
      };

      const result = enhancer.enhanceForDisplay(minimalTraits);
      expect(result.categories).toBeInstanceOf(Array);
      expect(result.summary.totalCategories).toBe(2);
    });

    it('should generate accurate summary', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.enhanceForDisplay(traitsData);

      expect(result.summary).toMatchObject({
        namesCount: 3,
        personalityCount: 3,
        hasPhysicalDescription: true,
        hasProfile: true,
        completeness: 100, // All 12 categories present
      });
    });

    it('should throw error for invalid traits data', () => {
      expect(() => enhancer.enhanceForDisplay(null)).toThrow(
        'Traits data must be a valid object'
      );

      expect(() => enhancer.enhanceForDisplay({})).toThrow(
        'Traits data must contain at least some content'
      );
    });
  });

  describe('formatForExport', () => {
    it('should format complete traits data for export', () => {
      const traitsData = createMockTraitsData();
      const metadata = {
        concept: 'Mysterious Wanderer',
        direction: 'Redemption Arc',
        userInputs: {
          coreMotivation: 'To find peace',
          internalContradiction: 'Wants peace but drawn to conflict',
          centralQuestion: 'Can one truly escape their past?',
        },
      };

      const result = enhancer.formatForExport(traitsData, metadata);

      expect(result).toContain('CHARACTER TRAITS');
      expect(result).toContain('Concept: Mysterious Wanderer');
      expect(result).toContain('Thematic Direction: Redemption Arc');
      expect(result).toContain('NAMES');
      expect(result).toContain('John Doe: Common name for anonymity');
      expect(result).toContain('PHYSICAL DESCRIPTION');
      expect(result).toContain('piercing blue eyes');
      expect(result).toContain('PERSONALITY');
      expect(result).toContain('Cautious: Years of danger');
      expect(result).toContain('USER INPUTS');
      expect(result).toContain('Core Motivation: To find peace');
      expect(result).toContain('GENERATION METADATA');
      expect(result).toContain('LLM Model: gpt-4');
    });

    it('should handle missing metadata gracefully', () => {
      const traitsData = createMockTraitsData({ metadata: undefined });
      const result = enhancer.formatForExport(traitsData);

      expect(result).toContain('CHARACTER TRAITS');
      expect(result).not.toContain('GENERATION METADATA');
    });

    it('should handle empty arrays gracefully', () => {
      const traitsData = createMockTraitsData({
        names: [],
        strengths: [],
        weaknesses: [],
      });

      const result = enhancer.formatForExport(traitsData);
      expect(result).toContain('• No names generated');
      expect(result).toContain('• No strengths specified');
      expect(result).toContain('• No weaknesses specified');
    });

    it('should format goals correctly', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.formatForExport(traitsData);

      expect(result).toContain('GOALS');
      expect(result).toContain('Short-term:');
      expect(result).toContain('• Find safe haven');
      expect(result).toContain('Long-term: Achieve redemption');
    });

    it('should include fallback when short-term goals are missing', () => {
      const traitsData = createMockTraitsData({
        goals: {
          shortTerm: [],
          longTerm: '',
        },
      });

      const result = enhancer.formatForExport(traitsData);
      expect(result).toContain('• No short-term goals');
      expect(result).toContain('Long-term: No long-term goal');
    });

    it('should include all trait categories in order', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.formatForExport(traitsData);

      const expectedSections = [
        'NAMES',
        'PHYSICAL DESCRIPTION',
        'PERSONALITY',
        'STRENGTHS',
        'WEAKNESSES',
        'LIKES',
        'DISLIKES',
        'FEARS',
        'GOALS',
        'ADDITIONAL NOTES',
        'CHARACTER PROFILE',
        'SECRETS',
      ];

      let lastIndex = -1;
      expectedSections.forEach((section) => {
        const index = result.indexOf(section);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it('should throw error for invalid traits data', () => {
      expect(() => enhancer.formatForExport(null)).toThrow(
        'Traits data must be a valid object'
      );
    });

    it('should format timestamp correctly', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.formatForExport(traitsData);

      // Should format as "March 15 at 2024 at 10:30 AM" (based on UTC)
      expect(result).toMatch(
        /Generated: \w+ \d+ at \d{4} at \d{1,2}:\d{2} [AP]M/
      );
    });

    it('should return unknown date when timestamp is missing', () => {
      const traitsData = createMockTraitsData({ generatedAt: undefined });
      const isoSpy = jest
        .spyOn(Date.prototype, 'toISOString')
        .mockReturnValue('');

      let result;
      try {
        result = enhancer.formatForExport(traitsData);
      } finally {
        isoSpy.mockRestore();
      }

      expect(result).toContain('Generated: Unknown date');
    });

    it('should recover when timestamp formatting throws', () => {
      const traitsData = createMockTraitsData();
      const localeSpy = jest
        .spyOn(Date.prototype, 'toLocaleString')
        .mockImplementation(() => {
          throw new Error('Locale failure');
        });

      let result;
      try {
        result = enhancer.formatForExport(traitsData);
      } finally {
        localeSpy.mockRestore();
      }

      expect(result).toContain('Generated: Unknown date');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error formatting timestamp: Locale failure'
      );
    });
  });

  describe('generateExportFilename', () => {
    it('should generate filename with direction', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.generateExportFilename(traitsData, {
        direction: 'Haunted Detective Story',
      });

      expect(result).toMatch(
        /^traits_haunted-detective-story_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/
      );
    });

    it('should generate filename without direction', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.generateExportFilename(traitsData);

      expect(result).toMatch(/^traits_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/);
    });

    it('should sanitize direction name properly', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.generateExportFilename(traitsData, {
        direction: 'Complex! Story @ with #Special$ Characters & Symbols',
      });

      expect(result).toMatch(
        /^traits_complex-story-with-special-characters-symbols_/
      );
    });

    it('should limit direction slug length', () => {
      const traitsData = createMockTraitsData();
      const veryLongDirection = 'a'.repeat(100);
      const result = enhancer.generateExportFilename(traitsData, {
        direction: veryLongDirection,
      });

      // Should be truncated to 50 characters plus the rest of the filename
      expect(result.length).toBeLessThan(100);
    });

    it('should handle empty or invalid direction', () => {
      const traitsData = createMockTraitsData();

      let result = enhancer.generateExportFilename(traitsData, {
        direction: '',
      });
      expect(result).toMatch(/^traits_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/);

      result = enhancer.generateExportFilename(traitsData, { direction: null });
      expect(result).toMatch(/^traits_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/);
    });

    it('should ignore non-string direction values', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.generateExportFilename(traitsData, {
        direction: { complex: 'structure' },
      });

      expect(result).toMatch(/^traits_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/);
    });

    it('should generate consistent timestamp format', () => {
      const traitsData = createMockTraitsData();
      const result = enhancer.generateExportFilename(traitsData);

      // Check format YYYY-MM-DD_HHMMSS
      const timestampPart = result.replace('traits_', '').replace('.txt', '');
      expect(timestampPart).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}$/);
    });
  });

  describe('edge cases', () => {
    it('should handle traits with minimal data', () => {
      const minimalTraits = {
        profile: 'A simple character profile',
      };

      const displayResult = enhancer.enhanceForDisplay(minimalTraits);
      expect(displayResult.categories).toHaveLength(1);
      expect(displayResult.summary.completeness).toBe(8); // 1/12 categories

      const exportResult = enhancer.formatForExport(minimalTraits);
      expect(exportResult).toContain('CHARACTER PROFILE');
      expect(exportResult).toContain('A simple character profile');
    });

    it('should handle malformed goals structure', () => {
      const traitsData = createMockTraitsData({
        goals: {
          // Missing shortTerm array
          longTerm: 'Some goal',
        },
      });

      const result = enhancer.enhanceForDisplay(traitsData);
      const goalsCategory = result.categories.find((c) => c.id === 'goals');
      expect(goalsCategory.content.shortTerm).toEqual([]);
    });

    it('should handle very long text fields', () => {
      const longText = 'a'.repeat(1000);
      const traitsData = createMockTraitsData({
        physicalDescription: longText,
        profile: longText,
      });

      const displayResult = enhancer.enhanceForDisplay(traitsData);
      expect(displayResult).toBeDefined();

      const exportResult = enhancer.formatForExport(traitsData);
      expect(exportResult).toContain(longText);
    });

    it('should handle special characters in text', () => {
      const traitsData = createMockTraitsData({
        names: [
          {
            name: 'John "The Shadow" O\'Brien',
            justification: 'Irish heritage & nickname',
          },
        ],
        profile: 'Character with <special> & "unusual" marks',
      });

      const exportResult = enhancer.formatForExport(traitsData);
      expect(exportResult).toContain('John "The Shadow" O\'Brien');
      expect(exportResult).toContain('<special> & "unusual"');
    });

    it('should handle invalid date strings', () => {
      const traitsData = createMockTraitsData({
        generatedAt: 'invalid-date',
      });

      const result = enhancer.formatForExport(traitsData);
      expect(result).toContain('Generated: Invalid date');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid date string: invalid-date'
      );
    });

    it('should handle null/undefined values in arrays', () => {
      const traitsData = createMockTraitsData({
        strengths: ['Good', null, undefined, 'Strong'],
        notes: [undefined, 'Note 1', null],
      });

      const displayResult = enhancer.enhanceForDisplay(traitsData);
      expect(displayResult).toBeDefined();

      const strengthsCategory = displayResult.categories.find(
        (c) => c.id === 'strengths'
      );
      expect(strengthsCategory.items).toContain(null);
    });
  });

  describe('logging', () => {
    it('should log debug messages during enhance operation', () => {
      const traitsData = createMockTraitsData();
      enhancer.enhanceForDisplay(traitsData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Enhancing traits data for display'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Traits data enhanced successfully'
      );
    });

    it('should log errors for invalid data', () => {
      expect(() => enhancer.enhanceForDisplay(null)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid traits data provided')
      );
    });

    it('should log filename generation', () => {
      const traitsData = createMockTraitsData();
      const filename = enhancer.generateExportFilename(traitsData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Generating export filename'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Generated filename: ${filename}`
      );
    });
  });
});
