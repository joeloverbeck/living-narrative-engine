/**
 * @file Unit tests for UIStateManager
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UIStateManager } from '../../../../src/shared/characterBuilder/uiStateManager.js';

describe('UIStateManager', () => {
  let uiStateManager;
  let mockEmptyState;
  let mockLoadingState;
  let mockErrorState;
  let mockResultsState;

  beforeEach(() => {
    // Create mock DOM elements with classList support for proper display detection
    mockEmptyState = {
      style: { display: 'none' },
      textContent: '',
      querySelector: jest.fn(),
      classList: {
        contains: jest.fn((className) => className === 'cb-empty-state'),
      },
    };

    mockLoadingState = {
      style: { display: 'none' },
      querySelector: jest.fn().mockReturnValue({
        textContent: '',
      }),
      classList: {
        contains: jest.fn((className) => className === 'cb-loading-state'),
      },
    };

    mockErrorState = {
      style: { display: 'none' },
      querySelector: jest.fn().mockReturnValue({
        textContent: '',
      }),
      classList: {
        contains: jest.fn((className) => className === 'cb-error-state'),
      },
    };

    mockResultsState = {
      style: { display: 'none' },
      querySelector: jest.fn(),
      classList: {
        contains: jest.fn((className) => className === 'cb-results-state'),
      },
    };

    uiStateManager = new UIStateManager({
      emptyState: mockEmptyState,
      loadingState: mockLoadingState,
      errorState: mockErrorState,
      resultsState: mockResultsState,
    });
  });

  describe('Constructor', () => {
    it('should create UIStateManager with required elements', () => {
      expect(uiStateManager).toBeInstanceOf(UIStateManager);
    });

    it('should throw error if emptyState element is missing', () => {
      expect(() => {
        new UIStateManager({
          emptyState: null,
          loadingState: mockLoadingState,
          errorState: mockErrorState,
          resultsState: mockResultsState,
        });
      }).toThrow('UIStateManager: Missing required element: emptyState');
    });

    it('should throw error if loadingState element is missing', () => {
      expect(() => {
        new UIStateManager({
          emptyState: mockEmptyState,
          loadingState: null,
          errorState: mockErrorState,
          resultsState: mockResultsState,
        });
      }).toThrow('UIStateManager: Missing required element: loadingState');
    });

    it('should throw error if errorState element is missing', () => {
      expect(() => {
        new UIStateManager({
          emptyState: mockEmptyState,
          loadingState: mockLoadingState,
          errorState: null,
          resultsState: mockResultsState,
        });
      }).toThrow('UIStateManager: Missing required element: errorState');
    });

    it('should throw error if resultsState element is missing', () => {
      expect(() => {
        new UIStateManager({
          emptyState: mockEmptyState,
          loadingState: mockLoadingState,
          errorState: mockErrorState,
          resultsState: null,
        });
      }).toThrow('UIStateManager: Missing required element: resultsState');
    });
  });

  describe('showState', () => {
    it('should show empty state and hide others', () => {
      uiStateManager.showState('empty');

      expect(mockEmptyState.style.display).toBe('flex');
      expect(mockLoadingState.style.display).toBe('none');
      expect(mockErrorState.style.display).toBe('none');
      expect(mockResultsState.style.display).toBe('none');
    });

    it('should show loading state and hide others', () => {
      uiStateManager.showState('loading');

      expect(mockEmptyState.style.display).toBe('none');
      expect(mockLoadingState.style.display).toBe('flex');
      expect(mockErrorState.style.display).toBe('none');
      expect(mockResultsState.style.display).toBe('none');
    });

    it('should show error state and hide others', () => {
      uiStateManager.showState('error');

      expect(mockEmptyState.style.display).toBe('none');
      expect(mockLoadingState.style.display).toBe('none');
      expect(mockErrorState.style.display).toBe('flex');
      expect(mockResultsState.style.display).toBe('none');
    });

    it('should show results state and hide others', () => {
      uiStateManager.showState('results');

      expect(mockEmptyState.style.display).toBe('none');
      expect(mockLoadingState.style.display).toBe('none');
      expect(mockErrorState.style.display).toBe('none');
      expect(mockResultsState.style.display).toBe('block');
    });

    it('should throw error for invalid state', () => {
      expect(() => {
        uiStateManager.showState('invalid');
      }).toThrow('UIStateManager: Invalid state: invalid');
    });
  });

  describe('showLoading', () => {
    it('should show loading state', () => {
      uiStateManager.showLoading();

      expect(mockLoadingState.style.display).toBe('flex');
      expect(mockEmptyState.style.display).toBe('none');
      expect(mockErrorState.style.display).toBe('none');
      expect(mockResultsState.style.display).toBe('none');
    });
  });

  describe('showError', () => {
    it('should show error state with message', () => {
      const errorMessage = 'Something went wrong';
      const mockErrorElement = { textContent: '' };
      mockErrorState.querySelector.mockReturnValue(mockErrorElement);

      uiStateManager.showError(errorMessage);

      expect(mockErrorState.style.display).toBe('flex');
      expect(mockEmptyState.style.display).toBe('none');
      expect(mockLoadingState.style.display).toBe('none');
      expect(mockResultsState.style.display).toBe('none');
      expect(mockErrorState.querySelector).toHaveBeenCalledWith(
        '.error-message, p'
      );
      expect(mockErrorElement.textContent).toBe(errorMessage);
    });

    it('should handle missing error message element gracefully', () => {
      mockErrorState.querySelector.mockReturnValue(null);

      expect(() => {
        uiStateManager.showError('Test error');
      }).not.toThrow();

      expect(mockErrorState.style.display).toBe('flex');
    });

    it('should handle undefined error message', () => {
      const mockErrorElement = { textContent: '' };
      mockErrorState.querySelector.mockReturnValue(mockErrorElement);

      uiStateManager.showError(undefined);

      expect(mockErrorState.style.display).toBe('flex');
      expect(mockErrorElement.textContent).toBe('');
    });
  });

  describe('getCurrentState', () => {
    it('should return current state', () => {
      uiStateManager.showState('loading');
      expect(uiStateManager.getCurrentState()).toBe('loading');

      uiStateManager.showState('error');
      expect(uiStateManager.getCurrentState()).toBe('error');
    });

    it('should return null initially', () => {
      const newManager = new UIStateManager({
        emptyState: mockEmptyState,
        loadingState: mockLoadingState,
        errorState: mockErrorState,
        resultsState: mockResultsState,
      });
      expect(newManager.getCurrentState()).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should handle rapid state changes correctly', () => {
      // Simulate rapid state changes
      uiStateManager.showLoading();
      uiStateManager.showError('Error occurred');
      uiStateManager.showState('results');

      // Final state should be results
      expect(mockResultsState.style.display).toBe('block');
      expect(mockEmptyState.style.display).toBe('none');
      expect(mockLoadingState.style.display).toBe('none');
      expect(mockErrorState.style.display).toBe('none');
      expect(uiStateManager.getCurrentState()).toBe('results');
    });

    it('should maintain proper state tracking', () => {
      // Test sequence of state changes
      uiStateManager.showState('empty');
      expect(uiStateManager.getCurrentState()).toBe('empty');

      uiStateManager.showLoading();
      expect(uiStateManager.getCurrentState()).toBe('loading');

      uiStateManager.showState('results');
      expect(uiStateManager.getCurrentState()).toBe('results');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null message gracefully', () => {
      expect(() => {
        uiStateManager.showError(null);
        uiStateManager.showLoading(null);
      }).not.toThrow();
    });

    it('should handle undefined message gracefully', () => {
      expect(() => {
        uiStateManager.showError(undefined);
        uiStateManager.showLoading(undefined);
      }).not.toThrow();
    });

    it('should handle empty string message', () => {
      const mockErrorElement = { textContent: 'old text' };
      mockErrorState.querySelector.mockReturnValueOnce(mockErrorElement);

      uiStateManager.showError('');
      expect(mockErrorElement.textContent).toBe('');
    });

    it('should handle message updates for loading state', () => {
      const mockLoadingElement = { textContent: '' };
      mockLoadingState.querySelector.mockReturnValue(mockLoadingElement);

      uiStateManager.showLoading('Custom loading message');
      expect(mockLoadingElement.textContent).toBe('Custom loading message');
    });
  });
});
