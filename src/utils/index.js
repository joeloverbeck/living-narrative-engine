// src/utils/index.js
/**
 * Consolidated exports for utility functions. Import utilities from this
 * central index to reduce relative paths.
 *
 * @example
 * import { fetchWithRetry, getModuleLogger } from '../utils/index.js';
 */
export { fetchWithRetry } from './httpUtils.js';
export { RetryManager } from './httpRetryManager.js';
export * from './loggerUtils.js';
export * from './objectUtils.js';
export * from './cloneUtils.js';
export * from './placeholderPatterns.js';
export * from './placeholderPathResolver.js';
export { StructureResolver } from './structureResolver.js';
export * from './jsonCleaning.js';
export * from './jsonRepair.js';
export * from './evaluationContextUtils.js';
export * from './eventDispatchUtils.js';
export { dispatchWithErrorHandling } from './eventDispatchHelper.js';
export {
  assertPresent,
  assertFunction,
  assertMethods,
  assertValidId,
  assertNonBlankString,
  validateDependency,
  validateDependencies,
} from './dependencyUtils.js';
export { createErrorDetails } from './errorDetails.js';
export { readComponent, writeComponent } from './componentAccessUtils.js';
export * from '../turns/strategies/strategyHelpers.js';
