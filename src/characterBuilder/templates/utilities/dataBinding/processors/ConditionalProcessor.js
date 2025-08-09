/**
 * @file Conditional Processor for template conditional rendering
 * @module characterBuilder/templates/utilities/dataBinding/processors/ConditionalProcessor
 * @description Handles tb-if, tb-else-if, tb-else, and tb-show directives
 */

import { validateDependency } from '../../../../../utils/index.js';

/**
 * Processes template conditional directives
 */
export class ConditionalProcessor {
  #evaluator;

  /**
   * @param {object} config - Processor configuration
   * @param {ExpressionEvaluator} config.evaluator - Expression evaluator
   */
  constructor(config) {
    validateDependency(config.evaluator, 'ExpressionEvaluator');
    this.#evaluator = config.evaluator;
  }

  /**
   * Process tb-if/tb-else-if/tb-else group
   *
   * @param {HTMLElement} element - Element with tb-if attribute
   * @param {object} context - Template context
   */
  processIfGroup(element, context) {
    // Find all elements in the conditional group
    const group = this.#findConditionalGroup(element);

    // Evaluate conditions and determine which element to show
    let shownElement = null;

    for (const item of group) {
      if (item.type === 'if' || item.type === 'else-if') {
        const condition = item.element.getAttribute(`tb-${item.type}`);
        if (this.#evaluateCondition(condition, context)) {
          shownElement = item.element;
          break;
        }
      } else if (item.type === 'else') {
        // Show else block if no previous condition was true
        shownElement = item.element;
        break;
      }
    }

    // Remove elements that should not be shown completely from DOM
    // This prevents any nested directives from being processed unnecessarily
    for (const item of group) {
      if (item.element !== shownElement) {
        // Remove the element completely
        item.element.remove();
      }
      // The shown element stays as-is
    }
  }

  /**
   * Process tb-show directive (visibility toggle)
   *
   * @param {HTMLElement} element - Element with tb-show attribute
   * @param {object} context - Template context
   */
  processShow(element, context) {
    const condition = element.getAttribute('tb-show');
    const show = this.#evaluateCondition(condition, context);

    if (show) {
      this.#showElement(element);
    } else {
      this.#hideElement(element);
    }
  }

  /**
   * Process tb-hide directive (inverse visibility toggle)
   *
   * @param {HTMLElement} element - Element with tb-hide attribute
   * @param {object} context - Template context
   */
  processHide(element, context) {
    const condition = element.getAttribute('tb-hide');
    const hide = this.#evaluateCondition(condition, context);

    if (hide) {
      this.#hideElement(element);
    } else {
      this.#showElement(element);
    }
  }

  /**
   * Find all elements in a conditional group
   *
   * @param startElement
   * @private
   */
  #findConditionalGroup(startElement) {
    const group = [];
    let current = startElement;

    // Add the starting if element
    group.push({
      type: 'if',
      element: current,
    });

    // Find subsequent else-if and else elements
    current = current.nextElementSibling;

    while (current) {
      if (current.hasAttribute('tb-else-if')) {
        group.push({
          type: 'else-if',
          element: current,
        });
        current = current.nextElementSibling;
      } else if (current.hasAttribute('tb-else')) {
        group.push({
          type: 'else',
          element: current,
        });
        break; // tb-else is always the last in a group
      } else {
        break; // End of conditional group
      }
    }

