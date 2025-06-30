// src/services/promptElementAssemblers/thoughtsSectionAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';
import { validateAssemblerParams } from './assemblerValidation.js';

export const THOUGHTS_WRAPPER_KEY = 'thoughts_wrapper';

/**
 * @class ThoughtsSectionAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders the recent-thoughts section when `promptData.thoughtsArray` is supplied.
 */
export class ThoughtsSectionAssembler extends IPromptElementAssembler {
  constructor() {
    super();
  }

  /** @inheritdoc */
  assemble(elementCfg, promptData, placeholderResolver) {
    const { valid } = validateAssemblerParams({
      elementConfig: elementCfg,
      promptData,
      placeholderResolver,
      functionName: 'ThoughtsSectionAssembler.assemble',
    });
    if (!valid) {
      return '';
    }

    const thoughts = promptData?.thoughtsArray;
    if (!Array.isArray(thoughts) || thoughts.length === 0) {
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementCfg,
      placeholderResolver,
      promptData
    );

    const thoughtLines = thoughts
      .filter(
        (thought) => thought !== null && thought !== undefined && thought !== ''
      )
      .map((thought) => `- ${String(thought)}`)
      .join('\n');

    if (!thoughtLines) {
      return '';
    }

    return `${resolvedPrefix}${thoughtLines}${resolvedSuffix}`;
  }
}

export default ThoughtsSectionAssembler;
