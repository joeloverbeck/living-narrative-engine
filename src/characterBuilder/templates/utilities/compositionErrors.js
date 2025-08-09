/**
 * @file Custom error classes for template composition
 * @module characterBuilder/templates/utilities/compositionErrors
 * @description Error classes for handling composition-specific failures
 */

/**
 * Base class for composition-related errors
 */
export class CompositionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {object} details - Additional error details
   * @param {*} [details.template] - Template that caused the error
   * @param {object} [details.context] - Context at time of error
   * @param {number} [details.depth] - Composition depth
   * @param {Error} [details.cause] - Original error that caused this error
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'CompositionError';
    this.template = details.template;
    this.context = details.context;
    this.depth = details.depth;
    this.cause = details.cause;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CompositionError);
    }
  }

  /**
   * Get detailed error information
   *
   * @returns {object} Error details
   */
  getDetails() {
    return {
      name: this.name,
      message: this.message,
      template: this.template,
      context: this.context,
      depth: this.depth,
      cause: this.cause,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Format error for logging
   *
   * @returns {string} Formatted error string
   */
  toString() {
    let str = `${this.name}: ${this.message}`;
    
    if (this.template) {
      const templateId = typeof this.template === 'string' 
        ? this.template.substring(0, 50) + '...'
        : this.template.name || 'unnamed';
      str += `\n  Template: ${templateId}`;
    }
    
    if (this.depth !== undefined) {
      str += `\n  Depth: ${this.depth}`;
    }
    
    if (this.cause) {
      str += `\n  Caused by: ${this.cause.message}`;
    }
    
    return str;
  }
}

/**
 * Error thrown when a slot is not found
 */
export class SlotNotFoundError extends CompositionError {
  /**
   * @param {string} slotName - Name of the missing slot
   * @param {Array<string>} availableSlots - List of available slots
   * @param {object} details - Additional error details
   */
  constructor(slotName, availableSlots = [], details = {}) {
    const slotsText = availableSlots.length > 0 
      ? availableSlots.join(', ')
      : 'none';
    
    super(`Slot "${slotName}" not found. Available slots: ${slotsText}`, details);
    this.name = 'SlotNotFoundError';
    this.slotName = slotName;
    this.availableSlots = availableSlots;
  }
}

/**
 * Error thrown when maximum composition depth is exceeded
 */
export class RecursionLimitError extends CompositionError {
  /**
   * @param {number} depth - Current depth when limit was exceeded
   * @param {number} maxDepth - Maximum allowed depth
   * @param {object} details - Additional error details
   */
  constructor(depth, maxDepth, details = {}) {
    super(
      `Maximum composition depth (${maxDepth}) exceeded at depth ${depth}`,
      { ...details, depth }
    );
    this.name = 'RecursionLimitError';
    this.maxDepth = maxDepth;
  }
}

/**
 * Error thrown when a template is not found
 */
export class TemplateNotFoundError extends CompositionError {
  /**
   * @param {string} templateName - Name of the missing template
   * @param {string} [templateType] - Type of template (layout, component, etc.)
   * @param {object} details - Additional error details
   */
  constructor(templateName, templateType = null, details = {}) {
    const typeText = templateType ? `${templateType} template` : 'template';
    super(`Template not found: ${templateName} (${typeText})`, details);
    this.name = 'TemplateNotFoundError';
    this.templateName = templateName;
    this.templateType = templateType;
  }
}

/**
 * Error thrown when template validation fails
 */
export class TemplateValidationError extends CompositionError {
  /**
   * @param {string} message - Validation error message
   * @param {Array<object>} validationErrors - List of validation errors
   * @param {object} details - Additional error details
   */
  constructor(message, validationErrors = [], details = {}) {
    super(message, details);
    this.name = 'TemplateValidationError';
    this.validationErrors = validationErrors;
  }

  /**
   * Get formatted validation errors
   *
   * @returns {string} Formatted errors
   */
  getFormattedErrors() {
    if (this.validationErrors.length === 0) {
      return this.message;
    }

    const errors = this.validationErrors.map((err, index) => {
      const num = index + 1;
      if (typeof err === 'string') {
        return `  ${num}. ${err}`;
      } else if (err.field && err.message) {
        return `  ${num}. ${err.field}: ${err.message}`;
      } else if (err.message) {
        return `  ${num}. ${err.message}`;
      }
      return `  ${num}. ${JSON.stringify(err)}`;
    });

    return `${this.message}\nValidation errors:\n${errors.join('\n')}`;
  }
}

/**
 * Error thrown when template syntax is invalid
 */
export class TemplateSyntaxError extends CompositionError {
  /**
   * @param {string} message - Syntax error message
   * @param {number} [line] - Line number where error occurred
   * @param {number} [column] - Column number where error occurred
   * @param {object} details - Additional error details
   */
  constructor(message, line = null, column = null, details = {}) {
    const locationText = line !== null 
      ? ` at line ${line}${column !== null ? `, column ${column}` : ''}`
      : '';
    
    super(`Template syntax error${locationText}: ${message}`, details);
    this.name = 'TemplateSyntaxError';
    this.line = line;
    this.column = column;
  }
}

/**
 * Error thrown when template inheritance fails
 */
export class InheritanceError extends CompositionError {
  /**
   * @param {string} message - Inheritance error message
   * @param {object} childTemplate - Child template
   * @param {object} parentTemplate - Parent template
   * @param {object} details - Additional error details
   */
  constructor(message, childTemplate = null, parentTemplate = null, details = {}) {
    super(message, details);
    this.name = 'InheritanceError';
    this.childTemplate = childTemplate;
    this.parentTemplate = parentTemplate;
  }
}

/**
 * Error thrown when component assembly fails
 */
export class AssemblyError extends CompositionError {
  /**
   * @param {string} message - Assembly error message
   * @param {object} config - Assembly configuration that failed
   * @param {string} [component] - Component that caused the failure
   * @param {object} details - Additional error details
   */
  constructor(message, config = null, component = null, details = {}) {
    super(message, details);
    this.name = 'AssemblyError';
    this.assemblyConfig = config;
    this.failedComponent = component;
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends CompositionError {
  /**
   * @param {string} message - Cache error message
   * @param {string} [operation] - Cache operation that failed
   * @param {string} [key] - Cache key involved
   * @param {object} details - Additional error details
   */
  constructor(message, operation = null, key = null, details = {}) {
    super(message, details);
    this.name = 'CacheError';
    this.operation = operation;
    this.cacheKey = key;
  }
}

/**
 * Error thrown when template context is invalid
 */
export class ContextError extends CompositionError {
  /**
   * @param {string} message - Context error message
   * @param {object} invalidContext - The invalid context
   * @param {Array<string>} [missingFields] - Required fields that are missing
   * @param {object} details - Additional error details
   */
  constructor(message, invalidContext = null, missingFields = [], details = {}) {
    super(message, details);
    this.name = 'ContextError';
    this.invalidContext = invalidContext;
    this.missingFields = missingFields;
  }

  /**
   * Get formatted missing fields
   *
   * @returns {string} Formatted missing fields
   */
  getFormattedMissingFields() {
    if (this.missingFields.length === 0) {
      return '';
    }
    return `Missing required fields: ${this.missingFields.join(', ')}`;
  }
}

/**
 * Create a composition error with full context
 *
 * @param {string} message - Error message
 * @param {object} options - Error options
 * @returns {CompositionError} Composition error instance
 */
export function createCompositionError(message, options = {}) {
  const {
    type = 'CompositionError',
    template,
    context,
    depth,
    cause,
    ...additionalDetails
  } = options;

  const details = {
    template,
    context,
    depth,
    cause,
    ...additionalDetails
  };

  switch (type) {
    case 'SlotNotFoundError':
      return new SlotNotFoundError(
        options.slotName || 'unknown',
        options.availableSlots || [],
        details
      );
    
    case 'RecursionLimitError':
      return new RecursionLimitError(
        depth || 0,
        options.maxDepth || 10,
        details
      );
    
    case 'TemplateNotFoundError':
      return new TemplateNotFoundError(
        options.templateName || 'unknown',
        options.templateType,
        details
      );
    
    case 'TemplateValidationError':
      return new TemplateValidationError(
        message,
        options.validationErrors || [],
        details
      );
    
    case 'TemplateSyntaxError':
      return new TemplateSyntaxError(
        message,
        options.line,
        options.column,
        details
      );
    
    case 'InheritanceError':
      return new InheritanceError(
        message,
        options.childTemplate,
        options.parentTemplate,
        details
      );
    
    case 'AssemblyError':
      return new AssemblyError(
        message,
        options.assemblyConfig,
        options.failedComponent,
        details
      );
    
    case 'CacheError':
      return new CacheError(
        message,
        options.operation,
        options.cacheKey,
        details
      );
    
    case 'ContextError':
      return new ContextError(
        message,
        options.invalidContext,
        options.missingFields || [],
        details
      );
    
    default:
      return new CompositionError(message, details);
  }
}

// Export utility functions for testing
export const __testUtils = {
  createTestError: (type, message, options) => createCompositionError(message, { type, ...options }),
};