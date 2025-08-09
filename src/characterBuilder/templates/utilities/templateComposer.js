/**
 * @file Template Composition Engine
 * @module characterBuilder/templates/utilities/templateComposer
 * @description Handles nested template composition and slot-based content injection
 * 
 * NOTE: This is a standalone implementation that will be enhanced
 * when TemplateRegistry, TemplateCache, and TemplateValidator are
 * implemented in Phase 3 (HTMLTEMP-021 through HTMLTEMP-030)
 */

/**
 * Template Composition Engine
 * Handles nested template composition and slot-based content injection
 */
export class TemplateComposer {
  #templates;
  #enableCache;
  #validateOutput;
  #cache;
  #compositionDepth;
  #maxDepth;

  /**
   * @param {object} config - Composer configuration
   * @param {Map} [config.templates] - Optional template storage (will use TemplateRegistry in future)
   * @param {boolean} [config.enableCache] - Enable basic caching (will use TemplateCache in future)
   * @param {boolean} [config.validateOutput] - Enable basic validation (will use TemplateValidator in future)
   * @param {number} [config.maxDepth] - Maximum composition depth (default: 10)
   */
  constructor(config = {}) {
    // Temporary internal storage until TemplateRegistry is available
    this.#templates = config.templates || new Map();
    this.#enableCache = config.enableCache !== false;
    this.#validateOutput = config.validateOutput !== false;
    
    // Simple cache implementation until TemplateCache is available
    this.#cache = this.#enableCache ? new Map() : null;
    
    this.#compositionDepth = 0;
    this.#maxDepth = config.maxDepth || 10;
  }

  /**
   * Compose a template with nested templates and slots
   *
   * @param {string|Function|object} template - Template to compose
   * @param {object} context - Composition context
   * @returns {string} Composed HTML
   */
  compose(template, context = {}) {
    // Handle null/undefined/empty templates
    if (template === null || template === undefined || template === '') {
      return '';
    }

    // Check recursion depth
    if (this.#compositionDepth >= this.#maxDepth) {
      const error = new Error(
        `Maximum composition depth (${this.#maxDepth}) exceeded at depth ${this.#compositionDepth}`
      );
      error.name = 'RecursionLimitError';
      error.depth = this.#compositionDepth;
      error.maxDepth = this.#maxDepth;
      throw error;
    }

    // Generate cache key if caching is enabled
    let cacheKey;
    if (this.#enableCache && this.#cache) {
      cacheKey = this.#generateCacheKey(template, context);
      const cached = this.#cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      this.#compositionDepth++;

      let html = '';

      // Handle different template types
      if (typeof template === 'string') {
        html = this.#processStringTemplate(template, context);
      } else if (typeof template === 'function') {
        html = template(context);
        // Process the result for nested templates and slots
        html = this.#processStringTemplate(html, context);
      } else if (template && typeof template === 'object') {
        if (typeof template.render === 'function') {
          html = template.render(context);
          // Process the result for nested templates and slots
          html = this.#processStringTemplate(html, context);
        } else {
          throw new Error('Template object must have a render method');
        }
      } else {
        throw new Error('Invalid template type');
      }

      // Process slots if context contains slot data
      if (context.slots) {
        html = this.processSlots(html, context.slots);
      }

      // Basic validation if enabled
      if (this.#validateOutput) {
        this.#validateHTML(html);
      }

      // Cache the result
      if (this.#enableCache && this.#cache && cacheKey) {
        this.#cache.set(cacheKey, html);
      }

      return html;
    } finally {
      this.#compositionDepth--;
    }
  }

  /**
   * Process a string template with variable substitution and nested templates
   *
   * @private
   * @param {string} template - Template string
   * @param {object} context - Context for variable substitution
   * @returns {string} Processed template
   */
  #processStringTemplate(template, context) {
    if (!template) return '';

    let processed = template;

    // Process variable substitutions ${variable}
    processed = processed.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.#resolveVariable(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });

    // Process nested template references
    processed = this.resolveNested(processed, context);

