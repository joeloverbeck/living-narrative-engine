# HTMLTEMP-009: Create Template Configuration System

**⚠️ SPECIFICATION DOCUMENT - NOT YET IMPLEMENTED ⚠️**

This workflow describes a planned feature that has not been implemented. All file paths, classes, and code examples below are specifications for future development, not documentation of existing functionality.

## Current State

The template system currently uses direct parameter passing for configuration. Templates receive configuration through:

- Direct object parameters in template function calls
- Simple property passing in the `EnhancedTemplateComposer`
- No formal configuration management system exists

## Summary

Implement a comprehensive template configuration system that provides default settings, override mechanisms, inheritance patterns, and environment-specific configurations for the HTML template system. This system will enable consistent template behavior while allowing flexibility for page-specific customizations.

## Status

- **Type**: Specification (NOT IMPLEMENTED)
- **Priority**: Medium
- **Complexity**: Medium
- **Estimated Time**: 3 hours
- **Dependencies**:
  - HTMLTEMP-007 (Template Composition Engine) - ✅ IMPLEMENTED
  - HTMLTEMP-008 (Data Binding Support) - ❌ NOT IMPLEMENTED
- **Implementation Status**: ❌ NOT STARTED

## Objectives

### Primary Goals

1. **Default Configuration Management** - Establish sensible defaults for all templates
2. **Override Mechanisms** - Enable multiple levels of configuration overrides
3. **Configuration Inheritance** - Support hierarchical configuration inheritance
4. **Environment-Specific Settings** - Different configurations for dev/staging/production
5. **Runtime Configuration** - Allow dynamic configuration changes
6. **Configuration Validation** - Ensure configurations are valid and complete

### Success Criteria

- [ ] Default configurations cover all template types
- [ ] Override system supports at least 4 levels of precedence
- [ ] Configuration changes require no code modifications
- [ ] Environment detection is automatic and reliable
- [ ] Configuration loading time < 5ms
- [ ] Invalid configurations are detected and reported clearly
- [ ] Configuration merging preserves type safety

## Technical Specification

### 1. Configuration Manager Core

#### File: `src/characterBuilder/templates/utilities/templateConfigManager.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Template Configuration Manager
 * Handles default configs, overrides, and environment-specific settings
 */
