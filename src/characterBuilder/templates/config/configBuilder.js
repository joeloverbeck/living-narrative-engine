/**
 * @file Fluent API for building template configurations
 * @module characterBuilder/templates/config/configBuilder
 */

import { ConfigValidator } from './configValidator.js';
import { InvalidConfigError } from '../errors/templateConfigurationError.js';

/**
 * Fluent API builder for template configurations
 * Provides a chainable interface for building complex configurations
 */
export class TemplateConfigBuilder {
  #config;
  #templateType;
  #validator;
  #validateOnBuild;

  /**
   * @param {object} [baseConfig] - Base configuration to start with
   * @param {string} [templateType] - Template type for validation
   * @param {boolean} [validateOnBuild] - Whether to validate on build (default: true)
   */
  constructor(baseConfig = {}, templateType = null, validateOnBuild = true) {
    this.#config = { ...baseConfig };
    this.#templateType = templateType;
    this.#validateOnBuild = validateOnBuild;
    
    if (validateOnBuild) {
      this.#validator = new ConfigValidator();
    }
  }

  /**
   * Set template type
   * 
   * @param {string} type - Template type
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  forTemplate(type) {
    this.#templateType = type;
    return this;
  }

  /**
   * Set layout configuration
   * 
   * @param {string} type - Layout type ('fluid', 'fixed', 'adaptive')
   * @param {object} [options] - Additional layout options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  layout(type, options = {}) {
    this.#config.layout = {
      type,
      ...options,
    };
    return this;
  }

  /**
   * Configure header
   * 
   * @param {object} options - Header options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  header(options) {
    this.#config.header = {
      ...this.#config.header,
      ...options,
    };
    return this;
  }

  /**
   * Configure footer
   * 
   * @param {object} options - Footer options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  footer(options) {
    this.#config.footer = {
      ...this.#config.footer,
      ...options,
    };
    return this;
  }

  /**
   * Configure panels
   * 
   * @param {string} layout - Panel layout ('single', 'dual', 'triple')
   * @param {object} [options] - Additional panel options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  panels(layout, options = {}) {
    this.#config.panels = {
      defaultLayout: layout,
      ...options,
    };
    return this;
  }

  /**
   * Configure modals
   * 
   * @param {object} options - Modal options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  modals(options) {
    this.#config.modals = {
      ...this.#config.modals,
      ...options,
    };
    return this;
  }

  /**
   * Set accessibility options
   * 
   * @param {object} options - Accessibility options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  accessibility(options) {
    this.#config.accessibility = {
      ...this.#config.accessibility,
      ...options,
    };
    return this;
  }

  /**
   * Set performance options
   * 
   * @param {object} options - Performance options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  performance(options) {
    this.#config.performance = {
      ...this.#config.performance,
      ...options,
    };
    return this;
  }

  /**
   * Set theme and styling
   * 
   * @param {string} themeName - Theme name
   * @param {object} [customStyles] - Custom style overrides
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  theme(themeName, customStyles = {}) {
    this.#config.styling = {
      ...this.#config.styling,
      theme: themeName,
      custom: customStyles,
    };
    return this;
  }

  /**
   * Enable/disable animations
   * 
   * @param {boolean} enabled - Whether animations are enabled
   * @param {object} [options] - Animation options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  animations(enabled, options = {}) {
    this.#config.styling = {
      ...this.#config.styling,
      animations: enabled,
      animationOptions: options,
    };
    return this;
  }

  /**
   * Enable/disable transitions
   * 
   * @param {boolean} enabled - Whether transitions are enabled
   * @param {number} [duration] - Transition duration in ms
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  transitions(enabled, duration = null) {
    this.#config.styling = {
      ...this.#config.styling,
      transitions: enabled,
    };
    
    if (duration !== null) {
      this.#config.styling.transitionDuration = duration;
    }
    
    return this;
  }

  /**
   * Set responsive breakpoints
   * 
   * @param {object} breakpoints - Breakpoint definitions
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  breakpoints(breakpoints) {
    this.#config.styling = {
      ...this.#config.styling,
      responsiveBreakpoints: breakpoints,
    };
    return this;
  }

  /**
   * Configure validation
   * 
   * @param {object} options - Validation options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  validation(options) {
    this.#config.validation = {
      ...this.#config.validation,
      ...options,
    };
    return this;
  }

  /**
   * Configure events
   * 
   * @param {object} options - Event options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  events(options) {
    this.#config.events = {
      ...this.#config.events,
      ...options,
    };
    return this;
  }

  /**
   * Configure forms
   * 
   * @param {object} options - Form options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  form(options) {
    this.#config.form = {
      ...this.#config.form,
      ...options,
    };
    return this;
  }

  /**
   * Configure buttons
   * 
   * @param {object} options - Button options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  button(options) {
    this.#config.button = {
      ...this.#config.button,
      ...options,
    };
    return this;
  }

  /**
   * Configure inputs
   * 
   * @param {object} options - Input options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  input(options) {
    this.#config.input = {
      ...this.#config.input,
      ...options,
    };
    return this;
  }

  /**
   * Configure lists/tables
   * 
   * @param {object} options - List options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  list(options) {
    this.#config.list = {
      ...this.#config.list,
      ...options,
    };
    return this;
  }

  /**
   * Configure notifications
   * 
   * @param {object} options - Notification options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  notification(options) {
    this.#config.notification = {
      ...this.#config.notification,
      ...options,
    };
    return this;
  }

  /**
   * Set debug options
   * 
   * @param {boolean} enabled - Whether debug is enabled
   * @param {object} [options] - Debug options
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  debug(enabled, options = {}) {
    this.#config.debug = {
      enabled,
      ...options,
    };
    return this;
  }

  /**
   * Set a custom property
   * 
   * @param {string} path - Property path (dot notation)
   * @param {*} value - Property value
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  set(path, value) {
    const parts = path.split('.');
    let current = this.#config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return this;
  }

  /**
   * Merge with another configuration
   * 
   * @param {object} config - Configuration to merge
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  merge(config) {
    this.#config = this.#deepMerge(this.#config, config);
    return this;
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
   * Reset configuration to empty
   * 
   * @returns {TemplateConfigBuilder} Builder instance for chaining
   */
  reset() {
    this.#config = {};
    return this;
  }

