/**
 * @file src/prompting/goalsSectionAssembler.js
 * Feature ► Memory – Goals
 */

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger}      ILogger */
/** @typedef {import('../promptBuilder.js').PromptElement}             PromptElement */
/** @typedef {import('../promptBuilder.js').PromptData}                PromptData */

/** @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver */

/**
 * @class GoalsSectionAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders the goals section when `promptData.goalsArray` is supplied.
 *
 * Output example (two goals G1, G2):
 * ```
 * <goals>\n
 * - G1
 * - G2
 *
 * ```
 */
export class GoalsSectionAssembler extends IPromptElementAssembler {
  /**
   * @param {{ logger?: ILogger }} [options]
   */
  constructor({ logger = console } = {}) {
    super();
    // logger parameter preserved for API consistency
  }

  /**
   * @inheritdoc
   */
  assemble(elementCfg, promptData, placeholderResolver /* unused map */) {
    const arr = promptData?.goalsArray;
    if (!Array.isArray(arr) || arr.length === 0) return '';

    // ── Resolve optional prefix / suffix ───────────────────────────────
    const resolvedPrefix = elementCfg?.prefix
      ? placeholderResolver.resolve(elementCfg.prefix, promptData)
      : '';
    const resolvedSuffix = elementCfg?.suffix
      ? placeholderResolver.resolve(elementCfg.suffix, promptData)
      : '';

    // ── Sort ascending by timestamp; invalid dates ↦ Infinity (shoved to end) ──
    const safeMs = (ts) => {
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };
    const sorted = arr
      .slice()
      .sort((a, b) => safeMs(a.timestamp) - safeMs(b.timestamp));

    // ── Build bullet list ──────────────────────────────────────────────
    const goalLines = sorted
      .filter(
        (g) => g && g.text !== null && g.text !== undefined && g.text !== ''
      )
      .map((g) => `- ${String(g.text)}`)
      .join('\n');

    if (goalLines === '') return '';

    // resolvedPrefix contains the header string (e.g. "<goals>\n")
    const sectionCore = `${resolvedPrefix}\n${goalLines}\n${resolvedSuffix}`;
    return sectionCore;
  }
}

export default GoalsSectionAssembler;
