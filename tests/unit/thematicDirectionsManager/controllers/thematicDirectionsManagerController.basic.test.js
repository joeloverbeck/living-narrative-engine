/**
 * @file Basic functionality tests for ThematicDirectionsManagerController
 * @description Tests core controller methods without complex initialization
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

describe('ThematicDirectionsManagerController - Basic Tests', () => {
  let testBase;
  let controller;
  let mockLocalStorage;

  beforeEach(async () => {
    try {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();

      // Setup basic mock responses
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([]);

      mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      global.localStorage = mockLocalStorage;

      controller = new ThematicDirectionsManagerController(testBase.mocks);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      if (controller && !controller.isDestroyed) {
        await controller.destroy();
      }
      
      await testBase.cleanup();
      jest.restoreAllMocks();
      
      controller = null;
      mockLocalStorage = null;
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('Constructor', () => {
    it('should create controller with dependencies', () => {
      expect(controller).toBeTruthy();
      expect(controller.logger).toBeDefined();
      expect(controller.characterBuilderService).toBeDefined();
      expect(controller.eventBus).toBeDefined();
    });
  });

  describe('Public API', () => {
    it('should have refreshDropdown method', () => {
      expect(typeof controller.refreshDropdown).toBe('function');
    });

    it('should have deleteDirection method', () => {
      expect(typeof controller.deleteDirection).toBe('function');
    });

    it('should handle deleteDirection calls', () => {
      const testDirection = {
        id: 'dir-1',
        title: 'Test Direction',
      };

      controller._showConfirmationModal = jest.fn();
      controller.deleteDirection(testDirection);

      expect(controller._showConfirmationModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Thematic Direction',
          message: expect.stringContaining('Test Direction'),
        })
      );
    });
  });

  describe('Lifecycle States', () => {
    it('should start uninitialized', () => {
      expect(controller.isInitialized).toBe(false);
      expect(controller.isDestroyed).toBe(false);
    });

    it('should track destroy state', async () => {
      await controller.destroy();
      expect(controller.isDestroyed).toBe(true);
    });
  });
});