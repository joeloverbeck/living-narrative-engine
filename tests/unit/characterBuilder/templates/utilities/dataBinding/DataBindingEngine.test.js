/**
 * @file Unit tests for DataBindingEngine
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DataBindingEngine } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/DataBindingEngine.js';
import { HTMLSanitizer } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/HTMLSanitizer.js';
import { ExpressionEvaluator } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/ExpressionEvaluator.js';
import { TemplateEventManager } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/TemplateEventManager.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

describe('DataBindingEngine', () => {
  let engine;
  let sanitizer;
  let evaluator;
  let eventManager;

  beforeEach(() => {
    sanitizer = new HTMLSanitizer();
    evaluator = new ExpressionEvaluator();
    eventManager = new TemplateEventManager();

    engine = new DataBindingEngine({
      sanitizer,
      evaluator,
      eventManager,
    });
  });

  describe('constructor', () => {
    it('should create engine with default dependencies', () => {
      const defaultEngine = new DataBindingEngine();
      expect(defaultEngine).toBeInstanceOf(DataBindingEngine);
    });

    it('should create engine with custom dependencies', () => {
      expect(engine).toBeInstanceOf(DataBindingEngine);
    });

    it('should set default max depth', () => {
      const testEngine = new DataBindingEngine({ maxDepth: 5 });
      expect(testEngine).toBeInstanceOf(DataBindingEngine);
    });
  });

  describe('bind()', () => {
    it('should process simple interpolation', () => {
      const html = '<div>{{ name }}</div>';
      const context = { name: 'John' };

      const result = engine.bind(html, context);

      expect(result.html).toContain('John');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should process HTML interpolation', () => {
      const html = '<div>{{{ content }}}</div>';
      const context = { content: '<strong>Bold</strong>' };

      const result = engine.bind(html, context);

      expect(result.html).toContain('<strong>Bold</strong>');
    });

    it('should handle empty input', () => {
      const result = engine.bind('', {});

      expect(result.html).toBe('');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should handle null template', () => {
      const result = engine.bind(null, {});

      expect(result.html).toBe('');
    });

    it('should sanitize output by default', () => {
      const html = '<div>{{ value }}</div>';
      const context = { value: '<script>alert("xss")</script>' };

      const result = engine.bind(html, context);

      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should skip sanitization when disabled', () => {
      const html = '<div>{{{ value }}}</div>';
      const context = { value: '<em>emphasis</em>' };

      const result = engine.bind(html, context, { sanitize: false });

      expect(result.html).toContain('<em>emphasis</em>');
    });

    it('should prevent infinite recursion', () => {
      const deepEngine = new DataBindingEngine({ maxDepth: 1 });

      // Create a template that will trigger deep recursion beyond the nested processing allowance
      // The engine allows _isNestedProcessing operations to use maxDepth + 5 depth
      // So with maxDepth=1, nested processing can go to depth 6
      // We need to create enough nesting to exceed this limit
      const html = `<div tb-for="outer in outerItems">
        <div tb-for="middle in outer.middleItems">
          <div tb-for="inner in middle.innerItems">
            <div tb-for="deep in inner.deepItems">
              <div tb-for="deeper in deep.deeperItems">
                <div tb-for="deepest in deeper.deepestItems">
                  <div tb-for="final in deepest.finalItems">
                    {{ final.name }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

      const context = {
        outerItems: [
          {
            middleItems: [
              {
                innerItems: [
                  {
                    deepItems: [
                      {
                        deeperItems: [
                          {
                            deepestItems: [
                              {
                                finalItems: [{ name: 'test' }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => {
        deepEngine.bind(html, context);
      }).toThrow(/Maximum binding depth/);
    });

    it('should allow legitimate nested processing with low maxDepth', () => {
      // Test that the _isNestedProcessing mechanism allows normal tb-for operations
      // even with a low maxDepth setting
      const engine = new DataBindingEngine({ maxDepth: 2 });
      const html = `<ul><li tb-for="item in items">{{ item.name }}</li></ul>`;
      const context = { items: [{ name: 'Item 1' }, { name: 'Item 2' }] };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Item 1');
      expect(result.html).toContain('Item 2');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should handle multiple levels of nested tb-for within reasonable limits', () => {
      // Test nested tb-for directives that should work with the _isNestedProcessing allowance
      const engine = new DataBindingEngine({ maxDepth: 3 });
      const html = `
        <div tb-for="category in categories">
          <h2>{{ category.name }}</h2>
          <ul tb-for="item in category.items">
            <li>{{ item.title }}</li>
          </ul>
        </div>
      `;
      const context = {
        categories: [
          {
            name: 'Category 1',
            items: [{ title: 'Item A' }, { title: 'Item B' }],
          },
          {
            name: 'Category 2',
            items: [{ title: 'Item C' }],
          },
        ],
      };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Category 1');
      expect(result.html).toContain('Category 2');
      expect(result.html).toContain('Item A');
      expect(result.html).toContain('Item B');
      expect(result.html).toContain('Item C');
    });
  });

  describe('createScopedContext()', () => {
    it('should merge parent and local context', () => {
      const parentContext = { name: 'John', age: 30 };
      const localContext = { age: 25, city: 'New York' };

      const result = engine.createScopedContext(parentContext, localContext);

      expect(result).toEqual({
        name: 'John',
        age: 25, // Local overrides parent
        city: 'New York',
      });
    });

    it('should handle empty contexts', () => {
      const result = engine.createScopedContext({}, {});

      expect(result).toEqual({});
    });
  });

  describe('clearBindings()', () => {
    it('should clear all event bindings', () => {
      const clearSpy = jest.spyOn(eventManager, 'clearAll');

      engine.clearBindings();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('conditional processing', () => {
    beforeEach(() => {
      // Set up DOM environment for conditional tests
      document.body.innerHTML = '';
    });

    it('should process tb-if directive', () => {
      const html = '<div tb-if="showDiv">Visible content</div>';
      const context = { showDiv: true };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Visible content');
      expect(result.html).not.toContain('display: none');
    });

    it('should remove elements with false tb-if', () => {
      const html = '<div tb-if="showDiv">Hidden content</div>';
      const context = { showDiv: false };

      const result = engine.bind(html, context);

      // tb-if removes elements from DOM entirely when false
      expect(result.html).toBe('');
      expect(result.html).not.toContain('Hidden content');
    });

    it('should process tb-show directive', () => {
      const html = '<div tb-show="visible">Content</div>';
      const context = { visible: true };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Content');
      expect(result.html).not.toContain('display: none');
    });

    it('should hide elements with false tb-show using CSS', () => {
      const html = '<div tb-show="visible">Hidden content</div>';
      const context = { visible: false };

      const result = engine.bind(html, context);

      // tb-show uses CSS to hide elements (keeps them in DOM)
      expect(result.html).toContain('Hidden content');
      expect(result.html).toContain('display: none');
    });
  });

  describe('list processing', () => {
    it('should process tb-for directive', () => {
      const html = '<li tb-for="item in items">{{ item }}</li>';
      const context = { items: ['apple', 'banana', 'cherry'] };

      const result = engine.bind(html, context);

      expect(result.html).toContain('apple');
      expect(result.html).toContain('banana');
      expect(result.html).toContain('cherry');
    });

    it('should handle empty arrays', () => {
      const html = '<li tb-for="item in items">{{ item }}</li>';
      const context = { items: [] };

      const result = engine.bind(html, context);

      // Should produce no list items
      expect(result.html).not.toContain('<li>');
    });
  });

  describe('event binding', () => {
    it('should process tb-on:click directive', () => {
      const html = '<button tb-on:click="handleClick">Click me</button>';
      const context = { handleClick: jest.fn() };

      const result = engine.bind(html, context);

      expect(result.html).toContain('<button');
      expect(result.html).toContain('Click me');
      expect(typeof result.cleanup).toBe('function');
    });

    it('should return cleanup function for events', () => {
      const html = '<button tb-on:click="handleClick">Button</button>';
      const context = { handleClick: jest.fn() };

      const result = engine.bind(html, context);

      // Cleanup should be callable
      expect(() => result.cleanup()).not.toThrow();
    });
  });

  describe('complex templates', () => {
    it('should process templates with multiple directives', () => {
      const html = `
        <div tb-if="showList">
          <ul>
            <li tb-for="item in items" tb-on:click="selectItem">{{ item.name }}</li>
          </ul>
        </div>
      `;
      const context = {
        showList: true,
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
        selectItem: jest.fn(),
      };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Item 1');
      expect(result.html).toContain('Item 2');
      expect(result.html).toContain('<ul>');
    });

    it('should handle nested interpolation and conditionals', () => {
      const html = '<div tb-if="user">Hello {{ user.name }}!</div>';
      const context = { user: { name: 'Alice' } };

      const result = engine.bind(html, context);

      expect(result.html).toContain('Hello Alice!');
    });
  });

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const html = '<div><span>Unclosed div';
      const context = {};

      expect(() => {
        engine.bind(html, context);
      }).not.toThrow();
    });

    it('should handle invalid expressions gracefully', () => {
      const html = '<div>{{ invalid..expression }}</div>';
      const context = {};

      const result = engine.bind(html, context);

      // Should not crash and should contain original expression or fallback
      expect(result.html).toBeDefined();
      expect(typeof result.cleanup).toBe('function');
    });
  });
});
