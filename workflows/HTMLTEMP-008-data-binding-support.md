# HTMLTEMP-008: Add Data Binding Support

## Summary

Implement a comprehensive data binding system for templates that enables safe string interpolation, conditional rendering, list iteration, and event handler attachment while preventing XSS vulnerabilities and maintaining high performance.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 6 hours
- **Dependencies**: HTMLTEMP-007 (Template Composition Engine)

## Objectives

### Primary Goals

1. **Safe String Interpolation** - Implement secure variable substitution in templates
2. **Conditional Rendering** - Support if/else logic in templates
3. **List Iteration** - Enable rendering of arrays and collections
4. **Event Handler Binding** - Attach event handlers to dynamic content
5. **XSS Prevention** - Ensure all user data is properly sanitized
6. **Two-Way Data Binding** (Optional) - Support reactive data updates

### Success Criteria

- [ ] All user-provided data is sanitized before rendering
- [ ] Interpolation syntax is intuitive and consistent
- [ ] Conditional rendering supports complex logic expressions
- [ ] List rendering handles arrays of any size efficiently
- [ ] Event handlers are properly attached and cleaned up
- [ ] No XSS vulnerabilities in any binding scenario
- [ ] Performance remains < 20ms for complex data binding

## Technical Specification

### 1. Data Binding Engine Core

#### File: `src/characterBuilder/templates/utilities/dataBindingEngine.js`

```javascript
/**
 * Data Binding Engine for template system
 * Handles interpolation, conditionals, loops, and event binding
 */
export class DataBindingEngine {
  /**
   * @param {object} config - Engine configuration
   * @param {HTMLSanitizer} config.sanitizer - HTML sanitization service
   * @param {ExpressionEvaluator} config.evaluator - Expression evaluation service
   * @param {EventManager} config.eventManager - Event management service
   */
  constructor({ sanitizer, evaluator, eventManager }) {
    this.#sanitizer = sanitizer;
    this.#evaluator = evaluator;
    this.#eventManager = eventManager;
    this.#bindingCache = new Map();
    this.#activeBindings = new WeakMap();
  }

  /**
   * Process template with data bindings
   * @param {string} template - Template string with binding markers
   * @param {object} data - Data context for bindings
   * @param {object} options - Binding options
   * @returns {object} { html: string, cleanup: Function }
   */
  bind(template, data = {}, options = {}) {
    const {
      sanitize = true,
      cache = true,
      reactive = false
    } = options;

    // Generate cache key if caching enabled
    const cacheKey = cache ? this.#generateCacheKey(template, data) : null;
    
    // Check cache
    if (cacheKey && this.#bindingCache.has(cacheKey)) {
      return this.#bindingCache.get(cacheKey);
    }

    // Process bindings
    let processedHtml = template;
    
    // 1. Process interpolations
    processedHtml = this.#processInterpolations(processedHtml, data, sanitize);
    
    // 2. Process conditionals
    processedHtml = this.#processConditionals(processedHtml, data);
    
    // 3. Process loops
    processedHtml = this.#processLoops(processedHtml, data, sanitize);
    
    // 4. Process event bindings
    const eventCleanup = this.#processEventBindings(processedHtml, data);
    
    // 5. Process attributes
    processedHtml = this.#processAttributeBindings(processedHtml, data);

    const result = {
      html: processedHtml,
      cleanup: () => {
        eventCleanup();
        if (reactive) {
          this.#cleanupReactiveBindings(processedHtml);
        }
      }
    };

    // Cache result
    if (cacheKey) {
      this.#bindingCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Create reactive binding that updates on data changes
   * @param {HTMLElement} element - Target element
   * @param {object} data - Reactive data object
   * @param {string} template - Template to re-render
   */
  createReactiveBinding(element, data, template) {
    // Implementation in reactive binding section
  }
}
```

### 2. String Interpolation System

#### Interpolation Syntax

```javascript
// Basic interpolation
'${variableName}'

// Nested properties
'${user.profile.name}'

// Method calls
'${formatDate(date)}'

// Expressions
'${price * quantity}'

// Filters
'${price | currency}'

// Default values
'${username || "Guest"}'
```

#### Safe Interpolation Implementation

