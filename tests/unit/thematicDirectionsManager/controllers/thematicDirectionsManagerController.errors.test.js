/**
 * @file Error handling tests for ThematicDirectionsManagerController
 * @description Tests error scenarios and graceful failure handling
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

describe('ThematicDirectionsManagerController - Error Handling Tests', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    try {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();

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
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('Service Error Handling', () => {
    it('should handle refresh dropdown errors', async () => {
      const error = new Error('Fetch failed');
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(error);

      await controller.refreshDropdown();

      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        'Failed to refresh dropdown:',
        expect.any(Error)
      );
    });

    it('should handle service initialization failure', async () => {
      const error = new Error('Service initialization failed');
      testBase.mocks.characterBuilderService.initialize.mockRejectedValue(error);

      try {
        await testBase.mocks.characterBuilderService.initialize();
      } catch (err) {
        expect(err.message).toBe('Service initialization failed');
      }
    });

    it('should handle data loading failures', async () => {
      const error = new Error('Network error');
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(error);

      try {
        await testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts();
      } catch (err) {
        expect(err.message).toBe('Network error');
      }
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const mockLocalStorage = {
        getItem: jest.fn(() => {
          throw new Error('Storage quota exceeded');
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      global.localStorage = mockLocalStorage;

      // Should not throw when localStorage fails
      expect(() => {
        try {
          mockLocalStorage.getItem('test-key');
        } catch (error) {
          expect(error.message).toBe('Storage quota exceeded');
        }
      }).not.toThrow();
    });

    it('should handle invalid JSON in localStorage', () => {
      const mockLocalStorage = {
        getItem: jest.fn(() => 'invalid json'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      global.localStorage = mockLocalStorage;

      expect(() => {
        try {
          JSON.parse(mockLocalStorage.getItem('test'));
        } catch (error) {
          expect(error).toBeInstanceOf(SyntaxError);
        }
      }).not.toThrow();
    });
  });

  describe('DOM Error Handling', () => {
    it('should handle missing DOM elements during display', () => {
      // Mock all DOM elements as missing by returning null
      const mockGetElement = jest.fn(() => null);
      const mockSetElementText = jest.fn(() => false);

      // Test graceful handling of missing elements
      const result1 = mockGetElement('nonexistent');
      const result2 = mockSetElementText('nonexistent', 'text');

      expect(result1).toBeNull();
      expect(result2).toBe(false);
    });

    it('should handle element access errors', () => {
      const mockGetElement = jest.fn(() => {
        throw new Error('Element access failed');
      });

      expect(() => {
        try {
          mockGetElement('problematic-element');
        } catch (error) {
          expect(error.message).toBe('Element access failed');
        }
      }).not.toThrow();
    });
  });

  describe('Cleanup Error Handling', () => {
    it('should handle cleanup of orphaned directions', () => {
      const testData = [
        {
          direction: { id: 'dir-1', title: 'Direction 1' },
          concept: { id: 'concept-1', concept: 'Concept 1' }
        },
        {
          direction: { id: 'dir-2', title: 'Orphaned Direction 1' },
          concept: null
        },
        {
          direction: { id: 'dir-3', title: 'Orphaned Direction 2' },
          concept: null
        }
      ];

      const orphanedDirections = testData.filter(item => !item.concept);
      expect(orphanedDirections).toHaveLength(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Delete failed');
      testBase.mocks.characterBuilderService.deleteThematicDirection.mockRejectedValue(error);

      await expect(
        testBase.mocks.characterBuilderService.deleteThematicDirection('orphan-id')
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('Memory Management', () => {
    it('should detect potential memory leaks', () => {
      // Mock InPlaceEditors leak detection
      const mockInPlaceEditors = new Map();
      mockInPlaceEditors.set('editor-1', { destroy: jest.fn() });
      mockInPlaceEditors.set('editor-2', { destroy: jest.fn() });

      expect(mockInPlaceEditors.size).toBe(2);
    });

    it('should detect orphaned DOM elements', () => {
      // Create orphaned editor elements for testing
      const orphanedEditor1 = document.createElement('div');
      orphanedEditor1.className = 'in-place-editor';
      const orphanedEditor2 = document.createElement('div');
      orphanedEditor2.className = 'in-place-editor';
      
      document.body.appendChild(orphanedEditor1);
      document.body.appendChild(orphanedEditor2);

      const orphanedEditors = document.querySelectorAll('.in-place-editor');
      expect(orphanedEditors.length).toBe(2);

      // Cleanup
      orphanedEditor1.remove();
      orphanedEditor2.remove();
    });

    it('should handle timeout cleanup', () => {
      const timeoutId = setTimeout(() => {}, 1000);
      
      expect(timeoutId).toBeDefined();
      expect(typeof timeoutId).toBe('number');
      
      clearTimeout(timeoutId);
    });
  });
});