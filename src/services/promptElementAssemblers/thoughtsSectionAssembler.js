// src/services/promptElementAssemblers/ThoughtsSectionAssembler.js
/**
 * @fileoverview Assembles the "Your most recent thoughts (oldest first):" block of an LLM prompt.
 * Feature: Short‑Term Memory.
 */

import {IPromptElementAssembler} from '../../interfaces/IPromptElementAssembler.js';

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
     * @param {ILogger} [options.logger=console]
     */
    constructor({logger = console} = {}) {
        super();
        this.#logger = logger;
    }

    /**
     * Assemble the thoughts section.
     *
     * Rules ➤ If `promptData.thoughtsArray` is
     *         • `undefined`, `null`, not an array, **or** empty ⇒ return "".
     *         • Otherwise, produce exactly one blank line, the header line, another blank
     *           line, each thought on its own line prefixed by "- ", then a trailing
     *           blank line.  Finally prepend any resolved `prefix` and append any
     *           resolved `suffix` from `elementCfg` inside the outer blank‑line frame.
     *
     * Output example (thoughts T1, T2):
     *   "\nYour most recent thoughts (oldest first):\n\n- T1\n- T2\n\n"
     *
     * @param {PromptElement}  elementCfg               – Config for this element.
     * @param {PromptData}     promptData               – Runtime data (expects `thoughtsArray`).
     * @param {PlaceholderResolver} placeholderResolver – Placeholder resolver.
     * @param {Map<string, PromptElement>} [allPromptElementsMap] – Unused, kept for interface.
     * @returns {string} Rendered block or "".
     */

    /* eslint-disable-next-line max-params */
    assemble(elementCfg, promptData, placeholderResolver, allPromptElementsMap) { // eslint-disable-line no-unused-vars
        const arr = promptData?.thoughtsArray;
        if (!Array.isArray(arr) || arr.length === 0) {
            return "";
        }

        // Resolve optional prefix / suffix (default empty strings)
        const resolvedPrefix = elementCfg?.prefix
            ? placeholderResolver.resolve(elementCfg.prefix, promptData)
            : "";
        const resolvedSuffix = elementCfg?.suffix
            ? placeholderResolver.resolve(elementCfg.suffix, promptData)
            : "";

        const header = "Your most recent thoughts (oldest first):";
        // Build thought lines, convert non‑string values using String(), skip null/undefined
        const thoughtLines = arr
            .filter(th => th !== null && th !== undefined && th !== "")
            .map(th => `- ${String(th)}`)
            .join("\n");

        // Core of the section (header + blank line + list + trailing newline)
        const sectionCore = `${header}\n\n${thoughtLines}\n`;

        // Surround with exactly one blank line before and after.
        const sectionWithFrame = `\n${resolvedPrefix}${sectionCore}${resolvedSuffix}\n`;

        return sectionWithFrame;
    }
}

export default ThoughtsSectionAssembler;
