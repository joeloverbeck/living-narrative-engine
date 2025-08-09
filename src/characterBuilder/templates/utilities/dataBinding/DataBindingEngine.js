/**
 * @file Data Binding Engine for template system
 * @module characterBuilder/templates/utilities/dataBinding/DataBindingEngine
 * @description Main orchestrator for all data binding operations including directives, expressions, and event handling
 */

import { validateDependency } from '../../../../utils/index.js';
import { InterpolationProcessor } from './processors/InterpolationProcessor.js';
import { ConditionalProcessor } from './processors/ConditionalProcessor.js';
import { ListProcessor } from './processors/ListProcessor.js';
import { EventBindingProcessor } from './processors/EventBindingProcessor.js';
import { HTMLSanitizer } from './HTMLSanitizer.js';
import { ExpressionEvaluator } from './ExpressionEvaluator.js';
import { TemplateEventManager } from './TemplateEventManager.js';

/**
 * Main data binding engine that processes templates with directives and bindings
 */
export class DataBindingEngine {
  #sanitizer;
  #evaluator;
  #eventManager;
  #interpolationProcessor;
  #conditionalProcessor;
  #listProcessor;
  #eventBindingProcessor;
  #processingDepth;
  #maxDepth;
  #templateComposer;

  /**
   * @param {object} config - Engine configuration
   * @param {HTMLSanitizer} [config.sanitizer] - HTML sanitizer instance
   * @param {ExpressionEvaluator} [config.evaluator] - Expression evaluator instance
   * @param {TemplateEventManager} [config.eventManager] - Event manager instance
   * @param {TemplateComposer} [config.templateComposer] - Template composer for nested templates
   * @param {number} [config.maxDepth] - Maximum processing depth (default: 10)
   */
  constructor(config = {}) {
    // Set up dependencies with defaults
    this.#sanitizer = config.sanitizer || new HTMLSanitizer();
    this.#evaluator = config.evaluator || new ExpressionEvaluator();
    this.#eventManager = config.eventManager || new TemplateEventManager();
    this.#templateComposer = config.templateComposer; // Optional

    validateDependency(this.#sanitizer, 'HTMLSanitizer');
    validateDependency(this.#evaluator, 'ExpressionEvaluator');
    validateDependency(this.#eventManager, 'TemplateEventManager');

    // Initialize processors
    this.#interpolationProcessor = new InterpolationProcessor({
      evaluator: this.#evaluator,
      sanitizer: this.#sanitizer,
    });

    this.#conditionalProcessor = new ConditionalProcessor({
      evaluator: this.#evaluator,
    });

