# HTMLTEMP-003: Create Header Template Component

## Status
**Status**: Not Started  
**Priority**: High  
**Estimated**: 3 hours  
**Complexity**: Medium  
**Dependencies**: HTMLTEMP-001, HTMLTEMP-002  

## Objective

Create a reusable header template component that provides consistent page headers across all character builder pages, including support for titles, subtitles, navigation, and header actions.

## Background

Each character builder page currently implements its own header with varying structures. This template will standardize the header layout while allowing customization through configuration options.

## Technical Requirements

### 1. Header Template Implementation

#### File: `src/characterBuilder/templates/core/headerTemplate.js`

```javascript
/**
 * @file Header template component for character builder pages
 * @module characterBuilder/templates/core/headerTemplate
 */

/** @typedef {import('../types.js').Action} Action */

/**
 * Header configuration object
 * @typedef {Object} HeaderConfig
 * @property {string} title - Main page title (required)
 * @property {string} [subtitle] - Page subtitle or description
 * @property {Array<NavItem>} [navigation] - Navigation items
 * @property {Array<Action>} [actions] - Header action buttons
 * @property {Object} [branding] - Branding configuration
 * @property {string} [branding.logo] - Logo HTML or image path
 * @property {string} [branding.appName] - Application name
 * @property {boolean} [sticky=false] - Make header sticky
 * @property {string} [className] - Additional CSS classes
 */

/**
 * Navigation item configuration
 * @typedef {Object} NavItem
 * @property {string} label - Navigation item label
 * @property {string} href - Navigation URL
 * @property {boolean} [active=false] - Active state
 * @property {string} [icon] - Icon class or HTML
 * @property {Array<NavItem>} [children] - Submenu items
 */

/**
 * Creates a header component for character builder pages
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
    className = ''
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
 * @private
 * @param {Object} branding - Branding configuration
 * @returns {string} Branding HTML
 */
function createBranding(branding) {
  return `
    <div class="cb-header-branding">
      ${branding.logo ? `
        <div class="cb-header-logo">
          ${isImagePath(branding.logo) 
            ? `<img src="${escapeHtml(branding.logo)}" alt="${escapeHtml(branding.appName || 'Logo')}" />`
            : branding.logo
          }
        </div>
      ` : ''}
      ${branding.appName ? `
        <span class="cb-header-app-name">${escapeHtml(branding.appName)}</span>
      ` : ''}
    </div>
  `;
}

/**
 * Creates header content section
 * @private
 * @param {string} title - Page title
 * @param {string} subtitle - Page subtitle
 * @returns {string} Header content HTML
 */
function createHeaderContent(title, subtitle) {
  return `
    <div class="cb-header-content">
      <div class="cb-header-text">
        <h1 class="cb-page-title">${escapeHtml(title)}</h1>
        ${subtitle ? `
          <p class="cb-page-subtitle">${escapeHtml(subtitle)}</p>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Creates navigation menu
 * @private
 * @param {Array<NavItem>} items - Navigation items
 * @returns {string} Navigation HTML
 */
function createNavigation(items) {
  return `
    <nav class="cb-header-nav" role="navigation" aria-label="Main navigation">
      <ul class="cb-nav-list" role="menubar">
        ${items.map(item => createNavItem(item)).join('')}
      </ul>
    </nav>
  `;
}

/**
 * Creates a navigation item
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
      <a href="${escapeHtml(item.href)}" 
         class="cb-nav-link"
         role="menuitem"
         ${hasChildren ? 'aria-haspopup="true" aria-expanded="false"' : ''}
         ${item.active ? 'aria-current="page"' : ''}>
        ${item.icon ? `<span class="cb-nav-icon">${item.icon}</span>` : ''}
        <span class="cb-nav-label">${escapeHtml(item.label)}</span>
        ${hasChildren ? '<span class="cb-nav-arrow" aria-hidden="true">▼</span>' : ''}
      </a>
      ${hasChildren ? createSubMenu(item.children) : ''}
    </li>
  `;
}

