// src/services/promptElementAssemblers/ThoughtsSectionAssembler.js
/**
 * @file Assembles the "Your most recent thoughts (oldest first):" block of an LLM prompt.
 * Feature: Short‑Term Memory.
 */

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../promptBuilder.js').PromptElement} PromptElement
 */
/**
 * @typedef {import('../promptBuilder.js').PromptData} PromptData
 */

/**
 * @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 */

/**
 * @class ThoughtsSectionAssembler
 * @implements {IPromptElementAssembler}
 * @description Renders the recent‑thoughts section when `promptData.thoughtsArray` is supplied.
 */
export class ThoughtsSectionAssembler extends IPromptElementAssembler {
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} [options]
   * @param {ILogger} [options.logger]
   */
  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /**
   * Assemble the thoughts section.
   *
   * Rules ➤ If `promptData.thoughtsArray` is
   * • `undefined`, `null`, not an array, **or** empty ⇒ return "".
   * • Otherwise, produce exactly one blank line, the header line, another blank
   * line, each thought on its own line prefixed by "- ", then a trailing
   * blank line.  Finally prepend any resolved `prefix` and append any
   * resolved `suffix` from `elementCfg` inside the outer blank‑line frame.
   *
   * Output example (thoughts T1, T2):
   * "\nYour most recent thoughts (oldest first):\n\n- T1\n- T2\n\n"
   *
   * @param {PromptElement}  elementCfg               – Config for this element.
   * @param {PromptData}     promptData               – Runtime data (expects `thoughtsArray`).
   * @param {PlaceholderResolver} placeholderResolver – Placeholder resolver.
   * @param {Map<string, PromptElement>} [allPromptElementsMap] – Unused, kept for interface.
   * @returns {string} Rendered block or "".
   */

  assemble(elementCfg, promptData, placeholderResolver, allPromptElementsMap) {
    const arr = promptData?.thoughtsArray;
    if (!Array.isArray(arr) || arr.length === 0) {
      return '';
    }

    const resolvedPrefix = elementCfg?.prefix
      ? placeholderResolver.resolve(elementCfg.prefix, promptData)
      : '';
    const resolvedSuffix = elementCfg?.suffix
      ? placeholderResolver.resolve(elementCfg.suffix, promptData)
      : '';

    const thoughtLines = arr
      .filter((th) => th !== null && th !== undefined && th !== '')
      .map((th) => `- ${String(th)}`)
      .join('\n');

    // **FIX:** The `sectionCore` no longer contains a hardcoded header.
    // It is now just the list of thoughts. The prefix from the config
    // is expected to contain the header.
    const sectionCore = thoughtLines;

    // If there's content, wrap it in the prefix and suffix.
    if (sectionCore) {
      return `${resolvedPrefix}${sectionCore}${resolvedSuffix}`;
    }

    return '';
  }
}

export default ThoughtsSectionAssembler;
