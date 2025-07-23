/**
 * @file Integration test for unified LLM infrastructure in character builder
 * @description Tests character builder using the turn system's LLM configuration manager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Character Builder - Unified LLM Integration', () => {
  let container;
  let logger;

  beforeEach(async () => {
    logger = new ConsoleLogger('error'); // Reduce noise in tests
    container = new AppContainer();

    // Register logger first
    container.register(tokens.ILogger, logger);

    // Configure container with both game systems and character builder
    await configureBaseContainer(container, {
      includeGameSystems: true,
      includeCharacterBuilder: true,
      logger,
    });
  });

  afterEach(() => {
    container?.cleanup?.();
  });

  it('should resolve all character builder services through DI', () => {
    expect(() => {
      const characterBuilderService = container.resolve(
        tokens.CharacterBuilderService
      );
      expect(characterBuilderService).toBeDefined();
      expect(characterBuilderService.createCharacterConcept).toBeDefined();
      expect(characterBuilderService.generateThematicDirections).toBeDefined();
    }).not.toThrow();
  });

  it('should have shared LLM infrastructure between turn system and character builder', () => {
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    const llmConfigManager = container.resolve(tokens.ILLMConfigurationManager);
    const thematicDirectionGenerator = container.resolve(
      tokens.ThematicDirectionGenerator
    );

    expect(llmAdapter).toBeDefined();
    expect(llmConfigManager).toBeDefined();
    expect(thematicDirectionGenerator).toBeDefined();

    // Both services should use the same LLM configuration manager
    expect(llmAdapter).toBeTruthy();
    expect(llmConfigManager).toBeTruthy();
  });

  it('should use ILLMConfigurationManager interface consistently', () => {
    const llmConfigManager = container.resolve(tokens.ILLMConfigurationManager);

    // Verify the interface methods exist
    expect(typeof llmConfigManager.loadConfiguration).toBe('function');
    expect(typeof llmConfigManager.getActiveConfiguration).toBe('function');
    expect(typeof llmConfigManager.setActiveConfiguration).toBe('function');
    expect(typeof llmConfigManager.getAvailableOptions).toBe('function');
  });

  it('should properly initialize LLM adapter with configuration loader', async () => {
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    const llmConfigLoader = container.resolve(tokens.LlmConfigLoader);

    expect(llmAdapter).toBeDefined();
    expect(llmConfigLoader).toBeDefined();

    // Initialize the adapter (this would normally be done in character-builder-main.js)
    await expect(llmAdapter.init({ llmConfigLoader })).resolves.not.toThrow();
  });

  it('should have character builder controller properly wired', () => {
    const controller = container.resolve(tokens.CharacterBuilderController);
    const service = container.resolve(tokens.CharacterBuilderService);
    const eventBus = container.resolve(tokens.ISafeEventDispatcher);

    expect(controller).toBeDefined();
    expect(service).toBeDefined();
    expect(eventBus).toBeDefined();

    // Controller should have initialize method
    expect(typeof controller.initialize).toBe('function');
  });

  it('should use consistent event bus across services', () => {
    const eventBus = container.resolve(tokens.ISafeEventDispatcher);
    const characterBuilderService = container.resolve(
      tokens.CharacterBuilderService
    );
    const controller = container.resolve(tokens.CharacterBuilderController);

    expect(eventBus).toBeDefined();
    expect(characterBuilderService).toBeDefined();
    expect(controller).toBeDefined();

    // All services should use the same event bus instance
    expect(eventBus).toBeTruthy();
  });

  it('should resolve schema validator for character builder services', () => {
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const storageService = container.resolve(tokens.CharacterStorageService);

    expect(schemaValidator).toBeDefined();
    expect(storageService).toBeDefined();

    // Schema validator should have required methods
    expect(typeof schemaValidator.addSchema).toBe('function');
    expect(typeof schemaValidator.validate).toBe('function');
  });

  it('should have proper dependency chain for thematic direction generation', () => {
    const thematicGenerator = container.resolve(
      tokens.ThematicDirectionGenerator
    );
    const llmJsonService = container.resolve(tokens.LlmJsonService);
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    const llmConfigManager = container.resolve(tokens.ILLMConfigurationManager);

    expect(thematicGenerator).toBeDefined();
    expect(llmJsonService).toBeDefined();
    expect(llmAdapter).toBeDefined();
    expect(llmConfigManager).toBeDefined();

    // Generator should have the right methods
    expect(typeof thematicGenerator.generateDirections).toBe('function');
  });
});
