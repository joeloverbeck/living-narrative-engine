/**
 * @file List Processor for template list rendering
 * @module characterBuilder/templates/utilities/dataBinding/processors/ListProcessor
 * @description Handles tb-for directive for iterating over arrays and objects
 */

import { validateDependency } from '../../../../../utils/index.js';

/**
 * Processes template list rendering directives
 */
export class ListProcessor {
  #evaluator;
  #bindingEngine;
  #templateComposer;
  #keyAttribute;

  /**
   * @param {object} config - Processor configuration
   * @param {ExpressionEvaluator} config.evaluator - Expression evaluator
   * @param {DataBindingEngine} config.bindingEngine - Binding engine for recursive processing
   * @param {TemplateComposer} [config.templateComposer] - Template composer for nested templates
   */
  constructor(config) {
    validateDependency(config.evaluator, 'ExpressionEvaluator');
    validateDependency(config.bindingEngine, 'DataBindingEngine');

    this.#evaluator = config.evaluator;
    this.#bindingEngine = config.bindingEngine;
    this.#templateComposer = config.templateComposer; // Optional
    this.#keyAttribute = 'tb-key'; // For efficient updates
  }

  /**
   * Process tb-for directive
   *
   * @param {HTMLElement} element - Element with tb-for attribute
   * @param {object} context - Template context
   * @param {object} [options] - Processing options
   * @returns {HTMLElement[]} Array of rendered elements
   */
  process(element, context, options = {}) {
    const forExpression = element.getAttribute('tb-for');
    const keyExpression = element.getAttribute(this.#keyAttribute);

    if (!forExpression) {
      console.warn('tb-for directive found without expression');
      return null;
    }

    try {
      // Parse the for expression
      const parsed = this.#parseForExpression(forExpression);
      if (!parsed) {
        throw new Error(`Invalid tb-for expression: ${forExpression}`);
      }

      // Evaluate the collection
      const collection = this.#evaluator.evaluate(parsed.collection, context);
      if (!this.#isIterable(collection)) {
        console.warn(`tb-for collection is not iterable: ${parsed.collection}`);
        return [];
      }

      // Generate elements for each item
      const elements = this.#renderItems(
        element,
        collection,
        parsed,
        keyExpression,
        context,
        options
      );

      return elements;
    } catch (error) {
      // Re-throw recursion limit errors as they indicate a serious issue
      if (error.name === 'RecursionLimitError') {
        throw error;
      }

      console.error(`List processing failed: ${forExpression}`, error);
      return null;
    }
  }

  /**
   * Parse tb-for expression
   *
   * @param expression
   * @private
   */
  #parseForExpression(expression) {
    // Patterns to match:
    // "item in items"
    // "(item, index) in items"
    // "(value, key) in object"

    const patterns = [
      // (item, index) in collection
      /^\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s+in\s+(.+)$/,
      // item in collection
      /^\s*([^,\s]+)\s+in\s+(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = expression.match(pattern);
      if (match) {
        if (match.length === 4) {
          // (item, index) format
          return {
            item: match[1].trim(),
            index: match[2].trim(),
            collection: match[3].trim(),
          };
        } else {
          // item format
          return {
            item: match[1].trim(),
            index: null,
            collection: match[2].trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if value is iterable
   *
   * @param value
   * @private
   */
  #isIterable(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return true;
    if (typeof value === 'object') return true;
    if (typeof value === 'string') return true;
    return false;
  }

  /**
   * Render items from collection
   *
   * @param templateElement
   * @param collection
   * @param parsed
   * @param keyExpression
   * @param context
   * @param options
   * @private
   */
  #renderItems(
    templateElement,
    collection,
    parsed,
    keyExpression,
    context,
    options
  ) {
    const elements = [];
    const items = this.#normalizeCollection(collection);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Create scoped context for this item
      const itemContext = this.#createItemContext(
        context,
        item,
        i,
        parsed,
        collection
      );

      // Clone template element
      const clonedElement = this.#cloneTemplateElement(templateElement);

      // Set key if provided
      if (keyExpression) {
        const key = this.#evaluator.evaluate(keyExpression, itemContext);
        if (key !== null && key !== undefined) {
          clonedElement.setAttribute('data-list-key', String(key));
        }
      } else {
        // Use index as fallback key
        clonedElement.setAttribute('data-list-key', String(i));
      }

      // Process template references with item context BEFORE data binding
      let elementHtml = clonedElement.outerHTML;
      if (this.#templateComposer && elementHtml.includes('<template')) {
        elementHtml = this.#processTemplateReferences(elementHtml, itemContext);
      }

      // We need to call DataBindingEngine.bind to handle nested tb-for and other directives
      // But we need to be careful to avoid infinite loops
      // Pass the full item context including parent context and loop variables
      const processedHtml = this.#bindingEngine.bind(elementHtml, itemContext, {
        ...options,
        _isNestedProcessing: true,
      });

      // Parse back to element using appropriate container for special HTML elements
      const processedElement = this.#parseHTMLToElement(processedHtml.html);

      if (processedElement) {
        elements.push(processedElement);
      }
    }

