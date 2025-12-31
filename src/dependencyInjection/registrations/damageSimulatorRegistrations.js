/**
 * @file Damage simulator specific component registrations
 * @see visualizerRegistrations.js - Pattern to follow
 */

import { tokens } from '../tokens.js';

/**
 * Register damage simulator specific components.
 * Shared services (RecipeSelectorService, EntityLoadingService, AnatomyDataExtractor)
 * are already registered via visualizerRegistrations.
 *
 * @param {object} container - The DI container
 */
export function registerDamageSimulatorComponents(container) {
  const logger = container.resolve(tokens.ILogger);

  logger.debug('[DamageSimulator] Starting component registrations...');

  // Placeholder for future damage-simulator-specific services:
  // - DamageSimulatorUI (DAMAGESIMULATOR-007)
  // - HierarchicalAnatomyRenderer
  // - DamageCapabilityComposer
  // - DamageExecutionService
  // - DamageAnalyticsPanel

  logger.debug('[DamageSimulator] Component registrations complete.');
}
