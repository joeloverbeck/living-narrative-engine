/**
 * @file Header template component for character builder pages
 * @module characterBuilder/templates/core/headerTemplate
 */

import { DomUtils } from '../../../utils/domUtils.js';
import { string } from '../../../utils/validationCore.js';

/** @typedef {import('../types.js').Action} Action */

/**
 * @typedef {object} BreadcrumbItem
 * @property {string} label - Display text for the breadcrumb
 * @property {string} [href] - Optional link URL
 */

/**
 * @typedef {object} NavItem
 * @property {string} label - Navigation item label
 * @property {string} href - Navigation URL
 * @property {boolean} [active=false] - Active state
 * @property {string} [icon] - Icon class or HTML
 * @property {Array<NavItem>} [children] - Submenu items
 */

/**
 * Header configuration object
 *
 * @typedef {object} HeaderConfig
 * @property {string} title - Main page title (required)
 * @property {string} [subtitle] - Page subtitle or description
 * @property {Array<NavItem>} [navigation] - Navigation items
 * @property {Array<Action>} [actions] - Header action buttons
 * @property {object} [branding] - Branding configuration
 * @property {string} [branding.logo] - Logo HTML or image path
 * @property {string} [branding.appName] - Application name
 * @property {boolean} [sticky=false] - Make header sticky
 * @property {string} [className] - Additional CSS classes
 */

/**
 * Creates a header component for character builder pages
 *
 * @param {HeaderConfig} config - Header configuration
 * @returns {string} Header HTML
 */
export function createHeader(config) {
  validateHeaderConfig(config);

  const {
    title,
    subtitle = '',
    navigation = [],
    actions = [],
    branding = null,
    sticky = false,
    className = '',
  } = config;

  const stickyClass = sticky ? 'cb-header-sticky' : '';
  const headerClasses = `cb-page-header ${stickyClass} ${className}`.trim();

  return `
    <header class="${headerClasses}" role="banner">
      ${branding ? createBranding(branding) : ''}
      <div class="cb-header-main">
        ${createHeaderContent(title, subtitle)}
        ${navigation.length > 0 ? createNavigation(navigation) : ''}
        ${actions.length > 0 ? createHeaderActions(actions) : ''}
      </div>
      ${createMobileMenuToggle()}
    </header>
  `;
}

/**
 * Creates branding section
 *
 * @private
 * @param {object} branding - Branding configuration
 * @returns {string} Branding HTML
 */
