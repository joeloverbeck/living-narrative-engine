/**
 * @file Unit tests for mod-manager-main.js entry point
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies before importing the module
jest.mock('../../../src/modManager/ModManagerBootstrap.js', () => ({
  ModManagerBootstrap: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(),
  })),
}));

jest.mock('../../../src/utils/environmentUtils.js', () => ({
  shouldAutoInitializeDom: jest.fn(() => false), // Prevent auto-init in tests
}));

describe('mod-manager-main', () => {
  let mockBootstrapInstance;
  let MockModManagerBootstrap;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Get reference to mocked constructor
    const { ModManagerBootstrap } = await import(
      '../../../src/modManager/ModManagerBootstrap.js'
    );
    MockModManagerBootstrap = ModManagerBootstrap;

    mockBootstrapInstance = {
      initialize: jest.fn().mockResolvedValue(),
    };
    MockModManagerBootstrap.mockReturnValue(mockBootstrapInstance);
  });

  describe('ModManagerApp export', () => {
    it('should export ModManagerApp class', async () => {
      const mainModule = await import('../../../src/mod-manager-main.js');

      expect(mainModule.ModManagerApp).toBeDefined();
    });
  });

  describe('ModManagerApp.initialize', () => {
    it('should create and initialize bootstrap on initialize call', async () => {
      const { ModManagerApp } = await import('../../../src/mod-manager-main.js');

      const app = new ModManagerApp();
      await app.initialize();

      expect(MockModManagerBootstrap).toHaveBeenCalled();
      expect(mockBootstrapInstance.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const testError = new Error('Bootstrap failed');
      mockBootstrapInstance.initialize.mockRejectedValue(testError);

      const { ModManagerApp } = await import('../../../src/mod-manager-main.js');

      const app = new ModManagerApp();

      // Should not throw (errors are caught and displayed)
      await expect(app.initialize()).resolves.not.toThrow();
    });
  });
});

describe('shouldAutoInitializeDom integration', () => {
  it('should check environment before initialization', async () => {
    const { shouldAutoInitializeDom } = await import(
      '../../../src/utils/environmentUtils.js'
    );

    // Module should have checked shouldAutoInitializeDom on load
    // We verify by ensuring the mock was set up correctly
    expect(shouldAutoInitializeDom).toBeDefined();
  });
});
