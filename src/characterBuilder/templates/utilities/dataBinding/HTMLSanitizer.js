/**
 * @file HTML Sanitizer for preventing XSS attacks
 * @module characterBuilder/templates/utilities/dataBinding/HTMLSanitizer
 * @description Comprehensive HTML sanitization with configurable whitelist
 */

import { DomUtils } from '../../../../utils/domUtils.js';

/**
 * HTML Sanitizer for preventing XSS attacks in template rendering
 */
export class HTMLSanitizer {
  #allowedTags;
  #allowedAttributes;
  #allowedProtocols;
  #allowDataUri;

  /**
   * @param {object} [config] - Sanitizer configuration
   * @param {Set<string>} [config.allowedTags] - Allowed HTML tags
   * @param {Map<string, Set<string>>} [config.allowedAttributes] - Allowed attributes per tag
   * @param {Set<string>} [config.allowedProtocols] - Allowed URL protocols
   * @param {boolean} [config.allowDataUri] - Allow data: URIs (default: false)
   */
  constructor(config = {}) {
    // Default safe HTML tags
    this.#allowedTags =
      config.allowedTags ||
      new Set([
        // Text content
        'p',
        'span',
        'strong',
        'em',
        'b',
        'i',
        'u',
        's',
        'strike',
        'code',
        'pre',
        'blockquote',
        'cite',
        'q',
        'mark',
        'small',
        'sub',
        'sup',
        'kbd',
        'var',
        'samp',
        'abbr',
        'time',

        // Headers
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',

        // Lists
        'ul',
        'ol',
        'li',
        'dl',
        'dt',
        'dd',

        // Tables
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'caption',
        'colgroup',
        'col',

        // Structural
        'div',
        'section',
        'article',
        'nav',
        'aside',
        'header',
        'footer',
        'main',
        'figure',
        'figcaption',
        'address',

        // Media (carefully controlled)
        'img',
        'picture',
        'source',

        // Links
        'a',

        // Forms (limited but needed for data binding)
        'button',
        'label',
        'form',
        'input',
        'select',
        'option',
        'optgroup',
        'textarea',
        'fieldset',
        'legend',

        // Other
        'br',
        'hr',
        'wbr',
      ]);

    // Default allowed attributes per tag
    this.#allowedAttributes =
      config.allowedAttributes ||
      new Map([
        ['*', new Set(['class', 'id', 'title', 'lang', 'dir', 'style'])],
        ['a', new Set(['href', 'target', 'rel'])],
        ['img', new Set(['src', 'alt', 'width', 'height', 'loading'])],
        ['button', new Set(['type', 'disabled', 'name', 'value'])],
        ['time', new Set(['datetime'])],
        ['abbr', new Set(['title'])],
        ['blockquote', new Set(['cite'])],
        ['q', new Set(['cite'])],
        ['td', new Set(['colspan', 'rowspan'])],
        ['th', new Set(['colspan', 'rowspan', 'scope'])],
        // Form elements
        ['form', new Set(['action', 'method', 'enctype', 'novalidate'])],
        [
          'input',
          new Set([
            'type',
            'name',
            'value',
            'placeholder',
            'required',
            'disabled',
            'readonly',
            'checked',
            'min',
            'max',
            'step',
            'pattern',
            'maxlength',
            'minlength',
            'size',
            'multiple',
            'accept',
            'autocomplete',
          ]),
        ],
        [
          'select',
          new Set(['name', 'required', 'disabled', 'multiple', 'size']),
        ],
        ['option', new Set(['value', 'selected', 'disabled', 'label'])],
        ['optgroup', new Set(['label', 'disabled'])],
        [
          'textarea',
          new Set([
            'name',
            'placeholder',
            'required',
            'disabled',
            'readonly',
            'rows',
            'cols',
            'maxlength',
            'minlength',
            'wrap',
          ]),
        ],
        ['fieldset', new Set(['disabled', 'form', 'name'])],
        ['label', new Set(['for', 'form'])],
      ]);

    // Allowed URL protocols
    this.#allowedProtocols =
      config.allowedProtocols ||
      new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);

