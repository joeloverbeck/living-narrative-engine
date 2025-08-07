# HTML Template System for Character Builder Pages - Implementation Specification

---

**Status**: Proposal (Not Implemented)
**Created**: [Original Date]
**Last Updated**: 2025-08-07
**Type**: Feature Proposal

---

## Current Implementation Status

**IMPORTANT**: This specification describes a proposed template system that has not yet been implemented. The current character builder pages use the following approach:

### Current Architecture

- **Static HTML Files**: Each character builder page has its own HTML file in `data/html/`
- **Direct DOM Manipulation**: Controllers directly manipulate DOM elements
- **No Template System**: HTML structure is duplicated across pages
- **No Component System**: No reusable component templates exist
- **Manual Updates**: Changes require updating each HTML file individually

### Files That Currently Exist

- `data/html/` - Contains static HTML files for each page
- `src/characterBuilder/controllers/` - Controllers that manipulate the static HTML
- `src/characterBuilder/BaseCharacterBuilderController.js` - Base controller class
- `src/bootstrap/CharacterBuilderBootstrap.js` - Bootstrap system (no template support)

### Proposed Solution

This specification outlines a template system that would:

- Eliminate the current HTML duplication
- Provide a component-based approach
- Enable dynamic content generation
- Maintain backward compatibility during migration

---

## 1. Overview

### 1.1 Purpose

**Proposed**: Implement a modular HTML template system for character builder pages that will eliminate code duplication, ensure consistent structure, and enable rapid development of new pages while maintaining a unified user experience.

### 1.2 Goals

- **Eliminate HTML Duplication**: Will reduce 70% of HTML structure duplication across character builder pages
- **Ensure Consistency**: Will provide a single source of truth for page structure and layout
- **Enable Dynamic Generation**: Will support both static HTML generation and runtime DOM construction
- **Simplify Maintenance**: Will centralize structural changes to a single location
- **Accelerate Development**: New pages will be created in hours instead of days
- **Support Customization**: Will allow page-specific content while maintaining standard structure

### 1.3 Scope

- **Will create template system** for character builder page structure
- **Will implement component templates** for headers, panels, modals, and footers
- **Will build template utilities** for HTML generation and DOM manipulation
- **Will migrate existing pages** to use the new template system
- **Will integrate with existing** BaseCharacterBuilderController and CharacterBuilderBootstrap

### 1.4 Non-Goals

- Complete CSS refactoring (separate initiative)
- Backend service changes
- Business logic modifications
- Complete UI component library (separate initiative)

## 2. Architecture Design

### 2.1 Template System Architecture

```
Character Builder Template System
├── Core Templates
│   ├── PageTemplate (main container)
│   ├── HeaderTemplate (page header)
│   ├── MainTemplate (content area)
│   ├── FooterTemplate (page footer)
│   └── ModalTemplate (dialog system)
├── Component Templates
│   ├── PanelTemplate (content panels)
│   ├── FormGroupTemplate (form fields)
│   ├── ButtonGroupTemplate (action buttons)
│   ├── DisplayCardTemplate (content cards)
│   └── StatisticsTemplate (metrics display)
├── Template Utilities
│   ├── TemplateRenderer (HTML generation)
│   ├── TemplateInjector (DOM injection)
│   ├── TemplateValidator (structure validation)
│   └── TemplateCache (performance optimization)
└── Integration Layer
    ├── BaseCharacterBuilderController integration
    ├── CharacterBuilderBootstrap integration
    └── Existing page migration adapters
```

### 2.2 Template Hierarchy

```javascript
PageTemplate
├── HeaderTemplate
│   ├── title (required)
│   ├── subtitle (optional)
│   ├── navigation (optional)
│   └── actions (optional)
├── MainTemplate
│   ├── LeftPanelTemplate
│   │   ├── heading
│   │   ├── content (slot)
│   │   └── actions
│   ├── RightPanelTemplate
│   │   ├── heading
│   │   ├── content (slot)
│   │   └── state indicators
│   └── SinglePanelTemplate (alternative)
├── FooterTemplate
│   ├── status
│   ├── links
│   └── version
└── ModalTemplate[]
    ├── id
    ├── title
    ├── content (slot)
    └── actions
```

