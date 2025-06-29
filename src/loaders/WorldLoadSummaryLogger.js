// src/loaders/worldLoadSummaryLogger.js

/**
 * @file Logs a summary of world loading results.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */
/** @typedef {import('./helpers/resultsSummary.js').TotalsSummary} TotalsSummary */

/**
 * Computes summed totals across all registry keys.
 *
 * @param {TotalResultsSummary} totals - Map of content type totals.
 * @returns {TotalsSummary} Grand totals.
 */
export function computeTotalsSummary(totals) {
  const summary = { count: 0, overrides: 0, errors: 0 };
  for (const counts of Object.values(totals)) {
    summary.count += counts.count;
    summary.overrides += counts.overrides;
    summary.errors += counts.errors;
  }
  return summary;
}

/**
 * @description Utility for printing a formatted summary of the world load.
 * @class
 */
export class WorldLoadSummaryLogger {
  /**
   * Logs a multi-line summary of what was loaded across all mods.
   *
   * @param {ILogger} logger - Logging service.
   * @param {string} worldName - Identifier for the world being loaded.
   * @param {string[]} requestedMods - Mods requested by the game configuration.
   * @param {string[]} finalModOrder - Resolved load order for all mods.
   * @param {number} incompatibilityCount - Count of engine version mismatches.
   * @param {TotalResultsSummary} totals - Map of content type totals.
   * @returns {void}
   */
  logSummary(
    logger,
    worldName,
    requestedMods,
    finalModOrder,
    incompatibilityCount,
    totals
  ) {
    logger.info(`— ModsLoader Load Summary (World: '${worldName}') —`);
    logger.info(`  • Requested Mods (raw): [${requestedMods.join(', ')}]`);
    logger.info(`  • Final Load Order     : [${finalModOrder.join(', ')}]`);
    if (incompatibilityCount > 0) {
      logger.warn(
        `  • Engine-version incompatibilities detected: ${incompatibilityCount}`
      );
    }
    logger.info(`  • Content Loading Summary (Totals):`);
    if (Object.keys(totals).length > 0) {
      const sortedTypes = Object.keys(totals).sort();
      for (const registryKey of sortedTypes) {
        const counts = totals[registryKey];
        const paddedRegistryKey = registryKey.padEnd(20, ' ');
        const details = `${counts.count} loaded, ${counts.overrides} overrides, ${counts.errors} errors`;
        logger.info(`     - ${paddedRegistryKey}: ${details}`);
      }
      const grandTotals = computeTotalsSummary(totals);
      logger.info(`     - ${''.padEnd(20, '-')}--------------------------`);
      logger.info(
        `     - ${'TOTAL'.padEnd(20, ' ')}: C:${grandTotals.count}, O:${grandTotals.overrides}, E:${grandTotals.errors}`
      );
    } else {
      logger.info(
        `     - No specific content items were processed by loaders in this run.`
      );
    }
    logger.info('———————————————————————————————————————————');
  }
}

export default WorldLoadSummaryLogger;
