/**
 * @file Unit tests for ComponentAssembler
 * @see src/characterBuilder/templates/utilities/componentAssembler.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ComponentAssembler } from '../../../../../src/characterBuilder/templates/utilities/componentAssembler.js';
import { TemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/templateComposer.js';

describe('ComponentAssembler', () => {
  let composer;
  let assembler;

  beforeEach(() => {
    composer = new TemplateComposer();
    assembler = new ComponentAssembler({ composer });
  });

  describe('constructor', () => {
    it('should create assembler with composer', () => {
      expect(assembler).toBeInstanceOf(ComponentAssembler);
    });

    it('should throw error without composer', () => {
      expect(() => {
        new ComponentAssembler({});
      }).toThrow('ComponentAssembler requires a TemplateComposer instance');
    });
  });

  describe('registerTemplate()', () => {
    it('should register generic templates', () => {
      assembler.registerTemplate('test', '<div>Test</div>');
      expect(assembler.hasTemplate('test')).toBe(true);
    });

    it('should register layout templates', () => {
      assembler.registerLayout('main', '<div><slot></slot></div>');
      expect(assembler.hasTemplate('main', 'layout')).toBe(true);
    });

    it('should register component templates', () => {
      assembler.registerComponent('button', '<button>${label}</button>');
      expect(assembler.hasTemplate('button', 'component')).toBe(true);
    });

    it('should throw error for missing name', () => {
      expect(() => {
        assembler.registerTemplate('', '<div></div>');
      }).toThrow('Template name is required');
    });
  });

  describe('assemble()', () => {
    beforeEach(() => {
      // Register test templates
      assembler.registerLayout('default', `
        <div class="layout">
          <header><slot name="header"></slot></header>
          <main><slot></slot></main>
          <footer><slot name="footer"></slot></footer>
        </div>
      `);
      
      assembler.registerComponent('nav', '<nav>Navigation</nav>');
      assembler.registerComponent('content', '<article>${text}</article>');
      assembler.registerComponent('copyright', '<p>© 2024</p>');
    });

    it('should assemble components into layout', () => {
      const config = {
        layout: 'default',
        components: [
          { type: 'nav', slot: 'header' },
          { type: 'content', slot: 'default', props: { text: 'Main content' } },
          { type: 'copyright', slot: 'footer' }
        ]
      };
      
      const result = assembler.assemble(config);
      
      expect(result).toContain('<nav>Navigation</nav>');
      expect(result).toContain('<article>Main content</article>');
      expect(result).toContain('<p>© 2024</p>');
    });

    it('should handle missing layout', () => {
      expect(() => {
        assembler.assemble({ layout: 'missing' });
      }).toThrow('Layout template not found: missing');
    });

    it('should warn for missing components', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config = {
        layout: 'default',
        components: [
          { type: 'missing', slot: 'header' }
        ]
      };
      
      assembler.assemble(config);
      expect(consoleSpy).toHaveBeenCalledWith('Component template not found: missing');
      
      consoleSpy.mockRestore();
    });

    it('should handle component conditions', () => {
      const config = {
        layout: 'default',
        components: [
          { type: 'nav', slot: 'header', condition: true },
          { type: 'content', slot: 'default', condition: false }
        ]
      };
      
      const result = assembler.assemble(config);
      
      expect(result).toContain('<nav>Navigation</nav>');
      expect(result).not.toContain('<article>');
    });

    it('should handle component repeat', () => {
      assembler.registerComponent('item', '<li>Item ${component.index}</li>');
      
      const config = {
        layout: 'default',
        components: [
          { type: 'item', slot: 'default', repeat: 3 }
        ]
      };
      
      const result = assembler.assemble(config);
      
      expect(result).toContain('<li>Item 0</li>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should merge global and component props', () => {
      assembler.registerComponent('text', '<p>${globalProp} - ${localProp}</p>');
      
      const config = {
        layout: 'default',
        props: { globalProp: 'Global' },
        components: [
          { type: 'text', props: { localProp: 'Local' } }
        ]
      };
      
      const result = assembler.assemble(config);
      expect(result).toContain('<p>Global - Local</p>');
    });

    it('should handle direct slot content', () => {
      const config = {
        layout: 'default',
        slots: {
          header: '<h1>Direct Header</h1>',
          default: '<p>Direct Content</p>',
          footer: '<div>Direct Footer</div>'
        }
      };
      
      const result = assembler.assemble(config);
      
      expect(result).toContain('<h1>Direct Header</h1>');
      expect(result).toContain('<p>Direct Content</p>');
      expect(result).toContain('<div>Direct Footer</div>');
    });

    it('should append multiple components to same slot', () => {
      const config = {
        layout: 'default',
        components: [
          { type: 'nav', slot: 'header' },
          { type: 'copyright', slot: 'header' }
        ]
      };
      
      const result = assembler.assemble(config);
      const headerContent = result.match(/<header>(.*?)<\/header>/s)[1];
      
      expect(headerContent).toContain('<nav>Navigation</nav>');
      expect(headerContent).toContain('<p>© 2024</p>');
    });
  });

  describe('assembleBatch()', () => {
    beforeEach(() => {
      assembler.registerLayout('simple', '<div><slot></slot></div>');
      assembler.registerComponent('text', '<p>${content}</p>');
    });

    it('should assemble multiple configurations sequentially', () => {
      const configs = [
        {
          layout: 'simple',
          components: [{ type: 'text', props: { content: 'First' } }]
        },
        {
          layout: 'simple',
          components: [{ type: 'text', props: { content: 'Second' } }]
        }
      ];
      
      const results = assembler.assembleBatch(configs);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toContain('First');
      expect(results[1]).toContain('Second');
    });

    it('should assemble in parallel when requested', async () => {
      const configs = [
        {
          layout: 'simple',
          components: [{ type: 'text', props: { content: 'Parallel 1' } }]
        },
        {
          layout: 'simple',
          components: [{ type: 'text', props: { content: 'Parallel 2' } }]
        }
      ];
      
      const results = await assembler.assembleBatch(configs, true);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toContain('Parallel 1');
      expect(results[1]).toContain('Parallel 2');
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        assembler.assembleBatch('not an array');
      }).toThrow('Batch assembly requires an array');
    });
  });

  describe('static methods', () => {
    it('should create component configuration', () => {
      const component = ComponentAssembler.createComponent('button', {
        slot: 'header',
        props: { label: 'Click me' },
        condition: true,
        repeat: 2
      });
      
      expect(component).toEqual({
        type: 'button',
        slot: 'header',
        props: { label: 'Click me' },
        condition: true,
        repeat: 2
      });
    });

    it('should create assembly configuration', () => {
      const config = ComponentAssembler.createConfig('main', [
        { type: 'nav' }
      ], {
        props: { theme: 'dark' },
        slots: { footer: 'Footer' }
      });
      
      expect(config).toEqual({
        layout: 'main',
        components: [{ type: 'nav' }],
        props: { theme: 'dark' },
        slots: { footer: 'Footer' },
        context: {}
      });
    });
  });

  describe('template management', () => {
    it('should get template statistics', () => {
      assembler.registerLayout('layout1', '<div></div>');
      assembler.registerComponent('comp1', '<span></span>');
      assembler.registerComponent('comp2', '<p></p>');
      assembler.registerTemplate('template1', '<h1></h1>');
      
      const stats = assembler.getStats();
      
      expect(stats).toEqual({
        total: 4,
        layouts: 1,
        components: 2,
        templates: 1
      });
    });

    it('should clear all templates', () => {
      assembler.registerLayout('test', '<div></div>');
      assembler.registerComponent('test', '<span></span>');
      
      expect(assembler.getStats().total).toBe(2);
      
      assembler.clear();
      
      expect(assembler.getStats().total).toBe(0);
    });

    it('should export and import templates', () => {
      assembler.registerLayout('layout', '<div></div>');
      assembler.registerComponent('component', '<span></span>');
      assembler.registerTemplate('template', '<p></p>');
      
      const exported = assembler.exportTemplates();
      
      expect(exported.layouts).toHaveProperty('layout');
      expect(exported.components).toHaveProperty('component');
      expect(exported.templates).toHaveProperty('template');
      
      // Clear and re-import
      assembler.clear();
      assembler.importTemplates(exported);
      
      expect(assembler.hasTemplate('layout', 'layout')).toBe(true);
      expect(assembler.hasTemplate('component', 'component')).toBe(true);
      expect(assembler.hasTemplate('template')).toBe(true);
    });

    it('should respect overwrite flag on import', () => {
      assembler.registerLayout('test', 'Original');
      
      const toImport = {
        layouts: { test: 'New' }
      };
      
      assembler.importTemplates(toImport, false); // Don't overwrite
      expect(assembler.getTemplate('test', 'layout')).toBe('Original');
      
      assembler.importTemplates(toImport, true); // Overwrite
      expect(assembler.getTemplate('test', 'layout')).toBe('New');
    });
  });
});