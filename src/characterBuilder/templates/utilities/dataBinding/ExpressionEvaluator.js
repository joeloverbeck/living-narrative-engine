/**
 * @file Expression Evaluator for safe template expressions
 * @module characterBuilder/templates/utilities/dataBinding/ExpressionEvaluator
 * @description Safe evaluation of JavaScript expressions within templates with sandboxing
 */

/**
 * Safe expression evaluator for template binding
 */
export class ExpressionEvaluator {
  #allowedGlobals;
  #filters;
  #cache;
  #enableCache;

  /**
   * @param {object} [config] - Evaluator configuration
   * @param {Set<string>} [config.allowedGlobals] - Allowed global variables
   * @param {Map<string, Function>} [config.filters] - Template filters
   * @param {boolean} [config.enableCache] - Enable expression caching (default: true)
   */
  constructor(config = {}) {
    // Safe globals that can be accessed in expressions
    this.#allowedGlobals =
      config.allowedGlobals ||
      new Set([
        'Math',
        'Date',
        'parseInt',
        'parseFloat',
        'isNaN',
        'isFinite',
        'encodeURIComponent',
        'decodeURIComponent',
        'JSON',
      ]);

    // Built-in filters
    this.#filters =
      config.filters ||
      new Map([
        ['uppercase', (value) => String(value).toUpperCase()],
        ['lowercase', (value) => String(value).toLowerCase()],
        [
          'capitalize',
          (value) => {
            const str = String(value);
            return str.charAt(0).toUpperCase() + str.slice(1);
          },
        ],
        [
          'currency',
          (value) => {
            const num = parseFloat(value);
            return isNaN(num) ? value : `$${num.toFixed(2)}`;
          },
        ],
        [
          'date',
          (value, format = 'short') => {
            const date = new Date(value);
            if (isNaN(date.getTime())) return value;

            switch (format) {
              case 'short':
                return date.toLocaleDateString();
              case 'long':
                return date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
              case 'time':
                return date.toLocaleTimeString();
              default:
                return date.toLocaleDateString();
            }
          },
        ],
        ['json', (value) => JSON.stringify(value)],
        [
          'default',
          (value, defaultValue) => (value != null ? value : defaultValue),
        ],
      ]);

    // Expression caching
    this.#enableCache = config.enableCache !== false;
    this.#cache = this.#enableCache ? new Map() : null;
  }

  /**
   * Evaluate a JavaScript expression safely
   *
   * @param {string} expression - JavaScript expression to evaluate
   * @param {object} context - Data context
   * @returns {*} Evaluated result
   */
  evaluate(expression, context = {}) {
    if (!expression || typeof expression !== 'string') {
      return expression;
    }

    // Check cache
    const cacheKey = `${expression}:${this.#hashContext(context)}`;
    if (this.#cache && this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    try {
      const result = this.#safeEvaluate(expression.trim(), context);

      // Cache result
      if (this.#cache) {
        this.#cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.warn(`Expression evaluation failed: ${expression}`, error);
      return undefined;
    }
  }

  /**
   * Check if an expression is safe to evaluate
   *
   * @param {string} expression - Expression to check
   * @returns {boolean} True if safe
   */
  isSafeExpression(expression) {
    // Block dangerous patterns
    const dangerous = [
      /\beval\b/,
      /\bFunction\b/,
      /\bconstructor\b/,
      /\b__proto__\b/,
      /\bprototype\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocation\b/,
      /\bnavigator\b/,
      /\bhistory\b/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bprocess\b/,
      /\brequire\b/,
      /\bimport\b/,
      /\bexport\b/,
    ];

    return !dangerous.some((pattern) => pattern.test(expression));
  }

  /**
   * Add a custom filter
   *
   * @param {string} name - Filter name
   * @param {Function} filterFunction - Filter implementation
   */
  addFilter(name, filterFunction) {
    if (typeof filterFunction !== 'function') {
      throw new Error('Filter must be a function');
    }
    this.#filters.set(name, filterFunction);
  }

  /**
   * Apply filters to a value
   *
   * @param {*} value - Value to filter
   * @param {string[]} filterChain - Chain of filters
   * @returns {*} Filtered value
   */
  applyFilters(value, filterChain) {
    return filterChain.reduce((result, filterExpr) => {
      const [filterName, ...args] = filterExpr.split(':');
      const filter = this.#filters.get(filterName.trim());

      if (!filter) {
        console.warn(`Unknown filter: ${filterName}`);
        return result;
      }

      // Parse filter arguments
      const filterArgs = args.map((arg) => {
        const trimmed = arg.trim();
        // Simple argument parsing - numbers, booleans, strings
        if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);
        return trimmed;
      });

      try {
        return filter(result, ...filterArgs);
      } catch (error) {
        console.warn(`Filter '${filterName}' threw an error:`, error);
        return result; // Return unfiltered value on error
      }
    }, value);
  }

