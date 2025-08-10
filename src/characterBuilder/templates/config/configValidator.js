/**
 * @file Configuration validator using schema definitions
 * @module characterBuilder/templates/config/configValidator
 */

/**
 * Configuration validator for template configurations
 * Validates configurations against predefined schemas
 */
export class ConfigValidator {
  #schemas;
  #customValidators;

  constructor() {
    this.#schemas = new Map();
    this.#customValidators = new Map();
    this.#initializeSchemas();
  }

  /**
   * Initialize validation schemas for all template types
   * 
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
            maxWidth: { type: 'string', pattern: '^\\d+(px|%|em|rem|vw)$' },
            padding: { type: 'string' },
            gap: { type: 'string' },
            centerContent: { type: 'boolean' },
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
            backgroundColor: { type: 'string' },
            borderBottom: { type: 'boolean' },
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
            backgroundColor: { type: 'string' },
            borderTop: { type: 'boolean' },
          },
        },
        panels: {
          type: 'object',
          properties: {
            defaultLayout: { enum: ['single', 'dual', 'triple'] },
            collapsible: { type: 'boolean' },
            resizable: { type: 'boolean' },
            minWidth: { type: 'string', pattern: '^\\d+(px|%|em|rem|vw)$' },
            maxWidth: { type: 'string', pattern: '^\\d+(px|%|em|rem|vw)$' },
            gap: { type: 'string' },
            borderRadius: { type: 'string' },
            shadow: { type: 'boolean' },
          },
        },
        modals: {
          type: 'object',
          properties: {
            backdrop: { type: 'boolean' },
            closeOnEscape: { type: 'boolean' },
            closeOnBackdropClick: { type: 'boolean' },
            animation: { type: 'string' },
            centered: { type: 'boolean' },
            maxWidth: { type: 'string' },
            zIndex: { type: 'number', minimum: 0 },
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
            borderColor: { type: 'string' },
          },
        },
        header: {
          type: 'object',
          properties: {
            show: { type: 'boolean' },
            collapsible: { type: 'boolean' },
            actions: { type: 'boolean' },
            backgroundColor: { type: 'string' },
            padding: { type: 'string' },
            borderBottom: { type: 'boolean' },
          },
        },
        content: {
          type: 'object',
          properties: {
            padding: { type: 'string' },
            scrollable: { type: 'boolean' },
            maxHeight: { type: 'string' },
            minHeight: { type: 'string' },
            overflow: { enum: ['auto', 'hidden', 'scroll', 'visible'] },
          },
        },
        states: {
          type: 'object',
          properties: {
            loading: { type: 'object' },
            empty: { type: 'object' },
            error: { type: 'object' },
            collapsed: { type: 'object' },
          },
        },
      },
    });

    // Form schema
    this.#schemas.set('form', {
      type: 'object',
      properties: {
        validation: {
          type: 'object',
          properties: {
            immediate: { type: 'boolean' },
            onBlur: { type: 'boolean' },
            onSubmit: { type: 'boolean' },
            showErrors: { type: 'boolean' },
            errorPosition: { enum: ['below', 'above', 'tooltip'] },
            highlightErrors: { type: 'boolean' },
          },
        },
        layout: {
          type: 'object',
          properties: {
            labelPosition: { enum: ['top', 'left', 'inline'] },
            requiredIndicator: { type: 'string' },
            helpPosition: { type: 'string' },
            fieldSpacing: { type: 'string' },
            groupSpacing: { type: 'string' },
          },
        },
        submission: {
          type: 'object',
          properties: {
            preventDefault: { type: 'boolean' },
            disableOnSubmit: { type: 'boolean' },
            showProgress: { type: 'boolean' },
            resetOnSuccess: { type: 'boolean' },
            confirmBeforeSubmit: { type: 'boolean' },
            submitText: { type: 'string' },
            cancelText: { type: 'string' },
          },
        },
      },
    });

    // Button schema
    this.#schemas.set('button', {
      type: 'object',
      properties: {
        appearance: {
          type: 'object',
          properties: {
            variant: { enum: ['primary', 'secondary', 'tertiary', 'danger'] },
            size: { enum: ['small', 'medium', 'large'] },
            fullWidth: { type: 'boolean' },
            rounded: { type: 'boolean' },
            iconPosition: { enum: ['left', 'right'] },
          },
        },
        behavior: {
          type: 'object',
          properties: {
            rippleEffect: { type: 'boolean' },
            preventDoubleClick: { type: 'boolean' },
            doubleClickDelay: { type: 'number', minimum: 0 },
            loadingState: { type: 'boolean' },
            disabledOpacity: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    });

    // Modal schema
    this.#schemas.set('modal', {
      type: 'object',
      properties: {
        size: { enum: ['small', 'medium', 'large', 'fullscreen'] },
        position: { enum: ['center', 'top', 'bottom'] },
        overlay: {
          type: 'object',
          properties: {
            opacity: { type: 'number', minimum: 0, maximum: 1 },
            blur: { type: 'boolean' },
            color: { type: 'string' },
          },
        },
        animation: {
          type: 'object',
          properties: {
            type: { enum: ['fade', 'slide', 'zoom', 'none'] },
            duration: { type: 'number', minimum: 0 },
            easing: { type: 'string' },
          },
        },
      },
    });

    // Common schema (applies to all)
    this.#schemas.set('common', {
      type: 'object',
      properties: {
        accessibility: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            ariaLive: { enum: ['polite', 'assertive', 'off'] },
            announceChanges: { type: 'boolean' },
            keyboardNavigation: { type: 'boolean' },
          },
        },
        performance: {
          type: 'object',
          properties: {
            lazyLoad: { type: 'boolean' },
            cacheTimeout: { type: 'number', minimum: 0 },
            maxRenderTime: { type: 'number', minimum: 0 },
            virtualScrollThreshold: { type: 'number', minimum: 0 },
          },
        },
        styling: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            animations: { type: 'boolean' },
            transitions: { type: 'boolean' },
            responsiveBreakpoints: { type: 'object' },
          },
        },
        validation: {
          type: 'object',
          properties: {
            strict: { type: 'boolean' },
            warnOnMissingData: { type: 'boolean' },
            throwOnError: { type: 'boolean' },
          },
        },
      },
    });
  }

  /**
   * Validate configuration against schema
   * 
   * @param {object} config - Configuration to validate
   * @param {string} templateType - Template type
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(config, templateType) {
    const errors = [];
    
    // Get schema for template type
    const schema = this.#schemas.get(templateType);
    
    if (!schema) {
      // No schema defined, check common schema only
      const commonSchema = this.#schemas.get('common');
      if (commonSchema) {
        this.#validateObject(config, commonSchema, '', errors);
      }
    } else {
      // Validate against specific schema
      this.#validateObject(config, schema, '', errors);
    }
    
    // Run custom validators if any
    const customValidator = this.#customValidators.get(templateType);
    if (customValidator) {
      const customErrors = customValidator(config);
      if (customErrors && customErrors.length > 0) {
        errors.push(...customErrors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursively validate object against schema
   * 
   * @private
   * @param {*} obj - Object to validate
   * @param {object} schema - Schema to validate against
   * @param {string} path - Current path in object
   * @param {string[]} errors - Array to collect errors
   */
  #validateObject(obj, schema, path, errors) {
    // Check if value matches schema type
    if (schema.type) {
      const actualType = Array.isArray(obj) ? 'array' : typeof obj;
      
      if (schema.type !== actualType) {
        if (obj === null && schema.nullable) {
          return; // Null is allowed
        }
        if (obj === undefined && !schema.required) {
          return; // Undefined is allowed for optional fields
        }
        
        errors.push(`${path || 'root'} must be of type ${schema.type}, got ${actualType}`);
        return;
      }
    }
    
