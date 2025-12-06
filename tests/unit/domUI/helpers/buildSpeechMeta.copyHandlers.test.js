/**
 * @file Interaction tests for buildSpeechMeta clipboard handlers.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { buildSpeechMeta } from '../../../../src/domUI/helpers/buildSpeechMeta.js';

jest.mock('../../../../src/domUI/icons.js', () => ({
  getIcon: jest.fn(() => '<svg data-icon="mock"></svg>'),
}));

jest.mock('../../../../src/domUI/helpers/noteTooltipFormatter.js', () => ({
  formatNotesAsRichHtml: jest.fn(() => '<div class="rich">note</div>'),
}));

jest.mock('../../../../src/domUI/helpers/clipboardUtils.js', () => ({
  assembleCopyAllPayload: jest.fn(),
  copyToClipboard: jest.fn(),
  formatNotesForClipboard: jest.fn(),
  formatThoughtsForClipboard: jest.fn(),
  showCopyFeedback: jest.fn(),
}));

const { formatNotesAsRichHtml } = jest.requireMock(
  '../../../../src/domUI/helpers/noteTooltipFormatter.js'
);
const {
  assembleCopyAllPayload,
  copyToClipboard,
  formatNotesForClipboard,
  formatThoughtsForClipboard,
  showCopyFeedback,
} = jest.requireMock('../../../../src/domUI/helpers/clipboardUtils.js');

describe('buildSpeechMeta clipboard interactions', () => {
  let doc;
  let domFactory;

  const createDomFactory = (document) => ({
    create: jest.fn((tagName, options = {}) => {
      const element = document.createElement(tagName);
      const originalAddEventListener = element.addEventListener.bind(element);
      element.addEventListener = jest.fn((eventName, handler, opts) => {
        if (eventName === 'click') {
          element.__clickHandlers = element.__clickHandlers || [];
          element.__clickHandlers.push(handler);
        }
        return originalAddEventListener(eventName, handler, opts);
      });

      if (options.cls) {
        element.className = options.cls;
      }

      if (options.attrs) {
        for (const [name, value] of Object.entries(options.attrs)) {
          element.setAttribute(name, value);
        }
      }

      if (options.text) {
        element.textContent = options.text;
      }

      return element;
    }),
  });

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
    domFactory = createDomFactory(doc);

    formatNotesAsRichHtml.mockReturnValue('<div class="rich">note</div>');
    assembleCopyAllPayload.mockReset();
    copyToClipboard.mockReset();
    formatNotesForClipboard.mockReset();
    formatThoughtsForClipboard.mockReset();
    showCopyFeedback.mockReset();
  });

  afterEach(() => {
    doc.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('copies thoughts to the clipboard and shows success feedback', async () => {
    const thoughts = 'Secret plan';
    formatThoughtsForClipboard.mockReturnValue('formatted thoughts');
    copyToClipboard.mockResolvedValueOnce(true);

    const fragment = buildSpeechMeta(doc, domFactory, { thoughts });
    expect(fragment).not.toBeNull();

    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.thoughts');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(formatThoughtsForClipboard).toHaveBeenCalledWith(
      thoughts,
      undefined
    );
    expect(copyToClipboard).toHaveBeenCalledWith('formatted thoughts');
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copied!');
  });

  it('shows failure feedback when copying thoughts fails', async () => {
    const thoughts = 'Unshareable secret';
    formatThoughtsForClipboard.mockReturnValue('formatted secret');
    copyToClipboard.mockResolvedValueOnce(false);

    const fragment = buildSpeechMeta(doc, domFactory, { thoughts });
    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.thoughts');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(formatThoughtsForClipboard).toHaveBeenCalledWith(
      thoughts,
      undefined
    );
    expect(copyToClipboard).toHaveBeenCalledWith('formatted secret');
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copy failed', 1500);
  });

  it('copies formatted notes and shows success feedback', async () => {
    const notes = { text: 'Important detail', subject: 'Mission' };
    formatNotesAsRichHtml.mockReturnValue('<div class="rich">Mission</div>');
    formatNotesForClipboard.mockReturnValue('formatted notes');
    copyToClipboard.mockResolvedValueOnce(true);

    const fragment = buildSpeechMeta(doc, domFactory, { notes });
    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.notes');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(formatNotesAsRichHtml).toHaveBeenCalledWith(notes);
    expect(formatNotesForClipboard).toHaveBeenCalledWith(notes);
    expect(copyToClipboard).toHaveBeenCalledWith('formatted notes');
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copied!');
  });

  it('shows failure feedback when copying notes fails', async () => {
    const notes = { text: 'Fallback detail', subject: 'Alert' };
    formatNotesAsRichHtml.mockReturnValue('<div class="rich">Alert</div>');
    formatNotesForClipboard.mockReturnValue('formatted alert');
    copyToClipboard.mockResolvedValueOnce(false);

    const fragment = buildSpeechMeta(doc, domFactory, { notes });
    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.notes');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(formatNotesForClipboard).toHaveBeenCalledWith(notes);
    expect(copyToClipboard).toHaveBeenCalledWith('formatted alert');
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copy failed', 1500);
  });

  it('copies assembled payload for copy-all and shows success feedback', async () => {
    assembleCopyAllPayload.mockReturnValue({
      text: 'Echo says: "Hello"\n\nThoughts:\nDeep',
      hasSpeech: true,
      hasThoughts: true,
      hasNotes: false,
    });
    copyToClipboard.mockResolvedValueOnce(true);

    const fragment = buildSpeechMeta(doc, domFactory, {
      thoughts: 'Deep',
      speakerName: 'Echo',
      copyAll: {
        speechContent: 'Hello',
        bubbleType: 'speech',
      },
    });

    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.copy-all');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(assembleCopyAllPayload).toHaveBeenCalledWith({
      allowSpeechHtml: undefined,
      notes: undefined,
      speakerName: 'Echo',
      speechContent: 'Hello',
      thoughts: 'Deep',
    });
    expect(copyToClipboard).toHaveBeenCalledWith(
      'Echo says: "Hello"\n\nThoughts:\nDeep'
    );
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copied!');
  });

  it('shows failure feedback and skips copy when assembled payload is empty', async () => {
    assembleCopyAllPayload.mockReturnValue({
      text: '',
      hasSpeech: false,
      hasThoughts: false,
      hasNotes: false,
    });

    const fragment = buildSpeechMeta(doc, domFactory, {
      copyAll: {
        bubbleType: 'speech',
      },
    });

    doc.body.appendChild(fragment);
    const button = doc.body.querySelector('.meta-btn.copy-all');
    const [handler] = button.__clickHandlers;

    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    await handler.call(button, event);

    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(showCopyFeedback).toHaveBeenCalledWith(button, 'Copy failed', 1500);
  });
});
