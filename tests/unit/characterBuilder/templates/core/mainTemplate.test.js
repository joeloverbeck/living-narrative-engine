/**
 * @file Unit tests for Main Content Template Component
 * @see src/characterBuilder/templates/core/mainTemplate.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  createMain,
  createTabPanel,
  __testUtils,
} from '../../../../../src/characterBuilder/templates/core/mainTemplate.js';

describe('Main Content Template', () => {
  describe('createMain', () => {
    it('should create single layout by default with center panel', () => {
      const html = createMain({
        centerPanel: { content: 'Center content' },
      });

      expect(html).toContain('cb-layout-single');
      expect(html).toContain('Center content');
      expect(html).toContain('cb-single-layout');
      expect(html).toContain('role="main"');
    });

    it('should create dual layout with left and right panels', () => {
      const html = createMain({
        leftPanel: { content: 'Left' },
        rightPanel: { content: 'Right' },
      });

      expect(html).toContain('cb-layout-dual');
      expect(html).toContain('Left');
      expect(html).toContain('Right');
      expect(html).toContain('cb-panel-left');
      expect(html).toContain('cb-panel-right');
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
      expect(html).toContain('cb-panel-0');
      expect(html).toContain('cb-panel-1');
      expect(html).toContain('cb-panel-2');
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
      expect(html).toContain('role="complementary"');
      expect(html).toContain('Main content');
    });

    it('should support fluid layout', () => {
      const html = createMain({
        centerPanel: { content: 'Content' },
        fluid: true,
      });

      expect(html).toContain('cb-main-fluid');
      expect(html).not.toContain('cb-main-container');
    });

    it('should add custom classes', () => {
      const html = createMain({
        centerPanel: { content: 'Content' },
        className: 'custom-class',
      });

      expect(html).toContain('custom-class');
    });

    it('should handle empty configurations', () => {
      const html = createMain({});

      expect(html).toContain('cb-layout-single');
      expect(html).toContain('cb-single-layout');
    });
  });

  describe('Panel Features', () => {
    it('should support collapsible panels', () => {
      const html = createMain({
        leftPanel: {
          id: 'test-panel',
          heading: 'Collapsible',
          content: 'Content',
          collapsible: true,
        },
      });

      expect(html).toContain('cb-panel-collapsible');
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('aria-controls="test-panel-content"');
      expect(html).toContain('cb-panel-toggle');
    });

    it('should support collapsed state', () => {
      const html = createMain({
        leftPanel: {
          heading: 'Collapsed Panel',
          content: 'Content',
          collapsible: true,
          collapsed: true,
        },
      });

      expect(html).toContain('cb-panel-collapsed');
      expect(html).toContain('aria-expanded="false"');
    });

    it('should show panel state indicators', () => {
      const html = createMain({
        leftPanel: {
          heading: 'Panel',
          content: 'Content',
          state: {
            loading: true,
            count: 5,
            error: 'Error message',
            success: 'Success message',
          },
        },
      });

      expect(html).toContain('cb-state-loading');
      expect(html).toContain('cb-state-count');
      expect(html).toContain('cb-state-error');
      expect(html).toContain('cb-state-success');
      expect(html).toContain('5');
      expect(html).toContain('Error message');
      expect(html).toContain('Success message');
    });

    it('should render panel actions', () => {
      const html = createMain({
        leftPanel: {
          content: 'Content',
          actions: [
            {
              label: 'Save',
              name: 'save',
              icon: '💾',
              tooltip: 'Save changes',
              data: { id: '123' },
            },
            {
              label: 'Cancel',
              name: 'cancel',
              disabled: true,
            },
          ],
        },
      });

      expect(html).toContain('cb-panel-actions');
      expect(html).toContain('data-action="save"');
      expect(html).toContain('data-action="cancel"');
      expect(html).toContain('💾');
      expect(html).toContain('title="Save changes"');
      expect(html).toContain('data-id="123"');
      expect(html).toContain('disabled');
    });

    it('should show empty state message', () => {
      const html = createMain({
        leftPanel: {
          showWhenEmpty: true,
          emptyMessage: 'Custom empty message',
        },
      });

      expect(html).toContain('cb-panel-empty');
      expect(html).toContain('Custom empty message');
    });

    it('should not render panel without content when showWhenEmpty is false', () => {
      const html = createMain({
        leftPanel: {
          heading: 'Empty Panel',
        },
      });

      expect(html).not.toContain('Empty Panel');
    });

    it('should render panel with function content', () => {
      const html = createMain({
        leftPanel: {
          content: () => '<div>Function content</div>',
        },
      });

      expect(html).toContain('Function content');
    });

    it('should render panel with array content', () => {
      const html = createMain({
        leftPanel: {
          content: [
            '<div>Item 1</div>',
            () => '<div>Item 2</div>',
            '<div>Item 3</div>',
          ],
        },
      });

      expect(html).toContain('Item 1');
      expect(html).toContain('Item 2');
      expect(html).toContain('Item 3');
    });

    it('should include proper ARIA attributes', () => {
      const html = createMain({
        leftPanel: {
          id: 'test-panel',
          heading: 'Accessible Panel',
          content: 'Content',
        },
      });

      expect(html).toContain('role="region"');
      expect(html).toContain('aria-labelledby="test-panel-heading"');
      expect(html).toContain('id="test-panel-heading"');
    });
  });

  describe('Sidebar Features', () => {
    it('should render sidebar with items', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          title: 'Menu',
          items: [
            { label: 'Home', href: '/', icon: '🏠' },
            { label: 'Settings', href: '/settings', badge: '3' },
          ],
        },
      });

      expect(html).toContain('cb-sidebar-title');
      expect(html).toContain('Menu');
      expect(html).toContain('🏠');
      expect(html).toContain('cb-sidebar-badge');
      expect(html).toContain('3');
    });

    it('should mark active sidebar item', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          items: [
            { label: 'Active', href: '#', active: true },
            { label: 'Inactive', href: '#' },
          ],
        },
      });

      expect(html).toContain('cb-sidebar-active');
      expect(html).toContain('aria-current="page"');
    });

    it('should support sticky sidebar', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          sticky: true,
        },
      });

      expect(html).toContain('cb-sidebar-sticky');
    });

    it('should support collapsible sidebar', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          collapsible: true,
        },
      });

      expect(html).toContain('cb-sidebar-collapsible');
    });

    it('should support right-positioned sidebar', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          position: 'right',
        },
      });

      expect(html).toContain('cb-sidebar-right');
    });
  });

  describe('Grid Layout Features', () => {
    it('should support custom column count', () => {
      const html = createMain({
        panels: [{ content: 'Panel 1' }, { content: 'Panel 2' }],
        columns: 3,
      });

      expect(html).toContain('style="--cb-grid-columns: 3"');
    });

    it('should use auto columns by default', () => {
      const html = createMain({
        panels: [{ content: 'Panel 1' }, { content: 'Panel 2' }],
      });

      expect(html).not.toContain('style="--cb-grid-columns:');
    });
  });

  describe('createTabPanel', () => {
    it('should create tab panel layout', () => {
      const html = createTabPanel({
        tabs: [
          { label: 'Tab 1', content: 'Content 1' },
          { label: 'Tab 2', content: 'Content 2', icon: '📄' },
        ],
        activeTab: 0,
      });

      expect(html).toContain('cb-tabs');
      expect(html).toContain('role="tablist"');
      expect(html).toContain('Tab 1');
      expect(html).toContain('Tab 2');
      expect(html).toContain('cb-tab-active');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('📄');
    });

    it('should show correct active tab panel', () => {
      const html = createTabPanel({
        tabs: [
          { label: 'Tab 1', content: 'Content 1' },
          { label: 'Tab 2', content: 'Content 2' },
        ],
        activeTab: 1,
      });

      expect(html).toContain('cb-tab-panel-active');
      // Check that the second tab panel (index 1) has the active class
      expect(html).toMatch(
        /id="tab-panel-1"[^>]*class="[^"]*cb-tab-panel-active/
      );
    });

    it('should hide inactive tab panels', () => {
      const html = createTabPanel({
        tabs: [
          { label: 'Tab 1', content: 'Content 1' },
          { label: 'Tab 2', content: 'Content 2' },
        ],
        activeTab: 0,
      });

      // Tab panel 1 should be hidden
      expect(html).toMatch(/tab-panel-1[^>]*hidden/);
    });

    it('should support function content in tabs', () => {
      const html = createTabPanel({
        tabs: [{ label: 'Tab', content: () => '<div>Dynamic content</div>' }],
      });

      expect(html).toContain('Dynamic content');
    });
  });

  describe('Layout Detection', () => {
    it('should detect single layout from centerPanel', () => {
      const layout = __testUtils.determineLayout({
        centerPanel: { content: 'Test' },
      });
      expect(layout).toBe('single');
    });

    it('should detect dual layout from left and right panels', () => {
      const layout = __testUtils.determineLayout({
        leftPanel: { content: 'Left' },
        rightPanel: { content: 'Right' },
      });
      expect(layout).toBe('dual');
    });

    it('should detect grid layout from panels array', () => {
      const layout = __testUtils.determineLayout({
        panels: [{ content: 'Panel' }],
      });
      expect(layout).toBe('grid');
    });

    it('should detect sidebar layout from sidebar config', () => {
      const layout = __testUtils.determineLayout({
        sidebar: { items: [] },
      });
      expect(layout).toBe('sidebar');
    });

    it('should respect explicit layout setting', () => {
      const layout = __testUtils.determineLayout({
        layout: 'grid',
        leftPanel: { content: 'Left' },
      });
      expect(layout).toBe('grid');
    });
  });

  describe('Content Rendering', () => {
    it('should render string content', () => {
      const result = __testUtils.renderContent('String content');
      expect(result).toBe('String content');
    });

    it('should render function content', () => {
      const result = __testUtils.renderContent(() => 'Function content');
      expect(result).toBe('Function content');
    });

    it('should render array content', () => {
      const result = __testUtils.renderContent([
        'String',
        () => 'Function',
        'Another string',
      ]);
      expect(result).toBe('StringFunctionAnother string');
    });

    it('should convert non-string content to string', () => {
      const result = __testUtils.renderContent(123);
      expect(result).toBe('123');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML in panel headings', () => {
      const html = createMain({
        leftPanel: {
          heading: '<script>alert("XSS")</script>',
          content: 'Safe',
        },
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in action labels', () => {
      const html = createMain({
        leftPanel: {
          content: 'Content',
          actions: [
            {
              label: '<script>alert("XSS")</script>',
              name: 'test',
            },
          ],
        },
      });

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in sidebar items', () => {
      const html = createMain({
        layout: 'sidebar',
        sidebar: {
          title: '<script>alert("XSS")</script>',
          items: [
            {
              label: '<img src=x onerror=alert("XSS")>',
              href: 'javascript:alert("XSS")',
            },
          ],
        },
      });

      expect(html).not.toContain('<script>alert');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('javascript:alert');
    });

    it('should escape HTML in empty message', () => {
      const html = createMain({
        leftPanel: {
          showWhenEmpty: true,
          emptyMessage: '<script>alert("XSS")</script>',
        },
      });

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
