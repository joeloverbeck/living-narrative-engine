# HTMLTEMP-010: Implement Basic Template Validation

## Summary

Implement a comprehensive template validation system that ensures structural integrity, validates required fields, checks HTML validity, verifies accessibility compliance, and provides clear error reporting for the HTML template system.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Medium
- **Estimated Time**: 3 hours
- **Dependencies**: HTMLTEMP-007 (Template Composition), HTMLTEMP-008 (Data Binding), HTMLTEMP-009 (Configuration)

## Objectives

### Primary Goals

1. **Structure Validation** - Ensure templates have valid HTML structure
2. **Required Field Checking** - Verify all required data is present
3. **HTML5 Compliance** - Validate against HTML5 standards
4. **Accessibility Validation** - Check WCAG 2.1 AA compliance
5. **Data Type Validation** - Ensure data matches expected types
6. **Performance Validation** - Check for performance anti-patterns
7. **Error Reporting** - Provide clear, actionable error messages

### Success Criteria

- [ ] All invalid HTML structures are detected
- [ ] Missing required fields are identified with clear messages
- [ ] HTML5 validation catches non-compliant markup
- [ ] Accessibility issues are detected and reported
- [ ] Validation completes in < 50ms for standard templates
- [ ] Error messages include line numbers and fix suggestions
- [ ] Validation can be run at build time or runtime
- [ ] Zero false positives in validation results

## Technical Specification

### 1. Template Validator Core

#### File: `src/characterBuilder/templates/utilities/templateValidator.js`

```javascript
/**
 * Comprehensive template validation system
 */
export class TemplateValidator {
  /**
   * @param {object} config - Validator configuration
   * @param {HTMLValidator} config.htmlValidator - HTML5 validation service
   * @param {AccessibilityValidator} config.a11yValidator - Accessibility validator
   * @param {SchemaValidator} config.schemaValidator - Data schema validator
   * @param {PerformanceAnalyzer} config.perfAnalyzer - Performance analyzer
   */
  constructor({ htmlValidator, a11yValidator, schemaValidator, perfAnalyzer }) {
    this.#htmlValidator = htmlValidator;
    this.#a11yValidator = a11yValidator;
    this.#schemaValidator = schemaValidator;
    this.#perfAnalyzer = perfAnalyzer;
    this.#validationRules = new Map();
    this.#customValidators = new Map();
    this.#initializeDefaultRules();
  }

  /**
   * Validate a template comprehensively
   * @param {string|Function} template - Template to validate
   * @param {object} options - Validation options
   * @returns {ValidationResult} Validation result with errors and warnings
   */
  async validate(template, options = {}) {
    const {
      data = {},
      templateType = 'generic',
      strictMode = false,
      validateAccessibility = true,
      validatePerformance = true,
      validateData = true,
      context = {}
    } = options;

    const result = new ValidationResult();
    const startTime = performance.now();

    try {
      // 1. Render template if function
      const html = typeof template === 'function' 
        ? template(data) 
        : template;

      // 2. Validate HTML structure
      const htmlErrors = await this.#validateHTML(html, strictMode);
      result.addErrors('html', htmlErrors);

      // 3. Validate required fields
      if (validateData) {
        const dataErrors = this.#validateRequiredFields(html, data, templateType);
        result.addErrors('data', dataErrors);
      }

      // 4. Validate accessibility
      if (validateAccessibility) {
        const a11yErrors = await this.#validateAccessibility(html);
        result.addErrors('accessibility', a11yErrors);
      }

      // 5. Validate performance
      if (validatePerformance) {
        const perfWarnings = this.#validatePerformance(html);
        result.addWarnings('performance', perfWarnings);
      }

      // 6. Run custom validators
      const customErrors = await this.#runCustomValidators(html, data, templateType);
      result.addErrors('custom', customErrors);

      // 7. Validate against schema if provided
      if (context.schema) {
        const schemaErrors = this.#validateAgainstSchema(data, context.schema);
        result.addErrors('schema', schemaErrors);
      }

    } catch (error) {
      result.addError('critical', {
        message: `Validation failed: ${error.message}`,
        severity: 'critical',
        error
      });
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  /**
   * Register custom validation rule
   * @param {string} name - Rule name
   * @param {Function} validator - Validation function
   */
  registerRule(name, validator) {
    this.#customValidators.set(name, validator);
  }

  /**
   * Initialize default validation rules
   * @private
   */
  #initializeDefaultRules() {
    // HTML structure rules
    this.#validationRules.set('html-structure', [
      { pattern: /<html[^>]*>/, message: 'Missing <html> tag', severity: 'error' },
      { pattern: /<head[^>]*>/, message: 'Missing <head> tag', severity: 'warning' },
      { pattern: /<body[^>]*>/, message: 'Missing <body> tag', severity: 'warning' },
      { pattern: /<title[^>]*>/, message: 'Missing <title> tag', severity: 'warning' }
    ]);

    // Accessibility rules
    this.#validationRules.set('accessibility', [
      { selector: 'img:not([alt])', message: 'Image missing alt attribute', severity: 'error' },
      { selector: 'button:empty', message: 'Button has no text content', severity: 'error' },
      { selector: 'a:not([href])', message: 'Link missing href attribute', severity: 'warning' },
      { selector: 'form:not([aria-label]):not([aria-labelledby])', message: 'Form missing label', severity: 'warning' }
    ]);

    // Performance rules
    this.#validationRules.set('performance', [
      { check: 'large-dom', threshold: 1500, message: 'DOM has too many nodes', severity: 'warning' },
      { check: 'deep-nesting', threshold: 32, message: 'DOM nesting too deep', severity: 'warning' },
      { check: 'inline-styles', threshold: 50, message: 'Too many inline styles', severity: 'info' }
    ]);
  }
}

/**
 * Validation result container
 */
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.duration = 0;
    this.valid = true;
  }

  addError(category, error) {
    this.errors.push({ category, ...error });
    this.valid = false;
  }

  addErrors(category, errors) {
    errors.forEach(error => this.addError(category, error));
  }

  addWarning(category, warning) {
    this.warnings.push({ category, ...warning });
  }

  addWarnings(category, warnings) {
    warnings.forEach(warning => this.addWarning(category, warning));
  }

  addInfo(category, info) {
    this.info.push({ category, ...info });
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  getSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.info.length,
      duration: this.duration
    };
  }

  getFormattedReport() {
    const lines = [];
    
    if (this.errors.length > 0) {
      lines.push('❌ ERRORS:');
      this.errors.forEach(error => {
        lines.push(`  - [${error.category}] ${error.message}`);
        if (error.line) lines.push(`    Line ${error.line}: ${error.context}`);
        if (error.suggestion) lines.push(`    💡 ${error.suggestion}`);
      });
    }

    if (this.warnings.length > 0) {
      lines.push('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => {
        lines.push(`  - [${warning.category}] ${warning.message}`);
      });
    }

    if (this.info.length > 0) {
      lines.push('\nℹ️  INFO:');
      this.info.forEach(item => {
        lines.push(`  - [${item.category}] ${item.message}`);
      });
    }

    lines.push(`\n⏱️  Validation completed in ${this.duration.toFixed(2)}ms`);
    
    return lines.join('\n');
  }
}
```

