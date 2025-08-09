/**
 * @file Enhanced Template Composer with Data Binding
 * @module characterBuilder/templates/utilities/EnhancedTemplateComposer
 * @description Integrates existing TemplateComposer with new DataBindingEngine
 */

import { TemplateComposer } from './templateComposer.js';
import { DataBindingEngine } from './dataBinding/DataBindingEngine.js';
import { HTMLSanitizer } from './dataBinding/HTMLSanitizer.js';
import { ExpressionEvaluator } from './dataBinding/ExpressionEvaluator.js';
import { TemplateEventManager } from './dataBinding/TemplateEventManager.js';
import { validateDependency } from '../../../utils/index.js';

/**
 * Enhanced template composer that combines basic composition with data binding
 */
export class EnhancedTemplateComposer {
  #templateComposer;
  #dataBindingEngine;
  #cleanupFunctions;
  #enableDataBinding;

  /**
   * @param {object} [config] - Composer configuration
   * @param {TemplateComposer} [config.templateComposer] - Template composer instance
   * @param {DataBindingEngine} [config.dataBindingEngine] - Data binding engine instance
   * @param {boolean} [config.enableDataBinding] - Enable data binding features (default: true)
   * @param {object} [config.composerConfig] - Config for TemplateComposer
   * @param {object} [config.bindingConfig] - Config for DataBindingEngine
   */
  constructor(config = {}) {
    // Initialize template composer
    this.#templateComposer =
      config.templateComposer || new TemplateComposer(config.composerConfig);

    // Initialize data binding if enabled
    this.#enableDataBinding = config.enableDataBinding !== false;

    if (this.#enableDataBinding) {
      this.#dataBindingEngine =
        config.dataBindingEngine ||
        new DataBindingEngine({
          sanitizer: new HTMLSanitizer(),
          evaluator: new ExpressionEvaluator(),
          eventManager: new TemplateEventManager(),
          templateComposer: this.#templateComposer,
          ...config.bindingConfig,
        });
    }

    // Track cleanup functions for event handlers
    this.#cleanupFunctions = new Map();

    validateDependency(this.#templateComposer, 'TemplateComposer');
  }

  /**
   * Render template with composition and data binding
   *
   * @param {string|Function|object} template - Template to render
   * @param {object} [context] - Template context
   * @param {object} [options] - Rendering options
   * @param {boolean} [options.disableDataBinding] - Disable data binding for this render
   * @param {boolean} [options.sanitize] - Sanitize HTML output (default: true)
   * @param {object} [options.filters] - Custom filters for interpolation
   * @param {string} [options.templateId] - Unique ID for cleanup tracking
   * @returns {{html: string, cleanup: Function}} Rendered HTML and cleanup function
   */
  render(template, context = {}, options = {}) {
    try {
      // Step 1: Apply data binding to slot content if data binding is enabled
      if (
        this.#enableDataBinding &&
        !options.disableDataBinding &&
        context.slots
      ) {
        context = {
          ...context,
          slots: this.#processDataBindingInSlots(
            context.slots,
            context,
            options
          ),
        };
      }

      // Step 2: Basic template composition (handles slots, nesting, basic ${})
      const composedHtml = this.#templateComposer.compose(template, context);

      // Step 3: Apply data binding if enabled and not disabled for this render
      if (this.#enableDataBinding && !options.disableDataBinding) {
        const bindingResult = this.#dataBindingEngine.bind(
          composedHtml,
          context,
          options
        );

        // Track cleanup function if template ID provided
        if (options.templateId) {
          this.#cleanupFunctions.set(options.templateId, bindingResult.cleanup);
        }

        return bindingResult;
      }

      // Return without data binding
      return {
        html: composedHtml,
        cleanup: () => {}, // No cleanup needed
      };
    } catch (error) {
      console.error('Template rendering failed:', error);
      throw error;
    }
  }

  /**
   * Process data binding within slot content
   *
   * @param slots
   * @param context
   * @param options
   * @private
   */
  #processDataBindingInSlots(slots, context, options) {
    const processedSlots = {};

    for (const [slotName, slotContent] of Object.entries(slots)) {
      if (typeof slotContent === 'string') {
        // Apply data binding to slot content first
        try {
          const boundSlot = this.#dataBindingEngine.bind(
            slotContent,
            context,
            options
          );

          // Then apply template composition to handle any template references
          let finalContent = boundSlot.html;
          if (finalContent.includes('<template')) {
            finalContent = this.#templateComposer.resolveNested(
              finalContent,
              context
            );
          }

          processedSlots[slotName] = finalContent;
        } catch (error) {
          console.warn(`Data binding failed for slot '${slotName}':`, error);
          processedSlots[slotName] = slotContent; // Fallback to original
        }
      } else {
        processedSlots[slotName] = slotContent;
      }
    }

    return processedSlots;
  }

  /**
   * Register a template for use in composition
   *
   * @param {string} name - Template name
   * @param {string|Function|object} template - Template content
   */
  registerTemplate(name, template) {
    this.#templateComposer.registerTemplate(name, template);
  }

  /**
   * Unregister a template
   *
   * @param {string} name - Template name
   */
  unregisterTemplate(name) {
    this.#templateComposer.unregisterTemplate(name);
  }

  /**
   * Check if template is registered
   *
   * @param {string} name - Template name
   * @returns {boolean} True if template exists
   */
  hasTemplate(name) {
    return this.#templateComposer.hasTemplate(name);
  }

  /**
   * Process slots in HTML
   *
   * @param {string} html - HTML with slot markers
   * @param {object|Map} slots - Slot content
   * @returns {string} HTML with processed slots
   */
  processSlots(html, slots) {
    return this.#templateComposer.processSlots(html, slots);
  }

  /**
   * Resolve nested template references
   *
   * @param {string} html - HTML with template references
   * @param {object} context - Template context
   * @returns {string} HTML with resolved templates
   */
  resolveNested(html, context) {
    return this.#templateComposer.resolveNested(html, context);
  }

  /**
   * Clear template composition cache
   */
  clearComposerCache() {
    this.#templateComposer.clearCache();
  }

  /**
   * Clear data binding cache
   */
  clearBindingCache() {
    if (this.#enableDataBinding && this.#dataBindingEngine) {
      // Clear expression evaluator cache through public API
      if (typeof this.#dataBindingEngine.clearCache === 'function') {
        this.#dataBindingEngine.clearCache();
      }
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.clearComposerCache();
    this.clearBindingCache();
  }

  /**
   * Cleanup template by ID
   *
   * @param {string} templateId - Template ID used in render options
   * @returns {boolean} True if cleanup was performed
   */
  cleanup(templateId) {
    const cleanupFn = this.#cleanupFunctions.get(templateId);
    if (cleanupFn) {
      cleanupFn();
      this.#cleanupFunctions.delete(templateId);
      return true;
    }
    return false;
  }

  /**
   * Cleanup all templates
   */
  cleanupAll() {
    for (const [id, cleanupFn] of this.#cleanupFunctions.entries()) {
      try {
        cleanupFn();
      } catch (error) {
        console.error(`Cleanup failed for template ${id}:`, error);
      }
    }
    this.#cleanupFunctions.clear();

    // Clear all bindings in data binding engine
    if (this.#enableDataBinding && this.#dataBindingEngine) {
      this.#dataBindingEngine.clearBindings();
    }
  }

  /**
   * Add custom filter to expression evaluator
   *
   * @param {string} name - Filter name
   * @param {Function} filterFunction - Filter implementation
   */
  addFilter(name, filterFunction) {
    if (!this.#enableDataBinding) {
      console.warn('Data binding is disabled, cannot add filters');
      return;
    }

    // Access the evaluator through the binding engine
    // Note: This requires the evaluator to be accessible
    console.warn(
      'Filter addition not implemented - access to evaluator needed'
    );
  }

  /**
   * Validate template for potential issues
   *
   * @param {string} html - HTML template to validate
   * @returns {object[]} Array of validation issues
   */
  validateTemplate(html) {
    const issues = [];

    if (!this.#enableDataBinding) {
      return issues; // Basic validation only
    }

    // This would require access to the processors for validation
    console.info('Advanced template validation not fully implemented');

    return issues;
  }

  /**
   * Get rendering statistics
   *
   * @returns {object} Statistics about templates and bindings
   */
  getStats() {
    const stats = {
      templatesRegistered: this.#templateComposer.hasTemplate ? 'unknown' : 0,
      activeCleanups: this.#cleanupFunctions.size,
      dataBindingEnabled: this.#enableDataBinding,
    };

    if (this.#enableDataBinding && this.#dataBindingEngine) {
      // Add binding engine stats if available
      stats.bindingEngineStats = 'Available but not exposed';
    }

    return stats;
  }

  /**
   * Enable or disable data binding
   *
   * @param {boolean} enabled - Whether to enable data binding
   */
  setDataBindingEnabled(enabled) {
    if (enabled && !this.#dataBindingEngine) {
      // Initialize data binding engine if it wasn't created
      this.#dataBindingEngine = new DataBindingEngine({
        sanitizer: new HTMLSanitizer(),
        evaluator: new ExpressionEvaluator(),
        eventManager: new TemplateEventManager(),
        templateComposer: this.#templateComposer,
      });
    }

    this.#enableDataBinding = enabled;
  }

  /**
   * Check if data binding is enabled
   *
   * @returns {boolean} True if data binding is enabled
   */
  isDataBindingEnabled() {
    return this.#enableDataBinding;
  }

  /**
   * Create scoped context (delegated to binding engine)
   *
   * @param {object} parentContext - Parent context
   * @param {object} localContext - Local variables
   * @returns {object} Merged context
   */
  createScopedContext(parentContext, localContext) {
    if (this.#enableDataBinding && this.#dataBindingEngine) {
      return this.#dataBindingEngine.createScopedContext(
        parentContext,
        localContext
      );
    }

    // Fallback implementation
    return { ...parentContext, ...localContext };
  }
}
