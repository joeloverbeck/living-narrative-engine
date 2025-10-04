/**
 * @file Clipboard utility functions for copying speech metadata to clipboard
 */

import { isNonBlankString } from '../../utils/textUtils.js';

/**
 * @typedef {import('../../turns/states/helpers/noteFormatter.js').NoteObject} NoteObject
 */

/**
 * Copies text to the clipboard using the modern Clipboard API with fallback.
 *
 * @param {string} text - The text to copy to clipboard
 * @returns {Promise<boolean>} True if copy succeeded, false otherwise
 */
export async function copyToClipboard(text) {
  if (!text || typeof text !== 'string') {
    // eslint-disable-next-line no-console
    console.warn('[clipboardUtils] Cannot copy empty or invalid text');
    return false;
  }

  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[clipboardUtils] Clipboard API failed:', err);
      // Fall through to fallback method
    }
  }

  // Fallback: execCommand (deprecated but widely supported)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!successful) {
      // eslint-disable-next-line no-console
      console.warn('[clipboardUtils] execCommand copy failed');
    }

    return successful;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[clipboardUtils] All clipboard methods failed:', err);
    return false;
  }
}

/**
 * Formats a single note object for clipboard text.
 *
 * @param {NoteObject} note - The note object
 * @param {number} displayIndex - The display index (for numbering, -1 means no numbering)
 * @returns {string} Formatted note text
 */
function formatSingleNote(note, displayIndex = -1) {
  if (!note || typeof note !== 'object') {
    return '';
  }

  const { text, subject, subjectType, context } = note;

  if (!isNonBlankString(text)) {
    return '';
  }

  let parts = [];

  // Add subject type if present
  if (subjectType && isNonBlankString(subjectType)) {
    parts.push(`[${subjectType.trim()}]`);
  }

  // Add subject if present
  if (subject && isNonBlankString(subject)) {
    parts.push(`${subject.trim()}:`);
  }

  // Add main text
  parts.push(text.trim());

  // Build the main line
  let line = parts.join(' ');

  // Add context as a separate line if present
  if (context && isNonBlankString(context)) {
    line += `\n  (Context: ${context.trim()})`;
  }

  // Add numbering only if displayIndex >= 0
  if (displayIndex >= 0) {
    line = `${displayIndex + 1}. ${line}`;
  }

  return line;
}

/**
 * Formats structured notes data for clipboard copying.
 *
 * @param {NoteObject|NoteObject[]|null|undefined} notesData - The notes data
 * @returns {string} Formatted text for clipboard
 */
export function formatNotesForClipboard(notesData) {
  if (!notesData) {
    return '';
  }

  // Handle single note
  if (!Array.isArray(notesData)) {
    return formatSingleNote(notesData, -1); // No numbering for single note
  }

  // Handle array of notes - filter first, then format with sequential numbering
  const validNotes = notesData.filter(
    (note) => note && typeof note === 'object' && isNonBlankString(note.text)
  );

  if (validNotes.length === 0) {
    return '';
  }

  // Format notes with proper sequential numbering
  const formattedNotes = validNotes.map((note, displayIndex) =>
    formatSingleNote(note, validNotes.length > 1 ? displayIndex : -1)
  );

  // Add header for multiple notes
  if (formattedNotes.length > 1) {
    return `Notes (${formattedNotes.length}):\n\n${formattedNotes.join('\n\n')}`;
  }

  return formattedNotes[0];
}

/**
 * Formats thoughts text for clipboard copying.
 *
 * @param {string} thoughts - The thoughts text
 * @returns {string} Formatted thoughts for clipboard
 */
export function formatThoughtsForClipboard(thoughts) {
  if (!isNonBlankString(thoughts)) {
    return '';
  }

  return `Thoughts:\n${thoughts.trim()}`;
}

/**
 * Shows a temporary visual feedback near the button to indicate successful copy.
 *
 * @param {HTMLElement} buttonElement - The button that was clicked
 * @param {string} message - The feedback message to show (default: "Copied!")
 * @param {number} duration - How long to show the message in ms (default: 2000)
 */
export function showCopyFeedback(
  buttonElement,
  message = 'Copied!',
  duration = 2000
) {
  if (!buttonElement) return;

  // Create feedback element
  const feedback = document.createElement('span');
  feedback.className = 'copy-feedback';
  feedback.textContent = message;
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');

  // Add to button
  buttonElement.appendChild(feedback);
  buttonElement.classList.add('meta-btn--copied');

  // Remove after duration
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.remove();
    }
    buttonElement.classList.remove('meta-btn--copied');
  }, duration);
}
