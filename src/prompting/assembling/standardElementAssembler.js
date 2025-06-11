// src/services/promptElementAssemblers/standardElementAssembler.js

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { snakeToCamel } from '../../utils/textUtils.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';

/**
 * @class StandardElementAssembler
 * @implements {IPromptElementAssembler}
 * @description Handles the assembly of common/generic prompt elements.
 */
export class StandardElementAssembler extends IPromptElementAssembler {
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
   * @inheritdoc
   */
  assemble(
    elementConfig,
    promptData,
    placeholderResolver,
    allPromptElementsMap
  ) {
    if (!elementConfig || !promptData || !placeholderResolver) {
      this.#logger.error(
        'StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).',
        {
          elementConfigProvided: !!elementConfig,
          promptDataProvider: !!promptData,
          placeholderResolverProvided: !!placeholderResolver,
        }
      );
      return '';
    }

    const { key } = elementConfig;
    if (!key || typeof key !== 'string') {
      this.#logger.warn(
        `StandardElementAssembler.assemble: Invalid or missing 'key' in elementConfig. Cannot process element.`,
        { elementConfig }
      );
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementConfig,
      placeholderResolver,
      promptData
    );

    const camelCaseKey = snakeToCamel(key);
    const contentKeyInPromptData = `${camelCaseKey}Content`;
    const rawContent = promptData[contentKeyInPromptData];
    let centralContentString = '';

    if (rawContent === null || rawContent === undefined) {
      this.#logger.debug(
        `StandardElementAssembler: Content for '${key}' (derived key: '${contentKeyInPromptData}') is null or undefined. Treating as empty string.`
      );
    } else if (typeof rawContent === 'string') {
      centralContentString = rawContent;
    } else {
      this.#logger.warn(
        `StandardElementAssembler: Content for '${key}' (derived key: '${contentKeyInPromptData}') is not a string, null, or undefined. It is of type '${typeof rawContent}'. Treating as empty string for this element.`
      );
    }

    if (resolvedPrefix || centralContentString || resolvedSuffix) {
      return `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
    } else {
      this.#logger.debug(
        `StandardElementAssembler: Element '${key}' is entirely empty (prefix, content, suffix). Output for this element is empty.`
      );
      return '';
    }
  }
}
