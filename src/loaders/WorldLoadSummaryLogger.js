// src/loaders/worldLoadSummaryLogger.js

/**
 * @file Logs a summary of world loading results.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

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
   * @param {string[]} finalOrder - Resolved load order for all mods.
   * @param {number} incompatibilityCount - Count of engine version mismatches.
   * @param {TotalResultsSummary} totals - Map of content type totals.
   * @returns {void}
   */
  logSummary(
    logger,
    worldName,
    requestedMods,
    finalOrder,
    incompatibilityCount,
    totals
  ) {
    logger.info(`— ModsLoader Load Summary (World: '${worldName}') —`);
    logger.info(`  • Requested Mods (raw): [${requestedMods.join(', ')}]`);
    logger.info(`  • Final Load Order     : [${finalOrder.join(', ')}]`);
    if (incompatibilityCount > 0) {
      logger.warn(
        `  • Engine-version incompatibilities detected: ${incompatibilityCount}`
      );
    }
    logger.info(`  • Content Loading Summary (Totals):`);
    if (Object.keys(totals).length > 0) {
      const sortedTypes = Object.keys(totals).sort();
      for (const typeName of sortedTypes) {
        const counts = totals[typeName];
        const paddedTypeName = typeName.padEnd(20, ' ');
        const details = `C:${counts.count}, O:${counts.overrides}, E:${counts.errors}`;
        logger.info(`     - ${paddedTypeName}: ${details}`);
      }
      const grandTotalCount = Object.values(totals).reduce(
        (sum, tc) => sum + tc.count,
        0
      );
      const grandTotalOverrides = Object.values(totals).reduce(
        (sum, tc) => sum + tc.overrides,
        0
      );
      const grandTotalErrors = Object.values(totals).reduce(
        (sum, tc) => sum + tc.errors,
        0
      );
      logger.info(`     - ${''.padEnd(20, '-')}--------------------------`);
      logger.info(
        `     - ${'TOTAL'.padEnd(20, ' ')}: C:${grandTotalCount}, O:${grandTotalOverrides}, E:${grandTotalErrors}`
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
