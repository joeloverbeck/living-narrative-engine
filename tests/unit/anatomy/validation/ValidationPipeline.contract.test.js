import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ValidatorRegistry from '../../../../src/anatomy/validation/core/ValidatorRegistry.js';

const required = [
  { name: 'component-existence', priority: 0, failFast: true },
  { name: 'property-schemas', priority: 5, failFast: true },
];

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createValidator = ({ name, priority, failFast = false }) => ({
  name,
  priority,
  failFast,
  validate: jest.fn(async () => ({})),
});

describe('ValidationPipeline contract', () => {
  let registry;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    registry = new ValidatorRegistry({ logger });
  });

  it('succeeds when fail-fast validators meet configuration contract', () => {
    registry.register(createValidator({ name: 'component-existence', priority: 0, failFast: true }));
    registry.register(createValidator({ name: 'property-schemas', priority: 5, failFast: true }));

    expect(registry.assertRegistered(required)).toBe(true);
  });

  it('throws when validator priority does not match contract', () => {
    registry.register(createValidator({ name: 'component-existence', priority: 10, failFast: true }));
    registry.register(createValidator({ name: 'property-schemas', priority: 5, failFast: true }));

    expect(() => registry.assertRegistered(required)).toThrow(
      /component-existence:priority/
    );
  });

  it('downgrades to warning in production mode', () => {
    registry.register(createValidator({ name: 'component-existence', priority: 0, failFast: false }));
    registry.register(createValidator({ name: 'property-schemas', priority: 5, failFast: true }));

    const onProductionFailure = jest.fn();
    const result = registry.assertRegistered(required, {
      environment: 'production',
      onProductionFailure,
    });

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ValidatorRegistry: Required validators misconfigured'),
      expect.objectContaining({ issues: expect.any(Array) })
    );
    expect(onProductionFailure).toHaveBeenCalled();
  });
});
