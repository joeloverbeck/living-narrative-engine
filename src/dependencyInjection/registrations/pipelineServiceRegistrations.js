/**
 * @file pipelineServiceRegistrations.js - Registration for pipeline services
 * @see baseContainerConfig.js
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { ServiceFactory } from '../../actions/pipeline/services/ServiceFactory.js';
import { ServiceRegistry } from '../../actions/pipeline/services/ServiceRegistry.js';
import { TargetDependencyResolver } from '../../actions/pipeline/services/implementations/TargetDependencyResolver.js';
import { LegacyTargetCompatibilityLayer } from '../../actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';

/**
 * Register pipeline services for multi-target resolution
 *
 * This function registers:
 * - Service infrastructure (Factory and Registry)
 * - Placeholder implementations for the 4 decomposed services
 *
 * The placeholder implementations will be replaced in subsequent tickets:
 * - Ticket 02: TargetDependencyResolver
 * - Ticket 03: LegacyTargetCompatibilityLayer
 * - Ticket 05: ScopeContextBuilder
 * - Ticket 06: TargetDisplayNameResolver
 *
 * @param {import('../appContainer.js').default} container - The DI container
 */
export function registerPipelineServices(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);

  logger.debug('Pipeline Service Registration: Starting...');

  // Register service infrastructure
  registrar.singletonFactory(tokens.IPipelineServiceFactory, (c) => {
    return new ServiceFactory({
      container: c,
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.IPipelineServiceRegistry, (c) => {
    return new ServiceRegistry({
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Register placeholder implementations for the 4 services
  // These will throw errors indicating which ticket implements them

  registrar.singletonFactory(tokens.ITargetDependencyResolver, (c) => {
    return new TargetDependencyResolver({
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.ILegacyTargetCompatibilityLayer, (c) => {
    return new LegacyTargetCompatibilityLayer({
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.single(
    tokens.IScopeContextBuilder,
    class PlaceholderScopeContextBuilder {
      constructor() {
        throw new Error(
          'ScopeContextBuilder implementation pending (Ticket 05: Scope Context Builder). ' +
            'This service will build evaluation contexts for scope DSL resolution.'
        );
      }
    }
  );

  registrar.single(
    tokens.ITargetDisplayNameResolver,
    class PlaceholderTargetDisplayNameResolver {
      constructor() {
        throw new Error(
          'TargetDisplayNameResolver implementation pending (Ticket 06: Target Display Name Resolver). ' +
            'This service will resolve entity display names for action formatting.'
        );
      }
    }
  );

  logger.debug('Pipeline Service Registration: Completed', {
    registeredServices: [
      'IPipelineServiceFactory',
      'IPipelineServiceRegistry',
      'ITargetDependencyResolver',
      'ILegacyTargetCompatibilityLayer (placeholder)',
      'IScopeContextBuilder (placeholder)',
      'ITargetDisplayNameResolver (placeholder)',
    ],
  });
}
