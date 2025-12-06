import { describe, it, expect, beforeEach } from '@jest/globals';

import { ServiceRegistry } from '../../../../../src/actions/pipeline/services/ServiceRegistry.js';
import { ServiceFactory } from '../../../../../src/actions/pipeline/services/ServiceFactory.js';
import { ServiceError } from '../../../../../src/actions/pipeline/services/base/ServiceError.js';
import AppContainer from '../../../../../src/dependencyInjection/appContainer.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, ...args) {
    this.debugMessages.push({ message, args });
  }

  info(message, ...args) {
    this.infoMessages.push({ message, args });
  }

  warn(message, ...args) {
    this.warnMessages.push({ message, args });
  }

  error(message, ...args) {
    this.errorMessages.push({ message, args });
  }
}

describe('ServiceRegistry integration with real factory and container', () => {
  let registry;
  let registryLogger;
  let container;
  let factory;

  beforeEach(() => {
    registryLogger = new TestLogger();
    registry = new ServiceRegistry({ logger: registryLogger });

    container = new AppContainer();
    factory = new ServiceFactory({ container, logger: new TestLogger() });
  });

  it('manages lifecycle and dependency metadata for services created via ServiceFactory', () => {
    container.register(
      'TestService',
      () => ({ id: 'service:test', ready: true }),
      {
        lifecycle: 'singleton',
      }
    );
    container.register(
      'DependencyService',
      () => ({ id: 'service:dependency', dependenciesSatisfied: true }),
      { lifecycle: 'singleton' }
    );

    const primaryService = factory.createService('TestService');

    registry.register('pipeline:test', primaryService, {
      version: '1.2.3',
      dependencies: ['pipeline:dependency'],
      description: 'Primary pipeline service',
    });

    const dependencyCheckBefore =
      registry.validateDependencies('pipeline:test');
    expect(dependencyCheckBefore).toEqual({
      valid: false,
      missing: ['pipeline:dependency'],
    });

    const dependencyService = factory.createService('DependencyService');
    registry.register('pipeline:dependency', dependencyService, {
      version: '2.0.0',
      description: 'Dependency service',
    });

    const dependencyCheckAfter = registry.validateDependencies('pipeline:test');
    expect(dependencyCheckAfter).toEqual({ valid: true, missing: [] });
    expect(registry.validateDependencies('pipeline:dependency')).toEqual({
      valid: true,
      missing: [],
    });

    expect(registry.has('pipeline:test')).toBe(true);
    expect(registry.get('pipeline:test')).toBe(primaryService);

    const metadata = registry.getMetadata('pipeline:test');
    expect(metadata).not.toBeNull();
    expect(metadata.version).toBe('1.2.3');
    expect(metadata.dependencies).toEqual(['pipeline:dependency']);
    expect(metadata.description).toBe('Primary pipeline service');
    expect(metadata.registeredAt).toBeInstanceOf(Date);

    const allServices = registry.getAll();
    expect(allServices.get('pipeline:test')).toBe(primaryService);
    expect(allServices.get('pipeline:dependency')).toBe(dependencyService);

    const tokens = registry.getTokens();
    expect(tokens).toEqual(
      expect.arrayContaining(['pipeline:test', 'pipeline:dependency'])
    );

    const stats = registry.getStats();
    expect(stats.totalServices).toBe(2);
    expect(stats.services['pipeline:test'].version).toBe('1.2.3');
    expect(stats.services['pipeline:dependency'].version).toBe('2.0.0');

    const unregisterResult = registry.unregister('pipeline:test');
    expect(unregisterResult).toBe(true);
    expect(registry.has('pipeline:test')).toBe(false);
    expect(registry.getMetadata('pipeline:test')).toBeNull();
    expect(registry.unregister('pipeline:test')).toBe(false);

    registry.clear();
    expect(registry.getTokens()).toHaveLength(0);

    const bareService = { id: 'pipeline:bare-service' };
    registry.register('pipeline:bare', bareService);
    expect(registry.validateDependencies('pipeline:bare')).toEqual({
      valid: true,
      missing: [],
    });

    const bareMetadata = registry.getMetadata('pipeline:bare');
    expect(bareMetadata.registeredAt).toBeInstanceOf(Date);
    const bareStats = registry.getStats();
    expect(bareStats.totalServices).toBe(1);
    expect(bareStats.services['pipeline:bare'].version).toBe('unknown');
    expect(registry.getTokens()).toEqual(['pipeline:bare']);

    expect(registryLogger.debugMessages.length).toBeGreaterThan(0);
    expect(registryLogger.infoMessages.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        'ServiceRegistry: Service registered successfully: pipeline:test',
        'ServiceRegistry: Service registered successfully: pipeline:dependency',
        'ServiceRegistry: Service unregistered: pipeline:test',
        'ServiceRegistry: Service registered successfully: pipeline:bare',
      ])
    );
    expect(registryLogger.warnMessages.map((entry) => entry.message)).toContain(
      'ServiceRegistry: Clearing all services'
    );
  });

  it('raises ServiceError for duplicate registrations and missing services', () => {
    registry.register('pipeline:duplicate', { id: 'duplicate' });

    expect(() =>
      registry.register('pipeline:duplicate', { id: 'other' })
    ).toThrow(ServiceError);
    expect(() => registry.get('pipeline:unknown')).toThrow(ServiceError);
  });
});