    return group;
  }

  /**
   * Evaluate a conditional expression
   *
   * @param condition
   * @param context
   * @private
   */
  #evaluateCondition(condition, context) {
    if (!condition) {
      return false;
    }

    try {
      const result = this.#evaluator.evaluate(condition, context);
      return this.#isTruthy(result);
    } catch (error) {
      console.warn(`Condition evaluation failed: ${condition}`, error);
      return false;
    }
  }

  /**
   * Check if value is truthy according to template logic
   *
   * @param value
   * @private
   */
  #isTruthy(value) {
    // Handle common falsy values
    if (value === null || value === undefined) return false;
    if (value === false || value === 0 || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value).length === 0)
      return false;

    return true;
  }

  /**
   * Hide element
   *
   * @param element
   * @private
   */
  #hideElement(element) {
    // Store original display style if not already stored
    if (!element.hasAttribute('data-original-display')) {
      // Use current inline style or default
      const originalDisplay = element.style.display || '';
      element.setAttribute('data-original-display', originalDisplay);
    }

    element.style.display = 'none';
  }

  /**
   * Show element
   *
   * @param element
   * @private
   */
  #showElement(element) {
    // Restore original display or use default
    const originalDisplay = element.getAttribute('data-original-display');

    if (originalDisplay && originalDisplay !== 'none') {
      element.style.display = originalDisplay;
    } else {
      element.style.display = '';
    }

    // Clean up the data attribute
    element.removeAttribute('data-original-display');
  }

  /**
   * Extract all conditional expressions from an element tree
   *
   * @param {HTMLElement} root - Root element to search
   * @returns {object[]} Array of conditional info
   */
  extractConditionals(root) {
    const conditionals = [];

    // Find all conditional elements
    const ifElements = root.querySelectorAll('[tb-if]');
    const elseIfElements = root.querySelectorAll('[tb-else-if]');
    const elseElements = root.querySelectorAll('[tb-else]');
    const showElements = root.querySelectorAll('[tb-show]');
    const hideElements = root.querySelectorAll('[tb-hide]');

    // Process tb-if elements
    ifElements.forEach((element) => {
      conditionals.push({
        type: 'if',
        element,
        expression: element.getAttribute('tb-if'),
      });
    });

    // Process tb-else-if elements
    elseIfElements.forEach((element) => {
      conditionals.push({
        type: 'else-if',
        element,
        expression: element.getAttribute('tb-else-if'),
      });
    });

    // Process tb-else elements
    elseElements.forEach((element) => {
      conditionals.push({
        type: 'else',
        element,
        expression: null, // tb-else has no condition
      });
    });

    // Process tb-show elements
    showElements.forEach((element) => {
      conditionals.push({
        type: 'show',
        element,
        expression: element.getAttribute('tb-show'),
      });
    });

    // Process tb-hide elements
    hideElements.forEach((element) => {
      conditionals.push({
        type: 'hide',
        element,
        expression: element.getAttribute('tb-hide'),
      });
    });

    return conditionals;
  }

  /**
   * Validate conditional expressions
   *
   * @param {HTMLElement} root - Root element to validate
   * @returns {object[]} Array of validation errors
   */
  validateConditionals(root) {
    const conditionals = this.extractConditionals(root);
    const errors = [];

    for (const conditional of conditionals) {
      // Skip tb-else as it has no expression
      if (conditional.type === 'else') {
        continue;
      }

      const { expression, type, element } = conditional;

      if (!expression) {
        errors.push({
          type,
          element,
          error: `Missing expression for tb-${type}`,
        });
        continue;
      }

      // Validate expression safety
      if (!this.#evaluator.isSafeExpression(expression)) {
        errors.push({
          type,
          element,
          expression,
          error: 'Unsafe expression detected',
        });
      }
    }

    // Validate conditional group structure
    const ifElements = root.querySelectorAll('[tb-if]');
    for (const ifElement of ifElements) {
      const groupErrors = this.#validateConditionalGroup(ifElement);
      errors.push(...groupErrors);
    }

    return errors;
  }

  /**
   * Validate structure of a conditional group
   *
   * @param ifElement
   * @private
   */
  #validateConditionalGroup(ifElement) {
    const errors = [];
    const group = this.#findConditionalGroup(ifElement);

    // Check for proper ordering
    let hasElse = false;

    for (let i = 0; i < group.length; i++) {
      const item = group[i];

      if (item.type === 'else') {
        hasElse = true;
        // tb-else must be last
        if (i !== group.length - 1) {
          errors.push({
            type: 'structure',
            element: item.element,
            error: 'tb-else must be the last element in a conditional group',
          });
        }
      } else if (item.type === 'else-if' && hasElse) {
        errors.push({
          type: 'structure',
          element: item.element,
          error: 'tb-else-if cannot come after tb-else',
        });
      }
    }

    return errors;
  }

  /**
   * Check if element has any conditional directives
   *
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if has conditionals
   */
  hasConditionals(element) {
    return (
      element.hasAttribute('tb-if') ||
      element.hasAttribute('tb-else-if') ||
      element.hasAttribute('tb-else') ||
      element.hasAttribute('tb-show') ||
      element.hasAttribute('tb-hide')
    );
  }
}
