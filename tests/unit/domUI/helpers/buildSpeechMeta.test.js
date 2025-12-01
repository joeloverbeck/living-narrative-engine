/**
 * @file Unit tests for buildSpeechMeta helper.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { buildSpeechMeta } from '../../../../src/domUI/helpers/buildSpeechMeta.js';

jest.mock('../../../../src/domUI/icons.js', () => ({
  getIcon: jest.fn(),
}));

jest.mock('../../../../src/domUI/helpers/noteTooltipFormatter.js', () => ({
  formatNotesAsRichHtml: jest.fn(),
}));

const { getIcon } = jest.requireMock('../../../../src/domUI/icons.js');
const { formatNotesAsRichHtml } = jest.requireMock('../../../../src/domUI/helpers/noteTooltipFormatter.js');

describe('buildSpeechMeta', () => {
  let doc;
  let domFactory;

  const createDomFactory = (document) => ({
    create: jest.fn((tagName, options = {}) => {
      const element = document.createElement(tagName);

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

    getIcon.mockImplementation((name) => `<svg data-icon="${name}"></svg>`);
    formatNotesAsRichHtml.mockImplementation((notes) => `<div class="rich">${notes.subject}</div>`);
  });

  afterEach(() => {
    doc.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('returns null when neither thoughts nor notes are provided', () => {
    expect(buildSpeechMeta(doc, domFactory, {})).toBeNull();
    expect(domFactory.create).not.toHaveBeenCalled();
    expect(getIcon).not.toHaveBeenCalled();
    expect(formatNotesAsRichHtml).not.toHaveBeenCalled();
  });

  it('creates only the thoughts button when thoughts text is present', () => {
    const fragment = buildSpeechMeta(doc, domFactory, { thoughts: 'Quiet reflection' });

    expect(fragment).not.toBeNull();
    doc.body.appendChild(fragment);

    const container = doc.body.querySelector('.speech-meta');
    expect(container).not.toBeNull();

    const thoughtsButton = container.querySelector('.meta-btn.thoughts');
    expect(thoughtsButton).not.toBeNull();
    expect(thoughtsButton.getAttribute('aria-label')).toBe('Click to copy thoughts to clipboard');
    expect(thoughtsButton.style.getPropertyValue('--clr')).toBe('var(--thoughts-icon-color)');
    expect(thoughtsButton.innerHTML).toContain('data-icon="thoughts"');

    const tooltip = thoughtsButton.querySelector('.meta-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toBe('Quiet reflection');

    expect(container.querySelector('.meta-btn.notes')).toBeNull();
    expect(getIcon).toHaveBeenCalledWith('thoughts');
    expect(formatNotesAsRichHtml).not.toHaveBeenCalled();
  });

  it('creates only the notes button when notes metadata is provided', () => {
    const notes = { text: 'Hidden note', subject: 'Agent', subjectType: 'observation' };
    const fragment = buildSpeechMeta(doc, domFactory, { notes });

    expect(fragment).not.toBeNull();
    doc.body.appendChild(fragment);

    const container = doc.body.querySelector('.speech-meta');
    expect(container).not.toBeNull();

    const notesButton = container.querySelector('.meta-btn.notes');
    expect(notesButton).not.toBeNull();
    expect(notesButton.getAttribute('aria-label')).toBe('Click to copy notes to clipboard');
    expect(notesButton.style.getPropertyValue('--clr')).toBe('var(--notes-icon-color)');
    expect(notesButton.innerHTML).toContain('data-icon="notes"');

    const tooltip = notesButton.querySelector('.meta-tooltip.meta-tooltip--notes');
    expect(tooltip).not.toBeNull();
    expect(tooltip.innerHTML).toBe(`<div class="rich">${notes.subject}</div>`);

    expect(container.querySelector('.meta-btn.thoughts')).toBeNull();
    expect(getIcon).toHaveBeenCalledWith('notes');
    expect(formatNotesAsRichHtml).toHaveBeenCalledWith(notes);
  });

  it('renders both buttons when both thoughts and notes are provided', () => {
    const notes = { text: 'Strategy', subject: 'Team', subjectType: 'goal' };
    const fragment = buildSpeechMeta(doc, domFactory, { thoughts: 'Plan ahead', notes });

    doc.body.appendChild(fragment);

    const buttons = doc.body.querySelectorAll('.speech-meta .meta-btn');
    expect(buttons).toHaveLength(2);

    const [thoughtsButton, notesButton] = buttons;
    expect(thoughtsButton.classList.contains('thoughts')).toBe(true);
    expect(notesButton.classList.contains('notes')).toBe(true);

    expect(thoughtsButton.querySelector('.meta-tooltip').textContent).toBe('Plan ahead');
    expect(notesButton.querySelector('.meta-tooltip').innerHTML).toBe(
      `<div class="rich">${notes.subject}</div>`
    );

    expect(getIcon).toHaveBeenCalledWith('thoughts');
    expect(getIcon).toHaveBeenCalledWith('notes');
    expect(formatNotesAsRichHtml).toHaveBeenCalledWith(notes);
  });

  it('creates copy-all button when only copyAll data is provided', () => {
    const fragment = buildSpeechMeta(doc, domFactory, {
      speakerName: 'Ava',
      copyAll: {
        speechContent: 'Hello world',
        bubbleType: 'speech',
        isPlayer: true,
      },
    });

    expect(fragment).not.toBeNull();
    doc.body.appendChild(fragment);

    const container = doc.body.querySelector('.speech-meta');
    expect(container).not.toBeNull();

    const copyAllButton = container.querySelector('.meta-btn.copy-all');
    expect(copyAllButton).not.toBeNull();
    expect(copyAllButton.getAttribute('aria-label')).toBe(
      'Copy speech from the player speech bubble to clipboard'
    );
    expect(copyAllButton.getAttribute('title')).toBe(
      'Copy speech from the player speech bubble to clipboard'
    );
    expect(getIcon).toHaveBeenCalledWith('copy-all');

    expect(container.querySelector('.meta-btn.thoughts')).toBeNull();
    expect(container.querySelector('.meta-btn.notes')).toBeNull();
  });

  it('positions copy-all button last after existing meta buttons', () => {
    const notes = { text: 'Strategy', subject: 'Team', subjectType: 'goal' };
    const fragment = buildSpeechMeta(doc, domFactory, {
      thoughts: 'Plan ahead',
      notes,
      copyAll: {
        speechContent: 'Quoted reply',
        bubbleType: 'speech',
      },
    });

    doc.body.appendChild(fragment);

    const buttons = Array.from(doc.body.querySelectorAll('.speech-meta .meta-btn'));
    expect(buttons).toHaveLength(3);
    expect(buttons[0].classList.contains('thoughts')).toBe(true);
    expect(buttons[1].classList.contains('notes')).toBe(true);
    expect(buttons[2].classList.contains('copy-all')).toBe(true);
  });
});