### 2. HTML Structure Validator

#### File: `src/characterBuilder/templates/utilities/validators/htmlValidator.js`

```javascript
/**
 * HTML5 structure and syntax validator
 */
export class HTMLValidator {
  constructor() {
    this.#voidElements = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    
    this.#requiredAttributes = new Map([
      ['img', ['src', 'alt']],
      ['a', ['href']],
      ['form', ['action']],
      ['input', ['type']],
      ['label', ['for']],
      ['script', ['src', 'type']],
      ['link', ['rel', 'href']]
    ]);
  }

  /**
   * Validate HTML structure
   * @param {string} html - HTML to validate
   * @param {boolean} strict - Strict mode validation
   * @returns {Array<ValidationError>} Array of validation errors
   */
  validate(html, strict = false) {
    const errors = [];
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Check for parser errors
    const parserErrors = doc.querySelector('parsererror');
    if (parserErrors) {
      errors.push({
        message: 'HTML parsing failed',
        detail: parserErrors.textContent,
        severity: 'critical',
        line: this.#findLineNumber(html, parserErrors.textContent)
      });
      return errors;
    }

    // Validate structure
    errors.push(...this.#validateStructure(doc, strict));
    
    // Validate attributes
    errors.push(...this.#validateAttributes(doc));
    
    // Validate nesting rules
    errors.push(...this.#validateNesting(doc));
    
    // Check for unclosed tags
    errors.push(...this.#checkUnclosedTags(html));
    
    // Validate IDs are unique
    errors.push(...this.#validateUniqueIds(doc));
    
    // Check for deprecated elements
    if (strict) {
      errors.push(...this.#checkDeprecatedElements(doc));
    }

    return errors;
  }

  /**
   * Validate HTML structure
   * @private
   */
  #validateStructure(doc, strict) {
    const errors = [];
    
    // Check for required elements in strict mode
    if (strict) {
      if (!doc.documentElement) {
        errors.push({
          message: 'Missing <html> element',
          severity: 'error',
          suggestion: 'Wrap content in <html> tags'
        });
      }
      
      if (!doc.head) {
        errors.push({
          message: 'Missing <head> element',
          severity: 'warning',
          suggestion: 'Add <head> section for metadata'
        });
      }
      
      if (!doc.body) {
        errors.push({
          message: 'Missing <body> element',
          severity: 'warning',
          suggestion: 'Wrap visible content in <body> tags'
        });
      }
      
      if (!doc.title || !doc.title.trim()) {
        errors.push({
          message: 'Missing or empty <title> element',
          severity: 'warning',
          suggestion: 'Add descriptive page title'
        });
      }
    }
    
    // Check for multiple body or head elements
    const heads = doc.querySelectorAll('head');
    if (heads.length > 1) {
      errors.push({
        message: 'Multiple <head> elements found',
        severity: 'error',
        count: heads.length
      });
    }
    
    const bodies = doc.querySelectorAll('body');
    if (bodies.length > 1) {
      errors.push({
        message: 'Multiple <body> elements found',
        severity: 'error',
        count: bodies.length
      });
    }
    
    return errors;
  }

  /**
   * Validate required attributes
   * @private
   */
  #validateAttributes(doc) {
    const errors = [];
    
    this.#requiredAttributes.forEach((requiredAttrs, tagName) => {
      const elements = doc.querySelectorAll(tagName);
      
      elements.forEach((element, index) => {
        requiredAttrs.forEach(attr => {
          if (!element.hasAttribute(attr)) {
            errors.push({
              message: `<${tagName}> missing required attribute "${attr}"`,
              severity: 'error',
              element: `${tagName}[${index}]`,
              suggestion: `Add ${attr}="${attr === 'alt' ? 'description' : ''}" to the element`
            });
          }
        });
      });
    });
    
    return errors;
  }

  /**
   * Validate HTML nesting rules
   * @private
   */
  #validateNesting(doc) {
    const errors = [];
    
    // Check for invalid nesting patterns
    const invalidNesting = [
      { parent: 'p', child: 'div', message: '<div> cannot be nested inside <p>' },
      { parent: 'p', child: 'p', message: '<p> cannot be nested inside <p>' },
      { parent: 'a', child: 'a', message: '<a> cannot be nested inside <a>' },
      { parent: 'button', child: 'button', message: '<button> cannot be nested inside <button>' },
      { parent: 'label', child: 'label', message: '<label> cannot be nested inside <label>' }
    ];
    
    invalidNesting.forEach(rule => {
      const parents = doc.querySelectorAll(rule.parent);
      parents.forEach(parent => {
        const children = parent.querySelectorAll(rule.child);
        if (children.length > 0) {
          errors.push({
            message: rule.message,
            severity: 'error',
            count: children.length,
            suggestion: 'Restructure HTML to avoid invalid nesting'
          });
        }
      });
    });
    
    return errors;
  }

  /**
   * Check for unclosed tags
   * @private
   */
  #checkUnclosedTags(html) {
    const errors = [];
    const tagStack = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
      const [fullMatch, tagName] = match;
      const isClosing = fullMatch.startsWith('</');
      const isSelfClosing = fullMatch.endsWith('/>') || this.#voidElements.has(tagName.toLowerCase());
      
      if (!isClosing && !isSelfClosing) {
        tagStack.push({
          tag: tagName,
          position: match.index,
          line: this.#getLineNumber(html, match.index)
        });
      } else if (isClosing) {
        const lastTag = tagStack[tagStack.length - 1];
        if (lastTag && lastTag.tag.toLowerCase() === tagName.toLowerCase()) {
          tagStack.pop();
        } else {
          errors.push({
            message: `Unexpected closing tag </${tagName}>`,
            severity: 'error',
            line: this.#getLineNumber(html, match.index),
            suggestion: `Check for missing opening tag or remove closing tag`
          });
        }
      }
    }
    
    // Report unclosed tags
    tagStack.forEach(unclosed => {
      errors.push({
        message: `Unclosed tag <${unclosed.tag}>`,
        severity: 'error',
        line: unclosed.line,
        suggestion: `Add closing tag </${unclosed.tag}>`
      });
    });
    
    return errors;
  }

  /**
   * Validate unique IDs
   * @private
   */
  #validateUniqueIds(doc) {
    const errors = [];
    const idMap = new Map();
    
    const elementsWithId = doc.querySelectorAll('[id]');
    elementsWithId.forEach(element => {
      const id = element.getAttribute('id');
      if (idMap.has(id)) {
        errors.push({
          message: `Duplicate ID "${id}" found`,
          severity: 'error',
          elements: [idMap.get(id), element.tagName],
          suggestion: 'Use unique IDs for each element'
        });
      } else {
        idMap.set(id, element.tagName);
      }
    });
    
    return errors;
  }

  /**
   * Check for deprecated elements
   * @private
   */
  #checkDeprecatedElements(doc) {
    const errors = [];
    const deprecated = {
      'center': 'Use CSS text-align instead',
      'font': 'Use CSS font properties instead',
      'marquee': 'Use CSS animations instead',
      'blink': 'Avoid blinking text',
      'big': 'Use CSS font-size instead',
      'strike': 'Use <del> or CSS text-decoration'
    };
    
    Object.entries(deprecated).forEach(([tag, suggestion]) => {
      const elements = doc.querySelectorAll(tag);
      if (elements.length > 0) {
        errors.push({
          message: `Deprecated element <${tag}> used`,
          severity: 'warning',
          count: elements.length,
          suggestion
        });
      }
    });
    
    return errors;
  }

  /**
   * Get line number for position in HTML
   * @private
   */
  #getLineNumber(html, position) {
    const lines = html.substring(0, position).split('\n');
    return lines.length;
  }
}
```

