/**
 * @file Page template container for character builder pages
 * @module characterBuilder/templates/core/pageTemplate
 */

import { createHeader } from './headerTemplate.js';

/** @typedef {import('../types.js').PageConfig} PageConfig */
/** @typedef {import('../types.js').PanelConfig} PanelConfig */

/**
 * Creates a complete character builder page structure
 *
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
 *
 * @private
 * @param {string} title - Page title
 * @param {string} subtitle - Page subtitle
 * @param {Array} actions - Header actions
 * @returns {string} Header HTML
 */
function createPageHeader(title, subtitle, actions) {
  // Using the new header template from HTMLTEMP-003
  return createHeader({
    title,
    subtitle,
    actions,
  });
}

/**
 * Creates the main content area
 *
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
 *
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
 *
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
 *
 * @private
 * @param {object} footer - Footer configuration
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
 *
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
 *
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
 *
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
 *
 * @private
 * @param {object} action - Action configuration
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
 *
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
 *
 * @private
 * @returns {object} Default footer config
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
 *
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
