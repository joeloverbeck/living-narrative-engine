/**
 * @file Registration for logging performance monitoring components
 * @see ../../logging/loggingPerformanceMonitor.js
 * @see ../../logging/loggingPerformanceReporter.js
 * @see ../../logging/loggingResourceMonitor.js
 * @see ../../logging/loggingPerformanceAdvisor.js
 */

import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import { LoggingPerformanceMonitor } from '../../logging/loggingPerformanceMonitor.js';
import { LoggingPerformanceReporter } from '../../logging/loggingPerformanceReporter.js';
import { LoggingResourceMonitor } from '../../logging/loggingResourceMonitor.js';
import { LoggingPerformanceAdvisor } from '../../logging/loggingPerformanceAdvisor.js';
import LogCategoryDetector from '../../logging/logCategoryDetector.js';
import { Registrar } from '../../utils/registrarHelpers.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Register logging performance monitoring components
 * @param {import('../DiContainer.js').default} container - DI container
 */
export function registerLoggingPerformance(container) {
  const registrar = new Registrar(container);

  // Get logger for debugging
  let logger;
  try {
    logger = container.resolve(tokens.ILogger);
    logger.debug('Logging Performance Registration: starting…');
  } catch (error) {
    console.debug(
      'Logging Performance Registration: starting… (ILogger not yet available)'
    );
    logger = null;
  }

  const safeDebug = (message) => {
    if (logger) {
      logger.debug(message);
    } else {
      console.debug(message);
    }
  };

  // Register LoggingPerformanceMonitor as singleton
  registrar.single(tokens.ILoggingPerformanceMonitor, (c) => {
    // Try to get existing PerformanceMonitor if available
    let basePerformanceMonitor;
    try {
      basePerformanceMonitor = c.resolve(
        actionTracingTokens.IPerformanceMonitor
      );
    } catch {
      // If no base performance monitor is available, use null
      // LoggingPerformanceMonitor will handle this gracefully
      basePerformanceMonitor = null;
    }

    return new LoggingPerformanceMonitor({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.EventBus),
      categoryDetector: new LogCategoryDetector({
        logger: c.resolve(tokens.ILogger),
      }),
      performanceMonitor: basePerformanceMonitor,
    });
  });
  safeDebug(
    `Registered ${String(tokens.ILoggingPerformanceMonitor)} as singleton.`
  );

  // Register LoggingPerformanceReporter
  registrar.single(
    tokens.ILoggingPerformanceReporter,
    (c) =>
      new LoggingPerformanceReporter({
        performanceMonitor: c.resolve(tokens.ILoggingPerformanceMonitor),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(
    `Registered ${String(tokens.ILoggingPerformanceReporter)} as singleton.`
  );

  // Register LoggingResourceMonitor
  registrar.single(
    tokens.ILoggingResourceMonitor,
    (c) =>
      new LoggingResourceMonitor({
        performanceMonitor: c.resolve(tokens.ILoggingPerformanceMonitor),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(
    `Registered ${String(tokens.ILoggingResourceMonitor)} as singleton.`
  );

  // Register LoggingPerformanceAdvisor
  registrar.single(
    tokens.ILoggingPerformanceAdvisor,
    (c) =>
      new LoggingPerformanceAdvisor({
        performanceMonitor: c.resolve(tokens.ILoggingPerformanceMonitor),
        resourceMonitor: c.resolve(tokens.ILoggingResourceMonitor),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(
    `Registered ${String(tokens.ILoggingPerformanceAdvisor)} as singleton.`
  );

  safeDebug('Logging Performance Registration: completed.');
}

export default registerLoggingPerformance;
