/**
 * @file Unit tests for TemplateComposer
 * @see src/characterBuilder/templates/utilities/templateComposer.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/templateComposer.js';
import { SlotContentProvider } from '../../../../../src/characterBuilder/templates/utilities/slotContentProvider.js';

describe('TemplateComposer', () => {
  let composer;

  beforeEach(() => {
    composer = new TemplateComposer();
  });

  describe('constructor', () => {
    it('should create composer with default configuration', () => {
      expect(composer).toBeInstanceOf(TemplateComposer);
    });

    it('should accept custom configuration', () => {
      const customComposer = new TemplateComposer({
        enableCache: false,
        validateOutput: false,
        maxDepth: 5
      });
      expect(customComposer).toBeInstanceOf(TemplateComposer);
    });
  });

  describe('compose()', () => {
    it('should compose simple string templates', () => {
      const template = '<div>${content}</div>';
      const result = composer.compose(template, { content: 'Hello World' });
      expect(result).toBe('<div>Hello World</div>');
    });

    it('should compose function templates', () => {
      const template = (context) => `<h1>${context.title}</h1>`;
      const result = composer.compose(template, { title: 'Test Title' });
      expect(result).toBe('<h1>Test Title</h1>');
    });

    it('should compose object templates with render method', () => {
      const template = {
        render: (context) => `<p>${context.text}</p>`
      };
      const result = composer.compose(template, { text: 'Test paragraph' });
      expect(result).toBe('<p>Test paragraph</p>');
    });

    it('should handle nested variable paths', () => {
      const template = '<div>${user.name} - ${user.email}</div>';
      const result = composer.compose(template, {
        user: { name: 'John', email: 'john@example.com' }
      });
      expect(result).toBe('<div>John - john@example.com</div>');
    });

    it('should handle missing variables gracefully', () => {
      const template = '<div>${missing}</div>';
      const result = composer.compose(template, {});
      expect(result).toBe('<div>${missing}</div>');
    });

    it('should prevent infinite recursion', () => {
      // Create a deeply nested composition
      const deepComposer = new TemplateComposer({ maxDepth: 3 });
      
      const recursiveTemplate = {
        render: function(context) {
          if (context.level < 10) {
            return deepComposer.compose(this, { level: context.level + 1 });
          }
          return 'done';
        }
      };

      expect(() => {
        deepComposer.compose(recursiveTemplate, { level: 0 });
      }).toThrow('Maximum composition depth');
    });

    it('should handle empty templates', () => {
      expect(composer.compose('')).toBe('');
      expect(composer.compose(null)).toBe('');
      expect(composer.compose(undefined)).toBe('');
    });
  });

  describe('processSlots()', () => {
    it('should inject content into named slots', () => {
      const html = '<div><slot name="header"></slot></div>';
      const result = composer.processSlots(html, {
        header: '<h1>Header Content</h1>'
      });
      expect(result).toBe('<div><h1>Header Content</h1></div>');
    });

    it('should inject content into default slots', () => {
      const html = '<div><slot></slot></div>';
      const result = composer.processSlots(html, {
        default: '<p>Default content</p>'
      });
      expect(result).toBe('<div><p>Default content</p></div>');
    });

    it('should use fallback content for missing slots', () => {
      const html = '<div><slot name="missing">Fallback</slot></div>';
      const result = composer.processSlots(html, {});
      expect(result).toBe('<div>Fallback</div>');
    });

    it('should handle self-closing slot tags', () => {
      const html = '<div><slot name="test" /></div>';
      const result = composer.processSlots(html, {
        test: 'Test content'
      });
      expect(result).toBe('<div>Test content</div>');
    });

    it('should work with SlotContentProvider', () => {
      const provider = new SlotContentProvider();
      provider.setSlot('header', '<h1>Header</h1>');
      provider.setSlot(null, '<p>Default</p>');

      const html = '<div><slot name="header"></slot><slot></slot></div>';
      const result = composer.processSlots(html, provider);
      expect(result).toBe('<div><h1>Header</h1><p>Default</p></div>');
    });

    it('should handle multiple slots with same name', () => {
      const html = '<div><slot name="test"></slot><slot name="test"></slot></div>';
      const result = composer.processSlots(html, {
        test: 'Content'
      });
      expect(result).toBe('<div>ContentContent</div>');
    });
  });

  describe('resolveNested()', () => {
    it('should resolve template references', () => {
      composer.registerTemplate('header', '<header>Site Header</header>');
      
      const html = '<div><template ref="header" /></div>';
      const result = composer.resolveNested(html, {});
      expect(result).toBe('<div><header>Site Header</header></div>');
    });

    it('should resolve templates with custom context', () => {
      composer.registerTemplate('greeting', '<h1>Hello ${name}</h1>');
      
      const html = '<div><template ref="greeting" context=\'{"name":"World"}\' /></div>';
      const result = composer.compose(html, {});
      expect(result).toBe('<div><h1>Hello World</h1></div>');
    });

    it('should warn for missing templates', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const html = '<div><template ref="missing" /></div>';
      const result = composer.resolveNested(html, {});
      
      expect(result).toBe('<div></div>');
      expect(consoleSpy).toHaveBeenCalledWith('Template not found: missing');
      
      consoleSpy.mockRestore();
    });

    it('should merge contexts for nested templates', () => {
      composer.registerTemplate('user', '${name} (${role})');
      
      const html = '<template ref="user" context=\'{"name":"John"}\' />';
      const result = composer.compose(html, { role: 'Admin' });
      expect(result).toBe('John (Admin)');
    });
  });

  describe('template registration', () => {
    it('should register and retrieve templates', () => {
      const template = '<div>Test Template</div>';
      composer.registerTemplate('test', template);
      
      expect(composer.hasTemplate('test')).toBe(true);
      
      const result = composer.compose('<template ref="test" />', {});
      expect(result).toContain('Test Template');
    });

    it('should unregister templates', () => {
      composer.registerTemplate('test', '<div>Test</div>');
      expect(composer.hasTemplate('test')).toBe(true);
      
      composer.unregisterTemplate('test');
      expect(composer.hasTemplate('test')).toBe(false);
    });

    it('should throw error for invalid template registration', () => {
      expect(() => {
        composer.registerTemplate('', '<div></div>');
      }).toThrow('Template name is required');
    });
  });

  describe('caching', () => {
    it('should cache composition results', () => {
      const cachedComposer = new TemplateComposer({ enableCache: true });
      const template = (ctx) => `<div>${ctx.value}-${Math.random()}</div>`;
      
      const context = { value: 'test' };
      const result1 = cachedComposer.compose(template, context);
      const result2 = cachedComposer.compose(template, context);
      
      // Should return same result due to caching
      expect(result1).toBe(result2);
    });

    it('should clear cache', () => {
      const cachedComposer = new TemplateComposer({ enableCache: true });
      const template = '<div>${value}</div>';
      
      const result1 = cachedComposer.compose(template, { value: 'test' });
      cachedComposer.clearCache();
      
      // After clearing, should recompute
      const result2 = cachedComposer.compose(template, { value: 'test' });
      expect(result1).toBe(result2); // Same result but recomputed
    });

    it('should not cache when disabled', () => {
      const nonCachedComposer = new TemplateComposer({ enableCache: false });
      const callCount = { count: 0 };
      const template = (ctx) => {
        callCount.count++;
        return `<div>${ctx.value}</div>`;
      };
      
      nonCachedComposer.compose(template, { value: 'test' });
      nonCachedComposer.compose(template, { value: 'test' });
      
      expect(callCount.count).toBe(2);
    });
  });

  describe('complex compositions', () => {
    it('should handle nested templates with slots', () => {
      const layoutTemplate = `
        <div class="layout">
          <slot name="header"></slot>
          <main><slot></slot></main>
          <slot name="footer"></slot>
        </div>
      `;
      
      const pageTemplate = {
        render: () => layoutTemplate
      };
      
      const result = composer.compose(pageTemplate, {
        slots: {
          header: '<h1>Page Header</h1>',
          default: '<p>Page content</p>',
          footer: '<footer>Page Footer</footer>'
        }
      });
      
      expect(result).toContain('<h1>Page Header</h1>');
      expect(result).toContain('<p>Page content</p>');
      expect(result).toContain('<footer>Page Footer</footer>');
    });

    it('should compose templates with variable substitution and slots', () => {
      const template = `
        <article>
          <h2>${'${title}'}</h2>
          <slot name="content"></slot>
          <p>Author: ${'${author}'}</p>
        </article>
      `;
      
      const result = composer.compose(template, {
        title: 'Test Article',
        author: 'John Doe',
        slots: {
          content: '<p>Article content here</p>'
        }
      });
      
      expect(result).toContain('<h2>Test Article</h2>');
      expect(result).toContain('<p>Article content here</p>');
      expect(result).toContain('<p>Author: John Doe</p>');
    });
  });

  describe('performance', () => {
    it('should compose standard page in reasonable time', () => {
      const template = `
        <div class="page">
          <header>${'${header}'}</header>
          <nav><slot name="nav"></slot></nav>
          <main>
            <slot name="content"></slot>
          </main>
          <aside><slot name="sidebar"></slot></aside>
          <footer>${'${footer}'}</footer>
        </div>
      `;
      
      const context = {
        header: 'Site Header',
        footer: 'Site Footer',
        slots: {
          nav: '<ul><li>Home</li><li>About</li></ul>',
          content: '<article>Main content</article>',
          sidebar: '<div>Sidebar content</div>'
        }
      };
      
      const start = performance.now();
      const result = composer.compose(template, context);
      const duration = performance.now() - start;
      
      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(10); // Should be under 10ms
    });

    it('should handle deep nesting efficiently', () => {
      const deepComposer = new TemplateComposer({ maxDepth: 10 });
      
      // Register nested templates
      for (let i = 0; i < 5; i++) {
        const nextLevel = i < 4 ? `<template ref="level${i + 1}" />` : 'Done';
        deepComposer.registerTemplate(`level${i}`, `<div>Level ${i}: ${nextLevel}</div>`);
      }
      
      const start = performance.now();
      const result = deepComposer.compose('<template ref="level0" />', {});
      const duration = performance.now() - start;
      
      expect(result).toContain('Level 0');
      expect(result).toContain('Level 4');
      expect(result).toContain('Done');
      expect(duration).toBeLessThan(20); // Should handle 5 levels in under 20ms
    });
  });
});