import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  assertPresent,
  assertFunction,
  assertMethods,
  assertValidId,
  assertNonBlankString,
  validateDependency,
  validateDependencies,
} from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { MapManager } from '../../../src/utils/mapManagerUtils.js';

/**
 * These tests exercise dependencyUtils against concrete modules instead of mocks to
 * demonstrate real-world wiring scenarios and error propagation behaviour.
 */
describe('dependencyUtils real module integration – full coverage', () => {
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wires real modules with dependency guards and shared validation', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    // Drop constructor logging noise so later assertions are meaningful.
    consoleInfoSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();

    const repository = new MapManager({ throwOnInvalidId: true });

    // Exercise early-return branch for validateDependencies.
    expect(() => validateDependencies(null, logger)).not.toThrow();

    expect(() =>
      assertPresent(
        repository,
        'Entity repository must be available',
        InvalidArgumentError,
        logger
      )
    ).not.toThrow();

    expect(() =>
      assertFunction(
        repository,
        'add',
        'Entity repository requires add()',
        InvalidArgumentError,
        logger
      )
    ).not.toThrow();

    expect(() =>
      assertMethods(
        repository,
        ['add', 'get', 'remove', 'has', 'clear'],
        'Entity repository missing map operations',
        InvalidArgumentError,
        logger
      )
    ).not.toThrow();

    expect(() =>
      validateDependency(repository, 'EntityRepository', logger, {
        requiredMethods: ['add', 'get', 'remove'],
      })
    ).not.toThrow();

    const lookup = (id) => repository.get(id);
    expect(() =>
      validateDependency(lookup, 'RepositoryLookup', logger, {
        isFunction: true,
      })
    ).not.toThrow();

    expect(() =>
      validateDependencies(
        [
          {
            dependency: repository,
            name: 'EntityRepository',
            methods: ['add', 'get', 'remove'],
          },
          { dependency: lookup, name: 'RepositoryLookup', isFunction: true },
        ],
        logger
      )
    ).not.toThrow();

    // Exercise default argument paths where optional parameters are omitted.
    expect(() => assertPresent('ready', 'Defaults permitted')).not.toThrow();

    expect(() =>
      assertFunction({ run() {} }, 'run', 'Defaults permitted')
    ).not.toThrow();

    expect(() =>
      assertMethods(
        { start() {}, stop() {} },
        ['start', 'stop'],
        'Defaults permitted'
      )
    ).not.toThrow();

    expect(() => validateDependency(() => {}, 'CallableDefault')).not.toThrow();

    expect(() =>
      assertValidId('entity-42', 'EntityRepository', logger)
    ).not.toThrow();
    expect(() =>
      assertNonBlankString(
        'Display Name',
        'displayName',
        'EntityRepository',
        logger
      )
    ).not.toThrow();

    repository.add('entity-42', { id: 'entity-42', name: 'Display Name' });
    expect(repository.has('entity-42')).toBe(true);
    expect(repository.get('entity-42')).toEqual({
      id: 'entity-42',
      name: 'Display Name',
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('surfaces descriptive errors for invalid dependencies and falls back gracefully', () => {
    const logger = new ConsoleLogger(LogLevel.ERROR);
    consoleInfoSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();

    expect(() =>
      assertPresent(null, 'Missing orchestrator', InvalidArgumentError, logger)
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Missing orchestrator');

    consoleErrorSpy.mockClear();
    const partialLogger = { warn: jest.fn() };
    expect(() =>
      assertPresent(
        undefined,
        'Partial logger missing dependency',
        Error,
        partialLogger
      )
    ).toThrow(Error);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockClear();
    expect(() =>
      assertFunction(
        {},
        'execute',
        'Pipeline requires execute()',
        InvalidArgumentError,
        logger
      )
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Pipeline requires execute()');

    consoleErrorSpy.mockClear();
    expect(() =>
      assertMethods(
        { start() {} },
        ['start', 'stop'],
        'Lifecycle API incomplete',
        InvalidArgumentError,
        logger
      )
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Lifecycle API incomplete');

    consoleErrorSpy.mockClear();
    expect(() => assertValidId('   ', 'EntityRepository', logger)).toThrow(
      InvalidArgumentError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "EntityRepository: Invalid ID '   '. Expected non-blank string.",
      {
        receivedId: '   ',
        receivedType: 'string',
        context: 'EntityRepository',
      }
    );

    consoleErrorSpy.mockClear();
    expect(() =>
      assertNonBlankString('', 'displayName', 'EntityRepository', logger)
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "EntityRepository: Invalid displayName ''. Expected non-blank string.",
      expect.objectContaining({
        receivedValue: '',
        receivedType: 'string',
        parameterName: 'displayName',
        context: 'EntityRepository',
      })
    );

    consoleErrorSpy.mockClear();
    expect(() => validateDependency(null, 'MissingService', logger)).toThrow(
      InvalidArgumentError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: MissingService.'
    );

    consoleErrorSpy.mockClear();
    expect(() =>
      validateDependency({}, 'CallableDependency', logger, { isFunction: true })
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Dependency 'CallableDependency' must be a function, but got object."
    );

    consoleErrorSpy.mockClear();
    expect(() =>
      validateDependency({ init() {} }, 'LifecycleService', logger, {
        requiredMethods: ['init', 'shutdown'],
      })
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid or missing method 'shutdown' on dependency 'LifecycleService'."
    );

    consoleErrorSpy.mockClear();
    expect(() =>
      validateDependencies(
        [
          {
            dependency: { init() {} },
            name: 'BrokenService',
            methods: ['init', 'shutdown'],
          },
        ],
        logger
      )
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid or missing method 'shutdown' on dependency 'BrokenService'."
    );

    consoleErrorSpy.mockClear();
    expect(() =>
      validateDependency(undefined, 'ConsoleFallback', { warn: jest.fn() })
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: ConsoleFallback.'
    );

    consoleErrorSpy.mockClear();
    const lifecycle = () => {};
    expect(() =>
      validateDependency(lifecycle, 'LifecycleFn', logger, { isFunction: true })
    ).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
