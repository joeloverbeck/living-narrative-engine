/**
 * @file Utility for summarizing settled Promise results during content loading.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Aggregates results from Promise.allSettled and logs a summary.
 *
 * @param {ILogger} logger - Logger for output.
 * @param {PromiseSettledResult<{qualifiedId:string,didOverride:boolean}>[]} settledResults - Results from processing.
 * @param {string[]} filenames - Original filenames corresponding to the results.
 * @param {string} modId - Owning mod ID for context.
 * @param {string} contentKey - Content key for logging purposes.
 * @param {number} totalAttempted - Total number of files attempted.
 * @returns {{processedCount:number,overrideCount:number,failedCount:number,failures:{file:string,error:any}[]}}
 *   Summary counts and failure details.
 */
export function summarizeSettledResults(
  logger,
  settledResults,
  filenames,
  modId,
  contentKey,
  totalAttempted
) {
  let processedCount = 0;
  let overrideCount = 0;
  let failedCount = 0;
  const failures = [];

  settledResults.forEach((result, index) => {
    const currentFilename = filenames[index];
    if (result.status === 'fulfilled') {
      processedCount += 1;
      if (result.value && result.value.didOverride === true) {
        overrideCount += 1;
      }
    } else {
      failedCount += 1;
      failures.push({ file: currentFilename, error: result.reason });
      logger.debug(
        `[${modId}] Failure recorded for ${currentFilename} in batch processing. Reason logged previously.`
      );
    }
  });

  const overrideMessage =
    overrideCount > 0 ? ` (${overrideCount} overrides)` : '';
  const failureMessage = failedCount > 0 ? ` (${failedCount} failed)` : '';
  logger.info(
    `Mod [${modId}] - Processed ${processedCount}/${totalAttempted} ${contentKey} items.${overrideMessage}${failureMessage}`
  );

  return { processedCount, overrideCount, failedCount, failures };
}

export default summarizeSettledResults;
