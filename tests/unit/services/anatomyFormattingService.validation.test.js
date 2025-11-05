import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';

// Helper to create mock logger (defined locally per test file convention)
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Helper to create mock data registry
const createMockRegistry = (configs, mods = ['core']) => ({
  getAll: jest.fn((type) => {
    if (type === 'anatomyFormatting') return configs;
    return [];
  }),
  get: jest.fn((type, id) => {
    if (type === 'meta' && id === 'final_mod_order') {
      return mods;
    }
    return null;
  }),
});

// Helper to create mock safe event dispatcher
const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

describe('AnatomyFormattingService - Bootstrap Validation', () => {
  let originalNodeEnv;

  beforeEach(() => {
    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log warnings but not throw for incomplete descriptionOrder', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['height'], // Incomplete - missing other descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should log warnings for missing descriptors but not throw
      expect(() => {
        service.initialize();
      }).not.toThrow();

      // Should log warnings
      expect(logger.warn).toHaveBeenCalled();
      const warningCalls = logger.warn.mock.calls.map((call) => call[0]);
      expect(
        warningCalls.some((msg) => msg.includes('missing from descriptionOrder'))
      ).toBe(true);
    });

    it('should log warnings for missing descriptors', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      try {
        service.initialize();
      } catch {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalled();
      const warningCalls = logger.warn.mock.calls.map((call) => call[0]);
      expect(
        warningCalls.some((msg) => msg.includes('missing from descriptionOrder'))
      ).toBe(true);
    });

    it('should succeed when all descriptors are present', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: [
              'height',
              'skin_color',
              'build',
              'body_composition',
              'body_hair',
              'smell',
            ],
            descriptorOrder: ['size', 'color'],
            descriptorValueKeys: ['value', 'description'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should not throw when all descriptors are present
      expect(() => {
        service.initialize();
      }).not.toThrow();

      // Should not log warnings
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log clear actionable messages', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      try {
        service.initialize();
      } catch {
        // Expected to throw
      }

      // Should include actionable guidance in console output
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warningOutput = consoleWarnSpy.mock.calls
        .map((call) => call[0])
        .join(' ');
      expect(warningOutput).toContain('Body Descriptor Configuration Issues');
      expect(warningOutput).toContain(
        'data/mods/anatomy/anatomy-formatting/default.json'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not fail when descriptors missing from config', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should NOT throw in production mode
      expect(() => {
        service.initialize();
      }).not.toThrow();
    });

    it('should log warnings but continue', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'],
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      expect(logger.warn).toHaveBeenCalled();
      expect(service._configInitialized).toBe(true);
    });

    it('should not output console warnings in production', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'], // Missing body descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      // Should not output to console in production
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Validator Integration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should initialize validator in constructor', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'],
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Validator should be initialized
      expect(service._validator).toBeDefined();
    });

    it('should call validator during initialization', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'],
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Mock the validator's validateFormattingConfig method
      const mockValidate = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      service._validator.validateFormattingConfig = mockValidate;

      service.initialize();

      // Validator should be called during initialization
      expect(mockValidate).toHaveBeenCalledWith(service._mergedConfig);
    });
  });

  describe('Warning Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should handle multiple validation warnings', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['height'], // Missing many descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      // Should not throw even with multiple warnings
      expect(() => {
        service.initialize();
      }).not.toThrow();

      // Should log multiple warnings
      expect(logger.warn.mock.calls.length).toBeGreaterThan(1);
    });

    it('should include descriptive information in warnings', () => {
      const registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['height'], // Missing many descriptors
            descriptorOrder: ['size'],
            descriptorValueKeys: ['value'],
            groupedParts: [],
            pairedParts: [],
            irregularPlurals: {},
            noArticleParts: [],
          },
        ],
        ['core']
      );
      const logger = createMockLogger();
      const safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      const warningMessages = logger.warn.mock.calls.map((call) => call[0]).join(' ');
      expect(warningMessages).toContain('missing from descriptionOrder');
      expect(warningMessages).toContain('Body Descriptor Config');
    });
  });
});