export class TemplateConfigManager {
  /**
   * @param {object} options - Manager options
   * @param {object} options.defaults - Default configurations
   * @param {string} options.environment - Current environment
   * @param {ConfigValidator} options.validator - Configuration validator
   */
  constructor({ defaults = {}, environment = 'development', validator }) {
    this.#defaults = this.#deepFreeze(defaults);
    this.#environment = environment;
    this.#validator = validator;
    this.#configs = new Map();
    this.#overrides = new Map();
    this.#cache = new Map();

    // Configuration precedence levels (highest to lowest)
    this.#precedenceLevels = [
      'runtime', // Runtime overrides (highest priority)
      'page', // Page-specific configuration
      'environment', // Environment-specific (dev/staging/prod)
      'global', // Global overrides
      'default', // Default configuration (lowest priority)
    ];
  }

  /**
   * Get merged configuration for a template
   * @param {string} templateId - Template identifier
   * @param {object} runtimeOverrides - Runtime-specific overrides
   * @returns {object} Merged configuration
   */
  getConfig(templateId, runtimeOverrides = {}) {
    // Check cache
    const cacheKey = this.#generateCacheKey(templateId, runtimeOverrides);
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    // Build configuration chain
    const configChain = this.#buildConfigChain(templateId);

    // Add runtime overrides to chain
    if (Object.keys(runtimeOverrides).length > 0) {
      configChain.unshift({ level: 'runtime', config: runtimeOverrides });
    }

    // Merge configurations
    const merged = this.#mergeConfigs(configChain);

    // Validate merged configuration
    if (this.#validator) {
      const validation = this.#validator.validate(merged, templateId);
      if (!validation.valid) {
        throw new ConfigurationError(
          `Invalid configuration for template "${templateId}": ${validation.errors.join(', ')}`
        );
      }
    }

    // Cache and return
    this.#cache.set(cacheKey, merged);
    return merged;
  }

  /**
   * Set configuration for a specific level
   * @param {string} level - Configuration level
   * @param {string} templateId - Template identifier
   * @param {object} config - Configuration object
   */
  setConfig(level, templateId, config) {
    if (!this.#precedenceLevels.includes(level)) {
      throw new Error(`Invalid configuration level: ${level}`);
    }

    const key = `${level}:${templateId}`;
    this.#configs.set(key, config);

    // Invalidate cache for this template
    this.#invalidateCache(templateId);
  }

  /**
   * Register global override
   * @param {string} path - Configuration path (dot notation)
   * @param {*} value - Override value
   */
  setGlobalOverride(path, value) {
    this.#overrides.set(path, value);
    this.#cache.clear(); // Clear all cache
  }

  /**
   * Build configuration chain for merging
   * @private
   */
  #buildConfigChain(templateId) {
    const chain = [];

    // Add configurations in precedence order
    this.#precedenceLevels.forEach((level) => {
      const key = `${level}:${templateId}`;

      if (level === 'default') {
        // Get default config for template type
        const templateType = this.#getTemplateType(templateId);
        const defaultConfig =
          this.#defaults[templateType] || this.#defaults.common || {};
        chain.push({ level, config: defaultConfig });
      } else if (level === 'environment') {
        // Get environment-specific config
        const envKey = `${this.#environment}:${templateId}`;
        if (this.#configs.has(envKey)) {
          chain.push({ level, config: this.#configs.get(envKey) });
        }
      } else if (this.#configs.has(key)) {
        chain.push({ level, config: this.#configs.get(key) });
      }
    });

    return chain.reverse(); // Reverse to merge from lowest to highest precedence
  }

  /**
   * Merge configuration chain
   * @private
   */
  #mergeConfigs(configChain) {
    let merged = {};

    configChain.forEach(({ config }) => {
      merged = this.#deepMerge(merged, config);
    });

    // Apply global overrides
    this.#overrides.forEach((value, path) => {
      this.#setNestedProperty(merged, path, value);
    });

    return merged;
  }

  /**
   * Deep merge two objects
   * @private
   */
  #deepMerge(target, source) {
    const output = { ...target };

    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        output[key] = this.#deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  /**
   * Deep freeze object to prevent mutations
   * @private
   */
  #deepFreeze(obj) {
    Object.freeze(obj);
    Object.values(obj).forEach((value) => {
      if (typeof value === 'object' && value !== null) {
        this.#deepFreeze(value);
      }
    });
    return obj;
  }
}
```

### 2. Default Configuration Definitions

#### File: `src/characterBuilder/templates/config/defaultConfigs.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Default template configurations
 */
