/**
 * @file Edge case tests for buildSpeechMeta - handling invalid/empty notes
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

// Mock the dependencies
jest.mock('../../../../src/domUI/icons.js', () => ({
  getIcon: jest.fn(),
}));

jest.mock('../../../../src/domUI/helpers/noteTooltipFormatter.js', () => ({
  formatNotesAsRichHtml: jest.fn(),
}));

const { getIcon } = jest.requireMock('../../../../src/domUI/icons.js');
const { formatNotesAsRichHtml } = jest.requireMock(
  '../../../../src/domUI/helpers/noteTooltipFormatter.js'
);

describe('buildSpeechMeta - Edge Cases for Invalid/Empty Notes', () => {
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

    // Default mock implementations
    getIcon.mockImplementation((name) => `<svg data-icon="${name}"></svg>`);
  });

  afterEach(() => {
    doc.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Array of notes where all have empty text', () => {
    it('should not create notes button when formatNotesAsRichHtml returns empty string', () => {
      const emptyNotes = [
        { text: '', subject: 'Subject1', subjectType: 'character' },
        { text: '   ', subject: 'Subject2', subjectType: 'location' },
      ];

      // Simulate formatNotesAsRichHtml returning empty for invalid notes
      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, { notes: emptyNotes });

      // Should return null since no valid metadata
      expect(fragment).toBeNull();
      expect(formatNotesAsRichHtml).toHaveBeenCalledWith(emptyNotes);
    });

    it('should not create notes button when array contains only invalid note objects', () => {
      const invalidNotes = [
        { subject: 'NoText', subjectType: 'character' }, // Missing text
        { text: null, subject: 'NullText' }, // Null text
      ];

      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, {
        notes: invalidNotes,
      });

      expect(fragment).toBeNull();
      expect(formatNotesAsRichHtml).toHaveBeenCalledWith(invalidNotes);
    });
  });

  describe('Single note object with empty text', () => {
    it('should not create notes button when single note has empty text', () => {
      const emptyNote = {
        text: '',
        subject: 'Empty',
        subjectType: 'observation',
      };

      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, { notes: emptyNote });

      expect(fragment).toBeNull();
      expect(formatNotesAsRichHtml).toHaveBeenCalledWith(emptyNote);
    });

    it('should not create notes button when single note has whitespace-only text', () => {
      const whitespaceNote = {
        text: '   \n  \t  ',
        subject: 'Whitespace',
        subjectType: 'item',
      };

      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, {
        notes: whitespaceNote,
      });

      expect(fragment).toBeNull();
      expect(formatNotesAsRichHtml).toHaveBeenCalledWith(whitespaceNote);
    });

    it('should not create notes button when note object has no text field', () => {
      const noTextField = { subject: 'Missing', subjectType: 'character' };

      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, { notes: noTextField });

      expect(fragment).toBeNull();
      expect(formatNotesAsRichHtml).toHaveBeenCalledWith(noTextField);
    });
  });

  describe('Mixed valid and invalid notes where all valid get filtered', () => {
    it('should not create button when formatNotesAsRichHtml returns empty after filtering', () => {
      const mixedNotes = [
        { text: 'Valid note', subject: 'A' },
        { text: '', subject: 'Empty' },
        null,
        { subject: 'NoText' },
      ];

      // Simulate scenario where formatter returns empty (shouldn't happen with valid notes,
      // but testing the guard clause)
      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, { notes: mixedNotes });

      expect(fragment).toBeNull();
    });
  });

  describe('Whitespace handling in formatted output', () => {
    it('should not create notes button when richHtml is only whitespace', () => {
      const notes = { text: 'Some text', subject: 'Test' };

      // Simulate formatter returning only whitespace
      formatNotesAsRichHtml.mockReturnValue('   \n   \t   ');

      const fragment = buildSpeechMeta(doc, domFactory, { notes });

      expect(fragment).toBeNull();
    });
  });

  describe('Thoughts only with invalid notes should still show thoughts', () => {
    it('should create only thoughts button when notes are invalid', () => {
      const invalidNotes = [{ text: '', subject: 'Empty' }];

      formatNotesAsRichHtml.mockReturnValue('');

      const fragment = buildSpeechMeta(doc, domFactory, {
        thoughts: 'Valid thoughts',
        notes: invalidNotes,
      });

      expect(fragment).not.toBeNull();
      doc.body.appendChild(fragment);

      const thoughtsButton = doc.body.querySelector('.meta-btn.thoughts');
      const notesButton = doc.body.querySelector('.meta-btn.notes');

      expect(thoughtsButton).not.toBeNull();
      expect(notesButton).toBeNull(); // Notes button should not be created

      expect(getIcon).toHaveBeenCalledWith('thoughts');
      expect(getIcon).not.toHaveBeenCalledWith('notes');
    });
  });

  describe('Valid notes should still create button (regression check)', () => {
    it('should create notes button when formatNotesAsRichHtml returns valid HTML', () => {
      const validNotes = {
        text: 'Important observation',
        subject: 'Door',
        subjectType: 'location',
      };

      const richHtml = '<div class="note-item">Important observation</div>';
      formatNotesAsRichHtml.mockReturnValue(richHtml);

      const fragment = buildSpeechMeta(doc, domFactory, { notes: validNotes });

      expect(fragment).not.toBeNull();
      doc.body.appendChild(fragment);

      const notesButton = doc.body.querySelector('.meta-btn.notes');
      expect(notesButton).not.toBeNull();

      const tooltip = notesButton.querySelector('.meta-tooltip--notes');
      expect(tooltip).not.toBeNull();
      expect(tooltip.innerHTML).toBe(richHtml);
    });
  });
});