  /**
   * Build and return configuration
   * 
   * @returns {object} Built configuration
   * @throws {InvalidConfigError} If validation fails
   */
  build() {
    // Validate if enabled
    if (this.#validateOnBuild && this.#validator && this.#templateType) {
      const validation = this.#validator.validate(this.#config, this.#templateType);
      if (!validation.valid) {
        throw new InvalidConfigError(validation.errors, this.#templateType);
      }
    }
    
    // Return a copy to prevent external modifications
    return JSON.parse(JSON.stringify(this.#config));
  }

  /**
   * Get current configuration without building
   * 
   * @returns {object} Current configuration (reference)
   */
  peek() {
    return this.#config;
  }

  /**
   * Create builder from existing config
   * 
   * @param {object} config - Existing configuration
   * @param {string} [templateType] - Template type
   * @returns {TemplateConfigBuilder} New builder instance
   */
  static from(config, templateType = null) {
    return new TemplateConfigBuilder(config, templateType);
  }

  /**
   * Create builder for page template
   * 
   * @param {object} [baseConfig] - Base configuration
   * @returns {TemplateConfigBuilder} Builder for page template
   */
  static forPage(baseConfig = {}) {
    return new TemplateConfigBuilder(baseConfig, 'page');
  }

  /**
   * Create builder for panel template
   * 
   * @param {object} [baseConfig] - Base configuration
   * @returns {TemplateConfigBuilder} Builder for panel template
   */
  static forPanel(baseConfig = {}) {
    return new TemplateConfigBuilder(baseConfig, 'panel');
  }

  /**
   * Create builder for modal template
   * 
   * @param {object} [baseConfig] - Base configuration
   * @returns {TemplateConfigBuilder} Builder for modal template
   */
  static forModal(baseConfig = {}) {
    return new TemplateConfigBuilder(baseConfig, 'modal');
  }

  /**
   * Create builder for form template
   * 
   * @param {object} [baseConfig] - Base configuration
   * @returns {TemplateConfigBuilder} Builder for form template
   */
  static forForm(baseConfig = {}) {
    return new TemplateConfigBuilder(baseConfig, 'form');
  }

  /**
   * Create builder for button template
   * 
   * @param {object} [baseConfig] - Base configuration
   * @returns {TemplateConfigBuilder} Builder for button template
   */
  static forButton(baseConfig = {}) {
    return new TemplateConfigBuilder(baseConfig, 'button');
  }
}