export const DEFAULT_TEMPLATE_CONFIGS = {
  // Common configuration for all templates
  common: {
    accessibility: {
      enabled: true,
      ariaLive: 'polite',
      announceChanges: true,
      keyboardNavigation: true,
    },
    performance: {
      lazyLoad: true,
      cacheTimeout: 3600000, // 1 hour
      maxRenderTime: 10, // ms
      virtualScrollThreshold: 100,
    },
    styling: {
      theme: 'default',
      animations: true,
      transitions: true,
      responsiveBreakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        wide: 1440,
      },
    },
    validation: {
      strict: false,
      warnOnMissingData: true,
      throwOnError: false,
    },
    events: {
      delegation: true,
      throttle: {
        scroll: 100,
        resize: 200,
        input: 300,
      },
      preventDefaultOn: ['submit'],
    },
  },

  // Page template specific
  page: {
    layout: {
      type: 'fluid', // 'fluid' | 'fixed' | 'adaptive'
      maxWidth: '1200px',
      padding: '20px',
      gap: '20px',
    },
    header: {
      show: true,
      sticky: false,
      height: 'auto',
      showTitle: true,
      showSubtitle: true,
      showActions: true,
    },
    footer: {
      show: true,
      sticky: false,
      showVersion: true,
      showLinks: true,
      copyrightText: '© 2025 Living Narrative Engine',
    },
    panels: {
      defaultLayout: 'dual', // 'single' | 'dual' | 'triple'
      collapsible: true,
      resizable: false,
      minWidth: '300px',
      maxWidth: '800px',
    },
    modals: {
      backdrop: true,
      closeOnEscape: true,
      closeOnBackdropClick: false,
      animation: 'fade',
      centered: true,
    },
  },

  // Component-specific configurations
  panel: {
    appearance: {
      border: true,
      shadow: true,
      borderRadius: '4px',
      backgroundColor: 'var(--panel-bg)',
    },
    header: {
      show: true,
      collapsible: false,
      actions: true,
    },
    content: {
      padding: '15px',
      scrollable: true,
      maxHeight: 'none',
    },
    states: {
      loading: {
        showSpinner: true,
        message: 'Loading...',
      },
      empty: {
        showMessage: true,
        message: 'No content available',
        icon: true,
      },
      error: {
        showMessage: true,
        allowRetry: true,
      },
    },
  },

  form: {
    validation: {
      immediate: false,
      onBlur: true,
      onSubmit: true,
      showErrors: true,
    },
    layout: {
      labelPosition: 'top', // 'top' | 'left' | 'inline'
      requiredIndicator: '*',
      helpPosition: 'below',
    },
    submission: {
      preventDefault: true,
      disableOnSubmit: true,
      showProgress: true,
      resetOnSuccess: false,
    },
  },

  button: {
    appearance: {
      variant: 'primary', // 'primary' | 'secondary' | 'tertiary'
      size: 'medium', // 'small' | 'medium' | 'large'
      fullWidth: false,
    },
    behavior: {
      rippleEffect: true,
      preventDoubleClick: true,
      loadingState: true,
    },
  },

  modal: {
    size: 'medium', // 'small' | 'medium' | 'large' | 'fullscreen'
    position: 'center', // 'center' | 'top' | 'bottom'
    overlay: {
      opacity: 0.5,
      blur: false,
    },
    animation: {
      type: 'fade', // 'fade' | 'slide' | 'zoom'
      duration: 200,
    },
    actions: {
      showClose: true,
      confirmText: 'OK',
      cancelText: 'Cancel',
    },
  },
};
```

### 3. Environment Configuration Loader

#### File: `src/characterBuilder/templates/config/environmentConfig.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Environment-specific configuration loader
 */
export class EnvironmentConfigLoader {
  constructor() {
    this.#environment = this.#detectEnvironment();
    this.#configs = new Map();
    this.#loadEnvironmentConfigs();
  }

  /**
   * Detect current environment
   * @private
   */
  #detectEnvironment() {
    // Check various environment indicators
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      } else if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      } else {
        return 'production';
      }
    }

    // Fallback to Node environment variable
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Load environment-specific configurations
   * @private
   */
  #loadEnvironmentConfigs() {
    // Development environment
    this.#configs.set('development', {
      performance: {
        cacheTimeout: 0, // No caching in dev
        lazyLoad: false, // Load everything immediately
      },
      validation: {
        strict: true,
        warnOnMissingData: true,
        throwOnError: true,
      },
      debugging: {
        enabled: true,
        logLevel: 'debug',
        showPerformanceMetrics: true,
        highlightUpdates: true,
      },
      styling: {
        animations: true,
        transitions: true,
      },
    });

    // Staging environment
    this.#configs.set('staging', {
      performance: {
        cacheTimeout: 1800000, // 30 minutes
        lazyLoad: true,
      },
      validation: {
        strict: true,
        warnOnMissingData: true,
        throwOnError: false,
      },
      debugging: {
        enabled: true,
        logLevel: 'info',
        showPerformanceMetrics: false,
        highlightUpdates: false,
      },
    });

    // Production environment
    this.#configs.set('production', {
      performance: {
        cacheTimeout: 3600000, // 1 hour
        lazyLoad: true,
      },
      validation: {
        strict: false,
        warnOnMissingData: false,
        throwOnError: false,
      },
      debugging: {
        enabled: false,
        logLevel: 'error',
        showPerformanceMetrics: false,
        highlightUpdates: false,
      },
      styling: {
        animations: true,
        transitions: true,
      },
      security: {
        sanitizeAll: true,
        cspEnabled: true,
      },
    });
  }

  /**
   * Get configuration for current environment
   */
  getConfig() {
    return this.#configs.get(this.#environment) || {};
  }

  /**
   * Get current environment name
   */
  getEnvironment() {
    return this.#environment;
  }

  /**
   * Override environment (for testing)
   */
  setEnvironment(env) {
    if (this.#configs.has(env)) {
      this.#environment = env;
    } else {
      throw new Error(`Unknown environment: ${env}`);
    }
  }
}
```

### 4. Configuration Schema and Validator

#### File: `src/characterBuilder/templates/config/configValidator.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Configuration validator using schema definitions
 */
