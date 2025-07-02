// src/prompting/notesSectionAssembler.js
import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';
import { validateAssemblerParams } from './assemblerValidation.js';

export const NOTES_WRAPPER_KEY = 'notes_wrapper';

export class NotesSectionAssembler extends IPromptElementAssembler {
  constructor() {
    super();
  }

  /** @inheritdoc */
  assemble(elementCfg, promptData, placeholderResolver) {
    const { valid } = validateAssemblerParams({
      elementConfig: elementCfg,
      promptData,
      placeholderResolver,
      functionName: 'NotesSectionAssembler.assemble',
    });
    if (!valid) {
      return '';
    }

    const notes = promptData?.notesArray;
    if (!Array.isArray(notes) || notes.length === 0) {
      return '';
    }

    const { prefix: resolvedPrefix, suffix: resolvedSuffix } = resolveWrapper(
      elementCfg,
      placeholderResolver,
      promptData
    );

    const bodyLines = notes
      .slice()
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map((note) => `- ${note.text}`)
      .join('\n');

    return `${resolvedPrefix}\n${bodyLines}\n${resolvedSuffix}`;
  }
}

export default NotesSectionAssembler;
