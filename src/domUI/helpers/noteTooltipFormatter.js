/**
 * @file Helper function to format structured note objects into rich HTML for tooltip display.
 */

import { isNonBlankString } from '../../utils/textUtils.js';

/**
 * @typedef {import('../../turns/states/helpers/noteFormatter.js').NoteObject} NoteObject
 * @typedef {import('../../turns/states/helpers/noteFormatter.js').StructuredNote} StructuredNote
 * @typedef {import('../../turns/states/helpers/noteFormatter.js').SimpleNote} SimpleNote
 */

/**
 * Escapes HTML entities in text content.
 *
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const tempDiv = document.createElement('div');
  tempDiv.textContent = text;
  return tempDiv.innerHTML;
}

/**
 * Gets an icon for a subject type.
 *
 * @param {string} subjectType - The subject type.
 * @returns {string} The icon HTML or empty string.
 */
function getSubjectTypeIcon(subjectType) {
  const iconMap = {
    character: '👤',
    location: '📍',
    event: '📅',
    item: '📦',
    emotion: '💭',
    observation: '👁️',
    discovery: '🔍',
    mystery: '🔮',
    investigation: '🕵️',
  };

  return iconMap[subjectType?.toLowerCase()] || '';
}

/**
 * Formats a single structured note into HTML.
 *
 * @param {NoteObject} note - The note object to format.
 * @param {number} index - The index of the note (for styling/numbering).
 * @returns {string} The formatted HTML string.
 */
function formatSingleNoteAsHtml(note, index) {
  if (!note || typeof note !== 'object') {
    return '';
  }

  const { text, subject, subjectType, context } = note;

  if (!isNonBlankString(text)) {
    return '';
  }

  const escapedText = escapeHtml(text.trim());
  const escapedSubject = subject ? escapeHtml(subject.trim()) : '';
  const escapedSubjectType = subjectType ? escapeHtml(subjectType.trim()) : '';
  const escapedContext = context ? escapeHtml(context.trim()) : '';

  // Build note header with subject type and subject
  let headerHtml = '';
  if (escapedSubjectType || escapedSubject) {
    headerHtml += '<div class="note-header">';

    if (escapedSubjectType) {
      const icon = getSubjectTypeIcon(escapedSubjectType);
      headerHtml += `<span class="note-subject-type" data-type="${escapedSubjectType.toLowerCase()}">`;
      if (icon) {
        headerHtml += `<span class="note-type-icon">${icon}</span>`;
      }
      headerHtml += `${escapedSubjectType}</span>`;
    }

    if (escapedSubject) {
      headerHtml += `<span class="note-subject">${escapedSubject}</span>`;
    }

    headerHtml += '</div>';
  }

  // Build note metadata (context)
  let metaHtml = '';
  if (escapedContext) {
    metaHtml += '<div class="note-meta">';

    metaHtml += `<span class="note-context">${escapedContext}</span>`;

    metaHtml += '</div>';
  }

  return `<div class="note-item" data-index="${index}">
    ${headerHtml}
    <div class="note-content">${escapedText}</div>
    ${metaHtml}
  </div>`;
}

/**
 * Formats structured notes data into rich HTML for tooltip display.
 *
 * @param {NoteObject|NoteObject[]|null|undefined} notesData - The structured notes data to format.
 * @returns {string} HTML string for tooltip content.
 */
export function formatNotesAsRichHtml(notesData) {
  if (!notesData) {
    return '';
  }

  // Handle single note object
  if (!Array.isArray(notesData)) {
    const noteHtml = formatSingleNoteAsHtml(notesData, 0);
    if (!noteHtml) {
      return '';
    }

    return `<div class="notes-container notes-container--single">
      ${noteHtml}
    </div>`;
  }

  // Handle array of notes
  const noteHtmls = notesData
    .map((note, index) => formatSingleNoteAsHtml(note, index))
    .filter(Boolean);

  if (noteHtmls.length === 0) {
    return '';
  }

  if (noteHtmls.length === 1) {
    return `<div class="notes-container notes-container--single">
      ${noteHtmls[0]}
    </div>`;
  }

  const notesListHtml = noteHtmls
    .map((noteHtml, index) => {
      const divider =
        index < noteHtmls.length - 1 ? '<div class="note-divider"></div>' : '';
      return noteHtml + divider;
    })
    .join('');

  return `<div class="notes-container notes-container--multiple">
    <div class="notes-header">
      <span class="notes-count">${noteHtmls.length} Notes</span>
    </div>
    <div class="notes-list">
      ${notesListHtml}
    </div>
  </div>`;
}

export default formatNotesAsRichHtml;
