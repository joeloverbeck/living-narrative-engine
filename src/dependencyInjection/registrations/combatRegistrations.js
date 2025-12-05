/**
 * @file Combat service DI registrations
 * @see specs/non-deterministic-actions-system.md
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import ChanceCalculationService from '../../combat/services/ChanceCalculationService.js';
import ModifierContextBuilder from '../../combat/services/ModifierContextBuilder.js';
import ModifierCollectorService from '../../combat/services/ModifierCollectorService.js';
import OutcomeDeterminerService from '../../combat/services/OutcomeDeterminerService.js';
import ProbabilityCalculatorService from '../../combat/services/ProbabilityCalculatorService.js';
import SkillResolverService from '../../combat/services/SkillResolverService.js';

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

  // Register ModifierContextBuilder
  registrar.singletonFactory(tokens.ModifierContextBuilder, (c) =>
    new ModifierContextBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register ModifierCollectorService
  registrar.singletonFactory(tokens.ModifierCollectorService, (c) =>
    new ModifierCollectorService({
      entityManager: c.resolve(tokens.IEntityManager),
      modifierContextBuilder: c.resolve(tokens.ModifierContextBuilder),
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register ChanceCalculationService (orchestrator)
  registrar.singletonFactory(tokens.ChanceCalculationService, (c) =>
    new ChanceCalculationService({
      skillResolverService: c.resolve(tokens.SkillResolverService),
      modifierCollectorService: c.resolve(tokens.ModifierCollectorService),
      probabilityCalculatorService: c.resolve(tokens.ProbabilityCalculatorService),
      outcomeDeterminerService: c.resolve(tokens.OutcomeDeterminerService),
      logger: c.resolve(tokens.ILogger),
    })
  );
}

export default registerCombatServices;
