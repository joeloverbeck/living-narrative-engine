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
import { ScopeContextBuilder } from '../../actions/pipeline/services/implementations/ScopeContextBuilder.js';
import { TargetDisplayNameResolver } from '../../actions/pipeline/services/implementations/TargetDisplayNameResolver.js';
import TargetResolutionTracingOrchestrator from '../../actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

/**
 * Register pipeline services for multi-target resolution
 *
 * This function registers:
 * - Service infrastructure (Factory and Registry)
 * - Placeholder implementations for the 4 decomposed services
 *
 * The placeholder implementations will be replaced in subsequent tickets:
 * - Ticket 02: TargetDependencyResolver (✓ Completed)
 * - Ticket 03: LegacyTargetCompatibilityLayer (✓ Completed)
 * - Ticket 05: ScopeContextBuilder (✓ Completed)
 * - Ticket 06: TargetDisplayNameResolver (✓ Completed)
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

  registrar.singletonFactory(tokens.IScopeContextBuilder, (c) => {
    return new ScopeContextBuilder({
      targetContextBuilder: c.resolve(tokens.ITargetContextBuilder),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.ITargetDisplayNameResolver, (c) => {
    return new TargetDisplayNameResolver({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.ITargetResolutionTracingOrchestrator, (c) => {
    return new TargetResolutionTracingOrchestrator({
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.ITargetResolutionResultBuilder, (c) => {
    return new TargetResolutionResultBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  logger.debug('Pipeline Service Registration: Completed', {
    registeredServices: [
      'IPipelineServiceFactory',
      'IPipelineServiceRegistry',
      'ITargetDependencyResolver',
      'ILegacyTargetCompatibilityLayer',
      'IScopeContextBuilder',
      'ITargetDisplayNameResolver',
      'ITargetResolutionTracingOrchestrator',
      'ITargetResolutionResultBuilder',
    ],
  });
}