### 2.3 Integration Points

```javascript
// Integration with BaseCharacterBuilderController
class ConcreteController extends BaseCharacterBuilderController {
  async initializeTemplate() {
    const template = await this.createPageTemplate({
      title: 'Page Title',
      subtitle: 'Page Description',
      leftPanel: this.createLeftPanelContent(),
      rightPanel: this.createRightPanelContent(),
      modals: this.getModalDefinitions(),
    });

    this.renderTemplate(template);
  }
}

// Integration with CharacterBuilderBootstrap
CharacterBuilderBootstrap.bootstrap({
  pageName: 'thematic-direction-generator',
  templateConfig: {
    useTemplate: true,
    templateType: 'dual-panel',
    customizations: {
      /* ... */
    },
  },
});
```

## 3. Detailed Requirements

### 3.1 Functional Requirements

#### FR-1: Core Template System

- **Requirement**: Will create modular template system with composable components
- **Details**:
  - Templates will be pure functions returning HTML strings or DOM elements
  - Will support both server-side rendering (build time) and client-side rendering (runtime)
  - Templates will be framework-agnostic (pure JavaScript)
  - Will support nested template composition
- **Acceptance Criteria**:
  - All templates will return valid HTML5 markup
  - Templates will be testable in isolation
  - No external dependencies beyond standard JavaScript
  - Performance: Template rendering < 10ms

#### FR-2: Page Template Structure

- **Requirement**: Will implement standard page container template
- **Details**:
  ```javascript
  // Proposed function signature
  createCharacterBuilderPage({
    title: string,
    subtitle?: string,
    headerActions?: Array<Action>,
    leftPanel: PanelConfig,
    rightPanel?: PanelConfig,
    modals?: Array<ModalConfig>,
    footer?: FooterConfig
  }) => HTMLString | DocumentFragment
  ```
- **Acceptance Criteria**:
  - Will generate consistent page structure
  - Will support single and dual panel layouts
  - Will include all ARIA attributes for accessibility
  - Mobile-responsive structure

#### FR-3: Component Templates

- **Requirement**: Will create reusable component templates
- **Proposed Components**:
  - HeaderTemplate: Page header with title, subtitle, navigation
  - PanelTemplate: Content panels with heading and body
  - FormGroupTemplate: Form field groups with labels and validation
  - ButtonGroupTemplate: Button collections with consistent spacing
  - ModalTemplate: Modal dialogs with backdrop and focus management
  - StatisticsTemplate: Metrics display with icons and values
  - DisplayCardTemplate: Content cards for data display
- **Acceptance Criteria**:
  - Each component is independently testable
  - Components support customization via options
  - Consistent naming and structure
  - Accessibility compliant (WCAG 2.1 AA)

#### FR-4: Template Utilities

- **Requirement**: Will provide utilities for template usage
- **Proposed Utilities**:

  ```javascript
  // Proposed Template Renderer API
  TemplateRenderer.render(template, data) => HTMLString
  TemplateRenderer.renderToDOM(template, data) => DocumentFragment

  // Proposed Template Injector API
  TemplateInjector.inject(target, template, position)
  TemplateInjector.replace(target, template)

  // Proposed Template Validator API
  TemplateValidator.validate(template) => ValidationResult
  TemplateValidator.validateStructure(html) => boolean

  // Proposed Template Cache API
  TemplateCache.set(key, template)
  TemplateCache.get(key) => template
  TemplateCache.clear()
  ```

- **Acceptance Criteria**:
  - Utilities handle edge cases gracefully
  - Performance optimized for repeated rendering
  - Memory efficient caching strategy
  - Clear error messages for validation failures

#### FR-5: Data Binding Support

- **Requirement**: Will support data binding for dynamic content
- **Details**:
  - Templates will accept data objects for dynamic content
  - Will support conditional rendering
  - Will support list/array rendering
  - Will provide event handler attachment points
