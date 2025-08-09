/**
 * @file Data Binding Module Exports
 * @module characterBuilder/templates/utilities/dataBinding
 * @description Exports for the complete data binding system
 */

// Core components
export { DataBindingEngine } from './DataBindingEngine.js';
export { HTMLSanitizer } from './HTMLSanitizer.js';
export { ExpressionEvaluator } from './ExpressionEvaluator.js';
export { TemplateEventManager } from './TemplateEventManager.js';

// Processors
export { InterpolationProcessor } from './processors/InterpolationProcessor.js';
export { ConditionalProcessor } from './processors/ConditionalProcessor.js';
export { ListProcessor } from './processors/ListProcessor.js';
export { EventBindingProcessor } from './processors/EventBindingProcessor.js';

/**
 * Create a complete data binding engine with all processors
 *
 * @param {object} [config] - Configuration options
 * @returns {DataBindingEngine} Configured binding engine
 */
export function createDataBindingEngine(config = {}) {
  return new DataBindingEngine(config);
}

/**
 * Create default configuration for data binding
 *
 * @returns {object} Default configuration
 */
export function createDefaultConfig() {
  return {
    sanitizer: null, // Will use default HTMLSanitizer
    evaluator: null, // Will use default ExpressionEvaluator
    eventManager: null, // Will use default TemplateEventManager
    maxDepth: 10,
    enableCache: true,
    validateOutput: true,
  };
}