### 3. Accessibility Validator

#### File: `src/characterBuilder/templates/utilities/validators/accessibilityValidator.js`

```javascript
/**
 * WCAG 2.1 AA accessibility validator
 */
export class AccessibilityValidator {
  constructor() {
    this.#wcagCriteria = this.#initializeWCAGCriteria();
  }

  /**
   * Validate accessibility compliance
   * @param {string} html - HTML to validate
   * @returns {Array<ValidationError>} Accessibility errors
   */
  validate(html) {
    const errors = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 1. Check images for alt text
    errors.push(...this.#validateImages(doc));
    
    // 2. Check form elements for labels
    errors.push(...this.#validateForms(doc));
    
    // 3. Check heading hierarchy
    errors.push(...this.#validateHeadings(doc));
    
    // 4. Check color contrast (basic check)
    errors.push(...this.#validateColorContrast(doc));
    
    // 5. Check keyboard navigation
    errors.push(...this.#validateKeyboardAccess(doc));
    
    // 6. Check ARIA attributes
    errors.push(...this.#validateARIA(doc));
    
    // 7. Check language attributes
    errors.push(...this.#validateLanguage(doc));
    
    // 8. Check link text
    errors.push(...this.#validateLinks(doc));
    
    return errors;
  }

  /**
   * Initialize WCAG 2.1 AA criteria
   * @private
   */
  #initializeWCAGCriteria() {
    return {
      '1.1.1': { name: 'Non-text Content', level: 'A' },
      '1.3.1': { name: 'Info and Relationships', level: 'A' },
      '1.4.3': { name: 'Contrast (Minimum)', level: 'AA' },
      '2.1.1': { name: 'Keyboard', level: 'A' },
      '2.4.4': { name: 'Link Purpose', level: 'A' },
      '3.3.2': { name: 'Labels or Instructions', level: 'A' },
      '4.1.2': { name: 'Name, Role, Value', level: 'A' }
    };
  }

  /**
   * Validate images have alt text
   * @private
   */
  #validateImages(doc) {
    const errors = [];
    const images = doc.querySelectorAll('img');
    
    images.forEach((img, index) => {
      if (!img.hasAttribute('alt')) {
        errors.push({
          message: 'Image missing alt attribute',
          wcag: '1.1.1',
          severity: 'error',
          element: `img[${index}]`,
          suggestion: 'Add descriptive alt text or alt="" for decorative images'
        });
      } else if (img.getAttribute('alt').trim() === '' && !img.hasAttribute('role')) {
        errors.push({
          message: 'Empty alt text without role="presentation"',
          wcag: '1.1.1',
          severity: 'warning',
          element: `img[${index}]`,
          suggestion: 'Add role="presentation" for decorative images'
        });
      }
    });
    
    return errors;
  }

  /**
   * Validate form accessibility
   * @private
   */
  #validateForms(doc) {
    const errors = [];
    
    // Check inputs for labels
    const inputs = doc.querySelectorAll('input:not([type="hidden"]), textarea, select');
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id');
      const hasLabel = id && doc.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel) {
        errors.push({
          message: 'Form input missing label',
          wcag: '3.3.2',
          severity: 'error',
          element: `${input.tagName.toLowerCase()}[${index}]`,
          suggestion: 'Add a <label> element or aria-label attribute'
        });
      }
    });
    
    // Check fieldsets for legends
    const fieldsets = doc.querySelectorAll('fieldset');
    fieldsets.forEach((fieldset, index) => {
      if (!fieldset.querySelector('legend')) {
        errors.push({
          message: 'Fieldset missing legend',
          wcag: '1.3.1',
          severity: 'warning',
          element: `fieldset[${index}]`,
          suggestion: 'Add a <legend> to describe the field group'
        });
      }
    });
    
    return errors;
  }

  /**
   * Validate heading hierarchy
   * @private
   */
  #validateHeadings(doc) {
    const errors = [];
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    
    // Check for multiple h1s
    const h1s = headings.filter(h => h.tagName === 'H1');
    if (h1s.length > 1) {
      errors.push({
        message: 'Multiple <h1> elements found',
        wcag: '1.3.1',
        severity: 'warning',
        count: h1s.length,
        suggestion: 'Use only one <h1> per page'
      });
    }
    
    // Check heading hierarchy
    let lastLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      
      if (level > lastLevel + 1) {
        errors.push({
          message: `Heading level skipped: h${lastLevel} to h${level}`,
          wcag: '1.3.1',
          severity: 'warning',
          element: `${heading.tagName}[${index}]`,
          suggestion: `Use h${lastLevel + 1} instead`
        });
      }
      
      lastLevel = level;
    });
    
    return errors;
  }

  /**
   * Basic color contrast validation
   * @private
   */
  #validateColorContrast(doc) {
    const errors = [];
    
    // Check for low contrast text (basic check for common issues)
    const lowContrastPatterns = [
      { fg: '#777', bg: '#fff', ratio: 3.5 },
      { fg: '#999', bg: '#fff', ratio: 2.7 },
      { fg: '#aaa', bg: '#fff', ratio: 2.1 }
    ];
    
    // This is a simplified check - real contrast validation requires computed styles
    const elements = doc.querySelectorAll('[style*="color"]');
    elements.forEach((element, index) => {
      const style = element.getAttribute('style');
      if (style && style.includes('color: #') && style.includes('background')) {
        errors.push({
          message: 'Potential color contrast issue',
          wcag: '1.4.3',
          severity: 'warning',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          suggestion: 'Ensure contrast ratio is at least 4.5:1 for normal text'
        });
      }
    });
    
    return errors;
  }

  /**
   * Validate keyboard accessibility
   * @private
   */
  #validateKeyboardAccess(doc) {
    const errors = [];
    
    // Check for click handlers without keyboard support
    const clickableElements = doc.querySelectorAll('[onclick]:not(button):not(a):not(input)');
    clickableElements.forEach((element, index) => {
      if (!element.hasAttribute('tabindex') && !element.hasAttribute('role')) {
        errors.push({
          message: 'Clickable element not keyboard accessible',
          wcag: '2.1.1',
          severity: 'error',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          suggestion: 'Add tabindex="0" and keyboard event handlers'
        });
      }
    });
    
    // Check for positive tabindex
    const positiveTabindex = doc.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])');
    positiveTabindex.forEach((element, index) => {
      const tabindex = parseInt(element.getAttribute('tabindex'));
      if (tabindex > 0) {
        errors.push({
          message: 'Positive tabindex disrupts natural tab order',
          wcag: '2.4.3',
          severity: 'warning',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          value: tabindex,
          suggestion: 'Use tabindex="0" or restructure HTML for natural tab order'
        });
      }
    });
    
    return errors;
  }

  /**
   * Validate ARIA attributes
   * @private
   */
  #validateARIA(doc) {
    const errors = [];
    
    // Check for invalid ARIA roles
    const validRoles = new Set([
      'alert', 'button', 'checkbox', 'dialog', 'link', 'menu', 'menuitem',
      'navigation', 'progressbar', 'radio', 'tab', 'tabpanel', 'textbox'
    ]);
    
    const elementsWithRole = doc.querySelectorAll('[role]');
    elementsWithRole.forEach((element, index) => {
      const role = element.getAttribute('role');
      if (!validRoles.has(role)) {
        errors.push({
          message: `Invalid ARIA role "${role}"`,
          wcag: '4.1.2',
          severity: 'error',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          suggestion: 'Use a valid ARIA role'
        });
      }
    });
    
    // Check for aria-labelledby pointing to non-existent IDs
    const labelledBy = doc.querySelectorAll('[aria-labelledby]');
    labelledBy.forEach((element, index) => {
      const ids = element.getAttribute('aria-labelledby').split(' ');
      ids.forEach(id => {
        if (!doc.getElementById(id)) {
          errors.push({
            message: `aria-labelledby references non-existent ID "${id}"`,
            wcag: '4.1.2',
            severity: 'error',
            element: `${element.tagName.toLowerCase()}[${index}]`,
            suggestion: 'Ensure referenced ID exists'
          });
        }
      });
    });
    
    return errors;
  }

  /**
   * Validate language attributes
   * @private
   */
  #validateLanguage(doc) {
    const errors = [];
    
    if (!doc.documentElement.hasAttribute('lang')) {
      errors.push({
        message: 'Missing lang attribute on <html> element',
        wcag: '3.1.1',
        severity: 'error',
        suggestion: 'Add lang="en" or appropriate language code'
      });
    }
    
    return errors;
  }

  /**
   * Validate link text
   * @private
   */
  #validateLinks(doc) {
    const errors = [];
    const genericLinkTexts = ['click here', 'read more', 'link', 'here'];
    
    const links = doc.querySelectorAll('a[href]');
    links.forEach((link, index) => {
      const text = link.textContent.trim().toLowerCase();
      
      if (!text && !link.querySelector('img') && !link.hasAttribute('aria-label')) {
        errors.push({
          message: 'Link has no text content',
          wcag: '2.4.4',
          severity: 'error',
          element: `a[${index}]`,
          suggestion: 'Add descriptive link text or aria-label'
        });
      } else if (genericLinkTexts.includes(text)) {
        errors.push({
          message: `Generic link text "${text}"`,
          wcag: '2.4.4',
          severity: 'warning',
          element: `a[${index}]`,
          suggestion: 'Use descriptive link text that explains the destination'
        });
      }
    });
    
    return errors;
  }
}
```

