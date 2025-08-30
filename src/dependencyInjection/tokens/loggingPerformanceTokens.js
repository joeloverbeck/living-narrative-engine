/**
 * @file Dependency injection tokens for logging performance monitoring
 * @see ../../logging/loggingPerformanceMonitor.js
 * @see ../../logging/loggingPerformanceReporter.js
 * @see ../../logging/loggingResourceMonitor.js
 * @see ../../logging/loggingPerformanceAdvisor.js
 */

import { freeze } from '../../utils/cloneUtils.js';

/**
 * @typedef {string} DiToken
 */

/**
 * Logging performance monitoring tokens
 * @type {Readonly<Record<string, DiToken>>}
 */
export const loggingPerformanceTokens = freeze({
  ILoggingPerformanceMonitor: 'ILoggingPerformanceMonitor',
  ILoggingPerformanceReporter: 'ILoggingPerformanceReporter',
  ILoggingResourceMonitor: 'ILoggingResourceMonitor',
  ILoggingPerformanceAdvisor: 'ILoggingPerformanceAdvisor',
});

export default loggingPerformanceTokens;
