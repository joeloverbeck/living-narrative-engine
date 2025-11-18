import {
  ErrorClassifier,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  RECOVERY_POTENTIAL,
} from '../../../../src/actions/tracing/errorClassification.js';

/**
 *
 */
function createIntegrationLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: () => logger,
  };
  return logger;
}

describe('ErrorClassifier integration behavior', () => {
  let classifier;

  beforeEach(() => {
    classifier = new ErrorClassifier({ logger: createIntegrationLogger() });
  });

  it('classifies null errors with safe fallbacks and default troubleshooting', () => {
    const classification = classifier.classifyError(null);

    expect(classification.category).toBe(ERROR_CATEGORIES.UNKNOWN);
    expect(classification.severity).toBe(ERROR_SEVERITY.LOW);
    expect(classification.recoveryPotential).toBe(
      RECOVERY_POTENTIAL.CONDITIONAL
    );
    expect(classification.isTransient).toBe(false);
    expect(classification.isRetryable).toBe(true);

    expect(classification.troubleshooting).toEqual(
      expect.arrayContaining([
        'Review error message and stack trace',
        'Check system logs for related errors',
        'Verify system configuration and dependencies',
        'Retry only after confirming conditions are met',
      ])
    );

    expect(classification.analysis.potentialCauses).toEqual([
      'Unknown cause - requires investigation',
    ]);
  });

  it('applies contextual severity, recovery policies, and domain-specific guidance', () => {
    const initializationError = new Error('System boot failure detected');
    const initializationClassification = classifier.classifyError(
      initializationError,
      { phase: 'initialization', retryCount: 4 }
    );

    expect(initializationClassification.severity).toBe(
      ERROR_SEVERITY.CRITICAL
    );
    expect(initializationClassification.recoveryPotential).toBe(
      RECOVERY_POTENTIAL.MANUAL
    );
    expect(initializationClassification.troubleshooting).toEqual(
      expect.arrayContaining([
        'Check system logs for additional details',
        'Monitor system resource usage',
        'Review system configuration and health',
      ])
    );
    expect(initializationClassification.analysis.potentialCauses).toEqual(
      expect.arrayContaining([
        'Configuration or dependency initialization failure',
        'Persistent issue not resolved by previous retry attempts',
      ])
    );

    const retryAuthorizationError = new Error('Permission denied by gateway');
    const retryClassification = classifier.classifyError(
      retryAuthorizationError,
      { isRetry: true, retryCount: 1 }
    );

    expect(retryClassification.category).toBe(
      ERROR_CATEGORIES.AUTHORIZATION
    );
    expect(retryClassification.severity).toBe(ERROR_SEVERITY.HIGH);

    const fatalNetworkError = new Error('Fatal network outage detected');
    const fatalClassification = classifier.classifyError(fatalNetworkError);
    expect(fatalClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);
    expect(fatalClassification.recoveryPotential).toBe(
      RECOVERY_POTENTIAL.DELAYED
    );

    const warningError = new Error('API deprecation warning encountered');
    const warningClassification = classifier.classifyError(warningError);
    expect(warningClassification.severity).toBe(ERROR_SEVERITY.LOW);

    const systemError = new Error('System overload occurred during flush');
    const systemClassification = classifier.classifyError(systemError);
    expect(systemClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);

    const timeoutError = new Error('Request deadline expired during sync');
    const timeoutClassification = classifier.classifyError(timeoutError);
    expect(timeoutClassification.category).toBe(ERROR_CATEGORIES.TIMEOUT);
    expect(timeoutClassification.troubleshooting).toEqual(
      expect.arrayContaining([
        'Check for performance bottlenecks',
        'Review timeout configuration settings',
        'Monitor resource usage and availability',
        'Retry after a short delay (5-30 seconds)',
      ])
    );
  });
});
