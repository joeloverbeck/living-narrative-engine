/**
 * @file Main content area template for character builder pages
 * @module characterBuilder/templates/core/mainTemplate
 */

import { DomUtils } from '../../../utils/domUtils.js';

/** @typedef {import('../types.js').PanelConfig} PanelConfig */

/**
 * Main content configuration
 *
 * @typedef {object} MainConfig
 * @property {PanelConfig} [leftPanel] - Left panel configuration
 * @property {PanelConfig} [rightPanel] - Right panel configuration
 * @property {PanelConfig} [centerPanel] - Center panel for single layout
 * @property {Array<PanelConfig>} [panels] - Multiple panels for grid layout
 * @property {'dual'|'single'|'grid'|'sidebar'} [layout='dual'] - Layout type
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [fluid=false] - Full width layout
 * @property {object} [sidebar] - Sidebar configuration for sidebar layout
 */

/**
 * Creates the main content area
 *
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
 *
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
 *
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
 *
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
 *
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
 *
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
 *
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
 *
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

  const panelId = id ? `id="${DomUtils.escapeHtml(id)}"` : '';
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
              <p class="cb-empty-message">${DomUtils.escapeHtml(emptyMessage)}</p>
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
 *
 * @private
 * @param {string} heading - Panel heading
 * @param {string} id - Panel ID
 * @param {boolean} collapsible - Whether panel is collapsible
 * @param {object} state - Panel state indicators
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
            ${DomUtils.escapeHtml(heading)}
          </button>
        `
            : DomUtils.escapeHtml(heading)
        }
      </h2>
      ${state ? createPanelState(state) : ''}
    </div>
  `;
}

/**
 * Creates panel state indicators
 *
 * @private
 * @param {object} state - State configuration
 * @returns {string} State HTML
 */
function createPanelState(state) {
  return `
    <div class="cb-panel-state">
      ${state.loading ? '<span class="cb-state-loading">Loading...</span>' : ''}
      ${state.error ? `<span class="cb-state-error">${DomUtils.escapeHtml(state.error)}</span>` : ''}
      ${state.success ? `<span class="cb-state-success">${DomUtils.escapeHtml(state.success)}</span>` : ''}
      ${state.count !== undefined ? `<span class="cb-state-count">${state.count}</span>` : ''}
    </div>
  `;
}

/**
 * Renders panel content
 *
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
 *
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
 *
 * @private
 * @param {object} action - Action configuration
 * @returns {string} Button HTML
 */
function createActionButton(action) {
  const dataAttrs = action.data
    ? Object.entries(action.data)
        .map(
          ([k, v]) =>
            `data-${DomUtils.escapeHtml(k)}="${DomUtils.escapeHtml(String(v))}"`
        )
        .join(' ')
    : '';

  return `
    <button type="${action.type || 'button'}"
            class="cb-action-btn ${action.className || ''}"
            data-action="${DomUtils.escapeHtml(action.name)}"
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${DomUtils.escapeHtml(action.tooltip)}"` : ''}
            ${dataAttrs}>
      ${action.icon ? `<span class="cb-action-icon">${action.icon}</span>` : ''}
      <span class="cb-action-label">${DomUtils.escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates a sidebar
 *
 * @private
 * @param {object} sidebar - Sidebar configuration
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
      ${title ? `<h3 class="cb-sidebar-title">${DomUtils.escapeHtml(title)}</h3>` : ''}
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
 *
 * @private
 * @param {object} item - Sidebar item configuration
 * @returns {string} Item HTML
 */
function createSidebarItem(item) {
  const activeClass = item.active ? 'cb-sidebar-active' : '';

  return `
    <li class="cb-sidebar-item ${activeClass}">
      <a href="${DomUtils.escapeHtml(item.href)}" 
         class="cb-sidebar-link"
         ${item.active ? 'aria-current="page"' : ''}>
        ${item.icon ? `<span class="cb-sidebar-icon">${item.icon}</span>` : ''}
        <span class="cb-sidebar-label">${DomUtils.escapeHtml(item.label)}</span>
        ${item.badge ? `<span class="cb-sidebar-badge">${DomUtils.escapeHtml(item.badge)}</span>` : ''}
      </a>
    </li>
  `;
}

/**
 * Creates a tab panel layout
 *
 * @param {object} config - Tab configuration
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
            <span class="cb-tab-label">${DomUtils.escapeHtml(tab.label)}</span>
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

// Export for testing
export const __testUtils = {
  determineLayout,
  renderContent,
};