- **Example**:
  ```javascript
  const template = createPanelTemplate({
    heading: '${data.title}',
    content: '${data.items.map(item => createItemTemplate(item)).join("")}',
    showFooter: '${data.hasFooter}',
    events: {
      'click .action-btn': 'handleAction',
    },
  });
  ```
- **Acceptance Criteria**:
  - Safe string interpolation (XSS prevention)
  - Efficient list rendering
  - Event delegation support
  - No memory leaks from event handlers

### 3.2 Technical Requirements

#### TR-1: Performance

- Template rendering: < 10ms for standard page
- DOM injection: < 20ms
- Memory footprint: < 1MB for template cache
- Bundle size increase: < 5KB gzipped

#### TR-2: Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- No transpilation required for template core
- Progressive enhancement for older browsers

#### TR-3: Accessibility

- WCAG 2.1 AA compliance
- Semantic HTML5 markup
- ARIA attributes where appropriate
- Keyboard navigation support
- Screen reader friendly

#### TR-4: Development Experience

- TypeScript definitions via JSDoc
- Comprehensive inline documentation
- Template preview/debugging tools
- Hot reload support in development

## 4. Implementation Guide

### 4.1 File Structure

**Note**: These directories and files do not currently exist. This is the proposed structure for the template system.

```
src/characterBuilder/templates/  (PROPOSED - Does not exist)
├── core/                        (PROPOSED)
│   ├── pageTemplate.js
│   ├── headerTemplate.js
│   ├── mainTemplate.js
│   ├── footerTemplate.js
│   └── modalTemplate.js
├── components/                  (PROPOSED)
│   ├── panelTemplate.js
│   ├── formGroupTemplate.js
│   ├── buttonGroupTemplate.js
│   ├── displayCardTemplate.js
│   └── statisticsTemplate.js
├── utilities/                   (PROPOSED)
│   ├── templateRenderer.js
│   ├── templateInjector.js
│   ├── templateValidator.js
│   └── templateCache.js
├── index.js                     # Main export (PROPOSED)
└── types.js                     # JSDoc type definitions (PROPOSED)
```

### 4.2 Core Implementation Examples

#### 4.2.1 Page Template

```javascript
/**
 * PROPOSED IMPLEMENTATION
 * @file src/characterBuilder/templates/core/pageTemplate.js
 * NOTE: This file does not exist yet
 */

import { createHeader } from './headerTemplate.js';
import { createMain } from './mainTemplate.js';
import { createFooter } from './footerTemplate.js';
import { createModal } from './modalTemplate.js';

/**
 * Creates a complete character builder page
 * @param {PageConfig} config - Page configuration
 * @returns {string} HTML string
 */
export function createCharacterBuilderPage(config) {
  const {
    title,
    subtitle,
    headerActions = [],
    leftPanel,
    rightPanel = null,
    modals = [],
    footer = {},
    customClasses = '',
  } = config;

  return `
    <div class="cb-page-container ${customClasses}">
      ${createHeader({ title, subtitle, actions: headerActions })}
      ${createMain({ leftPanel, rightPanel })}
      ${createFooter(footer)}
    </div>
    ${modals.map((modal) => createModal(modal)).join('')}
  `;
}
```

#### 4.2.2 Panel Template

