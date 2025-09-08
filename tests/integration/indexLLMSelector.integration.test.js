/**
 * @file Integration test for index.html LLM selector initialization
 * @description Tests the LLM selector functionality on the index page to ensure proper registration and initialization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../src/characterBuilder/CharacterBuilderBootstrap.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

// Mock DOM elements that the LLM selector expects
beforeEach(() => {
  document.body.innerHTML = `
    <div id="current-llm-name">Loading...</div>
    <div id="llm-selection-modal" style="display: none;"></div>
  `;
});

describe('Index LLM Selector Integration', () => {
  it('should initialize without throwing errors when LlmSelectionModal is not registered', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    // Create a simple controller that tries to resolve LlmSelectionModal
    class TestController {
      #container;
      
      constructor({ container }) {
        this.#container = container;
      }
      
      async initialize() {
        // This should not throw even if LlmSelectionModal is not registered
        try {
          // Try to resolve using the token (correct way)
          const modal = this.#container.resolve(tokens.LlmSelectionModal);
          return { success: true, modal };
        } catch (error) {
          // Handle the case where it's not registered
          console.warn('LlmSelectionModal not registered, continuing without it');
          return { success: true, modal: null };
        }
      }
    }
    
    // Bootstrap with minimal configuration (no UI)
    const result = await bootstrap.bootstrap({
      pageName: 'Test LLM Selector',
      controllerClass: TestController,
      includeModLoading: false,
    });
    
    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
    expect(result.container).toBeDefined();
    
    // Initialize the controller
    const initResult = await result.controller.initialize();
    expect(initResult.success).toBe(true);
    // Modal should be null since UI is not included
    expect(initResult.modal).toBeNull();
  });
  
  it('should successfully resolve LlmSelectionModal when manually registered', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    class TestController {
      #container;
      
      constructor({ container }) {
        this.#container = container;
      }
      
      async initialize() {
        // Manually register the modal like we do in the actual code
        if (!this.#container.isRegistered(tokens.LlmSelectionModal)) {
          // Import the necessary classes
          const { LlmSelectionModal } = await import('../../src/domUI/llmSelectionModal.js');
          const DocumentContext = (await import('../../src/domUI/documentContext.js')).default;
          
          // Register DocumentContext if needed
          if (!this.#container.isRegistered(tokens.DocumentContext)) {
            this.#container.register(
              tokens.DocumentContext,
              () => new DocumentContext(document),
              { lifecycle: 'singleton' }
            );
          }
          
          // Register LlmSelectionModal
          this.#container.register(
            tokens.LlmSelectionModal,
            () => new LlmSelectionModal({
              logger: this.#container.resolve(tokens.ILogger),
              documentContext: this.#container.resolve(tokens.DocumentContext),
              llmAdapter: this.#container.resolve(tokens.LLMAdapter),
              validatedEventDispatcher: this.#container.resolve(tokens.IValidatedEventDispatcher),
            }),
            { lifecycle: 'singleton' }
          );
        }
        
        const modal = this.#container.resolve(tokens.LlmSelectionModal);
        return { success: true, modal };
      }
    }
    
    // Bootstrap normally
    const result = await bootstrap.bootstrap({
      pageName: 'Test LLM Selector with Manual Registration',
      controllerClass: TestController,
      includeModLoading: false,
    });
    
    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
    
    // This should work after manual registration
    const initResult = await result.controller.initialize();
    expect(initResult.success).toBe(true);
    expect(initResult.modal).toBeDefined();
  });
  
  it('should handle string token resolution gracefully', async () => {
    const container = new AppContainer();
    
    // Test that resolving with a string (wrong way) throws an appropriate error
    expect(() => {
      container.resolve('LlmSelectionModal');
    }).toThrow(/No service registered for key "LlmSelectionModal"/);
    
    // But resolving with the token when not registered should also throw
    expect(() => {
      container.resolve(tokens.LlmSelectionModal);
    }).toThrow();
  });
});