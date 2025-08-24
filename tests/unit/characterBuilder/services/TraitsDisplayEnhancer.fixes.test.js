/**
 * @file Unit tests for TraitsDisplayEnhancer fixes
 * @description Tests specifically for the data structure compatibility fixes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TraitsDisplayEnhancer } from '../../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('TraitsDisplayEnhancer - Data Structure Compatibility Fixes', () => {
  let enhancer;
  let mockLogger;

  // Sample complete traits data as would come from TraitsGenerator
  const completeTraitsData = {
    names: [
      { name: 'Alexandra', justification: 'Strong name reflecting her determination' },
      { name: 'Luna', justification: 'Mysterious name matching her enigmatic nature' },
      { name: 'Sofia', justification: 'Wisdom-based name for her insightful character' }
    ],
    physicalDescription: 'A tall, athletic young woman with dark curly hair and intense brown eyes. She has a confident posture and quick, purposeful movements.',
    personality: [
      { trait: 'Determined', explanation: 'Never gives up on her goals, even when faced with obstacles' },
      { trait: 'Analytical', explanation: 'Approaches problems with logic and systematic thinking' },
      { trait: 'Empathetic', explanation: 'Deeply understands others\' emotions and motivations' }
    ],
    strengths: ['Strategic thinking', 'Leadership abilities', 'Emotional intelligence', 'Quick problem-solving'],
    weaknesses: ['Impatience', 'Perfectionism', 'Difficulty delegating', 'Tendency to overthink'],
    likes: ['Chess', 'Historical novels', 'Mountain hiking', 'Meaningful conversations', 'Classical music'],
    dislikes: ['Dishonesty', 'Injustice', 'Loud parties', 'Procrastination', 'Superficial relationships'],
    fears: ['Failure', 'Losing loved ones', 'Being misunderstood', 'Loss of independence'],
    goals: {
      shortTerm: ['Master advanced strategy techniques', 'Build stronger team relationships', 'Complete leadership training'],
      longTerm: 'Become a respected leader who creates positive change while maintaining personal authenticity'
    },
    notes: ['Keeps a strategic journal', 'Has a photographic memory for faces', 'Practices meditation daily'],
    profile: 'A natural leader with a strong moral compass, Alexandra combines analytical prowess with deep empathy. Her determination drives her to excel, but she struggles with perfectionism and the need to control outcomes.',
    secrets: ['Secretly writes poetry to process emotions', 'Has a deep fear of not living up to her potential', 'Sometimes feels overwhelmed by others\' expectations'],
    metadata: {
      model: 'anthropic/claude-sonnet-4',
      totalTokens: 3014,
      responseTime: 2500,
      promptVersion: '1.0.0'
    }
  };

  // Minimal traits data to test defaults
  const minimalTraitsData = {
    names: [{ name: 'Test', justification: 'Test justification' }],
    physicalDescription: 'Basic description'
    // Missing most properties to test defaults
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    enhancer = new TraitsDisplayEnhancer({ logger: mockLogger });
  });

  describe('enhanceForDisplay Method', () => {
    it('should return data structure compatible with controller rendering', () => {
      const result = enhancer.enhanceForDisplay(completeTraitsData, {
        includeMetadata: false,
        expandStructuredData: true,
      });

      // Verify all expected properties exist and match input
      expect(result.names).toEqual(completeTraitsData.names);
      expect(result.physicalDescription).toEqual(completeTraitsData.physicalDescription);
      expect(result.personality).toEqual(completeTraitsData.personality);
      expect(result.strengths).toEqual(completeTraitsData.strengths);
      expect(result.weaknesses).toEqual(completeTraitsData.weaknesses);
      expect(result.likes).toEqual(completeTraitsData.likes);
      expect(result.dislikes).toEqual(completeTraitsData.dislikes);
      expect(result.fears).toEqual(completeTraitsData.fears);
      expect(result.goals).toEqual(completeTraitsData.goals);
      expect(result.notes).toEqual(completeTraitsData.notes);
      expect(result.profile).toEqual(completeTraitsData.profile);
      expect(result.secrets).toEqual(completeTraitsData.secrets);
    });

    it('should include metadata when requested', () => {
      const result = enhancer.enhanceForDisplay(completeTraitsData, {
        includeMetadata: true,
        expandStructuredData: true,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.model).toBe('anthropic/claude-sonnet-4');
    });

    it('should provide sensible defaults for missing properties', () => {
      const result = enhancer.enhanceForDisplay(minimalTraitsData, {
        includeMetadata: false,
        expandStructuredData: true,
      });

      // Properties that exist in input should be preserved
      expect(result.names).toEqual(minimalTraitsData.names);
      expect(result.physicalDescription).toEqual(minimalTraitsData.physicalDescription);

      // Missing properties should have appropriate defaults
      expect(result.personality).toEqual([]);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.likes).toEqual([]);
      expect(result.dislikes).toEqual([]);
      expect(result.fears).toEqual([]);
      expect(result.goals).toEqual({});
      expect(result.notes).toEqual([]);
      expect(result.profile).toEqual('');
      expect(result.secrets).toEqual([]);
    });

    it('should preserve ID and timestamp if provided', () => {
      const dataWithIdAndTimestamp = {
        ...completeTraitsData,
        id: 'test-id-123',
        generatedAt: '2024-01-01T12:00:00Z'
      };

      const result = enhancer.enhanceForDisplay(dataWithIdAndTimestamp, {
        includeMetadata: false,
        expandStructuredData: true,
      });

      expect(result.id).toBe('test-id-123');
      expect(result.generatedAt).toBe('2024-01-01T12:00:00Z');
    });

    it('should not throw errors with null or undefined values when there is some content', () => {
      const dataWithNullsButSomeContent = {
        names: null,
        physicalDescription: 'At least some content', // Ensures validation passes
        personality: null,
        strengths: undefined,
        weaknesses: null,
        likes: undefined,
        dislikes: null,
        fears: undefined,
        goals: null,
        notes: undefined,
        profile: null,
        secrets: undefined
      };

      const result = enhancer.enhanceForDisplay(dataWithNullsButSomeContent, {
        includeMetadata: false,
        expandStructuredData: true,
      });

      // Should provide defaults for null/undefined values
      expect(result.names).toEqual([]);
      expect(result.physicalDescription).toEqual('At least some content');
      expect(result.personality).toEqual([]);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.likes).toEqual([]);
      expect(result.dislikes).toEqual([]);
      expect(result.fears).toEqual([]);
      expect(result.goals).toEqual({});
      expect(result.notes).toEqual([]);
      expect(result.profile).toEqual('');
      expect(result.secrets).toEqual([]);
    });
  });

  describe('Data Validation', () => {
    it('should validate traits data and reject completely empty objects', () => {
      expect(() => {
        enhancer.enhanceForDisplay({}, { includeMetadata: false });
      }).toThrow('Traits data must contain at least some content');
    });

    it('should validate traits data and reject null/undefined input', () => {
      expect(() => {
        enhancer.enhanceForDisplay(null, { includeMetadata: false });
      }).toThrow('Traits data must be a valid object');

      expect(() => {
        enhancer.enhanceForDisplay(undefined, { includeMetadata: false });
      }).toThrow('Traits data must be a valid object');
    });

    it('should accept data with at least one content property', () => {
      const minimalValidData = { names: [{ name: 'Test', justification: 'Test' }] }; // Non-empty array counts as content
      
      expect(() => {
        enhancer.enhanceForDisplay(minimalValidData, { includeMetadata: false });
      }).not.toThrow();
    });
  });

  describe('Export Functionality Compatibility', () => {
    it('should still work correctly with the formatForExport method', () => {
      const exportText = enhancer.formatForExport(completeTraitsData, {
        includeUserInputs: {
          coreMotivation: 'Test motivation',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?'
        },
        includeDirection: 'Test Direction',
        includeTimestamp: true,
      });

      expect(exportText).toContain('CHARACTER TRAITS');
      expect(exportText).toContain('NAMES');
      expect(exportText).toContain('Alexandra');
      expect(exportText).toContain('PHYSICAL DESCRIPTION');
      expect(exportText).toContain('PERSONALITY');
      expect(exportText).toContain('Determined');
    });

    it('should generate appropriate export filename', () => {
      const filename = enhancer.generateExportFilename(completeTraitsData, {
        direction: 'Test Direction Name'
      });

      expect(filename).toMatch(/^traits_test-direction-name_\d{4}-\d{2}-\d{2}_\d{6}\.txt$/);
    });
  });
});