```javascript
/**
 * PROPOSED IMPLEMENTATION
 * @file src/characterBuilder/templates/components/panelTemplate.js
 * NOTE: This file does not exist yet
 */

/**
 * Creates a content panel
 * @param {PanelConfig} config - Panel configuration
 * @returns {string} HTML string
 */
export function createPanel(config) {
  const {
    id = '',
    heading,
    content,
    className = '',
    showWhenEmpty = false,
    emptyMessage = 'No content available',
    actions = [],
  } = config;

  const panelId = id ? `id="${id}"` : '';
  const displayStyle =
    !content && !showWhenEmpty ? 'style="display: none;"' : '';

  return `
    <section ${panelId} class="cb-panel ${className}" ${displayStyle}>
      ${heading ? `<h2 class="cb-panel-heading">${heading}</h2>` : ''}
      <div class="cb-panel-content">
        ${content || `<p class="cb-empty-message">${emptyMessage}</p>`}
      </div>
      ${actions.length ? createPanelActions(actions) : ''}
    </section>
  `;
}

function createPanelActions(actions) {
  return `
    <div class="cb-panel-actions">
      ${actions
        .map(
          (action) => `
        <button 
          type="button"
          class="cb-action-btn ${action.className || ''}"
          data-action="${action.name}"
          ${action.disabled ? 'disabled' : ''}
        >
          ${action.label}
        </button>
      `
        )
        .join('')}
    </div>
  `;
}
```

#### 4.2.3 Template Renderer Utility

```javascript
/**
 * PROPOSED IMPLEMENTATION
 * @file src/characterBuilder/templates/utilities/templateRenderer.js
 * NOTE: This file and the sanitizeHTML utility do not exist yet
 */

// Note: sanitizeHTML utility would need to be created
import { sanitizeHTML } from '../../utils/sanitization.js';

export class TemplateRenderer {
  /**
   * Renders a template with data
   * @param {Function} templateFn - Template function
   * @param {object} data - Data to inject
   * @returns {string} Rendered HTML
   */
  static render(templateFn, data = {}) {
    if (typeof templateFn !== 'function') {
      throw new Error('Template must be a function');
    }

    const html = templateFn(data);
    return sanitizeHTML(html);
  }

  /**
   * Renders template to DOM element
   * @param {Function} templateFn - Template function
   * @param {object} data - Data to inject
   * @returns {DocumentFragment} DOM fragment
   */
  static renderToDOM(templateFn, data = {}) {
    const html = this.render(templateFn, data);
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }

  /**
   * Renders with data binding support
   * @param {string} templateStr - Template string with placeholders
   * @param {object} data - Data object
   * @returns {string} Rendered HTML
   */
  static renderWithBindings(templateStr, data = {}) {
    return templateStr.replace(/\${([^}]+)}/g, (match, expression) => {
      try {
        // Safe evaluation using Function constructor
        const fn = new Function('data', `return ${expression}`);
        return sanitizeHTML(String(fn(data)));
      } catch (error) {
        console.error(`Template binding error: ${expression}`, error);
        return '';
      }
    });
  }
}
```

### 4.3 Integration with Existing Systems

#### 4.3.1 BaseCharacterBuilderController Integration

```javascript
/**
 * PROPOSED Enhancement to BaseCharacterBuilderController
 * These methods would need to be added to the existing controller
 */
import { TemplateRenderer } from '../templates/utilities/templateRenderer.js';
import { createCharacterBuilderPage } from '../templates/core/pageTemplate.js';

export class BaseCharacterBuilderController {
  // ... existing code ...

  /**
   * Creates page template with standard structure
   * @protected
   * @param {object} config - Template configuration
   * @returns {string} HTML template
   */
  createPageTemplate(config) {
    return createCharacterBuilderPage({
      ...this.getDefaultTemplateConfig(),
      ...config,
    });
  }

  /**
   * Renders template to page
   * @protected
   * @param {string|Function} template - Template to render
   * @param {object} data - Data for template
   */
  renderTemplate(template, data = {}) {
    const container = this.getTemplateContainer();
    if (!container) {
      throw new Error('Template container not found');
    }

    const rendered =
      typeof template === 'function'
        ? TemplateRenderer.render(template, data)
        : template;

    container.innerHTML = rendered;
    this.onTemplateRendered();
  }

  /**
   * Hook called after template rendering
   * @protected
   */
  onTemplateRendered() {
    // Re-cache elements after template render
    this.cacheElements();
    // Re-attach event listeners
    this.setupEventListeners();
  }

  /**
   * Gets default template configuration
   * @protected
   * @returns {object} Default config
   */
  getDefaultTemplateConfig() {
    return {
      footer: {
        showVersion: true,
        links: [
          { label: 'Help', href: '#help' },
          { label: 'About', href: '#about' },
        ],
      },
    };
  }

  /**
   * Gets template container element
   * @protected
   * @returns {HTMLElement|null} Container element
   */
  getTemplateContainer() {
    return document.getElementById('app') || document.body;
  }
}
```