```javascript
/**
 * Process string interpolations with XSS prevention
 */
class InterpolationProcessor {
  constructor({ sanitizer, evaluator }) {
    this.#sanitizer = sanitizer;
    this.#evaluator = evaluator;
    this.#interpolationRegex = /\$\{([^}]+)\}/g;
  }

  /**
   * Process all interpolations in template
   * @param {string} template - Template with interpolation markers
   * @param {object} context - Data context
   * @param {boolean} sanitize - Whether to sanitize output
   * @returns {string} Processed template
   */
  process(template, context, sanitize = true) {
    return template.replace(this.#interpolationRegex, (match, expression) => {
      try {
        // Evaluate expression in context
        const value = this.#evaluator.evaluate(expression, context);
        
        // Convert to string
        const stringValue = this.#convertToString(value);
        
        // Sanitize if needed
        return sanitize ? this.#sanitizer.sanitize(stringValue) : stringValue;
        
      } catch (error) {
        console.error(`Interpolation error for "${expression}":`, error);
        return ''; // Return empty string on error
      }
    });
  }

  /**
   * Convert any value to string safely
   */
  #convertToString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
}
```

### 3. Conditional Rendering System

#### Conditional Syntax

```html
<!-- Simple if -->
<div tb-if="isVisible">
  Content shown when isVisible is true
</div>

<!-- If-else -->
<div tb-if="userRole === 'admin'">
  Admin content
</div>
<div tb-else>
  Regular user content
</div>

<!-- Multiple conditions -->
<div tb-if="score >= 90">A Grade</div>
<div tb-else-if="score >= 80">B Grade</div>
<div tb-else-if="score >= 70">C Grade</div>
<div tb-else>F Grade</div>

<!-- Show/hide (keeps element in DOM) -->
<div tb-show="isVisible">
  Content hidden with display:none when false
</div>
```

#### Conditional Processor Implementation

```javascript
/**
 * Process conditional rendering directives
 */
class ConditionalProcessor {
  constructor({ evaluator }) {
    this.#evaluator = evaluator;
  }

  /**
   * Process conditional directives in HTML
   * @param {string} html - HTML with conditional directives
   * @param {object} context - Data context
   * @returns {string} Processed HTML
   */
  process(html, context) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Process tb-if directives
    this.#processIfDirectives(doc, context);
    
    // Process tb-show directives
    this.#processShowDirectives(doc, context);
    
    return doc.body.innerHTML;
  }

  /**
   * Process tb-if and related directives
   */
  #processIfDirectives(doc, context) {
    const ifElements = doc.querySelectorAll('[tb-if]');
    
    ifElements.forEach(element => {
      const condition = element.getAttribute('tb-if');
      const shouldRender = this.#evaluator.evaluate(condition, context);
      
      if (!shouldRender) {
        // Check for tb-else or tb-else-if siblings
        let nextSibling = element.nextElementSibling;
        let rendered = false;
        
        while (nextSibling && !rendered) {
          if (nextSibling.hasAttribute('tb-else-if')) {
            const elseIfCondition = nextSibling.getAttribute('tb-else-if');
            if (this.#evaluator.evaluate(elseIfCondition, context)) {
              // Keep this element, remove others
              element.remove();
              rendered = true;
            } else {
              const temp = nextSibling.nextElementSibling;
              nextSibling.remove();
              nextSibling = temp;
            }
          } else if (nextSibling.hasAttribute('tb-else')) {
            // Keep else block
            element.remove();
            rendered = true;
          } else {
            break;
          }
        }
        
        if (!rendered) {
          element.remove();
        }
      }
      
      // Remove directive attributes
      element.removeAttribute('tb-if');
    });
  }

  /**
   * Process tb-show directives (visibility toggle)
   */
  #processShowDirectives(doc, context) {
    const showElements = doc.querySelectorAll('[tb-show]');
    
    showElements.forEach(element => {
      const condition = element.getAttribute('tb-show');
      const shouldShow = this.#evaluator.evaluate(condition, context);
      
      if (!shouldShow) {
        element.style.display = 'none';
      }
      
      element.removeAttribute('tb-show');
    });
  }
}
```

### 4. List Rendering System

#### List Syntax

```html
<!-- Basic list -->
<ul>
  <li tb-for="item in items">
    ${item.name}
  </li>
</ul>

<!-- With index -->
<ul>
  <li tb-for="(item, index) in items">
    ${index}: ${item.name}
  </li>
</ul>

<!-- Object iteration -->
<dl>
  <template tb-for="(value, key) in object">
    <dt>${key}</dt>
    <dd>${value}</dd>
  </template>
</dl>

<!-- Nested loops -->
<div tb-for="category in categories">
  <h2>${category.name}</h2>
  <ul>
    <li tb-for="item in category.items">
      ${item.title}
    </li>
  </ul>
</div>
```

