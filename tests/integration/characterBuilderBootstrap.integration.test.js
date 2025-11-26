/**
 * @file Integration tests for CharacterBuilderBootstrap
 * @description Tests for full initialization flow and service registration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../common/testBed.js';
import { CharacterBuilderBootstrap } from '../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

// Mock controller similar to IndexLLMController
class TestIndexLLMController {
  #container;
  #llmAdapter;

  constructor({ container }) {
    this.#container = container;
    // This line reproduces the production error
    this.#llmAdapter = container.resolve('ILLMAdapter');
  }

  async init() {
    await this.updateCurrentLLMDisplay();
  }

  async updateCurrentLLMDisplay() {
    if (!this.#llmAdapter) return;

    try {
      const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
      return currentLlmId || 'Default LLM';
    } catch (error) {
      return 'Error loading';
    }
  }
}

describe('CharacterBuilderBootstrap - Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('Service Registration Issues', () => {
    it('should fail to bootstrap index controller due to missing ILLMAdapter', async () => {
      const bootstrap = new CharacterBuilderBootstrap();

      // This should reproduce the exact production error
      await expect(
        bootstrap.bootstrap({
          pageName: 'Index LLM Selector',
          controllerClass: TestIndexLLMController,
          includeModLoading: false,
        })
      ).rejects.toThrow(
        'AppContainer: No service registered for key "ILLMAdapter"'
      );
    });

    it('should register minimal AI services but miss LLMAdapter', async () => {
      const bootstrap = new CharacterBuilderBootstrap();

      class ServiceInspectorController {
        constructor({ container }) {
          this.container = container;
        }

        async initialize() {
          return this.inspectServices();
        }

        async init() {
          return this.inspectServices();
        }

        inspectServices() {
          const services = {
            hasLlmConfigLoader: this.hasService('LlmConfigLoader'),
            hasILLMConfigurationManager: this.hasService(
              'ILLMConfigurationManager'
            ),
            hasILLMRequestExecutor: this.hasService('ILLMRequestExecutor'),
            hasILLMErrorMapper: this.hasService('ILLMErrorMapper'),
            hasITokenEstimator: this.hasService('ITokenEstimator'),
            hasLlmJsonService: this.hasService('LlmJsonService'),
            hasLLMAdapter: this.hasService('LLMAdapter'),
            hasILLMAdapter: this.hasService('ILLMAdapter'),
          };

          return services;
        }

        hasService(key) {
          try {
            this.container.resolve(key);
            return true;
          } catch {
            return false;
          }
        }
      }

      const { controller } = await bootstrap.bootstrap({
        pageName: 'Service Inspector',
        controllerClass: ServiceInspectorController,
        includeModLoading: false,
      });

      const services = await controller.init();

      // These should be registered by registerMinimalAIForCharacterBuilder
      expect(services.hasLlmConfigLoader).toBe(true);
      expect(services.hasILLMConfigurationManager).toBe(true);
      expect(services.hasILLMRequestExecutor).toBe(true);
      expect(services.hasILLMErrorMapper).toBe(true);
      expect(services.hasITokenEstimator).toBe(true);
      expect(services.hasLlmJsonService).toBe(true);

      // These should show the actual registration status
      expect(services.hasLLMAdapter).toBe(true); // LLMAdapter IS registered
      expect(services.hasILLMAdapter).toBe(false); // ILLMAdapter is the wrong token name
    });
  });

  describe('Token Resolution Issues', () => {
    it('should show difference between tokens.LLMAdapter and hardcoded string', async () => {
      const bootstrap = new CharacterBuilderBootstrap();

      class TokenTestController {
        constructor({ container }) {
          this.container = container;
        }

        async initialize() {
          return this.testTokenResolution();
        }

        async init() {
          return this.testTokenResolution();
        }

        testTokenResolution() {
          const results = {
            tokensLLMAdapterValue: tokens.LLMAdapter,
            hardcodedString: 'ILLMAdapter',
            tokenExists: tokens.LLMAdapter !== undefined,
            tokenMatches: tokens.LLMAdapter === 'LLMAdapter',
          };

          return results;
        }
      }

      const { controller } = await bootstrap.bootstrap({
        pageName: 'Token Test',
        controllerClass: TokenTestController,
        includeModLoading: false,
      });

      const results = await controller.init();

      // This demonstrates the token mismatch issue
      expect(results.tokensLLMAdapterValue).toBe('LLMAdapter');
      expect(results.hardcodedString).toBe('ILLMAdapter');
      expect(results.tokenExists).toBe(true);
      expect(results.tokenMatches).toBe(true);

      // Show that the hardcoded string doesn't match the actual token
      expect(results.hardcodedString).not.toBe(results.tokensLLMAdapterValue);
    });
  });

  describe('Fixed Working State (after fixes)', () => {
    it('should now work with proper token resolution', async () => {
      const bootstrap = new CharacterBuilderBootstrap();

      class FixedIndexLLMController {
        #container;
        #llmAdapter;

        constructor({ container }) {
          this.#container = container;
          // Fixed: now uses tokens.LLMAdapter instead of 'ILLMAdapter'
          this.#llmAdapter = container.resolve(tokens.LLMAdapter);
        }

        async initialize() {
          return this.updateCurrentLLMDisplay();
        }

        async init() {
          return this.updateCurrentLLMDisplay();
        }

        async updateCurrentLLMDisplay() {
          if (!this.#llmAdapter) return 'No adapter';
          return 'Adapter available';
        }
      }

      // This should now pass with our fixes
      const { controller } = await bootstrap.bootstrap({
        pageName: 'Fixed Index LLM Selector',
        controllerClass: FixedIndexLLMController,
        includeModLoading: false,
      });

      const result = await controller.initialize();
      expect(result).toBe('Adapter available');
    }, 30000); // Explicit timeout for bootstrap tests which initialize many services
  });
});
