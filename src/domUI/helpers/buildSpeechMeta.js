/**
 * @file Helper function to build the speech metadata block (thoughts, notes icons).
 */

import { getIcon } from '../icons.js';
import { formatNotesAsRichHtml } from './noteTooltipFormatter.js';
import {
  copyToClipboard,
  formatNotesForClipboard,
  formatThoughtsForClipboard,
  showCopyFeedback,
} from './clipboardUtils.js';

/**
 * @typedef {import('../domElementFactory.js').default} DomElementFactory
 * @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext['document']} Document
 */

/**
 * @typedef {object} SpeechMetaInput
 * @property {string} [thoughts] - The inner thoughts of the character.
 * @property {*} [notes] - Structured notes data for rich HTML display.
 * @property {string} [speakerName] - The name of the speaker (for clipboard formatting).
 */

/**
 * Builds a document fragment containing metadata buttons (for thoughts, notes) for a speech bubble.
 *
 * @param {Document} document - The DOM document object, used for creating fragments.
 * @param {DomElementFactory} domFactory - An instance of the DOM element factory for creating elements.
 * @param {SpeechMetaInput} meta - An object containing the speech metadata.
 * @returns {DocumentFragment|null} A document fragment with the speech-meta div, or null if no metadata is provided.
 */
export function buildSpeechMeta(
  document,
  domFactory,
  { thoughts, notes, speakerName }
) {
  if (!thoughts && !notes) {
    return null;
  }

  const fragment = document.createDocumentFragment();
  const metaContainer = domFactory.create('div', { cls: 'speech-meta' });

  if (thoughts) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn thoughts',
      attrs: {
        'aria-label': 'Click to copy thoughts to clipboard',
        title: 'Click to copy thoughts',
      },
    });
    btn.style.setProperty('--clr', 'var(--thoughts-icon-color)');
    btn.innerHTML = getIcon('thoughts');

    const tooltip = domFactory.create('div', { cls: 'meta-tooltip' });
    tooltip.textContent = thoughts;
    btn.appendChild(tooltip);

    // Add click handler for copying
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const formattedText = formatThoughtsForClipboard(thoughts, speakerName);
      const success = await copyToClipboard(formattedText);

      if (success) {
        showCopyFeedback(btn, 'Copied!');
      } else {
        showCopyFeedback(btn, 'Copy failed', 1500);
      }
    });

    metaContainer.appendChild(btn);
  }

  if (notes) {
    const richHtml = formatNotesAsRichHtml(notes);

    // Only create button if we have valid HTML content
    if (richHtml && richHtml.trim() !== '') {
      const btn = domFactory.create('button', {
        cls: 'meta-btn notes',
        attrs: {
          'aria-label': 'Click to copy notes to clipboard',
          title: 'Click to copy notes',
        },
      });
      btn.style.setProperty('--clr', 'var(--notes-icon-color)');
      btn.innerHTML = getIcon('notes');

      const tooltip = domFactory.create('div', {
        cls: 'meta-tooltip meta-tooltip--notes',
      });

      tooltip.innerHTML = richHtml;

      btn.appendChild(tooltip);

      // Add click handler for copying
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const formattedText = formatNotesForClipboard(notes);
        const success = await copyToClipboard(formattedText);

        if (success) {
          showCopyFeedback(btn, 'Copied!');
        } else {
          showCopyFeedback(btn, 'Copy failed', 1500);
        }
      });

      metaContainer.appendChild(btn);
    }
  }

  // If no buttons were added to the container, return null
  if (metaContainer.children.length === 0) {
    return null;
  }

  fragment.appendChild(metaContainer);
  return fragment;
}
