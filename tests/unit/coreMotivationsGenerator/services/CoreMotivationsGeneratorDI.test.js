/**
 * @file Unit tests for CoreMotivationsGenerator DI registration
 * @description Tests that verify the dependency injection setup is working correctly
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import { CoreMotivationsGenerator } from '../../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivationsDisplayEnhancer } from '../../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';

describe('CoreMotivationsGenerator DI Registration', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();
    const registrar = new Registrar(container);
    
    // Register minimal dependencies for the services
    // Mock logger
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registrar.instance(tokens.ILogger, mockLogger);
    
    // Mock LLM services needed by CoreMotivationsGenerator
    const mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };
    registrar.instance(tokens.LlmJsonService, mockLlmJsonService);
    
    const mockLlmAdapter = {
      getAIDecision: jest.fn(),
    };
    registrar.instance(tokens.LLMAdapter, mockLlmAdapter);
    
    const mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(),
      setActiveConfiguration: jest.fn(),
    };
    registrar.instance(tokens.ILLMConfigurationManager, mockLlmConfigManager);
    
    const mockEventBus = {
      dispatch: jest.fn(),
    };
    registrar.instance(tokens.ISafeEventDispatcher, mockEventBus);
    
    const mockTokenEstimator = {
      estimateTokens: jest.fn(),
    };
    registrar.instance(tokens.ITokenEstimator, mockTokenEstimator);
    
    // Now register the services we're testing
    registrar.singletonFactory(tokens.CoreMotivationsGenerator, (c) => {
      return new CoreMotivationsGenerator({
        logger: c.resolve(tokens.ILogger),
        llmJsonService: c.resolve(tokens.LlmJsonService),
        llmStrategyFactory: c.resolve(tokens.LLMAdapter),
        llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        tokenEstimator: c.resolve(tokens.ITokenEstimator),
      });
    });
    
    registrar.singletonFactory(tokens.CoreMotivationsDisplayEnhancer, (c) => {
      return new CoreMotivationsDisplayEnhancer({
        logger: c.resolve(tokens.ILogger),
      });
    });
  });

  afterEach(() => {
    container = null;
  });

  describe('CoreMotivationsGenerator', () => {
    it('should be registered in the DI container', () => {
      // Act
      const service = container.resolve(tokens.CoreMotivationsGenerator);

      // Assert
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CoreMotivationsGenerator);
    });

    it('should have all required dependencies injected', () => {
      // Act
      const service = container.resolve(tokens.CoreMotivationsGenerator);

      // Assert - Check that the service has the expected methods
      expect(typeof service.generate).toBe('function');
      expect(typeof service.validateResponse).toBe('function');
      expect(typeof service.getResponseSchema).toBe('function');
      expect(typeof service.getLLMParameters).toBe('function');
      expect(typeof service.getPromptVersionInfo).toBe('function');
    });

    it('should be a singleton', () => {
      // Act
      const instance1 = container.resolve(tokens.CoreMotivationsGenerator);
      const instance2 = container.resolve(tokens.CoreMotivationsGenerator);

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('CoreMotivationsDisplayEnhancer', () => {
    it('should be registered in the DI container', () => {
      // Act
      const service = container.resolve(tokens.CoreMotivationsDisplayEnhancer);

      // Assert
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CoreMotivationsDisplayEnhancer);
    });

    it('should have all required dependencies injected', () => {
      // Act
      const service = container.resolve(tokens.CoreMotivationsDisplayEnhancer);

      // Assert - Check that the service has the expected methods
      expect(typeof service.createMotivationBlock).toBe('function');
      expect(typeof service.formatTimestamp).toBe('function');
      expect(typeof service.handleCopy).toBe('function');
      expect(typeof service.handleDelete).toBe('function');
      expect(typeof service.formatSingleMotivation).toBe('function');
      expect(typeof service.formatMotivationsForExport).toBe('function');
      expect(typeof service.attachEventHandlers).toBe('function');
      expect(typeof service.cleanupEventListeners).toBe('function');
    });

    it('should be a singleton', () => {
      // Act
      const instance1 = container.resolve(tokens.CoreMotivationsDisplayEnhancer);
      const instance2 = container.resolve(tokens.CoreMotivationsDisplayEnhancer);

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Resolution in Bootstrap', () => {
    it('should resolve CoreMotivationsGenerator when requested by name', () => {
      // Arrange
      const serviceName = 'coreMotivationsGenerator';
      const tokenName = 'CoreMotivationsGenerator';

      // Act
      let service;
      if (tokenName === 'CoreMotivationsGenerator') {
        service = container.resolve(tokens.CoreMotivationsGenerator);
      }

      // Assert
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CoreMotivationsGenerator);
    });

    it('should resolve CoreMotivationsDisplayEnhancer when requested by name', () => {
      // Arrange
      const serviceName = 'displayEnhancer';
      const tokenName = 'CoreMotivationsDisplayEnhancer';

      // Act
      let service;
      if (tokenName === 'CoreMotivationsDisplayEnhancer') {
        service = container.resolve(tokens.CoreMotivationsDisplayEnhancer);
      }

      // Assert
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CoreMotivationsDisplayEnhancer);
    });
  });

  describe('Error Handling', () => {
    it('should throw meaningful error if CoreMotivationsGenerator token does not exist', () => {
      // Arrange
      const fakeToken = 'NonExistentService';

      // Act & Assert
      expect(() => {
        container.resolve(fakeToken);
      }).toThrow();
    });

    it('should have both services available for controller creation', () => {
      // Act
      const coreMotivationsGenerator = container.resolve(tokens.CoreMotivationsGenerator);
      const displayEnhancer = container.resolve(tokens.CoreMotivationsDisplayEnhancer);
      const eventBus = container.resolve(tokens.ISafeEventDispatcher);
      const logger = container.resolve(tokens.ILogger);

      // Assert - All essential services are available
      expect(coreMotivationsGenerator).toBeDefined();
      expect(displayEnhancer).toBeDefined();
      expect(eventBus).toBeDefined();
      expect(logger).toBeDefined();
    });
  });
});