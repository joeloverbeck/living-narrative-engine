/**
 * @file Component Assembly System
 * @module characterBuilder/templates/utilities/componentAssembler
 * @description Assembles components dynamically based on configuration
 *
 * NOTE: Currently uses simple template storage. Will integrate with
 * TemplateRegistry when available (HTMLTEMP-030)
 */

import { SlotContentProvider } from './slotContentProvider.js';

/**
 * Assembles components dynamically based on configuration
 */
export class ComponentAssembler {
  #composer;
  #templates;
  #layouts;
  #components;

  /**
   * @param {object} config - Assembler configuration
   * @param {object} config.composer - TemplateComposer instance
   * @param {Map} [config.templates] - Template storage (will use TemplateRegistry in future)
   */
  constructor({ composer, templates }) {
    if (!composer) {
      throw new Error(
        'ComponentAssembler requires a TemplateComposer instance'
      );
    }

    this.#composer = composer;
    // Temporary: Use Map or provided templates until TemplateRegistry is available
    this.#templates = templates || new Map();
    this.#layouts = new Map();
    this.#components = new Map();
  }

  /**
   * Register a template for assembly
   *
   * @param {string} name - Template name
   * @param {string|Function|object} template - Template content or function
   * @param {string} [type] - Template type: 'layout', 'component', or 'template'
   */
  registerTemplate(name, template, type = 'template') {
    if (!name) {
      throw new Error('Template name is required');
    }

    const fullName = type === 'template' ? name : `${type}:${name}`;
    this.#templates.set(fullName, template);

    // Also store in type-specific maps for easier access
    if (type === 'layout') {
      this.#layouts.set(name, template);
    } else if (type === 'component') {
      this.#components.set(name, template);
    }
  }

  /**
   * Register a layout template
   *
   * @param {string} name - Layout name
   * @param {string|Function|object} template - Layout template
   */
  registerLayout(name, template) {
    this.registerTemplate(name, template, 'layout');
  }

  /**
   * Register a component template
   *
   * @param {string} name - Component name
   * @param {string|Function|object} template - Component template
   */
  registerComponent(name, template) {
    this.registerTemplate(name, template, 'component');
  }

  /**
   * Get a registered template
   *
   * @param {string} name - Template name
   * @param {string} [type] - Template type
   * @returns {*} Template or undefined
   */
  getTemplate(name, type = 'template') {
    const fullName = type === 'template' ? name : `${type}:${name}`;
    return this.#templates.get(fullName);
  }

  /**
   * Check if a template exists
   *
   * @param {string} name - Template name
   * @param {string} [type] - Template type
   * @returns {boolean} True if template exists
   */
  hasTemplate(name, type = 'template') {
    const fullName = type === 'template' ? name : `${type}:${name}`;
    return this.#templates.has(fullName);
  }

  /**
   * Assemble components based on configuration
   *
   * @param {object} config - Assembly configuration
   * @param {string} [config.layout] - Layout template name
   * @param {Array<object>} [config.components] - Components to assemble
   * @param {object} [config.props] - Global props for all components
   * @param {object} [config.slots] - Direct slot content (overrides component slots)
   * @param {object} [config.context] - Additional context for rendering
   * @returns {string} Assembled HTML
   */
  assemble(config) {
    const {
      layout = 'default',
      components = [],
      props = {},
      slots = {},
      context = {},
    } = config;

    // Get layout template
    const layoutTemplate = this.getTemplate(layout, 'layout');
    if (!layoutTemplate) {
      throw new Error(`Layout template not found: ${layout}`);
    }

    // Prepare slot content from components
    const slotProvider = new SlotContentProvider();

    // Process each component
    for (const component of components) {
      const {
        type,
        slot = 'default',
        props: componentProps = {},
        condition = true,
        repeat = 1,
      } = component;

      // Check condition
      if (!this.#evaluateCondition(condition, { ...props, ...context })) {
        continue;
      }

      // Get component template
      const template = this.getTemplate(type, 'component');

      if (template) {
        // Compose component content
        const componentContext = {
          ...props,
          ...componentProps,
          ...context,
          component: {
            type,
            slot,
            index: 0,
          },
        };

        // Handle repeat
        const contents = [];
        for (let i = 0; i < repeat; i++) {
          componentContext.component.index = i;
          const content = this.#composer.compose(template, componentContext);
          contents.push(content);
        }

        const finalContent = contents.join('\n');

        // Add to slot (handle 'default' as null for default slot)
        const slotName = slot === 'default' ? null : slot;
        if (slotProvider.hasSlot(slotName)) {
          // Append to existing slot content
          const existing = slotProvider.getSlot(slotName);
          slotProvider.setSlot(slotName, existing + '\n' + finalContent);
        } else {
          slotProvider.setSlot(slotName, finalContent);
        }
      } else {
        console.warn(`Component template not found: ${type}`);
      }
    }

    // Merge direct slots (these override component slots)
    for (const [slotName, slotContent] of Object.entries(slots)) {
      if (slotName === 'default') {
        slotProvider.setSlot(null, slotContent);
      } else {
        slotProvider.setSlot(slotName, slotContent);
      }
    }

    // Compose layout with slots
    const layoutContext = {
      ...props,
      ...context,
      slots: slotProvider,
      layout: {
        name: layout,
      },
    };

    return this.#composer.compose(layoutTemplate, layoutContext);
  }

