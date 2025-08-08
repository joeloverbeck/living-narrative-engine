/**
 * @file Footer template component for character builder pages
 * @module characterBuilder/templates/core/footerTemplate
 */

/** @typedef {import('../types.js').FooterConfig} FooterConfig */
/** @typedef {import('../types.js').Link} Link */

/**
 * Extended footer configuration
 *
 * @typedef {object} ExtendedFooterConfig
 * @property {string} [status] - Status text to display
 * @property {Array<Link>} [links] - Footer navigation links
 * @property {boolean} [showVersion=true] - Show version information
 * @property {string} [version] - Version string (auto-detected if not provided)
 * @property {string} [copyright] - Copyright text
 * @property {Array<SocialLink>} [socialLinks] - Social media links
 * @property {string} [customContent] - Custom HTML content
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [sticky=false] - Make footer sticky to bottom
 * @property {'light'|'dark'|'auto'} [theme='auto'] - Footer theme
 */

/**
 * @typedef {object} SocialLink
 * @property {string} href - Link URL (required)
 * @property {string} platform - Social platform name
 * @property {string} [label] - Link label for accessibility
 * @property {string} [icon] - Custom icon HTML
 */

/**
 * Creates a footer component for character builder pages
 *
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
 *
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
 *
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
 *
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
 *
 * @private
 * @param {Link} link - Link configuration
 * @returns {string} Link HTML
 */
function createFooterLink(link) {
  const target = link.target || '_self';
  const rel = target === '_blank' ? 'rel="noopener noreferrer"' : '';
  const title = link.title || '';

  return `
    <li class="cb-footer-link-item">
      <a href="${escapeHtml(link.href)}"
         target="${escapeHtml(target)}"
         ${rel}
         class="cb-footer-link ${link.className || ''}"
         ${title ? `title="${escapeHtml(title)}"` : ''}>
        ${link.icon ? `<span class="cb-footer-link-icon">${link.icon}</span>` : ''}
        <span class="cb-footer-link-text">${escapeHtml(link.label)}</span>
      </a>
    </li>
  `;
}

/**
 * Creates social media links
 *
 * @private
 * @param {Array<SocialLink>} socialLinks - Social media links
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
             aria-label="${escapeHtml(link.label || link.platform || 'Social media')}">
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
 *
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
 *
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
 *
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
 *
 * @param {object} config - Minimal footer configuration
 * @param {string} [config.text] - Footer text
 * @param {string} [config.className] - Additional CSS classes
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
 *
 * @param {object} config - Debug footer configuration
 * @param {boolean} [config.showPerformance] - Show performance metrics
 * @param {boolean} [config.showMemory] - Show memory usage
 * @param {boolean} [config.showBuildInfo] - Show build information
 * @param {string} [config.className] - Additional CSS classes
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
 *
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
 *
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
 *
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
 *
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
 *
 * @private
 * @returns {string} Copyright text
 */
function getDefaultCopyright() {
  const year = new Date().getFullYear();
  return `© ${year} Living Narrative Engine. All rights reserved.`;
}

/**
 * Gets application version
 *
 * @private
 * @returns {string} Version string
 */
function getAppVersion() {
  // TODO: Read from package.json or build config
  return '1.0.0';
}

/**
 * Gets build timestamp
 *
 * @private
 * @returns {string} Build timestamp
 */
function getBuildTimestamp() {
  // TODO: Replace during build with actual timestamp
  return new Date().toISOString();
}

/**
 * Gets environment name
 *
 * @private
 * @returns {string} Environment
 */
function getEnvironment() {
  // TODO: Read from environment variable or build config
  return 'development';
}

/**
 * Gets social media icon
 *
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
 *
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
