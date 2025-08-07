# HTMLTEMP-005: Build Footer Template Component

## Status

**Status**: Not Started  
**Priority**: Medium  
**Estimated**: 2 hours  
**Complexity**: Low  
**Dependencies**: HTMLTEMP-001, HTMLTEMP-002

## Objective

Create a reusable footer template component that provides consistent page footers across all character builder pages, including status information, navigation links, version display, and customizable content areas.

## Background

Each character builder page currently has its own footer implementation with varying content and structure. This template will standardize the footer while allowing page-specific customization.

## Technical Requirements

### 1. Footer Template Implementation

#### File: `src/characterBuilder/templates/core/footerTemplate.js`

```javascript
/**
 * @file Footer template component for character builder pages
 * @module characterBuilder/templates/core/footerTemplate
 */

/** @typedef {import('../types.js').FooterConfig} FooterConfig */
/** @typedef {import('../types.js').Link} Link */

/**
 * Extended footer configuration
 * @typedef {Object} ExtendedFooterConfig
 * @property {string} [status] - Status text to display
 * @property {Array<Link>} [links] - Footer navigation links
 * @property {boolean} [showVersion=true] - Show version information
 * @property {string} [version] - Version string (auto-detected if not provided)
 * @property {string} [copyright] - Copyright text
 * @property {Array<Link>} [socialLinks] - Social media links
 * @property {string} [customContent] - Custom HTML content
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [sticky=false] - Make footer sticky to bottom
 * @property {'light'|'dark'|'auto'} [theme='auto'] - Footer theme
 */

/**
 * Creates a footer component for character builder pages
 * @param {ExtendedFooterConfig} config - Footer configuration
 * @returns {string} Footer HTML
 */
export function createFooter(config = {}) {
  const {
    status = '',
    links = getDefaultLinks(),
    showVersion = true,
    version = getAppVersion(),
    copyright = getDefaultCopyright(),
    socialLinks = [],
    customContent = '',
    className = '',
    sticky = false,
    theme = 'auto',
  } = config;

  const stickyClass = sticky ? 'cb-footer-sticky' : '';
  const themeClass = `cb-footer-theme-${theme}`;
  const footerClasses =
    `cb-page-footer ${stickyClass} ${themeClass} ${className}`.trim();

  return `
    <footer class="${footerClasses}" role="contentinfo">
      ${status ? createStatusBar(status) : ''}
      <div class="cb-footer-main">
        <div class="cb-footer-container">
          ${createFooterContent(links, copyright, showVersion, version)}
          ${socialLinks.length > 0 ? createSocialLinks(socialLinks) : ''}
          ${customContent ? createCustomContent(customContent) : ''}
        </div>
      </div>
      ${createFooterBottom()}
    </footer>
  `;
}

/**
 * Creates status bar section
 * @private
 * @param {string} status - Status text
 * @returns {string} Status bar HTML
 */
function createStatusBar(status) {
  return `
    <div class="cb-footer-status-bar" role="status" aria-live="polite">
      <span class="cb-status-text">${escapeHtml(status)}</span>
    </div>
  `;
}

/**
 * Creates main footer content
 * @private
 * @param {Array<Link>} links - Footer links
 * @param {string} copyright - Copyright text
 * @param {boolean} showVersion - Show version flag
 * @param {string} version - Version string
 * @returns {string} Footer content HTML
 */
function createFooterContent(links, copyright, showVersion, version) {
  return `
    <div class="cb-footer-content">
      <div class="cb-footer-left">
        ${copyright ? `<p class="cb-footer-copyright">${escapeHtml(copyright)}</p>` : ''}
        ${showVersion ? `<span class="cb-footer-version">Version ${escapeHtml(version)}</span>` : ''}
      </div>
      <div class="cb-footer-center">
        ${links.length > 0 ? createFooterNav(links) : ''}
      </div>
      <div class="cb-footer-right">
        ${createQuickActions()}
      </div>
    </div>
  `;
}

/**
 * Creates footer navigation
 * @private
 * @param {Array<Link>} links - Navigation links
 * @returns {string} Navigation HTML
 */
function createFooterNav(links) {
  return `
    <nav class="cb-footer-nav" aria-label="Footer navigation">
      <ul class="cb-footer-links">
        ${links.map((link) => createFooterLink(link)).join('')}
      </ul>
    </nav>
  `;
}

/**
 * Creates a footer link
 * @private
 * @param {Link} link - Link configuration
 * @returns {string} Link HTML
 */
function createFooterLink(link) {
  const target = link.target || '_self';
  const rel = target === '_blank' ? 'rel="noopener noreferrer"' : '';

  return `
    <li class="cb-footer-link-item">
      <a href="${escapeHtml(link.href)}"
         target="${escapeHtml(target)}"
         ${rel}
         class="cb-footer-link ${link.className || ''}"
         ${link.title ? `title="${escapeHtml(link.title)}"` : ''}>
        ${link.icon ? `<span class="cb-footer-link-icon">${link.icon}</span>` : ''}
        <span class="cb-footer-link-text">${escapeHtml(link.label)}</span>
      </a>
    </li>
  `;
}

/**
 * Creates social media links
 * @private
 * @param {Array<Link>} socialLinks - Social media links
 * @returns {string} Social links HTML
 */
function createSocialLinks(socialLinks) {
  return `
    <div class="cb-footer-social">
      <span class="cb-footer-social-label">Follow us:</span>
      <div class="cb-footer-social-links">
        ${socialLinks
          .map(
            (link) => `
          <a href="${escapeHtml(link.href)}"
             target="_blank"
             rel="noopener noreferrer"
             class="cb-footer-social-link cb-social-${link.platform || 'default'}"
             aria-label="${escapeHtml(link.label || link.platform)}">
            ${link.icon || getSocialIcon(link.platform)}
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Creates custom content section
 * @private
 * @param {string} content - Custom HTML content
 * @returns {string} Custom content HTML
 */
function createCustomContent(content) {
  return `
    <div class="cb-footer-custom">
      ${content}
    </div>
  `;
}

/**
 * Creates quick action buttons
 * @private
 * @returns {string} Quick actions HTML
 */
function createQuickActions() {
  return `
    <div class="cb-footer-actions">
      <button type="button" 
              class="cb-footer-action cb-back-to-top"
              aria-label="Back to top"
              title="Back to top">
        <span aria-hidden="true">↑</span>
      </button>
      <button type="button"
              class="cb-footer-action cb-toggle-theme"
              aria-label="Toggle theme"
              title="Toggle theme">
        <span aria-hidden="true">🌓</span>
      </button>
    </div>
  `;
}

/**
 * Creates footer bottom section
 * @private
 * @returns {string} Footer bottom HTML
 */
function createFooterBottom() {
  return `
    <div class="cb-footer-bottom">
      <div class="cb-footer-legal">
        <a href="#privacy" class="cb-footer-legal-link">Privacy Policy</a>
        <span class="cb-footer-separator">•</span>
        <a href="#terms" class="cb-footer-legal-link">Terms of Service</a>
        <span class="cb-footer-separator">•</span>
        <a href="#cookies" class="cb-footer-legal-link">Cookie Policy</a>
      </div>
    </div>
  `;
}

/**
 * Creates a minimal footer
 * @param {Object} config - Minimal footer configuration
 * @returns {string} Minimal footer HTML
 */
export function createMinimalFooter(config = {}) {
  const { text = '', className = '' } = config;

  return `
    <footer class="cb-footer-minimal ${className}" role="contentinfo">
      <div class="cb-footer-minimal-content">
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        <span class="cb-footer-minimal-version">v${getAppVersion()}</span>
      </div>
    </footer>
  `;
}

/**
 * Creates a debug footer with system information
 * @param {Object} config - Debug footer configuration
 * @returns {string} Debug footer HTML
 */
export function createDebugFooter(config = {}) {
  const {
    showPerformance = true,
    showMemory = true,
    showBuildInfo = true,
    className = '',
  } = config;

  return `
    <footer class="cb-footer-debug ${className}" role="contentinfo">
      <div class="cb-footer-debug-content">
        ${showPerformance ? createPerformanceInfo() : ''}
        ${showMemory ? createMemoryInfo() : ''}
        ${showBuildInfo ? createBuildInfo() : ''}
      </div>
    </footer>
  `;
}

/**
 * Creates performance information display
 * @private
 * @returns {string} Performance info HTML
 */
function createPerformanceInfo() {
  return `
    <div class="cb-debug-section cb-debug-performance">
      <span class="cb-debug-label">Performance:</span>
      <span class="cb-debug-value" id="cb-perf-load">Load: --ms</span>
      <span class="cb-debug-value" id="cb-perf-render">Render: --ms</span>
    </div>
  `;
}

/**
 * Creates memory information display
 * @private
 * @returns {string} Memory info HTML
 */
function createMemoryInfo() {
  return `
    <div class="cb-debug-section cb-debug-memory">
      <span class="cb-debug-label">Memory:</span>
      <span class="cb-debug-value" id="cb-mem-used">Used: --MB</span>
      <span class="cb-debug-value" id="cb-mem-limit">Limit: --MB</span>
    </div>
  `;
}

/**
 * Creates build information display
 * @private
 * @returns {string} Build info HTML
 */
function createBuildInfo() {
  return `
    <div class="cb-debug-section cb-debug-build">
      <span class="cb-debug-label">Build:</span>
      <span class="cb-debug-value">${getBuildTimestamp()}</span>
      <span class="cb-debug-value">${getEnvironment()}</span>
    </div>
  `;
}

/**
 * Gets default footer links
 * @private
 * @returns {Array<Link>} Default links
 */
function getDefaultLinks() {
  return [
    { label: 'Help', href: '#help' },
    { label: 'Documentation', href: '#docs' },
    { label: 'Support', href: '#support' },
    { label: 'About', href: '#about' },
  ];
}

/**
 * Gets default copyright text
 * @private
 * @returns {string} Copyright text
 */
function getDefaultCopyright() {
  const year = new Date().getFullYear();
  return `© ${year} Living Narrative Engine. All rights reserved.`;
}

/**
 * Gets application version
 * @private
 * @returns {string} Version string
 */
function getAppVersion() {
  // This would normally read from package.json or build config
  return '1.0.0';
}

/**
 * Gets build timestamp
 * @private
 * @returns {string} Build timestamp
 */
function getBuildTimestamp() {
  // This would be replaced during build
  return new Date().toISOString();
}

/**
 * Gets environment name
 * @private
 * @returns {string} Environment
 */
function getEnvironment() {
  // This would be set from environment variable
  return 'development';
}

/**
 * Gets social media icon
 * @private
 * @param {string} platform - Social platform name
 * @returns {string} Icon HTML
 */
function getSocialIcon(platform) {
  const icons = {
    twitter: '𝕏',
    facebook: 'f',
    linkedin: 'in',
    github: '⚡',
    discord: '💬',
    youtube: '▶',
  };

  return `<span class="cb-social-icon">${icons[platform] || '🔗'}</span>`;
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
  getDefaultLinks,
  getDefaultCopyright,
  escapeHtml,
  getSocialIcon,
};
```

### 2. CSS Structure (Reference)

```css
/* Footer styles to be added to character-builder.css */

.cb-page-footer {
  background: var(--cb-footer-bg, #f8f9fa);
  border-top: 1px solid var(--cb-border-color, #e0e0e0);
  margin-top: auto;
}

.cb-footer-sticky {
  position: sticky;
  bottom: 0;
  z-index: 50;
}

.cb-footer-status-bar {
  background: var(--cb-status-bg, #333);
  color: var(--cb-status-color, #fff);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.cb-footer-main {
  padding: 1.5rem 1rem;
}

.cb-footer-container {
  max-width: 1400px;
  margin: 0 auto;
}

.cb-footer-content {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 2rem;
}

.cb-footer-links {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 1.5rem;
}

.cb-footer-link {
  color: var(--cb-footer-link-color, #666);
  text-decoration: none;
  transition: color 0.2s;
}

.cb-footer-link:hover {
  color: var(--cb-footer-link-hover, #333);
}

.cb-footer-bottom {
  background: var(--cb-footer-bottom-bg, #e9ecef);
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
}

/* Responsive */
@media (max-width: 768px) {
  .cb-footer-content {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .cb-footer-links {
    flex-direction: column;
    gap: 0.5rem;
  }
}
```

## Implementation Steps

### Step 1: Create Footer Template File

1. Create `src/characterBuilder/templates/core/footerTemplate.js`
2. Implement all functions as specified
3. Add comprehensive JSDoc comments

### Step 2: Implement Footer Variations

1. Standard footer with all features
2. Minimal footer for simple pages
3. Debug footer for development

### Step 3: Add Interactive Elements

1. Back to top button
2. Theme toggle button
3. Social media links

### Step 4: Export and Integration

1. Update `src/characterBuilder/templates/core/index.js`
2. Integrate with page template

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/characterBuilder/templates/core/footerTemplate.test.js
import { describe, it, expect } from '@jest/globals';
import {
  createFooter,
  createMinimalFooter,
  createDebugFooter,
  __testUtils,
} from '../../../../src/characterBuilder/templates/core/footerTemplate.js';

describe('Footer Template Component', () => {
  describe('createFooter', () => {
    it('should create basic footer with defaults', () => {
      const html = createFooter();

      expect(html).toContain('cb-page-footer');
      expect(html).toContain('role="contentinfo"');
      expect(html).toContain('Version');
    });

    it('should display status when provided', () => {
      const html = createFooter({
        status: 'System online',
      });

      expect(html).toContain('cb-footer-status-bar');
      expect(html).toContain('System online');
    });

    it('should render custom links', () => {
      const html = createFooter({
        links: [{ label: 'Custom', href: '/custom' }],
      });

      expect(html).toContain('Custom');
      expect(html).toContain('/custom');
    });

    it('should render social links', () => {
      const html = createFooter({
        socialLinks: [
          { platform: 'twitter', href: 'https://twitter.com' },
          { platform: 'github', href: 'https://github.com' },
        ],
      });

      expect(html).toContain('cb-footer-social');
      expect(html).toContain('cb-social-twitter');
    });

    it('should support sticky footer', () => {
      const html = createFooter({
        sticky: true,
      });

      expect(html).toContain('cb-footer-sticky');
    });

    it('should escape HTML in content', () => {
      const html = createFooter({
        status: '<script>alert("XSS")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('createMinimalFooter', () => {
    it('should create minimal footer', () => {
      const html = createMinimalFooter({
        text: 'Simple footer',
      });

      expect(html).toContain('cb-footer-minimal');
      expect(html).toContain('Simple footer');
    });
  });

  describe('createDebugFooter', () => {
    it('should create debug footer with info sections', () => {
      const html = createDebugFooter({
        showPerformance: true,
        showMemory: true,
        showBuildInfo: true,
      });

      expect(html).toContain('cb-footer-debug');
      expect(html).toContain('cb-debug-performance');
      expect(html).toContain('cb-debug-memory');
      expect(html).toContain('cb-debug-build');
    });
  });
});
```

## Acceptance Criteria

- [ ] Footer renders with default content
- [ ] Status bar displays when provided
- [ ] Navigation links render correctly
- [ ] Social media links work with icons
- [ ] Copyright text displays with current year
- [ ] Version information shows
- [ ] Sticky footer option works
- [ ] Theme support implemented
- [ ] Back to top button included
- [ ] Minimal footer variant works
- [ ] Debug footer shows system info
- [ ] All content is properly escaped
- [ ] Proper semantic HTML and ARIA
- [ ] Responsive design works
- [ ] All tests pass with 100% coverage

## Performance Requirements

- Template rendering < 3ms
- No memory leaks
- Efficient string concatenation

## Notes

- Consider adding language/locale support in future
- Back to top and theme toggle will need JavaScript implementation
- Debug footer useful for development environments

## Related Tickets

- **Depends on**: HTMLTEMP-001, HTMLTEMP-002
- **Next**: HTMLTEMP-006 (Modal Template)
- **Related**: HTMLTEMP-031 (Controller Integration)