export class ConfigValidator {
  constructor() {
    this.#schemas = new Map();
    this.#initializeSchemas();
  }

  /**
   * Initialize validation schemas
   * @private
   */
  #initializeSchemas() {
    // Page template schema
    this.#schemas.set('page', {
      type: 'object',
      properties: {
        layout: {
          type: 'object',
          properties: {
            type: { enum: ['fluid', 'fixed', 'adaptive'] },
            maxWidth: { type: 'string', pattern: '^\\d+(px|%|em|rem)$' },
            padding: { type: 'string' },
            gap: { type: 'string' },
          },
        },
        header: {
          type: 'object',
          properties: {
            show: { type: 'boolean' },
            sticky: { type: 'boolean' },
            height: { type: 'string' },
            showTitle: { type: 'boolean' },
            showSubtitle: { type: 'boolean' },
            showActions: { type: 'boolean' },
          },
        },
        footer: {
          type: 'object',
          properties: {
            show: { type: 'boolean' },
            sticky: { type: 'boolean' },
            showVersion: { type: 'boolean' },
            showLinks: { type: 'boolean' },
            copyrightText: { type: 'string' },
          },
        },
        panels: {
          type: 'object',
          properties: {
            defaultLayout: { enum: ['single', 'dual', 'triple'] },
            collapsible: { type: 'boolean' },
            resizable: { type: 'boolean' },
            minWidth: { type: 'string' },
            maxWidth: { type: 'string' },
          },
        },
      },
    });

    // Panel component schema
    this.#schemas.set('panel', {
      type: 'object',
      properties: {
        appearance: {
          type: 'object',
          properties: {
            border: { type: 'boolean' },
            shadow: { type: 'boolean' },
            borderRadius: { type: 'string' },
            backgroundColor: { type: 'string' },
          },
        },
        header: {
          type: 'object',
          properties: {
            show: { type: 'boolean' },
            collapsible: { type: 'boolean' },
            actions: { type: 'boolean' },
          },
        },
        content: {
          type: 'object',
          properties: {
            padding: { type: 'string' },
            scrollable: { type: 'boolean' },
            maxHeight: { type: 'string' },
          },
        },
      },
    });

    // Add more schemas for other template types...
  }

  /**
   * Validate configuration against schema
   * @param {object} config - Configuration to validate
   * @param {string} templateType - Template type
   * @returns {object} Validation result
   */
  validate(config, templateType) {
    const schema = this.#schemas.get(templateType);

    if (!schema) {
      // No schema defined, consider valid
      return { valid: true, errors: [] };
    }

    const errors = [];
    this.#validateObject(config, schema, '', errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursively validate object against schema
   * @private
   */
  #validateObject(obj, schema, path, errors) {
    if (!obj || typeof obj !== 'object') {
      if (schema.required) {
        errors.push(`${path} is required`);
      }
      return;
    }

    // Check type
    if (schema.type && typeof obj !== schema.type) {
      errors.push(`${path} must be of type ${schema.type}`);
      return;
    }

    // Check enum values
    if (schema.enum && !schema.enum.includes(obj)) {
      errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
      return;
    }

    // Check pattern
    if (schema.pattern && typeof obj === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(obj)) {
        errors.push(`${path} does not match pattern ${schema.pattern}`);
      }
    }

    // Validate properties
    if (schema.properties) {
      Object.keys(schema.properties).forEach((key) => {
        const propPath = path ? `${path}.${key}` : key;
        const propSchema = schema.properties[key];
        const propValue = obj[key];

        if (propValue !== undefined) {
          this.#validateObject(propValue, propSchema, propPath, errors);
        } else if (propSchema.required) {
          errors.push(`${propPath} is required`);
        }
      });
    }

    // Check for unknown properties
    if (schema.additionalProperties === false) {
      Object.keys(obj).forEach((key) => {
        if (!schema.properties || !schema.properties[key]) {
          errors.push(`${path}.${key} is not a valid property`);
        }
      });
    }
  }
}
```

### 5. Configuration Builder (Fluent API)

#### File: `src/characterBuilder/templates/config/configBuilder.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Fluent API for building template configurations
 */
