/**
 * @file Dependency injection registrations for GOAP system services.
 */

import { tokens } from '../tokens.js';
import ContextAssemblyService from '../../goap/services/contextAssemblyService.js';

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
}
