/**
 * @file Unit tests for index LLM controller
 * @description Tests for IndexLLMController dependency resolution and functionality
 * Verifies that LLMAdapter is correctly registered when character builder services are included
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../common/testBed.js';
import { CharacterBuilderBootstrap } from '../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

// Mock the IndexLLMController to avoid circular dependencies during testing
class MockIndexLLMController {
  #container;
  #llmAdapter;

  constructor({ container }) {
    this.#container = container;
    // This should reproduce the exact error from error_logs.txt
    this.#llmAdapter = container.resolve(tokens.LLMAdapter);
  }

  async initialize() {
    return this.init();
  }

  async init() {
    return this.updateCurrentLLMDisplay();
  }

  async updateCurrentLLMDisplay() {
    if (!this.#llmAdapter) return false;
    return true;
  }
}

describe('IndexLLMController - Dependency Resolution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should successfully resolve LLMAdapter when character builder is included', async () => {
    // When includeCharacterBuilder is true (default for CharacterBuilderBootstrap),
    // the LLMAdapter should be registered and available
    const bootstrap = new CharacterBuilderBootstrap();

    // This should NOT throw an error - LLMAdapter is registered
    const result = await bootstrap.bootstrap({
      pageName: 'Test Index LLM Selector',
      controllerClass: MockIndexLLMController,
      includeModLoading: false,
    });

    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
    expect(result.container).toBeDefined();
  });

  it('should have LLMAdapter available in container when character builder is enabled', async () => {
    const bootstrap = new CharacterBuilderBootstrap();

    // Bootstrap with character builder enabled (default)
    const { container } = await bootstrap.bootstrap({
      pageName: 'Test Index LLM Selector',
      controllerClass: MockIndexLLMController,
      includeModLoading: false,
    });

    // LLMAdapter should be resolvable
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    expect(llmAdapter).toBeDefined();
    
    // Other expected services should also be available
    expect(container.resolve(tokens.ILogger)).toBeDefined();
    expect(container.resolve(tokens.LlmConfigLoader)).toBeDefined();
    expect(container.resolve(tokens.ILLMConfigurationManager)).toBeDefined();
  });

  it('should successfully initialize IndexLLMController with LLMAdapter', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    // Create a test controller that mimics IndexLLMController
    class TestIndexLLMController {
      #container;
      #llmAdapter;
      
      constructor({ container }) {
        this.#container = container;
        // This is what the real IndexLLMController does
        this.#llmAdapter = container.resolve(tokens.LLMAdapter);
      }
      
      async initialize() {
        // Verify we got the adapter
        return this.#llmAdapter !== null && this.#llmAdapter !== undefined;
      }
      
      async init() {
        return true;
      }
    }

    // This should work without errors
    const { controller, container } = await bootstrap.bootstrap({
      pageName: 'Test Index LLM',
      controllerClass: TestIndexLLMController,
      includeModLoading: false,
    });

    expect(controller).toBeDefined();
    expect(container).toBeDefined();
    
    // Verify the LLMAdapter is actually available
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    expect(llmAdapter).toBeDefined();
  });
});