#### List Processor Implementation

```javascript
/**
 * Process list rendering directives
 */
class ListProcessor {
  constructor({ interpolationProcessor, sanitizer }) {
    this.#interpolationProcessor = interpolationProcessor;
    this.#sanitizer = sanitizer;
  }

  /**
   * Process tb-for directives
   * @param {string} html - HTML with list directives
   * @param {object} context - Data context
   * @param {boolean} sanitize - Whether to sanitize content
   * @returns {string} Processed HTML
   */
  process(html, context, sanitize = true) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all tb-for elements (process deepest first)
    const forElements = Array.from(doc.querySelectorAll('[tb-for]'))
      .sort((a, b) => b.compareDocumentPosition(a) & 2 ? -1 : 1);
    
    forElements.forEach(element => {
      const forExpression = element.getAttribute('tb-for');
      const parsed = this.#parseForExpression(forExpression);
      
      if (parsed) {
        const { itemName, indexName, collectionExpr } = parsed;
        const collection = this.#evaluateCollection(collectionExpr, context);
        
        if (collection) {
          const renderedItems = this.#renderListItems(
            element,
            collection,
            itemName,
            indexName,
            context,
            sanitize
          );
          
          // Replace element with rendered items
          const fragment = document.createDocumentFragment();
          renderedItems.forEach(item => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item;
            while (tempDiv.firstChild) {
              fragment.appendChild(tempDiv.firstChild);
            }
          });
          
          element.parentNode.replaceChild(fragment, element);
        } else {
          element.remove();
        }
      }
    });
    
    return doc.body.innerHTML;
  }

  /**
   * Parse tb-for expression
   */
  #parseForExpression(expr) {
    // Match patterns like "item in items" or "(item, index) in items"
    const match = expr.match(/^\s*(?:\(([^,]+),\s*([^)]+)\)|([^,]+))\s+in\s+(.+)$/);
    
    if (match) {
      if (match[1] && match[2]) {
        // (item, index) in items
        return {
          itemName: match[1].trim(),
          indexName: match[2].trim(),
          collectionExpr: match[4].trim()
        };
      } else {
        // item in items
        return {
          itemName: match[3].trim(),
          indexName: null,
          collectionExpr: match[4].trim()
        };
      }
    }
    
    return null;
  }

  /**
   * Render list items
   */
  #renderListItems(template, collection, itemName, indexName, parentContext, sanitize) {
    const items = [];
    const templateHtml = template.innerHTML;
    template.removeAttribute('tb-for');
    
    // Handle arrays
    if (Array.isArray(collection)) {
      collection.forEach((item, index) => {
        const itemContext = {
          ...parentContext,
          [itemName]: item
        };
        
        if (indexName) {
          itemContext[indexName] = index;
        }
        
        const rendered = this.#interpolationProcessor.process(
          templateHtml,
          itemContext,
          sanitize
        );
        
        items.push(rendered);
      });
    }
    // Handle objects
    else if (typeof collection === 'object') {
      Object.entries(collection).forEach(([key, value], index) => {
        const itemContext = {
          ...parentContext,
          [itemName]: value
        };
        
        if (indexName) {
          itemContext[indexName] = key;
        }
        
        const rendered = this.#interpolationProcessor.process(
          templateHtml,
          itemContext,
          sanitize
        );
        
        items.push(rendered);
      });
    }
    
    return items;
  }
}
```

### 5. Event Binding System

#### Event Binding Syntax

```html
<!-- Click handler -->
<button tb-on:click="handleClick">Click Me</button>

<!-- With arguments -->
<button tb-on:click="deleteItem(item.id)">Delete</button>

<!-- Event modifiers -->
<form tb-on:submit.prevent="handleSubmit">
  <input tb-on:keyup.enter="submit">
</form>

<!-- Multiple events -->
<div tb-on:mouseenter="showTooltip" tb-on:mouseleave="hideTooltip">
  Hover me
</div>
```

#### Event Binding Implementation

