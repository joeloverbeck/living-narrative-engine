/**
 * @file Defines common types used by content loading utilities.
 */

import { freeze } from '../utils/cloneUtils.js';

/**
 * Enumerates possible outcomes of loading content for a mod.
 *
 * @enum {string}
 */
export const ContentLoadStatus = freeze({
  /** The mod's content loaded successfully. */
  SUCCESS: 'success',
  /** The mod had no relevant content for the phase. */
  SKIPPED: 'skipped',
  /** The loader encountered an error while processing the mod. */
  FAILED: 'failed',
});

/**
 * Result object returned from {@link module:ContentLoadManager#loadContent} and
 * {@link module:ContentLoadManager#loadContentForPhase}.
 *
 * @typedef {object} LoadPhaseResult
 * @property {Record<string, ContentLoadStatus>} results - Map of modIds to their
 *   load status.
 * @property {import('./LoadResultAggregator.js').TotalResultsSummary} updatedTotals -
 *   Updated aggregate totals after processing the mods.
 */