  /**
   * Batch assemble multiple configurations
   *
   * @param {Array<object>} configs - Array of assembly configurations
   * @param {boolean} [parallel] - Process in parallel (returns Promise)
   * @returns {Array<string>|Promise<Array<string>>} Array of assembled HTML
   */
  assembleBatch(configs, parallel = false) {
    if (!Array.isArray(configs)) {
      throw new Error('Batch assembly requires an array of configurations');
    }

    if (parallel) {
      // Process in parallel using Promise.all
      return Promise.all(
        configs.map((config) =>
          Promise.resolve().then(() => this.assemble(config))
        )
      );
    }

    // Process sequentially
    return configs.map((config) => this.assemble(config));
  }

  /**
   * Create a component configuration
   *
   * @static
   * @param {string} type - Component type
   * @param {object} [options] - Component options
   * @returns {object} Component configuration
   */
  static createComponent(type, options = {}) {
    return {
      type,
      slot: options.slot || 'default',
      props: options.props || {},
      condition: options.condition !== undefined ? options.condition : true,
      repeat: options.repeat || 1,
    };
  }

  /**
   * Create an assembly configuration
   *
   * @static
   * @param {string} layout - Layout name
   * @param {Array<object>} components - Components to assemble
   * @param {object} [options] - Additional options
   * @returns {object} Assembly configuration
   */
  static createConfig(layout, components, options = {}) {
    return {
      layout,
      components,
      props: options.props || {},
      slots: options.slots || {},
      context: options.context || {},
    };
  }

  /**
   * Evaluate a condition
   *
   * @private
   * @param {boolean|Function} condition - Condition to evaluate
   * @param {object} context - Context for evaluation
   * @returns {boolean} Evaluation result
   */
  #evaluateCondition(condition, context) {
    if (typeof condition === 'function') {
      try {
        return !!condition(context);
      } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
      }
    }
    return !!condition;
  }

  /**
   * Clear all registered templates
   */
  clear() {
    this.#templates.clear();
    this.#layouts.clear();
    this.#components.clear();
  }

  /**
   * Get statistics about registered templates
   *
   * @returns {object} Template statistics
   */
  getStats() {
    return {
      total: this.#templates.size,
      layouts: this.#layouts.size,
      components: this.#components.size,
      templates:
        this.#templates.size - this.#layouts.size - this.#components.size,
    };
  }

  /**
   * Export all templates
   *
   * @returns {object} All templates organized by type
   */
  exportTemplates() {
    const exported = {
      layouts: {},
      components: {},
      templates: {},
    };

    for (const [key, value] of this.#templates.entries()) {
      if (key.startsWith('layout:')) {
        exported.layouts[key.substring(7)] = value;
      } else if (key.startsWith('component:')) {
        exported.components[key.substring(10)] = value;
      } else {
        exported.templates[key] = value;
      }
    }

    return exported;
  }

  /**
   * Import templates
   *
   * @param {object} templates - Templates to import
   * @param {boolean} [overwrite] - Whether to overwrite existing templates
   */
  importTemplates(templates, overwrite = false) {
    if (!templates || typeof templates !== 'object') {
      throw new Error('Invalid templates object');
    }

    // Import layouts
    if (templates.layouts) {
      for (const [name, template] of Object.entries(templates.layouts)) {
        if (overwrite || !this.hasTemplate(name, 'layout')) {
          this.registerLayout(name, template);
        }
      }
    }

    // Import components
    if (templates.components) {
      for (const [name, template] of Object.entries(templates.components)) {
        if (overwrite || !this.hasTemplate(name, 'component')) {
          this.registerComponent(name, template);
        }
      }
    }

    // Import generic templates
    if (templates.templates) {
      for (const [name, template] of Object.entries(templates.templates)) {
        if (overwrite || !this.hasTemplate(name)) {
          this.registerTemplate(name, template);
        }
      }
    }
  }
}

// Export utility functions for testing
export const __testUtils = {
  createTestAssembler: (composer) => new ComponentAssembler({ composer }),
};
