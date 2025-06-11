// src/prompting/assembling/indexedChoicesAssembler.js

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';

export const INDEXED_CHOICES_KEY = 'indexed_choices';

/**
 * @class IndexedChoicesAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders promptData.indexedChoicesArray as a numbered list:
 *   1. <description>
 *   2. <description>
 *   …
 * No command strings or target IDs are ever emitted.
 */
export class IndexedChoicesAssembler extends IPromptElementAssembler {
  #logger;

  /**
   * @param {object} [options]
   * @param {import('../../interfaces/coreServices.js').ILogger} [options.logger]
   */
  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /**
   * @param {{ key: string; prefix?: string; suffix?: string }} elementConfig
   * @param {{ indexedChoicesArray?: Array<{ index: number; commandString: string; description: string }> }} promptData
   * @param {import('../../utils/placeholderResolver.js').PlaceholderResolver} placeholderResolver
   * @returns {string}
   */
  assemble(elementConfig, promptData, placeholderResolver) {
    const { indexedChoicesArray } = promptData;
    if (
      !Array.isArray(indexedChoicesArray) ||
      indexedChoicesArray.length === 0
    ) {
      this.#logger.debug('IndexedChoicesAssembler: No choices to render.');
      return '';
    }

    const prefix = placeholderResolver.resolve(
      elementConfig.prefix ?? '',
      promptData
    );
    const suffix = placeholderResolver.resolve(
      elementConfig.suffix ?? '',
      promptData
    );

    const lines = indexedChoicesArray.map(
      (choice) =>
        `chosenActionId: ${choice.index}; ${choice.commandString} (${choice.description})`
    );

    return `${prefix}${lines.join('\n')}${suffix}`;
  }
}
