/**
 * @file Assembles the “Important Things to Remember” notes block for LLM prompts.
 * Mirrors ThoughtsSectionAssembler but works on promptData.notesArray.
 */

import {IPromptElementAssembler} from '../../interfaces/IPromptElementAssembler.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../promptBuilder.js').PromptElement} PromptElement
 * @typedef {import('../promptBuilder.js').PromptData}  PromptData
 * @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 */

export class NotesSectionAssembler extends IPromptElementAssembler {
    /** @type {ILogger} */
    #logger;

    /**
     * @param {{logger?: ILogger}} [options]
     */
    constructor({logger = console} = {}) {
        super();
        this.#logger = logger;
    }

    /**
     * @inheritDoc
     */
    assemble(cfg, promptData, placeholderResolver, // eslint-disable-next-line @typescript-eslint/no-unused-vars
             allPromptElementsMap) {
        const notes = promptData?.notesArray;
        if (!Array.isArray(notes) || notes.length === 0) return '';

        const prefix = cfg?.prefix ? placeholderResolver.resolve(cfg.prefix, promptData) : '';
        const suffix = cfg?.suffix ? placeholderResolver.resolve(cfg.suffix, promptData) : '';

        // Sort ascending by timestamp (invalid dates sink to bottom deterministically)
        const sorted = notes
            .slice()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const bodyLines = sorted.map((n) => `- ${n.text}`).join('\n');

        // Exactly one blank line after header and after list
        const section = `\nImportant Things to Remember:\n\n${bodyLines}\n\n`;

        return `${prefix}${section}${suffix}`;
    }
}

export default NotesSectionAssembler;