    return elements;
  }

  /**
   * Normalize collection to array of items with metadata
   *
   * @param collection
   * @private
   */
  #normalizeCollection(collection) {
    if (Array.isArray(collection)) {
      return collection.map((value, index) => ({
        value,
        index,
        key: index,
        isFirst: index === 0,
        isLast: index === collection.length - 1,
        isEven: index % 2 === 0,
        isOdd: index % 2 === 1,
      }));
    }

    if (typeof collection === 'object' && collection !== null) {
      const entries = Object.entries(collection);
      return entries.map(([key, value], index) => ({
        value,
        index,
        key,
        isFirst: index === 0,
        isLast: index === entries.length - 1,
        isEven: index % 2 === 0,
        isOdd: index % 2 === 1,
      }));
    }

    if (typeof collection === 'string') {
      return collection.split('').map((value, index) => ({
        value,
        index,
        key: index,
        isFirst: index === 0,
        isLast: index === collection.length - 1,
        isEven: index % 2 === 0,
        isOdd: index % 2 === 1,
      }));
    }

    return [];
  }

  /**
   * Create context for item rendering
   *
   * @param parentContext
   * @param item
   * @param index
   * @param parsed
   * @param originalCollection
   * @private
   */
  #createItemContext(parentContext, item, index, parsed, originalCollection) {
    // Create a new context that properly inherits from parent
    // This ensures all parent properties are available including functions
    const itemContext = Object.create(parentContext);

    // Copy all enumerable properties from parent context
    Object.keys(parentContext).forEach((key) => {
      itemContext[key] = parentContext[key];
    });

    // Add item variables
    itemContext[parsed.item] = item.value;

    if (parsed.index) {
      // Could be index or key depending on collection type
      if (
        Array.isArray(originalCollection) ||
        typeof originalCollection === 'string'
      ) {
        itemContext[parsed.index] = item.index;
      } else {
        itemContext[parsed.index] = item.key;
      }
    }

    // Add loop metadata
    itemContext.$index = item.index;
    itemContext.$key = item.key;
    itemContext.$first = item.isFirst;
    itemContext.$last = item.isLast;
    itemContext.$even = item.isEven;
    itemContext.$odd = item.isOdd;

    return itemContext;
  }

  /**
   * Clone template element and clean up directives
   *
   * @param element
   * @private
   */
  #cloneTemplateElement(element) {
    const cloned = element.cloneNode(true);

    // Remove tb-for directive from clone to prevent infinite recursion
    cloned.removeAttribute('tb-for');

    // Also remove tb-key since it's been processed
    cloned.removeAttribute(this.#keyAttribute);

    return cloned;
  }

  /**
   * Process template references in HTML with item-specific context
   *
   * @param {string} html - HTML containing template references
   * @param {object} itemContext - Context for this specific item
   * @returns {string} HTML with resolved template references
   * @private
   */
  #processTemplateReferences(html, itemContext) {
    if (!this.#templateComposer) {
      return html; // No template composer available
    }

    try {
      // First, evaluate any context JSON expressions before passing to template composer
      let processedHtml = this.#evaluateContextExpressions(html, itemContext);

      // Use the template composer to resolve nested templates with item context
      return this.#templateComposer.resolveNested(processedHtml, itemContext);
    } catch (error) {
      console.warn('Template reference resolution failed in list item:', error);
      return html; // Return original HTML on error
    }
  }

  /**
   * Evaluate context JSON expressions in template references
   * This handles cases like context='{"product": product}' where product is a variable
   *
   * @param {string} html - HTML with template references
   * @param {object} itemContext - Context for evaluation
   * @returns {string} HTML with evaluated context expressions
   * @private
   */
  #evaluateContextExpressions(html, itemContext) {
    // Match template elements with context attributes - both self-closing and regular
    return html.replace(
      /<template\s+ref\s*=\s*["']([^"']+)["']\s+context\s*=\s*['"]([^'"]+)['"](?:\s+[^>]*)?(?:\/>|>\s*<\/template>)/gi,
      (match, templateRef, contextJson) => {
        try {
          // Decode HTML entities in context JSON
          const decodedJson = contextJson
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

          // Parse the JSON, but treat unquoted values as expressions to evaluate
          const evaluatedContext = this.#evaluateContextJson(
            decodedJson,
            itemContext
          );
          const evaluatedJson = JSON.stringify(evaluatedContext);

          // Return template element with evaluated context
          return `<template ref="${templateRef}" context='${evaluatedJson}' />`;
        } catch (error) {
          console.warn(
            `Context evaluation failed for template ${templateRef}:`,
            error
          );
          return match; // Return original on error
        }
      }
    );
  }

  /**
   * Parse and evaluate context JSON with variable resolution
   *
   * @param {string} contextJson - JSON string with possible variable references
   * @param {object} itemContext - Context for variable evaluation
   * @returns {object} Evaluated context object
   * @private
   */
  #evaluateContextJson(contextJson, itemContext) {
    // This is a simple parser for JSON-like syntax that allows unquoted variable names
    // It converts {"key": variable} to {"key": evaluatedValue}

    try {
      // First try parsing as normal JSON
      return JSON.parse(contextJson);
    } catch (e) {
      // If normal JSON parsing fails, it might contain unquoted variables
      // Convert unquoted identifiers to evaluated values
      let processedJson = contextJson;

      // Find patterns like "key": identifier and replace identifier with evaluated value
      // Also handle cases with commas: "key1": var1, "key2": var2
      // Updated regex to handle nested property access like product.name
      processedJson = processedJson.replace(
        /"([^"]+)":\s*([a-zA-Z_$][a-zA-Z0-9_$.[\]()]*)(?=\s*[,}])/g,
        (match, key, identifier) => {
          try {
            const value = this.#evaluator.evaluate(identifier, itemContext);
            // Handle functions by converting them to a marker that can be parsed later
            if (typeof value === 'function') {
              return `"${key}": "__FUNCTION__${identifier}__"`;
            }
            return `"${key}": ${JSON.stringify(value)}`;
          } catch (err) {
            console.warn(
              `Failed to evaluate context variable ${identifier}:`,
              err
            );
            return `"${key}": null`;
          }
        }
      );

      // Parse the JSON first
      let parsed = JSON.parse(processedJson);

      // Convert function markers back to actual functions
      for (const [key, value] of Object.entries(parsed)) {
        if (
          typeof value === 'string' &&
          value.startsWith('__FUNCTION__') &&
          value.endsWith('__')
        ) {
          const functionName = value.slice(12, -2); // Remove __FUNCTION__ and __
          const functionValue = this.#evaluator.evaluate(
            functionName,
            itemContext
          );
          if (typeof functionValue === 'function') {
            parsed[key] = functionValue;
          }
        }
      }

      return parsed;
    }
  }

  /**
   * Extract all list expressions from an element tree
   *
   * @param {HTMLElement} root - Root element to search
   * @returns {object[]} Array of list info
   */
  extractLists(root) {
    const lists = [];
    const forElements = root.querySelectorAll('[tb-for]');

    forElements.forEach((element) => {
      const forExpression = element.getAttribute('tb-for');
      const keyExpression = element.getAttribute(this.#keyAttribute);

      lists.push({
        element,
        expression: forExpression,
        keyExpression,
        parsed: this.#parseForExpression(forExpression),
      });
    });

    return lists;
  }

  /**
   * Validate list expressions
   *
   * @param {HTMLElement} root - Root element to validate
   * @returns {object[]} Array of validation errors
   */
  validateLists(root) {
    const lists = this.extractLists(root);
    const errors = [];

    for (const list of lists) {
      const { element, expression, keyExpression, parsed } = list;

      if (!expression) {
        errors.push({
          element,
          error: 'Missing tb-for expression',
        });
        continue;
      }

      if (!parsed) {
        errors.push({
          element,
          expression,
          error: 'Invalid tb-for expression syntax',
        });
        continue;
      }

      // Validate collection expression
      if (!this.#evaluator.isSafeExpression(parsed.collection)) {
        errors.push({
          element,
          expression: parsed.collection,
          error: 'Unsafe collection expression',
        });
      }

      // Validate key expression if present
      if (keyExpression && !this.#evaluator.isSafeExpression(keyExpression)) {
        errors.push({
          element,
          expression: keyExpression,
          error: 'Unsafe key expression',
        });
      }

      // Check for nested tb-for (potential performance issue)
      const nestedFor = element.querySelectorAll('[tb-for]');
      if (nestedFor.length > 0) {
        console.warn(
          'Nested tb-for detected - may impact performance',
          element
        );
      }
    }

    return errors;
  }

  /**
   * Check if element has list directives
   *
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if has list directives
   */
  hasListDirectives(element) {
    return element.hasAttribute('tb-for');
  }

  /**
   * Process element directives without recursive DataBindingEngine calls
   * This prevents infinite recursion when processing list items
   *
   * @param {string} html - HTML to process
   * @param {object} itemContext - Context for this item
   * @param {object} options - Processing options
   * @returns {{html: string, cleanup: Function}} Processed HTML and cleanup function
   * @private
   */
  #processElementDirectives(html, itemContext, options) {
    const cleanupFunctions = [];

    try {
      // Parse HTML
      const doc = this.#parseHTML(html);

      // Process conditional directives (tb-if, tb-show) - no recursion risk here
      this.#processConditionals(doc, itemContext);

      // Process interpolation manually
      this.#processInterpolation(doc, itemContext, options);

      // Serialize back to HTML
      const processedHtml = this.#serializeHTML(doc);

      return {
        html: processedHtml,
        cleanup: () => cleanupFunctions.forEach((fn) => fn()),
      };
    } catch (error) {
      console.error('Element directive processing failed:', error);
      return { html, cleanup: () => {} };
    }
  }

  /**
   * Parse HTML string into document fragment
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
   * Process conditional directives in a document fragment
   *
   * @param doc
   * @param context
   * @private
   */
  #processConditionals(doc, context) {
    // Process tb-if elements
    const ifElements = doc.querySelectorAll('[tb-if]');
    ifElements.forEach((element) => {
      const condition = element.getAttribute('tb-if');
      try {
        const result = this.#evaluator.evaluate(condition, context);
        if (!result) {
          element.style.display = 'none';
        }
      } catch (error) {
        console.warn(`tb-if evaluation failed: ${condition}`, error);
        element.style.display = 'none';
      }
    });

    // Process tb-show elements
    const showElements = doc.querySelectorAll('[tb-show]');
    showElements.forEach((element) => {
      const condition = element.getAttribute('tb-show');
      try {
        const result = this.#evaluator.evaluate(condition, context);
        if (!result) {
          element.style.display = 'none';
        }
      } catch (error) {
        console.warn(`tb-show evaluation failed: ${condition}`, error);
        element.style.display = 'none';
      }
    });
  }

  /**
   * Process interpolation in document fragment
   *
   * @param doc
   * @param context
   * @param options
   * @private
   */
  #processInterpolation(doc, context, options) {
    // Process text nodes
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
      const processed = this.#processInterpolationText(
        node.textContent,
        context,
        options
      );
      if (processed !== node.textContent) {
        node.textContent = processed;
      }
    });

    // Process attributes
    const elementsWithAttrs = doc.querySelectorAll('*');
    elementsWithAttrs.forEach((element) => {
      Array.from(element.attributes).forEach((attr) => {
        if (attr.value.includes('{{') || attr.value.includes('${')) {
          const processed = this.#processInterpolationText(
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
   * Process interpolation in text
   *
   * @param text
   * @param context
   * @param options
   * @private
   */
  #processInterpolationText(text, context, options) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }

    let processed = text;

    // Process {{ }} interpolations
    processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const result = this.#evaluateWithFilters(expression, context, options);
        return result != null ? String(result) : '';
      } catch (error) {
        console.warn(`Interpolation failed: ${expression}`, error);
        return match;
      }
    });

    // Process ${} interpolations for backward compatibility
    processed = processed.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        const result = this.#evaluator.evaluate(expression, context);
        return result != null ? String(result) : match;
      } catch (error) {
        console.warn(`Legacy interpolation failed: ${expression}`, error);
        return match;
      }
    });

    return processed;
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
      // Split expression and filters
      const parts = trimmed.split('|').map((part) => part.trim());
      const baseExpression = parts[0];
      const filters = parts.slice(1);

      // Evaluate base expression
      let result = this.#evaluator.evaluate(baseExpression, context);

      // Apply built-in filters
      if (filters.length > 0) {
        result = this.#evaluator.applyFilters(result, filters);
      }

      return result;
    }

    // Simple expression evaluation
    return this.#evaluator.evaluate(trimmed, context);
  }

  /**
   * Parse HTML string to element using appropriate container
   *
   * @param {string} html - HTML string to parse
   * @returns {HTMLElement|null} Parsed element or null
   * @private
   */
  #parseHTMLToElement(html) {
    if (!html || typeof html !== 'string') {
      return null;
    }

    const trimmedHtml = html.trim();

    // Determine the appropriate container based on the HTML content
    let container;

    // Check what type of element we're dealing with
    if (trimmedHtml.startsWith('<tr') || trimmedHtml.startsWith('<TR')) {
      // Table rows need to be in a tbody
      container = document.createElement('tbody');
    } else if (
      trimmedHtml.startsWith('<option') ||
      trimmedHtml.startsWith('<OPTION')
    ) {
      // Options can be parsed in a select
      container = document.createElement('select');
    } else if (
      trimmedHtml.startsWith('<td') ||
      trimmedHtml.startsWith('<TD') ||
      trimmedHtml.startsWith('<th') ||
      trimmedHtml.startsWith('<TH')
    ) {
      // Table cells need to be in a tr
      container = document.createElement('tr');
    } else if (
      trimmedHtml.startsWith('<tbody') ||
      trimmedHtml.startsWith('<TBODY') ||
      trimmedHtml.startsWith('<thead') ||
      trimmedHtml.startsWith('<THEAD') ||
      trimmedHtml.startsWith('<tfoot') ||
      trimmedHtml.startsWith('<TFOOT')
    ) {
      // Table sections need to be in a table
      container = document.createElement('table');
    } else if (trimmedHtml.startsWith('<li') || trimmedHtml.startsWith('<LI')) {
      // List items need to be in a list
      // Try to determine if it's ordered or unordered from context
      container = document.createElement('ul');
    } else if (
      trimmedHtml.startsWith('<col') ||
      trimmedHtml.startsWith('<COL')
    ) {
      // Column definitions need to be in a colgroup
      container = document.createElement('colgroup');
    } else {
      // Default container for general elements
      container = document.createElement('div');
    }

    // Parse the HTML
    container.innerHTML = trimmedHtml;

    // Return the first child element
    return container.firstElementChild;
  }

  /**
   * Update list items efficiently using keys
   *
   * @param {HTMLElement} container - Container with existing items
   * @param {HTMLElement[]} newElements - New elements to render
   */
  updateList(container, newElements) {
    const existingElements = Array.from(container.children);
    const newKeys = new Set(
      newElements.map((el) => el.getAttribute('data-list-key'))
    );

    // Remove elements that are no longer needed
    existingElements.forEach((element) => {
      const key = element.getAttribute('data-list-key');
      if (!newKeys.has(key)) {
        element.remove();
      }
    });

    // Add or update elements
    newElements.forEach((newElement, index) => {
      const key = newElement.getAttribute('data-list-key');
      const existing = container.querySelector(`[data-list-key="${key}"]`);

      if (existing) {
        // Update existing element
        if (existing.outerHTML !== newElement.outerHTML) {
          existing.replaceWith(newElement);
        }
      } else {
        // Add new element at correct position
        const nextSibling = container.children[index];
        if (nextSibling) {
          container.insertBefore(newElement, nextSibling);
        } else {
          container.appendChild(newElement);
        }
      }
    });
  }
}
