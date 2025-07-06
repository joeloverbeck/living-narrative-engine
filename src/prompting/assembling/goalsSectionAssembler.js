// src/prompting/goalsSectionAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';
import { validateAssemblerParams } from './assemblerValidation.js';

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
    const { valid } = validateAssemblerParams({
      elementConfig: elementCfg,
      promptData,
      placeholderResolver,
      functionName: 'GoalsSectionAssembler.assemble',
    });
    if (!valid) {
      return '';
    }

    const goals = promptData?.goalsArray;
    if (!Array.isArray(goals) || goals.length === 0) {
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementCfg,
      placeholderResolver,
      promptData
    );

    const safeMs = (ts) => {
      if (!ts) return Number.POSITIVE_INFINITY; // Goals without timestamps go to the end
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };
    const sortedGoals = goals
      .slice()
      .sort((a, b) => safeMs(a.timestamp) - safeMs(b.timestamp));

    const goalLines = sortedGoals
      .filter((goal) => goal?.text)
      .map((goal) => `- ${String(goal.text)}`)
      .join('\n');

    if (!goalLines) {
      return '';
    }

    return `${resolvedPrefix}\n${goalLines}\n${resolvedSuffix}`;
  }
}

export default GoalsSectionAssembler;