export class TemplateConfigBuilder {
  constructor(baseConfig = {}) {
    this.#config = { ...baseConfig };
  }

  /**
   * Set layout configuration
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
   */
  panels(layout, options = {}) {
    this.#config.panels = {
      defaultLayout: layout,
      ...options,
    };
    return this;
  }

  /**
   * Set accessibility options
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
   */
  performance(options) {
    this.#config.performance = {
      ...this.#config.performance,
      ...options,
    };
    return this;
  }

  /**
   * Set theme
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
   * Set responsive breakpoints
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
   */
  validation(options) {
    this.#config.validation = {
      ...this.#config.validation,
      ...options,
    };
    return this;
  }

  /**
   * Build and return configuration
   */
  build() {
    return { ...this.#config };
  }

  /**
   * Create from existing config
   */
  static from(config) {
    return new TemplateConfigBuilder(config);
  }
}
```

### 6. Page-Specific Configuration

#### File: `src/characterBuilder/templates/config/pageConfigs.js` (TO BE CREATED)

```javascript
/**
 * PROPOSED IMPLEMENTATION - NOT YET CREATED
 * Page-specific template configurations
 */
export class PageConfigRegistry {
  constructor() {
    this.#configs = new Map();
    this.#initializePageConfigs();
  }

  /**
   * Initialize page-specific configurations
   * @private
   */
  #initializePageConfigs() {
    // Thematic Direction Generator page
    this.#configs.set('thematic-direction-generator', {
      layout: {
        type: 'fluid',
        maxWidth: '1400px',
      },
      panels: {
        defaultLayout: 'dual',
        leftPanel: {
          width: '40%',
          minWidth: '400px',
          heading: 'Character Concept',
        },
        rightPanel: {
          width: '60%',
          minWidth: '600px',
          heading: 'Generated Directions',
        },
      },
      modals: {
        deleteConfirmation: {
          size: 'small',
          centered: true,
          confirmText: 'Delete',
          confirmStyle: 'danger',
        },
      },
    });

    // Character Details Builder page
    this.#configs.set('character-details-builder', {
      layout: {
        type: 'fixed',
        maxWidth: '1200px',
      },
      panels: {
        defaultLayout: 'single',
        mainPanel: {
          width: '100%',
          sections: ['basics', 'appearance', 'personality', 'background'],
        },
      },
      form: {
        validation: {
          immediate: true,
          onBlur: true,
        },
        autosave: {
          enabled: true,
          interval: 30000, // 30 seconds
        },
      },
    });

    // Add more page-specific configs...
  }

  /**
   * Get configuration for a specific page
   */
  getPageConfig(pageName) {
    return this.#configs.get(pageName) || {};
  }

  /**
   * Register custom page configuration
   */
  registerPageConfig(pageName, config) {
    this.#configs.set(pageName, config);
  }
}
```

## Implementation Tasks

### Phase 1: Core Configuration System (1 hour)

1. **Create TemplateConfigManager**
   - [ ] ❌ NOT STARTED - Implement configuration precedence system
   - [ ] ❌ NOT STARTED - Add configuration merging logic
   - [ ] ❌ NOT STARTED - Build caching mechanism
   - [ ] ❌ NOT STARTED - Create override methods

2. **Implement default configurations**
   - [ ] ❌ NOT STARTED - Define common defaults
   - [ ] ❌ NOT STARTED - Create template-specific defaults
   - [ ] ❌ NOT STARTED - Set up component defaults
   - [ ] ❌ NOT STARTED - Document all options

3. **Build configuration utilities**
   - [ ] ❌ NOT STARTED - Deep merge function
   - [ ] ❌ NOT STARTED - Deep freeze for immutability
   - [ ] ❌ NOT STARTED - Path-based property setter
   - [ ] ❌ NOT STARTED - Cache key generation

### Phase 2: Environment Support (45 minutes)

1. **Create EnvironmentConfigLoader**
   - [ ] ❌ NOT STARTED - Implement environment detection
   - [ ] ❌ NOT STARTED - Define environment-specific configs
   - [ ] ❌ NOT STARTED - Add override mechanism
   - [ ] ❌ NOT STARTED - Support testing environments

2. **Configure for each environment**
   - [ ] ❌ NOT STARTED - Development settings
   - [ ] ❌ NOT STARTED - Staging settings
   - [ ] ❌ NOT STARTED - Production settings
   - [ ] ❌ NOT STARTED - Test environment settings

### Phase 3: Validation System (45 minutes)

1. **Implement ConfigValidator**
   - [ ] ❌ NOT STARTED - Create validation schemas
   - [ ] ❌ NOT STARTED - Build validation engine
   - [ ] ❌ NOT STARTED - Add error reporting
   - [ ] ❌ NOT STARTED - Support custom validators

2. **Define schemas for all templates**
   - [ ] ❌ NOT STARTED - Page template schema
   - [ ] ❌ NOT STARTED - Component schemas
   - [ ] ❌ NOT STARTED - Form schemas
   - [ ] ❌ NOT STARTED - Modal schemas

### Phase 4: Builder API and Integration (30 minutes)

1. **Create TemplateConfigBuilder**
   - [ ] ❌ NOT STARTED - Implement fluent API methods
   - [ ] ❌ NOT STARTED - Add validation on build
   - [ ] ❌ NOT STARTED - Support config inheritance
   - [ ] ❌ NOT STARTED - Create factory methods

2. **Integrate with template system**
   - [ ] ❌ NOT STARTED - Update TemplateRenderer
   - [ ] ❌ NOT STARTED - Modify TemplateComposer
   - [ ] ❌ NOT STARTED - Update controllers
   - [ ] ❌ NOT STARTED - Add to bootstrap process

## Code Examples

### Example 1: Basic Configuration Usage (PROPOSED)

```javascript
// HYPOTHETICAL USAGE - NOT YET IMPLEMENTED
// Initialize configuration manager
const configManager = new TemplateConfigManager({
  defaults: DEFAULT_TEMPLATE_CONFIGS,
  environment: 'development',
  validator: new ConfigValidator(),
});

