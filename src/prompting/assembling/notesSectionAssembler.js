/**
 * @file Assembles the “<notes>” notes block for LLM prompts.
 * Mirrors ThoughtsSectionAssembler but works on promptData.notesArray.
 */

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../promptBuilder.js').PromptElement} PromptElement
 * @typedef {import('../promptBuilder.js').PromptData}  PromptData
 * @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 */

export class NotesSectionAssembler extends IPromptElementAssembler {
  /**
   * @param {{logger?: ILogger}} [options]
   */
  constructor({ logger = console } = {}) {
    super();
    // logger parameter preserved for API consistency
  }

  /**
   * @inheritDoc
   */
  assemble(
    cfg,
    promptData,
    placeholderResolver, // eslint-disable-next-line @typescript-eslint/no-unused-vars
    allPromptElementsMap
  ) {
    const notes = promptData?.notesArray;
    if (!Array.isArray(notes) || notes.length === 0) return '';

    const prefix = cfg?.prefix
      ? placeholderResolver.resolve(cfg.prefix, promptData)
      : '';
    const suffix = cfg?.suffix
      ? placeholderResolver.resolve(cfg.suffix, promptData)
      : '';

    // Sort ascending by timestamp (invalid dates sink to bottom deterministically)
    const sorted = notes
      .slice()
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    const bodyLines = sorted.map((n) => `- ${n.text}`).join('\n');

    // prefix is expected to contain the header text; just insert
    // a blank line before and after the list for readability
    const section = `${prefix}\n${bodyLines}\n${suffix}`;

    return section;
  }
}

export default NotesSectionAssembler;