    this.#listProcessor = new ListProcessor({
      evaluator: this.#evaluator,
      bindingEngine: this,
      templateComposer: this.#templateComposer,
    });

    this.#eventBindingProcessor = new EventBindingProcessor({
      evaluator: this.#evaluator,
      eventManager: this.#eventManager,
    });

    // Processing control
    this.#processingDepth = 0;
    this.#maxDepth = config.maxDepth || 10;
  }

  /**
   * Apply data binding to HTML template
   *
   * @param {string} html - HTML template with directives
   * @param {object} context - Data context for binding
   * @param {object} [options] - Binding options
   * @param {boolean} [options.sanitize] - Whether to sanitize output (default: true)
   * @param {object} [options.filters] - Custom filters for interpolation
   * @returns {{html: string, cleanup: Function}} Processed HTML and cleanup function
   */
  bind(html, context = {}, options = {}) {
    // Check recursion depth but allow deeper nesting for nested processing
    const maxDepth = options._isNestedProcessing
      ? this.#maxDepth + 5
      : this.#maxDepth;
    if (this.#processingDepth >= maxDepth) {
      const error = new Error(
        `Maximum binding depth (${maxDepth}) exceeded at depth ${this.#processingDepth}`
      );
      error.name = 'RecursionLimitError';
      throw error;
    }

    try {
      this.#processingDepth++;

      // Parse HTML into a processable format
      const doc = this.#parseHTML(html);

      // Process in order of precedence
      // 1. List rendering (tb-for) - must be first as it creates new elements with item contexts
      this.#processListDirectives(doc, context, options);

      // 2. Conditional rendering (tb-if, tb-else-if, tb-else, tb-show)
      this.#processConditionalDirectives(doc, context);

      // 3. Event bindings (tb-on:*)
      const eventCleanups = this.#processEventBindings(doc, context);

      // 4. Interpolation ({{...}}, {{{...}}})
      this.#processInterpolation(doc, context, options);

      // Convert back to HTML string
      let result = this.#serializeHTML(doc);

      // Final sanitization - this will handle escaping of dangerous content including interpolations
      if (options.sanitize !== false) {
        result = this.#sanitizer.sanitize(result);
      }

      // Create cleanup function
      const cleanup = () => {
        eventCleanups.forEach((fn) => fn());
      };

      return { html: result, cleanup };
    } finally {
      this.#processingDepth--;
    }
  }

  /**
   * Parse HTML string into a document fragment
   *
   * @param html
   * @private
   */
  #parseHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }

  /**
   * Serialize document fragment back to HTML string
   *
   * @param doc
   * @private
   */
  #serializeHTML(doc) {
    const div = document.createElement('div');
    div.appendChild(doc.cloneNode(true));
    return div.innerHTML;
  }

  /**
   * Process list directives (tb-for)
   *
   * @param doc
   * @param context
   * @param options
   * @private
   */
  #processListDirectives(doc, context, options) {
    // When called recursively (with _isNestedProcessing flag), process all tb-for
    // Otherwise, only process top-level tb-for directives
    const allForElements = doc.querySelectorAll('[tb-for]');

    if (options._isNestedProcessing) {
      // In nested processing, handle all tb-for directives
      allForElements.forEach((element) => {
        // Skip if element has already been processed/removed
        if (!element.parentNode) {
          return;
        }

        const processed = this.#listProcessor.process(
          element,
          context,
          options
        );
        if (processed !== null && processed !== undefined) {
          if (Array.isArray(processed) && processed.length > 0) {
            element.replaceWith(...processed);
          } else if (Array.isArray(processed) && processed.length === 0) {
            // Empty array - remove the element entirely
            element.remove();
          }
        }
      });
    } else {
      // In top-level processing, only process tb-for that don't have tb-for parents
      const topLevelForElements = [];

      allForElements.forEach((element) => {
        // Check if this element has a parent with tb-for
        let hasForParent = false;
        let parent = element.parentElement;

        while (parent) {
          if (parent.hasAttribute && parent.hasAttribute('tb-for')) {
            hasForParent = true;
            break;
          }
          parent = parent.parentElement;
        }

        // Only process if it doesn't have a tb-for parent
        if (!hasForParent) {
          topLevelForElements.push(element);
        }
      });

      topLevelForElements.forEach((element) => {
        // Skip if element has already been processed/removed
        if (!element.parentNode) {
          return;
        }

        const processed = this.#listProcessor.process(
          element,
          context,
          options
        );
        if (processed !== null && processed !== undefined) {
          if (Array.isArray(processed) && processed.length > 0) {
            element.replaceWith(...processed);
          } else if (Array.isArray(processed) && processed.length === 0) {
            // Empty array - remove the element entirely
            element.remove();
          }
        }
      });
    }
  }

  /**
   * Process conditional directives
   *
   * @param doc
   * @param context
   * @private
   */
  #processConditionalDirectives(doc, context) {
    // Process tb-if groups (tb-if, tb-else-if, tb-else)
    const ifElements = doc.querySelectorAll('[tb-if]');

    ifElements.forEach((element) => {
      this.#conditionalProcessor.processIfGroup(element, context);
    });

    // Process tb-show (visibility toggle)
    const showElements = doc.querySelectorAll('[tb-show]');

    showElements.forEach((element) => {
      this.#conditionalProcessor.processShow(element, context);
    });
  }

  /**
   * Process event bindings
   *
   * @param doc
   * @param context
   * @private
   * @returns {Function[]} Array of cleanup functions
   */
  #processEventBindings(doc, context) {
    const cleanups = [];
    const elements = doc.querySelectorAll(
      '[tb-on\\:click], [tb-on\\:change], [tb-on\\:input], [tb-on\\:submit], [tb-on\\:keydown], [tb-on\\:keyup], [tb-on\\:mouseenter], [tb-on\\:mouseleave], [tb-on\\:focus], [tb-on\\:blur]'
    );

    elements.forEach((element) => {
      const cleanup = this.#eventBindingProcessor.process(element, context);
      if (cleanup) {
        cleanups.push(cleanup);
      }
    });

    return cleanups;
  }

  /**
   * Process interpolation in text nodes and attributes
   *
   * @param doc
   * @param context
   * @param options
   * @private
   */
  #processInterpolation(doc, context, options) {
    // Process all text nodes
    const walker = document.createTreeWalker(
      doc,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    textNodes.forEach((node) => {
      const processed = this.#interpolationProcessor.processText(
        node.textContent,
        context,
        options
      );
      if (processed !== node.textContent) {
        // Check if it's safe HTML interpolation
        if (
          node.textContent.includes('{{{') &&
          node.textContent.includes('}}}')
        ) {
          // Replace with HTML
          const span = document.createElement('span');
          span.innerHTML = processed;
          node.replaceWith(...span.childNodes);
        } else {
          // Regular text replacement
          node.textContent = processed;
        }
      }
    });

    // Process attributes
    const elementsWithAttrs = doc.querySelectorAll('*');
    elementsWithAttrs.forEach((element) => {
      Array.from(element.attributes).forEach((attr) => {
        if (attr.value.includes('{{') || attr.value.includes('${')) {
          const processed = this.#interpolationProcessor.processText(
            attr.value,
            context,
            options
          );
          if (processed !== attr.value) {
            element.setAttribute(attr.name, processed);
          }
        }
      });
    });
  }

  /**
   * Create a scoped binding context
   *
   * @param {object} parentContext - Parent context
   * @param {object} localContext - Local variables to add
   * @returns {object} Merged context
   */
  createScopedContext(parentContext, localContext) {
    return { ...parentContext, ...localContext };
  }

  /**
   * Clear expression cache
   */
  clearCache() {
    if (this.#evaluator && typeof this.#evaluator.clearCache === 'function') {
      this.#evaluator.clearCache();
    }
  }

  /**
   * Clear all event bindings
   */
  clearBindings() {
    this.#eventManager.clearAll();
  }
}
