/**
 * @file Unit tests for EnhancedTemplateComposer
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedTemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/EnhancedTemplateComposer.js';
import { TemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/templateComposer.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.URL = dom.window.URL;

describe('EnhancedTemplateComposer', () => {
  let composer;

  beforeEach(() => {
    composer = new EnhancedTemplateComposer();
  });

  describe('constructor', () => {
    it('should create composer with default configuration', () => {
      expect(composer).toBeInstanceOf(EnhancedTemplateComposer);
    });

    it('should create composer with custom template composer', () => {
      const customTemplateComposer = new TemplateComposer();
      const customComposer = new EnhancedTemplateComposer({
        templateComposer: customTemplateComposer,
      });

      expect(customComposer).toBeInstanceOf(EnhancedTemplateComposer);
    });

    it('should create composer with data binding disabled', () => {
      const composerWithoutBinding = new EnhancedTemplateComposer({
        enableDataBinding: false,
      });

      expect(composerWithoutBinding.isDataBindingEnabled()).toBe(false);
    });
  });

  describe('render()', () => {
    it('should render simple template with basic composition', () => {
      const template = '<div>Hello ${name}!</div>';
      const context = { name: 'World' };

      const result = composer.render(template, context);

      expect(result.html).toContain('Hello World!');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should render template with data binding', () => {
      const template = '<div>Hello {{ name }}!</div>';
      const context = { name: 'John' };

      const result = composer.render(template, context);

      expect(result.html).toContain('Hello John!');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should handle mixed interpolation styles', () => {
      const template = '<div>Legacy: ${legacy}, New: {{ modern }}</div>';
      const context = { legacy: 'Old', modern: 'New' };

      const result = composer.render(template, context);

      expect(result.html).toContain('Legacy: Old');
      expect(result.html).toContain('New: New');
    });

    it('should render without data binding when disabled', () => {
      const template = '<div>{{ name }}</div>';
      const context = { name: 'Test' };

      const result = composer.render(template, context, {
        disableDataBinding: true,
      });

      // Should not process {{ }} interpolation
      expect(result.html).toContain('{{ name }}');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should handle template with slots', () => {
      const template = '<div><slot name="content">Default content</slot></div>';
      const context = {
        slots: {
          content: '<p>Custom content</p>',
        },
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('<p>Custom content</p>');
      expect(result.html).not.toContain('Default content');
    });

    it('should handle conditionals', () => {
      const template = '<div tb-if="showMessage">{{ message }}</div>';
      const context = { showMessage: true, message: 'Visible' };

      const result = composer.render(template, context);

      expect(result.html).toContain('Visible');
      expect(result.html).not.toContain('display: none');
    });

    it('should handle list rendering', () => {
      const template = '<ul><li tb-for="item in items">{{ item }}</li></ul>';
      const context = { items: ['apple', 'banana', 'cherry'] };

      const result = composer.render(template, context);

      expect(result.html).toContain('apple');
      expect(result.html).toContain('banana');
      expect(result.html).toContain('cherry');
    });

    it('should track cleanup functions with template ID', () => {
      const template = '<button tb-on:click="handleClick">Click</button>';
      const context = { handleClick: jest.fn() };
      const templateId = 'test-template';

      const result = composer.render(template, context, { templateId });

      expect(typeof result.cleanup).toBe('function');

      // Should be able to cleanup by ID
      const cleaned = composer.cleanup(templateId);
      expect(cleaned).toBe(true);
    });

    it('should handle null templates gracefully', () => {
      const nullTemplate = null;
      const context = {};

      const result = composer.render(nullTemplate, context);

      expect(result.html).toBe('');
      expect(typeof result.cleanup).toBe('function');
    });
  });

  describe('template management', () => {
    it('should register and use templates', () => {
      composer.registerTemplate('greeting', '<h1>Hello ${name}!</h1>');

      const template = '<template ref="greeting" />';
      const context = { name: 'World' };

      const result = composer.render(template, context);

      expect(result.html).toContain('<h1>Hello World!</h1>');
    });

    it('should check template existence', () => {
      composer.registerTemplate('test', '<div>Test</div>');

      expect(composer.hasTemplate('test')).toBe(true);
      expect(composer.hasTemplate('nonexistent')).toBe(false);
    });

    it('should unregister templates', () => {
      composer.registerTemplate('temp', '<div>Temporary</div>');
      expect(composer.hasTemplate('temp')).toBe(true);

      composer.unregisterTemplate('temp');
      expect(composer.hasTemplate('temp')).toBe(false);
    });
  });

  describe('slot processing', () => {
    it('should process slots directly', () => {
      const html = '<div><slot name="header">Default</slot></div>';
      const slots = { header: '<h1>Custom Header</h1>' };

      const result = composer.processSlots(html, slots);

      expect(result).toContain('<h1>Custom Header</h1>');
      expect(result).not.toContain('Default');
    });

    it('should process nested template resolution', () => {
      composer.registerTemplate('header', '<header>Site Header</header>');

      const html = '<div><template ref="header" /></div>';
      const context = {};

      const result = composer.resolveNested(html, context);

      expect(result).toContain('<header>Site Header</header>');
    });
  });

  describe('caching', () => {
    it('should clear composer cache', () => {
      expect(() => composer.clearComposerCache()).not.toThrow();
    });

    it('should clear binding cache', () => {
      expect(() => composer.clearBindingCache()).not.toThrow();
    });

    it('should clear all caches', () => {
      expect(() => composer.clearAllCaches()).not.toThrow();
    });
  });

  describe('cleanup management', () => {
    it('should cleanup specific template', () => {
      const template = '<div tb-on:click="handler">Click</div>';
      const context = { handler: jest.fn() };
      const templateId = 'clickable';

      composer.render(template, context, { templateId });

      const cleaned = composer.cleanup(templateId);
      expect(cleaned).toBe(true);

      // Second cleanup should return false
      const cleanedAgain = composer.cleanup(templateId);
      expect(cleanedAgain).toBe(false);
    });

    it('should cleanup all templates', () => {
      const template1 = '<div tb-on:click="handler1">Click 1</div>';
      const template2 = '<div tb-on:click="handler2">Click 2</div>';
      const context = { handler1: jest.fn(), handler2: jest.fn() };

      composer.render(template1, context, { templateId: 'template1' });
      composer.render(template2, context, { templateId: 'template2' });

      expect(() => composer.cleanupAll()).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should enable/disable data binding', () => {
      expect(composer.isDataBindingEnabled()).toBe(true);

      composer.setDataBindingEnabled(false);
      expect(composer.isDataBindingEnabled()).toBe(false);

      composer.setDataBindingEnabled(true);
      expect(composer.isDataBindingEnabled()).toBe(true);
    });

    it('should initialize data binding when enabled', () => {
      const disabledComposer = new EnhancedTemplateComposer({
        enableDataBinding: false,
      });

      expect(disabledComposer.isDataBindingEnabled()).toBe(false);

      disabledComposer.setDataBindingEnabled(true);
      expect(disabledComposer.isDataBindingEnabled()).toBe(true);
    });
  });

  describe('context management', () => {
    it('should create scoped context', () => {
      const parentContext = { name: 'Parent', value: 1 };
      const localContext = { value: 2, extra: 'Local' };

      const result = composer.createScopedContext(parentContext, localContext);

      expect(result).toEqual({
        name: 'Parent',
        value: 2, // Local overrides parent
        extra: 'Local',
      });
    });

    it('should create scoped context without data binding', () => {
      const disabledComposer = new EnhancedTemplateComposer({
        enableDataBinding: false,
      });

      const parentContext = { a: 1 };
      const localContext = { b: 2 };

      const result = disabledComposer.createScopedContext(
        parentContext,
        localContext
      );

      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('statistics and debugging', () => {
    it('should provide rendering statistics', () => {
      const stats = composer.getStats();

      expect(stats).toHaveProperty('activeCleanups');
      expect(stats).toHaveProperty('dataBindingEnabled');
      expect(stats.dataBindingEnabled).toBe(true);
    });

    it('should provide stats with data binding disabled', () => {
      const disabledComposer = new EnhancedTemplateComposer({
        enableDataBinding: false,
      });

      const stats = disabledComposer.getStats();

      expect(stats.dataBindingEnabled).toBe(false);
    });
  });

  describe('complex templates', () => {
    it('should handle complex nested template with all features', () => {
      const template = `
        <div tb-if="user">
          <h1>Welcome {{ user.name }}!</h1>
          <ul tb-if="user.items.length > 0">
            <li tb-for="item in user.items" tb-on:click="selectItem">
              {{ item.name }} - \${{ item.price }}
            </li>
          </ul>
          <p tb-else>No items available</p>
          <button tb-on:click="logout">Logout</button>
        </div>
      `;

      const context = {
        user: {
          name: 'John',
          items: [
            { name: 'Apple', price: 1.5 },
            { name: 'Banana', price: 0.75 },
          ],
        },
        selectItem: jest.fn(),
        logout: jest.fn(),
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('Welcome John!');
      expect(result.html).toContain('Apple - $1.5');
      expect(result.html).toContain('Banana - $0.75');
      expect(result.html).toContain('Logout');

      // tb-else elements are removed when the corresponding tb-if condition is true
      // Since user.items.length > 0 evaluates to true, the tb-else block is not rendered
      expect(result.html).not.toContain('No items available');
    });

    it('should handle template with slot composition and data binding', () => {
      composer.registerTemplate(
        'layout',
        `
        <div class="layout">
          <header><slot name="header">Default Header</slot></header>
          <main>{{ content }}</main>
          <footer tb-if="showFooter"><slot name="footer">Footer</slot></footer>
        </div>
      `
      );

      const template = '<template ref="layout" />';
      const context = {
        content: 'Main content',
        showFooter: true,
        slots: {
          header: '<h1>Custom Header</h1>',
          footer: '<p>Custom Footer</p>',
        },
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('<h1>Custom Header</h1>');
      expect(result.html).toContain('Main content');
      expect(result.html).toContain('<p>Custom Footer</p>');
    });
  });
});
