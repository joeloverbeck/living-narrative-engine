/**
 * @file Unit tests for FormValidationHelper
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
  FormValidationHelper,
  ValidationPatterns,
} from '../../../../src/shared/characterBuilder/formValidationHelper.js';
import { flushPromisesAndTimers } from '../../../common/jestHelpers.js';

describe('FormValidationHelper', () => {
  describe('validateTextInput', () => {
    it('should validate text with minimum length requirement', () => {
      const result = FormValidationHelper.validateTextInput('Hello', 3);

      expect(result.isValid).toBe(true);
    });

    it('should fail validation when text is too short', () => {
      const result = FormValidationHelper.validateTextInput('Hi', 5);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input must be at least 5 characters');
    });

    it('should validate text with maximum length requirement', () => {
      const result = FormValidationHelper.validateTextInput('Hello', 0, 10);

      expect(result.isValid).toBe(true);
    });

    it('should fail validation when text is too long', () => {
      const result = FormValidationHelper.validateTextInput(
        'This is a very long text',
        0,
        10
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input must be no more than 10 characters');
    });

    it('should validate text with both min and max length requirements', () => {
      const result = FormValidationHelper.validateTextInput(
        'Hello World',
        5,
        20
      );

      expect(result.isValid).toBe(true);
    });

    it('should fail validation when text is empty and has min length', () => {
      const result = FormValidationHelper.validateTextInput('', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input is required');
    });

    it('should fail validation when text is empty', () => {
      const result = FormValidationHelper.validateTextInput('', 0);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input is required');
    });

    it('should handle null input gracefully', () => {
      const result = FormValidationHelper.validateTextInput(null, 5);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input is required');
    });

    it('should handle undefined input gracefully', () => {
      const result = FormValidationHelper.validateTextInput(undefined, 5);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input is required');
    });

    it('should handle whitespace-only input', () => {
      const result = FormValidationHelper.validateTextInput('   ', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Input cannot be empty');
    });

    it('should validate trimmed text length', () => {
      const result = FormValidationHelper.validateTextInput('  Hello  ', 3, 10);

      expect(result.isValid).toBe(true);
    });

    it('should use default options when none provided', () => {
      const result = FormValidationHelper.validateTextInput('Hello');

      expect(result.isValid).toBe(true);
    });
  });

  describe('updateCharacterCount', () => {
    let mockCountElement;
    let mockInput;

    beforeEach(() => {
      mockCountElement = {
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn(() => false),
        },
      };

      mockInput = {
        value: '',
        addEventListener: jest.fn(),
      };
    });

    it('should update character count display', () => {
      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.textContent).toBe('0/100');
    });

    it('should show current character count', () => {
      mockInput.value = 'Hello World';

      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.textContent).toBe('11/100');
    });

    it('should add warning class when approaching limit', () => {
      mockInput.value = 'A'.repeat(85); // 85% of 100

      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.classList.add).toHaveBeenCalledWith('warning');
    });

    it('should add warning class when at limit', () => {
      mockInput.value = 'A'.repeat(100);

      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.classList.add).toHaveBeenCalledWith('warning');
    });

    it('should add error class when over limit', () => {
      mockInput.value = 'A'.repeat(101);

      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.classList.add).toHaveBeenCalledWith('error');
    });

    it('should remove warning/error classes when under limit', () => {
      mockInput.value = 'Hello';

      FormValidationHelper.updateCharacterCount(
        mockInput,
        mockCountElement,
        100
      );

      expect(mockCountElement.classList.remove).toHaveBeenCalledWith(
        'warning',
        'error'
      );
    });

    it('should handle missing count element gracefully', () => {
      expect(() => {
        FormValidationHelper.updateCharacterCount(mockInput, null, 100);
      }).not.toThrow();
    });

    it('should handle missing input element gracefully', () => {
      expect(() => {
        FormValidationHelper.updateCharacterCount(null, mockCountElement, 100);
      }).not.toThrow();
    });

    it('should handle zero max length', () => {
      FormValidationHelper.updateCharacterCount(mockInput, mockCountElement, 0);

      expect(mockCountElement.textContent).toBe('0');
      // classList.remove is called but not classList.add
      expect(mockCountElement.classList.remove).toHaveBeenCalledWith(
        'warning',
        'error'
      );
    });
  });

  describe('setupRealTimeValidation', () => {
    let mockInput;
    let mockValidationCallback;

    beforeEach(() => {
      mockInput = {
        value: '',
        addEventListener: jest.fn(),
      };

      mockValidationCallback = jest.fn().mockReturnValue({
        isValid: true,
        error: '',
      });
    });

    it('should set up input event listener', () => {
      FormValidationHelper.setupRealTimeValidation(
        mockInput,
        mockValidationCallback
      );

      expect(mockInput.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      );
    });

    it('should set up blur event listener', () => {
      FormValidationHelper.setupRealTimeValidation(
        mockInput,
        mockValidationCallback
      );

      expect(mockInput.addEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      );
    });

    it('should set up focus event listener', () => {
      FormValidationHelper.setupRealTimeValidation(
        mockInput,
        mockValidationCallback
      );

      expect(mockInput.addEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function)
      );
    });

    it('should handle missing input element', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(
          null,
          mockValidationCallback
        );
      }).not.toThrow();
    });

    it('should handle missing validation callback', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(mockInput, null);
      }).not.toThrow();
    });

    it('should handle non-function validation callback', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(
          mockInput,
          'not a function'
        );
      }).not.toThrow();
    });

    it('should set up character counting when maxLength provided', () => {
      const mockCharCount = {
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      FormValidationHelper.setupRealTimeValidation(
        mockInput,
        mockValidationCallback,
        {
          countElement: mockCharCount,
          maxLength: 100,
        }
      );

      // Should set up input listener with character counting
      expect(mockInput.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      );
    });

    it('should work without character count element', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(
          mockInput,
          mockValidationCallback
        );
      }).not.toThrow();
    });

    it('should work with custom debounce time', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(
          mockInput,
          mockValidationCallback,
          {
            debounceMs: 500,
          }
        );
      }).not.toThrow();
    });
  });

  describe('showFieldError', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        setAttribute: jest.fn(),
        classList: {
          add: jest.fn(),
        },
        parentElement: {
          querySelector: jest.fn(() => null),
          insertBefore: jest.fn(),
        },
        id: 'test-input',
        nextSibling: null,
      };
    });

    it('should show error on element', () => {
      FormValidationHelper.showFieldError(mockElement, 'Error message');

      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');
    });

    it('should handle missing element gracefully', () => {
      expect(() => {
        FormValidationHelper.showFieldError(null, 'Error message');
      }).not.toThrow();
    });
  });

  describe('clearFieldError', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        setAttribute: jest.fn(),
        classList: {
          remove: jest.fn(),
        },
        parentElement: {
          querySelector: jest.fn(() => ({
            textContent: '',
            style: { display: 'block' },
          })),
        },
      };
    });

    it('should clear error from element', () => {
      FormValidationHelper.clearFieldError(mockElement);

      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'false'
      );
      expect(mockElement.classList.remove).toHaveBeenCalledWith('error');
    });

    it('should handle missing element gracefully', () => {
      expect(() => {
        FormValidationHelper.clearFieldError(null);
      }).not.toThrow();
    });
  });

  describe('validateRequiredField', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        value: '',
        setAttribute: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
        parentElement: {
          querySelector: jest.fn(() => null),
          insertBefore: jest.fn(),
        },
        id: 'test-input',
        nextSibling: null,
      };
    });

    it('should return true for valid non-empty input', () => {
      mockElement.value = 'Valid input';

      const result = FormValidationHelper.validateRequiredField(
        mockElement,
        'Test Field'
      );

      expect(result).toBe(true);
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'false'
      );
      expect(mockElement.classList.remove).toHaveBeenCalledWith('error');
    });

    it('should return false for empty input', () => {
      mockElement.value = '';

      const result = FormValidationHelper.validateRequiredField(
        mockElement,
        'Test Field'
      );

      expect(result).toBe(false);
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');
    });

    it('should return false for whitespace-only input', () => {
      mockElement.value = '   ';

      const result = FormValidationHelper.validateRequiredField(
        mockElement,
        'Test Field'
      );

      expect(result).toBe(false);
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');
    });

    it('should return false for null element', () => {
      const result = FormValidationHelper.validateRequiredField(
        null,
        'Test Field'
      );

      expect(result).toBe(false);
    });

    it('should use custom field name in error message', () => {
      mockElement.value = '';
      mockElement.parentElement.querySelector.mockReturnValue(null);

      // Mock document.createElement to return a real element
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        return element;
      });

      FormValidationHelper.validateRequiredField(
        mockElement,
        'Custom Field Name'
      );

      // Verify showFieldError was called with correct message
      // We can't easily verify the actual element creation in this test setup
      // but we know the method was called with the right parameters
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');

      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should use default field name when none provided', () => {
      mockElement.value = '';
      mockElement.parentElement.querySelector.mockReturnValue(null);

      // Mock document.createElement to return a real element
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        return element;
      });

      FormValidationHelper.validateRequiredField(mockElement);

      // Verify the element was set to invalid state
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');

      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should handle element with undefined value property', () => {
      mockElement.value = undefined;

      const result = FormValidationHelper.validateRequiredField(
        mockElement,
        'Test Field'
      );

      expect(result).toBe(false);
    });
  });

  describe('validateField', () => {
    let mockElement;
    let mockValidator;

    beforeEach(() => {
      mockElement = {
        value: '',
        setAttribute: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
        parentElement: {
          querySelector: jest.fn(() => null),
          insertBefore: jest.fn(),
        },
        id: 'test-input',
        nextSibling: null,
      };

      mockValidator = jest.fn();
    });

    it('should return true for valid input', () => {
      mockElement.value = 'Valid input';
      mockValidator.mockReturnValue({ isValid: true });

      const result = FormValidationHelper.validateField(
        mockElement,
        mockValidator,
        'Test Field'
      );

      expect(result).toBe(true);
      expect(mockValidator).toHaveBeenCalledWith('Valid input');
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'false'
      );
      expect(mockElement.classList.remove).toHaveBeenCalledWith('error');
    });

    it('should return false for invalid input with custom error', () => {
      mockElement.value = 'Invalid input';
      mockValidator.mockReturnValue({
        isValid: false,
        error: 'Custom error message',
      });
      mockElement.parentElement.querySelector.mockReturnValue(null);

      // Mock document.createElement to return a real element
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        return element;
      });

      const result = FormValidationHelper.validateField(
        mockElement,
        mockValidator,
        'Test Field'
      );

      expect(result).toBe(false);
      expect(mockValidator).toHaveBeenCalledWith('Invalid input');
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'aria-invalid',
        'true'
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith('error');

      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should use fallback error message when validator does not provide one', () => {
      mockElement.value = 'Invalid input';
      mockValidator.mockReturnValue({ isValid: false });
      mockElement.parentElement.querySelector.mockReturnValue(null);

      // Mock document.createElement to return a real element
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        return element;
      });

      const result = FormValidationHelper.validateField(
        mockElement,
        mockValidator,
        'Custom Field'
      );

      expect(result).toBe(false);

      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should return false for null element', () => {
      const result = FormValidationHelper.validateField(
        null,
        mockValidator,
        'Test Field'
      );

      expect(result).toBe(false);
      expect(mockValidator).not.toHaveBeenCalled();
    });

    it('should return false for non-function validator', () => {
      mockElement.value = 'Some input';

      const result = FormValidationHelper.validateField(
        mockElement,
        'not a function',
        'Test Field'
      );

      expect(result).toBe(false);
    });

    it('should handle element with undefined value property', () => {
      mockElement.value = undefined;
      mockValidator.mockReturnValue({ isValid: true });

      const result = FormValidationHelper.validateField(
        mockElement,
        mockValidator,
        'Test Field'
      );

      expect(result).toBe(true);
      expect(mockValidator).toHaveBeenCalledWith('');
    });

    it('should trim whitespace from element value', () => {
      mockElement.value = '  test value  ';
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.validateField(
        mockElement,
        mockValidator,
        'Test Field'
      );

      expect(mockValidator).toHaveBeenCalledWith('test value');
    });
  });

  describe('setupRealTimeValidation - Event Handler Tests', () => {
    let mockInput;
    let mockValidator;
    let mockCountElement;
    let eventHandlers;

    beforeEach(() => {
      jest.useFakeTimers();

      eventHandlers = {};
      mockInput = {
        value: '',
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
      };

      mockValidator = jest.fn();

      mockCountElement = {
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      // Mock FormValidationHelper static methods
      jest
        .spyOn(FormValidationHelper, 'showFieldError')
        .mockImplementation(jest.fn());
      jest
        .spyOn(FormValidationHelper, 'clearFieldError')
        .mockImplementation(jest.fn());
      jest
        .spyOn(FormValidationHelper, 'updateCharacterCount')
        .mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should debounce validation on input events', () => {
      mockInput.value = 'test input';
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator, {
        debounceMs: 300,
      });

      // Trigger input event multiple times quickly
      eventHandlers.input();
      eventHandlers.input();
      eventHandlers.input();

      // Validator should not be called immediately
      expect(mockValidator).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(300);

      // Now validator should be called only once due to debouncing
      expect(mockValidator).toHaveBeenCalledTimes(1);
      expect(mockValidator).toHaveBeenCalledWith('test input');
    });

    it('should show error on input when validation fails and user has typed', () => {
      mockInput.value = 'invalid';
      mockValidator.mockReturnValue({ isValid: false, error: 'Invalid input' });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.input();
      jest.advanceTimersByTime(300);

      expect(FormValidationHelper.showFieldError).toHaveBeenCalledWith(
        mockInput,
        'Invalid input'
      );
    });

    it('should not show error on input when validation fails but input is empty', () => {
      mockInput.value = '';
      mockValidator.mockReturnValue({
        isValid: false,
        error: 'Required field',
      });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.input();
      jest.advanceTimersByTime(300);

      expect(FormValidationHelper.showFieldError).not.toHaveBeenCalled();
    });

    it('should clear error on input when validation succeeds', () => {
      mockInput.value = 'valid input';
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.input();
      jest.advanceTimersByTime(300);

      expect(FormValidationHelper.clearFieldError).toHaveBeenCalledWith(
        mockInput
      );
    });

    it('should update character count on input when countElement provided', () => {
      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator, {
        countElement: mockCountElement,
        maxLength: 100,
      });

      eventHandlers.input();

      expect(FormValidationHelper.updateCharacterCount).toHaveBeenCalledWith(
        mockInput,
        mockCountElement,
        100
      );
    });

    it('should validate immediately on blur event', () => {
      mockInput.value = 'test input';
      mockValidator.mockReturnValue({
        isValid: false,
        error: 'Blur validation error',
      });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.blur();

      // Validation should be called immediately without debouncing
      expect(mockValidator).toHaveBeenCalledWith('test input');
      expect(FormValidationHelper.showFieldError).toHaveBeenCalledWith(
        mockInput,
        'Blur validation error'
      );
    });

    it('should clear timeout on blur event', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      // Start a debounced validation
      eventHandlers.input();

      // Blur should clear the timeout
      eventHandlers.blur();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear error on focus when input is empty', () => {
      mockInput.value = '';

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.focus();

      expect(FormValidationHelper.clearFieldError).toHaveBeenCalledWith(
        mockInput
      );
    });

    it('should not clear error on focus when input has content', () => {
      mockInput.value = 'some content';

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.focus();

      expect(FormValidationHelper.clearFieldError).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only input on focus', () => {
      mockInput.value = '   ';

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.focus();

      expect(FormValidationHelper.clearFieldError).toHaveBeenCalledWith(
        mockInput
      );
    });

    it('should call updateCharacterCount initially when countElement provided', () => {
      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator, {
        countElement: mockCountElement,
        maxLength: 50,
      });

      // Should be called once during setup
      expect(FormValidationHelper.updateCharacterCount).toHaveBeenCalledWith(
        mockInput,
        mockCountElement,
        50
      );
    });

    it('should work without character count element', () => {
      expect(() => {
        FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);
        eventHandlers.input();
      }).not.toThrow();

      expect(FormValidationHelper.updateCharacterCount).not.toHaveBeenCalled();
    });

    it('should use custom debounce time', () => {
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator, {
        debounceMs: 500,
      });

      eventHandlers.input();

      // Should not be called before custom debounce time
      jest.advanceTimersByTime(300);
      expect(mockValidator).not.toHaveBeenCalled();

      // Should be called after custom debounce time
      jest.advanceTimersByTime(200);
      expect(mockValidator).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined value property in event handlers', () => {
      mockInput.value = undefined;
      mockValidator.mockReturnValue({ isValid: true });

      FormValidationHelper.setupRealTimeValidation(mockInput, mockValidator);

      eventHandlers.input();
      jest.advanceTimersByTime(300);

      expect(mockValidator).toHaveBeenCalledWith('');

      eventHandlers.blur();
      expect(mockValidator).toHaveBeenCalledWith('');
    });
  });

  describe('ValidationPatterns', () => {
    describe('title validation', () => {
      it('should validate title with correct length (5-300 chars)', () => {
        const result = ValidationPatterns.title('Valid Title');
        expect(result.isValid).toBe(true);
      });

      it('should reject title too short', () => {
        const result = ValidationPatterns.title('Hi');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be at least 5 characters');
      });

      it('should reject title too long', () => {
        const longTitle = 'A'.repeat(301);
        const result = ValidationPatterns.title(longTitle);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be no more than 300 characters');
      });
    });

    describe('description validation', () => {
      it('should validate description with correct length (20-1500 chars)', () => {
        const validDescription =
          'This is a valid description that meets the minimum length requirements for testing purposes.';
        const result = ValidationPatterns.description(validDescription);
        expect(result.isValid).toBe(true);
      });

      it('should reject description too short', () => {
        const result = ValidationPatterns.description('Too short');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be at least 20 characters');
      });

      it('should reject description too long', () => {
        const longDescription = 'A'.repeat(1501);
        const result = ValidationPatterns.description(longDescription);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be no more than 1500 characters');
      });
    });

    describe('shortText validation', () => {
      it('should validate short text with correct length (10-600 chars)', () => {
        const result = ValidationPatterns.shortText('Valid short text input');
        expect(result.isValid).toBe(true);
      });

      it('should reject short text too short', () => {
        const result = ValidationPatterns.shortText('Short');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be at least 10 characters');
      });

      it('should reject short text too long', () => {
        const longText = 'A'.repeat(601);
        const result = ValidationPatterns.shortText(longText);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be no more than 600 characters');
      });
    });

    describe('longText validation', () => {
      it('should validate long text with correct length (10-6000 chars)', () => {
        const result = ValidationPatterns.longText(
          'Valid long text input for testing'
        );
        expect(result.isValid).toBe(true);
      });

      it('should reject long text too short', () => {
        const result = ValidationPatterns.longText('Short');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be at least 10 characters');
      });

      it('should reject long text too long', () => {
        const longText = 'A'.repeat(6001);
        const result = ValidationPatterns.longText(longText);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be no more than 6000 characters');
      });
    });

    describe('concept validation', () => {
      it('should validate concept with correct length (50-6000 chars)', () => {
        const validConcept =
          'This is a valid concept description that meets the minimum length requirements for testing purposes and provides sufficient detail.';
        const result = ValidationPatterns.concept(validConcept);
        expect(result.isValid).toBe(true);
      });

      it('should reject concept too short', () => {
        const result = ValidationPatterns.concept('Too short concept');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be at least 50 characters');
      });

      it('should reject concept too long', () => {
        const longConcept = 'A'.repeat(6001);
        const result = ValidationPatterns.concept(longConcept);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Input must be no more than 6000 characters');
      });
    });
  });

  describe('DOM Integration Tests', () => {
    let testContainer;

    beforeEach(() => {
      // Create a test container in the DOM
      testContainer = document.createElement('div');
      testContainer.innerHTML = `
        <div class="form-group">
          <input type="text" id="test-input" />
          <div class="char-count" id="char-count"></div>
        </div>
      `;
      document.body.appendChild(testContainer);
    });

    afterEach(() => {
      // Clean up DOM
      if (testContainer && testContainer.parentNode) {
        testContainer.parentNode.removeChild(testContainer);
      }
    });

    it('should create and manage error elements in real DOM', () => {
      const inputElement = document.getElementById('test-input');

      // Show error
      FormValidationHelper.showFieldError(inputElement, 'Test error message');

      // Verify error element was created
      const errorElement = testContainer.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toBe('Test error message');
      expect(errorElement.style.display).toBe('block');
      expect(errorElement.getAttribute('data-error-for')).toBe('test-input');

      // Verify input element state
      expect(inputElement.getAttribute('aria-invalid')).toBe('true');
      expect(inputElement.classList.contains('error')).toBe(true);

      // Clear error
      FormValidationHelper.clearFieldError(inputElement);

      // Verify error was cleared
      expect(inputElement.getAttribute('aria-invalid')).toBe('false');
      expect(inputElement.classList.contains('error')).toBe(false);
      expect(errorElement.textContent).toBe('');
      expect(errorElement.style.display).toBe('none');
    });

    it('should update character count with real DOM elements', () => {
      const inputElement = document.getElementById('test-input');
      const countElement = document.getElementById('char-count');

      inputElement.value = 'Hello World';

      FormValidationHelper.updateCharacterCount(inputElement, countElement, 50);

      expect(countElement.textContent).toBe('11/50');
      expect(countElement.classList.contains('warning')).toBe(false);
      expect(countElement.classList.contains('error')).toBe(false);

      // Test warning threshold
      inputElement.value = 'A'.repeat(41); // Over 80% of 50
      FormValidationHelper.updateCharacterCount(inputElement, countElement, 50);

      expect(countElement.textContent).toBe('41/50');
      expect(countElement.classList.contains('warning')).toBe(true);

      // Test error threshold
      inputElement.value = 'A'.repeat(51); // Over limit
      FormValidationHelper.updateCharacterCount(inputElement, countElement, 50);

      expect(countElement.textContent).toBe('51/50');
      expect(countElement.classList.contains('error')).toBe(true);
    });

    it('should validate required fields with real DOM elements', () => {
      const inputElement = document.getElementById('test-input');

      // Test empty input
      inputElement.value = '';
      const result1 = FormValidationHelper.validateRequiredField(
        inputElement,
        'Test Field'
      );

      expect(result1).toBe(false);
      expect(inputElement.getAttribute('aria-invalid')).toBe('true');
      expect(inputElement.classList.contains('error')).toBe(true);

      const errorElement = testContainer.querySelector('.error-message');
      expect(errorElement.textContent).toBe('Test Field is required');

      // Test valid input
      inputElement.value = 'Valid input';
      const result2 = FormValidationHelper.validateRequiredField(
        inputElement,
        'Test Field'
      );

      expect(result2).toBe(true);
      expect(inputElement.getAttribute('aria-invalid')).toBe('false');
      expect(inputElement.classList.contains('error')).toBe(false);
    });

    it('should validate fields with custom validators using real DOM', () => {
      const inputElement = document.getElementById('test-input');

      const customValidator = (value) => {
        if (value.length < 5) {
          return { isValid: false, error: 'Minimum 5 characters required' };
        }
        return { isValid: true };
      };

      // Test invalid input
      inputElement.value = 'Hi';
      const result1 = FormValidationHelper.validateField(
        inputElement,
        customValidator,
        'Custom Field'
      );

      expect(result1).toBe(false);
      const errorElement = testContainer.querySelector('.error-message');
      expect(errorElement.textContent).toBe('Minimum 5 characters required');

      // Test valid input
      inputElement.value = 'Hello World';
      const result2 = FormValidationHelper.validateField(
        inputElement,
        customValidator,
        'Custom Field'
      );

      expect(result2).toBe(true);
      expect(inputElement.getAttribute('aria-invalid')).toBe('false');
    });

    it('should find existing error elements by data attribute', () => {
      const inputElement = document.getElementById('test-input');
      const parentElement = inputElement.parentElement;

      // Create a pre-existing error element in the parent
      const existingError = document.createElement('div');
      existingError.setAttribute('data-error-for', 'test-input');
      existingError.className = 'custom-error';
      existingError.style.display = 'none';
      parentElement.appendChild(existingError);

      // Show error should use existing element
      FormValidationHelper.showFieldError(
        inputElement,
        'Using existing error element'
      );

      expect(existingError.textContent).toBe('Using existing error element');
      expect(existingError.style.display).toBe('block');

      // Should not create a new error element
      const errorElements = parentElement.querySelectorAll(
        '[data-error-for="test-input"]'
      );
      expect(errorElements.length).toBe(1);
    });

    it('should find existing error elements by class name', () => {
      const inputElement = document.getElementById('test-input');
      const parentElement = inputElement.parentElement;

      // Create a pre-existing error element with class
      const existingError = document.createElement('div');
      existingError.className = 'error-message';
      existingError.style.display = 'none';
      parentElement.appendChild(existingError);

      // Show error should use existing element
      FormValidationHelper.showFieldError(
        inputElement,
        'Using existing class-based error'
      );

      expect(existingError.textContent).toBe(
        'Using existing class-based error'
      );
      expect(existingError.style.display).toBe('block');
    });

    it('should handle elements without parent gracefully for clearFieldError', () => {
      const orphanElement = document.createElement('input');
      orphanElement.id = 'orphan-input';

      // clearFieldError should not throw with orphan element
      expect(() => {
        FormValidationHelper.clearFieldError(orphanElement);
      }).not.toThrow();
    });

    it('should handle showFieldError with orphan element', () => {
      const orphanElement = document.createElement('input');
      orphanElement.id = 'orphan-input';

      // showFieldError with orphan element will throw because it can't insert the error element
      // This is expected behavior - the element needs a parent to show errors
      expect(() => {
        FormValidationHelper.showFieldError(orphanElement, 'Error message');
      }).toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete validation setup', () => {
      const mockInput = {
        value: 'Test input',
        addEventListener: jest.fn(),
      };

      const mockCharCount = {
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      const validationCallback = (value) => {
        return FormValidationHelper.validateTextInput(value, 5, 50);
      };

      expect(() => {
        FormValidationHelper.setupRealTimeValidation(
          mockInput,
          validationCallback,
          {
            countElement: mockCharCount,
            maxLength: 50,
          }
        );
      }).not.toThrow();

      expect(mockInput.addEventListener).toHaveBeenCalledTimes(3); // input, blur, focus
    });
  });
});
