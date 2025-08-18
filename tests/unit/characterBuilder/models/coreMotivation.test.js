/**
 * @file Unit tests for CoreMotivation model
 * @see src/characterBuilder/models/coreMotivation.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';

describe('CoreMotivation Model', () => {
  let validData;

  beforeEach(() => {
    validData = {
      directionId: 'dir-123',
      conceptId: 'concept-456',
      coreDesire: 'To become a legendary hero and save the world',
      internalContradiction:
        'Wants to help everyone but fears losing loved ones',
      centralQuestion: 'Can true heroism exist without sacrifice?',
    };
  });

  describe('Constructor', () => {
    it('should create valid core motivation with all fields', () => {
      const motivation = new CoreMotivation(validData);

      expect(motivation.directionId).toBe('dir-123');
      expect(motivation.conceptId).toBe('concept-456');
      expect(motivation.coreDesire).toBe(
        'To become a legendary hero and save the world'
      );
      expect(motivation.internalContradiction).toBe(
        'Wants to help everyone but fears losing loved ones'
      );
      expect(motivation.centralQuestion).toBe(
        'Can true heroism exist without sacrifice?'
      );
      expect(motivation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('should generate UUID if id not provided', () => {
      const motivation = new CoreMotivation(validData);
      expect(motivation.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should use provided id if given', () => {
      validData.id = 'custom-id-123';
      const motivation = new CoreMotivation(validData);
      expect(motivation.id).toBe('custom-id-123');
    });

    it('should generate createdAt timestamp if not provided', () => {
      const motivation = new CoreMotivation(validData);
      expect(motivation.createdAt).toBeTruthy();
      expect(new Date(motivation.createdAt)).toBeInstanceOf(Date);
    });

    it('should use provided createdAt if given', () => {
      const timestamp = '2024-01-01T00:00:00.000Z';
      validData.createdAt = timestamp;
      const motivation = new CoreMotivation(validData);
      expect(motivation.createdAt).toBe(timestamp);
    });

    it('should set empty metadata if not provided', () => {
      const motivation = new CoreMotivation(validData);
      expect(motivation.metadata).toEqual({});
    });

    it('should use provided metadata if given', () => {
      const metadata = {
        model: 'gpt-4',
        temperature: 0.7,
        clicheIds: ['cliche-1', 'cliche-2'],
      };
      validData.metadata = metadata;
      const motivation = new CoreMotivation(validData);
      expect(motivation.metadata).toEqual(metadata);
    });

    it('should trim whitespace from text fields', () => {
      validData.coreDesire = '  To become a hero  ';
      validData.internalContradiction = '  Wants to help but fears  ';
      validData.centralQuestion = '  Can heroism exist?  ';

      const motivation = new CoreMotivation(validData);

      expect(motivation.coreDesire).toBe('To become a hero');
      expect(motivation.internalContradiction).toBe('Wants to help but fears');
      expect(motivation.centralQuestion).toBe('Can heroism exist?');
    });

    it('should validate required fields', () => {
      expect(() => new CoreMotivation()).toThrow('Direction ID is required');
      expect(() => new CoreMotivation(null)).toThrow(
        'CoreMotivation data is required'
      );
      expect(() => new CoreMotivation({})).toThrow('Direction ID is required');
      expect(() => new CoreMotivation({ directionId: '' })).toThrow(
        'Direction ID is required'
      );
      expect(
        () => new CoreMotivation({ directionId: 'dir-1', conceptId: '' })
      ).toThrow('Concept ID is required');
      expect(
        () =>
          new CoreMotivation({ directionId: 'dir-1', conceptId: 'concept-1' })
      ).toThrow('Core desire is required');
      expect(
        () =>
          new CoreMotivation({
            directionId: 'dir-1',
            conceptId: 'concept-1',
            coreDesire: 'desire',
          })
      ).toThrow('Internal contradiction is required');
      expect(
        () =>
          new CoreMotivation({
            directionId: 'dir-1',
            conceptId: 'concept-1',
            coreDesire: 'desire',
            internalContradiction: 'contradiction',
          })
      ).toThrow('Central question is required');
    });

    it('should freeze object to prevent mutation', () => {
      const motivation = new CoreMotivation(validData);

      // Test that object is frozen
      expect(Object.isFrozen(motivation)).toBe(true);
      expect(Object.isFrozen(motivation.metadata)).toBe(true);

      // Test that properties cannot be changed
      const originalDirectionId = motivation.directionId;
      const originalCoreDesire = motivation.coreDesire;
      const originalMetadata = motivation.metadata;

      // In strict mode these would throw, but in non-strict they silently fail
      try {
        motivation.directionId = 'new-id';
        motivation.coreDesire = 'New desire';
        motivation.metadata.model = 'new-model';
      } catch {
        // In strict mode, assignment to frozen object throws
      }

      expect(motivation.directionId).toBe(originalDirectionId);
      expect(motivation.coreDesire).toBe(originalCoreDesire);
      expect(motivation.metadata).toBe(originalMetadata);
    });
  });

  describe('Factory Methods', () => {
    describe('fromLLMResponse', () => {
      it('should create motivation from LLM response data', () => {
        const rawMotivation = {
          coreDesire: 'To become a great leader',
          internalContradiction: 'Wants power but fears corruption',
          centralQuestion: 'Can power be used without corrupting the wielder?',
        };

        const motivation = CoreMotivation.fromLLMResponse({
          directionId: 'dir-123',
          conceptId: 'concept-456',
          rawMotivation,
        });

        expect(motivation.directionId).toBe('dir-123');
        expect(motivation.conceptId).toBe('concept-456');
        expect(motivation.coreDesire).toBe('To become a great leader');
        expect(motivation.internalContradiction).toBe(
          'Wants power but fears corruption'
        );
        expect(motivation.centralQuestion).toBe(
          'Can power be used without corrupting the wielder?'
        );
      });

      it('should handle alternative field names in LLM response', () => {
        const rawMotivation = {
          coreMotivation: 'To find true love',
          contradiction: 'Wants connection but fears vulnerability',
          question: 'Is love worth the risk of heartbreak?',
        };

        const motivation = CoreMotivation.fromLLMResponse({
          directionId: 'dir-123',
          conceptId: 'concept-456',
          rawMotivation,
        });

        expect(motivation.coreDesire).toBe('To find true love');
        expect(motivation.internalContradiction).toBe(
          'Wants connection but fears vulnerability'
        );
        expect(motivation.centralQuestion).toBe(
          'Is love worth the risk of heartbreak?'
        );
      });

      it('should handle additional alternative field names', () => {
        const rawMotivation = {
          motivation: 'To master the arcane arts',
          conflict: 'Seeks knowledge but risks losing humanity',
          question: 'What price is too high for ultimate knowledge?',
        };

        const motivation = CoreMotivation.fromLLMResponse({
          directionId: 'dir-123',
          conceptId: 'concept-456',
          rawMotivation,
        });

        expect(motivation.coreDesire).toBe('To master the arcane arts');
        expect(motivation.internalContradiction).toBe(
          'Seeks knowledge but risks losing humanity'
        );
        expect(motivation.centralQuestion).toBe(
          'What price is too high for ultimate knowledge?'
        );
      });

      it('should include metadata in created motivation', () => {
        const rawMotivation = {
          coreDesire: 'To become a great leader',
          internalContradiction: 'Wants power but fears corruption',
          centralQuestion: 'Can power be used without corrupting the wielder?',
        };
        const metadata = {
          model: 'gpt-4',
          temperature: 0.7,
          tokens: 150,
        };

        const motivation = CoreMotivation.fromLLMResponse({
          directionId: 'dir-123',
          conceptId: 'concept-456',
          rawMotivation,
          metadata,
        });

        expect(motivation.metadata).toEqual(metadata);
      });
    });

    describe('fromRawData', () => {
      it('should create motivation from raw data', () => {
        const motivation = CoreMotivation.fromRawData(validData);

        expect(motivation).toBeInstanceOf(CoreMotivation);
        expect(motivation.directionId).toBe('dir-123');
        expect(motivation.conceptId).toBe('concept-456');
      });

      it('should handle raw data with all fields', () => {
        const fullData = {
          ...validData,
          id: 'test-id',
          createdAt: '2024-01-01T00:00:00.000Z',
          metadata: {
            model: 'claude-3',
            temperature: 0.8,
            tokens: 200,
            responseTime: 1500,
            promptVersion: 'v1',
          },
        };

        const motivation = CoreMotivation.fromRawData(fullData);
        expect(motivation.id).toBe('test-id');
        expect(motivation.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(motivation.metadata.model).toBe('claude-3');
      });
    });
  });

  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const motivation = new CoreMotivation(validData);
      const json = motivation.toJSON();

      expect(json).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          directionId: 'dir-123',
          conceptId: 'concept-456',
          coreDesire: 'To become a legendary hero and save the world',
          internalContradiction:
            'Wants to help everyone but fears losing loved ones',
          centralQuestion: 'Can true heroism exist without sacrifice?',
          createdAt: expect.any(String),
          metadata: expect.any(Object),
        })
      );
    });

    it('should create deep copy of metadata in JSON', () => {
      validData.metadata = { model: 'gpt-4', tags: ['heroic'] };
      const motivation = new CoreMotivation(validData);
      const json = motivation.toJSON();

      expect(json.metadata).toEqual({ model: 'gpt-4', tags: ['heroic'] });
      expect(json.metadata).not.toBe(motivation.metadata);
    });
  });

  describe('Validation', () => {
    it('should validate content and return no errors for valid motivation', () => {
      const motivation = new CoreMotivation(validData);
      const result = motivation.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect content that is too short', () => {
      validData.coreDesire = 'short';
      validData.internalContradiction = 'also';
      validData.centralQuestion = 'what?';

      const motivation = new CoreMotivation(validData);
      const result = motivation.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain('Core desire is too short');
      expect(result.errors[1]).toContain('Internal contradiction is too short');
      expect(result.errors[2]).toContain('Central question is too short');
    });

    it('should warn about content that is too long', () => {
      const longText = 'a'.repeat(501);
      validData.coreDesire = longText;
      validData.internalContradiction = longText;
      validData.centralQuestion = longText + '?'; // Add question mark to avoid extra warning

      const motivation = new CoreMotivation(validData);
      const result = motivation.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings[0]).toContain('Core desire is very long');
      expect(result.warnings[1]).toContain(
        'Internal contradiction is very long'
      );
      expect(result.warnings[2]).toContain('Central question is very long');
    });

    it('should warn if central question lacks question mark', () => {
      validData.centralQuestion = 'This is not really a question';

      const motivation = new CoreMotivation(validData);
      const result = motivation.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(
        'Central question should end with a question mark'
      );
    });
  });

  describe('Utility Methods', () => {
    it('should format as string', () => {
      const motivation = new CoreMotivation(validData);
      const str = motivation.toString();

      expect(str).toContain(
        'Core Desire: To become a legendary hero and save the world'
      );
      expect(str).toContain(
        'Internal Contradiction: Wants to help everyone but fears losing loved ones'
      );
      expect(str).toContain(
        'Central Question: Can true heroism exist without sacrifice?'
      );
    });

    it('should generate summary with default max length', () => {
      const motivation = new CoreMotivation(validData);
      const summary = motivation.getSummary();

      expect(summary.coreDesire).toBe(validData.coreDesire);
      expect(summary.internalContradiction).toBe(
        validData.internalContradiction
      );
      expect(summary.centralQuestion).toBe(validData.centralQuestion);
    });

    it('should truncate summary fields when too long', () => {
      validData.coreDesire =
        'This is a very long core desire that should be truncated when we ask for a summary';
      const motivation = new CoreMotivation(validData);
      const summary = motivation.getSummary(20);

      expect(summary.coreDesire).toBe('This is a very lo...');
      expect(summary.coreDesire.length).toBe(20);
    });

    it('should clone motivation', () => {
      const original = new CoreMotivation(validData);
      const clone = original.clone();

      expect(clone).toBeInstanceOf(CoreMotivation);
      expect(clone).not.toBe(original);
      expect(clone.id).toBe(original.id);
      expect(clone.coreDesire).toBe(original.coreDesire);
    });

    it('should match search terms', () => {
      const motivation = new CoreMotivation(validData);

      expect(motivation.matchesSearch('hero')).toBe(true);
      expect(motivation.matchesSearch('HERO')).toBe(true);
      expect(motivation.matchesSearch('loved ones')).toBe(true);
      expect(motivation.matchesSearch('sacrifice')).toBe(true);
      expect(motivation.matchesSearch('nonexistent')).toBe(false);
    });

    it('should handle empty search terms', () => {
      const motivation = new CoreMotivation(validData);

      expect(motivation.matchesSearch('')).toBe(true);
      expect(motivation.matchesSearch(' ')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only required fields during validation', () => {
      expect(
        () =>
          new CoreMotivation({
            directionId: '   ',
            conceptId: 'concept-1',
            coreDesire: 'desire',
            internalContradiction: 'contradiction',
            centralQuestion: 'question?',
          })
      ).toThrow('Direction ID is required');
    });

    it('should handle non-string required fields', () => {
      expect(
        () =>
          new CoreMotivation({
            directionId: 123,
            conceptId: 'concept-1',
            coreDesire: 'desire',
            internalContradiction: 'contradiction',
            centralQuestion: 'question?',
          })
      ).toThrow('Direction ID is required');
    });

    it('should handle undefined vs null metadata', () => {
      validData.metadata = undefined;
      const motivation = new CoreMotivation(validData);
      expect(motivation.metadata).toEqual({});
    });

    it('should preserve metadata structure in clone', () => {
      validData.metadata = {
        model: 'gpt-4',
        nested: { data: 'value' },
        array: [1, 2, 3],
      };
      const original = new CoreMotivation(validData);
      const clone = original.clone();

      expect(clone.metadata).toEqual(original.metadata);
      expect(clone.metadata).not.toBe(original.metadata);
    });
  });
});
