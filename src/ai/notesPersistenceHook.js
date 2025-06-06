/**
 * @file This module persists notes from an LLM action.
 * @see src/ai/notesPersistenceHook.js
 */

import NotesService from './notesService.js';
import { NOTES_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Persists the "notes" produced during an LLM turn into the actor's
 * `core:notes` component in memory.
 *
 * @param {object} action - The structured action returned by the LLM.
 * @param {object} actorEntity - Entity instance (or test double) that generated the action.
 * @param {object} logger - Application-wide logger (expects .info() and .error()).
 */
export function persistNotes(action, actorEntity, logger) {
  // Gracefully do nothing if the 'notes' key is entirely absent.
  if (!action || !Object.prototype.hasOwnProperty.call(action, 'notes')) {
    return;
  }

  const notesArray = action.notes;

  // If the 'notes' key exists but is not an array, log an error and stop.
  if (!Array.isArray(notesArray)) {
    logger.error("'notes' field is not an array; skipping merge");
    return;
  }

  // If it's a valid but empty array, there's nothing to do.
  if (notesArray.length === 0) {
    return;
  }

  // Filter out invalid notes before processing, logging errors for them.
  const validNotes = [];
  for (const noteText of notesArray) {
    if (typeof noteText === 'string' && noteText.trim() !== '') {
      validNotes.push(noteText);
    } else {
      logger.error(`Invalid note skipped: ${JSON.stringify(noteText)}`);
    }
  }

  if (validNotes.length === 0) {
    return;
  }

  const hasGetter = typeof actorEntity?.getComponentData === 'function';
  let notesComp = hasGetter
    ? actorEntity.getComponentData(NOTES_COMPONENT_ID)
    : actorEntity?.components?.[NOTES_COMPONENT_ID];

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
      logger.info(`Added note: "${note.text}" at ${note.timestamp}`);
    });

    if (typeof actorEntity?.addComponent === 'function') {
      actorEntity.addComponent(NOTES_COMPONENT_ID, updatedNotesComp);
    } else if (actorEntity?.components) {
      actorEntity.components[NOTES_COMPONENT_ID] = updatedNotesComp;
    }
  }
}
