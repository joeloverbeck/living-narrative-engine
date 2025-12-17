/**
 * @file Unit tests for SaveFeedbackAnimator
 * @see src/modManager/animations/SaveFeedbackAnimator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  SaveFeedbackAnimator,
  SaveState,
} from '../../../../src/modManager/animations/SaveFeedbackAnimator.js';

describe('SaveFeedbackAnimator', () => {
  let animator;
  let mockLogger;
  let mockButton;

  beforeEach(() => {
    jest.useFakeTimers();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock button element
    mockButton = {
      classList: {
        _classes: new Set(),
        add: jest.fn((...classNames) => {
          classNames.forEach((c) => mockButton.classList._classes.add(c));
        }),
        remove: jest.fn((...classNames) => {
          classNames.forEach((c) => mockButton.classList._classes.delete(c));
        }),
        contains: jest.fn((className) =>
          mockButton.classList._classes.has(className)
        ),
      },
      disabled: false,
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      querySelector: jest.fn((selector) => {
        if (selector === '.save-button__icon') {
          return { textContent: '' };
        }
        if (selector === '.save-button__text') {
          return { textContent: '' };
        }
        return null;
      }),
    };

    animator = new SaveFeedbackAnimator({
      logger: mockLogger,
      successDuration: 2000,
      errorDuration: 3000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when not provided', () => {
      const defaultAnimator = new SaveFeedbackAnimator({ logger: mockLogger });
      expect(defaultAnimator.getState()).toBe(SaveState.IDLE);
      expect(defaultAnimator.isTransient()).toBe(false);
    });

    it('should initialize in idle state', () => {
      expect(animator.getState()).toBe(SaveState.IDLE);
    });
  });

  describe('showSaving', () => {
    it('should add saving class and update content', () => {
      animator.showSaving(mockButton);

      expect(mockButton.classList.add).toHaveBeenCalledWith(
        'save-button--saving'
      );
      expect(animator.getState()).toBe(SaveState.SAVING);
    });

    it('should disable button and set aria-busy', () => {
      animator.showSaving(mockButton);

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
    });

    it('should remove previous state classes', () => {
      mockButton.classList._classes.add('save-button--success');

      animator.showSaving(mockButton);

      expect(mockButton.classList.remove).toHaveBeenCalledWith(
        'save-button--saving',
        'save-button--success',
        'save-button--error'
      );
    });

    it('should handle null button gracefully', () => {
      expect(() => animator.showSaving(null)).not.toThrow();
    });

    it('should log debug message', () => {
      animator.showSaving(mockButton);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Save feedback: showing saving state'
      );
    });
  });

  describe('showSuccess', () => {
    it('should add success class and update content', () => {
      animator.showSuccess(mockButton);

      expect(mockButton.classList.add).toHaveBeenCalledWith(
        'save-button--success'
      );
      expect(animator.getState()).toBe(SaveState.SUCCESS);
    });

    it('should auto-reset after duration', () => {
      animator.showSuccess(mockButton);

      expect(animator.getState()).toBe(SaveState.SUCCESS);

      jest.advanceTimersByTime(2000);

      expect(animator.getState()).toBe(SaveState.IDLE);
    });

    it('should call onReset callback when resetting', () => {
      const onReset = jest.fn();
      animator.showSuccess(mockButton, onReset);

      jest.advanceTimersByTime(2000);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should remove aria-busy attribute', () => {
      animator.showSuccess(mockButton);

      expect(mockButton.removeAttribute).toHaveBeenCalledWith('aria-busy');
    });

    it('should handle null button gracefully', () => {
      expect(() => animator.showSuccess(null)).not.toThrow();
    });
  });

  describe('showError', () => {
    it('should add error class and update content', () => {
      animator.showError(mockButton);

      expect(mockButton.classList.add).toHaveBeenCalledWith(
        'save-button--error'
      );
      expect(animator.getState()).toBe(SaveState.ERROR);
    });

    it('should keep button enabled for retry', () => {
      animator.showError(mockButton);

      expect(mockButton.disabled).toBe(false);
    });

    it('should set aria-invalid', () => {
      animator.showError(mockButton);

      expect(mockButton.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
    });

    it('should auto-reset after error duration', () => {
      animator.showError(mockButton);

      expect(animator.getState()).toBe(SaveState.ERROR);

      jest.advanceTimersByTime(3000);

      expect(animator.getState()).toBe(SaveState.IDLE);
    });

    it('should call onReset callback when resetting', () => {
      const onReset = jest.fn();
      animator.showError(mockButton, onReset);

      jest.advanceTimersByTime(3000);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should handle null button gracefully', () => {
      expect(() => animator.showError(null)).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should remove all state classes', () => {
      animator.showSaving(mockButton);
      animator.reset(mockButton);

      expect(mockButton.classList.remove).toHaveBeenCalledWith(
        'save-button--saving',
        'save-button--success',
        'save-button--error'
      );
    });

    it('should restore default content', () => {
      const iconElement = { textContent: '' };
      const textElement = { textContent: '' };
      mockButton.querySelector = jest.fn((selector) => {
        if (selector === '.save-button__icon') return iconElement;
        if (selector === '.save-button__text') return textElement;
        return null;
      });

      animator.reset(mockButton);

      expect(iconElement.textContent).toBe('💾');
      expect(textElement.textContent).toBe('Save Configuration');
    });

    it('should enable button', () => {
      mockButton.disabled = true;
      animator.reset(mockButton);

      expect(mockButton.disabled).toBe(false);
    });

    it('should remove aria attributes', () => {
      animator.reset(mockButton);

      expect(mockButton.removeAttribute).toHaveBeenCalledWith('aria-busy');
      expect(mockButton.removeAttribute).toHaveBeenCalledWith('aria-invalid');
    });

    it('should set state to idle', () => {
      animator.showSaving(mockButton);
      animator.reset(mockButton);

      expect(animator.getState()).toBe(SaveState.IDLE);
    });

    it('should handle null button gracefully', () => {
      expect(() => animator.reset(null)).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(animator.getState()).toBe(SaveState.IDLE);

      animator.showSaving(mockButton);
      expect(animator.getState()).toBe(SaveState.SAVING);

      animator.showSuccess(mockButton);
      expect(animator.getState()).toBe(SaveState.SUCCESS);

      animator.showError(mockButton);
      expect(animator.getState()).toBe(SaveState.ERROR);
    });
  });

  describe('isTransient', () => {
    it('should return false when idle', () => {
      expect(animator.isTransient()).toBe(false);
    });

    it('should return true during saving state', () => {
      animator.showSaving(mockButton);
      expect(animator.isTransient()).toBe(true);
    });

    it('should return true during success state', () => {
      animator.showSuccess(mockButton);
      expect(animator.isTransient()).toBe(true);
    });

    it('should return true during error state', () => {
      animator.showError(mockButton);
      expect(animator.isTransient()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clear reset timer', () => {
      animator.showSuccess(mockButton);
      animator.destroy();

      // Advance time - reset should NOT happen since destroyed
      jest.advanceTimersByTime(5000);

      // State should be idle from destroy, not from auto-reset
      expect(animator.getState()).toBe(SaveState.IDLE);
    });

    it('should log destruction', () => {
      animator.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Save feedback animator destroyed'
      );
    });
  });

  describe('rapid state changes', () => {
    it('should handle timer correctly during rapid state changes', () => {
      const onReset1 = jest.fn();
      const onReset2 = jest.fn();

      // Start success with callback
      animator.showSuccess(mockButton, onReset1);

      // Before first timer fires, switch to error
      jest.advanceTimersByTime(1000);
      animator.showError(mockButton, onReset2);

      // Wait for original success duration - first callback should NOT fire
      jest.advanceTimersByTime(1000);
      expect(onReset1).not.toHaveBeenCalled();

      // Wait for error duration
      jest.advanceTimersByTime(3000);
      expect(onReset2).toHaveBeenCalledTimes(1);
    });

    it('should clear previous timer when transitioning to saving', () => {
      animator.showSuccess(mockButton);
      animator.showSaving(mockButton);

      // Original success timer should be cancelled
      jest.advanceTimersByTime(5000);

      // Should still be in saving state (no auto-reset for saving)
      expect(animator.getState()).toBe(SaveState.SAVING);
    });
  });

  describe('content update edge cases', () => {
    it('should handle missing icon element', () => {
      mockButton.querySelector = jest.fn((selector) => {
        if (selector === '.save-button__text') {
          return { textContent: '' };
        }
        return null;
      });

      expect(() => animator.showSaving(mockButton)).not.toThrow();
    });

    it('should handle missing text element', () => {
      mockButton.querySelector = jest.fn((selector) => {
        if (selector === '.save-button__icon') {
          return { textContent: '' };
        }
        return null;
      });

      expect(() => animator.showSaving(mockButton)).not.toThrow();
    });

    it('should handle both elements missing', () => {
      mockButton.querySelector = jest.fn(() => null);

      expect(() => animator.showSaving(mockButton)).not.toThrow();
      expect(() => animator.showSuccess(mockButton)).not.toThrow();
      expect(() => animator.showError(mockButton)).not.toThrow();
      expect(() => animator.reset(mockButton)).not.toThrow();
    });
  });

  describe('SaveState enum', () => {
    it('should export correct state values', () => {
      expect(SaveState.IDLE).toBe('idle');
      expect(SaveState.SAVING).toBe('saving');
      expect(SaveState.SUCCESS).toBe('success');
      expect(SaveState.ERROR).toBe('error');
    });
  });
});
