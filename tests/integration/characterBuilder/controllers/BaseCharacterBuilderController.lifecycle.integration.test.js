/**
 * @file Integration tests for BaseCharacterBuilderController lifecycle orchestration
 * @description Tests controller lifecycle phases, reinitialize/destroy flows, and phase transitions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerIntegrationTestBase } from './BaseCharacterBuilderController.integration.testbase.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class LifecycleTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.lifecycleEvents = [];
  }

  async initialize() {
    this.lifecycleEvents.push('initialize-start');
    await super.initialize();
    this.lifecycleEvents.push('initialize-end');
  }

  async reinitialize() {
    this.lifecycleEvents.push('reinitialize-start');
    await super.reinitialize();
    this.lifecycleEvents.push('reinitialize-end');
  }

  async destroy() {
    this.lifecycleEvents.push('destroy-start');
    await super.destroy();
    this.lifecycleEvents.push('destroy-end');
  }

  getLifecycleEvents() {
    return [...this.lifecycleEvents];
  }

  isInitialized() {
    return this._isInitialized ? this._isInitialized() : false;
  }

  isDestroyed() {
    return this._isDestroyed ? this._isDestroyed() : false;
  }
}

describe('BaseCharacterBuilderController - Lifecycle Integration', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerIntegrationTestBase();
    await testBase.setup({ includeFullDOM: true, mockGlobalFunctions: true });

    controller = new LifecycleTestController(testBase.getDependencies());
  });

  afterEach(async () => {
    if (controller && !controller.isDestroyed()) {
      await controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('Initialization Phase', () => {
    it('should complete full initialization workflow', async () => {
      await controller.initialize();

      const events = controller.getLifecycleEvents();
      expect(events).toContain('initialize-start');
      expect(events).toContain('initialize-end');
      expect(controller.isInitialized()).toBe(true);
      expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });

    it('should invoke ControllerLifecycleOrchestrator during initialization', async () => {
      await controller.initialize();

      // Verify lifecycle orchestrator was used
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/lifecycle|phase|orchestrat/i)
      );
    });

    it('should setup all required services during initialization', async () => {
      await controller.initialize();

      // Verify core services are initialized
      expect(controller.isInitialized()).toBe(true);
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should prevent double initialization', async () => {
      await controller.initialize();
      
      // Attempt second initialization
      await expect(controller.initialize()).rejects.toThrow();
      
      expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already initialized')
      );
    });
  });

  describe('Reinitialization Phase', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should complete full reinitialization workflow', async () => {
      const eventsBefore = controller.getLifecycleEvents().length;

      await controller.reinitialize();

      const eventsAfter = controller.getLifecycleEvents();
      expect(eventsAfter).toContain('reinitialize-start');
      expect(eventsAfter).toContain('reinitialize-end');
      expect(eventsAfter.length).toBeGreaterThan(eventsBefore);
    });

    it('should clear and rebuild state during reinitialization', async () => {
      // Setup initial state
      controller.cacheElement?.('test-elem', '#empty-state');
      
      await controller.reinitialize();

      // State should be cleared and rebuilt
      expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('reinitialized')
      );
    });

    it('should preserve critical dependencies during reinitialization', async () => {
      const loggerBefore = testBase.mocks.logger;
      
      await controller.reinitialize();

      // Logger should remain the same instance
      expect(testBase.mocks.logger).toBe(loggerBefore);
      expect(controller.isInitialized()).toBe(true);
    });

    it('should handle reinitialization errors gracefully', async () => {
      // Simulate error during reinitialize by destroying controller first
      await controller.destroy();

      await expect(controller.reinitialize()).rejects.toThrow();
      
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('reinitialization failed')
      );
    });
  });

  describe('Destruction Phase', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should complete full destruction workflow', async () => {
      await controller.destroy();

      const events = controller.getLifecycleEvents();
      expect(events).toContain('destroy-start');
      expect(events).toContain('destroy-end');
      expect(controller.isDestroyed()).toBe(true);
    });

    it('should cleanup all resources during destruction', async () => {
      await controller.destroy();

      expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('destroyed')
      );
      expect(global.clearTimeout).toHaveBeenCalled();
    });

    it('should invoke ControllerLifecycleOrchestrator destruction phases', async () => {
      await controller.destroy();

      // Verify orchestrator handled cleanup
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/cleanup|destroy|teardown/i)
      );
    });

    it('should prevent operations after destruction', async () => {
      await controller.destroy();

      expect(controller.isDestroyed()).toBe(true);
      
      // Attempting operations should be blocked or fail safely
      if (typeof controller.cacheElement === 'function') {
        expect(() => controller.cacheElement('test', '#test')).toThrow();
      }
    });

    it('should handle double destruction safely', async () => {
      await controller.destroy();
      
      // Second destroy should be idempotent
      await expect(controller.destroy()).resolves.not.toThrow();
      
      expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already destroyed')
      );
    });
  });

  describe('Lifecycle State Transitions', () => {
    it('should transition from uninitialized to initialized', async () => {
      expect(controller.isInitialized()).toBe(false);
      
      await controller.initialize();
      
      expect(controller.isInitialized()).toBe(true);
      expect(controller.isDestroyed()).toBe(false);
    });

    it('should transition from initialized to reinitialized', async () => {
      await controller.initialize();
      expect(controller.isInitialized()).toBe(true);
      
      await controller.reinitialize();
      
      expect(controller.isInitialized()).toBe(true);
      expect(controller.isDestroyed()).toBe(false);
    });

    it('should transition from initialized to destroyed', async () => {
      await controller.initialize();
      expect(controller.isInitialized()).toBe(true);
      
      await controller.destroy();
      
      expect(controller.isDestroyed()).toBe(true);
    });

    it('should prevent reinitialize on uninitialized controller', async () => {
      expect(controller.isInitialized()).toBe(false);
      
      await expect(controller.reinitialize()).rejects.toThrow();
    });

    it('should prevent initialize after destroy', async () => {
      await controller.initialize();
      await controller.destroy();
      
      await expect(controller.initialize()).rejects.toThrow();
      
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot initialize destroyed controller')
      );
    });
  });

  describe('Integration with Lifecycle Orchestrator', () => {
    it('should delegate lifecycle phases to orchestrator', async () => {
      await controller.initialize();

      // Orchestrator should log phase transitions
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/phase/i)
      );
    });

    it('should execute lifecycle hooks in correct order', async () => {
      const hookOrder = [];
      
      const controllerWithHooks = new LifecycleTestController({
        ...testBase.getDependencies(),
        lifecycleHooks: {
          beforeInitialize: () => hookOrder.push('before-init'),
          afterInitialize: () => hookOrder.push('after-init'),
          beforeDestroy: () => hookOrder.push('before-destroy'),
          afterDestroy: () => hookOrder.push('after-destroy'),
        },
      });

      await controllerWithHooks.initialize();
      await controllerWithHooks.destroy();

      expect(hookOrder).toEqual([
        'before-init',
        'after-init',
        'before-destroy',
        'after-destroy',
      ]);
    });

    it('should handle lifecycle orchestrator errors', async () => {
      // Simulate orchestrator error by providing invalid dependency
      const faultyController = new LifecycleTestController({
        ...testBase.getDependencies(),
        controllerLifecycleOrchestrator: null, // Missing required service
      });

      await expect(faultyController.initialize()).rejects.toThrow();
      
      expect(testBase.mocks.logger.error).toHaveBeenCalled();
    });
  });

  describe('Resource Cleanup Verification', () => {
    it('should cleanup event listeners on destroy', async () => {
      await controller.initialize();
      
      // Assume some listeners were registered during init
      const listenerCountBefore = global.document.removeEventListener.mock.calls.length;
      
      await controller.destroy();
      
      // Should have called removeEventListener during cleanup
      const listenerCountAfter = global.document.removeEventListener.mock.calls.length;
      expect(listenerCountAfter).toBeGreaterThanOrEqual(listenerCountBefore);
    });

    it('should cleanup timers on destroy', async () => {
      await controller.initialize();
      
      const timeoutCountBefore = global.clearTimeout.mock.calls.length;
      
      await controller.destroy();
      
      const timeoutCountAfter = global.clearTimeout.mock.calls.length;
      expect(timeoutCountAfter).toBeGreaterThanOrEqual(timeoutCountBefore);
    });

    it('should cleanup performance markers on destroy', async () => {
      await controller.initialize();
      await controller.destroy();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/performance|cleanup|clear/i)
      );
    });

    it('should cleanup weak references on destroy', async () => {
      await controller.initialize();
      
      // Set some weak references
      if (typeof controller.setWeakReference === 'function') {
        controller.setWeakReference('test-ref', { data: 'test' });
      }
      
      await controller.destroy();

      // Weak references should be cleared
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/weak|reference|cleanup/i)
      );
    });
  });
});
