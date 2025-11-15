/**
 * @file Legacy compatibility exports for socket slot compatibility helpers.
 *
 * This module re-exports the modern validator implementation so existing tests
 * and documentation references continue to function until the shim can be
 * removed entirely.
 */

export {
  SocketSlotCompatibilityValidator,
  validateSocketSlotCompatibility,
  __testables__,
} from './validators/SocketSlotCompatibilityValidator.js';
