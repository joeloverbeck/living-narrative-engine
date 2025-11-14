/**
 * @file Dependency injection registrations for GOAP system services.
 */

import { tokens } from '../tokens.js';
import ContextAssemblyService from '../../goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../goap/services/parameterResolutionService.js';
import RefinementStateManager from '../../goap/refinement/refinementStateManager.js';

/**
 * Registers GOAP system services with the dependency injection container.
 *
 * @param {import('../containerBase.js').default} container - DI container
 */
export function registerGoapServices(container) {
  // Context Assembly Service
  container.register(tokens.IContextAssemblyService, ContextAssemblyService, {
    dependencies: [
      tokens.IEntityManager,
      tokens.ILogger,
      { optional: true, parameter: 'enableKnowledgeLimitation', defaultValue: false },
    ],
  });

  // Parameter Resolution Service
  container.register(tokens.IParameterResolutionService, ParameterResolutionService, {
    dependencies: [tokens.IEntityManager, tokens.ILogger],
  });

  // Refinement State Manager
  container.register(tokens.IRefinementStateManager, RefinementStateManager, {
    dependencies: [tokens.ILogger],
  });
}
