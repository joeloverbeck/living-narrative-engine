import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { Registrar } from '../../src/dependencyInjection/registrarHelpers.js';

/** @type {import('../../src/dependencyInjection/appContainer.js').default} */
let mockContainer;

beforeEach(() => {
  mockContainer = {
    register: jest.fn(),
  };
});

describe('Registrar basic behaviors', () => {
  it('throws if constructed with invalid container', () => {
    expect(() => new Registrar({})).toThrow(
      'Registrar requires a valid AppContainer instance.'
    );
  });

  it('register applies tags and resets them', () => {
    const registrar = new Registrar(mockContainer);
    registrar.tagged('a').register('tok', 1);
    expect(mockContainer.register).toHaveBeenCalledWith('tok', 1, {
      tags: ['a'],
    });
    registrar.register('tok2', 2);
    expect(mockContainer.register).toHaveBeenLastCalledWith('tok2', 2, {});
  });

  it('instance registers with isInstance flag', () => {
    const registrar = new Registrar(mockContainer);
    registrar.instance('tok', 3);
    expect(mockContainer.register).toHaveBeenCalledWith('tok', 3, {
      lifecycle: 'singleton',
      isInstance: true,
    });
  });

  it('value registers a factory with singletonFactory lifecycle', () => {
    const registrar = new Registrar(mockContainer);
    registrar.value('tok', 4);
    const [[token, factory, opts]] = mockContainer.register.mock.calls;
    expect(token).toBe('tok');
    expect(typeof factory).toBe('function');
    expect(opts).toEqual({ lifecycle: 'singletonFactory' });
    expect(factory()).toBe(4);
  });

  it('single and transient use proper lifecycles', () => {
    /**
     *
     */
    function C() {}
    const registrar = new Registrar(mockContainer);
    registrar.single('s', C, ['d']);
    registrar.transient('t', C, ['d2']);
    expect(mockContainer.register).toHaveBeenNthCalledWith(1, 's', C, {
      lifecycle: 'singleton',
      dependencies: ['d'],
    });
    expect(mockContainer.register).toHaveBeenNthCalledWith(2, 't', C, {
      lifecycle: 'transient',
      dependencies: ['d2'],
    });
  });

  it('singletonFactory throws for non-function', () => {
    const registrar = new Registrar(mockContainer);
    expect(() => registrar.singletonFactory('tok', 1)).toThrow(
      'Registrar.singletonFactory requires a function'
    );
  });

  it('transientFactory throws for non-function', () => {
    const registrar = new Registrar(mockContainer);
    expect(() => registrar.transientFactory('tok', 1)).toThrow(
      'Registrar.transientFactory requires a function'
    );
  });
});
