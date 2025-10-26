/**
 * @file Unit tests for AppContainer - comprehensive coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';

describe('AppContainer', () => {
  /** @type {AppContainer} */
  let container;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    container = new AppContainer();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Basic Container Operations', () => {
    describe('register()', () => {
      it('should register a service with default singleton lifecycle', () => {
        const value = { test: 'value' };
        container.register('testKey', value);

        expect(container.isRegistered('testKey')).toBe(true);
      });

      it('should register a service with explicit lifecycle options', () => {
        const value = { test: 'value' };
        container.register('testKey', value, {
          lifecycle: 'transient',
          tags: ['tag1'],
        });

        expect(container.isRegistered('testKey')).toBe(true);
      });

      it('should warn when overwriting existing registration', () => {
        container.register('testKey', 'value1');
        container.register('testKey', 'value2');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'AppContainer: Service key "testKey" is already registered. Overwriting.'
        );
      });

      it('should clear existing singleton instance when re-registering singleton', () => {
        container.register('testKey', 'value1', { lifecycle: 'singleton' });
        const instance1 = container.resolve('testKey');

        container.register('testKey', 'value2', { lifecycle: 'singleton' });
        const instance2 = container.resolve('testKey');

        expect(instance1).toBe('value1');
        expect(instance2).toBe('value2');
      });

      it('should clear existing singleton instance when re-registering singletonFactory', () => {
        const factory1 = () => ({ id: 1 });
        const factory2 = () => ({ id: 2 });

        container.register('testKey', factory1, {
          lifecycle: 'singletonFactory',
        });
        const instance1 = container.resolve('testKey');

        container.register('testKey', factory2, {
          lifecycle: 'singletonFactory',
        });
        const instance2 = container.resolve('testKey');

        expect(instance1.id).toBe(1);
        expect(instance2.id).toBe(2);
      });
    });

    describe('resolve()', () => {
      it('should resolve singleton instances consistently', () => {
        const value = { test: 'singleton' };
        container.register('testKey', value, { lifecycle: 'singleton' });

        const instance1 = container.resolve('testKey');
        const instance2 = container.resolve('testKey');

        expect(instance1).toBe(value);
        expect(instance2).toBe(instance1);
      });

      it('should resolve transient instances as new each time', () => {
        const factory = () => ({ id: Math.random() });
        container.register('testKey', factory, { lifecycle: 'transient' });

        const instance1 = container.resolve('testKey');
        const instance2 = container.resolve('testKey');

        expect(instance1).not.toBe(instance2);
        expect(instance1.id).not.toBe(instance2.id);
      });

      it('should resolve singletonFactory instances consistently', () => {
        const factory = () => ({ id: 'singleton-factory' });
        container.register('testKey', factory, {
          lifecycle: 'singletonFactory',
        });

        const instance1 = container.resolve('testKey');
        const instance2 = container.resolve('testKey');

        expect(instance1).toBe(instance2);
        expect(instance1.id).toBe('singleton-factory');
      });

      it('should default lifecycle to singleton when undefined', () => {
        let created = 0;
        const factory = jest.fn(() => ({ id: ++created }));

        container.register('defaultLifecycle', factory, { lifecycle: undefined });

        const first = container.resolve('defaultLifecycle');
        const second = container.resolve('defaultLifecycle');

        expect(first).toBe(second);
        expect(first.id).toBe(1);
        expect(factory).toHaveBeenCalledTimes(1);
      });

      it('should throw error for unknown lifecycle', () => {
        container.register('testKey', 'value', { lifecycle: 'unknown' });

        expect(() => container.resolve('testKey')).toThrow(
          'AppContainer: Unknown lifecycle "unknown" for key "testKey".'
        );
      });

      it('should throw error for unregistered service', () => {
        expect(() => container.resolve('nonExistent')).toThrow(
          'AppContainer: No service registered for key "nonExistent". Known keys: []'
        );
      });

      it('should include known keys in error message for unregistered service', () => {
        container.register('key1', 'value1');
        container.register('key2', 'value2');

        expect(() => container.resolve('nonExistent')).toThrow(
          'AppContainer: No service registered for key "nonExistent". Known keys: [key1, key2]'
        );
      });

      it('should handle singleton creation errors and log them', () => {
        const throwingFactory = () => {
          throw new Error('Creation failed');
        };
        container.register('testKey', throwingFactory, {
          lifecycle: 'singleton',
        });

        expect(() => container.resolve('testKey')).toThrow(
          'Failed to create instance for "testKey" (lifecycle: singleton): Creation failed'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'AppContainer: Error creating singleton instance for "testKey":',
          expect.any(Error)
        );
      });

      it('should handle transient creation errors and log them', () => {
        const throwingFactory = () => {
          throw new Error('Creation failed');
        };
        container.register('testKey', throwingFactory, {
          lifecycle: 'transient',
        });

        expect(() => container.resolve('testKey')).toThrow(
          'Failed to create instance for "testKey" (lifecycle: transient): Creation failed'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'AppContainer: Error creating transient instance for "testKey":',
          expect.any(Error)
        );
      });
    });

    describe('isRegistered()', () => {
      it('should return true for registered services', () => {
        container.register('testKey', 'value');
        expect(container.isRegistered('testKey')).toBe(true);
      });

      it('should return false for unregistered services', () => {
        expect(container.isRegistered('nonExistent')).toBe(false);
      });

      it('should handle symbol keys', () => {
        const symbolKey = Symbol('test');
        container.register(symbolKey, 'value');
        expect(container.isRegistered(symbolKey)).toBe(true);
      });
    });
  });

  describe('Override System', () => {
    beforeEach(() => {
      container.register('originalKey', 'originalValue');
    });

    describe('setOverride()', () => {
      it('should override with a simple value', () => {
        container.setOverride('originalKey', 'overriddenValue');

        const result = container.resolve('originalKey');
        expect(result).toBe('overriddenValue');
      });

      it('should override with a factory function', () => {
        const factoryFn = jest.fn(() => 'factoryResult');
        container.setOverride('originalKey', factoryFn);

        const result = container.resolve('originalKey');
        expect(result).toBe('factoryResult');
        expect(factoryFn).toHaveBeenCalled();
      });

      it('should call factory function each time for function overrides', () => {
        let counter = 0;
        const factoryFn = () => ++counter;
        container.setOverride('originalKey', factoryFn);

        const result1 = container.resolve('originalKey');
        const result2 = container.resolve('originalKey');

        expect(result1).toBe(1);
        expect(result2).toBe(2);
      });

      it('should handle non-function override values directly', () => {
        const objectValue = { test: 'object' };
        container.setOverride('originalKey', objectValue);

        const result = container.resolve('originalKey');
        expect(result).toBe(objectValue);
      });

      it('should override services that are not originally registered', () => {
        container.setOverride('newKey', 'overrideValue');

        const result = container.resolve('newKey');
        expect(result).toBe('overrideValue');
      });
    });

    describe('clearOverride()', () => {
      it('should remove specific override and restore original', () => {
        container.setOverride('originalKey', 'overriddenValue');
        expect(container.resolve('originalKey')).toBe('overriddenValue');

        container.clearOverride('originalKey');
        expect(container.resolve('originalKey')).toBe('originalValue');
      });

      it('should handle clearing non-existent overrides gracefully', () => {
        expect(() => container.clearOverride('nonExistent')).not.toThrow();
      });
    });

    describe('clearOverrides()', () => {
      it('should remove all overrides and restore originals', () => {
        container.register('key1', 'original1');
        container.register('key2', 'original2');

        container.setOverride('originalKey', 'override0');
        container.setOverride('key1', 'override1');
        container.setOverride('key2', 'override2');

        expect(container.resolve('originalKey')).toBe('override0');
        expect(container.resolve('key1')).toBe('override1');
        expect(container.resolve('key2')).toBe('override2');

        container.clearOverrides();

        expect(container.resolve('originalKey')).toBe('originalValue');
        expect(container.resolve('key1')).toBe('original1');
        expect(container.resolve('key2')).toBe('original2');
      });

      it('should handle empty override map gracefully', () => {
        expect(() => container.clearOverrides()).not.toThrow();
      });
    });
  });

  describe('Tag-based Resolution', () => {
    describe('resolveByTag()', () => {
      it('should resolve all services with specified tag', () => {
        container.register('service1', 'value1', { tags: ['tag1', 'common'] });
        container.register('service2', 'value2', { tags: ['tag2', 'common'] });
        container.register('service3', 'value3', { tags: ['tag1'] });
        container.register('service4', 'value4', { tags: ['other'] });

        const commonServices = container.resolveByTag('common');
        const tag1Services = container.resolveByTag('tag1');

        expect(commonServices).toHaveLength(2);
        expect(commonServices).toContain('value1');
        expect(commonServices).toContain('value2');

        expect(tag1Services).toHaveLength(2);
        expect(tag1Services).toContain('value1');
        expect(tag1Services).toContain('value3');
      });

      it('should return empty array for non-existent tag', () => {
        container.register('service1', 'value1', { tags: ['tag1'] });

        const result = container.resolveByTag('nonExistentTag');
        expect(result).toEqual([]);
      });

      it('should handle services with no tags', () => {
        container.register('service1', 'value1');
        container.register('service2', 'value2', { tags: [] });

        const result = container.resolveByTag('anyTag');
        expect(result).toEqual([]);
      });

      it('should handle resolution errors gracefully and log them', () => {
        // Register a service that will fail during resolution
        const throwingFactory = () => {
          throw new Error('Resolution failed');
        };
        container.register('failingService', throwingFactory, {
          lifecycle: 'transient',
          tags: ['testTag'],
        });
        container.register('workingService', 'value', { tags: ['testTag'] });

        const result = container.resolveByTag('testTag');

        expect(result).toHaveLength(1);
        expect(result).toContain('value');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'AppContainer: Error resolving tagged instance "failingService" for tag "testTag":',
          expect.any(Error)
        );
      });

      it('should work with factory functions', () => {
        const factory1 = () => ({ type: 'factory1' });
        const factory2 = () => ({ type: 'factory2' });

        container.register('factory1', factory1, { tags: ['factories'] });
        container.register('factory2', factory2, { tags: ['factories'] });

        const factories = container.resolveByTag('factories');

        expect(factories).toHaveLength(2);
        expect(factories[0].type).toBeDefined();
        expect(factories[1].type).toBeDefined();
      });
    });
  });

  describe('Container Management', () => {
    describe('disposeSingletons()', () => {
      it('should clear all singleton instances and log action', () => {
        container.register('singleton1', 'value1', { lifecycle: 'singleton' });
        container.register('singleton2', 'value2', { lifecycle: 'singleton' });

        // Force creation of instances
        container.resolve('singleton1');
        container.resolve('singleton2');

        container.disposeSingletons();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'AppContainer: Disposing singleton instances...'
        );

        // Verify new instances are created
        const newInstance1 = container.resolve('singleton1');
        const newInstance2 = container.resolve('singleton2');

        expect(newInstance1).toBe('value1');
        expect(newInstance2).toBe('value2');
      });

      it('should not affect transient services', () => {
        const factory = () => ({ id: Math.random() });
        container.register('transient', factory, { lifecycle: 'transient' });

        const instance1 = container.resolve('transient');
        container.disposeSingletons();
        const instance2 = container.resolve('transient');

        expect(instance1).not.toBe(instance2);
      });
    });

    describe('reset()', () => {
      it('should clear all registrations and instances and log action', () => {
        container.register('service1', 'value1');
        container.register('service2', 'value2');

        // Force creation of instances
        container.resolve('service1');
        container.resolve('service2');

        expect(container.isRegistered('service1')).toBe(true);
        expect(container.isRegistered('service2')).toBe(true);

        container.reset();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'AppContainer: Resetting container (registrations and instances)...'
        );

        expect(container.isRegistered('service1')).toBe(false);
        expect(container.isRegistered('service2')).toBe(false);

        expect(() => container.resolve('service1')).toThrow();
        expect(() => container.resolve('service2')).toThrow();
      });

      it('should not clear overrides when resetting (overrides persist)', () => {
        container.register('service', 'original');
        container.setOverride('service', 'override');

        expect(container.resolve('service')).toBe('override');

        container.reset();

        // After reset, overrides still work even though registrations are cleared
        expect(container.resolve('service')).toBe('override');

        // But registration is gone
        expect(container.isRegistered('service')).toBe(false);
      });
    });

    describe('cleanup()', () => {
      it('should dispose singletons, clear overrides, and log actions', () => {
        let instanceCounter = 0;
        const factory = jest.fn(() => ({ id: ++instanceCounter }));

        container.register('service', factory); // defaults to singleton lifecycle
        const initialInstance = container.resolve('service');
        expect(initialInstance.id).toBe(1);

        container.setOverride('service', 'override-value');
        expect(container.resolve('service')).toBe('override-value');

        container.cleanup();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'AppContainer: Cleaning up container for tests...'
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'AppContainer: Disposing singleton instances...'
        );

        const newInstance = container.resolve('service');
        expect(newInstance.id).toBe(2);
        expect(factory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Callback Handling', () => {
    it('should throw when registering a non-function callback', () => {
      expect(() => container.registerCallback('not-a-function')).toThrow(
        'AppContainer: Callback must be a function'
      );
    });

    it('should log and rethrow errors thrown by callbacks', () => {
      const erroringCallback = jest.fn(() => {
        throw new Error('Callback failed');
      });

      container.registerCallback(() => {});
      container.registerCallback(erroringCallback);

      expect(() => container.executeCallbacks()).toThrow('Callback failed');
      expect(erroringCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AppContainer: Error executing callback:',
        expect.any(Error)
      );
    });
  });

  describe('Class Instantiation with Dependencies', () => {
    it('should instantiate class with resolved dependencies', () => {
      class TestService {
        constructor({ dependency1, dependency2 }) {
          this.dep1 = dependency1;
          this.dep2 = dependency2;
        }
      }

      container.register('IDependency1', 'value1');
      container.register('IDependency2', 'value2');
      container.register('testService', TestService, {
        lifecycle: 'singleton',
        dependencies: ['IDependency1', 'IDependency2'],
      });

      const instance = container.resolve('testService');

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.dep1).toBe('value1');
      expect(instance.dep2).toBe('value2');
    });

    it('should handle I-prefix interface naming conventions', () => {
      class TestService {
        constructor({ logger, eventBus }) {
          this.logger = logger;
          this.eventBus = eventBus;
        }
      }

      container.register('ILogger', 'loggerInstance');
      container.register('IEventBus', 'eventBusInstance');
      container.register('testService', TestService, {
        dependencies: ['ILogger', 'IEventBus'],
      });

      const instance = container.resolve('testService');

      expect(instance.logger).toBe('loggerInstance');
      expect(instance.eventBus).toBe('eventBusInstance');
    });

    it('should handle dependency resolution failure and log error', () => {
      class TestService {
        constructor({ dependency }) {
          this.dependency = dependency;
        }
      }

      container.register('testService', TestService, {
        dependencies: ['nonExistentDep'],
      });

      expect(() => container.resolve('testService')).toThrow(
        'Failed to resolve dependency "nonExistentDep" needed by "TestService" (registered as "testService")'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AppContainer._instantiateClass for testService] FAILED dependency resolution: Cannot resolve "nonExistentDep" (for prop "nonExistentDep") needed by "TestService".',
        expect.any(Error)
      );
    });

    it('should handle empty dependencies array', () => {
      class TestService {
        constructor({}) {
          this.initialized = true;
        }
      }

      container.register('testService', TestService, {
        dependencies: [],
      });

      const instance = container.resolve('testService');

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.initialized).toBe(true);
    });

    it('should handle anonymous classes', () => {
      const AnonymousClass = class {
        constructor({ dependency }) {
          this.dep = dependency;
        }
      };

      container.register('dependency', 'depValue');
      container.register('anonymous', AnonymousClass, {
        dependencies: ['dependency'],
      });

      const instance = container.resolve('anonymous');

      expect(instance).toBeInstanceOf(AnonymousClass);
      expect(instance.dep).toBe('depValue');
    });

    it('should handle single character property names', () => {
      class TestService {
        constructor({ a, b }) {
          this.a = a;
          this.b = b;
        }
      }

      container.register('A', 'valueA');
      container.register('B', 'valueB');
      container.register('testService', TestService, {
        dependencies: ['A', 'B'],
      });

      const instance = container.resolve('testService');

      expect(instance.a).toBe('valueA');
      expect(instance.b).toBe('valueB');
    });
  });

  describe('Factory Function Execution', () => {
    it('should pass container to factory function', () => {
      const factory = jest.fn((container) => {
        const dep = container.resolve('dependency');
        return { dep };
      });

      container.register('dependency', 'depValue');
      container.register('factoryService', factory);

      const instance = container.resolve('factoryService');

      expect(factory).toHaveBeenCalledWith(container);
      expect(instance.dep).toBe('depValue');
    });

    it('should distinguish between class and factory registrations', () => {
      // Factory function (no dependencies option)
      const factory = () => ({ type: 'factory' });
      container.register('factory', factory);

      // Class registration (with dependencies option)
      class TestClass {
        constructor({}) {
          this.type = 'class';
        }
      }
      container.register('class', TestClass, { dependencies: [] });

      const factoryInstance = container.resolve('factory');
      const classInstance = container.resolve('class');

      expect(factoryInstance.type).toBe('factory');
      expect(classInstance.type).toBe('class');
      expect(classInstance).toBeInstanceOf(TestClass);
    });
  });

  describe('Value Registration', () => {
    it('should return registered values directly', () => {
      const value = { complex: 'object', nested: { data: true } };
      container.register('value', value);

      const resolved = container.resolve('value');

      expect(resolved).toBe(value);
    });

    it('should handle primitive values', () => {
      container.register('string', 'test');
      container.register('number', 42);
      container.register('boolean', true);
      container.register('null', null);

      expect(container.resolve('string')).toBe('test');
      expect(container.resolve('number')).toBe(42);
      expect(container.resolve('boolean')).toBe(true);
      expect(container.resolve('null')).toBe(null);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex dependency graphs', () => {
      class Logger {
        constructor({}) {
          this.logs = [];
        }
        log(message) {
          this.logs.push(message);
        }
      }

      class Database {
        constructor({ logger }) {
          this.logger = logger;
          this.connected = true;
        }
      }

      class UserService {
        constructor({ database, logger }) {
          this.database = database;
          this.logger = logger;
        }
      }

      container.register('ILogger', Logger, { dependencies: [] });
      container.register('IDatabase', Database, { dependencies: ['ILogger'] });
      container.register('IUserService', UserService, {
        dependencies: ['IDatabase', 'ILogger'],
      });

      const userService = container.resolve('IUserService');

      expect(userService).toBeInstanceOf(UserService);
      expect(userService.database).toBeInstanceOf(Database);
      expect(userService.logger).toBeInstanceOf(Logger);
      expect(userService.database.logger).toBe(userService.logger); // Same singleton instance
    });

    it('should work with overrides in complex scenarios', () => {
      class RealService {
        getName() {
          return 'real';
        }
      }

      class MockService {
        getName() {
          return 'mock';
        }
      }

      container.register('service', RealService, { dependencies: [] });

      expect(container.resolve('service').getName()).toBe('real');

      container.setOverride('service', new MockService());

      expect(container.resolve('service').getName()).toBe('mock');
    });
  });
});
