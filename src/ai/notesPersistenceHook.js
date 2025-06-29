/**
 * @file This module persists notes from an LLM action.
 * @see src/ai/notesPersistenceHook.js
 */

import NotesService from './notesService.js';
import { NOTES_COMPONENT_ID } from '../constants/componentIds.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { isNonBlankString } from '../utils/textUtils.js';
import {
  readComponent,
  writeComponent,
} from '../utils/componentAccessUtils.js';

/**
 * Persists the "notes" produced during an LLM turn into the actor's
 * `core:notes` component in memory.
 *
 * @param {object} action - The structured action returned by the LLM.
 * @param {object} actorEntity - Entity instance (or test double) that generated the action.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Application-wide logger.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Safe dispatcher for error events.
 */
export function persistNotes(action, actorEntity, logger, dispatcher) {
  // Gracefully do nothing if the 'notes' key is entirely absent.
  if (!action || !Object.prototype.hasOwnProperty.call(action, 'notes')) {
    return;
  }

  const notesArray = action.notes;

  // If the 'notes' key exists but is not an array, dispatch an error and stop.
  if (!Array.isArray(notesArray)) {
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        "NotesPersistenceHook: 'notes' field is not an array; skipping merge",
        { actorId: actorEntity?.id ?? 'UNKNOWN_ACTOR' }
      );
    }
    return;
  }

  // If it's a valid but empty array, there's nothing to do.
  if (notesArray.length === 0) {
    return;
  }

  // Filter out invalid notes before processing, dispatching errors for them.
  const validNotes = [];
  for (const noteText of notesArray) {
    if (isNonBlankString(noteText)) {
      validNotes.push(noteText);
    } else if (dispatcher) {
      safeDispatchError(
        dispatcher,
        'NotesPersistenceHook: Invalid note skipped',
        {
          note: noteText,
        }
      );
    }
  }

  if (validNotes.length === 0) {
    return;
  }

  let notesComp = readComponent(actorEntity, NOTES_COMPONENT_ID);

  if (!notesComp) {
    notesComp = { notes: [] };
  }

  const notesService = new NotesService();
  const {
    wasModified,
    component: updatedNotesComp,
    addedNotes,
  } = notesService.addNotes(notesComp, validNotes);

  if (wasModified) {
    addedNotes.forEach((note) => {
      logger.debug(`Added note: "${note.text}" at ${note.timestamp}`);
    });

    writeComponent(actorEntity, NOTES_COMPONENT_ID, updatedNotesComp);
  }
}