### 4. Data Schema Validator

#### File: `src/characterBuilder/templates/utilities/validators/schemaValidator.js`

```javascript
/**
 * Validates template data against schemas
 */
export class SchemaValidator {
  constructor() {
    this.#schemas = new Map();
    this.#initializeSchemas();
  }

  /**
   * Initialize built-in schemas
   * @private
   */
  #initializeSchemas() {
    // Page data schema
    this.#schemas.set('page', {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1 },
        subtitle: { type: 'string' },
        headerActions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'action'],
            properties: {
              label: { type: 'string' },
              action: { type: 'string' },
              icon: { type: 'string' },
              disabled: { type: 'boolean' }
            }
          }
        },
        leftPanel: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            content: { type: 'string' }
          }
        },
        rightPanel: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            content: { type: 'string' }
          }
        }
      }
    });

    // Form data schema
    this.#schemas.set('form', {
      type: 'object',
      required: ['fields'],
      properties: {
        fields: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' },
              type: { enum: ['text', 'email', 'password', 'number', 'select', 'checkbox', 'radio'] },
              label: { type: 'string' },
              required: { type: 'boolean' },
              value: { type: ['string', 'number', 'boolean'] },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['value', 'label'],
                  properties: {
                    value: { type: ['string', 'number'] },
                    label: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    });

    // List data schema
    this.#schemas.set('list', {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object'
          }
        },
        emptyMessage: { type: 'string' },
        loading: { type: 'boolean' }
      }
    });
  }

  /**
   * Register custom schema
   * @param {string} name - Schema name
   * @param {object} schema - JSON schema
   */
  registerSchema(name, schema) {
    this.#schemas.set(name, schema);
  }

  /**
   * Validate data against schema
   * @param {object} data - Data to validate
   * @param {string|object} schemaOrName - Schema or schema name
   * @returns {Array<ValidationError>} Validation errors
   */
  validate(data, schemaOrName) {
    const schema = typeof schemaOrName === 'string' 
      ? this.#schemas.get(schemaOrName)
      : schemaOrName;
    
    if (!schema) {
      return [{
        message: `Schema not found: ${schemaOrName}`,
        severity: 'error'
      }];
    }

    return this.#validateAgainstSchema(data, schema, '');
  }

  /**
   * Recursively validate against schema
   * @private
   */
  #validateAgainstSchema(data, schema, path) {
    const errors = [];

    // Check type
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      
      if (!expectedTypes.includes(actualType)) {
        errors.push({
          message: `Type mismatch at ${path || 'root'}`,
          expected: expectedTypes.join(' or '),
          actual: actualType,
          severity: 'error'
        });
        return errors; // Stop validation if type is wrong
      }
    }

    // Check required properties
    if (schema.required && schema.type === 'object') {
      schema.required.forEach(prop => {
        if (!(prop in data)) {
          errors.push({
            message: `Missing required property: ${path ? path + '.' : ''}${prop}`,
            severity: 'error',
            suggestion: `Add property "${prop}" to the data object`
          });
        }
      });
    }

    // Validate properties
    if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        if (key in data) {
          const propPath = path ? `${path}.${key}` : key;
          errors.push(...this.#validateAgainstSchema(data[key], propSchema, propPath));
        }
      });
    }

    // Validate array items
    if (schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        errors.push(...this.#validateAgainstSchema(item, schema.items, itemPath));
      });
    }

    // Check string constraints
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        errors.push({
          message: `String too short at ${path || 'root'}`,
          minLength: schema.minLength,
          actual: data.length,
          severity: 'error'
        });
      }
      
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors.push({
            message: `Pattern mismatch at ${path || 'root'}`,
            pattern: schema.pattern,
            value: data,
            severity: 'error'
          });
        }
      }
    }

    // Check enum values
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        message: `Invalid value at ${path || 'root'}`,
        allowed: schema.enum,
        actual: data,
        severity: 'error',
        suggestion: `Use one of: ${schema.enum.join(', ')}`
      });
    }

    return errors;
  }
}
```

