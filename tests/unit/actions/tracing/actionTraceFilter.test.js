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
