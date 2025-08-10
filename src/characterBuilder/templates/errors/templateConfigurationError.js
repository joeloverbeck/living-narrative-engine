/**
 * @file Template configuration error classes
 * @module characterBuilder/templates/errors/templateConfigurationError
 */

/**
 * Base error class for template configuration issues
 */
export class TemplateConfigurationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'TemplateConfigurationError';
    this.details = details;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when configuration validation fails
 */
export class InvalidConfigError extends TemplateConfigurationError {
  /**
   * @param {string[]} errors - Validation errors
   * @param {string} [templateId] - Template identifier
   */
  constructor(errors, templateId) {
    const message = templateId 
      ? `Invalid configuration for template "${templateId}"`
      : 'Invalid template configuration';
    
    super(message, { errors, templateId });
    this.name = 'InvalidConfigError';
    this.errors = errors;
    this.templateId = templateId;
  }
}

/**
 * Error thrown when required configuration is missing
 */
export class MissingConfigError extends TemplateConfigurationError {
  /**
   * @param {string} configPath - Path to missing configuration
   * @param {string} [templateId] - Template identifier
   */
  constructor(configPath, templateId) {
    const message = `Missing required configuration: ${configPath}`;
    
    super(message, { configPath, templateId });
    this.name = 'MissingConfigError';
    this.configPath = configPath;
    this.templateId = templateId;
  }
}

/**
 * Error thrown when environment detection fails
 */
export class EnvironmentDetectionError extends TemplateConfigurationError {
  /**
   * @param {string} reason - Reason for detection failure
   */
  constructor(reason) {
    super(`Failed to detect environment: ${reason}`, { reason });
    this.name = 'EnvironmentDetectionError';
  }
}

/**
 * Error thrown when configuration merge fails
 */
export class ConfigMergeError extends TemplateConfigurationError {
  /**
   * @param {string} reason - Reason for merge failure
   * @param {object} [configs] - Configurations that failed to merge
   */
  constructor(reason, configs) {
    super(`Configuration merge failed: ${reason}`, { reason, configs });
    this.name = 'ConfigMergeError';
  }
}