### 5. Performance Analyzer

#### File: `src/characterBuilder/templates/utilities/validators/performanceAnalyzer.js`

```javascript
/**
 * Analyzes template performance characteristics
 */
export class PerformanceAnalyzer {
  constructor() {
    this.#thresholds = {
      domNodes: 1500,
      domDepth: 32,
      inlineStyles: 50,
      scriptTags: 10,
      externalResources: 20,
      imageSize: 500000, // 500KB
      totalSize: 2000000  // 2MB
    };
  }

  /**
   * Analyze template performance
   * @param {string} html - HTML to analyze
   * @returns {Array<PerformanceWarning>} Performance warnings
   */
  analyze(html) {
    const warnings = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Check DOM complexity
    warnings.push(...this.#analyzeDOMComplexity(doc));
    
    // Check inline styles
    warnings.push(...this.#analyzeInlineStyles(doc));
    
    // Check script usage
    warnings.push(...this.#analyzeScripts(doc));
    
    // Check resource loading
    warnings.push(...this.#analyzeResources(doc));
    
    // Check for performance anti-patterns
    warnings.push(...this.#analyzeAntiPatterns(doc));
    
    return warnings;
  }

  /**
   * Analyze DOM complexity
   * @private
   */
  #analyzeDOMComplexity(doc) {
    const warnings = [];
    
    // Count total nodes
    const nodeCount = doc.querySelectorAll('*').length;
    if (nodeCount > this.#thresholds.domNodes) {
      warnings.push({
        message: 'Excessive DOM nodes',
        metric: 'domNodes',
        value: nodeCount,
        threshold: this.#thresholds.domNodes,
        severity: 'warning',
        impact: 'May cause slow rendering and interactions',
        suggestion: 'Consider pagination or virtual scrolling'
      });
    }
    
    // Check DOM depth
    const maxDepth = this.#calculateMaxDepth(doc.body);
    if (maxDepth > this.#thresholds.domDepth) {
      warnings.push({
        message: 'Excessive DOM nesting depth',
        metric: 'domDepth',
        value: maxDepth,
        threshold: this.#thresholds.domDepth,
        severity: 'warning',
        impact: 'Deep nesting affects selector performance',
        suggestion: 'Flatten DOM structure where possible'
      });
    }
    
    return warnings;
  }

  /**
   * Calculate maximum DOM depth
   * @private
   */
  #calculateMaxDepth(element, currentDepth = 0) {
    if (!element.children.length) return currentDepth;
    
    let maxChildDepth = currentDepth;
    for (const child of element.children) {
      const childDepth = this.#calculateMaxDepth(child, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    return maxChildDepth;
  }

  /**
   * Analyze inline styles
   * @private
   */
  #analyzeInlineStyles(doc) {
    const warnings = [];
    
    const elementsWithStyle = doc.querySelectorAll('[style]');
    if (elementsWithStyle.length > this.#thresholds.inlineStyles) {
      warnings.push({
        message: 'Excessive inline styles',
        metric: 'inlineStyles',
        value: elementsWithStyle.length,
        threshold: this.#thresholds.inlineStyles,
        severity: 'info',
        impact: 'Inline styles prevent effective caching and increase HTML size',
        suggestion: 'Move styles to CSS classes'
      });
    }
    
    return warnings;
  }

  /**
   * Analyze script usage
   * @private
   */
  #analyzeScripts(doc) {
    const warnings = [];
    
    // Check inline scripts
    const inlineScripts = doc.querySelectorAll('script:not([src])');
    if (inlineScripts.length > 0) {
      warnings.push({
        message: 'Inline scripts detected',
        count: inlineScripts.length,
        severity: 'warning',
        impact: 'Inline scripts block parsing and are not cached',
        suggestion: 'Move scripts to external files'
      });
    }
    
    // Check script count
    const scripts = doc.querySelectorAll('script');
    if (scripts.length > this.#thresholds.scriptTags) {
      warnings.push({
        message: 'Too many script tags',
        metric: 'scriptTags',
        value: scripts.length,
        threshold: this.#thresholds.scriptTags,
        severity: 'warning',
        impact: 'Multiple scripts increase load time',
        suggestion: 'Bundle scripts together'
      });
    }
    
    return warnings;
  }

  /**
   * Analyze resource loading
   * @private
   */
  #analyzeResources(doc) {
    const warnings = [];
    
    // Check images without dimensions
    const imagesWithoutDimensions = doc.querySelectorAll('img:not([width]):not([height])');
    if (imagesWithoutDimensions.length > 0) {
      warnings.push({
        message: 'Images without dimensions',
        count: imagesWithoutDimensions.length,
        severity: 'warning',
        impact: 'Causes layout shift during loading',
        suggestion: 'Add width and height attributes to images'
      });
    }
    
    // Check for lazy loading
    const images = doc.querySelectorAll('img');
    const lazyImages = doc.querySelectorAll('img[loading="lazy"]');
    if (images.length > 5 && lazyImages.length === 0) {
      warnings.push({
        message: 'No lazy loading on images',
        count: images.length,
        severity: 'info',
        impact: 'All images load immediately',
        suggestion: 'Add loading="lazy" to off-screen images'
      });
    }
    
    return warnings;
  }

  /**
   * Check for performance anti-patterns
   * @private
   */
  #analyzeAntiPatterns(doc) {
    const warnings = [];
    
    // Check for synchronous scripts in head
    const headScripts = doc.querySelectorAll('head script:not([async]):not([defer])');
    if (headScripts.length > 0) {
      warnings.push({
        message: 'Synchronous scripts in <head>',
        count: headScripts.length,
        severity: 'warning',
        impact: 'Blocks page rendering',
        suggestion: 'Add async or defer attributes, or move to body'
      });
    }
    
    // Check for multiple H1s (also an SEO issue)
    const h1s = doc.querySelectorAll('h1');
    if (h1s.length > 1) {
      warnings.push({
        message: 'Multiple H1 elements',
        count: h1s.length,
        severity: 'info',
        impact: 'May affect SEO and screen reader navigation',
        suggestion: 'Use only one H1 per page'
      });
    }
    
    return warnings;
  }
}
```

