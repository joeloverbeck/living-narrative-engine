import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file Action tracing DI tokens.
 * @typedef {string} DiToken
 */

/**
 * Action tracing tokens for dependency injection.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const actionTracingTokens = freeze({
  IActionTraceConfigLoader: 'IActionTraceConfigLoader',
  IActionTraceConfigValidator: 'IActionTraceConfigValidator',
  IActionTraceFilter: 'IActionTraceFilter',
  IActionTraceOutputService: 'IActionTraceOutputService',
  ITraceDirectoryManager: 'ITraceDirectoryManager',
  IActionAwareStructuredTrace: 'IActionAwareStructuredTrace',
});