#### 4.3.2 Concrete Controller Example

```javascript
/**
 * PROPOSED Example: How Thematic Direction Generator Controller would use templates
 * This shows how the existing controller would be modified
 */
export class ThematicDirectionController extends BaseCharacterBuilderController {
  async initialize() {
    await super.initialize();

    // Create and render page template
    const template = this.createPageTemplate({
      title: 'Thematic Direction Generator',
      subtitle: 'Transform character concepts into narrative possibilities',
      leftPanel: {
        heading: 'Character Concept',
        content: this.createConceptForm(),
      },
      rightPanel: {
        heading: 'Generated Directions',
        content: this.createResultsPanel(),
        showWhenEmpty: true,
        emptyMessage: 'Select a concept to generate directions',
      },
      modals: [
        {
          id: 'delete-modal',
          title: 'Confirm Delete',
          content: this.createDeleteModalContent(),
        },
      ],
    });

    this.renderTemplate(template);
  }

  createConceptForm() {
    return createFormGroupTemplate({
      fields: [
        {
          type: 'select',
          id: 'concept-selector',
          label: 'Select Character Concept',
          required: true,
          options: this.getConceptOptions(),
          help: 'Choose an existing character concept to generate thematic directions for.',
        },
      ],
      actions: [
        {
          label: 'Generate Thematic Directions',
          type: 'submit',
          className: 'primary-button large',
          id: 'generate-btn',
        },
      ],
    });
  }

  createResultsPanel() {
    const directions = this.getGeneratedDirections();

    if (!directions.length) {
      return '';
    }

    return directions
      .map((direction) =>
        createDisplayCardTemplate({
          title: direction.title,
          content: direction.description,
          metadata: {
            created: direction.createdAt,
            complexity: direction.complexity,
          },
          actions: [
            { label: 'Edit', name: 'edit', data: { id: direction.id } },
            { label: 'Delete', name: 'delete', data: { id: direction.id } },
          ],
        })
      )
      .join('');
  }
}
```

## 5. Proposed Migration Plan

### 5.1 Migration Strategy (When Implementation Begins)

1. **Phase 1: Template System Implementation** (Week 1)
   - Implement core template system
   - Create all required templates
   - Implement utilities
   - Write comprehensive tests

2. **Phase 2: Controller Integration** (Week 1)
   - Enhance BaseCharacterBuilderController with template support
   - Add template methods and hooks
   - Update documentation

3. **Phase 3: Page Migration** (Week 2)
   - Migrate one page as proof of concept (thematic-direction-generator.html)
   - Validate functionality and performance
   - Gather feedback and refine

4. **Phase 4: Complete Migration** (Week 2-3)
   - Migrate remaining pages
   - Update all controllers
   - Remove duplicated HTML

5. **Phase 5: Optimization & Documentation** (Week 3)
   - Performance optimization
   - Complete documentation
   - Training materials

### 5.2 Migration Checklist per Page (For Future Use)

- [ ] Analyze current HTML structure
- [ ] Identify page-specific customizations
- [ ] Create template configuration
- [ ] Update controller to use templates
- [ ] Remove hardcoded HTML
- [ ] Test all functionality
- [ ] Verify accessibility
- [ ] Update page-specific CSS if needed
- [ ] Document any special cases

### 5.3 Backward Compatibility

- Keep original HTML files during transition
- Support both template and non-template modes via configuration
- Gradual rollout with feature flags if needed
- Maintain all existing element IDs and classes for CSS/JS compatibility

## 6. Testing Strategy

### 6.1 Unit Tests (To Be Created)

