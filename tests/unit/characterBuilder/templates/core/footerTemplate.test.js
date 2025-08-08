/**
 * @file Unit tests for Footer Template Component
 * @see src/characterBuilder/templates/core/footerTemplate.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  createFooter,
  createMinimalFooter,
  createDebugFooter,
  __testUtils,
} from '../../../../../src/characterBuilder/templates/core/footerTemplate.js';

describe('Footer Template Component', () => {
  describe('createFooter', () => {
    it('should create basic footer with defaults', () => {
      const html = createFooter();

      expect(html).toContain('cb-page-footer');
      expect(html).toContain('role="contentinfo"');
      expect(html).toContain('Version');
      expect(html).toContain('Living Narrative Engine');
      expect(html).toContain('cb-footer-main');
      expect(html).toContain('cb-footer-container');
    });

    it('should display status when provided', () => {
      const html = createFooter({
        status: 'System online',
      });

      expect(html).toContain('cb-footer-status-bar');
      expect(html).toContain('System online');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
    });

    it('should render custom links', () => {
      const html = createFooter({
        links: [
          { label: 'Custom', href: '/custom' },
          { label: 'Link', href: '/link', target: '_blank' },
        ],
      });

      expect(html).toContain('Custom');
      expect(html).toContain('/custom');
      expect(html).toContain('Link');
      expect(html).toContain('/link');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('should render default links when not provided', () => {
      const html = createFooter();

      expect(html).toContain('Help');
      expect(html).toContain('Documentation');
      expect(html).toContain('Support');
      expect(html).toContain('About');
    });

    it('should render social links', () => {
      const html = createFooter({
        socialLinks: [
          { platform: 'twitter', href: 'https://twitter.com/example' },
          { platform: 'github', href: 'https://github.com/example' },
          {
            platform: 'discord',
            href: 'https://discord.com/example',
            label: 'Join our Discord',
          },
        ],
      });

      expect(html).toContain('cb-footer-social');
      expect(html).toContain('Follow us:');
      expect(html).toContain('cb-social-twitter');
      expect(html).toContain('cb-social-github');
      expect(html).toContain('cb-social-discord');
      expect(html).toContain('𝕏'); // Twitter icon
      expect(html).toContain('⚡'); // GitHub icon
      expect(html).toContain('💬'); // Discord icon
      expect(html).toContain('Join our Discord');
    });

    it('should render custom social icon when provided', () => {
      const html = createFooter({
        socialLinks: [
          {
            platform: 'custom',
            href: 'https://example.com',
            icon: '<svg>icon</svg>',
          },
        ],
      });

      expect(html).toContain('<svg>icon</svg>');
    });

    it('should support sticky footer', () => {
      const html = createFooter({
        sticky: true,
      });

      expect(html).toContain('cb-footer-sticky');
    });

    it('should support different themes', () => {
      const lightHtml = createFooter({ theme: 'light' });
      const darkHtml = createFooter({ theme: 'dark' });
      const autoHtml = createFooter({ theme: 'auto' });

      expect(lightHtml).toContain('cb-footer-theme-light');
      expect(darkHtml).toContain('cb-footer-theme-dark');
      expect(autoHtml).toContain('cb-footer-theme-auto');
    });

    it('should include custom className', () => {
      const html = createFooter({
        className: 'custom-footer-class',
      });

      expect(html).toContain('custom-footer-class');
    });

    it('should render custom content', () => {
      const html = createFooter({
        customContent: '<div class="custom">Custom HTML content</div>',
      });

      expect(html).toContain('cb-footer-custom');
      expect(html).toContain('<div class="custom">Custom HTML content</div>');
    });

    it('should show version when configured', () => {
      const html = createFooter({
        showVersion: true,
        version: '2.5.3',
      });

      expect(html).toContain('Version 2.5.3');
    });

    it('should hide version when configured', () => {
      const html = createFooter({
        showVersion: false,
      });

      expect(html).not.toContain('cb-footer-version');
    });

    it('should show copyright text', () => {
      const html = createFooter({
        copyright: '© 2024 Test Company',
      });

      expect(html).toContain('© 2024 Test Company');
      expect(html).toContain('cb-footer-copyright');
    });

    it('should show default copyright when not provided', () => {
      const html = createFooter();
      const year = new Date().getFullYear();

      expect(html).toContain(`© ${year} Living Narrative Engine`);
    });

    it('should include quick actions', () => {
      const html = createFooter();

      expect(html).toContain('cb-footer-actions');
      expect(html).toContain('cb-back-to-top');
      expect(html).toContain('cb-toggle-theme');
      expect(html).toContain('aria-label="Back to top"');
      expect(html).toContain('aria-label="Toggle theme"');
    });

    it('should include legal links in footer bottom', () => {
      const html = createFooter();

      expect(html).toContain('cb-footer-bottom');
      expect(html).toContain('cb-footer-legal');
      expect(html).toContain('Privacy Policy');
      expect(html).toContain('Terms of Service');
      expect(html).toContain('Cookie Policy');
    });

    it('should escape HTML in content', () => {
      const html = createFooter({
        status: '<script>alert("XSS")</script>',
        copyright: '<img src=x onerror=alert(1)>',
        links: [{ label: '<b>Bold</b>', href: 'javascript:alert(1)' }],
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<b>Bold</b>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should include proper ARIA attributes', () => {
      const html = createFooter();

      expect(html).toContain('role="contentinfo"');
      expect(html).toContain('aria-label="Footer navigation"');
      expect(html).toContain('aria-label="Back to top"');
      expect(html).toContain('aria-label="Toggle theme"');
      expect(html).toContain('aria-hidden="true"'); // For icon spans
    });

    it('should handle link with title attribute', () => {
      const html = createFooter({
        links: [{ label: 'Help', href: '#help', title: 'Get help' }],
      });

      expect(html).toContain('title="Get help"');
    });
  });

  describe('createMinimalFooter', () => {
    it('should create minimal footer', () => {
      const html = createMinimalFooter({
        text: 'Simple footer',
      });

      expect(html).toContain('cb-footer-minimal');
      expect(html).toContain('Simple footer');
      expect(html).toContain('role="contentinfo"');
    });

    it('should show version in minimal footer', () => {
      const html = createMinimalFooter();

      expect(html).toContain('cb-footer-minimal-version');
      expect(html).toContain('v1.0.0');
    });

    it('should support custom className', () => {
      const html = createMinimalFooter({
        className: 'custom-minimal',
      });

      expect(html).toContain('custom-minimal');
    });

    it('should escape HTML in text', () => {
      const html = createMinimalFooter({
        text: '<script>alert("XSS")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should handle empty configuration', () => {
      const html = createMinimalFooter();

      expect(html).toContain('cb-footer-minimal');
      expect(html).toContain('v1.0.0');
    });
  });

  describe('createDebugFooter', () => {
    it('should create debug footer with all info sections', () => {
      const html = createDebugFooter({
        showPerformance: true,
        showMemory: true,
        showBuildInfo: true,
      });

      expect(html).toContain('cb-footer-debug');
      expect(html).toContain('cb-debug-performance');
      expect(html).toContain('cb-debug-memory');
      expect(html).toContain('cb-debug-build');
      expect(html).toContain('role="contentinfo"');
    });

    it('should show performance info when enabled', () => {
      const html = createDebugFooter({
        showPerformance: true,
      });

      expect(html).toContain('Performance:');
      expect(html).toContain('cb-perf-load');
      expect(html).toContain('cb-perf-render');
      expect(html).toContain('Load: --ms');
      expect(html).toContain('Render: --ms');
    });

    it('should show memory info when enabled', () => {
      const html = createDebugFooter({
        showMemory: true,
      });

      expect(html).toContain('Memory:');
      expect(html).toContain('cb-mem-used');
      expect(html).toContain('cb-mem-limit');
      expect(html).toContain('Used: --MB');
      expect(html).toContain('Limit: --MB');
    });

    it('should show build info when enabled', () => {
      const html = createDebugFooter({
        showBuildInfo: true,
      });

      expect(html).toContain('Build:');
      expect(html).toContain('cb-debug-build');
      expect(html).toContain('development'); // Default environment
    });

    it('should hide sections when disabled', () => {
      const html = createDebugFooter({
        showPerformance: false,
        showMemory: false,
        showBuildInfo: false,
      });

      expect(html).not.toContain('cb-debug-performance');
      expect(html).not.toContain('cb-debug-memory');
      expect(html).not.toContain('cb-debug-build');
    });

    it('should support custom className', () => {
      const html = createDebugFooter({
        className: 'custom-debug',
      });

      expect(html).toContain('custom-debug');
    });

    it('should use default configuration', () => {
      const html = createDebugFooter();

      expect(html).toContain('cb-debug-performance');
      expect(html).toContain('cb-debug-memory');
      expect(html).toContain('cb-debug-build');
    });
  });

  describe('Utility Functions', () => {
    const { getDefaultLinks, getDefaultCopyright, escapeHtml, getSocialIcon } =
      __testUtils;

    describe('getDefaultLinks', () => {
      it('should return default footer links', () => {
        const links = getDefaultLinks();

        expect(links).toHaveLength(4);
        expect(links[0]).toEqual({ label: 'Help', href: '#help' });
        expect(links[1]).toEqual({ label: 'Documentation', href: '#docs' });
        expect(links[2]).toEqual({ label: 'Support', href: '#support' });
        expect(links[3]).toEqual({ label: 'About', href: '#about' });
      });
    });

    describe('getDefaultCopyright', () => {
      it('should return copyright with current year', () => {
        const copyright = getDefaultCopyright();
        const year = new Date().getFullYear();

        expect(copyright).toBe(
          `© ${year} Living Narrative Engine. All rights reserved.`
        );
      });
    });

    describe('escapeHtml', () => {
      it('should escape HTML special characters', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
        expect(escapeHtml("'apostrophe'")).toBe('&#39;apostrophe&#39;');
        expect(escapeHtml('&ampersand')).toBe('&amp;ampersand');
        expect(escapeHtml('<>"\'\&')).toBe('&lt;&gt;&quot;&#39;&amp;');
      });

      it('should handle null and undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
      });

      it('should convert non-strings to strings', () => {
        expect(escapeHtml(123)).toBe('123');
        expect(escapeHtml(true)).toBe('true');
      });
    });

    describe('getSocialIcon', () => {
      it('should return icons for known platforms', () => {
        expect(getSocialIcon('twitter')).toContain('𝕏');
        expect(getSocialIcon('facebook')).toContain('f');
        expect(getSocialIcon('linkedin')).toContain('in');
        expect(getSocialIcon('github')).toContain('⚡');
        expect(getSocialIcon('discord')).toContain('💬');
        expect(getSocialIcon('youtube')).toContain('▶');
      });

      it('should return default icon for unknown platforms', () => {
        expect(getSocialIcon('unknown')).toContain('🔗');
        expect(getSocialIcon(null)).toContain('🔗');
        expect(getSocialIcon('')).toContain('🔗');
      });

      it('should wrap icon in span', () => {
        const icon = getSocialIcon('twitter');
        expect(icon).toContain('<span class="cb-social-icon">');
        expect(icon).toContain('</span>');
      });
    });
  });
});