```javascript
/**
 * Handles event binding for templates
 */
class EventBindingProcessor {
  constructor({ evaluator, eventManager }) {
    this.#evaluator = evaluator;
    this.#eventManager = eventManager;
    this.#boundHandlers = new WeakMap();
  }

  /**
   * Process event bindings in HTML
   * @param {string} html - HTML with event directives
   * @param {object} context - Data context with event handlers
   * @returns {Function} Cleanup function
   */
  process(html, context) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const cleanupFunctions = [];
    
    // Find all elements with tb-on: attributes
    const elements = doc.querySelectorAll('[*|tb-on]');
    
    elements.forEach(element => {
      const attributes = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('tb-on:'));
      
      attributes.forEach(attr => {
        const [, eventWithModifiers] = attr.name.split(':');
        const [eventName, ...modifiers] = eventWithModifiers.split('.');
        const handlerExpr = attr.value;
        
        // Create event handler
        const handler = this.#createEventHandler(
          handlerExpr,
          context,
          modifiers
        );
        
        // Store for cleanup
        if (!this.#boundHandlers.has(element)) {
          this.#boundHandlers.set(element, []);
        }
        this.#boundHandlers.get(element).push({
          eventName,
          handler
        });
        
        // Add cleanup function
        cleanupFunctions.push(() => {
          element.removeEventListener(eventName, handler);
        });
        
        // Remove directive attribute
        element.removeAttribute(attr.name);
      });
    });
    
    // Return combined cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }

  /**
   * Create event handler with modifiers
   */
  #createEventHandler(expression, context, modifiers = []) {
    return (event) => {
      // Apply modifiers
      if (modifiers.includes('prevent')) {
        event.preventDefault();
      }
      if (modifiers.includes('stop')) {
        event.stopPropagation();
      }
      if (modifiers.includes('once')) {
        event.currentTarget.removeEventListener(event.type, arguments.callee);
      }
      
      // Parse handler expression
      const match = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\((.*)\)$/);
      
      if (match) {
        // Method call with arguments
        const [, methodName, argsExpr] = match;
        const method = this.#evaluator.evaluate(methodName, context);
        
        if (typeof method === 'function') {
          const args = argsExpr ? 
            this.#evaluator.evaluate(`[${argsExpr}]`, { ...context, event }) : 
            [];
          method.apply(context, args);
        }
      } else {
        // Simple method reference
        const handler = this.#evaluator.evaluate(expression, context);
        if (typeof handler === 'function') {
          handler.call(context, event);
        }
      }
    };
  }
}
```

### 6. HTML Sanitization Service

```javascript
/**
 * Sanitizes HTML to prevent XSS attacks
 */
export class HTMLSanitizer {
  constructor() {
    // Whitelist of allowed tags
    this.#allowedTags = new Set([
      'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ]);
    
    // Whitelist of allowed attributes
    this.#allowedAttributes = new Map([
      ['a', ['href', 'title', 'target']],
      ['img', ['src', 'alt', 'width', 'height']],
      ['*', ['class', 'id', 'data-*']]
    ]);
    
    // Dangerous protocols to block
    this.#dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
  }

  /**
   * Sanitize HTML string
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  sanitize(html) {
    // Handle null/undefined
    if (html == null) return '';
    
    // Convert to string
    const htmlStr = String(html);
    
    // Basic escaping for plain text
    if (!htmlStr.includes('<')) {
      return this.#escapeHtml(htmlStr);
    }
    
    // Parse and sanitize HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    
    // Recursively sanitize nodes
    this.#sanitizeNode(doc.body);
    
    return doc.body.innerHTML;
  }

  /**
   * Escape HTML special characters
   */
  #escapeHtml(text) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, char => escapeMap[char]);
  }

  /**
   * Recursively sanitize DOM nodes
   */
  #sanitizeNode(node) {
    // Process child nodes first (to handle removals)
    const children = Array.from(node.childNodes);
    children.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        // Check if tag is allowed
        if (!this.#allowedTags.has(child.tagName.toLowerCase())) {
          child.remove();
          return;
        }
        
        // Sanitize attributes
        this.#sanitizeAttributes(child);
        
        // Recursively sanitize children
        this.#sanitizeNode(child);
      } else if (child.nodeType === Node.TEXT_NODE) {
        // Text nodes are safe
      } else {
        // Remove other node types (comments, etc.)
        child.remove();
      }
    });
  }

  /**
   * Sanitize element attributes
   */
  #sanitizeAttributes(element) {
    const tagName = element.tagName.toLowerCase();
    const allowedForTag = this.#allowedAttributes.get(tagName) || [];
    const allowedGlobal = this.#allowedAttributes.get('*') || [];
    const allowed = new Set([...allowedForTag, ...allowedGlobal]);
    
    // Check each attribute
    Array.from(element.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      
      // Check if attribute is allowed
      let isAllowed = allowed.has(attrName);
      
      // Check data-* attributes
      if (!isAllowed && attrName.startsWith('data-')) {
        isAllowed = allowed.has('data-*');
      }
      
      if (!isAllowed) {
        element.removeAttribute(attr.name);
        return;
      }
      
      // Sanitize attribute value
      if (attrName === 'href' || attrName === 'src') {
        if (this.#isDangerousUrl(attr.value)) {
          element.removeAttribute(attr.name);
        }
      }
    });
  }

  /**
   * Check if URL contains dangerous protocol
   */
  #isDangerousUrl(url) {
    const normalizedUrl = url.trim().toLowerCase();
    return this.#dangerousProtocols.some(protocol => 
      normalizedUrl.startsWith(protocol)
    );
  }
}
```

