/**
 * @file tokens-monitoring.js - Dependency injection tokens for monitoring services
 */

import { freeze } from '../../utils/cloneUtils.js';

/**
 * Monitoring service tokens for dependency injection
 *
 * @type {Readonly<Record<string, string>>}
 */
export const monitoringTokens = freeze({
  // Core monitoring services
  IMonitoringCoordinator: 'IMonitoringCoordinator',
  IPerformanceMonitor: 'IPerformanceMonitor',
  ICircuitBreaker: 'ICircuitBreaker',
  ICentralErrorHandler: 'ICentralErrorHandler',
  IRecoveryStrategyManager: 'IRecoveryStrategyManager',
  IErrorReporter: 'IErrorReporter',

  // Memory monitoring services
  IMemoryMonitor: 'IMemoryMonitor',
  IMemoryAnalyzer: 'IMemoryAnalyzer',
  IMemoryProfiler: 'IMemoryProfiler',
  IMemoryPressureManager: 'IMemoryPressureManager',
  IMemoryReporter: 'IMemoryReporter',

  // Memory strategies
  ILowMemoryStrategy: 'ILowMemoryStrategy',
  ICriticalMemoryStrategy: 'ICriticalMemoryStrategy',

  // Configuration
  IMemoryMonitoringConfig: 'IMemoryMonitoringConfig',
  IErrorReportingConfig: 'IErrorReportingConfig',
});

export default monitoringTokens;
