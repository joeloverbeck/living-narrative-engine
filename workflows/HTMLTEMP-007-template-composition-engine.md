# HTMLTEMP-007: Implement Template Composition Engine

## Summary

Implement a robust template composition engine that enables nested template support, slot-based content injection, and dynamic component assembly. This ticket establishes the foundation for complex template hierarchies and reusable component composition patterns.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 5 hours
- **Dependencies**: HTMLTEMP-001 through HTMLTEMP-006 (completed)

## Objectives

### Primary Goals

1. **Enable Nested Template Composition** - Support templates containing other templates to any depth
2. **Implement Slot-Based Content Injection** - Allow parent templates to inject content into specific child template slots
3. **Create Component Assembly System** - Build mechanism for dynamically assembling components
4. **Support Template Inheritance** - Enable templates to extend and override parent templates
5. **Optimize Rendering Performance** - Ensure efficient composition with minimal overhead

### Success Criteria

- [ ] Templates can be nested to at least 5 levels deep without performance degradation
- [ ] Slot system supports named and default slots
- [ ] Composition maintains < 10ms rendering time for standard pages
- [ ] All compositions produce valid, accessible HTML5 markup
- [ ] Memory usage remains stable with repeated compositions
- [ ] Template inheritance supports multiple levels of extension

## Technical Specification

### 1. Core Composition Engine

#### File: `src/characterBuilder/templates/utilities/templateComposer.js`

```javascript
/**
 * Template Composition Engine
 * Handles nested template composition and slot-based content injection
 */
export class TemplateComposer {
  /**
   * @param {object} config - Composer configuration
   * @param {TemplateRegistry} config.registry - Template registry instance
   * @param {TemplateCache} config.cache - Template cache instance
   * @param {TemplateValidator} config.validator - Template validator instance
   */
  constructor({ registry, cache, validator }) {
    this.#registry = registry;
    this.#cache = cache;
    this.#validator = validator;
    this.#compositionDepth = 0;
    this.#maxDepth = 10; // Prevent infinite recursion
  }

  /**
   * Compose a template with nested templates and slots
   * @param {string|Function} template - Template to compose
   * @param {object} context - Composition context
   * @returns {string} Composed HTML
   */
  compose(template, context = {}) {
    // Implementation details in section below
  }

  /**
   * Process slot content injection
   * @param {string} html - HTML with slot markers
   * @param {object} slots - Slot content map
   * @returns {string} HTML with injected slot content
   */
  processSlots(html, slots = {}) {
    // Implementation details in section below
  }

  /**
   * Resolve nested template references
   * @param {string} html - HTML with template references
   * @param {object} context - Resolution context
   * @returns {string} HTML with resolved templates
   */
  resolveNested(html, context) {
    // Implementation details in section below
  }
}
```

### 2. Slot System Implementation

#### Slot Marker Syntax

```html
<!-- Default slot -->
<slot></slot>

<!-- Named slot -->
<slot name="header"></slot>

<!-- Slot with fallback content -->
<slot name="footer">Default footer content</slot>

<!-- Conditional slot -->
<slot name="sidebar" if="showSidebar"></slot>
```

#### Slot Content Provider

```javascript
/**
 * Manages slot content for template composition
 */
export class SlotContentProvider {
  constructor() {
    this.#slots = new Map();
    this.#defaultSlot = null;
  }

  /**
   * Register slot content
   * @param {string} name - Slot name (null for default)
   * @param {string|Function} content - Slot content
   */
  setSlot(name, content) {
    if (!name) {
      this.#defaultSlot = content;
    } else {
      this.#slots.set(name, content);
    }
  }

  /**
   * Get slot content by name
   * @param {string} name - Slot name
   * @param {*} fallback - Fallback content
   * @returns {string} Slot content
   */
  getSlot(name, fallback = '') {
    if (!name) return this.#defaultSlot || fallback;
    return this.#slots.get(name) || fallback;
  }

  /**
   * Check if slot exists
   * @param {string} name - Slot name
   * @returns {boolean}
   */
  hasSlot(name) {
    return name ? this.#slots.has(name) : !!this.#defaultSlot;
  }

  /**
   * Clear all slots
   */
  clear() {
    this.#slots.clear();
    this.#defaultSlot = null;
  }
}
```

### 3. Template Inheritance System

#### Base Template Definition

