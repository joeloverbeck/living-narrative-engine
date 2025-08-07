# HTMLTEMP-002: Implement Page Template Container

## Status

**Status**: Not Started  
**Priority**: Critical  
**Estimated**: 4 hours  
**Complexity**: Medium  
**Dependencies**: HTMLTEMP-001 (Directory Structure)

## Objective

Implement the core page template container that serves as the main wrapper for all character builder pages. This template establishes the fundamental structure that all pages will inherit, supporting both single and dual panel layouts.

## Background

Currently, each character builder page has its own complete HTML structure with significant duplication. The page template container will provide a single source of truth for the overall page structure, with slots for dynamic content insertion.

## Technical Requirements

### 1. Page Template Implementation

#### File: `src/characterBuilder/templates/core/pageTemplate.js`

```javascript
/**
 * @file Page template container for character builder pages
 * @module characterBuilder/templates/core/pageTemplate
 */

/** @typedef {import('../types.js').PageConfig} PageConfig */
/** @typedef {import('../types.js').PanelConfig} PanelConfig */

/**
 * Creates a complete character builder page structure
 * @param {PageConfig} config - Page configuration object
 * @returns {string} Complete HTML page structure
 */
export function createCharacterBuilderPage(config) {
  validatePageConfig(config);

  const {
    title,
    subtitle = '',
    headerActions = [],
    leftPanel = null,
    rightPanel = null,
    modals = [],
    footer = getDefaultFooterConfig(),
    customClasses = '',
    singlePanel = false,
  } = config;

  // Determine layout type
  const layoutClass = singlePanel ? 'cb-single-panel' : 'cb-dual-panel';
  const hasContent = leftPanel || rightPanel;

  if (!hasContent) {
    console.warn('Page template created without panel content');
  }

  return `
    <div class="cb-page-container ${layoutClass} ${customClasses}" data-page-title="${escapeHtml(title)}">
      ${createPageHeader(title, subtitle, headerActions)}
      ${createPageMain(leftPanel, rightPanel, singlePanel)}
      ${createPageFooter(footer)}
      ${createModalsContainer(modals)}
    </div>
  `;
}

/**
 * Creates the page header section
 * @private
 * @param {string} title - Page title
 * @param {string} subtitle - Page subtitle
 * @param {Array} actions - Header actions
 * @returns {string} Header HTML
 */
function createPageHeader(title, subtitle, actions) {
  // Placeholder - will be replaced by HTMLTEMP-003
  return `
    <header class="cb-page-header" role="banner">
      <div class="cb-header-content">
        <div class="cb-header-text">
          <h1 class="cb-page-title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="cb-page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${actions.length > 0 ? createHeaderActions(actions) : ''}
      </div>
    </header>
  `;
}

/**
 * Creates header action buttons
 * @private
 * @param {Array} actions - Action configurations
 * @returns {string} Actions HTML
 */
function createHeaderActions(actions) {
  return `
    <div class="cb-header-actions" role="toolbar" aria-label="Page actions">
      ${actions.map((action) => createActionButton(action, 'header')).join('')}
    </div>
  `;
}

/**
 * Creates the main content area
 * @private
 * @param {PanelConfig|null} leftPanel - Left panel configuration
 * @param {PanelConfig|null} rightPanel - Right panel configuration
 * @param {boolean} singlePanel - Use single panel layout
 * @returns {string} Main content HTML
 */
function createPageMain(leftPanel, rightPanel, singlePanel) {
  // Placeholder - will be replaced by HTMLTEMP-004
  if (singlePanel) {
    const panel = leftPanel || rightPanel;
    return `
      <main class="cb-page-main cb-main-single" role="main">
        <div class="cb-content-wrapper">
          ${panel ? createPanelPlaceholder(panel, 'single') : ''}
        </div>
      </main>
    `;
  }

  return `
    <main class="cb-page-main cb-main-dual" role="main">
      <div class="cb-content-wrapper">
        <div class="cb-panels-container">
          ${leftPanel ? createPanelPlaceholder(leftPanel, 'left') : ''}
          ${rightPanel ? createPanelPlaceholder(rightPanel, 'right') : ''}
        </div>
      </div>
    </main>
  `;
}

/**
 * Creates a panel placeholder (temporary until HTMLTEMP-011)
 * @private
 * @param {PanelConfig} panel - Panel configuration
 * @param {string} position - Panel position
 * @returns {string} Panel HTML
 */
function createPanelPlaceholder(panel, position) {
  const positionClass = `cb-panel-${position}`;
  const id = panel.id ? `id="${panel.id}"` : '';

  return `
    <section ${id} class="cb-panel ${positionClass} ${panel.className || ''}" 
             role="region" 
             ${panel.heading ? `aria-labelledby="${panel.id}-heading"` : ''}>
      ${
        panel.heading
          ? `
        <h2 id="${panel.id || position}-heading" class="cb-panel-heading">
          ${escapeHtml(panel.heading)}
        </h2>
      `
          : ''
      }
      <div class="cb-panel-content">
        ${typeof panel.content === 'function' ? panel.content() : panel.content}
      </div>
      ${panel.actions ? createPanelActions(panel.actions) : ''}
    </section>
  `;
}

/**
 * Creates panel action buttons
 * @private
 * @param {Array} actions - Panel actions
 * @returns {string} Actions HTML
 */
function createPanelActions(actions) {
  return `
    <div class="cb-panel-actions">
      ${actions.map((action) => createActionButton(action, 'panel')).join('')}
    </div>
  `;
}

/**
 * Creates the page footer
 * @private
 * @param {Object} footer - Footer configuration
 * @returns {string} Footer HTML
 */
function createPageFooter(footer) {
  // Placeholder - will be replaced by HTMLTEMP-005
  return `
    <footer class="cb-page-footer" role="contentinfo">
      <div class="cb-footer-content">
        ${footer.status ? `<span class="cb-footer-status">${escapeHtml(footer.status)}</span>` : ''}
        ${footer.links ? createFooterLinks(footer.links) : ''}
        ${footer.showVersion ? '<span class="cb-footer-version">v1.0.0</span>' : ''}
      </div>
    </footer>
  `;
}

/**
 * Creates footer links
 * @private
 * @param {Array} links - Link configurations
 * @returns {string} Links HTML
 */
function createFooterLinks(links) {
  return `
    <nav class="cb-footer-links" aria-label="Footer navigation">
      ${links
        .map(
          (link) => `
        <a href="${escapeHtml(link.href)}" 
           target="${link.target || '_self'}"
           class="cb-footer-link ${link.className || ''}">
          ${escapeHtml(link.label)}
        </a>
      `
        )
        .join('<span class="cb-footer-separator">|</span>')}
    </nav>
  `;
}

/**
 * Creates modals container
 * @private
 * @param {Array} modals - Modal configurations
 * @returns {string} Modals container HTML
 */
function createModalsContainer(modals) {
  if (!modals.length) return '';

  // Placeholder - will be replaced by HTMLTEMP-006
  return `
    <div class="cb-modals-container" aria-hidden="true">
      ${modals
        .map(
          (modal) => `
        <div id="${modal.id}" class="cb-modal" role="dialog" aria-modal="true" aria-labelledby="${modal.id}-title">
          <div class="cb-modal-backdrop"></div>
          <div class="cb-modal-content">
            <div class="cb-modal-header">
              <h3 id="${modal.id}-title" class="cb-modal-title">${escapeHtml(modal.title)}</h3>
              <button type="button" class="cb-modal-close" aria-label="Close">×</button>
            </div>
            <div class="cb-modal-body">
              ${typeof modal.content === 'function' ? modal.content() : modal.content}
            </div>
            ${modal.actions ? createModalActions(modal.actions) : ''}
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Creates modal action buttons
 * @private
 * @param {Array} actions - Modal actions
 * @returns {string} Actions HTML
 */
function createModalActions(actions) {
  return `
    <div class="cb-modal-footer">
      ${actions.map((action) => createActionButton(action, 'modal')).join('')}
    </div>
  `;
}

/**
 * Creates an action button
 * @private
 * @param {Object} action - Action configuration
 * @param {string} context - Button context (header/panel/modal)
 * @returns {string} Button HTML
 */
function createActionButton(action, context) {
  const dataAttributes = action.data
    ? Object.entries(action.data)
        .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
        .join(' ')
    : '';

  return `
    <button type="${action.type || 'button'}"
            class="cb-action-btn cb-action-${context} ${action.className || ''}"
            data-action="${escapeHtml(action.name)}"
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${escapeHtml(action.tooltip)}"` : ''}
            ${dataAttributes}>
      ${action.icon ? `<span class="cb-action-icon">${action.icon}</span>` : ''}
      <span class="cb-action-label">${escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Validates page configuration
 * @private
 * @param {PageConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validatePageConfig(config) {
  if (!config) {
    throw new Error('Page configuration is required');
  }

  if (!config.title) {
    throw new Error('Page title is required');
  }

  if (typeof config.title !== 'string') {
    throw new Error('Page title must be a string');
  }

  if (config.singlePanel && config.rightPanel) {
    console.warn('Right panel will be ignored in single panel mode');
  }

  if (!config.singlePanel && !config.leftPanel && !config.rightPanel) {
    console.warn('No panels provided for dual-panel layout');
  }
}

/**
 * Gets default footer configuration
 * @private
 * @returns {Object} Default footer config
 */
function getDefaultFooterConfig() {
  return {
    showVersion: true,
    links: [
      { label: 'Help', href: '#help' },
      { label: 'About', href: '#about' },
    ],
  };
}

/**
 * Escapes HTML special characters
 * @private
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return String(str);
  }

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// Export additional utilities for testing
export const __testUtils = {
  validatePageConfig,
  escapeHtml,
  getDefaultFooterConfig,
};
```

### 2. CSS Structure (Reference)

```css
/* These classes should be added to character-builder.css */

/* Page Container */
.cb-page-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--cb-background, #f5f5f5);
}

/* Layout Variants */
.cb-page-container.cb-single-panel .cb-panels-container {
  grid-template-columns: 1fr;
}

.cb-page-container.cb-dual-panel .cb-panels-container {
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* Main Content Area */
.cb-page-main {
  flex: 1;
  padding: 20px;
}

.cb-content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

.cb-panels-container {
  display: grid;
  gap: 20px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .cb-page-container.cb-dual-panel .cb-panels-container {
    grid-template-columns: 1fr;
  }
}
```

## Implementation Steps

### Step 1: Create Page Template File

1. Create `src/characterBuilder/templates/core/pageTemplate.js`
2. Implement all functions as specified above
3. Add comprehensive JSDoc comments

### Step 2: Create Helper Functions

1. Implement HTML escaping utility
2. Implement validation functions
3. Create default configuration getters

### Step 3: Add Temporary Placeholders

1. Create placeholder functions for components not yet implemented
2. Add TODO comments for future tickets

### Step 4: Export from Index

1. Update `src/characterBuilder/templates/core/index.js` to export the page template
2. Ensure proper module resolution

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/characterBuilder/templates/core/pageTemplate.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createCharacterBuilderPage,
  __testUtils,
} from '../../../../src/characterBuilder/templates/core/pageTemplate.js';

describe('Page Template Container', () => {
  describe('createCharacterBuilderPage', () => {
    it('should create a basic page with title', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
      });

      expect(html).toContain('cb-page-container');
      expect(html).toContain('Test Page');
      expect(html).toContain('cb-page-header');
      expect(html).toContain('cb-page-main');
      expect(html).toContain('cb-page-footer');
    });

    it('should support single panel layout', () => {
      const html = createCharacterBuilderPage({
        title: 'Single Panel Page',
        singlePanel: true,
        leftPanel: {
          content: 'Panel content',
        },
      });

      expect(html).toContain('cb-single-panel');
      expect(html).toContain('cb-main-single');
      expect(html).toContain('Panel content');
    });

    it('should support dual panel layout', () => {
      const html = createCharacterBuilderPage({
        title: 'Dual Panel Page',
        leftPanel: { content: 'Left content' },
        rightPanel: { content: 'Right content' },
      });

      expect(html).toContain('cb-dual-panel');
      expect(html).toContain('cb-main-dual');
      expect(html).toContain('Left content');
      expect(html).toContain('Right content');
    });

    it('should include subtitle when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        subtitle: 'Test Description',
      });

      expect(html).toContain('Test Description');
      expect(html).toContain('cb-page-subtitle');
    });

    it('should include header actions', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          { label: 'Save', name: 'save' },
          { label: 'Cancel', name: 'cancel' },
        ],
      });

      expect(html).toContain('cb-header-actions');
      expect(html).toContain('Save');
      expect(html).toContain('Cancel');
      expect(html).toContain('data-action="save"');
    });

    it('should include modals when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        modals: [
          {
            id: 'test-modal',
            title: 'Test Modal',
            content: 'Modal content',
          },
        ],
      });

      expect(html).toContain('cb-modals-container');
      expect(html).toContain('test-modal');
      expect(html).toContain('Test Modal');
      expect(html).toContain('Modal content');
    });

    it('should escape HTML in user content', () => {
      const html = createCharacterBuilderPage({
        title: '<script>alert("XSS")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should throw error for missing title', () => {
      expect(() => {
        createCharacterBuilderPage({});
      }).toThrow('Page title is required');
    });

    it('should support custom CSS classes', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        customClasses: 'custom-theme dark-mode',
      });

      expect(html).toContain('custom-theme dark-mode');
    });

    it('should support function content for panels', () => {
      const contentFn = () => '<div>Dynamic content</div>';
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        leftPanel: { content: contentFn },
      });

      expect(html).toContain('Dynamic content');
    });
  });

  describe('Validation', () => {
    const { validatePageConfig } = __testUtils;

    it('should validate required configuration', () => {
      expect(() => validatePageConfig(null)).toThrow();
      expect(() => validatePageConfig({})).toThrow();
      expect(() => validatePageConfig({ title: 123 })).toThrow();
    });

    it('should warn about conflicting configurations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createCharacterBuilderPage({
        title: 'Test',
        singlePanel: true,
        rightPanel: { content: 'ignored' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Right panel will be ignored')
      );
    });
  });

  describe('HTML Escaping', () => {
    const { escapeHtml } = __testUtils;

    it('should escape HTML special characters', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
      expect(escapeHtml("'apostrophe'")).toBe('&#39;apostrophe&#39;');
      expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('should handle non-string values', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(null)).toBe('null');
      expect(escapeHtml(undefined)).toBe('undefined');
    });
  });
});
```

## Acceptance Criteria

- [ ] Page template creates valid HTML5 structure
- [ ] Supports both single and dual panel layouts
- [ ] Title is required and properly validated
- [ ] Subtitle is optional and displayed when provided
- [ ] Header actions are rendered correctly
- [ ] Panel content supports both strings and functions
- [ ] Modals container is created when modals provided
- [ ] Footer includes default links and version
- [ ] All user content is properly escaped for XSS prevention
- [ ] Custom CSS classes can be added to container
- [ ] Proper ARIA attributes for accessibility
- [ ] Responsive layout considerations included
- [ ] All tests pass with 100% coverage
- [ ] No ESLint errors or warnings

## Performance Requirements

- Template rendering must complete in < 10ms
- HTML string concatenation optimized for performance
- No memory leaks from function references
- Efficient string escaping implementation

## Risks and Mitigation

| Risk                                  | Impact   | Probability | Mitigation                         |
| ------------------------------------- | -------- | ----------- | ---------------------------------- |
| Performance issues with large content | Medium   | Low         | Use efficient string concatenation |
| XSS vulnerabilities                   | Critical | Medium      | Comprehensive HTML escaping        |
| Browser compatibility issues          | Medium   | Low         | Use standard HTML5 elements        |
| Memory leaks from closures            | Medium   | Low         | Careful function scoping           |

## Notes

- This is the foundation for all other templates
- Keep the implementation flexible for future enhancements
- Consider adding slot-based content injection in future
- The placeholder functions will be replaced in subsequent tickets

## Related Tickets

- **Depends on**: HTMLTEMP-001 (Directory Structure)
- **Blocks**: HTMLTEMP-003, HTMLTEMP-004, HTMLTEMP-005, HTMLTEMP-006
- **Related**: HTMLTEMP-011 (Panel Template)