### 7. Expression Evaluator

```javascript
/**
 * Safely evaluates expressions in context
 */
export class ExpressionEvaluator {
  constructor() {
    this.#cache = new Map();
    this.#maxCacheSize = 1000;
  }

  /**
   * Evaluate expression in given context
   * @param {string} expression - Expression to evaluate
   * @param {object} context - Data context
   * @returns {*} Evaluation result
   */
  evaluate(expression, context = {}) {
    // Check cache
    const cacheKey = `${expression}:${JSON.stringify(context)}`;
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }
    
    try {
      // Create safe evaluation function
      const func = this.#createSafeFunction(expression, Object.keys(context));
      const result = func(...Object.values(context));
      
      // Cache result
      this.#addToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`Expression evaluation error: ${expression}`, error);
      return undefined;
    }
  }

  /**
   * Create safe function for expression evaluation
   */
  #createSafeFunction(expression, contextKeys) {
    // Sanitize expression to prevent code injection
    const sanitized = this.#sanitizeExpression(expression);
    
    // Create function with restricted scope
    return new Function(...contextKeys, `
      'use strict';
      try {
        return (${sanitized});
      } catch (e) {
        return undefined;
      }
    `);
  }

  /**
   * Sanitize expression to prevent malicious code
   */
  #sanitizeExpression(expr) {
    // Remove potentially dangerous constructs
    const dangerous = [
      'eval', 'Function', 'setTimeout', 'setInterval',
      'require', 'import', 'export', '__proto__'
    ];
    
    let sanitized = expr;
    dangerous.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      sanitized = sanitized.replace(regex, 'undefined');
    });
    
    return sanitized;
  }

  /**
   * Add result to cache with size limit
   */
  #addToCache(key, value) {
    if (this.#cache.size >= this.#maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }
    this.#cache.set(key, value);
  }
}
```

## Implementation Tasks

### Phase 1: Core Engine Setup (1 hour)

1. **Create DataBindingEngine class**
   - [ ] Set up class structure with dependencies
   - [ ] Implement main bind() method
   - [ ] Add caching mechanism
   - [ ] Create cleanup system

2. **Implement HTMLSanitizer**
   - [ ] Create sanitization rules
   - [ ] Implement tag whitelisting
   - [ ] Add attribute filtering
   - [ ] Handle dangerous protocols

3. **Build ExpressionEvaluator**
   - [ ] Create safe evaluation function
   - [ ] Add expression sanitization
   - [ ] Implement caching
   - [ ] Handle errors gracefully

### Phase 2: Interpolation System (1 hour)

1. **Implement InterpolationProcessor**
   - [ ] Create regex pattern for interpolations
   - [ ] Process variable substitutions
   - [ ] Handle nested properties
   - [ ] Support expressions and filters

2. **Add filter support**
   - [ ] Create filter registry
   - [ ] Implement common filters (currency, date, etc.)
   - [ ] Support custom filters
   - [ ] Chain multiple filters

### Phase 3: Conditional Rendering (1 hour)

1. **Implement ConditionalProcessor**
   - [ ] Parse conditional directives
   - [ ] Evaluate conditions
   - [ ] Handle if/else chains
   - [ ] Support show/hide directives

