/**
 * @file Integration tests for template composition system
 * @see src/characterBuilder/templates/utilities/
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  TemplateComposer,
  SlotContentProvider,
  ComponentAssembler,
  CompositionCache,
  createBaseTemplate,
  extendTemplate,
  createTemplateChain,
} from '../../../../src/characterBuilder/templates/utilities/index.js';

// Import existing templates
import { createCharacterBuilderPage } from '../../../../src/characterBuilder/templates/core/pageTemplate.js';
import { createHeader } from '../../../../src/characterBuilder/templates/core/headerTemplate.js';
import { createMain } from '../../../../src/characterBuilder/templates/core/mainTemplate.js';
import { createFooter } from '../../../../src/characterBuilder/templates/core/footerTemplate.js';
import { createModal } from '../../../../src/characterBuilder/templates/core/modalTemplate.js';

describe('Template Composition Integration', () => {
  let composer;
  let assembler;
  let cache;

  beforeEach(() => {
    cache = new CompositionCache({
      maxSize: 50,
      ttl: 60000,
      enableStats: true,
    });
    composer = new TemplateComposer({
      enableCache: true,
      validateOutput: true,
    });
    assembler = new ComponentAssembler({ composer });
  });

  describe('Complete composition workflow', () => {
    it('should compose existing templates with new composition engine', () => {
      // Register existing templates
      assembler.registerLayout('page', (ctx) =>
        createCharacterBuilderPage(ctx)
      );
      assembler.registerComponent('header', (ctx) => createHeader(ctx));
      assembler.registerComponent('main', (ctx) => createMain(ctx));
      assembler.registerComponent('footer', (ctx) => createFooter(ctx));

      // Assemble a complete page
      const config = {
        layout: 'page',
        props: {
          title: 'Character Builder',
          subtitle: 'Create your character',
          leftPanel: {
            heading: 'Character Details',
            content: '<form>Character form here</form>',
          },
          rightPanel: {
            heading: 'Preview',
            content: '<div>Character preview</div>',
          },
        },
      };

      const result = assembler.assemble(config);

      expect(result).toContain('Character Builder');
      expect(result).toContain('Create your character');
      expect(result).toContain('Character Details');
      expect(result).toContain('Preview');
    });

    it('should handle nested templates with slots and inheritance', () => {
      // Create base layout template
      const baseLayout = createBaseTemplate({
        blocks: {
          header:
            '<header class="base-header"><slot name="header-content"></slot></header>',
          main: '<main class="base-main"><slot></slot></main>',
          footer:
            '<footer class="base-footer"><slot name="footer-content"></slot></footer>',
        },
      });

      // Extend the base layout
      const extendedLayout = extendTemplate(baseLayout, {
        blocks: {
          header:
            '<header class="extended-header">{{parent}}<nav>Navigation</nav></header>',
        },
      });

      // Register templates
      composer.registerTemplate('extended-layout', extendedLayout);

      // Compose with slots
      const result = composer.compose(extendedLayout, {
        slots: {
          'header-content': '<h1>Page Title</h1>',
          default: '<article>Main content</article>',
          'footer-content': '<p>Copyright 2024</p>',
        },
      });

      expect(result).toContain('<h1>Page Title</h1>');
      expect(result).toContain('<nav>Navigation</nav>');
      expect(result).toContain('<article>Main content</article>');
      expect(result).toContain('<p>Copyright 2024</p>');
    });

    it('should assemble complex component hierarchies', () => {
      // Define layout with multiple slot regions
      assembler.registerLayout(
        'dashboard',
        `
        <div class="dashboard">
          <div class="dashboard-header">
            <slot name="header"></slot>
          </div>
          <div class="dashboard-sidebar">
            <slot name="sidebar"></slot>
          </div>
          <div class="dashboard-content">
            <slot name="content"></slot>
          </div>
          <div class="dashboard-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      `
      );

      // Register various components
      assembler.registerComponent(
        'user-menu',
        `
        <div class="user-menu">
          <span>${'${username}'}</span>
          <button>Logout</button>
        </div>
      `
      );

      assembler.registerComponent(
        'nav-menu',
        `
        <nav class="nav-menu">
          <ul>
            <li>Dashboard</li>
            <li>Settings</li>
            <li>Help</li>
          </ul>
        </nav>
      `
      );

      assembler.registerComponent(
        'stats-widget',
        `
        <div class="stats-widget">
          <h3>${'${title}'}</h3>
          <p>${'${value}'}</p>
        </div>
      `
      );

      // Assemble dashboard
      const config = {
        layout: 'dashboard',
        props: {
          username: 'John Doe',
        },
        components: [
          { type: 'user-menu', slot: 'header' },
          { type: 'nav-menu', slot: 'sidebar' },
          {
            type: 'stats-widget',
            slot: 'content',
            props: { title: 'Total Users', value: '1,234' },
          },
          {
            type: 'stats-widget',
            slot: 'content',
            props: { title: 'Active Sessions', value: '89' },
          },
        ],
        slots: {
          footer: '<p>© 2024 Dashboard Inc.</p>',
        },
      };

      const result = assembler.assemble(config);

      expect(result).toContain('John Doe');
      expect(result).toContain('Dashboard');
      expect(result).toContain('Total Users');
      expect(result).toContain('1,234');
      expect(result).toContain('Active Sessions');
      expect(result).toContain('89');
      expect(result).toContain('© 2024 Dashboard Inc.');
    });
  });

  describe('Performance and caching', () => {
    it('should handle deep nesting efficiently', () => {
      // Create deeply nested template structure
      for (let i = 0; i < 5; i++) {
        composer.registerTemplate(
          `level-${i}`,
          `
          <div class="level-${i}">
            Level ${i}
            ${i < 4 ? `<template ref="level-${i + 1}" />` : '<span>Final level</span>'}
          </div>
        `
        );
      }

      const start = performance.now();
      const result = composer.compose('<template ref="level-0" />', {});
      const duration = performance.now() - start;

      expect(result).toContain('Level 0');
      expect(result).toContain('Level 4');
      expect(result).toContain('Final level');
      expect(duration).toBeLessThan(20); // Should be fast even with nesting
    });

    it('should cache and reuse compositions', () => {
      const cacheKey = cache.generateKey('test-template', { value: 'test' });

      // First composition
      cache.set(cacheKey, '<div>Cached result</div>');

      // Should retrieve from cache
      const cached = cache.get(cacheKey);
      expect(cached).toBe('<div>Cached result</div>');

      // Check cache stats
      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should handle batch assembly efficiently', () => {
      assembler.registerLayout('simple', '<div><slot></slot></div>');
      assembler.registerComponent('item', '<li>${text}</li>');

      const configs = [];
      for (let i = 0; i < 100; i++) {
        configs.push({
          layout: 'simple',
          components: [{ type: 'item', props: { text: `Item ${i}` } }],
        });
      }

      const start = performance.now();
      const results = assembler.assembleBatch(configs);
      const duration = performance.now() - start;

      expect(results).toHaveLength(100);
      expect(results[0]).toContain('Item 0');
      expect(results[99]).toContain('Item 99');
      expect(duration).toBeLessThan(100); // Should handle 100 assemblies quickly
    });
  });

  describe('Template inheritance chains', () => {
    it('should support multiple levels of inheritance', () => {
      const base = createBaseTemplate({
        blocks: {
          header: 'Base Header',
          main: 'Base Main',
          footer: 'Base Footer',
        },
      });

      const level1 = extendTemplate(base, {
        blocks: {
          header: 'Level 1 Header',
        },
      });

      const level2 = extendTemplate(level1, {
        blocks: {
          main: 'Level 2 Main',
        },
      });

      const level3 = extendTemplate(level2, {
        blocks: {
          footer: 'Level 3 Footer',
        },
      });

      const result = level3.render();

      expect(result).toContain('Level 1 Header');
      expect(result).toContain('Level 2 Main');
      expect(result).toContain('Level 3 Footer');
    });

    it('should create template chains', () => {
      const base = createBaseTemplate({
        blocks: { main: 'Original' },
      });

      const chain = createTemplateChain(
        base,
        { blocks: { main: 'Modified 1' } },
        { blocks: { main: 'Modified 2' } },
        { blocks: { main: 'Final' } }
      );

      const result = chain.render();
      expect(result).toContain('Final');
    });
  });

  describe('Error handling', () => {
    it('should handle missing templates gracefully', () => {
      const config = {
        layout: 'non-existent',
        components: [],
      };

      expect(() => {
        assembler.assemble(config);
      }).toThrow('Layout template not found');
    });

    it('should prevent infinite recursion', () => {
      // Create circular reference
      composer.registerTemplate('a', '<div>A: <template ref="b" /></div>');
      composer.registerTemplate('b', '<div>B: <template ref="a" /></div>');

      const limitedComposer = new TemplateComposer({ maxDepth: 5 });
      limitedComposer.registerTemplate(
        'a',
        '<div>A: <template ref="b" /></div>'
      );
      limitedComposer.registerTemplate(
        'b',
        '<div>B: <template ref="a" /></div>'
      );

      expect(() => {
        limitedComposer.compose('<template ref="a" />', {});
      }).toThrow('Maximum composition depth');
    });

    it('should validate HTML output when enabled', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidTemplate = '<div><span>Unclosed span</div>';
      composer.compose(invalidTemplate, {});

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with existing templates', () => {
    it('should work with modal templates', () => {
      const modal = createModal({
        id: 'test-modal',
        title: 'Test Modal',
        content: '<p>Modal content</p>',
        actions: [
          { label: 'Cancel', name: 'cancel' },
          { label: 'Save', name: 'save' },
        ],
      });

      // Use composer to add slots to modal
      const enhancedModal = `
        ${modal}
        <div class="modal-extra">
          <slot name="extra"></slot>
        </div>
      `;

      const result = composer.compose(enhancedModal, {
        slots: {
          extra: '<p>Additional content</p>',
        },
      });

      expect(result).toContain('Test Modal');
      expect(result).toContain('Modal content');
      expect(result).toContain('Additional content');
    });

    it('should compose character builder page with all features', () => {
      const page = createCharacterBuilderPage({
        title: 'Advanced Character Builder',
        subtitle: 'With composition engine',
        leftPanel: {
          heading: 'Configuration',
          content: composer.compose('<div><slot name="config"></slot></div>', {
            slots: {
              config: '<form>Config form</form>',
            },
          }),
        },
        rightPanel: {
          heading: 'Results',
          content: '<div>Results here</div>',
        },
        modals: [
          {
            id: 'help-modal',
            title: 'Help',
            content: '<p>Help content</p>',
          },
        ],
      });

      expect(page).toContain('Advanced Character Builder');
      expect(page).toContain('With composition engine');
      expect(page).toContain('Config form');
      expect(page).toContain('Results here');
      expect(page).toContain('help-modal');
    });
  });
});
