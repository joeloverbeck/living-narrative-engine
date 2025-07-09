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

    // Check if any notes have subjects (structured format)
    const hasStructuredNotes = notes.some((note) => note.subject);

    let bodyContent;

    if (hasStructuredNotes) {
      // Group notes by subject for structured display
      bodyContent = this._formatGroupedNotes(notes);
    } else {
      // Legacy format - simple bullet list
      bodyContent = notes
        .slice()
        .sort((a, b) => {
          // Notes without timestamps go to the end
          const aTime = a.timestamp
            ? new Date(a.timestamp).getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b.timestamp
            ? new Date(b.timestamp).getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        })
        .map((note) => `- ${note.text}`)
        .join('\n');
    }

    return `${resolvedPrefix}\n${bodyContent}\n${resolvedSuffix}`;
  }

  /**
   * Format notes grouped by subject
   *
   * @private
   * @param {Array} notes - Array of notes
   * @returns {string} - Formatted notes content
   */
  _formatGroupedNotes(notes) {
    // Group notes by subject
    const notesBySubject = {};
    const unstructuredNotes = [];

    notes.forEach((note) => {
      if (note.subject) {
        if (!notesBySubject[note.subject]) {
          notesBySubject[note.subject] = [];
        }
        notesBySubject[note.subject].push(note);
      } else {
        // Legacy notes without subjects
        unstructuredNotes.push(note);
      }
    });

    // Sort each subject's notes by timestamp
    Object.keys(notesBySubject).forEach((subject) => {
      notesBySubject[subject].sort((a, b) => {
        const aTime = a.timestamp
          ? new Date(a.timestamp).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.timestamp
          ? new Date(b.timestamp).getTime()
          : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
    });

    // Format the grouped notes
    const sections = [];

    // Add structured notes grouped by subject
    Object.keys(notesBySubject)
      .sort()
      .forEach((subject) => {
        const subjectNotes = notesBySubject[subject];
        sections.push(`[${subject}]`);

        subjectNotes.forEach((note) => {
          let line = `- ${note.text}`;

          // Add context if present
          if (note.context) {
            line += ` (${note.context})`;
          }

          // Add tags if present
          if (note.tags && note.tags.length > 0) {
            line += ` [${note.tags.join(', ')}]`;
          }

          sections.push(line);
        });

        sections.push(''); // Empty line between subjects
      });

    // Add unstructured notes at the end if any
    if (unstructuredNotes.length > 0) {
      sections.push('[General Notes]');
      unstructuredNotes
        .sort((a, b) => {
          const aTime = a.timestamp
            ? new Date(a.timestamp).getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b.timestamp
            ? new Date(b.timestamp).getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        })
        .forEach((note) => {
          sections.push(`- ${note.text}`);
        });
    }

    return sections.join('\n').trim();
  }
}

export default NotesSectionAssembler;