/**
 * Creates submenu for navigation items
 * @private
 * @param {Array<NavItem>} children - Child navigation items
 * @returns {string} Submenu HTML
 */
function createSubMenu(children) {
  return `
    <ul class="cb-nav-submenu" role="menu" aria-hidden="true">
      ${children.map(child => `
        <li class="cb-nav-subitem" role="none">
          <a href="${escapeHtml(child.href)}" 
             class="cb-nav-sublink"
             role="menuitem">
            ${child.icon ? `<span class="cb-nav-icon">${child.icon}</span>` : ''}
            <span class="cb-nav-label">${escapeHtml(child.label)}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Creates header action buttons
 * @private
 * @param {Array<Action>} actions - Action configurations
 * @returns {string} Actions HTML
 */
function createHeaderActions(actions) {
  return `
    <div class="cb-header-actions" role="toolbar" aria-label="Page actions">
      ${actions.map(action => createActionButton(action)).join('')}
    </div>
  `;
}

/**
 * Creates an action button
 * @private
 * @param {Action} action - Action configuration
 * @returns {string} Button HTML
 */
function createActionButton(action) {
  const dataAttributes = action.data 
    ? Object.entries(action.data).map(([key, value]) => 
        `data-${escapeHtml(key)}="${escapeHtml(String(value))}"`
      ).join(' ')
    : '';

  const ariaLabel = action.tooltip || action.label;
  
  return `
    <button type="${action.type || 'button'}"
            class="cb-header-action cb-action-btn ${action.className || ''}"
            data-action="${escapeHtml(action.name)}"
            aria-label="${escapeHtml(ariaLabel)}"
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${escapeHtml(action.tooltip)}"` : ''}
            ${dataAttributes}>
      ${action.icon ? `
        <span class="cb-action-icon" aria-hidden="true">${action.icon}</span>
      ` : ''}
      <span class="cb-action-label">${escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates mobile menu toggle button
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
 * @param {Array<BreadcrumbItem>} items - Breadcrumb items
 * @returns {string} Breadcrumb HTML
 */
export function createBreadcrumb(items) {
  if (!items || items.length === 0) return '';
  
  return `
    <nav class="cb-breadcrumb" aria-label="Breadcrumb">
      <ol class="cb-breadcrumb-list">
        ${items.map((item, index) => {
          const isLast = index === items.length - 1;
          return `
            <li class="cb-breadcrumb-item">
              ${isLast ? `
                <span aria-current="page">${escapeHtml(item.label)}</span>
              ` : `
                <a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>
                <span class="cb-breadcrumb-separator" aria-hidden="true">/</span>
              `}
            </li>
          `;
        }).join('')}
      </ol>
    </nav>
  `;
}

/**
 * Creates a search bar for the header
 * @param {Object} config - Search configuration
 * @returns {string} Search bar HTML
 */
export function createHeaderSearch(config = {}) {
  const {
    placeholder = 'Search...',
    action = '#search',
    method = 'GET',
    name = 'q'
  } = config;
  
  return `
    <form class="cb-header-search" 
          action="${escapeHtml(action)}" 
          method="${escapeHtml(method)}"
          role="search">
      <label for="cb-search-input" class="cb-sr-only">Search</label>
      <input type="search" 
             id="cb-search-input"
             name="${escapeHtml(name)}"
             class="cb-search-input"
             placeholder="${escapeHtml(placeholder)}"
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
 * @private
 * @param {HeaderConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validateHeaderConfig(config) {
  if (!config) {
    throw new Error('Header configuration is required');
  }
  
  if (!config.title) {
    throw new Error('Header title is required');
  }
  
  if (typeof config.title !== 'string') {
    throw new Error('Header title must be a string');
  }
  
  if (config.navigation && !Array.isArray(config.navigation)) {
    throw new Error('Navigation must be an array');
  }
  
  if (config.actions && !Array.isArray(config.actions)) {
    throw new Error('Actions must be an array');
  }
}

/**
 * Checks if a string is an image path
 * @private
 * @param {string} str - String to check
 * @returns {boolean} True if string appears to be an image path
 */
function isImagePath(str) {
  return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(str) || str.startsWith('data:image');
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
    "'": '&#39;'
  };
  
  return String(str).replace(/[&<>"']/g, char => htmlEscapes[char]);
}

// Export for testing
export const __testUtils = {
  validateHeaderConfig,
  isImagePath,
  escapeHtml
};
```

### 2. CSS Structure (Reference)

```css
/* Header styles to be added to character-builder.css */

.cb-page-header {
  background: var(--cb-header-bg, #ffffff);
  border-bottom: 1px solid var(--cb-border-color, #e0e0e0);
  padding: 1rem;
}

.cb-header-sticky {
  position: sticky;
  top: 0;
  z-index: 100;
}

.cb-header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
}

.cb-header-content {
  flex: 1;
}

.cb-page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.cb-page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--cb-text-secondary, #666);
  font-size: 0.875rem;
}

/* Navigation */
.cb-header-nav {
  flex: 0 0 auto;
  margin: 0 2rem;
}

.cb-nav-list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 1rem;
}

.cb-nav-item {
  position: relative;
}

.cb-nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: var(--cb-text-primary, #333);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.cb-nav-link:hover {
  background: var(--cb-hover-bg, #f0f0f0);
}

.cb-nav-active .cb-nav-link {
  background: var(--cb-active-bg, #e0e0e0);
  font-weight: 600;
}

/* Submenu */
.cb-nav-submenu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: white;
  border: 1px solid var(--cb-border-color, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

.cb-nav-parent:hover .cb-nav-submenu,
.cb-nav-parent:focus-within .cb-nav-submenu {
  opacity: 1;
  visibility: visible;
}

/* Mobile menu toggle */
.cb-mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
}

@media (max-width: 768px) {
  .cb-mobile-menu-toggle {
    display: block;
  }
  
  .cb-header-nav,
  .cb-header-actions {
    display: none;
  }
  
  .cb-header-main {
    flex-wrap: wrap;
  }
}
```

## Implementation Steps

### Step 1: Create Header Template File
1. Create `src/characterBuilder/templates/core/headerTemplate.js`
2. Implement all functions as specified
3. Add comprehensive JSDoc comments

### Step 2: Implement Navigation System
1. Create navigation item renderer
2. Add submenu support
3. Implement active state management

### Step 3: Add Action Buttons
1. Implement action button creation
2. Add data attribute support
3. Include accessibility attributes

### Step 4: Mobile Support
1. Add mobile menu toggle
2. Implement responsive behavior
3. Add touch-friendly interactions

### Step 5: Export and Integration
1. Update `src/characterBuilder/templates/core/index.js`
2. Integrate with page template

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/characterBuilder/templates/core/headerTemplate.test.js
import { describe, it, expect } from '@jest/globals';
import { 
  createHeader, 
  createBreadcrumb, 
  createHeaderSearch,
  __testUtils 
} from '../../../../src/characterBuilder/templates/core/headerTemplate.js';

describe('Header Template Component', () => {
  describe('createHeader', () => {
    it('should create basic header with title', () => {
      const html = createHeader({
        title: 'Test Page'
      });
      
      expect(html).toContain('cb-page-header');
      expect(html).toContain('Test Page');
      expect(html).toContain('role="banner"');
    });

    it('should include subtitle when provided', () => {
      const html = createHeader({
        title: 'Test Page',
        subtitle: 'Page description'
      });
      
      expect(html).toContain('Page description');
      expect(html).toContain('cb-page-subtitle');
    });

    it('should render navigation items', () => {
      const html = createHeader({
        title: 'Test',
        navigation: [
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about', active: true }
        ]
      });
      
      expect(html).toContain('cb-header-nav');
      expect(html).toContain('Home');
      expect(html).toContain('About');
      expect(html).toContain('cb-nav-active');
      expect(html).toContain('aria-current="page"');
    });

    it('should render nested navigation', () => {
      const html = createHeader({
        title: 'Test',
        navigation: [{
          label: 'Products',
          href: '#',
          children: [
            { label: 'Product A', href: '/products/a' },
            { label: 'Product B', href: '/products/b' }
          ]
        }]
      });
      
      expect(html).toContain('cb-nav-parent');
      expect(html).toContain('cb-nav-submenu');
      expect(html).toContain('Product A');
      expect(html).toContain('aria-haspopup="true"');
    });

    it('should render header actions', () => {
      const html = createHeader({
        title: 'Test',
        actions: [
          { label: 'Save', name: 'save', icon: '💾' },
          { label: 'Settings', name: 'settings', disabled: true }
        ]
      });
      
      expect(html).toContain('cb-header-actions');
      expect(html).toContain('Save');
      expect(html).toContain('Settings');
      expect(html).toContain('disabled');
      expect(html).toContain('💾');
    });

    it('should add sticky class when configured', () => {
      const html = createHeader({
        title: 'Test',
        sticky: true
      });
      
      expect(html).toContain('cb-header-sticky');
    });

    it('should render branding section', () => {
      const html = createHeader({
        title: 'Test',
        branding: {
          logo: '/logo.png',
          appName: 'My App'
        }
      });
      
      expect(html).toContain('cb-header-branding');
      expect(html).toContain('<img src="/logo.png"');
      expect(html).toContain('My App');
    });

    it('should escape HTML in content', () => {
      const html = createHeader({
        title: '<script>alert("XSS")</script>'
      });
      
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('createBreadcrumb', () => {
    it('should create breadcrumb navigation', () => {
      const html = createBreadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Item' }
      ]);
      
      expect(html).toContain('cb-breadcrumb');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('aria-current="page"');
    });
  });

  describe('createHeaderSearch', () => {
    it('should create search form', () => {
      const html = createHeaderSearch({
        placeholder: 'Search products...',
        action: '/search'
      });
      
      expect(html).toContain('cb-header-search');
      expect(html).toContain('role="search"');
      expect(html).toContain('Search products...');
      expect(html).toContain('action="/search"');
    });
  });

  describe('Validation', () => {
    const { validateHeaderConfig } = __testUtils;

    it('should validate required fields', () => {
      expect(() => validateHeaderConfig(null)).toThrow();
      expect(() => validateHeaderConfig({})).toThrow('title is required');
      expect(() => validateHeaderConfig({ title: 123 })).toThrow('must be a string');
    });

    it('should validate array fields', () => {
      expect(() => validateHeaderConfig({
        title: 'Test',
        navigation: 'not-an-array'
      })).toThrow('must be an array');
    });
  });
});
```

## Acceptance Criteria

- [ ] Header renders with required title
- [ ] Subtitle displays when provided
- [ ] Navigation menu renders with proper ARIA attributes
- [ ] Nested navigation (submenus) works correctly
- [ ] Header actions render as buttons with data attributes
- [ ] Mobile menu toggle is included
- [ ] Sticky header option works
- [ ] Branding section displays logo and app name
- [ ] Breadcrumb navigation helper works
- [ ] Search bar helper works
- [ ] All content is properly HTML-escaped
- [ ] Proper semantic HTML and ARIA labels
- [ ] All tests pass with 100% coverage
- [ ] No ESLint errors or warnings

## Performance Requirements

- Template rendering < 5ms
- No memory leaks from event handlers
- Efficient HTML string concatenation

## Notes

- Consider adding user menu support in future enhancement
- Mobile menu implementation will need JavaScript for toggle functionality
- Breadcrumb and search are exported as separate utilities for flexibility

## Related Tickets

- **Depends on**: HTMLTEMP-001, HTMLTEMP-002
- **Next**: HTMLTEMP-004 (Main Content Template)
- **Related**: HTMLTEMP-031 (Controller Integration)