function createBranding(branding) {
  return `
    <div class="cb-header-branding">
      ${
        branding.logo
          ? `
        <div class="cb-header-logo">
          ${
            isImagePath(branding.logo)
              ? `<img src="${DomUtils.escapeHtml(branding.logo)}" alt="${DomUtils.escapeHtml(branding.appName || 'Logo')}" />`
              : branding.logo
          }
        </div>
      `
          : ''
      }
      ${
        branding.appName
          ? `
        <span class="cb-header-app-name">${DomUtils.escapeHtml(branding.appName)}</span>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Creates header content section
 *
 * @private
 * @param {string} title - Page title
 * @param {string} subtitle - Page subtitle
 * @returns {string} Header content HTML
 */
function createHeaderContent(title, subtitle) {
  return `
    <div class="cb-header-content">
      <div class="cb-header-text">
        <h1 class="cb-page-title">${DomUtils.escapeHtml(title)}</h1>
        ${
          subtitle
            ? `
          <p class="cb-page-subtitle">${DomUtils.escapeHtml(subtitle)}</p>
        `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Creates navigation menu
 *
 * @private
 * @param {Array<NavItem>} items - Navigation items
 * @returns {string} Navigation HTML
 */
function createNavigation(items) {
  return `
    <nav class="cb-header-nav" role="navigation" aria-label="Main navigation">
      <ul class="cb-nav-list" role="menubar">
        ${items.map((item) => createNavItem(item)).join('')}
      </ul>
    </nav>
  `;
}

/**
 * Creates a navigation item
 *
 * @private
 * @param {NavItem} item - Navigation item configuration
 * @returns {string} Navigation item HTML
 */
function createNavItem(item) {
  const hasChildren = item.children && item.children.length > 0;
  const activeClass = item.active ? 'cb-nav-active' : '';
  const parentClass = hasChildren ? 'cb-nav-parent' : '';

  return `
    <li class="cb-nav-item ${activeClass} ${parentClass}" role="none">
      <a href="${DomUtils.escapeHtml(item.href)}" 
         class="cb-nav-link"
         role="menuitem"
         ${hasChildren ? 'aria-haspopup="true" aria-expanded="false"' : ''}
         ${item.active ? 'aria-current="page"' : ''}>
        ${item.icon ? `<span class="cb-nav-icon">${item.icon}</span>` : ''}
        <span class="cb-nav-label">${DomUtils.escapeHtml(item.label)}</span>
        ${hasChildren ? '<span class="cb-nav-arrow" aria-hidden="true">▼</span>' : ''}
      </a>
      ${hasChildren ? createSubMenu(item.children) : ''}
    </li>
  `;
}

/**
 * Creates submenu for navigation items
 *
 * @private
 * @param {Array<NavItem>} children - Child navigation items
 * @returns {string} Submenu HTML
 */
function createSubMenu(children) {
  return `
    <ul class="cb-nav-submenu" role="menu" aria-hidden="true">
      ${children
        .map(
          (child) => `
        <li class="cb-nav-subitem" role="none">
          <a href="${DomUtils.escapeHtml(child.href)}" 
             class="cb-nav-sublink"
             role="menuitem">
            ${child.icon ? `<span class="cb-nav-icon">${child.icon}</span>` : ''}
            <span class="cb-nav-label">${DomUtils.escapeHtml(child.label)}</span>
          </a>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

/**
 * Creates header action buttons
 *
 * @private
 * @param {Array<Action>} actions - Action configurations
 * @returns {string} Actions HTML
 */
function createHeaderActions(actions) {
  return `
    <div class="cb-header-actions" role="toolbar" aria-label="Page actions">
      ${actions.map((action) => createActionButton(action)).join('')}
    </div>
  `;
}

/**
 * Creates an action button
 *
 * @private
 * @param {Action} action - Action configuration
 * @returns {string} Button HTML
 */
function createActionButton(action) {
  const dataAttributes = action.data
    ? Object.entries(action.data)
        .map(
          ([key, value]) =>
            `data-${DomUtils.escapeHtml(key)}="${DomUtils.escapeHtml(String(value))}"`
        )
        .join(' ')
    : '';

  const ariaLabel = action.tooltip || action.label;

  return `
    <button type="${action.type || 'button'}"
            class="cb-header-action cb-action-btn ${action.className || ''}"
            data-action="${DomUtils.escapeHtml(action.name)}"
            aria-label="${DomUtils.escapeHtml(ariaLabel)}"
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${DomUtils.escapeHtml(action.tooltip)}"` : ''}
            ${dataAttributes}>
      ${
        action.icon
          ? `
        <span class="cb-action-icon" aria-hidden="true">${action.icon}</span>
      `
          : ''
      }
      <span class="cb-action-label">${DomUtils.escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates mobile menu toggle button
 *
 * @private
 * @returns {string} Mobile toggle HTML
 */
function createMobileMenuToggle() {
  return `
    <button type="button" 
            class="cb-mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded="false"
            aria-controls="cb-mobile-menu">
      <span class="cb-menu-icon" aria-hidden="true">
        <span class="cb-menu-line"></span>
        <span class="cb-menu-line"></span>
        <span class="cb-menu-line"></span>
      </span>
    </button>
  `;
}

/**
 * Creates a breadcrumb navigation
 *
 * @param {Array<BreadcrumbItem>} items - Breadcrumb items
 * @returns {string} Breadcrumb HTML
 */
export function createBreadcrumb(items) {
  if (!items || items.length === 0) return '';

  return `
    <nav class="cb-breadcrumb" aria-label="Breadcrumb">
      <ol class="cb-breadcrumb-list">
        ${items
          .map((item, index) => {
            const isLast = index === items.length - 1;
            return `
            <li class="cb-breadcrumb-item">
              ${
                isLast
                  ? `
                <span aria-current="page">${DomUtils.escapeHtml(item.label)}</span>
              `
                  : `
                <a href="${DomUtils.escapeHtml(item.href)}">${DomUtils.escapeHtml(item.label)}</a>
                <span class="cb-breadcrumb-separator" aria-hidden="true">/</span>
              `
              }
            </li>
          `;
          })
          .join('')}
      </ol>
    </nav>
  `;
}

/**
 * Creates a search bar for the header
 *
 * @param {object} config - Search configuration
 * @returns {string} Search bar HTML
 */
export function createHeaderSearch(config = {}) {
  const {
    placeholder = 'Search...',
    action = '#search',
    method = 'GET',
    name = 'q',
  } = config;

  return `
    <form class="cb-header-search" 
          action="${DomUtils.escapeHtml(action)}" 
          method="${DomUtils.escapeHtml(method)}"
          role="search">
      <label for="cb-search-input" class="cb-sr-only">Search</label>
      <input type="search" 
             id="cb-search-input"
             name="${DomUtils.escapeHtml(name)}"
             class="cb-search-input"
             placeholder="${DomUtils.escapeHtml(placeholder)}"
             aria-label="Search">
      <button type="submit" 
              class="cb-search-button"
              aria-label="Submit search">
        <span class="cb-search-icon" aria-hidden="true">🔍</span>
      </button>
    </form>
  `;
}

/**
 * Validates header configuration
 *
 * @private
 * @param {HeaderConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validateHeaderConfig(config) {
  if (!config) {
    throw new Error('Header configuration is required');
  }

  // Use project validation utilities
  string.assertNonBlank(config.title, 'title', 'Header configuration');

  if (config.navigation && !Array.isArray(config.navigation)) {
    throw new Error('Navigation must be an array');
  }

  if (config.actions && !Array.isArray(config.actions)) {
    throw new Error('Actions must be an array');
  }
}

/**
 * Checks if a string is an image path
 *
 * @private
 * @param {string} str - String to check
 * @returns {boolean} True if string appears to be an image path
 */
function isImagePath(str) {
  return (
    /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(str) || str.startsWith('data:image')
  );
}

// Note: Using DomUtils.escapeHtml directly throughout the code
// No need to create a local reference since we're using the utility directly

// Export for testing
export const __testUtils = {
  validateHeaderConfig,
  isImagePath,
};