## Implementation Tasks

### Phase 1: Core Validation System (45 minutes)

1. **Create TemplateValidator class**
   - [ ] Set up main validator with dependencies
   - [ ] Implement validation orchestration
   - [ ] Create ValidationResult class
   - [ ] Add error formatting

2. **Build validation pipeline**
   - [ ] HTML validation integration
   - [ ] Accessibility validation integration
   - [ ] Schema validation integration
   - [ ] Performance analysis integration

3. **Implement caching**
   - [ ] Cache validation results
   - [ ] Invalidate on template change
   - [ ] Optimize repeated validations

### Phase 2: HTML & Structure Validation (45 minutes)

1. **Implement HTMLValidator**
   - [ ] Parse and validate HTML structure
   - [ ] Check for unclosed tags
   - [ ] Validate attributes
   - [ ] Check nesting rules

2. **Add HTML5 compliance checks**
   - [ ] Validate against HTML5 spec
   - [ ] Check deprecated elements
   - [ ] Validate DOCTYPE
   - [ ] Check meta tags

### Phase 3: Accessibility Validation (45 minutes)

1. **Implement AccessibilityValidator**
   - [ ] WCAG 2.1 AA checks
   - [ ] Alt text validation
   - [ ] Form label validation
   - [ ] Heading hierarchy checks