2. **Add complex condition support**
   - [ ] Logical operators (&&, ||, !)
   - [ ] Comparison operators
   - [ ] Ternary expressions
   - [ ] Method calls in conditions

### Phase 4: List Rendering (1 hour)

1. **Implement ListProcessor**
   - [ ] Parse for expressions
   - [ ] Handle array iteration
   - [ ] Support object iteration
   - [ ] Enable nested loops

2. **Optimize list rendering**
   - [ ] Implement virtual scrolling for large lists
   - [ ] Add key-based tracking
   - [ ] Minimize DOM operations
   - [ ] Cache rendered items

### Phase 5: Event Binding (1 hour)

1. **Implement EventBindingProcessor**
   - [ ] Parse event directives
   - [ ] Create event handlers
   - [ ] Support event modifiers
   - [ ] Handle method arguments

2. **Add event management**
   - [ ] Track bound handlers
   - [ ] Implement cleanup
   - [ ] Prevent memory leaks
   - [ ] Support delegation

### Phase 6: Testing & Integration (1 hour)

1. **Create comprehensive tests**
   - [ ] Unit tests for each processor
   - [ ] Integration tests for combined features
   - [ ] XSS vulnerability tests
   - [ ] Performance benchmarks

2. **Integrate with template system**
   - [ ] Update TemplateRenderer
   - [ ] Modify TemplateComposer
   - [ ] Update controllers
   - [ ] Add documentation

## Code Examples

### Example 1: Basic Data Binding

```javascript
const engine = new DataBindingEngine({ sanitizer, evaluator, eventManager });

const template = `
  <div class="user-card">
    <h2>\${user.name}</h2>
    <p tb-if="user.age >= 18">Adult User</p>
    <p tb-else>Minor User</p>
    <ul>
      <li tb-for="skill in user.skills">
        \${skill.name} - Level \${skill.level}
      </li>
    </ul>
    <button tb-on:click="editUser(user.id)">Edit</button>
  </div>
`;

const data = {
  user: {
    name: 'John Doe',
    age: 25,
    skills: [
      { name: 'JavaScript', level: 'Expert' },
      { name: 'Python', level: 'Intermediate' }
    ]
  },
  editUser: (id) => console.log('Editing user:', id)
};

const { html, cleanup } = engine.bind(template, data);
document.getElementById('container').innerHTML = html;

// Later: cleanup event handlers
cleanup();
```

### Example 2: Complex Conditional Rendering

```javascript
const template = `
  <div class="grade-display">
    <h3>Student: \${student.name}</h3>
    <div tb-if="student.score >= 90" class="grade-a">
      Excellent! Grade: A
    </div>
    <div tb-else-if="student.score >= 80" class="grade-b">
      Good! Grade: B
    </div>
    <div tb-else-if="student.score >= 70" class="grade-c">
      Average. Grade: C
    </div>
    <div tb-else class="grade-f">
      Needs Improvement. Grade: F
    </div>
    
    <div tb-show="student.hasScholarship" class="scholarship-badge">
      🏆 Scholarship Recipient
    </div>
  </div>
`;

const data = {
  student: {
    name: 'Jane Smith',
    score: 85,
    hasScholarship: true
  }
};
```

### Example 3: Event Binding with Modifiers

```javascript
const template = `
  <form tb-on:submit.prevent="handleSubmit">
    <input 
      type="text" 
      tb-on:input="updateValue"
      tb-on:keyup.enter="submitForm"
      value="\${formData.name}"
    >
    <button type="submit">Submit</button>
    
    <div tb-on:click.stop="handleClick">
      Click won't bubble up
    </div>
  </form>
`;

const data = {
  formData: { name: '' },
  updateValue: (e) => {
    data.formData.name = e.target.value;
  },
  handleSubmit: (e) => {
    console.log('Form submitted:', data.formData);
  },
  submitForm: () => {
    console.log('Enter key pressed');
  },
  handleClick: () => {
    console.log('Clicked');
  }
};
```

## Testing Requirements

### Unit Tests

