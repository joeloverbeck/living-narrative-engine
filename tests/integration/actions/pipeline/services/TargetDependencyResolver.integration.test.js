/**
 * @file Integration tests for TargetDependencyResolver
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TargetDependencyResolver } from '../../../../../src/actions/pipeline/services/implementations/TargetDependencyResolver.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../src/actions/pipeline/services/base/ServiceError.js';

class RecordingLogger {
  constructor() {
    this.entries = [];
  }

  #record(level, message, context = {}) {
    this.entries.push({ level, message, context });
  }

  debug(message, context) {
    this.#record('debug', message, context);
  }

  info(message, context) {
    this.#record('info', message, context);
  }

  warn(message, context) {
    this.#record('warn', message, context);
  }

  error(message, context) {
    this.#record('error', message, context);
  }

  findEntry(operation, level = 'debug', predicate = () => true) {
    return this.entries.find(
      (entry) =>
        entry.level === level &&
        typeof entry.message === 'string' &&
        entry.message.includes(`TargetDependencyResolver: ${operation}`) &&
        predicate(entry)
    );
  }
}

describe('TargetDependencyResolver integration', () => {
  let logger;
  let resolver;

  beforeEach(() => {
    logger = new RecordingLogger();
    resolver = new TargetDependencyResolver({ logger });
  });

  it('computes resolution order across multiple dependency levels', () => {
    const definitions = {
      primary: { scope: 'scope:primary', placeholder: 'primary' },
      secondary: {
        scope: 'scope:secondary',
        placeholder: 'secondary',
        contextFrom: 'primary',
      },
      tertiary: {
        scope: 'scope:tertiary',
        placeholder: 'tertiary',
        contextFrom: 'secondary',
      },
    };

    const order = resolver.getResolutionOrder(definitions);
    expect(order).toEqual(['primary', 'secondary', 'tertiary']);

    const logEntry = logger.findEntry('getResolutionOrder', 'debug', (entry) =>
      Array.isArray(entry.context.order)
    );
    expect(logEntry?.context.order).toEqual(order);

    const dependencyGraph = resolver.getDependencyGraph(definitions);
    expect(dependencyGraph).toEqual([
      { targetKey: 'primary', dependencies: [], isOptional: false },
      { targetKey: 'secondary', dependencies: ['primary'], isOptional: false },
      { targetKey: 'tertiary', dependencies: ['secondary'], isOptional: false },
    ]);

    expect(resolver.hasCircularDependency('primary', definitions)).toBe(false);
  });

  it('returns an empty order when no target definitions are provided', () => {
    const order = resolver.getResolutionOrder({});
    expect(order).toEqual([]);

    const logEntry = logger.findEntry('getResolutionOrder');
    expect(logEntry?.context.result).toBe('empty_input');
  });

  it('emits validation warnings for optional metadata issues', () => {
    const definitions = {
      primary: {
        scope: 'scope:primary',
        placeholder: 'primary',
        description: 42,
      },
    };

    const result = resolver.validateDependencies(definitions);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      "Target 'primary' description should be a string",
    ]);
  });

  it('aggregates validation errors for malformed target records', () => {
    const malformedDefinitions = {
      broken: null,
      missingScope: { placeholder: 'slot' },
      noPlaceholder: { scope: 'scope:two' },
      wrongContextType: {
        scope: 'scope:three',
        placeholder: 'slot',
        contextFrom: 42,
      },
      selfLink: {
        scope: 'scope:self',
        placeholder: 'self',
        contextFrom: 'selfLink',
      },
    };

    const result = resolver.validateDependencies(malformedDefinitions);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      "Target 'broken' must be an object",
      "Target 'missingScope' must have a valid scope string",
      "Target 'noPlaceholder' must have a valid placeholder string",
      "Target 'wrongContextType' contextFrom must be a string",
      "Target 'selfLink' cannot reference itself in contextFrom",
    ]);
  });

  it('surface validation errors when definitions are malformed', () => {
    expect.assertions(4);
    const invalidDefinitions = {
      alpha: { scope: 'scope:alpha' },
      beta: {
        scope: 'scope:beta',
        placeholder: 'beta',
        contextFrom: 'gamma',
      },
    };

    try {
      resolver.getResolutionOrder(invalidDefinitions);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.VALIDATION_ERROR);
      expect(error.value).toContain(
        "Target 'alpha' must have a valid placeholder string"
      );
      const errorLog = logger.entries.find(
        (entry) =>
          entry.level === 'error' &&
          typeof entry.message === 'string' &&
          entry.message.includes('Failed to determine resolution order')
      );
      expect(errorLog?.context.error).toContain('Invalid target definitions');
    }
  });

  it('detects circular dependencies and reports dependency chains', () => {
    expect.assertions(5);
    const cyclicDefinitions = {
      primary: {
        scope: 'scope:primary',
        placeholder: 'primary',
        contextFrom: 'tertiary',
      },
      secondary: {
        scope: 'scope:secondary',
        placeholder: 'secondary',
        contextFrom: 'primary',
      },
      tertiary: {
        scope: 'scope:tertiary',
        placeholder: 'tertiary',
        contextFrom: 'secondary',
      },
    };

    try {
      resolver.getResolutionOrder(cyclicDefinitions);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.CIRCULAR_DEPENDENCY);
      expect(error.value.remaining.sort()).toEqual([
        'primary',
        'secondary',
        'tertiary',
      ]);
      expect(error.value.dependencyMap.primary.cycle).toEqual([
        'primary',
        'tertiary',
        'secondary',
        'primary',
      ]);
      expect(
        resolver.hasCircularDependency('secondary', cyclicDefinitions)
      ).toBe(true);
    }
  });

  it('requires valid target definitions for circular dependency checks', () => {
    expect.assertions(5);
    const definitions = {
      primary: { scope: 'scope:primary', placeholder: 'primary' },
    };

    try {
      resolver.hasCircularDependency('   ', definitions);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.VALIDATION_ERROR);
    }

    try {
      resolver.hasCircularDependency('missing', definitions);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.VALIDATION_ERROR);
    }

    expect(resolver.hasCircularDependency('primary', definitions)).toBe(false);
  });

  it('rejects non-object inputs when calculating resolution order', () => {
    expect.assertions(2);
    try {
      resolver.getResolutionOrder('not-an-object');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.VALIDATION_ERROR);
    }
  });

  it('requires the targetDefinitions parameter for dependency analysis', () => {
    expect.assertions(2);
    try {
      resolver.getDependencyGraph(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.MISSING_PARAMETER);
    }
  });

  it('handles invalid dependency containers during validation', () => {
    const result = resolver.validateDependencies(null);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'Target definitions must be a non-null object',
    ]);
  });

  it('wraps unexpected errors from target definition access', () => {
    expect.assertions(3);
    const explosiveDefinitions = {};
    Object.defineProperty(explosiveDefinitions, 'boom', {
      enumerable: true,
      get() {
        throw new Error('definition failed');
      },
    });

    try {
      resolver.getResolutionOrder(explosiveDefinitions);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.OPERATION_FAILED);
      expect(error.message).toContain('definition failed');
    }
  });
});
