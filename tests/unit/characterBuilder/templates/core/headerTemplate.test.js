/**
 * @file Unit tests for Header Template Component
 * @see src/characterBuilder/templates/core/headerTemplate.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  createHeader,
  createBreadcrumb,
  createHeaderSearch,
  __testUtils,
} from '../../../../../src/characterBuilder/templates/core/headerTemplate.js';

describe('Header Template Component', () => {
  describe('createHeader', () => {
    it('should create basic header with title', () => {
      const html = createHeader({
        title: 'Test Page',
      });

      expect(html).toContain('cb-page-header');
      expect(html).toContain('Test Page');
      expect(html).toContain('role="banner"');
      expect(html).toContain('cb-header-main');
      expect(html).toContain('cb-mobile-menu-toggle');
    });

    it('should include subtitle when provided', () => {
      const html = createHeader({
        title: 'Test Page',
        subtitle: 'Page description',
      });

      expect(html).toContain('Page description');
      expect(html).toContain('cb-page-subtitle');
    });

    it('should render navigation items', () => {
      const html = createHeader({
        title: 'Test',
        navigation: [
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about', active: true },
        ],
      });

      expect(html).toContain('cb-header-nav');
      expect(html).toContain('role="navigation"');
      expect(html).toContain('aria-label="Main navigation"');
      expect(html).toContain('Home');
      expect(html).toContain('About');
      expect(html).toContain('cb-nav-active');
      expect(html).toContain('aria-current="page"');
    });

    it('should render navigation with icons', () => {
      const html = createHeader({
        title: 'Test',
        navigation: [
          { label: 'Home', href: '/', icon: '🏠' },
          { label: 'Settings', href: '/settings', icon: '⚙️' },
        ],
      });

      expect(html).toContain('🏠');
      expect(html).toContain('⚙️');
      expect(html).toContain('cb-nav-icon');
    });

    it('should render nested navigation', () => {
      const html = createHeader({
        title: 'Test',
        navigation: [
          {
            label: 'Products',
            href: '#',
            children: [
              { label: 'Product A', href: '/products/a' },
              { label: 'Product B', href: '/products/b' },
            ],
          },
        ],
      });

      expect(html).toContain('cb-nav-parent');
      expect(html).toContain('cb-nav-submenu');
      expect(html).toContain('Product A');
      expect(html).toContain('Product B');
      expect(html).toContain('aria-haspopup="true"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('cb-nav-arrow');
    });

    it('should render header actions', () => {
      const html = createHeader({
        title: 'Test',
        actions: [
          { label: 'Save', name: 'save', icon: '💾' },
          { label: 'Settings', name: 'settings', disabled: true },
        ],
      });

      expect(html).toContain('cb-header-actions');
      expect(html).toContain('role="toolbar"');
      expect(html).toContain('aria-label="Page actions"');
      expect(html).toContain('Save');
      expect(html).toContain('Settings');
      expect(html).toContain('disabled');
      expect(html).toContain('💾');
      expect(html).toContain('data-action="save"');
      expect(html).toContain('data-action="settings"');
    });

    it('should render actions with data attributes', () => {
      const html = createHeader({
        title: 'Test',
        actions: [
          {
            label: 'Delete',
            name: 'delete',
            data: { id: '123', confirm: 'true' },
          },
        ],
      });

      expect(html).toContain('data-id="123"');
      expect(html).toContain('data-confirm="true"');
    });

    it('should render actions with tooltips', () => {
      const html = createHeader({
        title: 'Test',
        actions: [
          {
            label: 'Save',
            name: 'save',
            tooltip: 'Save your changes',
          },
        ],
      });

      expect(html).toContain('title="Save your changes"');
      expect(html).toContain('aria-label="Save your changes"');
    });

    it('should add sticky class when configured', () => {
      const html = createHeader({
        title: 'Test',
        sticky: true,
      });

      expect(html).toContain('cb-header-sticky');
    });

    it('should add custom className when provided', () => {
      const html = createHeader({
        title: 'Test',
        className: 'custom-header-class',
      });

      expect(html).toContain('custom-header-class');
    });

    it('should render branding section with logo', () => {
      const html = createHeader({
        title: 'Test',
        branding: {
          logo: '/logo.png',
          appName: 'My App',
        },
      });

      expect(html).toContain('cb-header-branding');
      expect(html).toContain('cb-header-logo');
      expect(html).toContain('<img src="/logo.png"');
      expect(html).toContain('alt="My App"');
      expect(html).toContain('cb-header-app-name');
      expect(html).toContain('My App');
    });

    it('should render branding with HTML logo', () => {
      const html = createHeader({
        title: 'Test',
        branding: {
          logo: '<svg>custom logo</svg>',
          appName: 'My App',
        },
      });

      expect(html).toContain('<svg>custom logo</svg>');
      expect(html).not.toContain('<img');
    });

    it('should render branding with data URI logo', () => {
      const html = createHeader({
        title: 'Test',
        branding: {
          logo: 'data:image/svg+xml;base64,PHN2Zz4=',
        },
      });

      expect(html).toContain('<img src="data:image/svg+xml;base64,PHN2Zz4="');
    });

    it('should escape HTML in content', () => {
      const html = createHeader({
        title: '<script>alert("XSS")</script>',
        subtitle: '<img src=x onerror=alert(1)>',
        navigation: [{ label: '<b>Bold</b>', href: 'javascript:alert(1)' }],
        actions: [{ label: '<i>Italic</i>', name: '<script>' }],
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<b>Bold</b>');
      expect(html).not.toContain('<i>Italic</i>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');
      expect(html).toContain('&lt;b&gt;');
      expect(html).toContain('&lt;i&gt;');
    });

    it('should include mobile menu toggle', () => {
      const html = createHeader({
        title: 'Test',
      });

      expect(html).toContain('cb-mobile-menu-toggle');
      expect(html).toContain('aria-label="Toggle navigation menu"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="cb-mobile-menu"');
      expect(html).toContain('cb-menu-icon');
      expect(html).toContain('cb-menu-line');
    });
  });

  describe('createBreadcrumb', () => {
    it('should create breadcrumb navigation', () => {
      const html = createBreadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Item' },
      ]);

      expect(html).toContain('cb-breadcrumb');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('cb-breadcrumb-list');
      expect(html).toContain('Home');
      expect(html).toContain('Products');
      expect(html).toContain('Item');
    });

    it('should mark last item as current page', () => {
      const html = createBreadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Current Page' },
      ]);

      expect(html).toContain('aria-current="page"');
      expect(html).toContain('<span aria-current="page">Current Page</span>');
    });

    it('should include separators between items', () => {
      const html = createBreadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
      ]);

      expect(html).toContain('cb-breadcrumb-separator');
      expect(html).toContain('/');
    });

    it('should return empty string for empty array', () => {
      const html = createBreadcrumb([]);
      expect(html).toBe('');
    });

    it('should return empty string for null input', () => {
      const html = createBreadcrumb(null);
      expect(html).toBe('');
    });

    it('should escape HTML in breadcrumb items', () => {
      const html = createBreadcrumb([
        { label: '<script>alert(1)</script>', href: 'javascript:void(0)' },
      ]);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('createHeaderSearch', () => {
    it('should create search form with defaults', () => {
      const html = createHeaderSearch();

      expect(html).toContain('cb-header-search');
      expect(html).toContain('role="search"');
      expect(html).toContain('action="#search"');
      expect(html).toContain('method="GET"');
      expect(html).toContain('name="q"');
      expect(html).toContain('placeholder="Search..."');
      expect(html).toContain('type="search"');
    });

    it('should use custom configuration', () => {
      const html = createHeaderSearch({
        placeholder: 'Search products...',
        action: '/search',
        method: 'POST',
        name: 'query',
      });

      expect(html).toContain('placeholder="Search products..."');
      expect(html).toContain('action="/search"');
      expect(html).toContain('method="POST"');
      expect(html).toContain('name="query"');
    });

    it('should include proper accessibility attributes', () => {
      const html = createHeaderSearch();

      expect(html).toContain('cb-sr-only');
      expect(html).toContain('for="cb-search-input"');
      expect(html).toContain('id="cb-search-input"');
      expect(html).toContain('aria-label="Search"');
      expect(html).toContain('aria-label="Submit search"');
    });

    it('should include search icon', () => {
      const html = createHeaderSearch();

      expect(html).toContain('cb-search-icon');
      expect(html).toContain('🔍');
      expect(html).toContain('aria-hidden="true"');
    });

    it('should escape HTML in configuration', () => {
      const html = createHeaderSearch({
        placeholder: '<script>alert(1)</script>',
        action: 'javascript:alert(1)',
        name: '<script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Validation', () => {
    const { validateHeaderConfig, isImagePath } = __testUtils;

    describe('validateHeaderConfig', () => {
      it('should throw for null config', () => {
        expect(() => validateHeaderConfig(null)).toThrow(
          'Header configuration is required'
        );
      });

      it('should throw for missing title', () => {
        expect(() => validateHeaderConfig({})).toThrow(
          'must be a non-blank string'
        );
      });

      it('should throw for non-string title', () => {
        expect(() => validateHeaderConfig({ title: 123 })).toThrow(
          'must be a non-blank string'
        );
      });

      it('should throw for empty title', () => {
        expect(() => validateHeaderConfig({ title: '' })).toThrow(
          'must be a non-blank string'
        );
      });

      it('should throw for non-array navigation', () => {
        expect(() =>
          validateHeaderConfig({
            title: 'Test',
            navigation: 'not-an-array',
          })
        ).toThrow('Navigation must be an array');
      });

      it('should throw for non-array actions', () => {
        expect(() =>
          validateHeaderConfig({
            title: 'Test',
            actions: 'not-an-array',
          })
        ).toThrow('Actions must be an array');
      });

      it('should accept valid configuration', () => {
        expect(() =>
          validateHeaderConfig({
            title: 'Valid Title',
            navigation: [],
            actions: [],
          })
        ).not.toThrow();
      });
    });

    describe('isImagePath', () => {
      it('should detect image file extensions', () => {
        expect(isImagePath('/logo.png')).toBe(true);
        expect(isImagePath('image.jpg')).toBe(true);
        expect(isImagePath('photo.jpeg')).toBe(true);
        expect(isImagePath('icon.gif')).toBe(true);
        expect(isImagePath('graphic.svg')).toBe(true);
        expect(isImagePath('modern.webp')).toBe(true);
      });

      it('should detect data URIs', () => {
        expect(isImagePath('data:image/png;base64,abc')).toBe(true);
        expect(isImagePath('data:image/svg+xml;base64,def')).toBe(true);
      });

      it('should not detect non-image paths', () => {
        expect(isImagePath('/script.js')).toBe(false);
        expect(isImagePath('document.pdf')).toBe(false);
        expect(isImagePath('<svg>inline</svg>')).toBe(false);
        expect(isImagePath('plain text')).toBe(false);
      });

      it('should be case-insensitive for extensions', () => {
        expect(isImagePath('IMAGE.PNG')).toBe(true);
        expect(isImagePath('photo.JPG')).toBe(true);
        expect(isImagePath('icon.GIF')).toBe(true);
      });
    });
  });
});