// Get configuration for a page template
const pageConfig = configManager.getConfig('page');

// Get configuration with runtime overrides
const customPageConfig = configManager.getConfig('page', {
  header: {
    sticky: true,
    height: '80px',
  },
  panels: {
    defaultLayout: 'single',
  },
});

// Use configuration in template
const template = createPageTemplate(customPageConfig);
```

### Example 2: Page-Specific Configuration (PROPOSED)

```javascript
// HYPOTHETICAL USAGE - NOT YET IMPLEMENTED
// Register page-specific configuration
configManager.setConfig('page', 'thematic-direction-generator', {
  layout: {
    type: 'fluid',
    maxWidth: '1400px',
  },
  panels: {
    defaultLayout: 'dual',
    leftPanel: {
      width: '40%',
      heading: 'Character Concept',
    },
    rightPanel: {
      width: '60%',
      heading: 'Generated Directions',
    },
  },
});

// Controller uses page-specific config
class ThematicDirectionController extends BaseCharacterBuilderController {
  async initialize() {
    const config = this.configManager.getConfig('page', {
      pageName: 'thematic-direction-generator',
    });

    const template = this.createPageTemplate(config);
    this.renderTemplate(template);
  }
}
```

### Example 3: Configuration Builder Usage (PROPOSED)

```javascript
// HYPOTHETICAL USAGE - NOT YET IMPLEMENTED
// Build configuration using fluent API
const config = new TemplateConfigBuilder()
  .layout('fluid', { maxWidth: '1200px' })
  .header({
    sticky: true,
    showActions: true,
  })
  .panels('dual', {
    collapsible: true,
    resizable: true,
  })
  .theme('dark', {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
  })
  .animations(true, {
    duration: 200,
    easing: 'ease-in-out',
  })
  .accessibility({
    keyboardNavigation: true,
    announceChanges: true,
  })
  .build();

// Use built configuration
const template = createPageTemplate(config);
```

### Example 4: Environment-Specific Configuration (PROPOSED)

```javascript
// HYPOTHETICAL USAGE - NOT YET IMPLEMENTED
// Environment detection and configuration
const envLoader = new EnvironmentConfigLoader();
const currentEnv = envLoader.getEnvironment(); // 'development'

