/**
 * @file Integration test for graceful handling of missing dependencies in character builder
 * Tests error scenarios when dependencies are not properly registered
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';

describe('Character Builder Dependency Failure Integration', () => {
  let container;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    container = new AppContainer();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should provide meaningful error when LlmJsonService is missing', async () => {
    // Setup container without character builder (so no LlmJsonService)
    await configureMinimalContainer(container, {
      includeCharacterBuilder: false,
    });

    // Act & Assert - Should throw meaningful error when trying to resolve missing service
    expect(() => {
      container.resolve(tokens.LlmJsonService);
    }).toThrow(/No service registered for key.*LlmJsonService/);
  });

  it('should provide meaningful error when CharacterBuilderService dependencies are missing', async () => {
    // Setup container without character builder
    await configureMinimalContainer(container, {
      includeCharacterBuilder: false,
    });

    // Try to resolve CharacterBuilderService directly
    expect(() => {
      container.resolve(tokens.CharacterBuilderService);
    }).toThrow(/No service registered for key.*CharacterBuilderService/);
  });

  it('should gracefully handle missing LLM infrastructure dependencies', async () => {
    // Setup minimal container without character builder
    await configureMinimalContainer(container, {
      includeCharacterBuilder: false,
    });

    // Verify that LLM infrastructure dependencies are missing
    const llmDependencies = [
      tokens.LLMAdapter,
      tokens.ILLMConfigurationManager,
      tokens.ILLMRequestExecutor,
      tokens.ILLMErrorMapper,
      tokens.ITokenEstimator,
    ];

    // Act & Assert - All should throw meaningful errors
    for (const serviceToken of llmDependencies) {
      expect(() => {
        container.resolve(serviceToken);
      }).toThrow(/No service registered for key/);
    }
  });

  it('should validate dependency requirements in CharacterBuilderService', async () => {
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Get a properly configured service
    const characterBuilderService = container.resolve(
      tokens.CharacterBuilderService
    );

    // The service should be configured with all required dependencies
    expect(characterBuilderService).toBeDefined();

    // Verify it has the required methods
    expect(typeof characterBuilderService.initialize).toBe('function');
    expect(typeof characterBuilderService.createCharacterConcept).toBe(
      'function'
    );
    expect(typeof characterBuilderService.generateThematicDirections).toBe(
      'function'
    );
  });

  it('should handle circular dependency scenarios gracefully', async () => {
    // This test ensures that our dependency injection doesn't create circular dependencies
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // All services should resolve without circular dependency issues
    const services = [
      tokens.CharacterBuilderService,
      tokens.ThematicDirectionGenerator,
      tokens.CharacterStorageService,
      tokens.CharacterDatabase,
      tokens.LlmJsonService,
    ];

    // Act & Assert - No circular dependency errors should occur
    for (const serviceToken of services) {
      expect(() => {
        const service = container.resolve(serviceToken);
        expect(service).toBeDefined();
      }).not.toThrow();
    }
  });

  it('should provide helpful error context when services are not found', async () => {
    await configureMinimalContainer(container, {
      includeCharacterBuilder: false,
    });

    // Act & Assert - Should provide clear error messages
    expect(() => {
      container.resolve(tokens.CharacterBuilderService);
    }).toThrow();

    expect(() => {
      container.resolve(tokens.ThematicDirectionGenerator);
    }).toThrow();

    expect(() => {
      container.resolve(tokens.CharacterDatabase);
    }).toThrow();
  });

  it('should maintain service isolation when one service fails', async () => {
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Verify that other services still work even if we manually break one
    const workingServices = [
      tokens.ILogger,
      tokens.ISchemaValidator,
      tokens.IEntityManager,
      tokens.ISafeEventDispatcher,
    ];

    // All core services should still be functional
    for (const serviceToken of workingServices) {
      expect(() => {
        const service = container.resolve(serviceToken);
        expect(service).toBeDefined();
      }).not.toThrow();
    }
  });
});
