import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { registerPipelineServices } from '../../../../src/dependencyInjection/registrations/pipelineServiceRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { ServiceFactory } from '../../../../src/actions/pipeline/services/ServiceFactory.js';
import { ServiceRegistry } from '../../../../src/actions/pipeline/services/ServiceRegistry.js';
import { TargetDependencyResolver } from '../../../../src/actions/pipeline/services/implementations/TargetDependencyResolver.js';
import { LegacyTargetCompatibilityLayer } from '../../../../src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';
import { ScopeContextBuilder } from '../../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import { TargetDisplayNameResolver } from '../../../../src/actions/pipeline/services/implementations/TargetDisplayNameResolver.js';

const EXPECTED_TOKENS = [
  tokens.IPipelineServiceFactory,
  tokens.IPipelineServiceRegistry,
  tokens.ITargetDependencyResolver,
  tokens.ILegacyTargetCompatibilityLayer,
  tokens.IScopeContextBuilder,
  tokens.ITargetDisplayNameResolver,
];

describe('registerPipelineServices', () => {
  /** @type {ReturnType<typeof createContainer>} */
  let container;
  let logger;
  let registrations;
  let resolvedMap;

  function createContainer() {
    return {
      register: jest.fn((token, factory, options) => {
        registrations.push({ token, factory, options });
      }),
      resolve: jest.fn((token) => {
        if (!resolvedMap.has(token)) {
          throw new Error(`Unexpected resolve token: ${String(token)}`);
        }
        return resolvedMap.get(token);
      }),
    };
  }

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registrations = [];
    resolvedMap = new Map([[tokens.ILogger, logger]]);
    container = createContainer();
  });

  it('registers all pipeline services with singleton factories', () => {
    registerPipelineServices(container);

    expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(logger.debug).toHaveBeenCalledWith(
      'Pipeline Service Registration: Starting...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Pipeline Service Registration: Completed',
      {
        registeredServices: [
          'IPipelineServiceFactory',
          'IPipelineServiceRegistry',
          'ITargetDependencyResolver',
          'ILegacyTargetCompatibilityLayer',
          'IScopeContextBuilder',
          'ITargetDisplayNameResolver',
        ],
      }
    );

    expect(registrations.map((entry) => entry.token)).toEqual(EXPECTED_TOKENS);
    registrations.forEach((entry) => {
      expect(entry.options).toMatchObject({ lifecycle: 'singletonFactory' });
      expect(typeof entry.factory).toBe('function');
    });
  });

  it('produces configured service instances via registered factories', () => {
    const stubContextBuilder = {
      buildBaseContext: jest.fn(() => ({ base: true })),
      buildDependentContext: jest.fn(() => ({ dependent: true })),
    };
    const stubEntityManager = {
      getEntityInstance: jest.fn(() => ({ id: 'entity-123' })),
    };

    resolvedMap.set(tokens.ITargetContextBuilder, stubContextBuilder);
    resolvedMap.set(tokens.IEntityManager, stubEntityManager);

    registerPipelineServices(container);

    // Ignore the initial logger resolution when checking dependency resolution during instantiation.
    container.resolve.mockClear();

    const instantiate = (token) => {
      const registration = registrations.find((entry) => entry.token === token);
      expect(registration).toBeDefined();
      return registration.factory(container);
    };

    const serviceFactory = instantiate(tokens.IPipelineServiceFactory);
    expect(serviceFactory).toBeInstanceOf(ServiceFactory);
    expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);

    const serviceRegistry = instantiate(tokens.IPipelineServiceRegistry);
    expect(serviceRegistry).toBeInstanceOf(ServiceRegistry);

    const dependencyResolver = instantiate(tokens.ITargetDependencyResolver);
    expect(dependencyResolver).toBeInstanceOf(TargetDependencyResolver);

    const legacyLayer = instantiate(tokens.ILegacyTargetCompatibilityLayer);
    expect(legacyLayer).toBeInstanceOf(LegacyTargetCompatibilityLayer);

    const scopeBuilder = instantiate(tokens.IScopeContextBuilder);
    expect(scopeBuilder).toBeInstanceOf(ScopeContextBuilder);
    expect(container.resolve).toHaveBeenCalledWith(tokens.ITargetContextBuilder);
    expect(container.resolve).toHaveBeenCalledWith(tokens.IEntityManager);

    const displayNameResolver = instantiate(tokens.ITargetDisplayNameResolver);
    expect(displayNameResolver).toBeInstanceOf(TargetDisplayNameResolver);
  });
});
