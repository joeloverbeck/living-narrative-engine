import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';

describe('AppContainer helper methods', () => {
  /** @type {AppContainer} */
  let container;

  beforeEach(() => {
    container = new AppContainer();
  });

  it('_instantiateClass resolves dependencies', () => {
    class Service {
      constructor({ dep }) {
        this.dep = dep;
      }
    }
    container.register('dep', 42);
    const instance = container._instantiateClass(Service, {
      dependencies: ['dep'],
      registrationKey: 'service',
    });
    expect(instance).toBeInstanceOf(Service);
    expect(instance.dep).toBe(42);
  });

  it('_invokeFactory calls factory with container', () => {
    const factory = jest.fn(() => 'value');
    const result = container._invokeFactory(factory);
    expect(factory).toHaveBeenCalledWith(container);
    expect(result).toBe('value');
  });

  it('_returnValue returns provided value', () => {
    const value = { a: 1 };
    expect(container._returnValue(value)).toBe(value);
  });
});
