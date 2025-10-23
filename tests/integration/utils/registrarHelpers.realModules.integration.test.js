import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import {
  Registrar,
  registerWithLog,
  resolveOptional,
} from '../../../src/utils/registrarHelpers.js';

describe('Registrar helpers with real AppContainer', () => {
  let container;
  let registrar;
  let logger;

  beforeEach(() => {
    container = new AppContainer();
    registrar = new Registrar(container);
    logger = { debug: jest.fn() };
  });

  it('requires a valid container instance', () => {
    expect(() => new Registrar(null)).toThrow(
      'Registrar requires a valid AppContainer instance.'
    );
    const invalidContainer = { register: null };
    expect(() => new Registrar(invalidContainer)).toThrow(
      'Registrar requires a valid AppContainer instance.'
    );
  });

  it('applies tags to the next registration and resets afterwards', () => {
    class TaggedService {}
    class SingleTagService {}
    class UntaggedService {}

    registrar.tagged(['ui', 'manager']).single('TaggedService', TaggedService);

    const uiTaggedInstances = container.resolveByTag('ui');
    expect(uiTaggedInstances).toHaveLength(1);
    expect(uiTaggedInstances[0]).toBeInstanceOf(TaggedService);

    const managerTaggedInstances = container.resolveByTag('manager');
    expect(managerTaggedInstances).toHaveLength(1);
    expect(managerTaggedInstances[0]).toBeInstanceOf(TaggedService);

    registrar.tagged('singleTag').single('SingleTagService', SingleTagService);
    const singleTagInstances = container.resolveByTag('singleTag');
    expect(singleTagInstances).toHaveLength(1);
    expect(singleTagInstances[0]).toBeInstanceOf(SingleTagService);

    registrar.single('UntaggedService', UntaggedService);

    // The subsequent registration should not inherit tags
    expect(container.resolveByTag('singleTag')).toHaveLength(1);
    expect(container.resolve('UntaggedService')).toBeInstanceOf(UntaggedService);
  });

  it('creates singleton services with dependency resolution', () => {
    const config = { featureEnabled: true };
    registrar.instance('ConfigService', config);

    class DependentService {
      constructor({ configService }) {
        this.configService = configService;
        this.createdAt = Date.now();
      }
    }

    registrar.single('DependentService', DependentService, ['ConfigService']);

    const first = container.resolve('DependentService');
    const second = container.resolve('DependentService');

    expect(first).toBe(second);
    expect(first.configService).toBe(config);
  });

  it('registers direct instances and value factories as singletons', () => {
    const directInstance = { id: 'instance' };
    registrar.instance('DirectInstance', directInstance);

    const resolvedInstanceA = container.resolve('DirectInstance');
    const resolvedInstanceB = container.resolve('DirectInstance');
    expect(resolvedInstanceA).toBe(directInstance);
    expect(resolvedInstanceB).toBe(directInstance);

    const valueObject = { mode: 'value' };
    registrar.value('ValueToken', valueObject);

    const resolvedValueA = container.resolve('ValueToken');
    const resolvedValueB = container.resolve('ValueToken');
    expect(resolvedValueA).toEqual(valueObject);
    expect(resolvedValueA).toBe(resolvedValueB);
  });

  it('supports singletonFactory registrations and validates inputs', () => {
    let factoryInvocationCount = 0;
    registrar.singletonFactory('GeneratedService', () => {
      factoryInvocationCount += 1;
      return { id: factoryInvocationCount };
    });

    const generatedA = container.resolve('GeneratedService');
    const generatedB = container.resolve('GeneratedService');

    expect(generatedA).toBe(generatedB);
    expect(factoryInvocationCount).toBe(1);

    expect(() => registrar.singletonFactory('InvalidFactory', 123)).toThrow(
      'Registrar.singletonFactory requires a function for token "InvalidFactory"'
    );
  });

  it('creates transient registrations and transient factories', () => {
    class TransientService {
      constructor() {
        this.createdAt = Date.now();
      }
    }

    registrar.transient('TransientService', TransientService);

    const transientA = container.resolve('TransientService');
    const transientB = container.resolve('TransientService');

    expect(transientA).toBeInstanceOf(TransientService);
    expect(transientB).toBeInstanceOf(TransientService);
    expect(transientA).not.toBe(transientB);

    let invocationCount = 0;
    registrar.transientFactory('TransientFactory', () => ({
      createdAt: ++invocationCount,
    }));

    const factoryA = container.resolve('TransientFactory');
    const factoryB = container.resolve('TransientFactory');
    expect(factoryA.createdAt).toBe(1);
    expect(factoryB.createdAt).toBe(2);

    expect(() => registrar.transientFactory('BadFactory', 42)).toThrow(
      'Registrar.transientFactory requires a function for token "BadFactory"'
    );
  });

  it('registers services via registerWithLog direct signature', () => {
    const value = { id: 'direct' };
    registerWithLog(registrar, 'DirectToken', value, { lifecycle: 'singleton' }, logger);

    const resolved = container.resolve('DirectToken');
    expect(resolved).toEqual(value);
    expect(logger.debug).toHaveBeenCalledWith(
      'UI Registrations: Registered DirectToken.'
    );

    // Without logger
    registerWithLog(registrar, 'SilentToken', { silent: true });
    expect(container.resolve('SilentToken')).toEqual({ silent: true });
  });

  it('registers via registerWithLog logger-first signature and validates method name', () => {
    class ToolService {}
    registerWithLog(registrar, logger, 'single', 'ToolService', ToolService);

    const resolved = container.resolve('ToolService');
    expect(resolved).toBeInstanceOf(ToolService);
    expect(logger.debug).toHaveBeenCalledWith(
      'UI Registrations: Registered ToolService.'
    );

    expect(() =>
      registerWithLog(registrar, logger, 'unknownMethod', 'UnknownToken')
    ).toThrow('Unknown registrar method: unknownMethod');
  });

  it('resolveOptional returns null for missing registrations', () => {
    expect(resolveOptional(container, 'missing')).toBeNull();

    class OptionalService {}
    registrar.single('OptionalService', OptionalService);

    const resolved = resolveOptional(container, 'OptionalService');
    expect(resolved).toBeInstanceOf(OptionalService);
  });
});
