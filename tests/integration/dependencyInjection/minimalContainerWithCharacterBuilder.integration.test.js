/**
 * @file Integration test for minimal container configuration with character builder enabled
 * Tests that the minimal container properly registers all necessary services for character builder
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

describe('Minimal Container with Character Builder Integration', () => {
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

  it('should register all core services when character builder is enabled', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Core services should be registered
    expect(() => container.resolve(tokens.ILogger)).not.toThrow();
    expect(() => container.resolve(tokens.ISchemaValidator)).not.toThrow();
    expect(() => container.resolve(tokens.IDataRegistry)).not.toThrow();
    expect(() => container.resolve(tokens.IEntityManager)).not.toThrow();
    expect(() => container.resolve(tokens.ISafeEventDispatcher)).not.toThrow();
    expect(() => container.resolve(tokens.SystemInitializer)).not.toThrow();
  });

  it('should register minimal AI services when character builder is enabled', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Minimal AI services should be registered
    expect(() => container.resolve(tokens.LlmJsonService)).not.toThrow();
    expect(() => container.resolve(tokens.LLMAdapter)).not.toThrow();
    expect(() =>
      container.resolve(tokens.ILLMConfigurationManager)
    ).not.toThrow();
    expect(() => container.resolve(tokens.ILLMRequestExecutor)).not.toThrow();
    expect(() => container.resolve(tokens.ILLMErrorMapper)).not.toThrow();
    expect(() => container.resolve(tokens.ITokenEstimator)).not.toThrow();
  });

  it('should register character builder services when enabled', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Character builder services should be registered
    expect(() => container.resolve(tokens.CharacterDatabase)).not.toThrow();
    expect(() =>
      container.resolve(tokens.CharacterStorageService)
    ).not.toThrow();
    expect(() =>
      container.resolve(tokens.ThematicDirectionGenerator)
    ).not.toThrow();
    expect(() =>
      container.resolve(tokens.CharacterBuilderService)
    ).not.toThrow();
  });

  it('should not register character builder services when disabled', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: false,
    });

    // Assert - Character builder services should not be registered
    expect(() => container.resolve(tokens.CharacterDatabase)).toThrow();
    expect(() => container.resolve(tokens.CharacterStorageService)).toThrow();
    expect(() =>
      container.resolve(tokens.ThematicDirectionGenerator)
    ).toThrow();
    expect(() => container.resolve(tokens.CharacterBuilderService)).toThrow();

    // But minimal AI services should also not be registered
    expect(() => container.resolve(tokens.LlmJsonService)).toThrow();
  });

  it('should successfully create functional character builder service instances', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Services should be functional (not just registered)
    const characterBuilderService = container.resolve(
      tokens.CharacterBuilderService
    );
    expect(characterBuilderService).toBeDefined();
    expect(typeof characterBuilderService.generateThematicDirections).toBe(
      'function'
    );
    expect(typeof characterBuilderService.createCharacterConcept).toBe(
      'function'
    );
    expect(typeof characterBuilderService.getAllCharacterConcepts).toBe(
      'function'
    );

    const thematicDirectionGenerator = container.resolve(
      tokens.ThematicDirectionGenerator
    );
    expect(thematicDirectionGenerator).toBeDefined();
    expect(typeof thematicDirectionGenerator.generateDirections).toBe(
      'function'
    );

    const llmJsonService = container.resolve(tokens.LlmJsonService);
    expect(llmJsonService).toBeDefined();
    expect(typeof llmJsonService.parseAndRepair).toBe('function');
  });

  it('should handle dependency resolution without critical errors', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Try to resolve all critical dependencies
    const services = [
      tokens.ILogger,
      tokens.SystemInitializer,
      tokens.CharacterBuilderService,
      tokens.LlmJsonService,
      tokens.LLMAdapter,
      tokens.ISafeEventDispatcher,
    ];

    // Assert - No critical errors should occur during resolution
    for (const serviceToken of services) {
      expect(() => {
        const service = container.resolve(serviceToken);
        expect(service).toBeDefined();
      }).not.toThrow();
    }

    // Check that no critical errors were logged
    const errorCalls = consoleErrorSpy.mock.calls;
    const criticalErrors = errorCalls.filter((call) => {
      const errorMsg = call.join(' ');
      return (
        errorMsg.includes('Fatal error') ||
        errorMsg.includes('No service registered') ||
        errorMsg.includes('Failed to create instance')
      );
    });

    expect(criticalErrors).toHaveLength(0);
  });

  it('should register services in correct dependency order', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Dependencies should resolve in correct order without circular dependencies
    // ThematicDirectionGenerator depends on LlmJsonService and LLMAdapter
    const thematicDirectionGenerator = container.resolve(
      tokens.ThematicDirectionGenerator
    );
    expect(thematicDirectionGenerator).toBeDefined();

    // CharacterBuilderService depends on ThematicDirectionGenerator
    const characterBuilderService = container.resolve(
      tokens.CharacterBuilderService
    );
    expect(characterBuilderService).toBeDefined();

    // Verify the dependency chain is properly constructed
    expect(typeof thematicDirectionGenerator.generateDirections).toBe(
      'function'
    );
    expect(typeof characterBuilderService.generateThematicDirections).toBe(
      'function'
    );
  });

  it('should preserve anatomy services when character builder is enabled', async () => {
    // Act
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Assert - Anatomy services should still be available as specified in minimal config
    expect(() => container.resolve(tokens.AnatomyQueryCache)).not.toThrow();
    expect(() =>
      container.resolve(tokens.ClothingManagementService)
    ).not.toThrow();
    expect(() =>
      container.resolve(tokens.AnatomyInitializationService)
    ).not.toThrow();
  });
});