// Get environment-specific config
const envConfig = envLoader.getConfig();

// Merge with template config
const finalConfig = configManager.getConfig('page', envConfig);

// Different behavior based on environment
if (currentEnv === 'development') {
  // Enable debugging features
  template.enableDebugMode();
} else if (currentEnv === 'production') {
  // Enable performance optimizations
  template.enableOptimizations();
}
```

## Testing Requirements

### Unit Tests

```javascript
describe('TemplateConfigManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new TemplateConfigManager({
      defaults: DEFAULT_TEMPLATE_CONFIGS,
      validator: new ConfigValidator(),
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configurations in correct precedence order', () => {
      // Set configs at different levels
      configManager.setConfig('global', 'page', { header: { show: false } });
      configManager.setConfig('page', 'test-page', {
        header: { sticky: true },
      });

      const config = configManager.getConfig('test-page', {
        header: { height: '100px' },
      });

      expect(config.header.show).toBe(false); // From global
      expect(config.header.sticky).toBe(true); // From page
      expect(config.header.height).toBe('100px'); // From runtime
    });

    it('should preserve deep nested properties', () => {
      const config = configManager.getConfig('page', {
        panels: {
          leftPanel: {
            width: '50%',
          },
        },
      });

      expect(config.panels.defaultLayout).toBeDefined(); // From defaults
      expect(config.panels.leftPanel.width).toBe('50%'); // From override
    });
  });

  describe('Validation', () => {
    it('should validate configuration against schema', () => {
      expect(() => {
        configManager.getConfig('page', {
          layout: {
            type: 'invalid-type', // Should fail enum validation
          },
        });
      }).toThrow(ConfigurationError);
    });

    it('should allow valid configurations', () => {
      expect(() => {
        configManager.getConfig('page', {
          layout: {
            type: 'fluid',
            maxWidth: '1200px',
          },
        });
      }).not.toThrow();
    });
  });

  describe('Caching', () => {
    it('should cache merged configurations', () => {
      const spy = jest.spyOn(configManager, '#mergeConfigs');

      // First call
      configManager.getConfig('page');
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      configManager.getConfig('page');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on config change', () => {
      configManager.getConfig('page');

      // Change config
      configManager.setConfig('global', 'page', { header: { show: false } });

      const config = configManager.getConfig('page');
      expect(config.header.show).toBe(false);
    });
  });
});

describe('EnvironmentConfigLoader', () => {
  it('should detect development environment', () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
    });

    const loader = new EnvironmentConfigLoader();
    expect(loader.getEnvironment()).toBe('development');
  });

  it('should detect production environment', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'app.example.com' },
    });

    const loader = new EnvironmentConfigLoader();
    expect(loader.getEnvironment()).toBe('production');
  });
});

describe('TemplateConfigBuilder', () => {
  it('should build configuration using fluent API', () => {
    const config = new TemplateConfigBuilder()
      .layout('fluid')
      .header({ sticky: true })
      .panels('dual')
      .theme('dark')
      .build();

    expect(config.layout.type).toBe('fluid');
    expect(config.header.sticky).toBe(true);
    expect(config.panels.defaultLayout).toBe('dual');
    expect(config.styling.theme).toBe('dark');
  });
});
```

### Performance Tests

```javascript
describe('Configuration Performance', () => {
  it('should load configuration in < 5ms', () => {
    const configManager = new TemplateConfigManager({
      defaults: DEFAULT_TEMPLATE_CONFIGS,
    });

    const start = performance.now();
    configManager.getConfig('page');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should handle deep merging efficiently', () => {
    const deepConfig = createDeeplyNestedConfig(10); // 10 levels deep

    const start = performance.now();
    const merged = deepMerge({}, deepConfig);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });
});
```

## Integration Points

### 1. Integration with Templates

```javascript
// Templates use configuration during rendering
export function createPageTemplate(config = {}) {
  // Get merged configuration
  const finalConfig = configManager.getConfig('page', config);

  return `
    <div class="cb-page-container ${finalConfig.layout.type}">
      ${finalConfig.header.show ? createHeader(finalConfig.header) : ''}
      <main style="max-width: ${finalConfig.layout.maxWidth}">
        <!-- Main content -->
      </main>
      ${finalConfig.footer.show ? createFooter(finalConfig.footer) : ''}
    </div>
  `;
}
```

### 2. Integration with Controllers

```javascript
class BaseCharacterBuilderController {
  constructor({ configManager, ...deps }) {
    this.#configManager = configManager;
  }

