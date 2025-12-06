import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  assertFunction,
  assertMethods,
  assertNonBlankString,
  assertPresent,
  assertValidId,
  validateDependency,
  validateDependencies,
} from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { MapManager } from '../../../src/utils/mapManagerUtils.js';
import idValidation from '../../../src/utils/idValidation.js';

class RecordingLogger {
  constructor() {
    this.records = [];
  }

  error(message, context) {
    this.records.push({ level: 'error', message, context });
  }

  warn(message, context) {
    this.records.push({ level: 'warn', message, context });
  }

  info(message, context) {
    this.records.push({ level: 'info', message, context });
  }

  debug(message, context) {
    this.records.push({ level: 'debug', message, context });
  }

  getErrorMessages() {
    return this.records
      .filter((entry) => entry.level === 'error')
      .map((entry) => entry.message);
  }
}

class SerializationAdapter {
  serialize(record) {
    return {
      type: record.type,
      payload: { ...record.payload },
    };
  }
}

class IntegrationHarness {
  constructor({ repository, adapter, logger }) {
    this.logger = logger;
    validateDependencies(null, logger);

    assertPresent(
      repository,
      'IntegrationHarness requires a repository instance.',
      InvalidArgumentError,
      logger
    );

    assertFunction(
      adapter,
      'serialize',
      'IntegrationHarness requires an adapter with serialize().',
      InvalidArgumentError,
      logger
    );

    assertMethods(
      repository,
      ['add', 'get', 'remove', 'has', 'clear'],
      'IntegrationHarness repository must implement basic map operations.',
      InvalidArgumentError,
      logger
    );

    this.repository = repository;
    this.adapter = adapter;

    validateDependencies(
      [
        {
          dependency: repository,
          name: 'IntegrationHarness: repository',
          methods: ['add', 'get', 'remove'],
        },
        {
          dependency: adapter,
          name: 'IntegrationHarness: adapter',
          methods: ['serialize'],
        },
      ],
      logger
    );
  }

  registerRecord(id, record) {
    assertValidId(id, 'IntegrationHarness.registerRecord', this.logger);
    assertNonBlankString(
      record.type,
      'type',
      'IntegrationHarness.registerRecord',
      this.logger
    );

    validateDependency(record, 'IntegrationHarness: record', this.logger, {
      requiredMethods: ['serialize'],
    });

    const serialized = record.serialize();
    this.repository.add(id, serialized);
    return serialized;
  }

  executeCallable(callable) {
    validateDependency(callable, 'IntegrationHarness: callable', this.logger, {
      isFunction: true,
    });
    return callable();
  }
}

describe('dependencyUtils integration contracts', () => {
  let logger;
  let adapter;
  let repository;

  beforeEach(() => {
    logger = new RecordingLogger();
    adapter = new SerializationAdapter();
    repository = new MapManager({ throwOnInvalidId: true });
  });

  it('establishes wiring between repository, adapter, and dependency guards', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    const serialized = harness.registerRecord('entity-1', {
      type: 'npc',
      payload: { attitude: 'friendly' },
      serialize() {
        return { type: this.type, payload: this.payload };
      },
    });

    expect(serialized).toEqual({
      type: 'npc',
      payload: { attitude: 'friendly' },
    });
    expect(repository.get('entity-1')).toEqual(serialized);

    const result = harness.executeCallable(() => 'callable-result');
    expect(result).toBe('callable-result');

    expect(logger.getErrorMessages()).toHaveLength(0);
  });

  it('logs and throws when repository dependency is absent', () => {
    expect(
      () =>
        new IntegrationHarness({
          repository: null,
          adapter,
          logger,
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain(
      'IntegrationHarness requires a repository instance.'
    );
  });

  it('logs and throws when repository lacks required methods', () => {
    const brokenRepository = { add() {}, get() {}, has() {} };

    expect(
      () =>
        new IntegrationHarness({
          repository: brokenRepository,
          adapter,
          logger,
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain(
      'IntegrationHarness repository must implement basic map operations.'
    );
  });

  it('logs and throws when adapter lacks serialize()', () => {
    const brokenAdapter = {};

    expect(
      () =>
        new IntegrationHarness({
          repository,
          adapter: brokenAdapter,
          logger,
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain(
      'IntegrationHarness requires an adapter with serialize().'
    );
  });

  it('surfaces invalid ids via assertValidId integration', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    expect(() =>
      harness.registerRecord('  ', {
        type: 'npc',
        payload: {},
        serialize() {
          return { type: this.type };
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain('Invalid ID');
  });

  it('propagates invalid record types via assertNonBlankString', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    expect(() =>
      harness.registerRecord('entity-2', {
        type: '   ',
        payload: {},
        serialize() {
          return { type: this.type };
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain('Invalid type');
  });

  it('enforces record contract requirements with validateDependency', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    expect(() =>
      harness.registerRecord('entity-3', {
        type: 'npc',
        payload: {},
      })
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain(
      "Invalid or missing method 'serialize'"
    );
  });

  it('requires callables when executing functions', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    expect(() => harness.executeCallable(null)).toThrow(InvalidArgumentError);
    expect(logger.getErrorMessages()[0]).toContain(
      'Missing required dependency: IntegrationHarness: callable.'
    );

    logger.records = [];

    expect(() => harness.executeCallable({})).toThrow(InvalidArgumentError);
    expect(logger.getErrorMessages()[0]).toContain(
      "Dependency 'IntegrationHarness: callable' must be a function"
    );
  });

  it('falls back to console logging when logger lacks error()', () => {
    const fallbackLogger = { debug() {} };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() =>
      validateDependency(
        { broken: true },
        'Fallback dependency',
        fallbackLogger,
        { requiredMethods: ['serialize'] }
      )
    ).toThrow(InvalidArgumentError);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid or missing method 'serialize'")
    );

    consoleSpy.mockRestore();
  });

  it('propagates errors surfaced by validateDependencies()', () => {
    expect(() =>
      validateDependencies(
        [
          {
            dependency: repository,
            name: 'Repository contract',
            methods: ['add', 'nonexistent'],
          },
        ],
        logger
      )
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain(
      "Invalid or missing method 'nonexistent'"
    );
  });

  it('integrates with idValidation helper for success and failure paths', () => {
    const harness = new IntegrationHarness({ repository, adapter, logger });

    expect(idValidation.isValidId('entity-4', 'context', logger)).toBe(true);
    expect(idValidation.isValidId('', 'context', logger)).toBe(false);

    expect(() =>
      idValidation.validateInstanceAndComponent(
        'entity-4',
        '',
        logger,
        'idValidationScenario'
      )
    ).toThrow(InvalidArgumentError);

    expect(logger.getErrorMessages()[0]).toContain('Invalid ID');
    expect(logger.getErrorMessages()[1]).toContain('Invalid componentTypeId');
  });
});
