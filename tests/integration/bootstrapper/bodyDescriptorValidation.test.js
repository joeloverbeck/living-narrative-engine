/**
 * @file Integration tests for body descriptor bootstrap validation using real services.
 *
 * Tests that bootstrap validation runs correctly during anatomy formatting service initialization,
 * with environment-specific behavior for development vs production.
 */

import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { initializeAnatomyFormattingStage } from '../../../src/bootstrapper/stages/anatomyFormattingStage.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

const FINAL_MOD_ORDER_KEY = 'final_mod_order';

/**
 * @returns {{logger: any}} Logger that records structured log arguments by level.
 */
function createCapturingLogger() {
  const entries = { info: [], debug: [], warn: [], error: [] };
  const logger = {
    info: (...args) => entries.info.push(args),
    debug: (...args) => entries.debug.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
    entries,
  };
  return logger;
}

describe('Body Descriptor Bootstrap Validation - Integration', () => {
  let container;
  let registrar;
  let logger;
  let dataRegistry;
  let safeEventDispatcher;
  let originalNodeEnv;

  beforeEach(() => {
    container = new AppContainer();
    registrar = new Registrar(container);
    logger = createCapturingLogger();

    dataRegistry = new InMemoryDataRegistry({ logger });
    const eventBus = new EventBus({ logger });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });

    registrar.instance(tokens.ILogger, logger);
    registrar.instance(tokens.IDataRegistry, dataRegistry);
    registrar.instance(tokens.ISafeEventDispatcher, safeEventDispatcher);

    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  /**
   * Registers the real AnatomyFormattingService using the prepared dependencies.
   */
  function registerAnatomyFormattingService() {
    registrar.singletonFactory(
      tokens.AnatomyFormattingService,
      () =>
        new AnatomyFormattingService({
          dataRegistry,
          logger,
          safeEventDispatcher,
        })
    );
  }

  describe('Valid Configuration', () => {
    it('should bootstrap successfully with valid configuration', async () => {
      process.env.NODE_ENV = 'development';
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store valid configuration with all body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: [
          'height',
          'skin_color',
          'build',
          'body_composition',
          'body_hair',
          'smell',
        ],
        descriptorOrder: ['size', 'color', 'shape'],
        descriptorValueKeys: ['value', 'description'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      expect(result.success).toBe(true);
      expect(result.payload.anatomyFormattingService).toBeDefined();

      // Should not log any warnings or errors
      expect(logger.entries.warn).toHaveLength(0);
      expect(logger.entries.error).toHaveLength(0);
    });
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should succeed but log warnings when descriptors missing from config', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['height'], // Missing many descriptors
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      // Should succeed (warnings don't prevent bootstrap)
      expect(result.success).toBe(true);

      // Should log warnings
      expect(logger.entries.warn.length).toBeGreaterThan(0);
      const warningMessages = logger.entries.warn
        .map((args) => args[0])
        .join(' ');
      expect(warningMessages).toContain('missing from descriptionOrder');
    });

    it('should log actionable guidance for missing descriptors', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head'],
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      await initializeAnatomyFormattingStage(container, logger, tokens);

      // Should output actionable guidance to console
      expect(consoleWarnSpy).toHaveBeenCalled();
      const consoleOutput = consoleWarnSpy.mock.calls
        .map((call) => call[0])
        .join(' ');
      expect(consoleOutput).toContain('Body Descriptor Configuration Issues');
      expect(consoleOutput).toContain(
        'data/mods/anatomy/anatomy-formatting/default.json'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should succeed with warnings when descriptionOrder is empty', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration with empty descriptionOrder
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: [], // Empty array
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      // Empty descriptionOrder generates warnings but doesn't fail bootstrap
      expect(result.success).toBe(true);

      // Should log warnings about all missing descriptors
      expect(logger.entries.warn.length).toBeGreaterThan(0);
      const warningMessages = logger.entries.warn
        .map((args) => args[0])
        .join(' ');
      expect(warningMessages).toContain('missing from descriptionOrder');
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not fail when descriptors missing from config', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head'], // Missing many descriptors
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      // Should succeed in production mode
      expect(result.success).toBe(true);
      expect(result.payload.anatomyFormattingService).toBeDefined();

      // Should log warnings but not fail
      expect(logger.entries.warn.length).toBeGreaterThan(0);
      const warningMessages = logger.entries.warn
        .map((args) => args[0])
        .join(' ');
      expect(warningMessages).toContain('missing from descriptionOrder');
    });

    it('should not output console warnings in production', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head'],
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      expect(result.success).toBe(true);

      // Should not output to console in production
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should log warnings and continue operation', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing body descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head'],
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      expect(result.success).toBe(true);

      // Service should be initialized and functional
      const service = result.payload.anatomyFormattingService;
      expect(service._configInitialized).toBe(true);
      expect(service.getDescriptionOrder()).toEqual(['head']);
    });
  });

  describe('Multiple Validation Issues', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should report multiple missing descriptors', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration missing multiple descriptors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head', 'eyes'], // Missing several descriptors
        descriptorOrder: ['size'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
      });

      await initializeAnatomyFormattingStage(container, logger, tokens);

      // Should log multiple warnings
      expect(logger.entries.warn.length).toBeGreaterThan(1);

      const warningMessages = logger.entries.warn
        .map((args) => args[0])
        .join(' ');

      // Should mention multiple missing descriptors
      expect(warningMessages).toContain('missing from descriptionOrder');
    });
  });

  describe('System Continues Working After Validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should allow service operations after warning-level issues', async () => {
      registerAnatomyFormattingService();

      const modLoadOrder = ['anatomy'];
      dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

      // Store configuration with warnings but no errors
      dataRegistry.store('anatomyFormatting', 'default', {
        id: 'default',
        _modId: 'anatomy',
        descriptionOrder: ['head', 'eyes'],
        descriptorOrder: ['size', 'color'],
        descriptorValueKeys: ['value'],
        groupedParts: [],
        pairedParts: ['eyes'],
        irregularPlurals: {},
        noArticleParts: [],
      });

      const result = await initializeAnatomyFormattingStage(
        container,
        logger,
        tokens
      );

      expect(result.success).toBe(true);

      const service = result.payload.anatomyFormattingService;

      // Service should be fully functional
      expect(service.getDescriptionOrder()).toEqual(['head', 'eyes']);
      expect(service.getDescriptorOrder()).toEqual(['size', 'color']);
      expect([...service.getPairedParts()]).toContain('eyes');
    });
  });
});
