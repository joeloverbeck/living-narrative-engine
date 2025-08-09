/**
 * @file Template Inheritance System
 * @module characterBuilder/templates/utilities/templateInheritance
 * @description Provides template inheritance functionality with block-based overrides
 */

/**
 * Create a base template that can be extended
 *
 * @param {object} config - Base template configuration
 * @param {object} [config.blocks] - Template blocks that can be overridden
 * @param {string} [config.name] - Template name for identification
 * @param {object} [config.metadata] - Additional metadata for the template
 * @returns {object} Base template object
 */
export function createBaseTemplate({
  blocks = {},
  name = 'base',
  metadata = {},
} = {}) {
  // Default blocks if not provided
  const defaultBlocks = {
    header: blocks.header || '<header>Default Header</header>',
    main: blocks.main || '<main><slot></slot></main>',
    footer: blocks.footer || '<footer>Default Footer</footer>',
    ...blocks, // Allow custom blocks beyond the defaults
  };

  return {
    type: 'base',
    name,
    blocks: defaultBlocks,
    metadata,
    parent: null,

    /**
     * Render the template with optional block overrides
     *
     * @param {object} overrides - Block overrides
     * @returns {string} Rendered HTML
     */
    render(overrides = {}) {
      const mergedBlocks = { ...this.blocks, ...overrides };
      return this.compose(mergedBlocks);
    },

    /**
     * Compose the template from blocks
     *
     * @param {object} blocks - Blocks to compose
     * @returns {string} Composed HTML
     */
    compose(blocks) {
      // Default composition - can be overridden in extended templates
      const layout = this.metadata.layout || 'default';

      if (layout === 'default') {
        return `
          <div class="template-container" data-template="${this.name}">
            ${blocks.header || ''}
            ${blocks.main || ''}
            ${blocks.footer || ''}
          </div>
        `;
      } else if (layout === 'sidebar') {
        return `
          <div class="template-container template-sidebar" data-template="${this.name}">
            ${blocks.header || ''}
            <div class="template-body">
              ${blocks.sidebar || ''}
              ${blocks.main || ''}
            </div>
            ${blocks.footer || ''}
          </div>
        `;
      } else if (layout === 'custom' && this.metadata.customCompose) {
        return this.metadata.customCompose(blocks);
      }

      // Fallback to simple concatenation
      return Object.values(blocks).join('\n');
    },

    /**
     * Get a specific block
     *
     * @param {string} blockName - Name of the block
     * @returns {string|undefined} Block content
     */
    getBlock(blockName) {
      return this.blocks[blockName];
    },

    /**
     * Set a specific block
     *
     * @param {string} blockName - Name of the block
     * @param {string} content - Block content
     */
    setBlock(blockName, content) {
      this.blocks[blockName] = content;
    },

    /**
     * Get all block names
     *
     * @returns {Array<string>} Array of block names
     */
    getBlockNames() {
      return Object.keys(this.blocks);
    },

    /**
     * Clone this template
     *
     * @returns {object} Cloned template
     */
    clone() {
      return createBaseTemplate({
        blocks: { ...this.blocks },
        name: this.name,
        metadata: { ...this.metadata },
      });
    },
  };
}

/**
 * Extend a base template with overrides
 *
 * @param {object} baseTemplate - Base template to extend
 * @param {object} extensions - Extensions to apply
 * @param {object} [extensions.blocks] - Block overrides
 * @param {string} [extensions.name] - New template name
 * @param {object} [extensions.metadata] - Additional metadata
 * @returns {object} Extended template
 */
export function extendTemplate(baseTemplate, extensions = {}) {
  if (!baseTemplate || typeof baseTemplate !== 'object') {
    throw new Error('Base template must be a valid template object');
  }

  const extendedName = extensions.name || `${baseTemplate.name}-extended`;

  const extended = {
    ...baseTemplate,
    type: 'extended',
    name: extendedName,
    parent: baseTemplate,
    blocks: {
      ...baseTemplate.blocks,
      ...(extensions.blocks || {}),
    },
    metadata: {
      ...baseTemplate.metadata,
      ...(extensions.metadata || {}),
    },

    /**
     * Render with support for parent template access
     *
     * @param {object} overrides - Block overrides
     * @returns {string} Rendered HTML
     */
    render(overrides = {}) {
      const finalBlocks = {
        ...this.blocks,
        ...overrides,
      };

      // Allow access to parent blocks via special syntax
      const processedBlocks = {};
      for (const [key, value] of Object.entries(finalBlocks)) {
        if (typeof value === 'string' && value.includes('{{parent}}')) {
          // Replace {{parent}} with parent block content
          const parentContent = this.parent.blocks[key] || '';
          processedBlocks[key] = value.replace(
            /\{\{parent\}\}/g,
            parentContent
          );
        } else {
          processedBlocks[key] = value;
        }
      }

      // Use parent's compose method if not overridden
      if (this.compose === baseTemplate.compose) {
        return baseTemplate.compose.call(this, processedBlocks);
      }
      return this.compose(processedBlocks);
    },

    /**
     * Get the inheritance chain
     *
     * @returns {Array<object>} Array of templates from current to base
     */
    getInheritanceChain() {
      const chain = [this];
      let current = this.parent;

      while (current) {
        chain.push(current);
        current = current.parent;
      }

      return chain;
    },

    /**
     * Get a block from the inheritance chain
     *
     * @param {string} blockName - Block name
     * @param {boolean} [useParent] - Get from parent instead of current
     * @returns {string|undefined} Block content
     */
    getBlock(blockName, useParent = false) {
      if (useParent && this.parent) {
        return this.parent.getBlock(blockName);
      }
      return this.blocks[blockName];
    },

    /**
     * Check if block is overridden
     *
     * @param {string} blockName - Block name to check
     * @returns {boolean} True if overridden from parent
     */
    isBlockOverridden(blockName) {
      if (!this.parent) return false;
      return this.blocks[blockName] !== this.parent.blocks[blockName];
    },

    /**
     * Get all overridden blocks
     *
     * @returns {object} Object with overridden blocks only
     */
    getOverriddenBlocks() {
      if (!this.parent) return this.blocks;

      const overridden = {};
      for (const [key, value] of Object.entries(this.blocks)) {
        if (value !== this.parent.blocks[key]) {
          overridden[key] = value;
        }
      }
      return overridden;
    },
  };

  // If custom compose method is provided in extensions
  if (extensions.compose && typeof extensions.compose === 'function') {
    extended.compose = extensions.compose;
  }

  return extended;
}