```javascript
describe('DataBindingEngine', () => {
  describe('Interpolation', () => {
    it('should interpolate simple variables', () => {
      const result = engine.bind('Hello \${name}', { name: 'World' });
      expect(result.html).toBe('Hello World');
    });

    it('should handle nested properties', () => {
      const result = engine.bind('\${user.profile.name}', {
        user: { profile: { name: 'John' } }
      });
      expect(result.html).toBe('John');
    });

    it('should sanitize user input', () => {
      const result = engine.bind('\${userInput}', {
        userInput: '<script>alert("XSS")</script>'
      });
      expect(result.html).not.toContain('<script>');
    });
  });

  describe('Conditional Rendering', () => {
    it('should render conditionally', () => {
      const template = '<div tb-if="show">Content</div>';
      const shown = engine.bind(template, { show: true });
      const hidden = engine.bind(template, { show: false });
      
      expect(shown.html).toContain('Content');
      expect(hidden.html).not.toContain('Content');
    });
  });

  describe('List Rendering', () => {
    it('should render arrays', () => {
      const template = '<li tb-for="item in items">\${item}</li>';
      const result = engine.bind(template, {
        items: ['A', 'B', 'C']
      });
      
      expect(result.html).toContain('<li>A</li>');
      expect(result.html).toContain('<li>B</li>');
      expect(result.html).toContain('<li>C</li>');
    });
  });
});

describe('HTMLSanitizer', () => {
  it('should remove dangerous tags', () => {
    const sanitizer = new HTMLSanitizer();
    const result = sanitizer.sanitize('<script>alert("XSS")</script>');
    expect(result).not.toContain('<script>');
  });

  it('should remove dangerous attributes', () => {
    const sanitizer = new HTMLSanitizer();
    const result = sanitizer.sanitize('<a href="javascript:alert(1)">Link</a>');
    expect(result).not.toContain('javascript:');
  });
});
```

### Performance Tests

```javascript
describe('Data Binding Performance', () => {
  it('should bind complex template in < 20ms', () => {
    const template = generateComplexTemplate(); // Large template with many bindings
    const data = generateLargeDataset(); // Large data object
    
    const start = performance.now();
    const result = engine.bind(template, data);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(20);
  });

  it('should handle large lists efficiently', () => {
    const template = '<li tb-for="item in items">\${item.name}</li>';
    const data = {
      items: Array(1000).fill().map((_, i) => ({ name: `Item ${i}` }))
    };
    
    const start = performance.now();
    const result = engine.bind(template, data);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});
```

## Security Considerations

### XSS Prevention

1. **All user data must be sanitized** before rendering
2. **Expression evaluation must be sandboxed**
3. **Event handlers must be validated**
4. **URL attributes must be checked** for dangerous protocols
5. **Template sources must be trusted**

### Content Security Policy

```javascript
// Recommended CSP headers
const cspHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Required for event handlers
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};
```

## Dependencies

### Internal Dependencies

- `TemplateComposer` from HTMLTEMP-007
- `TemplateRenderer` (will be updated to use DataBindingEngine)
- `TemplateCache` for caching bound templates
- Event bus system for event management

### External Dependencies

- None required (pure JavaScript implementation)

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| XSS vulnerabilities | High | Critical | Comprehensive sanitization and testing |
| Performance issues with large datasets | Medium | High | Implement virtual scrolling and caching |
| Memory leaks from event handlers | Medium | High | Proper cleanup and WeakMap usage |
| Expression evaluation errors | Medium | Medium | Safe evaluation with error handling |
| Browser compatibility issues | Low | Medium | Use standard DOM APIs only |

## Acceptance Criteria

- [ ] All data binding features implemented and working
- [ ] XSS prevention measures in place and tested
- [ ] Performance targets met (< 20ms for complex binding)
- [ ] Event handlers properly attached and cleaned up
- [ ] No memory leaks detected
- [ ] Comprehensive test coverage (> 90%)
- [ ] Documentation complete with examples
- [ ] Integration with existing template system verified
- [ ] Security review completed and passed

## Future Enhancements

1. **Two-way data binding** with reactive updates
2. **Computed properties** and watchers
3. **Custom directives** system
4. **Template validation** at build time
5. **Virtual DOM** for optimal updates
6. **Async data loading** with loading states

## Documentation Requirements

1. **API Documentation** - Complete JSDoc for all public APIs
2. **Security Guide** - Best practices for secure templates
3. **Performance Guide** - Optimization techniques
4. **Migration Guide** - Converting existing templates
5. **Directive Reference** - All directives with examples

## Definition of Done

- [ ] All code implemented according to specification
- [ ] Unit tests passing with > 90% coverage
- [ ] Integration tests passing
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation written and reviewed
- [ ] Code reviewed and approved
- [ ] No known security vulnerabilities
- [ ] Merged to main branch