```javascript
/**
 * Base template that can be extended
 */
export function createBaseTemplate({ blocks = {} } = {}) {
  return {
    type: 'base',
    blocks: {
      header: blocks.header || '<header>Default Header</header>',
      main: blocks.main || '<main>Default Content</main>',
      footer: blocks.footer || '<footer>Default Footer</footer>',
    },
    render(overrides = {}) {
      const mergedBlocks = { ...this.blocks, ...overrides };
      return `
        <div class="template-container">
          ${mergedBlocks.header}
          ${mergedBlocks.main}
          ${mergedBlocks.footer}
        </div>
      `;
    }
  };
}

/**
 * Extend a base template
 */
export function extendTemplate(baseTemplate, extensions = {}) {
  return {
    ...baseTemplate,
    type: 'extended',
    parent: baseTemplate,
    blocks: {
      ...baseTemplate.blocks,
      ...extensions.blocks
    },
    render(overrides = {}) {
      const finalBlocks = {
        ...this.blocks,
        ...overrides
      };
      return baseTemplate.render.call(this, finalBlocks);
    }
  };
}
```

### 4. Component Assembly System

#### Dynamic Component Assembler

```javascript
/**
 * Assembles components dynamically based on configuration
 */
export class ComponentAssembler {
  constructor({ composer, registry }) {
    this.#composer = composer;
    this.#registry = registry;
  }

  /**
   * Assemble components based on configuration
   * @param {object} config - Assembly configuration
   * @returns {string} Assembled HTML
   */
  assemble(config) {
    const {
      layout = 'default',
      components = [],
      props = {},
      slots = {}
    } = config;

    // Get layout template
    const layoutTemplate = this.#registry.get(`layout:${layout}`);
    if (!layoutTemplate) {
      throw new Error(`Layout template not found: ${layout}`);
    }

    // Prepare slot content from components
    const slotProvider = new SlotContentProvider();
    
    for (const component of components) {
      const { type, slot = 'default', props: componentProps = {} } = component;
      const template = this.#registry.get(`component:${type}`);
      
      if (template) {
        const content = this.#composer.compose(template, {
          ...props,
          ...componentProps
        });
        
        slotProvider.setSlot(slot, content);
      }
    }

    // Compose layout with slots
    return this.#composer.compose(layoutTemplate, {
      props,
      slots: slotProvider
    });
  }

  /**
   * Batch assemble multiple configurations
   * @param {Array<object>} configs - Array of assembly configurations
   * @returns {Array<string>} Array of assembled HTML
   */
  assembleBatch(configs) {
    return configs.map(config => this.assemble(config));
  }
}
```

### 5. Composition Performance Optimization

#### Composition Cache Strategy

```javascript
/**
 * Caches composition results for performance
 */
export class CompositionCache {
  constructor({ maxSize = 100, ttl = 3600000 }) {
    this.#cache = new Map();
    this.#maxSize = maxSize;
    this.#ttl = ttl;
  }

  /**
   * Generate cache key from composition parameters
   */
  generateKey(template, context) {
    const templateId = typeof template === 'string' ? template : template.name;
    const contextHash = this.#hashObject(context);
    return `${templateId}:${contextHash}`;
  }

  /**
   * Get cached composition
   */
  get(key) {
    const entry = this.#cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.#ttl) {
      this.#cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Store composition result
   */
  set(key, value) {
    // Implement LRU eviction if needed
    if (this.#cache.size >= this.#maxSize) {
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }

    this.#cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Hash object for cache key generation
   */
  #hashObject(obj) {
    return JSON.stringify(obj)
      .split('')
      .reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(36);
  }
}
```

## Implementation Tasks

### Phase 1: Core Engine Setup (1.5 hours)

1. **Create TemplateComposer class structure**
   - [ ] Set up class with dependency injection
   - [ ] Implement composition depth tracking
   - [ ] Add recursion prevention mechanisms
   - [ ] Create error handling framework

2. **Implement basic compose method**
   - [ ] Parse template structure
   - [ ] Identify nested templates
   - [ ] Process simple compositions
   - [ ] Handle edge cases

3. **Add composition context management**
   - [ ] Context inheritance through levels
   - [ ] Scoped variable resolution
   - [ ] Context isolation between siblings

### Phase 2: Slot System (1.5 hours)

1. **Implement slot parsing**
   - [ ] Identify slot markers in HTML
   - [ ] Parse slot attributes (name, conditions)
   - [ ] Extract fallback content
   - [ ] Validate slot syntax

2. **Create SlotContentProvider**
   - [ ] Implement slot registration
   - [ ] Add content retrieval methods
   - [ ] Handle default slots
   - [ ] Support conditional slots

3. **Build slot injection mechanism**
   - [ ] Replace slot markers with content
   - [ ] Process nested slots
   - [ ] Handle missing slot content
   - [ ] Maintain HTML structure

### Phase 3: Template Inheritance (1 hour)

