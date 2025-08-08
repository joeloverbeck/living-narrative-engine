/**
 * @file Unit tests for Page Template Container
 * @see src/characterBuilder/templates/core/pageTemplate.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createCharacterBuilderPage,
  __testUtils,
} from '../../../../../src/characterBuilder/templates/core/pageTemplate.js';

describe('Page Template Container', () => {
  describe('createCharacterBuilderPage', () => {
    it('should create a basic page with title', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
      });

      expect(html).toContain('cb-page-container');
      expect(html).toContain('Test Page');
      expect(html).toContain('cb-page-header');
      expect(html).toContain('cb-page-main');
      expect(html).toContain('cb-page-footer');
    });

    it('should support single panel layout', () => {
      const html = createCharacterBuilderPage({
        title: 'Single Panel Page',
        singlePanel: true,
        leftPanel: {
          content: 'Panel content',
        },
      });

      expect(html).toContain('cb-single-panel');
      expect(html).toContain('cb-main-single');
      expect(html).toContain('Panel content');
    });

    it('should support dual panel layout', () => {
      const html = createCharacterBuilderPage({
        title: 'Dual Panel Page',
        leftPanel: { content: 'Left content' },
        rightPanel: { content: 'Right content' },
      });

      expect(html).toContain('cb-dual-panel');
      expect(html).toContain('cb-main-dual');
      expect(html).toContain('Left content');
      expect(html).toContain('Right content');
    });

    it('should include subtitle when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        subtitle: 'Test Description',
      });

      expect(html).toContain('Test Description');
      expect(html).toContain('cb-page-subtitle');
    });

    it('should include header actions', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          { label: 'Save', name: 'save' },
          { label: 'Cancel', name: 'cancel' },
        ],
      });

      expect(html).toContain('cb-header-actions');
      expect(html).toContain('Save');
      expect(html).toContain('Cancel');
      expect(html).toContain('data-action="save"');
    });

    it('should include modals when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        modals: [
          {
            id: 'test-modal',
            title: 'Test Modal',
            content: 'Modal content',
          },
        ],
      });

      expect(html).toContain('cb-modals-container');
      expect(html).toContain('test-modal');
      expect(html).toContain('Test Modal');
      expect(html).toContain('Modal content');
    });

    it('should escape HTML in user content', () => {
      const html = createCharacterBuilderPage({
        title: '<script>alert("XSS")</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should throw error for missing title', () => {
      expect(() => {
        createCharacterBuilderPage({});
      }).toThrow('Page title is required');
    });

    it('should support custom CSS classes', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        customClasses: 'custom-theme dark-mode',
      });

      expect(html).toContain('custom-theme dark-mode');
    });

    it('should support function content for panels', () => {
      const contentFn = () => '<div>Dynamic content</div>';
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        leftPanel: { content: contentFn },
      });

      expect(html).toContain('Dynamic content');
    });

    it('should add data-page-title attribute', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
      });

      expect(html).toContain('data-page-title="Test Page"');
    });

    it('should include panel headings when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        leftPanel: {
          id: 'test-panel',
          heading: 'Panel Heading',
          content: 'Content',
        },
      });

      expect(html).toContain('Panel Heading');
      expect(html).toContain('cb-panel-heading');
      expect(html).toContain('aria-labelledby="test-panel-heading"');
    });

    it('should include panel actions when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        leftPanel: {
          content: 'Content',
          actions: [
            { label: 'Edit', name: 'edit' },
            { label: 'Delete', name: 'delete' },
          ],
        },
      });

      expect(html).toContain('cb-panel-actions');
      expect(html).toContain('Edit');
      expect(html).toContain('Delete');
    });

    it('should support modal actions', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        modals: [
          {
            id: 'confirm-modal',
            title: 'Confirm',
            content: 'Are you sure?',
            actions: [
              { label: 'Yes', name: 'confirm' },
              { label: 'No', name: 'cancel' },
            ],
          },
        ],
      });

      expect(html).toContain('cb-modal-footer');
      expect(html).toContain('Yes');
      expect(html).toContain('No');
    });

    it('should include footer status when provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        footer: {
          status: 'Ready',
          showVersion: true,
        },
      });

      expect(html).toContain('cb-footer-status');
      expect(html).toContain('Ready');
    });

    it('should use default footer when not provided', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
      });

      expect(html).toContain('Help');
      expect(html).toContain('About');
      expect(html).toContain('v1.0.0');
    });

    it('should support action tooltips', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          {
            label: 'Save',
            name: 'save',
            tooltip: 'Save changes',
          },
        ],
      });

      expect(html).toContain('title="Save changes"');
    });

    it('should support disabled actions', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          {
            label: 'Save',
            name: 'save',
            disabled: true,
          },
        ],
      });

      expect(html).toContain('disabled');
    });

    it('should support action icons', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          {
            label: 'Save',
            name: 'save',
            icon: '💾',
          },
        ],
      });

      expect(html).toContain('cb-action-icon');
      expect(html).toContain('💾');
    });

    it('should support data attributes on actions', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [
          {
            label: 'Save',
            name: 'save',
            data: {
              target: 'form',
              confirm: 'true',
            },
          },
        ],
      });

      expect(html).toContain('data-target="form"');
      expect(html).toContain('data-confirm="true"');
    });

    it('should add custom classes to panels', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        leftPanel: {
          content: 'Content',
          className: 'custom-panel highlighted',
        },
      });

      expect(html).toContain('custom-panel highlighted');
    });

    it('should support function content for modals', () => {
      const modalContent = () => '<form>Dynamic form</form>';
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        modals: [
          {
            id: 'dynamic-modal',
            title: 'Dynamic',
            content: modalContent,
          },
        ],
      });

      expect(html).toContain('Dynamic form');
    });

    it('should include proper ARIA attributes', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        headerActions: [{ label: 'Save', name: 'save' }],
        leftPanel: { content: 'Content' },
        modals: [
          {
            id: 'modal1',
            title: 'Modal',
            content: 'Content',
          },
        ],
      });

      expect(html).toContain('role="banner"');
      expect(html).toContain('role="main"');
      expect(html).toContain('role="contentinfo"');
      expect(html).toContain('role="region"');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Page actions"');
    });

    it('should warn when no panels provided for dual layout', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createCharacterBuilderPage({
        title: 'Test',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Page template created without panel content'
      );

      consoleSpy.mockRestore();
    });

    it('should include footer links with proper targets', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        footer: {
          links: [
            {
              label: 'External',
              href: 'https://example.com',
              target: '_blank',
            },
            { label: 'Internal', href: '/page' },
          ],
        },
      });

      expect(html).toContain('target="_blank"');
      expect(html).toContain('target="_self"');
    });
  });

  describe('Validation', () => {
    const { validatePageConfig } = __testUtils;

    it('should validate required configuration', () => {
      expect(() => validatePageConfig(null)).toThrow(
        'Page configuration is required'
      );
      expect(() => validatePageConfig({})).toThrow('Page title is required');
      expect(() => validatePageConfig({ title: 123 })).toThrow(
        'Page title must be a string'
      );
    });

    it('should warn about conflicting configurations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createCharacterBuilderPage({
        title: 'Test',
        singlePanel: true,
        rightPanel: { content: 'ignored' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Right panel will be ignored in single panel mode'
      );

      consoleSpy.mockRestore();
    });

    it('should warn when no panels provided for dual-panel layout', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createCharacterBuilderPage({
        title: 'Test',
        singlePanel: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'No panels provided for dual-panel layout'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('HTML Escaping', () => {
    const { escapeHtml } = __testUtils;

    it('should escape HTML special characters', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
      expect(escapeHtml("'apostrophe'")).toBe('&#39;apostrophe&#39;');
      expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('should handle non-string values', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(null)).toBe('null');
      expect(escapeHtml(undefined)).toBe('undefined');
    });

    it('should escape all occurrences of special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('Default Footer Configuration', () => {
    const { getDefaultFooterConfig } = __testUtils;

    it('should provide default footer configuration', () => {
      const config = getDefaultFooterConfig();

      expect(config.showVersion).toBe(true);
      expect(config.links).toHaveLength(2);
      expect(config.links[0].label).toBe('Help');
      expect(config.links[0].href).toBe('#help');
      expect(config.links[1].label).toBe('About');
      expect(config.links[1].href).toBe('#about');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty subtitle gracefully', () => {
      const html = createCharacterBuilderPage({
        title: 'Test Page',
        subtitle: '',
      });

      expect(html).toBeDefined();
      expect(html).toContain('cb-page-container');
      expect(html).not.toContain('cb-page-subtitle');
    });

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(1000);
      const html = createCharacterBuilderPage({
        title: longTitle,
      });

      expect(html).toContain(longTitle);
    });

    it('should handle panels with only right panel in single panel mode', () => {
      const html = createCharacterBuilderPage({
        title: 'Test',
        singlePanel: true,
        rightPanel: { content: 'Right content only' },
      });

      expect(html).toContain('Right content only');
    });

    it('should handle multiple modals', () => {
      const html = createCharacterBuilderPage({
        title: 'Test',
        modals: [
          { id: 'modal1', title: 'Modal 1', content: 'Content 1' },
          { id: 'modal2', title: 'Modal 2', content: 'Content 2' },
          { id: 'modal3', title: 'Modal 3', content: 'Content 3' },
        ],
      });

      expect(html).toContain('modal1');
      expect(html).toContain('modal2');
      expect(html).toContain('modal3');
    });

    it('should handle footer with no links', () => {
      const html = createCharacterBuilderPage({
        title: 'Test',
        footer: {
          showVersion: true,
        },
      });

      expect(html).toContain('v1.0.0');
      expect(html).not.toContain('cb-footer-links');
    });

    it('should handle footer with custom content', () => {
      const html = createCharacterBuilderPage({
        title: 'Test',
        footer: {
          customContent: '<div>Custom footer</div>',
        },
      });

      expect(html).toContain('cb-footer-content');
    });
  });
});