    // Check enum values
    if (schema.enum && !schema.enum.includes(obj)) {
      errors.push(`${path || 'value'} must be one of: ${schema.enum.join(', ')}, got "${obj}"`);
      return;
    }
    
    // Check pattern for strings
    if (schema.pattern && typeof obj === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(obj)) {
        errors.push(`${path || 'value'} does not match pattern ${schema.pattern}`);
      }
    }
    
    // Check number constraints
    if (typeof obj === 'number') {
      if (schema.minimum !== undefined && obj < schema.minimum) {
        errors.push(`${path || 'value'} must be at least ${schema.minimum}, got ${obj}`);
      }
      if (schema.maximum !== undefined && obj > schema.maximum) {
        errors.push(`${path || 'value'} must be at most ${schema.maximum}, got ${obj}`);
      }
    }
    
    // Check string constraints
    if (typeof obj === 'string') {
      if (schema.minLength !== undefined && obj.length < schema.minLength) {
        errors.push(`${path || 'value'} must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && obj.length > schema.maxLength) {
        errors.push(`${path || 'value'} must be at most ${schema.maxLength} characters`);
      }
    }
    
    // Validate object properties
    if (schema.properties && typeof obj === 'object' && obj !== null) {
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
    if (schema.additionalProperties === false && typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        if (schema.properties && !schema.properties[key]) {
          errors.push(`${path ? `${path}.${key}` : key} is not a valid property`);
        }
      });
    }
    
    // Validate array items
    if (schema.items && Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        this.#validateObject(item, schema.items, itemPath, errors);
      });
    }
  }

  /**
   * Register custom validator for a template type
   * 
   * @param {string} templateType - Template type
   * @param {Function} validator - Validator function that returns array of errors
   */
  registerCustomValidator(templateType, validator) {
    this.#customValidators.set(templateType, validator);
  }

  /**
   * Remove custom validator
   * 
   * @param {string} templateType - Template type
   */
  removeCustomValidator(templateType) {
    this.#customValidators.delete(templateType);
  }

  /**
   * Check if schema exists for template type
   * 
   * @param {string} templateType - Template type
   * @returns {boolean} True if schema exists
   */
  hasSchema(templateType) {
    return this.#schemas.has(templateType);
  }

  /**
   * Get schema for template type
   * 
   * @param {string} templateType - Template type
   * @returns {object|null} Schema or null if not found
   */
  getSchema(templateType) {
    return this.#schemas.get(templateType) || null;
  }

  /**
   * Register custom schema
   * 
   * @param {string} templateType - Template type
   * @param {object} schema - Schema definition
   */
  registerSchema(templateType, schema) {
    this.#schemas.set(templateType, schema);
  }
}