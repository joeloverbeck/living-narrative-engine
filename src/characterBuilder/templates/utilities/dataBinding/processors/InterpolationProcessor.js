/**
 * @file Interpolation Processor for template variable interpolation
 * @module characterBuilder/templates/utilities/dataBinding/processors/InterpolationProcessor
 * @description Handles {{ }} and {{{ }}} interpolation with filters and safe output
 */

import { validateDependency } from '../../../../../utils/index.js';

/**
 * Processes template interpolation expressions
 */
export class InterpolationProcessor {
  #evaluator;
  #sanitizer;

  /**
   * @param {object} config - Processor configuration
   * @param {ExpressionEvaluator} config.evaluator - Expression evaluator
   * @param {HTMLSanitizer} config.sanitizer - HTML sanitizer
   */
  constructor(config) {
    validateDependency(config.evaluator, 'ExpressionEvaluator');
    validateDependency(config.sanitizer, 'HTMLSanitizer');

    this.#evaluator = config.evaluator;
    this.#sanitizer = config.sanitizer;
  }

  /**
   * Process text content for interpolations
   *
   * @param {string} text - Text to process
   * @param {object} context - Template context
   * @param {object} [options] - Processing options
   * @param {object} [options.filters] - Custom filters
   * @returns {string} Processed text
   */
  processText(text, context, options = {}) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }

    let processed = text;

    // Process HTML interpolations first {{{ }}}
    processed = this.#processHtmlInterpolations(processed, context, options);

    // Process safe interpolations {{ }}
    processed = this.#processSafeInterpolations(processed, context, options);

    // Process legacy ${} interpolations for backward compatibility
    processed = this.#processLegacyInterpolations(processed, context);

    return processed;
  }

  /**
   * Process HTML interpolations {{{ }}} - unescaped output
   *
   * @param text
   * @param context
   * @param options
   * @private
   */
  #processHtmlInterpolations(text, context, options) {
    return text.replace(/\{\{\{([^}]+)\}\}\}/g, (match, expression) => {
      try {
        const result = this.#evaluateWithFilters(expression, context, options);

        // Return raw HTML (already sanitized by HTMLSanitizer)
        return result != null ? String(result) : '';
      } catch (error) {
        console.warn(`HTML interpolation failed: ${expression}`, error);
        return match; // Return original on error
      }
    });
  }

  /**
   * Process safe interpolations {{ }} - escaped output
   *
   * @param text
   * @param context
   * @param options
   * @private
   */
  #processSafeInterpolations(text, context, options) {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const result = this.#evaluateWithFilters(expression, context, options);

        // For safe interpolations, sanitize dangerous patterns but don't escape yet
        // Escaping will happen during final document sanitization
        const stringResult = result != null ? String(result) : '';
        return this.#sanitizer.sanitizeText(stringResult);
      } catch (error) {
        console.warn(`Safe interpolation failed: ${expression}`, error);
        return match; // Return original on error
      }
    });
  }

  /**
   * Process legacy ${} interpolations for backward compatibility
   *
   * @param text
   * @param context
   * @private
   */
  #processLegacyInterpolations(text, context) {
    return text.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        const result = this.#evaluator.evaluate(expression, context);
        return result != null ? String(result) : match;
      } catch (error) {
        console.warn(`Legacy interpolation failed: ${expression}`, error);
        return match;
      }
    });
  }

  /**
   * Evaluate expression with filter support
   *
   * @param expression
   * @param context
   * @param options
   * @private
   */
  #evaluateWithFilters(expression, context, options) {
    const trimmed = expression.trim();

    // Check if expression has filters
    if (trimmed.includes('|')) {
      return this.#processFilters(trimmed, context, options);
    }

    // Simple expression evaluation
    return this.#evaluator.evaluate(trimmed, context);
  }

  /**
   * Process expression with filters
   *
   * @param expression
   * @param context
   * @param options
   * @private
   */
  #processFilters(expression, context, options) {
    // Split expression and filters
    const parts = expression.split('|').map((part) => part.trim());
    const baseExpression = parts[0];
    const filters = parts.slice(1);

    // Evaluate base expression
    let result = this.#evaluator.evaluate(baseExpression, context);

    // Apply built-in filters
    if (filters.length > 0) {
      result = this.#evaluator.applyFilters(result, filters);
    }

    // Apply custom filters if provided
    if (options.filters && typeof options.filters === 'object') {
      result = this.#applyCustomFilters(result, filters, options.filters);
    }

    return result;
  }

  /**
   * Apply custom filters
   *
   * @param value
   * @param filterChain
   * @param customFilters
   * @private
   */
  #applyCustomFilters(value, filterChain, customFilters) {
    return filterChain.reduce((result, filterExpr) => {
      const [filterName, ...args] = filterExpr.split(':');
      const filter = customFilters[filterName.trim()];

      if (typeof filter === 'function') {
        try {
          // Parse filter arguments
          const filterArgs = args.map((arg) => {
            const trimmed = arg.trim();
            // Simple argument parsing
            if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
            if (trimmed === 'true') return true;
            if (trimmed === 'false') return false;
            if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);
            return trimmed;
          });

          return filter(result, ...filterArgs);
        } catch (error) {
          console.warn(`Custom filter error: ${filterName}`, error);
          return result;
        }
      }

      return result;
    }, value);
  }

  /**
   * Extract all interpolation expressions from text
   *
   * @param {string} text - Text to analyze
   * @returns {object[]} Array of expression info
   */
  extractExpressions(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const expressions = [];

    // HTML interpolations
    const htmlMatches = text.matchAll(/\{\{\{([^}]+)\}\}\}/g);
    for (const match of htmlMatches) {
      expressions.push({
        type: 'html',
        expression: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
      });
    }

    // Safe interpolations
    const safeMatches = text.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of safeMatches) {
      expressions.push({
        type: 'safe',
        expression: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
      });
    }

    // Legacy interpolations
    const legacyMatches = text.matchAll(/\$\{([^}]+)\}/g);
    for (const match of legacyMatches) {
      expressions.push({
        type: 'legacy',
        expression: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
      });
    }

    return expressions.sort((a, b) => a.start - b.start);
  }

  /**
   * Validate interpolation expressions in text
   *
   * @param {string} text - Text to validate
   * @returns {object[]} Array of validation errors
   */
  validateExpressions(text) {
    const expressions = this.extractExpressions(text);
    const errors = [];

    for (const expr of expressions) {
      if (!this.#evaluator.isSafeExpression(expr.expression)) {
        errors.push({
          expression: expr.expression,
          type: expr.type,
          position: expr.start,
          error: 'Unsafe expression detected',
        });
      }

      // Check for common syntax errors
      if (expr.expression.includes('..')) {
        errors.push({
          expression: expr.expression,
          type: expr.type,
          position: expr.start,
          error: 'Invalid property access (..) detected',
        });
      }

      if (expr.expression.includes('||') || expr.expression.includes('&&')) {
        // These are valid but might be complex - just warn
        console.info(`Complex expression detected: ${expr.expression}`);
      }
    }

    return errors;
  }

  /**
   * Check if text contains any interpolations
   *
   * @param {string} text - Text to check
   * @returns {boolean} True if contains interpolations
   */
  hasInterpolations(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    return /\{\{.*?\}\}|\{\{\{.*?\}\}\}|\$\{.*?\}/.test(text);
  }
}