1. **Design inheritance model**
   - [ ] Define base template structure
   - [ ] Create extension mechanism
   - [ ] Support block overrides
   - [ ] Enable multiple inheritance levels

2. **Implement inheritance resolver**
   - [ ] Traverse inheritance chain
   - [ ] Merge template blocks
   - [ ] Resolve conflicts
   - [ ] Optimize inheritance lookups

### Phase 4: Component Assembly (1 hour)

1. **Create ComponentAssembler**
   - [ ] Parse assembly configurations
   - [ ] Resolve component templates
   - [ ] Map components to slots
   - [ ] Handle component props

2. **Implement batch assembly**
   - [ ] Process multiple configurations
   - [ ] Optimize batch operations
   - [ ] Handle errors gracefully
   - [ ] Support parallel assembly

### Phase 5: Performance & Testing (1 hour)

1. **Add composition caching**
   - [ ] Implement cache key generation
   - [ ] Create LRU eviction strategy
   - [ ] Add cache invalidation hooks
   - [ ] Monitor cache effectiveness

2. **Performance optimization**
   - [ ] Profile composition operations
   - [ ] Optimize string operations
   - [ ] Reduce memory allocations
   - [ ] Implement lazy evaluation

3. **Create comprehensive tests**
   - [ ] Unit tests for each component
   - [ ] Integration tests for composition
   - [ ] Performance benchmarks
   - [ ] Memory leak detection

## Code Examples

### Example 1: Simple Composition

```javascript
// Define a card template with slots
const cardTemplate = `
  <div class="card">
    <div class="card-header">
      <slot name="header">Default Header</slot>
    </div>
    <div class="card-body">
      <slot></slot>
    </div>
    <div class="card-footer">
      <slot name="footer">Default Footer</slot>
    </div>
  </div>
`;

// Compose with content
const composer = new TemplateComposer({ registry, cache, validator });
const result = composer.compose(cardTemplate, {
  slots: {
    header: '<h2>Custom Header</h2>',
    default: '<p>Card content goes here</p>',
    footer: '<button>Action</button>'
  }
});
```

### Example 2: Nested Templates

```javascript
// Parent template
const pageTemplate = {
  render: (context) => `
    <div class="page">
      ${composer.compose('header-template', context)}
      <main>
        ${composer.compose('content-template', context)}
      </main>
      ${composer.compose('footer-template', context)}
    </div>
  `
};

// Compose nested structure
const html = composer.compose(pageTemplate, {
  title: 'My Page',
  content: 'Page content',
  user: { name: 'John Doe' }
});
```

### Example 3: Template Inheritance

```javascript
// Base layout
const baseLayout = createBaseTemplate({
  blocks: {
    header: '<header>Site Header</header>',
    main: '<main><slot></slot></main>',
    footer: '<footer>Site Footer</footer>'
  }
});

// Extended layout
const customLayout = extendTemplate(baseLayout, {
  blocks: {
    header: '<header>Custom Header with Navigation</header>',
    // main is inherited
    // footer is inherited
  }
});

// Use extended layout
const html = customLayout.render({
  main: '<article>Article content</article>'
});
```

## Testing Requirements

### Unit Tests

```javascript
describe('TemplateComposer', () => {
  describe('compose()', () => {
    it('should compose simple templates', () => {
      const template = '<div>${content}</div>';
      const result = composer.compose(template, { content: 'Hello' });
      expect(result).toBe('<div>Hello</div>');
    });

    it('should handle nested templates', () => {
      // Test nested composition
    });

    it('should prevent infinite recursion', () => {
      // Test recursion prevention
    });
  });

  describe('processSlots()', () => {
    it('should inject slot content', () => {
      const html = '<div><slot name="header"></slot></div>';
      const result = composer.processSlots(html, {
        header: '<h1>Title</h1>'
      });
      expect(result).toContain('<h1>Title</h1>');
    });

    it('should use fallback content for missing slots', () => {
      // Test fallback behavior
    });
  });
});

describe('ComponentAssembler', () => {
  it('should assemble components into layout', () => {
    const config = {
      layout: 'two-column',
      components: [
        { type: 'navigation', slot: 'sidebar' },
        { type: 'content', slot: 'main' }
      ]
    };
    
    const result = assembler.assemble(config);
    expect(result).toContain('navigation');
    expect(result).toContain('content');
  });
});
```

### Performance Tests

```javascript
describe('Composition Performance', () => {
  it('should compose standard page in < 10ms', () => {
    const start = performance.now();
    
    const result = composer.compose(complexPageTemplate, {
      // Complex context with multiple nested templates
    });
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should handle deep nesting efficiently', () => {
    // Test 5+ levels of nesting
  });

  it('should not leak memory with repeated compositions', () => {
    // Memory leak detection test
  });
});
```

