/**
 * @file Integration tests for CharacterBuilderBootstrap
 * @description Tests the complete bootstrap flow with real dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';

describe('CharacterBuilderBootstrap Integration', () => {
  let bootstrap;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();

    // Mock fetch for schema loading
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ $schema: 'test-schema' }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should complete bootstrap process', async () => {
    // Mock controller
    class TestController {
      constructor(deps) {
        this.logger = deps.logger;
        this.characterBuilderService = deps.characterBuilderService;
        this.eventBus = deps.eventBus;
      }

      async initialize() {
        // Mock initialization
      }
    }

    const config = {
      pageName: 'Test Page',
      controllerClass: TestController,
      includeModLoading: false,
    };

    const result = await bootstrap.bootstrap(config);

    expect(result).toHaveProperty('controller');
    expect(result).toHaveProperty('container');
    expect(result).toHaveProperty('bootstrapTime');
    expect(result.controller).toBeInstanceOf(TestController);
    expect(result.bootstrapTime).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    class FailingController {
      constructor() {}
      async initialize() {
        throw new Error('Initialization failed');
      }
    }

    const config = {
      pageName: 'Failing Page',
      controllerClass: FailingController,
    };

    await expect(bootstrap.bootstrap(config)).rejects.toThrow(
      'Initialization failed'
    );
  });
});
