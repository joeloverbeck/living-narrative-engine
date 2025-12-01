/**
 * @file Helper function to build the speech metadata block (thoughts, notes icons).
 */

import { getIcon } from '../icons.js';
import { formatNotesAsRichHtml } from './noteTooltipFormatter.js';
import {
  assembleCopyAllPayload,
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
 * @property {object} [copyAll] - Copy-all configuration and data.
 * @property {string} [copyAll.speechContent] - Speech text to include.
 * @property {boolean} [copyAll.allowHtml] - Whether speech content allows HTML.
 * @property {string} [copyAll.bubbleType] - 'speech' | 'thought' for aria context.
 * @property {boolean} [copyAll.isPlayer] - Whether the bubble belongs to a player.
 * @property {string} [copyAll.thoughts] - Thoughts to include in copy-all (defaults to thoughts param).
 * @property {*} [copyAll.notes] - Notes to include in copy-all (defaults to notes param).
 */

function buildCopyAllLabel({
  bubbleType = 'speech',
  isPlayer = false,
  hasSpeech,
  hasThoughts,
  hasNotes,
}) {
  const parts = [];
  if (hasThoughts) parts.push('thoughts');
  if (hasSpeech) parts.push('speech');
  if (hasNotes) parts.push('notes');

  const joinParts = () => {
    if (parts.length === 0) return bubbleType === 'thought' ? 'thoughts' : 'speech';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };

  const description = joinParts();
  const target =
    bubbleType === 'thought'
      ? 'thought bubble'
      : isPlayer
        ? 'player speech bubble'
        : 'speech bubble';

  return `Copy ${description} from the ${target} to clipboard`;
}

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
  { thoughts, notes, speakerName, copyAll }
) {
  const hasCopyAll = Boolean(copyAll);
  const isThoughtBubble = copyAll?.bubbleType === 'thought';

  if (!thoughts && !notes && !hasCopyAll) {
    return null;
  }

  const fragment =
    document && typeof document.createDocumentFragment === 'function'
      ? document.createDocumentFragment()
      : domFactory?.create?.('div');
  const metaContainer = domFactory.create('div', { cls: 'speech-meta' });

  if (thoughts && !isThoughtBubble) {
    const btn = domFactory.create('button', {
      cls: 'meta-btn thoughts',
      attrs: {
        'aria-label': 'Click to copy thoughts to clipboard',
        title: 'Click to copy thoughts',
      },
    });
    if (btn?.style?.setProperty) {
      btn.style.setProperty('--clr', 'var(--thoughts-icon-color)');
    }
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
      if (btn?.style?.setProperty) {
        btn.style.setProperty('--clr', 'var(--notes-icon-color)');
      }
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

  if (hasCopyAll) {
    const copyAllThoughts =
      copyAll.thoughts !== undefined ? copyAll.thoughts : thoughts;
    const copyAllNotes = copyAll.notes !== undefined ? copyAll.notes : notes;
    const { speechContent, allowHtml, bubbleType, isPlayer } = copyAll;

    const copyAllButton = domFactory.create('button', {
      cls: 'meta-btn copy-all',
    });

    const { text: assembledText, hasSpeech, hasThoughts, hasNotes } =
      assembleCopyAllPayload({
        speechContent,
        allowSpeechHtml: allowHtml,
        thoughts: copyAllThoughts,
        notes: copyAllNotes,
        speakerName,
      });

    const label = buildCopyAllLabel({
      bubbleType,
      isPlayer,
      hasSpeech,
      hasThoughts,
      hasNotes,
    });

    copyAllButton.setAttribute('aria-label', label);
    copyAllButton.setAttribute('title', label);
    if (copyAllButton?.style?.setProperty) {
      copyAllButton.style.setProperty(
        '--clr',
        'var(--copy-all-icon-color, var(--notes-icon-color))'
      );
    }
    copyAllButton.innerHTML = getIcon('copy-all');

    copyAllButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const payload = assembleCopyAllPayload({
        speechContent,
        allowSpeechHtml: allowHtml,
        thoughts: copyAllThoughts,
        notes: copyAllNotes,
        speakerName,
      });

      if (!payload.text) {
        showCopyFeedback(copyAllButton, 'Copy failed', 1500);
        return;
      }

      const success = await copyToClipboard(payload.text);

      if (success) {
        showCopyFeedback(copyAllButton, 'Copied!');
      } else {
        showCopyFeedback(copyAllButton, 'Copy failed', 1500);
      }
    });

    metaContainer.appendChild(copyAllButton);
  }

  // If no buttons were added to the container, return null
  if (metaContainer.children.length === 0) {
    return null;
  }

  if (fragment && fragment !== metaContainer) {
    fragment.appendChild(metaContainer);
    return fragment;
  }

  return fragment || metaContainer;
}