2. **Add keyboard navigation checks**
   - [ ] Tab order validation
   - [ ] Focus management
   - [ ] Keyboard event handlers
   - [ ] Skip links

### Phase 4: Data & Performance Validation (30 minutes)

1. **Implement SchemaValidator**
   - [ ] JSON schema validation
   - [ ] Required field checking
   - [ ] Type validation
   - [ ] Custom validators

2. **Implement PerformanceAnalyzer**
   - [ ] DOM complexity analysis
   - [ ] Resource loading checks
   - [ ] Anti-pattern detection
   - [ ] Performance metrics

### Phase 5: Testing & Integration (15 minutes)

1. **Create test suites**
   - [ ] Unit tests for validators
   - [ ] Integration tests
   - [ ] Performance tests
   - [ ] Edge case tests

2. **Integrate with template system**
   - [ ] Update TemplateRenderer
   - [ ] Add to build process
   - [ ] Create CLI tool
   - [ ] Add to CI/CD

## Testing Requirements

### Unit Tests

```javascript
describe('TemplateValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new TemplateValidator({
      htmlValidator: new HTMLValidator(),
      a11yValidator: new AccessibilityValidator(),
      schemaValidator: new SchemaValidator(),
      perfAnalyzer: new PerformanceAnalyzer()
    });
  });

  describe('HTML Validation', () => {
    it('should detect invalid HTML structure', async () => {
      const html = '<div><p>Unclosed paragraph</div>';
      const result = await validator.validate(html);
      
      expect(result.hasErrors()).toBe(true);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Unclosed tag')
        })
      );
    });

    it('should validate required attributes', async () => {
      const html = '<img src="test.jpg">';
      const result = await validator.validate(html);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('missing alt attribute')
        })
      );
    });
  });

  describe('Accessibility Validation', () => {
    it('should detect missing form labels', async () => {
      const html = '<input type="text" name="username">';
      const result = await validator.validate(html);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('missing label'),
          wcag: '3.3.2'
        })
      );
    });

    it('should check heading hierarchy', async () => {
      const html = '<h1>Title</h1><h3>Subtitle</h3>';
      const result = await validator.validate(html);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Heading level skipped')
        })
      );
    });
  });

  describe('Performance Analysis', () => {
    it('should warn about excessive DOM nodes', async () => {
      const html = generateLargeDOM(2000); // Helper to create large DOM
      const result = await validator.validate(html);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Excessive DOM nodes'),
          metric: 'domNodes'
        })
      );
    });
  });

  describe('Schema Validation', () => {
    it('should validate against schema', async () => {
      const template = (data) => `<h1>${data.title}</h1>`;
      const result = await validator.validate(template, {
        data: { /* missing title */ },
        templateType: 'page'
      });
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Missing required property: title')
        })
      );
    });
  });
});
```