/**
 * Create a template chain from multiple templates
 *
 * @param {...object} templates - Templates to chain (from base to most specific)
 * @returns {object} Final extended template
 */
export function createTemplateChain(...templates) {
  if (templates.length === 0) {
    throw new Error('At least one template is required');
  }

  let result = templates[0];

  for (let i = 1; i < templates.length; i++) {
    const extension = templates[i];

    // If extension is a plain object, use it as extensions
    if (extension.type === undefined) {
      result = extendTemplate(result, extension);
    } else {
      // If it's a template, extract its blocks and metadata
      result = extendTemplate(result, {
        blocks: extension.blocks,
        name: extension.name,
        metadata: extension.metadata,
      });
    }
  }

  return result;
}

/**
 * Create a template with multiple inheritance
 *
 * @param {Array<object>} parents - Parent templates to inherit from
 * @param {object} config - Template configuration
 * @returns {object} Template with multiple inheritance
 */
export function createMultiInheritanceTemplate(parents = [], config = {}) {
  if (!Array.isArray(parents) || parents.length === 0) {
    throw new Error('At least one parent template is required');
  }

  // Merge blocks from all parents (later parents override earlier ones)
  const mergedBlocks = {};
  const mergedMetadata = {};

  for (const parent of parents) {
    Object.assign(mergedBlocks, parent.blocks || {});
    Object.assign(mergedMetadata, parent.metadata || {});
  }

  // Apply config overrides
  Object.assign(mergedBlocks, config.blocks || {});
  Object.assign(mergedMetadata, config.metadata || {});

  const template = {
    type: 'multi-inheritance',
    name: config.name || 'multi-inherited',
    parents,
    blocks: mergedBlocks,
    metadata: mergedMetadata,

    /**
     * Render the template
     *
     * @param {object} overrides - Block overrides
     * @returns {string} Rendered HTML
     */
    render(overrides = {}) {
      const finalBlocks = { ...this.blocks, ...overrides };

      // Use first parent's compose method by default
      if (this.parents[0] && this.parents[0].compose) {
        return this.parents[0].compose.call(this, finalBlocks);
      }

      // Fallback to simple composition
      return Object.values(finalBlocks).join('\n');
    },

    /**
     * Get block from specific parent
     *
     * @param {string} blockName - Block name
     * @param {number} parentIndex - Parent index
     * @returns {string|undefined} Block content
     */
    getParentBlock(blockName, parentIndex = 0) {
      const parent = this.parents[parentIndex];
      return parent ? parent.blocks[blockName] : undefined;
    },

    /**
     * Get all parent names
     *
     * @returns {Array<string>} Array of parent template names
     */
    getParentNames() {
      return this.parents.map((p) => p.name || 'unnamed');
    },
  };

  // Copy compose method from config if provided
  if (config.compose && typeof config.compose === 'function') {
    template.compose = config.compose;
  } else if (parents[0] && parents[0].compose) {
    template.compose = parents[0].compose;
  }

  return template;
}

/**
 * Mixin pattern for adding functionality to templates
 *
 * @param {object} template - Template to enhance
 * @param {...object} mixins - Mixin objects with methods/properties
 * @returns {object} Enhanced template
 */
export function applyMixins(template, ...mixins) {
  const enhanced = { ...template };

  for (const mixin of mixins) {
    // Copy methods and properties (excluding blocks to avoid accidental override)
    for (const [key, value] of Object.entries(mixin)) {
      if (key !== 'blocks' && key !== 'render') {
        enhanced[key] = value;
      }
    }

    // Merge blocks if mixin has them
    if (mixin.blocks) {
      enhanced.blocks = { ...enhanced.blocks, ...mixin.blocks };
    }
  }

  return enhanced;
}

// Export utility functions for testing
export const __testUtils = {
  createTestTemplate: (config) => createBaseTemplate(config),
};