  getTemplateConfig(overrides = {}) {
    // Get page name from controller
    const pageName = this.getPageName();

    // Get merged configuration
    return this.#configManager.getConfig(pageName, overrides);
  }

  createPageTemplate(customConfig = {}) {
    const config = this.getTemplateConfig(customConfig);
    return createPageTemplate(config);
  }
}
```

### 3. Integration with Bootstrap

```javascript
// Bootstrap initializes configuration
CharacterBuilderBootstrap.bootstrap({
  pageName: 'thematic-direction-generator',
  config: {
    // Page-specific configuration
    layout: 'dual-panel',
    theme: 'dark',
  },
  environment: 'production', // Override detected environment
});
```

## Error Handling

**Note**: The existing `ConfigurationError` class in the codebase serves a different purpose related to dependency injection. The configuration system would need its own error classes:

```javascript
// PROPOSED ERROR CLASSES - NOT YET IMPLEMENTED
class TemplateConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TemplateConfigurationError';
    this.details = details;
  }
}

class InvalidConfigError extends TemplateConfigurationError {
  constructor(errors) {
    super('Invalid configuration');
    this.errors = errors;
  }
}

class MissingConfigError extends TemplateConfigurationError {
  constructor(configPath) {
    super(`Missing required configuration: ${configPath}`);
    this.configPath = configPath;
  }
}
```

## Security Considerations

1. **Configuration sources must be trusted** - No user input in configs
2. **Validate all configuration values** - Prevent injection attacks
3. **Freeze default configurations** - Prevent mutations
4. **Sanitize any dynamic values** - If configs contain user data
5. **Restrict environment overrides** - Only in development

## Dependencies

### Internal Dependencies

- Template system components from HTMLTEMP-001 through HTMLTEMP-007 (IMPLEMENTED)
- HTMLTEMP-008 (Data Binding Support) - NOT YET IMPLEMENTED
- `EnhancedTemplateComposer` - EXISTS but would need modification
- Validation utilities - EXIST in the codebase

### External Dependencies

- None (pure JavaScript implementation)

## Risks and Mitigation

| Risk                                      | Probability | Impact | Mitigation                            |
| ----------------------------------------- | ----------- | ------ | ------------------------------------- |
| Configuration conflicts                   | Medium      | Medium | Clear precedence rules and validation |
| Performance impact from deep merging      | Low         | Low    | Caching and optimization              |
| Invalid configurations breaking templates | Medium      | High   | Strict validation and defaults        |
| Environment detection failures            | Low         | Medium | Manual override capability            |
| Cache invalidation issues                 | Low         | Medium | Clear cache on any change             |

## Acceptance Criteria

- [ ] Configuration system supports all template types
- [ ] Override mechanism works with proper precedence
- [ ] Environment-specific configs load automatically
- [ ] Validation catches all invalid configurations
- [ ] Performance targets met (< 5ms loading)
- [ ] Caching works correctly
- [ ] Builder API is intuitive and complete
- [ ] All tests passing with > 90% coverage
- [ ] Documentation complete
- [ ] Integration verified with existing system

## Future Enhancements

1. **Configuration Hot Reload** - Live config updates in development
2. **Remote Configuration** - Load configs from server
3. **A/B Testing Support** - Multiple config variants
4. **Configuration Migration** - Automated config updates
5. **Visual Configuration Editor** - GUI for config management

## Documentation Requirements

1. **Configuration Reference** - All available options
2. **Override Guide** - How to customize configs
3. **Environment Guide** - Setting up environments
4. **Best Practices** - Configuration patterns
5. **Migration Guide** - Updating configurations

## Definition of Done

- [ ] All code implemented according to specification
- [ ] Unit tests passing with > 90% coverage
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation written and reviewed
- [ ] Code reviewed and approved
- [ ] Merged to main branch
