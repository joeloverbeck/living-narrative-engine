/**
 * @file Helper function to build the speech metadata block (thoughts, notes icons).
 */

import { THOUGHT_SVG, NOTES_SVG } from '../icons.js';

/**
 * @typedef {import('../domElementFactory.js').default} DomElementFactory
 */

/**
 * @typedef {object} SpeechMetaInput
 * @property {string} [thoughts] - The inner thoughts of the character.
 * @property {string} [notes] - Private notes or observations.
 */

/**
 * Builds a document fragment containing metadata buttons (for thoughts, notes) for a speech bubble.
 *
 * @param {DomElementFactory} domFactory - An instance of the DOM element factory.
 * @param {SpeechMetaInput} meta - An object containing the speech metadata.
 * @returns {DocumentFragment|null} A document fragment with the speech-meta div, or null if no metadata is provided.
 */
export function buildSpeechMeta(domFactory, { thoughts, notes }) {
  if (!thoughts && !notes) {
    return null;
  }

  const fragment = domFactory.document.createDocumentFragment();
  const metaContainer = domFactory.create('div', { cls: 'speech-meta' });

  if (thoughts) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn thoughts',
      'aria-label': 'View inner thoughts',
    });
    btn.style.setProperty('--clr', 'var(--thoughts-icon-color)');
    btn.innerHTML = THOUGHT_SVG;

    const tooltip = domFactory.create('div', { cls: 'meta-tooltip' });
    tooltip.textContent = thoughts;
    btn.appendChild(tooltip);

    metaContainer.appendChild(btn);
  }

  if (notes) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn notes',
      'aria-label': 'View private notes',
    });
    btn.style.setProperty('--clr', 'var(--notes-icon-color)');
    btn.innerHTML = NOTES_SVG;

    const tooltip = domFactory.create('div', { cls: 'meta-tooltip' });
    tooltip.textContent = notes;
    btn.appendChild(tooltip);

    metaContainer.appendChild(btn);
  }

  fragment.appendChild(metaContainer);
  return fragment;
}
