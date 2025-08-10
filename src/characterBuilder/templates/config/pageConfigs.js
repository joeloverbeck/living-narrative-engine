/**
 * @file Page-specific template configurations
 * @module characterBuilder/templates/config/pageConfigs
 */

import { TemplateConfigBuilder } from './configBuilder.js';

/**
 * Registry for page-specific template configurations
 * Manages configurations for different character builder pages
 */
export class PageConfigRegistry {
  #configs;
  #builders;

  constructor() {
    this.#configs = new Map();
    this.#builders = new Map();
    this.#initializePageConfigs();
  }

  /**
   * Initialize page-specific configurations
   * 
   * @private
   */
  #initializePageConfigs() {
    // Thematic Direction Generator page
    this.#configs.set('thematic-direction-generator', {
      layout: {
        type: 'fluid',
        maxWidth: '1400px',
        padding: '20px',
        gap: '24px',
      },
      panels: {
        defaultLayout: 'dual',
        collapsible: true,
        resizable: true,
        leftPanel: {
          width: '40%',
          minWidth: '400px',
          maxWidth: '600px',
          heading: 'Character Concept',
        },
        rightPanel: {
          width: '60%',
          minWidth: '600px',
          heading: 'Generated Directions',
        },
      },
      header: {
        show: true,
        showTitle: true,
        showSubtitle: true,
        showActions: true,
        title: 'Thematic Direction Generator',
        subtitle: 'Create compelling character concepts',
      },
      modals: {
        deleteConfirmation: {
          size: 'small',
          centered: true,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          confirmVariant: 'danger',
        },
        saveConfirmation: {
          size: 'medium',
          centered: true,
          confirmText: 'Save',
          cancelText: 'Continue Editing',
        },
      },
      form: {
        validation: {
          immediate: false,
          onBlur: true,
          showErrors: true,
        },
        submission: {
          confirmBeforeSubmit: false,
          resetOnSuccess: false,
        },
      },
    });

    // Character Details Builder page
    this.#configs.set('character-details-builder', {
      layout: {
        type: 'fixed',
        maxWidth: '1200px',
        padding: '24px',
      },
      panels: {
        defaultLayout: 'single',
        collapsible: false,
        mainPanel: {
          width: '100%',
          sections: ['basics', 'appearance', 'personality', 'background'],
          tabbed: true,
        },
      },
      header: {
        show: true,
        showTitle: true,
        showActions: true,
        title: 'Character Details Builder',
        subtitle: 'Define your character comprehensively',
      },
      form: {
        validation: {
          immediate: true,
          onBlur: true,
          onSubmit: true,
        },
        layout: {
          labelPosition: 'top',
          fieldSpacing: '20px',
          groupSpacing: '30px',
        },
        autosave: {
          enabled: true,
          interval: 30000, // 30 seconds
          showIndicator: true,
        },
      },
      notifications: {
        position: 'top-right',
        duration: 3000,
      },
    });

    // Character Relationship Manager page
    this.#configs.set('character-relationship-manager', {
      layout: {
        type: 'fluid',
        maxWidth: '1600px',
        padding: '16px',
      },
      panels: {
        defaultLayout: 'triple',
        leftPanel: {
          width: '25%',
          minWidth: '300px',
          heading: 'Characters',
        },
        centerPanel: {
          width: '50%',
          minWidth: '500px',
          heading: 'Relationship Details',
        },
        rightPanel: {
          width: '25%',
          minWidth: '300px',
          heading: 'History & Notes',
        },
      },
      header: {
        show: true,
        title: 'Relationship Manager',
        subtitle: 'Map character connections and interactions',
      },
      list: {
        virtualScroll: {
          enabled: true,
          threshold: 50,
        },
        selection: {
          enabled: true,
          multiple: true,
        },
      },
    });

    // Character Gallery page
    this.#configs.set('character-gallery', {
      layout: {
        type: 'fluid',
        maxWidth: '100%',
        padding: '20px',
      },
      panels: {
        defaultLayout: 'grid',
        gridColumns: 'auto-fill',
        gridMinWidth: '280px',
        gridGap: '20px',
      },
      header: {
        show: true,
        title: 'Character Gallery',
        showSearch: true,
        showFilters: true,
        showViewToggle: true,
      },
      list: {
        pagination: {
          enabled: true,
          pageSize: 24,
          pageSizes: [12, 24, 48, 96],
        },
        virtualScroll: {
          enabled: false, // Grid view doesn't need virtual scroll
        },
      },
      cards: {
        hover: {
          scale: 1.05,
          shadow: true,
        },
        lazyLoadImages: true,
      },
    });

    // Character Import/Export page
    this.#configs.set('character-import-export', {
      layout: {
        type: 'fixed',
        maxWidth: '900px',
        padding: '24px',
        centerContent: true,
      },
      panels: {
        defaultLayout: 'single',
        mainPanel: {
          width: '100%',
        },
      },
      header: {
        show: true,
        title: 'Import & Export Characters',
        subtitle: 'Transfer characters between games',
      },
      form: {
        submission: {
          showProgress: true,
          disableOnSubmit: true,
        },
      },
      dropzone: {
        enabled: true,
        acceptedFormats: ['.json', '.xml', '.csv'],
        maxFileSize: 10485760, // 10MB
        multiple: true,
      },
    });

    // Character Comparison page
    this.#configs.set('character-comparison', {
      layout: {
        type: 'fluid',
        maxWidth: '1400px',
        padding: '20px',
      },
      panels: {
        defaultLayout: 'split',
        resizable: true,
        syncScroll: true,
        leftPanel: {
          width: '50%',
          heading: 'Character A',
        },
        rightPanel: {
          width: '50%',
          heading: 'Character B',
        },
      },
      header: {
        show: true,
        title: 'Character Comparison',
        showSwapButton: true,
      },
      comparison: {
        highlightDifferences: true,
        showSimilarityScore: true,
        allowMultiple: false, // Can upgrade to compare more than 2
      },
    });

    // Settings page
    this.#configs.set('character-builder-settings', {
      layout: {
        type: 'fixed',
        maxWidth: '800px',
        padding: '24px',
        centerContent: true,
      },
      panels: {
        defaultLayout: 'single',
        sections: ['general', 'appearance', 'behavior', 'advanced'],
        accordion: true,
      },
      header: {
        show: true,
        title: 'Character Builder Settings',
      },
      form: {
        submission: {
          confirmBeforeSubmit: true,
          confirmText: 'Save Settings',
        },
      },
    });
  }

  /**
   * Get configuration for a specific page
   * 
   * @param {string} pageName - Page identifier
   * @returns {object} Page configuration or empty object
   */
  getPageConfig(pageName) {
    return this.#configs.get(pageName) || {};
  }

  /**
   * Register custom page configuration
   * 
   * @param {string} pageName - Page identifier
   * @param {object} config - Page configuration
   */
  registerPageConfig(pageName, config) {
    this.#configs.set(pageName, config);
  }

  /**
   * Update existing page configuration
   * 
   * @param {string} pageName - Page identifier
   * @param {object} updates - Configuration updates
   */
  updatePageConfig(pageName, updates) {
    const existing = this.#configs.get(pageName) || {};
    const merged = this.#deepMerge(existing, updates);
    this.#configs.set(pageName, merged);
  }

  /**
   * Remove page configuration
   * 
   * @param {string} pageName - Page identifier
   * @returns {boolean} True if removed
   */
  removePageConfig(pageName) {
    return this.#configs.delete(pageName);
  }

  /**
   * Check if page configuration exists
   * 
   * @param {string} pageName - Page identifier
   * @returns {boolean} True if exists
   */
  hasPageConfig(pageName) {
    return this.#configs.has(pageName);
  }

  /**
   * Get all registered page names
   * 
   * @returns {string[]} Array of page names
   */
  getRegisteredPages() {
    return Array.from(this.#configs.keys());
  }

  /**
   * Create configuration builder for a page
   * 
   * @param {string} pageName - Page identifier
   * @returns {TemplateConfigBuilder} Configuration builder
   */
  createBuilder(pageName) {
    const baseConfig = this.getPageConfig(pageName);
    const builder = TemplateConfigBuilder.forPage(baseConfig);
    
    // Cache the builder
    this.#builders.set(pageName, builder);
    
    return builder;
  }

  /**
   * Get cached builder for a page
   * 
   * @param {string} pageName - Page identifier
   * @returns {TemplateConfigBuilder|null} Cached builder or null
   */
  getBuilder(pageName) {
    return this.#builders.get(pageName) || null;
  }

  /**
   * Apply theme to all pages
   * 
   * @param {string} themeName - Theme name
   */
  applyThemeToAll(themeName) {
    for (const [, config] of this.#configs.entries()) {
      if (!config.styling) {
        config.styling = {};
      }
      config.styling.theme = themeName;
    }
  }

  /**
   * Export all configurations
   * 
   * @returns {object} All page configurations
   */
  exportAll() {
    const exported = {};
    for (const [pageName, config] of this.#configs.entries()) {
      exported[pageName] = { ...config };
    }
    return exported;
  }

  /**
   * Import configurations
   * 
   * @param {object} configs - Configurations to import
   * @param {boolean} [replace] - Replace existing configs (default: false)
   */
  importConfigs(configs, replace = false) {
    if (replace) {
      this.#configs.clear();
    }
    
    for (const [pageName, config] of Object.entries(configs)) {
      this.#configs.set(pageName, config);
    }
  }

  /**
   * Deep merge helper
   * 
   * @private
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  #deepMerge(target, source) {
    const output = { ...target };
    
    Object.keys(source).forEach((key) => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.#deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });
    
    return output;
  }

  /**
   * Clear all configurations
   */
  clear() {
    this.#configs.clear();
    this.#builders.clear();
  }

  /**
   * Get configuration statistics
   * 
   * @returns {object} Statistics
   */
  getStats() {
    return {
      pageCount: this.#configs.size,
      pages: this.getRegisteredPages(),
      cachedBuilders: this.#builders.size,
    };
  }
}