```javascript
// Proposed template function tests
describe('PageTemplate', () => {
  it('should create valid HTML structure', () => {
    const html = createCharacterBuilderPage({
      title: 'Test Page',
      leftPanel: { content: 'Test content' },
    });

    expect(html).toContain('cb-page-container');
    expect(html).toContain('Test Page');
    expect(html).toContain('Test content');
  });

  it('should handle optional parameters', () => {
    const html = createCharacterBuilderPage({
      title: 'Minimal Page',
    });

    expect(html).toBeDefined();
    expect(html).not.toContain('undefined');
  });
});

// Utility tests
describe('TemplateRenderer', () => {
  it('should render template with data', () => {
    const template = (data) => `<h1>${data.title}</h1>`;
    const result = TemplateRenderer.render(template, { title: 'Test' });

    expect(result).toBe('<h1>Test</h1>');
  });

  it('should sanitize HTML to prevent XSS', () => {
    const template = (data) => `<div>${data.content}</div>`;
    const result = TemplateRenderer.render(template, {
      content: '<script>alert("XSS")</script>',
    });

    expect(result).not.toContain('<script>');
  });
});
```

### 6.2 Integration Tests (To Be Created)

```javascript
// Proposed integration tests
describe('Template Integration with Controller', () => {
  let controller;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    controller = new TestController({
      /* deps */
    });
  });

  it('should render template on initialization', async () => {
    await controller.initialize();

    const container = document.getElementById('app');
    expect(container.querySelector('.cb-page-container')).toBeDefined();
    expect(container.querySelector('.cb-page-header')).toBeDefined();
  });

  it('should re-cache elements after template render', async () => {
    await controller.initialize();

    const button = document.querySelector('#test-button');
    expect(controller.elements['testButton']).toBe(button);
  });

  it('should maintain event listeners after template render', async () => {
    await controller.initialize();

    const button = document.querySelector('#test-button');
    const clickSpy = jest.spyOn(controller, 'handleClick');

    button.click();
    expect(clickSpy).toHaveBeenCalled();
  });
});
```

### 6.3 Visual Regression Tests

- Capture screenshots before migration
- Compare screenshots after migration
- Ensure pixel-perfect compatibility where required
- Document any intentional visual changes

### 6.4 Performance Tests (To Be Created)

```javascript
// Proposed performance tests
describe('Template Performance', () => {
  it('should render page template in under 10ms', () => {
    const start = performance.now();

    createCharacterBuilderPage({
      title: 'Performance Test',
      leftPanel: { content: 'Test' },
      rightPanel: { content: 'Test' },
      modals: [{ title: 'Modal', content: 'Test' }],
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should handle large lists efficiently', () => {
    const items = Array(1000)
      .fill()
      .map((_, i) => ({
        id: i,
        title: `Item ${i}`,
        content: `Content for item ${i}`,
      }));

    const start = performance.now();
    const html = createListTemplate({ items });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(html).toContain('Item 999');
  });
});
```

## 7. Risks and Mitigation

### 7.1 Technical Risks

| Risk                            | Probability | Impact   | Mitigation                                              |
| ------------------------------- | ----------- | -------- | ------------------------------------------------------- |
| Breaking existing functionality | Medium      | High     | Comprehensive testing, gradual migration, feature flags |
| Performance degradation         | Low         | Medium   | Performance testing, caching, optimization              |
| Browser compatibility issues    | Low         | Medium   | Progressive enhancement, polyfills if needed            |
| Memory leaks from templates     | Low         | High     | Proper cleanup, memory profiling, WeakMap usage         |
| XSS vulnerabilities             | Medium      | Critical | HTML sanitization, Content Security Policy              |

### 7.2 Project Risks

| Risk                | Probability | Impact | Mitigation                              |
| ------------------- | ----------- | ------ | --------------------------------------- |
| Scope creep         | Medium      | Medium | Clear boundaries, phased approach       |
| Timeline overrun    | Low         | Medium | Buffer time, parallel work streams      |
| Adoption resistance | Low         | Low    | Documentation, training, clear benefits |
| Maintenance burden  | Low         | Low    | Comprehensive tests, documentation      |

