/**
 * @file Builder Exceptions - Centralized exception exports for action builder classes
 * @description Re-exports existing error classes used by builder components for
 * centralized access and consistent error handling
 */

// Re-export existing error class for action definition validation
export { InvalidActionDefinitionError } from '../../errors/invalidActionDefinitionError.js';

// Note: Additional builder-specific error types can be added here as needed
// during future enhancements without breaking existing imports