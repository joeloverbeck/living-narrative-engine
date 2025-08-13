import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

describe('ActionTraceFilter - Basic Functionality', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('Construction and Initialization', () => {
    it('should create instance with default configuration', () => {
      const filter = new ActionTraceFilter({
        logger: mockLogger,
      });

      expect(filter.isEnabled()).toBe(true);
      expect(filter.getVerbosityLevel()).toBe('standard');
      expect(filter.shouldTrace('core:go')).toBe(true); // Default traces all
    });

    it('should create instance with custom configuration', () => {
      const filter = new ActionTraceFilter({
        enabled: false,
        tracedActions: ['core:go'],
        verbosityLevel: 'detailed',
        logger: mockLogger,
      });

      expect(filter.isEnabled()).toBe(false);
      expect(filter.getVerbosityLevel()).toBe('detailed');
      expect(filter.shouldTrace('core:go')).toBe(false); // Disabled
    });
  });

  describe('Action Filtering', () => {
    it('should trace actions matching patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:*', 'test:action'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('core:look')).toBe(true);
      expect(filter.shouldTrace('test:action')).toBe(true);
      expect(filter.shouldTrace('other:action')).toBe(false);
    });

    it('should respect exclusion patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*'],
        excludedActions: ['debug:*'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('debug:trace')).toBe(false);
    });

    it('should handle wildcard suffix patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*:action', '*:test'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:action')).toBe(true);
      expect(filter.shouldTrace('mod:action')).toBe(true);
      expect(filter.shouldTrace('any:test')).toBe(true);
      expect(filter.shouldTrace('core:other')).toBe(false);
    });

    it('should handle regex patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['/^core:.+go$/'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(false); // Doesn't match .+
      expect(filter.shouldTrace('core:and_go')).toBe(true);
      expect(filter.shouldTrace('core:lets_go')).toBe(true);
      expect(filter.shouldTrace('mod:go')).toBe(false);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['/[invalid/'],
        logger: mockLogger,
      });

      // Should not throw, just warn and not match
      expect(filter.shouldTrace('anything')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid regex pattern'),
        expect.any(Error)
      );
    });

    it('should prioritize exclusions over inclusions', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*'],
        excludedActions: ['*:action'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('core:action')).toBe(false);
      expect(filter.shouldTrace('mod:action')).toBe(false);
    });
  });

  describe('Action Management', () => {
    it('should add traced actions dynamically', () => {
      const filter = new ActionTraceFilter({
        tracedActions: [],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(false);

      filter.addTracedActions('core:go');
      expect(filter.shouldTrace('core:go')).toBe(true);

      filter.addTracedActions(['test:action1', 'test:action2']);
      expect(filter.shouldTrace('test:action1')).toBe(true);
      expect(filter.shouldTrace('test:action2')).toBe(true);
    });

    it('should validate action when adding to traced list', () => {
      const filter = new ActionTraceFilter({
        logger: mockLogger,
      });

      expect(() => {
        filter.addTracedActions('');
      }).toThrow("Parameter 'action' must be a non-blank string");

      expect(() => {
        filter.addTracedActions(['valid', '']);
      }).toThrow("Parameter 'action' must be a non-blank string");
    });

    it('should remove traced actions dynamically', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:go', 'test:action'],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('test:action')).toBe(true);

      filter.removeTracedActions('core:go');
      expect(filter.shouldTrace('core:go')).toBe(false);
      expect(filter.shouldTrace('test:action')).toBe(true);

      filter.removeTracedActions(['test:action']);
      expect(filter.shouldTrace('test:action')).toBe(false);
    });

    it('should add excluded actions dynamically', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*'],
        excludedActions: [],
        logger: mockLogger,
      });

      expect(filter.shouldTrace('debug:trace')).toBe(true);

      filter.addExcludedActions('debug:trace');
      expect(filter.shouldTrace('debug:trace')).toBe(false);

      filter.addExcludedActions(['test:action1', 'test:action2']);
      expect(filter.shouldTrace('test:action1')).toBe(false);
      expect(filter.shouldTrace('test:action2')).toBe(false);
    });

    it('should validate action when adding to excluded list', () => {
      const filter = new ActionTraceFilter({
        logger: mockLogger,
      });

      expect(() => {
        filter.addExcludedActions('');
      }).toThrow("Parameter 'action' must be a non-blank string");

      expect(() => {
        filter.addExcludedActions(['valid', '']);
      }).toThrow("Parameter 'action' must be a non-blank string");
    });
  });

  describe('Configuration Management', () => {
    it('should update verbosity level', () => {
      const filter = new ActionTraceFilter({
        verbosityLevel: 'minimal',
        logger: mockLogger,
      });

      expect(filter.getVerbosityLevel()).toBe('minimal');

      filter.setVerbosityLevel('verbose');
      expect(filter.getVerbosityLevel()).toBe('verbose');
    });

    it('should throw error for invalid verbosity level', () => {
      const filter = new ActionTraceFilter({
        logger: mockLogger,
      });

      expect(() => {
        filter.setVerbosityLevel('invalid');
      }).toThrow(
        'Invalid verbosity level: invalid. Must be one of: minimal, standard, detailed, verbose'
      );
    });

    it('should get inclusion configuration', () => {
      const filter = new ActionTraceFilter({
        inclusionConfig: {
          componentData: true,
          prerequisites: false,
          targets: true,
        },
        logger: mockLogger,
      });

      const config = filter.getInclusionConfig();
      expect(config).toEqual({
        componentData: true,
        prerequisites: false,
        targets: true,
      });

      // Verify returned object is a copy
      config.componentData = false;
      expect(filter.getInclusionConfig().componentData).toBe(true);
    });

    it('should update inclusion configuration', () => {
      const filter = new ActionTraceFilter({
        inclusionConfig: {
          componentData: false,
          prerequisites: false,
          targets: false,
        },
        logger: mockLogger,
      });

      filter.updateInclusionConfig({
        componentData: true,
        targets: true,
      });

      const config = filter.getInclusionConfig();
      expect(config).toEqual({
        componentData: true,
        prerequisites: false,
        targets: true,
      });
    });

    it('should throw error for invalid inclusion config', () => {
      expect(() => {
        new ActionTraceFilter({
          inclusionConfig: 'not-an-object',
          logger: mockLogger,
        });
      }).toThrow('Inclusion config must be an object');

      expect(() => {
        new ActionTraceFilter({
          inclusionConfig: null,
          logger: mockLogger,
        });
      }).toThrow('Inclusion config must be an object');
    });

    it('should provide configuration summary', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:*'],
        excludedActions: ['debug:*'],
        verbosityLevel: 'detailed',
        logger: mockLogger,
      });

      const summary = filter.getConfigurationSummary();
      expect(summary).toMatchObject({
        enabled: true,
        tracedActionCount: 1,
        excludedActionCount: 1,
        verbosityLevel: 'detailed',
      });
    });
  });

  describe('System Action Bypass', () => {
    it('should always trace system actions when tracing is enabled', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [], // No patterns - normally wouldn't trace anything
        excludedActions: ['*'], // Exclude everything
        logger: mockLogger,
      });

      // System actions should bypass all filtering
      expect(filter.shouldTrace('__system:init')).toBe(true);
      expect(filter.shouldTrace('__internal:process')).toBe(true);
      expect(filter.shouldTrace('__debug:trace')).toBe(true);

      // Verify the bypass logging occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('system action bypass')
      );
    });

    it('should not trace system actions when tracing is globally disabled', () => {
      const filter = new ActionTraceFilter({
        enabled: false,
        tracedActions: ['*'], // Trace everything
        logger: mockLogger,
      });

      // Even system actions respect global disable
      expect(filter.shouldTrace('__system:init')).toBe(false);
      expect(filter.shouldTrace('__internal:process')).toBe(false);
    });

    it('should trace system actions regardless of exclusion patterns', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        excludedActions: ['__system:*', '__*'], // Try to exclude system actions
        logger: mockLogger,
      });

      // System actions bypass exclusion patterns
      expect(filter.shouldTrace('__system:init')).toBe(true);
      expect(filter.shouldTrace('__internal:process')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long action IDs', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:*'],
        logger: mockLogger,
      });

      const longId = 'core:' + 'a'.repeat(1000);
      expect(filter.shouldTrace(longId)).toBe(true);

      const veryLongId = 'mod:' + 'b'.repeat(10000);
      expect(filter.shouldTrace(veryLongId)).toBe(false);
    });

    it('should handle special characters in action IDs', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['special:*', 'emoji:*', 'unicode:*'],
        logger: mockLogger,
      });

      // Unicode characters
      expect(filter.shouldTrace('unicode:测试')).toBe(true);
      expect(filter.shouldTrace('unicode:🎮')).toBe(true);
      expect(filter.shouldTrace('unicode:ñoño')).toBe(true);

      // Special symbols
      expect(filter.shouldTrace('special:@#$%')).toBe(true);
      expect(filter.shouldTrace('special:!&*()')).toBe(true);

      // Emojis
      expect(filter.shouldTrace('emoji:🚀🔥💯')).toBe(true);
    });

    it('should handle empty arrays for traced and excluded actions', () => {
      const filter = new ActionTraceFilter({
        tracedActions: [],
        excludedActions: [],
        logger: mockLogger,
      });

      // With empty traced actions, nothing should be traced
      expect(filter.shouldTrace('core:go')).toBe(false);
      expect(filter.shouldTrace('test:action')).toBe(false);
    });

    it('should handle duplicate patterns in sets', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:*', 'core:*', 'core:go', 'core:go'],
        excludedActions: ['debug:*', 'debug:*'],
        logger: mockLogger,
      });

      // Should work correctly despite duplicates
      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('core:take')).toBe(true);
      expect(filter.shouldTrace('debug:trace')).toBe(false);

      // Check that duplicates are deduplicated in the summary
      const summary = filter.getConfigurationSummary();
      const corePatterns = summary.tracedActions.filter((a) => a === 'core:*');
      expect(corePatterns.length).toBe(1);
    });

    it('should handle removing patterns that do not exist', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:go'],
        logger: mockLogger,
      });

      // Should not throw when removing non-existent patterns
      expect(() => {
        filter.removeTracedActions('non:existent');
        filter.removeTracedActions(['also:missing', 'not:there']);
      }).not.toThrow();

      // Original pattern should still work
      expect(filter.shouldTrace('core:go')).toBe(true);
    });

    it('should handle null and undefined in action arrays gracefully', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['core:*'],
        logger: mockLogger,
      });

      // Arrays with null/undefined should be handled
      expect(() => {
        filter.addTracedActions(['valid:action', null, 'another:valid']);
      }).toThrow(); // Should throw on invalid action

      expect(() => {
        filter.addTracedActions([undefined, 'valid:action']);
      }).toThrow(); // Should throw on invalid action
    });

    it('should handle complex regex patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: [
          '/^core:(go|take|use)$/', // Alternation
          '/^mod:[a-z]+_[0-9]+$/', // Character classes
          '/^test:.{3,5}$/', // Quantifiers
          '/^special:(?!exclude).*/', // Negative lookahead
        ],
        logger: mockLogger,
      });

      // Test alternation
      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('core:take')).toBe(true);
      expect(filter.shouldTrace('core:walk')).toBe(false);

      // Test character classes
      expect(filter.shouldTrace('mod:action_123')).toBe(true);
      expect(filter.shouldTrace('mod:ACTION_123')).toBe(false);

      // Test quantifiers
      expect(filter.shouldTrace('test:abc')).toBe(true);
      expect(filter.shouldTrace('test:abcde')).toBe(true);
      expect(filter.shouldTrace('test:ab')).toBe(false);
      expect(filter.shouldTrace('test:abcdef')).toBe(false);

      // Test negative lookahead
      expect(filter.shouldTrace('special:include')).toBe(true);
      expect(filter.shouldTrace('special:exclude')).toBe(false);
    });
  });

  describe('Complex Pattern Interactions', () => {
    it('should handle multiple overlapping wildcard patterns', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*:go', 'core:*', '*'],
        excludedActions: ['debug:*', '*:debug'],
        logger: mockLogger,
      });

      // All patterns should work together
      expect(filter.shouldTrace('core:go')).toBe(true); // Matches all three patterns
      expect(filter.shouldTrace('mod:go')).toBe(true); // Matches *:go and *
      expect(filter.shouldTrace('core:take')).toBe(true); // Matches core:* and *
      expect(filter.shouldTrace('any:thing')).toBe(true); // Matches *

      // Exclusions should still apply
      expect(filter.shouldTrace('debug:go')).toBe(false); // Excluded by debug:*
      expect(filter.shouldTrace('core:debug')).toBe(false); // Excluded by *:debug
    });

    it('should prioritize exclusions over any inclusion pattern type', () => {
      const filter = new ActionTraceFilter({
        tracedActions: [
          'test:specific',
          'test:*',
          '*:specific',
          '*',
          '/^test:.*/',
        ],
        excludedActions: ['test:specific'],
        logger: mockLogger,
      });

      // Despite matching all possible inclusion patterns, exclusion wins
      expect(filter.shouldTrace('test:specific')).toBe(false);
      expect(filter.shouldTrace('test:other')).toBe(true);
    });

    it('should handle pattern order independence', () => {
      const filter1 = new ActionTraceFilter({
        tracedActions: ['core:*', 'test:action', '*:special'],
        logger: mockLogger,
      });

      const filter2 = new ActionTraceFilter({
        tracedActions: ['*:special', 'core:*', 'test:action'],
        logger: mockLogger,
      });

      const filter3 = new ActionTraceFilter({
        tracedActions: ['test:action', '*:special', 'core:*'],
        logger: mockLogger,
      });

      // All filters should behave identically regardless of pattern order
      const testCases = [
        'core:go',
        'core:take',
        'test:action',
        'mod:special',
        'other:other',
      ];

      for (const actionId of testCases) {
        const result1 = filter1.shouldTrace(actionId);
        const result2 = filter2.shouldTrace(actionId);
        const result3 = filter3.shouldTrace(actionId);
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      }
    });

    it('should handle mixed pattern types (exact, wildcard, regex)', () => {
      const filter = new ActionTraceFilter({
        tracedActions: [
          'exact:match', // Exact
          'prefix:*', // Prefix wildcard
          '*:suffix', // Suffix wildcard
          '/^regex:[0-9]+$/', // Regex
        ],
        logger: mockLogger,
      });

      // Test each pattern type
      expect(filter.shouldTrace('exact:match')).toBe(true);
      expect(filter.shouldTrace('exact:other')).toBe(false);

      expect(filter.shouldTrace('prefix:anything')).toBe(true);
      expect(filter.shouldTrace('other:anything')).toBe(false);

      expect(filter.shouldTrace('anything:suffix')).toBe(true);
      expect(filter.shouldTrace('anything:other')).toBe(false);

      expect(filter.shouldTrace('regex:123')).toBe(true);
      expect(filter.shouldTrace('regex:abc')).toBe(false);
    });

    it('should handle complex exclusion scenarios', () => {
      const filter = new ActionTraceFilter({
        tracedActions: ['*'], // Trace everything
        excludedActions: [
          'debug:*', // Exclude all debug
          '*:internal', // Exclude all internal
          'test:specific', // Exclude specific test
          '/^temp:.*/', // Exclude temp via regex
        ],
        logger: mockLogger,
      });

      // Normal actions should be traced
      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('mod:action')).toBe(true);

      // Excluded patterns should not be traced
      expect(filter.shouldTrace('debug:anything')).toBe(false);
      expect(filter.shouldTrace('anything:internal')).toBe(false);
      expect(filter.shouldTrace('test:specific')).toBe(false);
      expect(filter.shouldTrace('temp:file123')).toBe(false);

      // System actions should still bypass exclusions
      expect(filter.shouldTrace('__system:internal')).toBe(true);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