  /**
   * Clear the expression cache
   */
  clearCache() {
    if (this.#cache) {
      this.#cache.clear();
    }
  }

  /**
   * Safely evaluate expression with context
   *
   * @param expression
   * @param context
   * @private
   */
  #safeEvaluate(expression, context) {
    // Check if expression is safe
    if (!this.isSafeExpression(expression)) {
      throw new Error('Unsafe expression detected');
    }

    // Create sandboxed context
    const sandboxedContext = this.#createSandbox(context);

    // Try property access first for simple expressions
    if (this.#isSimplePropertyAccess(expression)) {
      const result = this.#evaluatePropertyAccess(expression, sandboxedContext);
      if (result !== undefined) {
        return result;
      }
    }

    // Use Function constructor to create evaluator for complex expressions
    // This is safer than eval as it doesn't have access to local scope
    try {
      // Filter out parameters that are forbidden in strict mode
      const contextKeys = Object.keys(sandboxedContext).filter(
        (key) => key !== 'eval' && key !== 'arguments' && key !== 'undefined'
      );
      const contextValues = contextKeys.map((key) => sandboxedContext[key]);

      const func = new Function(
        ...contextKeys,
        `"use strict"; return (${expression});`
      );

      return func(...contextValues);
    } catch (error) {
      // Fallback to property access if Function constructor fails
      const fallbackResult = this.#evaluatePropertyAccess(
        expression,
        sandboxedContext
      );
      if (fallbackResult !== undefined) {
        return fallbackResult;
      }

      // If both methods fail, return undefined instead of throwing
      console.warn(`Expression evaluation failed for: ${expression}`, error);
      return undefined;
    }
  }

  /**
   * Create sandboxed execution context
   *
   * @param context
   * @private
   */
  #createSandbox(context) {
    const sandbox = { ...context };

    // Add safe globals
    this.#allowedGlobals.forEach((global) => {
      if (typeof window !== 'undefined' && global in window) {
        sandbox[global] = window[global];
      }
    });

    // Block access to dangerous properties
    sandbox.window = undefined;
    sandbox.document = undefined;
    sandbox.location = undefined;
    sandbox.navigator = undefined;
    sandbox.history = undefined;
    sandbox.localStorage = undefined;
    sandbox.sessionStorage = undefined;
    sandbox.eval = undefined;
    sandbox.Function = undefined;
    sandbox.constructor = undefined;
    sandbox.__proto__ = undefined;
    sandbox.prototype = undefined;

    return sandbox;
  }

  /**
   * Check if expression is simple property access
   *
   * @param expression
   * @private
   */
  #isSimplePropertyAccess(expression) {
    // Simple property access patterns:
    // - single identifier: "name"
    // - dot notation: "user.name", "products.length"
    // - array access: "items[0]", "user.items[index]"
    // Exclude complex expressions with operators, function calls, etc.
    // Note: Expressions with operators like >, <, ===, etc. should go through Function constructor
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\w+\])*$/.test(
      expression.trim()
    );
  }

  /**
   * Evaluate property access expressions
   *
   * @param expression
   * @param context
   * @private
   */
  #evaluatePropertyAccess(expression, context) {
    if (!expression || typeof expression !== 'string') {
      return undefined;
    }

    const trimmed = expression.trim();
    const parts = trimmed.split('.');
    let value = context;

    for (const part of parts) {
      if (value == null) return undefined;

      // Handle array access like "items[0]" or "user[key]"
      if (part.includes('[') && part.includes(']')) {
        const [prop, indexPart] = part.split('[');
        const index = indexPart.replace(']', '');

        // Access the property first if there is one
        if (prop) {
          value = value[prop];
          if (value == null) return undefined;
        }

        // Handle the index
        let indexValue;
        if (/^\d+$/.test(index)) {
          // Numeric index
          indexValue = parseInt(index);
        } else if (/^["'].*["']$/.test(index)) {
          // String literal index
          indexValue = index.slice(1, -1);
        } else {
          // Variable index - look it up in context
          indexValue = this.#evaluatePropertyAccess(index, context);
        }

        value = value[indexValue];
      } else {
        // Simple property access
        value = value[part];
      }
    }

    return value;
  }

  /**
   * Hash context for caching
   *
   * @param context
   * @private
   */
  #hashContext(context) {
    try {
      const str = JSON.stringify(context, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value === undefined) return '[Undefined]';
        return value;
      });

      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch {
      return 'unhashable';
    }
  }
}