    // Whether to allow data: URIs
    this.#allowDataUri = config.allowDataUri === true;
  }

  /**
   * Sanitize HTML string
   *
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  sanitize(html) {
    if (!html) return '';

    // Parse HTML
    const doc = this.#parseHTML(html);

    // Sanitize recursively
    this.#sanitizeNode(doc);

    // Serialize back to string
    return this.#serializeHTML(doc);
  }

  /**
   * Escape HTML special characters
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    return DomUtils.escapeHtml(text);
  }

  /**
   * Sanitize text content for safe interpolation
   * This removes dangerous patterns from interpolated content
   *
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }

    let sanitized = text;

    // Remove dangerous patterns that shouldn't appear in interpolated content
    const dangerousPatterns = [
      /onerror\s*=\s*['""][^'"]*['"]/gi,
      /onload\s*=\s*['""][^'"]*['"]/gi,
      /onclick\s*=\s*['""][^'"]*['"]/gi,
      /onmouseover\s*=\s*['""][^'"]*['"]/gi,
      /onfocus\s*=\s*['""][^'"]*['"]/gi,
      /onblur\s*=\s*['""][^'"]*['"]/gi,
      /onchange\s*=\s*['""][^'"]*['"]/gi,
      /onsubmit\s*=\s*['""][^'"]*['"]/gi,
      /javascript:\s*[^"'>]*/gi,
      /vbscript:\s*[^"'>]*/gi,
      /data:text\/html[^"'>]*/gi,
      /eval\s*\([^)]*\)/gi,
      /expression\s*\([^)]*\)/gi,
    ];

    dangerousPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Return cleaned text without double escaping (escaping will happen later)
    return sanitized;
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
   * Serialize document fragment to HTML string
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
   * Recursively sanitize a node and its children
   *
   * @param node
   * @private
   */
  #sanitizeNode(node) {
    // Process child nodes first (to handle removals safely)
    const children = Array.from(node.childNodes);
    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this.#sanitizeElement(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        // Remove all comments
        child.remove();
      }
      // Text nodes are safe
    });
  }

  /**
   * Sanitize an element
   *
   * @param element
   * @private
   */
  #sanitizeElement(element) {
    const tagName = element.tagName.toLowerCase();

    // Remove dangerous content from specific tags first (before allowlist check)
    if (tagName === 'script' || tagName === 'style') {
      element.remove();
      return;
    }

    // Check if tag is allowed
    if (!this.#allowedTags.has(tagName)) {
      // Replace with safe content
      const safeContent = document.createTextNode(element.textContent);
      element.replaceWith(safeContent);
      return;
    }

    // Sanitize attributes
    this.#sanitizeAttributes(element, tagName);

    // Recursively sanitize children
    this.#sanitizeNode(element);
  }

  /**
   * Sanitize element attributes
   *
   * @param element
   * @param tagName
   * @private
   */
  #sanitizeAttributes(element, tagName) {
    const attributes = Array.from(element.attributes);

    attributes.forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      // Check for dangerous attribute names
      if (this.#isDangerousAttribute(attrName)) {
        element.removeAttribute(attr.name);
        return;
      }

      // Check if attribute is allowed for this tag
      const globalAttrs = this.#allowedAttributes.get('*') || new Set();
      const tagAttrs = this.#allowedAttributes.get(tagName) || new Set();

      if (!globalAttrs.has(attrName) && !tagAttrs.has(attrName)) {
        element.removeAttribute(attr.name);
        return;
      }

      // Sanitize attribute value
      const sanitizedValue = this.#sanitizeAttributeValue(attrName, attrValue);
      if (sanitizedValue !== attrValue) {
        element.setAttribute(attr.name, sanitizedValue);
      }
    });
  }

  /**
   * Check if attribute name is dangerous
   *
   * @param name
   * @private
   */
  #isDangerousAttribute(name) {
    // Block event handlers
    if (name.startsWith('on')) return true;

    // Block other dangerous attributes
    const dangerous = [
      'srcdoc',
      'srcset',
      'background',
      'poster',
      'formaction',
      'xlink:href',
      'contenteditable',
      'xmlns',
      'xmlns:xlink',
    ];

    return dangerous.includes(name);
  }

  /**
   * Sanitize attribute value
   *
   * @param name
   * @param value
   * @private
   */
  #sanitizeAttributeValue(name, value) {
    // Handle URL attributes
    if (['href', 'src', 'action', 'formaction', 'cite'].includes(name)) {
      return this.#sanitizeUrl(value);
    }

    // Handle style attribute (remove dangerous CSS)
    if (name === 'style') {
      return this.#sanitizeStyle(value);
    }

    // Check for dangerous content in attribute values and remove completely
    if (this.#containsDangerousContent(value)) {
      return '';
    }

    // Default: escape HTML entities
    return this.escapeHtml(value);
  }

  /**
   * Check if attribute value contains dangerous content
   *
   * @param value
   * @private
   */
  #containsDangerousContent(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const dangerous = [
      'javascript:',
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'eval(',
      'expression(',
      'vbscript:',
      'data:text/html',
    ];

    const lowerValue = value.toLowerCase();
    return dangerous.some((pattern) => lowerValue.includes(pattern));
  }

  /**
   * Sanitize URL value
   *
   * @param url
   * @private
   */
  #sanitizeUrl(url) {
    if (!url) return '';

    const trimmed = url.trim();

    // Check for javascript: protocol
    if (trimmed.toLowerCase().startsWith('javascript:')) {
      return '';
    }

    // Check for data: URIs
    if (trimmed.toLowerCase().startsWith('data:')) {
      return this.#allowDataUri ? trimmed : '';
    }

    // Parse URL
    try {
      const parsed = new URL(trimmed, window.location.href);

      // Check protocol
      if (!this.#allowedProtocols.has(parsed.protocol)) {
        return '';
      }

      return trimmed;
    } catch {
      // Relative URL or invalid - allow if it doesn't contain dangerous patterns
      if (trimmed.includes('javascript:') || trimmed.includes('data:')) {
        return '';
      }
      return trimmed;
    }
  }

  /**
   * Sanitize CSS style value
   *
   * @param style
   * @private
   */
  #sanitizeStyle(style) {
    if (!style) return '';

    // Remove dangerous CSS
    const dangerous = [
      'javascript:',
      'expression(',
      '@import',
      'behavior:',
      '-moz-binding',
      '-o-link',
      'link:',
      'url(',
    ];

    let sanitized = style;
    dangerous.forEach((pattern) => {
      const regex = new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'gi'
      );
      sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
  }

  /**
   * Configure allowed tags
   *
   * @param {string[]} tags - Array of allowed tag names
   */
  setAllowedTags(tags) {
    this.#allowedTags = new Set(tags);
  }

  /**
   * Add allowed tags
   *
   * @param {string[]} tags - Tags to add
   */
  addAllowedTags(tags) {
    tags.forEach((tag) => this.#allowedTags.add(tag));
  }

  /**
   * Configure allowed attributes
   *
   * @param {string} tag - Tag name or '*' for global
   * @param {string[]} attributes - Allowed attributes
   */
  setAllowedAttributes(tag, attributes) {
    this.#allowedAttributes.set(tag, new Set(attributes));
  }
}
