// src/services/promptElementAssemblers/standardElementAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { snakeToCamel } from '../../utils/textUtils.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class StandardElementAssembler
 * @implements {IPromptElementAssembler}
 * @description Handles the assembly of common/generic prompt elements.
 */
export class StandardElementAssembler extends IPromptElementAssembler {
  #logger;
  #safeEventDispatcher;

  constructor({ logger = console, safeEventDispatcher } = {}) {
    super();
    this.#logger = logger;
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'StandardElementAssembler requires a valid SafeEventDispatcher.'
      );
    }
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /** @inheritdoc */
  assemble(elementConfig, promptData, placeholderResolver) {
    // Parameter validation
    const paramsProvided = {
      elementConfigProvided: !!elementConfig,
      promptDataProvider: !!promptData,
      placeholderResolverProvided: !!placeholderResolver,
    };
    if (!elementConfig || !promptData || !placeholderResolver) {
      safeDispatchError(
        this.#safeEventDispatcher,
        'StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).',
        paramsProvided,
        this.#logger
      );
      return '';
    }

    // Validate key
    const { key } = elementConfig;
    if (!key || typeof key !== 'string') {
      this.#logger.warn(
        "StandardElementAssembler.assemble: Invalid or missing 'key' in elementConfig. Cannot process element.",
        { elementConfig }
      );
      return '';
    }

    // Resolve wrappers
    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementConfig,
      placeholderResolver,
      promptData
    );

    // Derive content key
    const camelCaseKey = snakeToCamel(key);
    const contentKey = `${camelCaseKey}Content`;
    const rawContent = promptData[contentKey];
    let centralContent = '';

    // Handle rawContent cases
    if (rawContent === null || rawContent === undefined) {
      this.#logger.debug(
        `StandardElementAssembler: Content for '${key}' (derived key: '${contentKey}') is null or undefined. Treating as empty string.`
      );
    } else if (typeof rawContent === 'string') {
      centralContent = rawContent;
    } else {
      this.#logger.warn(
        `StandardElementAssembler: Content for '${key}' (derived key: '${contentKey}') is not a string, null, or undefined. It is of type '${typeof rawContent}'. Treating as empty string for this element.`
      );
    }

    // Return assembled string or debug empty element
    if (resolvedPrefix || centralContent || resolvedSuffix) {
      return `${resolvedPrefix}${centralContent}${resolvedSuffix}`;
    }

    this.#logger.debug(
      `StandardElementAssembler: Element '${key}' is entirely empty (prefix, content, suffix). Output for this element is empty.`
    );
    return '';
  }
}

export default StandardElementAssembler;
