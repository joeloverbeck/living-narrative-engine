/**
 * @file Shared form validation utilities for character-builder pages
 * @description Provides consistent validation and UI feedback across forms
 */

/**
 * Shared form validation utilities
 */
export class FormValidationHelper {
  /**
   * Validate text input against length constraints
   *
   * @param {string} value - Input value
   * @param {number} minLength - Minimum length
   * @param {number} maxLength - Maximum length
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  static validateTextInput(value, minLength = 0, maxLength = Infinity) {
    if (!value || typeof value !== 'string') {
      return { isValid: false, error: 'Input is required' };
    }

    const trimmedValue = value.trim();
    const length = trimmedValue.length;

    if (length === 0 && minLength > 0) {
      return { isValid: false, error: 'Input cannot be empty' };
    }

    if (length < minLength) {
      return {
        isValid: false,
        error: `Input must be at least ${minLength} characters`,
      };
    }

    if (length > maxLength) {
      return {
        isValid: false,
        error: `Input must be no more than ${maxLength} characters`,
      };
    }

    return { isValid: true };
  }

  /**
   * Update character count display
   *
   * @param {HTMLTextAreaElement|HTMLInputElement} textarea - Input element
   * @param {HTMLElement} countElement - Character count display element
   * @param {number} [maxLength] - Maximum length for warnings
   */
  static updateCharacterCount(textarea, countElement, maxLength = null) {
    if (!textarea || !countElement) return;

    const currentLength = textarea.value.length;
    const displayText = maxLength
      ? `${currentLength}/${maxLength}`
      : `${currentLength}`;

    countElement.textContent = displayText;

    // Update styling based on length
    countElement.classList.remove('warning', 'error');

    if (maxLength) {
      const warningThreshold = maxLength * 0.8;
      if (currentLength > maxLength) {
        countElement.classList.add('error');
      } else if (currentLength > warningThreshold) {
        countElement.classList.add('warning');
      }
    }
  }

  /**
   * Show field error message
   *
   * @param {HTMLElement} element - Input element
   * @param {string} message - Error message
   */
  static showFieldError(element, message) {
    if (!element) return;

    // Set invalid state
    element.setAttribute('aria-invalid', 'true');
    element.classList.add('error');

    // Find or create error message element
    let errorElement = FormValidationHelper.#findErrorElement(element);
    if (!errorElement) {
      errorElement = FormValidationHelper.#createErrorElement(element);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  /**
   * Clear field error message
   *
   * @param {HTMLElement} element - Input element
   */
  static clearFieldError(element) {
    if (!element) return;

    // Remove invalid state
    element.setAttribute('aria-invalid', 'false');
    element.classList.remove('error');

    // Hide error message
    const errorElement = FormValidationHelper.#findErrorElement(element);
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }
  }

  /**
   * Validate required field
   *
   * @param {HTMLElement} element - Input element
   * @param {string} fieldName - Field name for error messages
   * @returns {boolean} Whether field is valid
   */
  static validateRequiredField(element, fieldName = 'Field') {
    if (!element) return false;

    const value = element.value?.trim() || '';
    if (!value) {
      FormValidationHelper.showFieldError(element, `${fieldName} is required`);
      return false;
    }

    FormValidationHelper.clearFieldError(element);
    return true;
  }

  /**
   * Validate field with custom validator
   *
   * @param {HTMLElement} element - Input element
   * @param {Function} validator - Validation function
   * @param {string} fieldName - Field name for error messages
   * @returns {boolean} Whether field is valid
   */
  static validateField(element, validator, fieldName = 'Field') {
    if (!element || typeof validator !== 'function') return false;

    const value = element.value?.trim() || '';
    const result = validator(value);

    if (result.isValid) {
      FormValidationHelper.clearFieldError(element);
      return true;
    } else {
      FormValidationHelper.showFieldError(
        element,
        result.error || `${fieldName} is invalid`
      );
      return false;
    }
  }

  /**
   * Set up real-time validation for an input
   *
   * @param {HTMLElement} element - Input element
   * @param {Function} validator - Validation function
   * @param {object} [options] - Validation options
   * @param {number} [options.debounceMs] - Debounce delay in milliseconds
   * @param {HTMLElement} [options.countElement] - Character counter element
   * @param {number} [options.maxLength] - Maximum length for counter
   */
  static setupRealTimeValidation(element, validator, options = {}) {
    if (!element || typeof validator !== 'function') return;

    const { debounceMs = 300, countElement, maxLength } = options;
    let timeout;

    const validateDebounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const value = element.value?.trim() || '';
        const result = validator(value);

        if (result.isValid) {
          FormValidationHelper.clearFieldError(element);
        } else if (value.length > 0) {
          // Only show error if user has typed something
          FormValidationHelper.showFieldError(element, result.error);
        }
      }, debounceMs);
    };

    const updateCounter = () => {
      if (countElement) {
        FormValidationHelper.updateCharacterCount(
          element,
          countElement,
          maxLength
        );
      }
    };

    // Set up event listeners
    element.addEventListener('input', () => {
      updateCounter();
      validateDebounced();
    });

    element.addEventListener('blur', () => {
      clearTimeout(timeout);
      const value = element.value?.trim() || '';
      const result = validator(value);

      if (!result.isValid) {
        FormValidationHelper.showFieldError(element, result.error);
      }
    });

    element.addEventListener('focus', () => {
      // Clear error on focus to give user a fresh start
      if (element.value?.trim() === '') {
        FormValidationHelper.clearFieldError(element);
      }
    });

    // Initial counter update
    updateCounter();
  }

  /**
   * Find existing error element for input
   *
   * @private
   * @param {HTMLElement} element - Input element
   * @returns {HTMLElement|null} Error element
   */
  static #findErrorElement(element) {
    const container = element.parentElement;
    if (!container) return null;

    // Look for error element by class or data attribute
    return container.querySelector(
      '.error-message, [data-error-for="' + element.id + '"]'
    );
  }

  /**
   * Create error element for input
   *
   * @private
   * @param {HTMLElement} element - Input element
   * @returns {HTMLElement} Created error element
   */
  static #createErrorElement(element) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.setAttribute('data-error-for', element.id);
    errorElement.style.display = 'none';

    // Insert after the input element
    element.parentElement.insertBefore(errorElement, element.nextSibling);

    return errorElement;
  }
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  /**
   * Title validation (5-300 characters)
   *
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  title: (value) => FormValidationHelper.validateTextInput(value, 5, 300),

  /**
   * Description validation (20-1500 characters)
   *
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  description: (value) =>
    FormValidationHelper.validateTextInput(value, 20, 1500),

  /**
   * Short text validation (10-600 characters)
   *
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  shortText: (value) => FormValidationHelper.validateTextInput(value, 10, 600),

  /**
   * Long text validation (10-6000 characters)
   *
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  longText: (value) => FormValidationHelper.validateTextInput(value, 10, 6000),

  /**
   * Concept validation (50-6000 characters)
   *
   * @param {string} value - Value to validate
   * @returns {{isValid: boolean, error?: string}} Validation result
   */
  concept: (value) => FormValidationHelper.validateTextInput(value, 50, 6000),
};

export default FormValidationHelper;
