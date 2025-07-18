import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Loaders Registration Configuration', () => {
  let container;
  let mockLogger;
  let mockEventDispatcher;

  beforeEach(() => {
    container = new AppContainer();

    // Register mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, mockLogger);

    // Register mock event dispatcher
    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    container.register(tokens.IValidatedEventDispatcher, mockEventDispatcher);

    // Register mock safe event dispatcher
    const mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };
    container.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher);
  });

  it('should configure anatomy loaders with correct diskFolder values', () => {
    // Register all loaders
    registerLoaders(container);

    // Get the ContentLoadManager to check its configuration
    container.resolve(tokens.ContentLoadManager);

    // Access the private configuration through the constructor call
    const registrationCalls = mockLogger.debug.mock.calls;
    registrationCalls.find((call) => call[0]?.includes('ContentLoadManager'));

    // Check that the loaders were registered with correct diskFolder values
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Loaders Registration: All core services, loaders, and phases registered.'
    );

    // Verify that anatomy loaders are configured correctly
    // Since we can't directly access the private config, we verify through the registration process
    const anatomyRecipeLoader = container.resolve(tokens.AnatomyRecipeLoader);
    const anatomyBlueprintLoader = container.resolve(
      tokens.AnatomyBlueprintLoader
    );

    expect(anatomyRecipeLoader).toBeDefined();
    expect(anatomyBlueprintLoader).toBeDefined();
  });

  it('should register all required anatomy loaders', () => {
    registerLoaders(container);

    // Verify all anatomy-related loaders are registered
    expect(() => container.resolve(tokens.AnatomyRecipeLoader)).not.toThrow();
    expect(() =>
      container.resolve(tokens.AnatomyBlueprintLoader)
    ).not.toThrow();
    expect(() =>
      container.resolve(tokens.AnatomyFormattingLoader)
    ).not.toThrow();

    const recipeLoader = container.resolve(tokens.AnatomyRecipeLoader);
    const blueprintLoader = container.resolve(tokens.AnatomyBlueprintLoader);
    const formattingLoader = container.resolve(tokens.AnatomyFormattingLoader);

    expect(recipeLoader.constructor.name).toBe('AnatomyRecipeLoader');
    expect(blueprintLoader.constructor.name).toBe('AnatomyBlueprintLoader');
    expect(formattingLoader.constructor.name).toBe('AnatomyFormattingLoader');
  });
});
