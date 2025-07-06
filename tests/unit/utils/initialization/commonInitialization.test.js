import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  initializeCoreServices,
  initializeAnatomyServices,
  initializeAuxiliaryServices,
} from '../../../../src/utils/initialization/commonInitialization.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

/**
 * Helper to create a mock container with predefined resolutions
 *
 * @param resolutions
 */
function createContainer(resolutions) {
  return {
    resolve: jest.fn((token) => {
      if (token in resolutions) {
        return resolutions[token];
      }
      throw new Error(`Unknown token ${token}`);
    }),
  };
}

describe('commonInitialization', () => {
  describe('initializeCoreServices', () => {
    let container;
    const tokens = {
      ILogger: 'ILogger',
      ModsLoader: 'ModsLoader',
      IDataRegistry: 'IDataRegistry',
      IEntityManager: 'IEntityManager',
      SystemInitializer: 'SystemInitializer',
      ISafeEventDispatcher: 'ISafeEventDispatcher',
    };

    const logger = createLogger();
    const modsLoader = { loadMods: jest.fn() };
    const registry = {};
    const entityManager = {};
    const systemInitializer = {};
    const eventDispatcher = {};

    beforeEach(() => {
      container = createContainer({
        [tokens.ILogger]: logger,
        [tokens.ModsLoader]: modsLoader,
        [tokens.IDataRegistry]: registry,
        [tokens.IEntityManager]: entityManager,
        [tokens.SystemInitializer]: systemInitializer,
        [tokens.ISafeEventDispatcher]: eventDispatcher,
      });
    });

    it('resolves core services and returns them', async () => {
      const result = await initializeCoreServices(container, tokens);

      expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(container.resolve).toHaveBeenCalledWith(tokens.ModsLoader);
      expect(container.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
      expect(container.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(container.resolve).toHaveBeenCalledWith(tokens.SystemInitializer);
      expect(container.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Core services resolved successfully'
      );
      expect(result).toEqual({
        logger,
        modsLoader,
        registry,
        entityManager,
        systemInitializer,
        eventDispatcher,
      });
    });

    it('propagates errors from the container', async () => {
      container.resolve.mockImplementation(() => {
        throw new Error('boom');
      });

      await expect(initializeCoreServices(container, tokens)).rejects.toThrow(
        'boom'
      );
    });
  });

  describe('initializeAnatomyServices', () => {
    let container;
    let logger;
    const tokens = {
      AnatomyFormattingService: 'AnatomyFormattingService',
      AnatomyDescriptionService: 'AnatomyDescriptionService',
    };

    const formattingService = { initialize: jest.fn() };
    const descriptionService = {};

    beforeEach(() => {
      logger = createLogger();
      container = createContainer({
        [tokens.AnatomyFormattingService]: formattingService,
        [tokens.AnatomyDescriptionService]: descriptionService,
      });
    });

    it('initializes and returns anatomy services', async () => {
      const result = await initializeAnatomyServices(container, logger, tokens);

      expect(container.resolve).toHaveBeenCalledWith(
        tokens.AnatomyFormattingService
      );
      expect(container.resolve).toHaveBeenCalledWith(
        tokens.AnatomyDescriptionService
      );
      expect(formattingService.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'AnatomyFormattingService initialized successfully'
      );
      expect(result).toEqual({
        anatomyFormattingService: formattingService,
        anatomyDescriptionService: descriptionService,
      });
    });

    it('propagates errors when initialization fails', async () => {
      formattingService.initialize.mockRejectedValue(new Error('fail'));

      await expect(
        initializeAnatomyServices(container, logger, tokens)
      ).rejects.toThrow('fail');
    });
  });

  describe('initializeAuxiliaryServices', () => {
    let container;
    let logger;
    const tokens = {
      SystemInitializer: 'SystemInitializer',
    };
    const systemInitializer = { initializeAll: jest.fn() };

    beforeEach(() => {
      logger = createLogger();
      container = createContainer({
        [tokens.SystemInitializer]: systemInitializer,
      });
    });

    it('initializes auxiliary services', async () => {
      await initializeAuxiliaryServices(container, logger, tokens);

      expect(container.resolve).toHaveBeenCalledWith(tokens.SystemInitializer);
      expect(systemInitializer.initializeAll).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Auxiliary services initialized successfully'
      );
    });

    it('propagates errors from systemInitializer', async () => {
      systemInitializer.initializeAll.mockRejectedValue(new Error('oops'));

      await expect(
        initializeAuxiliaryServices(container, logger, tokens)
      ).rejects.toThrow('oops');
    });
  });
});
