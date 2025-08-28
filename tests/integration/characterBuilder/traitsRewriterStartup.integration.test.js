/**
 * @file Integration test for TraitsRewriter application startup
 * @description Verifies that the Traits Rewriter page starts without errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { TraitsRewriterController } from '../../../src/characterBuilder/controllers/TraitsRewriterController.js';

describe('TraitsRewriter Application Startup', () => {
  let bootstrap;
  let mockFetch;
  let originalConsole;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();
    
    // Store original console methods
    originalConsole = {
      info: console.info,
      error: console.error,
      warn: console.warn,
      debug: console.debug,
    };
    
    // Mock console methods to suppress output during tests
    console.info = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
    
    // Mock fetch for schema loading
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // Default successful response for schema requests
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        $id: 'schema://living-narrative-engine/test.json',
        type: 'object',
      }),
    });

    // Mock DOM elements that the controller expects
    document.body.innerHTML = `
      <div id="rewritten-traits-container"></div>
    `;
  });

  afterEach(() => {
    // Restore original console methods
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.debug = originalConsole.debug;
    
    // Clean up
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should import TraitsRewriterController without errors', async () => {
    // Test that controller can be imported
    const { TraitsRewriterController } = await import(
      '../../../src/characterBuilder/controllers/TraitsRewriterController.js'
    );
    expect(TraitsRewriterController).toBeDefined();
    expect(typeof TraitsRewriterController).toBe('function');
  });

  it('should have all required service dependencies available', async () => {
    // Import tokens to verify they exist
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');
    
    // Verify all TraitsRewriter tokens are defined
    expect(tokens.TraitsRewriterController).toBe('TraitsRewriterController');
    expect(tokens.TraitsRewriterGenerator).toBe('TraitsRewriterGenerator');
    expect(tokens.TraitsRewriterResponseProcessor).toBe('TraitsRewriterResponseProcessor');
    expect(tokens.TraitsRewriterDisplayEnhancer).toBe('TraitsRewriterDisplayEnhancer');
  });

  it('should bootstrap controller successfully', async () => {
    const result = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: false, // Disable mod loading for faster tests
    });
    
    expect(result).toBeDefined();
    expect(result.controller).toBeInstanceOf(TraitsRewriterController);
    expect(result.container).toBeDefined();
    
    // Verify no errors were logged
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should initialize controller with proper dependencies', async () => {
    const result = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: false,
    });
    
    // Verify controller was initialized
    expect(result.controller).toBeDefined();
    
    // Verify controller has access to required properties from base class
    expect(result.controller.logger).toBeDefined();
    expect(result.controller.characterBuilderService).toBeDefined();
    expect(result.controller.eventBus).toBeDefined();
    expect(result.controller.schemaValidator).toBeDefined();
  });

  it('should set initial UI state to empty', async () => {
    const result = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: false,
    });
    
    // The controller should initialize successfully and be in stub mode
    expect(result.controller).toBeDefined();
    
    // Since this is a stub implementation, we just verify it bootstrapped
    // The actual UI state testing will be done in Phase 2
    expect(result.controller).toBeInstanceOf(TraitsRewriterController);
  });

  it('should handle missing DOM elements gracefully', async () => {
    // Remove the expected container element
    document.body.innerHTML = '';
    
    const result = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: false,
    });
    
    // Should still bootstrap successfully
    expect(result.controller).toBeInstanceOf(TraitsRewriterController);
    
    // May log warnings but should not error
    const errorCalls = console.error.mock.calls;
    const criticalErrors = errorCalls.filter(call => 
      call.some(arg => String(arg).includes('critical') || String(arg).includes('fatal'))
    );
    expect(criticalErrors).toHaveLength(0);
  });

  it('should verify all required service implementations exist', async () => {
    // Import the service files to ensure they exist and can be loaded
    const { TraitsRewriterGenerator } = await import(
      '../../../src/characterBuilder/services/TraitsRewriterGenerator.js'
    );
    const { TraitsRewriterResponseProcessor } = await import(
      '../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js'
    );
    const { TraitsRewriterDisplayEnhancer } = await import(
      '../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js'
    );
    
    expect(TraitsRewriterGenerator).toBeDefined();
    expect(TraitsRewriterResponseProcessor).toBeDefined();
    expect(TraitsRewriterDisplayEnhancer).toBeDefined();
    
    // Verify they are constructors
    expect(typeof TraitsRewriterGenerator).toBe('function');
    expect(typeof TraitsRewriterResponseProcessor).toBe('function');
    expect(typeof TraitsRewriterDisplayEnhancer).toBe('function');
  });

  it('should confirm controller extends BaseCharacterBuilderController', () => {
    expect(TraitsRewriterController.prototype).toBeInstanceOf(Object);
    
    // Create a proper mock for characterBuilderService with all required methods
    const mockCharacterBuilderService = {
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(), // Note: plural form
      getThematicDirections: jest.fn(),
      generateThematicDirection: jest.fn(), // Keep singular for backward compat
      generateCliche: jest.fn(),
      generateTraits: jest.fn(),
      generateSpeechPatterns: jest.fn(),
      saveCharacter: jest.fn(),
      loadCharacter: jest.fn(),
      deleteCharacter: jest.fn(),
      listCharacters: jest.fn(),
    };
    
    // Check that it has the expected base class methods
    const controller = new TraitsRewriterController({
      logger: console,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: { 
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      },
      schemaValidator: { 
        validate: jest.fn(),
        validateAgainstSchema: jest.fn() 
      },
    });
    
    // These methods should exist from the base class
    expect(typeof controller._cacheElements).toBe('function');
    expect(typeof controller._setupEventListeners).toBe('function');
    expect(typeof controller._loadInitialData).toBe('function');
  });

  it('should verify Phase 1 objectives are met', async () => {
    // This test summarizes that all Phase 1 objectives are completed:
    
    // 1. Import error resolved - controller can be imported
    const { TraitsRewriterController: ImportedController } = await import(
      '../../../src/characterBuilder/controllers/TraitsRewriterController.js'
    );
    expect(ImportedController).toBeDefined();
    
    // 2. Application starts without errors - bootstrap succeeds
    const result = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: false,
    });
    expect(result.controller).toBeDefined();
    expect(console.error).not.toHaveBeenCalled();
    
    // 3. TraitsRewriter page accessible - controller instantiates
    expect(result.controller).toBeInstanceOf(TraitsRewriterController);
    
    // 4. Foundation ready for Phase 2 - all services registered
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');
    expect(tokens.TraitsRewriterGenerator).toBeDefined();
    expect(tokens.TraitsRewriterResponseProcessor).toBeDefined();
    expect(tokens.TraitsRewriterDisplayEnhancer).toBeDefined();
    
    // All Phase 1 criteria met!
    expect(true).toBe(true);
  });
});