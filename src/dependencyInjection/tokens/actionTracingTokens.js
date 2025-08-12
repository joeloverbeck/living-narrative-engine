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
  IActionExecutionTraceFactory: 'IActionExecutionTraceFactory',
  IActionTraceOutputService: 'IActionTraceOutputService',
  ITraceDirectoryManager: 'ITraceDirectoryManager',
  IActionAwareStructuredTrace: 'IActionAwareStructuredTrace',
  // Event dispatch tracing tokens
  IEventDispatchTracer: 'IEventDispatchTracer',
  // Storage adapter for IndexedDB
  IIndexedDBStorageAdapter: 'IIndexedDBStorageAdapter',
  // JSON formatter for trace output
  IJsonTraceFormatter: 'IJsonTraceFormatter',
  // Human-readable formatter for trace output
  IHumanReadableFormatter: 'IHumanReadableFormatter',
});
