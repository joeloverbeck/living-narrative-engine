// src/services/promptElementAssemblers/thoughtsSectionAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';

export const THOUGHTS_WRAPPER_KEY = 'thoughts_wrapper';

/**
 * @class ThoughtsSectionAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders the recent-thoughts section when `promptData.thoughtsArray` is supplied.
 */
export class ThoughtsSectionAssembler extends IPromptElementAssembler {
  #logger;

  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /** @inheritdoc */
  assemble(elementCfg, promptData, placeholderResolver) {
    const arr = promptData?.thoughtsArray;
    if (!Array.isArray(arr) || arr.length === 0) {
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementCfg,
      placeholderResolver,
      promptData
    );

    const thoughtLines = arr
      .filter((t) => t != null && t !== '')
      .map((t) => `- ${String(t)}`)
      .join('\n');

    if (!thoughtLines) {
      return '';
    }

    return `${resolvedPrefix}${thoughtLines}${resolvedSuffix}`;
  }
}

export default ThoughtsSectionAssembler;
