/**
 * @file Combat service DI registrations
 * @see specs/non-deterministic-actions-system.md
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import SkillResolverService from '../../combat/services/SkillResolverService.js';
import ProbabilityCalculatorService from '../../combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../combat/services/OutcomeDeterminerService.js';

/**
 * Register combat services with the DI container.
 *
 * @param {import('../appContainer.js').default} container - DI container
 */
export function registerCombatServices(container) {
  const registrar = new Registrar(container);

  // Register SkillResolverService
  registrar.singletonFactory(tokens.SkillResolverService, (c) =>
    new SkillResolverService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register ProbabilityCalculatorService
  registrar.singletonFactory(tokens.ProbabilityCalculatorService, (c) =>
    new ProbabilityCalculatorService({
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register OutcomeDeterminerService
  registrar.singletonFactory(tokens.OutcomeDeterminerService, (c) =>
    new OutcomeDeterminerService({
      logger: c.resolve(tokens.ILogger),
    })
  );
}

export default registerCombatServices;
