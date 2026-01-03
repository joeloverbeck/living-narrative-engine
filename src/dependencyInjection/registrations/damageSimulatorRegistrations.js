/**
 * @file Damage simulator specific component registrations
 * @see visualizerRegistrations.js - Pattern to follow
 */

import { tokens } from '../tokens.js';
import { Registrar, registerWithLog } from '../../utils/registrarHelpers.js';
import DamageSimulatorUI from '../../domUI/damage-simulator/DamageSimulatorUI.js';
import HierarchicalAnatomyRenderer from '../../domUI/damage-simulator/HierarchicalAnatomyRenderer.js';
import DamageCapabilityComposer from '../../domUI/damage-simulator/DamageCapabilityComposer.js';
import DamageExecutionService from '../../domUI/damage-simulator/DamageExecutionService.js';
import DamageHistoryTracker from '../../domUI/damage-simulator/DamageHistoryTracker.js';
import DamageAnalyticsPanel from '../../domUI/damage-simulator/DamageAnalyticsPanel.js';
import HitProbabilityCalculator from '../../domUI/damage-simulator/HitProbabilityCalculator.js';
import DeathConditionMonitor from '../../domUI/damage-simulator/DeathConditionMonitor.js';
import MultiHitSimulator from '../../domUI/damage-simulator/MultiHitSimulator.js';
import * as hitProbabilityWeightUtils from '../../anatomy/utils/hitProbabilityWeightUtils.js';

/** @typedef {import('../appContainer.js').default} AppContainer */

/**
 * Register damage simulator specific components.
 * Shared services (RecipeSelectorService, EntityLoadingService, AnatomyDataExtractor)
 * are already registered via visualizerRegistrations.
 *
 * @param {AppContainer} container - The application's DI container
 */
export function registerDamageSimulatorComponents(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);

  logger.debug('[DamageSimulator] Starting component registrations...');

  // Register DamageSimulatorUI (DAMAGESIMULATOR-006)
  registerWithLog(
    registrar,
    tokens.DamageSimulatorUI,
    (c) =>
      new DamageSimulatorUI({
        recipeSelectorService: c.resolve(tokens.IRecipeSelectorService),
        entityLoadingService: c.resolve(tokens.IEntityLoadingService),
        anatomyDataExtractor: c.resolve(tokens.IAnatomyDataExtractor),
        injuryAggregationService: c.resolve(tokens.InjuryAggregationService),
        eventBus: c.resolve(tokens.IValidatedEventDispatcher),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register HierarchicalAnatomyRenderer (DAMAGESIMULATOR-007)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.HierarchicalAnatomyRenderer,
    (c) => {
      // Factory returns a function that creates renderer with provided container
      return (containerElement) =>
        new HierarchicalAnatomyRenderer({
          containerElement,
          logger: c.resolve(tokens.ILogger),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register DamageCapabilityComposer (DAMAGESIMULATOR-009)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.DamageCapabilityComposer,
    (c) => {
      // Factory returns a function that creates composer with provided container
      return (containerElement) =>
        new DamageCapabilityComposer({
          containerElement,
          schemaValidator: c.resolve(tokens.ISchemaValidator),
          eventBus: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register DamageExecutionService (DAMAGESIMULATOR-011)
  registerWithLog(
    registrar,
    tokens.DamageExecutionService,
    (c) =>
      new DamageExecutionService({
        operationInterpreter: c.resolve(tokens.OperationInterpreter),
        entityManager: c.resolve(tokens.IEntityManager),
        eventBus: c.resolve(tokens.IValidatedEventDispatcher),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register DamageHistoryTracker (DAMAGESIMULATOR-012)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.DamageHistoryTracker,
    (c) => {
      // Factory returns a function that creates tracker with provided container
      return (containerElement) =>
        new DamageHistoryTracker({
          containerElement,
          eventBus: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register DamageAnalyticsPanel (DAMAGESIMULATOR-013)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.DamageAnalyticsPanel,
    (c) => {
      // Factory returns a function that creates panel with provided container
      return (containerElement) =>
        new DamageAnalyticsPanel({
          containerElement,
          eventBus: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
          hitProbabilityCalculator: c.resolve(tokens.HitProbabilityCalculator),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register HitProbabilityCalculator (DAMAGESIMULATOR-014)
  registerWithLog(
    registrar,
    tokens.HitProbabilityCalculator,
    (c) =>
      new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register DeathConditionMonitor (DAMAGESIMULATOR-015)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.DeathConditionMonitor,
    (c) => {
      // Factory returns a function that creates monitor with provided container
      return (containerElement) =>
        new DeathConditionMonitor({
          containerElement,
          eventBus: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register MultiHitSimulator (DAMAGESIMULATOR-016)
  // Note: containerElement is provided at runtime, not from DI
  registerWithLog(
    registrar,
    tokens.MultiHitSimulator,
    (c) => {
      // Factory returns a function that creates simulator with provided container
      return (containerElement) =>
        new MultiHitSimulator({
          containerElement,
          damageExecutionService: c.resolve(tokens.DamageExecutionService),
          eventBus: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  logger.debug('[DamageSimulator] Component registrations complete.');
}
