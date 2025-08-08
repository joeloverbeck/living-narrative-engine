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

  afterEach(() => {
    jest.clearAllMocks();
  });
});
