// src/prompting/goalsSectionAssembler.js
import { IPromptElementAssembler } from '../../interfaces/iPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';

export const GOALS_WRAPPER_KEY = 'goals_wrapper';

/**
 * @class GoalsSectionAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders the goals section when `promptData.goalsArray` is supplied.
 */
export class GoalsSectionAssembler extends IPromptElementAssembler {
  constructor() {
    super();
  }

  /** @inheritdoc */
  assemble(elementCfg, promptData, placeholderResolver) {
    const arr = promptData?.goalsArray;
    if (!Array.isArray(arr) || arr.length === 0) {
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementCfg,
      placeholderResolver,
      promptData
    );

    const safeMs = (ts) => {
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };
    const sorted = arr
      .slice()
      .sort((a, b) => safeMs(a.timestamp) - safeMs(b.timestamp));

    const goalLines = sorted
      .filter((g) => g?.text)
      .map((g) => `- ${String(g.text)}`)
      .join('\n');

    if (!goalLines) {
      return '';
    }

    return `${resolvedPrefix}\n${goalLines}\n${resolvedSuffix}`;
  }
}

export default GoalsSectionAssembler;