### Performance Tests

```javascript
describe('Validation Performance', () => {
  it('should validate standard template in < 50ms', async () => {
    const validator = new TemplateValidator({ /* deps */ });
    const html = generateStandardPageHTML();
    
    const start = performance.now();
    await validator.validate(html);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(50);
  });

  it('should handle large templates efficiently', async () => {
    const validator = new TemplateValidator({ /* deps */ });
    const html = generateLargeTemplate(); // 10000+ nodes
    
    const start = performance.now();
    await validator.validate(html);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(200);
  });
});
```

## Integration Points

### 1. Build-Time Validation

```javascript
// Webpack plugin for template validation
class TemplateValidationPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('TemplateValidation', async (compilation, callback) => {
      const validator = new TemplateValidator({ /* deps */ });
      
      for (const [filename, asset] of Object.entries(compilation.assets)) {
        if (filename.endsWith('.template.js')) {
          const result = await validator.validate(asset.source());
          
          if (result.hasErrors()) {
            compilation.errors.push(new Error(
              `Template validation failed for ${filename}:\n${result.getFormattedReport()}`
            ));
          }
        }
      }
      
      callback();
    });
  }
}
```

### 2. Runtime Validation

```javascript
// Controller integration
class BaseCharacterBuilderController {
  async renderTemplate(template, data) {
    if (this.#enableValidation) {
      const result = await this.#validator.validate(template, {
        data,
        templateType: this.getTemplateType()
      });
      
      if (result.hasErrors()) {
        console.error('Template validation failed:', result.getFormattedReport());
        
        if (this.#strictMode) {
          throw new TemplateValidationError(result);
        }
      }
    }
    
    // Continue with rendering...
  }
}
```

### 3. CLI Tool

```javascript
// CLI for template validation
#!/usr/bin/env node

const { TemplateValidator } = require('./templateValidator');
const fs = require('fs');
const path = require('path');

const validator = new TemplateValidator({ /* deps */ });

async function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const result = await validator.validate(content);
  
  console.log(`Validating ${filePath}...`);
  console.log(result.getFormattedReport());
  
  return result.valid;
}

// Process files from command line
const files = process.argv.slice(2);
Promise.all(files.map(validateFile)).then(results => {
  const allValid = results.every(r => r);
  process.exit(allValid ? 0 : 1);
});
```

## Error Handling

```javascript
class TemplateValidationError extends Error {
  constructor(result) {
    super('Template validation failed');
    this.name = 'TemplateValidationError';
    this.result = result;
    this.errors = result.errors;
    this.warnings = result.warnings;
  }

  getReport() {
    return this.result.getFormattedReport();
  }
}

class ValidationTimeoutError extends Error {
  constructor(duration) {
    super(`Validation timeout after ${duration}ms`);
    this.name = 'ValidationTimeoutError';
    this.duration = duration;
  }
}
```

## Dependencies

### Internal Dependencies

- Template system components from HTMLTEMP-001 through HTMLTEMP-009
- Event bus for validation events
- Logger for validation reporting

### External Dependencies

- None (pure JavaScript implementation)

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| False positives in validation | Medium | Medium | Thorough testing, configurable rules |
| Performance impact on large templates | Low | Medium | Caching, optimization, async validation |
| Overly strict validation blocking development | Medium | Low | Configurable strictness levels |
| Missing important validation rules | Low | High | Regular updates, community feedback |
| Browser differences in parsing | Low | Medium | Use standard DOM parser |

## Acceptance Criteria

- [ ] All validation categories implemented
- [ ] HTML5 compliance checking works
- [ ] WCAG 2.1 AA validation accurate
- [ ] Performance analysis provides useful insights
- [ ] Validation completes in < 50ms
- [ ] Error messages are clear and actionable
- [ ] Build-time validation integrated
- [ ] Runtime validation configurable
- [ ] All tests passing with > 90% coverage
- [ ] Documentation complete

## Future Enhancements

1. **Visual Validation** - Screenshot comparison
2. **SEO Validation** - Meta tags, structured data
3. **Security Validation** - CSP compliance, XSS detection
4. **i18n Validation** - Translation completeness
5. **Custom Rule Builder** - Visual rule creation tool

## Documentation Requirements

1. **Validation Rule Reference** - All rules explained
2. **Configuration Guide** - How to customize validation
3. **Integration Guide** - Build and runtime setup
4. **Error Reference** - All error messages and fixes
5. **Best Practices** - Template validation patterns

## Definition of Done

- [ ] All code implemented according to specification
- [ ] Unit tests passing with > 90% coverage
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation written and reviewed
- [ ] Code reviewed and approved
- [ ] No critical or high severity bugs
- [ ] Merged to main branch