### 7.3 Mitigation Strategies

1. **Incremental Rollout**
   - Start with one page as proof of concept
   - Gather feedback early and often
   - Adjust approach based on learnings

2. **Comprehensive Testing**
   - Unit tests for all templates
   - Integration tests for controller integration
   - E2E tests for critical user flows
   - Visual regression tests

3. **Performance Monitoring**
   - Benchmark before and after
   - Set performance budgets
   - Monitor in production

4. **Documentation & Training**
   - Comprehensive developer documentation
   - Migration guides
   - Code examples and patterns
   - Best practices guide

## 8. Success Metrics

### 8.1 Quantitative Metrics

- **Code Reduction**: 70% reduction in HTML duplication (measured by lines of code)
- **Development Speed**: New page creation time < 6 hours (down from 2-3 days)
- **Performance**: Template rendering < 10ms, DOM injection < 20ms
- **Test Coverage**: 90% coverage for template system
- **Bundle Size**: < 5KB increase (gzipped)

### 8.2 Qualitative Metrics

- **Developer Satisfaction**: Positive feedback from development team
- **Maintainability**: Easier to make global changes
- **Consistency**: Uniform structure across all pages
- **Extensibility**: Easy to add new template types
- **Documentation Quality**: Clear, comprehensive, and helpful

## 9. Future Enhancements

### 9.1 Potential Extensions

1. **Template Precompilation**
   - Build-time template compilation for performance
   - Static HTML generation for SEO

2. **Advanced Data Binding**
   - Two-way data binding support
   - Reactive updates without full re-render
   - Virtual DOM diffing for optimal updates

3. **Template IDE Support**
   - VS Code extension for template autocomplete
   - Template preview panel
   - Syntax highlighting for template strings

4. **Component Library Integration**
   - Web Components support
   - React/Vue adapter layers
   - Storybook integration

5. **Template Versioning**
   - Support multiple template versions
   - Gradual migration paths
   - A/B testing support

### 9.2 Long-term Vision

- Complete design system with templates
- Visual template builder tool
- Template marketplace for sharing
- AI-assisted template generation
- Cross-project template sharing

## 10. Appendices

### Appendix A: Type Definitions

```javascript
/**
 * @typedef {Object} PageConfig
 * @property {string} title - Page title
 * @property {string} [subtitle] - Page subtitle
 * @property {Array<Action>} [headerActions] - Header action buttons
 * @property {PanelConfig} leftPanel - Left panel configuration
 * @property {PanelConfig} [rightPanel] - Right panel configuration
 * @property {Array<ModalConfig>} [modals] - Modal configurations
 * @property {FooterConfig} [footer] - Footer configuration
 * @property {string} [customClasses] - Additional CSS classes
 */

/**
 * @typedef {Object} PanelConfig
 * @property {string} [id] - Panel ID
 * @property {string} [heading] - Panel heading
 * @property {string} content - Panel content HTML
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [showWhenEmpty] - Show panel even when empty
 * @property {string} [emptyMessage] - Message when content is empty
 * @property {Array<Action>} [actions] - Panel action buttons
 */

/**
 * @typedef {Object} ModalConfig
 * @property {string} id - Modal ID
 * @property {string} title - Modal title
 * @property {string} content - Modal content HTML
 * @property {Array<Action>} [actions] - Modal action buttons
 * @property {boolean} [closeOnEscape] - Close on ESC key
 * @property {boolean} [closeOnBackdrop] - Close on backdrop click
 */

/**
 * @typedef {Object} Action
 * @property {string} label - Button label
 * @property {string} name - Action name
 * @property {string} [className] - CSS classes
 * @property {boolean} [disabled] - Disabled state
 * @property {Object} [data] - Additional data attributes
 */
```

### Appendix B: CSS Classes Reference

