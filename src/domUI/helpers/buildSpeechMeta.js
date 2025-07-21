/**
 * @file Helper function to build the speech metadata block (thoughts, notes icons).
 */

import { getIcon } from '../icons.js';
import { formatNotesAsRichHtml } from './noteTooltipFormatter.js';

/**
 * @typedef {import('../domElementFactory.js').default} DomElementFactory
 * @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext['document']} Document
 */

/**
 * @typedef {object} SpeechMetaInput
 * @property {string} [thoughts] - The inner thoughts of the character.
 * @property {*} [notesRaw] - Raw structured notes data for rich HTML display.
 */

/**
 * Builds a document fragment containing metadata buttons (for thoughts, notes) for a speech bubble.
 *
 * @param {Document} document - The DOM document object, used for creating fragments.
 * @param {DomElementFactory} domFactory - An instance of the DOM element factory for creating elements.
 * @param {SpeechMetaInput} meta - An object containing the speech metadata.
 * @returns {DocumentFragment|null} A document fragment with the speech-meta div, or null if no metadata is provided.
 */
export function buildSpeechMeta(document, domFactory, { thoughts, notesRaw }) {
  if (!thoughts && !notesRaw) {
    return null;
  }

  const fragment = document.createDocumentFragment();
  const metaContainer = domFactory.create('div', { cls: 'speech-meta' });

  if (thoughts) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn thoughts',
      attrs: { 'aria-label': 'View inner thoughts' },
    });
    btn.style.setProperty('--clr', 'var(--thoughts-icon-color)');
    btn.innerHTML = getIcon('thoughts');

    const tooltip = domFactory.create('div', { cls: 'meta-tooltip' });
    tooltip.textContent = thoughts;
    btn.appendChild(tooltip);

    metaContainer.appendChild(btn);
  }

  if (notesRaw) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn notes',
      attrs: { 'aria-label': 'View private notes' },
    });
    btn.style.setProperty('--clr', 'var(--notes-icon-color)');
    btn.innerHTML = getIcon('notes');

    const richHtml = formatNotesAsRichHtml(notesRaw);
    const tooltip = domFactory.create('div', {
      cls: 'meta-tooltip meta-tooltip--notes',
    });

    tooltip.innerHTML = richHtml;

    btn.appendChild(tooltip);
    metaContainer.appendChild(btn);
  }

  fragment.appendChild(metaContainer);
  return fragment;
}
