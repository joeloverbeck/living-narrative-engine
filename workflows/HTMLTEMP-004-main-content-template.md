# HTMLTEMP-004: Implement Main Content Template

## Status

**Status**: Not Started  
**Priority**: High  
**Estimated**: 4 hours  
**Complexity**: Medium  
**Dependencies**: HTMLTEMP-001, HTMLTEMP-002

## Objective

Create the main content area template that provides flexible layout options for character builder pages, supporting single panel, dual panel, and multi-column layouts with responsive design.

## Background

The main content area is where the primary functionality of each character builder page resides. This template must be flexible enough to accommodate various layout needs while maintaining consistency.

## Technical Requirements

### 1. Main Content Template Implementation

#### File: `src/characterBuilder/templates/core/mainTemplate.js`

```javascript
/**
 * @file Main content area template for character builder pages
 * @module characterBuilder/templates/core/mainTemplate
 */

/** @typedef {import('../types.js').PanelConfig} PanelConfig */

/**
 * Main content configuration
 * @typedef {Object} MainConfig
 * @property {PanelConfig} [leftPanel] - Left panel configuration
 * @property {PanelConfig} [rightPanel] - Right panel configuration
 * @property {PanelConfig} [centerPanel] - Center panel for single layout
 * @property {Array<PanelConfig>} [panels] - Multiple panels for grid layout
 * @property {'dual'|'single'|'grid'|'sidebar'} [layout='dual'] - Layout type
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [fluid=false] - Full width layout
 * @property {Object} [sidebar] - Sidebar configuration for sidebar layout
 */

/**
 * Creates the main content area
 * @param {MainConfig} config - Main content configuration
 * @returns {string} Main content HTML
 */
export function createMain(config = {}) {
  const {
    leftPanel,
    rightPanel,
    centerPanel,
    panels = [],
    layout = determineLayout(config),
    className = '',
    fluid = false,
  } = config;

  const containerClass = fluid ? 'cb-main-fluid' : 'cb-main-container';
  const layoutClass = `cb-layout-${layout}`;

  return `
    <main class="cb-page-main ${layoutClass} ${containerClass} ${className}" role="main">
      <div class="cb-main-wrapper">
        ${renderLayout(layout, config)}
      </div>
    </main>
  `;
}

/**
 * Determines layout type from configuration
 * @private
 * @param {MainConfig} config - Configuration object
 * @returns {string} Layout type
 */
function determineLayout(config) {
  if (config.layout) return config.layout;
  if (config.panels && config.panels.length > 0) return 'grid';
  if (config.sidebar) return 'sidebar';
  if (config.centerPanel || (!config.leftPanel && !config.rightPanel))
    return 'single';
  return 'dual';
}

/**
 * Renders the appropriate layout
 * @private
 * @param {string} layout - Layout type
 * @param {MainConfig} config - Configuration
 * @returns {string} Layout HTML
 */
function renderLayout(layout, config) {
  switch (layout) {
    case 'single':
      return renderSingleLayout(config);
    case 'dual':
      return renderDualLayout(config);
    case 'grid':
      return renderGridLayout(config);
    case 'sidebar':
      return renderSidebarLayout(config);
    default:
      console.warn(`Unknown layout type: ${layout}`);
      return renderDualLayout(config);
  }
}

/**
 * Renders single panel layout
 * @private
 * @param {MainConfig} config - Configuration
 * @returns {string} Single layout HTML
 */
function renderSingleLayout(config) {
  const panel =
    config.centerPanel || config.leftPanel || config.rightPanel || {};

  return `
    <div class="cb-single-layout">
      ${createPanel({
        ...panel,
        className: `cb-panel-single ${panel.className || ''}`.trim(),
      })}
    </div>
  `;
}

/**
 * Renders dual panel layout
 * @private
 * @param {MainConfig} config - Configuration
 * @returns {string} Dual layout HTML
 */
function renderDualLayout(config) {
  const { leftPanel, rightPanel } = config;

  return `
    <div class="cb-dual-layout">
      ${
        leftPanel
          ? createPanel({
              ...leftPanel,
              className: `cb-panel-left ${leftPanel.className || ''}`.trim(),
            })
          : '<div class="cb-panel-placeholder"></div>'
      }
      ${
        rightPanel
          ? createPanel({
              ...rightPanel,
              className: `cb-panel-right ${rightPanel.className || ''}`.trim(),
            })
          : '<div class="cb-panel-placeholder"></div>'
      }
    </div>
  `;
}

/**
 * Renders grid layout with multiple panels
 * @private
 * @param {MainConfig} config - Configuration
 * @returns {string} Grid layout HTML
 */
function renderGridLayout(config) {
  const { panels = [], columns = 'auto' } = config;
  const gridStyle =
    columns === 'auto' ? '' : `style="--cb-grid-columns: ${columns}"`;

  return `
    <div class="cb-grid-layout" ${gridStyle}>
      ${panels
        .map((panel, index) =>
          createPanel({
            ...panel,
            className:
              `cb-panel-grid cb-panel-${index} ${panel.className || ''}`.trim(),
          })
        )
        .join('')}
    </div>
  `;
}

/**
 * Renders sidebar layout
 * @private
 * @param {MainConfig} config - Configuration
 * @returns {string} Sidebar layout HTML
 */
function renderSidebarLayout(config) {
  const { sidebar, centerPanel } = config;
  const sidebarPosition = sidebar.position || 'left';

  return `
    <div class="cb-sidebar-layout cb-sidebar-${sidebarPosition}">
      <aside class="cb-sidebar" role="complementary">
        ${createSidebar(sidebar)}
      </aside>
      <div class="cb-main-content">
        ${createPanel(centerPanel || {})}
      </div>
    </div>
  `;
}

/**
 * Creates a content panel
 * @private
 * @param {PanelConfig} config - Panel configuration
 * @returns {string} Panel HTML
 */
function createPanel(config) {
  const {
    id = '',
    heading = '',
    content = '',
    className = '',
    showWhenEmpty = false,
    emptyMessage = 'No content available',
    actions = [],
    state = null,
    collapsible = false,
    collapsed = false,
  } = config;

  const hasContent = content || showWhenEmpty;
  if (!hasContent) return '';

  const panelId = id ? `id="${escapeHtml(id)}"` : '';
  const collapsibleClass = collapsible ? 'cb-panel-collapsible' : '';
  const collapsedClass = collapsed ? 'cb-panel-collapsed' : '';
  const ariaExpanded = collapsible ? `aria-expanded="${!collapsed}"` : '';

  return `
    <section ${panelId} 
             class="cb-panel ${collapsibleClass} ${collapsedClass} ${className}"
             role="region"
             ${heading ? `aria-labelledby="${id || 'panel'}-heading"` : ''}
             ${ariaExpanded}>
      ${heading ? createPanelHeader(heading, id, collapsible, state) : ''}
      <div class="cb-panel-body" ${collapsible ? `id="${id}-content"` : ''}>
        <div class="cb-panel-content">
          ${
            content
              ? renderContent(content)
              : `
            <div class="cb-panel-empty">
              <p class="cb-empty-message">${escapeHtml(emptyMessage)}</p>
            </div>
          `
          }
        </div>
        ${actions.length > 0 ? createPanelActions(actions) : ''}
      </div>
    </section>
  `;
}

/**
 * Creates panel header
 * @private
 * @param {string} heading - Panel heading
 * @param {string} id - Panel ID
 * @param {boolean} collapsible - Whether panel is collapsible
 * @param {Object} state - Panel state indicators
 * @returns {string} Header HTML
 */
function createPanelHeader(heading, id, collapsible, state) {
  const headingId = `${id || 'panel'}-heading`;

  return `
    <div class="cb-panel-header">
      <h2 id="${headingId}" class="cb-panel-heading">
        ${
          collapsible
            ? `
          <button type="button" 
                  class="cb-panel-toggle"
                  aria-controls="${id}-content"
                  aria-expanded="true">
            <span class="cb-toggle-icon" aria-hidden="true">▼</span>
            ${escapeHtml(heading)}
          </button>
        `
            : escapeHtml(heading)
        }
      </h2>
      ${state ? createPanelState(state) : ''}
    </div>
  `;
}

/**
 * Creates panel state indicators
 * @private
 * @param {Object} state - State configuration
 * @returns {string} State HTML
 */
function createPanelState(state) {
  return `
    <div class="cb-panel-state">
      ${state.loading ? '<span class="cb-state-loading">Loading...</span>' : ''}
      ${state.error ? `<span class="cb-state-error">${escapeHtml(state.error)}</span>` : ''}
      ${state.success ? `<span class="cb-state-success">${escapeHtml(state.success)}</span>` : ''}
      ${state.count !== undefined ? `<span class="cb-state-count">${state.count}</span>` : ''}
    </div>
  `;
}

/**
 * Renders panel content
 * @private
 * @param {string|Function|Array} content - Content to render
 * @returns {string} Rendered content
 */
function renderContent(content) {
  if (typeof content === 'function') {
    return content();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'function' ? item() : item))
      .join('');
  }

  return String(content);
}

/**
 * Creates panel actions
 * @private
 * @param {Array} actions - Action configurations
 * @returns {string} Actions HTML
 */
function createPanelActions(actions) {
  return `
    <div class="cb-panel-actions">
      ${actions.map((action) => createActionButton(action)).join('')}
    </div>
  `;
}

/**
 * Creates an action button
 * @private
 * @param {Object} action - Action configuration
 * @returns {string} Button HTML
 */
function createActionButton(action) {
  const dataAttrs = action.data
    ? Object.entries(action.data)
        .map(([k, v]) => `data-${escapeHtml(k)}="${escapeHtml(String(v))}"`)
        .join(' ')
    : '';

  return `
    <button type="${action.type || 'button'}"
            class="cb-action-btn ${action.className || ''}"
            data-action="${escapeHtml(action.name)}"
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${escapeHtml(action.tooltip)}"` : ''}
            ${dataAttrs}>
      ${action.icon ? `<span class="cb-action-icon">${action.icon}</span>` : ''}
      <span class="cb-action-label">${escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates a sidebar
 * @private
 * @param {Object} sidebar - Sidebar configuration
 * @returns {string} Sidebar HTML
 */
function createSidebar(sidebar) {
  const {
    title = '',
    items = [],
    sticky = false,
    collapsible = false,
  } = sidebar;

  const stickyClass = sticky ? 'cb-sidebar-sticky' : '';
  const collapsibleClass = collapsible ? 'cb-sidebar-collapsible' : '';

  return `
    <div class="cb-sidebar-content ${stickyClass} ${collapsibleClass}">
      ${title ? `<h3 class="cb-sidebar-title">${escapeHtml(title)}</h3>` : ''}
      <nav class="cb-sidebar-nav" role="navigation">
        <ul class="cb-sidebar-list">
          ${items.map((item) => createSidebarItem(item)).join('')}
        </ul>
      </nav>
    </div>
  `;
}

/**
 * Creates a sidebar item
 * @private
 * @param {Object} item - Sidebar item configuration
 * @returns {string} Item HTML
 */
function createSidebarItem(item) {
  const activeClass = item.active ? 'cb-sidebar-active' : '';

  return `
    <li class="cb-sidebar-item ${activeClass}">
      <a href="${escapeHtml(item.href)}" 
         class="cb-sidebar-link"
         ${item.active ? 'aria-current="page"' : ''}>
        ${item.icon ? `<span class="cb-sidebar-icon">${item.icon}</span>` : ''}
        <span class="cb-sidebar-label">${escapeHtml(item.label)}</span>
        ${item.badge ? `<span class="cb-sidebar-badge">${escapeHtml(item.badge)}</span>` : ''}
      </a>
    </li>
  `;
}

/**
 * Creates a tab panel layout
 * @param {Object} config - Tab configuration
 * @returns {string} Tab panel HTML
 */
export function createTabPanel(config) {
  const { tabs = [], activeTab = 0 } = config;

  return `
    <div class="cb-tabs" role="tablist">
      <div class="cb-tab-list">
        ${tabs
          .map(
            (tab, index) => `
          <button type="button"
                  role="tab"
                  class="cb-tab ${index === activeTab ? 'cb-tab-active' : ''}"
                  aria-selected="${index === activeTab}"
                  aria-controls="tab-panel-${index}"
                  data-tab-index="${index}">
            ${tab.icon ? `<span class="cb-tab-icon">${tab.icon}</span>` : ''}
            <span class="cb-tab-label">${escapeHtml(tab.label)}</span>
          </button>
        `
          )
          .join('')}
      </div>
      <div class="cb-tab-panels">
        ${tabs
          .map(
            (tab, index) => `
          <div role="tabpanel"
               id="tab-panel-${index}"
               class="cb-tab-panel ${index === activeTab ? 'cb-tab-panel-active' : ''}"
               ${index !== activeTab ? 'hidden' : ''}>
            ${renderContent(tab.content)}
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Escapes HTML special characters
 * @private
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (str == null) return '';

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(str).replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// Export for testing
export const __testUtils = {
  determineLayout,
  renderContent,
  escapeHtml,
};
```

## Implementation Steps

### Step 1: Create Main Template File

1. Create `src/characterBuilder/templates/core/mainTemplate.js`
2. Implement all layout functions
3. Add comprehensive JSDoc comments

### Step 2: Implement Layout Types

1. Single panel layout
2. Dual panel layout
3. Grid layout with multiple panels
4. Sidebar layout

### Step 3: Add Panel Features

1. Collapsible panels
2. Panel state indicators
3. Panel actions
4. Empty state handling

### Step 4: Export and Integration

1. Update `src/characterBuilder/templates/core/index.js`
2. Integrate with page template

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/characterBuilder/templates/core/mainTemplate.test.js
import { describe, it, expect } from '@jest/globals';
import {
  createMain,
  createTabPanel,
  __testUtils,
} from '../../../../src/characterBuilder/templates/core/mainTemplate.js';

describe('Main Content Template', () => {
  describe('createMain', () => {
    it('should create single layout by default with center panel', () => {
      const html = createMain({
        centerPanel: { content: 'Center content' },
      });

      expect(html).toContain('cb-layout-single');
      expect(html).toContain('Center content');
    });

    it('should create dual layout with left and right panels', () => {
      const html = createMain({
        leftPanel: { content: 'Left' },
        rightPanel: { content: 'Right' },
      });

      expect(html).toContain('cb-layout-dual');
      expect(html).toContain('Left');
      expect(html).toContain('Right');
    });

    it('should create grid layout with multiple panels', () => {
      const html = createMain({
        panels: [
          { content: 'Panel 1' },
          { content: 'Panel 2' },
          { content: 'Panel 3' },
        ],
      });

      expect(html).toContain('cb-layout-grid');
      expect(html).toContain('Panel 1');
      expect(html).toContain('Panel 2');
      expect(html).toContain('Panel 3');
    });

    it('should create sidebar layout', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          title: 'Navigation',
          items: [
            { label: 'Item 1', href: '#1' },
            { label: 'Item 2', href: '#2', active: true },
          ],
        },
        centerPanel: { content: 'Main content' },
      });

      expect(html).toContain('cb-layout-sidebar');
      expect(html).toContain('Navigation');
      expect(html).toContain('Item 1');
      expect(html).toContain('cb-sidebar-active');
    });

    it('should support collapsible panels', () => {
      const html = createMain({
        leftPanel: {
          heading: 'Collapsible',
          content: 'Content',
          collapsible: true,
        },
      });

      expect(html).toContain('cb-panel-collapsible');
      expect(html).toContain('aria-expanded="true"');
    });

    it('should show panel state indicators', () => {
      const html = createMain({
        leftPanel: {
          heading: 'Panel',
          content: 'Content',
          state: {
            loading: true,
            count: 5,
          },
        },
      });

      expect(html).toContain('cb-state-loading');
      expect(html).toContain('cb-state-count');
      expect(html).toContain('5');
    });
  });

  describe('createTabPanel', () => {
    it('should create tab panel layout', () => {
      const html = createTabPanel({
        tabs: [
          { label: 'Tab 1', content: 'Content 1' },
          { label: 'Tab 2', content: 'Content 2' },
        ],
        activeTab: 0,
      });

      expect(html).toContain('cb-tabs');
      expect(html).toContain('Tab 1');
      expect(html).toContain('Tab 2');
      expect(html).toContain('cb-tab-active');
    });
  });
});
```

## Acceptance Criteria

- [ ] Single panel layout works correctly
- [ ] Dual panel layout renders both panels
- [ ] Grid layout supports multiple panels
- [ ] Sidebar layout positions sidebar correctly
- [ ] Panels support headings and content
- [ ] Collapsible panels work with proper ARIA
- [ ] Panel state indicators display
- [ ] Panel actions render correctly
- [ ] Empty state messages show when appropriate
- [ ] Tab panel utility works
- [ ] All content is properly escaped
- [ ] Proper semantic HTML structure
- [ ] All tests pass with 100% coverage

## Related Tickets

- **Depends on**: HTMLTEMP-001, HTMLTEMP-002
- **Next**: HTMLTEMP-005 (Footer Template)
- **Related**: HTMLTEMP-011 (Panel Component)