```css
/* Template-specific classes to be added to character-builder base CSS */
.cb-page-container {
  /* Main page container */
}
.cb-page-header {
  /* Page header */
}
.cb-page-main {
  /* Main content area */
}
.cb-page-footer {
  /* Page footer */
}

.cb-panel {
  /* Content panel */
}
.cb-panel-heading {
  /* Panel heading */
}
.cb-panel-content {
  /* Panel content */
}
.cb-panel-actions {
  /* Panel actions */
}

.cb-form-group {
  /* Form field group */
}
.cb-form-label {
  /* Form label */
}
.cb-form-input {
  /* Form input */
}
.cb-form-help {
  /* Help text */
}
.cb-form-error {
  /* Error message */
}

.cb-modal {
  /* Modal container */
}
.cb-modal-backdrop {
  /* Modal backdrop */
}
.cb-modal-content {
  /* Modal content */
}
.cb-modal-header {
  /* Modal header */
}
.cb-modal-body {
  /* Modal body */
}
.cb-modal-footer {
  /* Modal footer */
}

.cb-empty-message {
  /* Empty state message */
}
.cb-loading {
  /* Loading state */
}
.cb-error {
  /* Error state */
}
```

### Appendix C: Migration Example

```javascript
// BEFORE: Hardcoded HTML in thematic-direction-generator.html
<div id="thematic-direction-container">
  <header class="thematic-direction-header">
    <div class="header-content">
      <h1>Thematic Direction Generator</h1>
      <p class="header-subtitle">Transform character concepts...</p>
    </div>
  </header>
  <main class="thematic-direction-main">
    <section class="concept-input-panel">
      <!-- ... -->
    </section>
    <section class="results-panel">
      <!-- ... -->
    </section>
  </main>
</div>

// AFTER: Template-based generation
const template = createCharacterBuilderPage({
  title: 'Thematic Direction Generator',
  subtitle: 'Transform character concepts into narrative possibilities',
  leftPanel: {
    heading: 'Character Concept',
    content: conceptFormHTML,
    className: 'concept-input-panel',
  },
  rightPanel: {
    heading: 'Generated Directions',
    content: resultsHTML,
    className: 'results-panel',
    showWhenEmpty: true,
  },
});

document.getElementById('app').innerHTML = template;
```

---

## Implementation Notes for Future Development

### Prerequisites for Implementation

Before implementing this template system, the following components would need to be created:

1. **HTML Sanitization Utility** (`src/utils/sanitization.js`)
   - XSS prevention
   - Safe string interpolation
   - Content Security Policy support

2. **Template Infrastructure**
   - Create `src/characterBuilder/templates/` directory structure
   - Implement core template functions
   - Build utility classes

3. **Controller Enhancements**
   - Extend BaseCharacterBuilderController with template methods
   - Add template lifecycle hooks
   - Update event handling for dynamic content

4. **Bootstrap Integration**
   - Modify CharacterBuilderBootstrap to support template configuration
   - Add template mode detection
   - Implement backward compatibility layer

### Migration Considerations

1. **Gradual Migration Path**
   - Keep existing static HTML files during transition
   - Support both static and template modes via configuration
   - Migrate one page at a time to validate approach

2. **Testing Requirements**
   - Create comprehensive test suite for template system
   - Visual regression tests before/after migration
   - Performance benchmarks to ensure no degradation

3. **Documentation Needs**
   - Developer guide for using templates
   - Migration guide for existing pages
   - API documentation for all template functions

### Benefits When Implemented

- **70% reduction** in HTML duplication
- **6-hour page creation** (down from 2-3 days)
- **Single source of truth** for UI structure
- **Improved maintainability** and consistency
- **Enhanced developer experience**

### Next Steps

To begin implementation:

1. Review and approve this specification
2. Create proof of concept with one page
3. Gather feedback and refine approach
4. Plan phased rollout strategy
5. Allocate development resources

---

_This specification provides a comprehensive blueprint for implementing the HTML Template System for character builder pages. When implemented, it will eliminate duplication, ensure consistency, and enable rapid development while maintaining backward compatibility and high quality standards._