    return processed;
  }

  /**
   * Resolve a variable path in the context
   *
   * @private
   * @param {string} path - Variable path (e.g., "user.name")
   * @param {object} context - Context object
   * @returns {*} Resolved value
   */
  #resolveVariable(path, context) {
    const parts = path.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Process slot content injection
   *
   * @param {string} html - HTML with slot markers
   * @param {object|Map} slots - Slot content map or SlotContentProvider
   * @returns {string} HTML with injected slot content
   */
  processSlots(html, slots = {}) {
    if (!html) return '';

    let processed = html;

    // Handle SlotContentProvider
    const getSlotContent = (name, fallback) => {
      if (slots && typeof slots.getSlot === 'function') {
        return slots.getSlot(name, fallback);
      } else if (slots instanceof Map) {
        return slots.get(name) || fallback;
      } else if (typeof slots === 'object') {
        return (name ? slots[name] : slots.default) || fallback;
      }
      return fallback;
    };

    // Process named slots: <slot name="header">fallback</slot>
    processed = processed.replace(
      /<slot\s+name\s*=\s*["']([^"']+)["'](?:\s+[^>]*)?>([^<]*(?:<(?!\/slot>)[^<]*)*)<\/slot>/gi,
      (match, name, fallback) => {
        const content = getSlotContent(name, fallback);
        return content || fallback || '';
      }
    );

    // Process named slots without fallback: <slot name="header"></slot> or self-closing
    processed = processed.replace(
      /<slot\s+name\s*=\s*["']([^"']+)["'](?:\s+[^>]*)?(?:\/?>|>\s*<\/slot>)/gi,
      (match, name) => {
        const content = getSlotContent(name, '');
        return content || '';
      }
    );

    // Process default slots: <slot>fallback</slot>
    processed = processed.replace(
      /<slot(?:\s+[^>]*)?>([^<]*(?:<(?!\/slot>)[^<]*)*)<\/slot>/gi,
      (match, fallback) => {
        const content = getSlotContent(null, fallback);
        return content || fallback || '';
      }
    );

    // Process default slots without fallback: <slot></slot> or self-closing
    processed = processed.replace(
      /<slot(?:\s+[^>]*)?(?:\/?>|>\s*<\/slot>)/gi,
      () => {
        const content = getSlotContent(null, '');
        return content || '';
      }
    );

    return processed;
  }

  /**
   * Resolve nested template references
   *
   * @param {string} html - HTML with template references
   * @param {object} context - Resolution context
   * @returns {string} HTML with resolved templates
   */
  resolveNested(html, context) {
    if (!html) return '';

    let processed = html;

    // Process template includes with context: <template ref="templateName" context='{"key":"value"}' />
    // Handle single quotes around JSON
    processed = processed.replace(
      /<template\s+ref\s*=\s*["']([^"']+)["']\s+context\s*=\s*'([^']+)'(?:\s+[^>]*)?\/>/gi,
      (match, templateRef, contextJson) => {
        const template = this.#templates.get(templateRef);
        if (template) {
          try {
            const localContext = JSON.parse(contextJson);
            const mergedContext = { ...context, ...localContext };
            return this.compose(template, mergedContext);
          } catch (e) {
            console.error(`Invalid context JSON for template ${templateRef}:`, e);
            return '';
          }
        }
        console.warn(`Template not found: ${templateRef}`);
        return '';
      }
    );
    
    // Also handle double quotes around JSON
    processed = processed.replace(
      /<template\s+ref\s*=\s*["']([^"']+)["']\s+context\s*=\s*"([^"]+)"(?:\s+[^>]*)?\/>/gi,
      (match, templateRef, contextJson) => {
        const template = this.#templates.get(templateRef);
        if (template) {
          try {
            const localContext = JSON.parse(contextJson);
            const mergedContext = { ...context, ...localContext };
            return this.compose(template, mergedContext);
          } catch (e) {
            console.error(`Invalid context JSON for template ${templateRef}:`, e);
            return '';
          }
        }
        console.warn(`Template not found: ${templateRef}`);
        return '';
      }
    );

    // Process template references: <template ref="templateName" />
    // This must come AFTER the context-specific patterns to avoid matching templates with context
    processed = processed.replace(
      /<template\s+ref\s*=\s*["']([^"']+)["'](?:\s+[^>]*)?\/>/gi,
      (match, templateRef) => {
        const template = this.#templates.get(templateRef);
        if (template) {
          return this.compose(template, context);
        }
        console.warn(`Template not found: ${templateRef}`);
        return '';
      }
    );

    return processed;
  }

  /**
   * Register a template for use in composition
   *
   * @param {string} name - Template name
   * @param {string|Function|object} template - Template content
   */
  registerTemplate(name, template) {
    if (!name) {
      throw new Error('Template name is required');
    }
    this.#templates.set(name, template);
  }

  /**
   * Unregister a template
   *
   * @param {string} name - Template name
   */
  unregisterTemplate(name) {
    this.#templates.delete(name);
  }

  /**
   * Check if a template is registered
   *
   * @param {string} name - Template name
   * @returns {boolean} True if template exists
   */
  hasTemplate(name) {
    return this.#templates.has(name);
  }

  /**
   * Clear all cached compositions
   */
  clearCache() {
    if (this.#cache) {
      this.#cache.clear();
    }
  }

  /**
   * Generate a cache key from template and context
   *
   * @private
   * @param {*} template - Template
   * @param {object} context - Context
   * @returns {string} Cache key
   */
  #generateCacheKey(template, context) {
    const templateId = 
      typeof template === 'string' ? template.substring(0, 100) :
      typeof template === 'function' ? template.name || 'anonymous' :
      template?.id || 'object';
    
    const contextHash = this.#hashObject(context);
    return `${templateId}:${contextHash}`;
  }

  /**
   * Simple hash function for objects
   *
   * @private
   * @param {object} obj - Object to hash
   * @returns {string} Hash string
   */
  #hashObject(obj) {
    try {
      const str = JSON.stringify(obj, (key, value) => {
        // Skip functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          return null;
        }
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          // Handle SlotContentProvider specially
          if (value.constructor && value.constructor.name === 'SlotContentProvider') {
            return { __type: 'SlotContentProvider', data: value.toObject ? value.toObject() : {} };
          }
          if (value instanceof Map) {
            return { __type: 'Map', entries: Array.from(value.entries()) };
          }
          if (value instanceof Set) {
            return { __type: 'Set', values: Array.from(value) };
          }
        }
        return value;
      });
      
      // Simple hash algorithm
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch (e) {
      // Fallback for unhashable objects
      return 'unhashable';
    }
  }

  /**
   * Basic HTML validation
   *
   * @private
   * @param {string} html - HTML to validate
   * @throws {Error} If HTML is invalid
   */
  #validateHTML(html) {
    // Basic validation - will be replaced by TemplateValidator in Phase 3
    if (!html) return;

    // Check for unclosed tags (basic check)
    const openTags = html.match(/<([a-z][a-z0-9]*)\b[^>]*(?<!\/\s*)>/gi) || [];
    const closeTags = html.match(/<\/([a-z][a-z0-9]*)\s*>/gi) || [];
    
    const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    
    const openCount = {};
    const closeCount = {};

    openTags.forEach(tag => {
      const tagName = tag.match(/<([a-z][a-z0-9]*)/i)[1].toLowerCase();
      if (!selfClosingTags.includes(tagName)) {
        openCount[tagName] = (openCount[tagName] || 0) + 1;
      }
    });

    closeTags.forEach(tag => {
      const tagName = tag.match(/<\/([a-z][a-z0-9]*)/i)[1].toLowerCase();
      closeCount[tagName] = (closeCount[tagName] || 0) + 1;
    });

    // Check for mismatched tags
    for (const tag in openCount) {
      if (openCount[tag] !== (closeCount[tag] || 0)) {
        console.warn(`Possible unclosed or mismatched <${tag}> tag`);
      }
    }
  }
}

// Export utility functions for testing
export const __testUtils = {
  createTestComposer: (config) => new TemplateComposer(config),
};