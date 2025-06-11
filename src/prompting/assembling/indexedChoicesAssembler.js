// src/prompting/assembling/indexedChoicesAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';

export const INDEXED_CHOICES_KEY = 'indexed_choices';

/**
 * @class IndexedChoicesAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders promptData.indexedChoicesArray as a numbered list.
 */
export class IndexedChoicesAssembler extends IPromptElementAssembler {
  #logger;

  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /** @inheritdoc */
  assemble(elementConfig, promptData, placeholderResolver) {
    const { indexedChoicesArray } = promptData;
    if (
      !Array.isArray(indexedChoicesArray) ||
      indexedChoicesArray.length === 0
    ) {
      this.#logger.debug('IndexedChoicesAssembler: No choices to render.');
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementConfig,
      placeholderResolver,
      promptData
    );

    const lines = indexedChoicesArray.map(
      (choice) =>
        `chosenActionId: ${choice.index}; ${choice.commandString} (${choice.description})`
    );

    return `${resolvedPrefix}${lines.join('\n')}${resolvedSuffix}`;
  }
}

export default IndexedChoicesAssembler;