## Integration Points

### 1. Integration with TemplateRenderer

```javascript
// TemplateRenderer will use TemplateComposer for complex templates
class TemplateRenderer {
  constructor({ composer, ...deps }) {
    this.#composer = composer;
  }

  render(template, data) {
    // Use composer for templates with composition markers
    if (this.#hasCompositionMarkers(template)) {
      return this.#composer.compose(template, data);
    }
    // Simple rendering for basic templates
    return this.#simpleRender(template, data);
  }
}
```

### 2. Integration with BaseCharacterBuilderController

```javascript
// Controllers can use composition for complex layouts
class ConcreteController extends BaseCharacterBuilderController {
  createPageTemplate(config) {
    const assembler = this.getComponentAssembler();
    
    return assembler.assemble({
      layout: config.layout || 'default',
      components: [
        { type: 'header', props: { title: config.title } },
        { type: 'panel', slot: 'left', props: config.leftPanel },
        { type: 'panel', slot: 'right', props: config.rightPanel },
        { type: 'footer', props: config.footer }
      ]
    });
  }
}
```

## Error Handling

### Composition Errors

```javascript
class CompositionError extends Error {
  constructor(message, { template, context, depth }) {
    super(message);
    this.name = 'CompositionError';
    this.template = template;
    this.context = context;
    this.depth = depth;
  }
}

class SlotNotFoundError extends Error {
  constructor(slotName, availableSlots) {
    super(`Slot "${slotName}" not found. Available slots: ${availableSlots.join(', ')}`);
    this.name = 'SlotNotFoundError';
    this.slotName = slotName;
    this.availableSlots = availableSlots;
  }
}

class RecursionLimitError extends Error {
  constructor(depth, maxDepth) {
    super(`Maximum composition depth (${maxDepth}) exceeded at depth ${depth}`);
    this.name = 'RecursionLimitError';
    this.depth = depth;
    this.maxDepth = maxDepth;
  }
}
```

## Security Considerations

### XSS Prevention

1. **Sanitize all slot content** before injection
2. **Validate template sources** to prevent injection attacks
3. **Escape user-provided data** in context objects
4. **Use Content Security Policy** headers in production
5. **Implement template source whitelisting**

### Resource Protection

1. **Limit composition depth** to prevent stack overflow
2. **Set maximum template size** limits
3. **Implement timeout mechanisms** for long-running compositions
4. **Monitor memory usage** during composition
5. **Rate limit composition requests** in production

## Dependencies

### Internal Dependencies

- `TemplateRegistry` - For template storage and retrieval
- `TemplateCache` - For caching composition results
- `TemplateValidator` - For validating composed output
- Template utilities from HTMLTEMP-001 through HTMLTEMP-006

### External Dependencies

- None (pure JavaScript implementation)

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation with deep nesting | Medium | High | Implement caching and depth limits |
| Memory leaks from cached compositions | Low | High | Use WeakMap for cache, implement TTL |
| XSS vulnerabilities through slots | Medium | Critical | Strict content sanitization |
| Complexity making debugging difficult | Medium | Medium | Comprehensive logging and dev tools |
| Breaking changes to existing templates | Low | High | Backward compatibility layer |

## Acceptance Criteria

- [ ] Composition engine supports nested templates to 5+ levels
- [ ] Slot system handles named and default slots correctly
- [ ] Template inheritance works with multiple levels
- [ ] Component assembly produces valid HTML
- [ ] Performance targets met (< 10ms for standard pages)
- [ ] All security considerations addressed
- [ ] Comprehensive test coverage (> 90%)
- [ ] Documentation complete with examples
- [ ] Integration with existing systems verified
- [ ] Memory usage remains stable under load

## Future Enhancements

1. **Async Template Loading** - Support for lazy-loaded templates
2. **Partial Recomposition** - Update only changed portions
3. **Template Preprocessing** - Compile-time optimization
4. **Visual Composition Builder** - GUI for template composition
5. **Hot Module Replacement** - Live template updates in development

## Documentation Requirements

1. **API Documentation** - Complete JSDoc for all public methods
2. **Usage Guide** - Step-by-step guide for common scenarios
3. **Performance Guide** - Best practices for optimal performance
4. **Migration Guide** - How to convert existing templates
5. **Troubleshooting Guide** - Common issues and solutions

## Definition of Done

- [ ] All code implemented according to specification
- [ ] Unit tests passing with > 90% coverage
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation written and reviewed
- [ ] Code reviewed and approved
- [ ] Merged to main branch
- [ ] Deployment plan created