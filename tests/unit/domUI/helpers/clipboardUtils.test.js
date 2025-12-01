/**
 * @file Unit tests for clipboard utility functions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  assembleCopyAllPayload,
  copyToClipboard,
  formatNotesForClipboard,
  formatThoughtsForClipboard,
  showCopyFeedback,
} from '../../../../src/domUI/helpers/clipboardUtils.js';

describe('clipboardUtils', () => {
  describe('copyToClipboard', () => {
    let originalClipboard;
    let originalExecCommand;

    beforeEach(() => {
      // Save originals
      originalClipboard = navigator.clipboard;
      originalExecCommand = document.execCommand;

      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: jest.fn(),
        },
        configurable: true,
      });

      // Mock execCommand
      document.execCommand = jest.fn();
    });

    afterEach(() => {
      // Restore originals
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
      document.execCommand = originalExecCommand;
    });

    it('should successfully copy text using Clipboard API', async () => {
      navigator.clipboard.writeText.mockResolvedValue(undefined);
      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('should fallback to execCommand if Clipboard API fails', async () => {
      navigator.clipboard.writeText.mockRejectedValue(
        new Error('Permission denied')
      );
      document.execCommand.mockReturnValue(true);

      const result = await copyToClipboard('fallback test');

      expect(result).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should return false for empty text', async () => {
      const result = await copyToClipboard('');
      expect(result).toBe(false);
    });

    it('should return false for null text', async () => {
      const result = await copyToClipboard(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined text', async () => {
      const result = await copyToClipboard(undefined);
      expect(result).toBe(false);
    });

    it('should return false when both methods fail', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Failed'));
      document.execCommand.mockReturnValue(false);

      const result = await copyToClipboard('test');
      expect(result).toBe(false);
    });

    it('should handle errors thrown by fallback copy mechanism', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Primary failed'));
      document.execCommand.mockImplementation(() => {
        throw new Error('execCommand blew up');
      });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await copyToClipboard('resilient text');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[clipboardUtils] All clipboard methods failed:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();

      // Clean up any textarea that may still be attached due to the thrown error
      document.querySelectorAll('textarea').forEach((el) => el.remove());
    });
  });

  describe('formatThoughtsForClipboard', () => {
    it('should format thoughts with header', () => {
      const result = formatThoughtsForClipboard(
        'I wonder what happens next...'
      );
      expect(result).toBe('Thoughts:\nI wonder what happens next...');
    });

    it('should trim whitespace from thoughts', () => {
      const result = formatThoughtsForClipboard(
        '  Some thoughts with spaces  '
      );
      expect(result).toBe('Thoughts:\nSome thoughts with spaces');
    });

    it('should return empty string for empty thoughts', () => {
      expect(formatThoughtsForClipboard('')).toBe('');
      expect(formatThoughtsForClipboard('   ')).toBe('');
    });

    it('should return empty string for null/undefined thoughts', () => {
      expect(formatThoughtsForClipboard(null)).toBe('');
      expect(formatThoughtsForClipboard(undefined)).toBe('');
    });
  });

  describe('formatNotesForClipboard', () => {
    it('should format single note object without numbering', () => {
      const note = {
        text: 'Important observation',
        subject: 'The Door',
        subjectType: 'Location',
        context: 'Entrance hall',
      };

      const result = formatNotesForClipboard(note);
      expect(result).toBe(
        '[Location] The Door: Important observation\n  (Context: Entrance hall)'
      );
    });

    it('should format note without subject type', () => {
      const note = {
        text: 'Simple note',
        subject: 'Character',
      };

      const result = formatNotesForClipboard(note);
      expect(result).toBe('Character: Simple note');
    });

    it('should format note without subject', () => {
      const note = {
        text: 'Just text',
        subjectType: 'Observation',
      };

      const result = formatNotesForClipboard(note);
      expect(result).toBe('[Observation] Just text');
    });

    it('should format note without context', () => {
      const note = {
        text: 'Note text',
        subject: 'Subject',
        subjectType: 'Type',
      };

      const result = formatNotesForClipboard(note);
      expect(result).toBe('[Type] Subject: Note text');
    });

    it('should format minimal note with just text', () => {
      const note = { text: 'Simple note' };
      const result = formatNotesForClipboard(note);
      expect(result).toBe('Simple note');
    });

    it('should format array with single note', () => {
      const notes = [{ text: 'Single note in array' }];
      const result = formatNotesForClipboard(notes);
      expect(result).toBe('Single note in array');
    });

    it('should format multiple notes with numbering and header', () => {
      const notes = [
        { text: 'First note', subject: 'A' },
        { text: 'Second note', subject: 'B' },
      ];

      const result = formatNotesForClipboard(notes);
      expect(result).toBe(
        'Notes (2):\n\n1. A: First note\n\n2. B: Second note'
      );
    });

    it('should skip empty notes in array', () => {
      const notes = [
        { text: 'Valid note' },
        { text: '' }, // Empty
        null, // Null
        { text: 'Another valid' },
      ];

      const result = formatNotesForClipboard(notes);
      expect(result).toBe('Notes (2):\n\n1. Valid note\n\n2. Another valid');
    });

    it('should return empty string for empty array', () => {
      expect(formatNotesForClipboard([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatNotesForClipboard(null)).toBe('');
      expect(formatNotesForClipboard(undefined)).toBe('');
    });

    it('should return empty string when provided non-object note data', () => {
      expect(formatNotesForClipboard('not an object')).toBe('');
      expect(formatNotesForClipboard(42)).toBe('');
    });

    it('should return empty string when note text is blank', () => {
      const note = { text: '   ', subject: 'Ignored subject' };
      expect(formatNotesForClipboard(note)).toBe('');
    });

    it('should handle note with all fields populated', () => {
      const note = {
        text: 'Complete note',
        subject: 'Test Subject',
        subjectType: 'Character',
        context: 'During conversation',
      };

      const result = formatNotesForClipboard(note);
      expect(result).toBe(
        '[Character] Test Subject: Complete note\n  (Context: During conversation)'
      );
    });
  });

  describe('showCopyFeedback', () => {
    let button;

    beforeEach(() => {
      // Create a mock button element
      button = document.createElement('button');
      button.className = 'meta-btn';
      document.body.appendChild(button);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllTimers();
    });

    it('should create and append feedback element', () => {
      showCopyFeedback(button, 'Copied!', 100);

      const feedback = button.querySelector('.copy-feedback');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toBe('Copied!');
      expect(feedback.getAttribute('role')).toBe('status');
      expect(feedback.getAttribute('aria-live')).toBe('polite');
    });

    it('should add copied class to button', () => {
      showCopyFeedback(button, 'Copied!', 100);
      expect(button.classList.contains('meta-btn--copied')).toBe(true);
    });

    it('should remove feedback after duration', async () => {
      showCopyFeedback(button, 'Copied!', 50);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const feedback = button.querySelector('.copy-feedback');
      expect(feedback).toBeFalsy();
      expect(button.classList.contains('meta-btn--copied')).toBe(false);
    });

    it('should use default message if not provided', () => {
      showCopyFeedback(button);
      const feedback = button.querySelector('.copy-feedback');
      expect(feedback.textContent).toBe('Copied!');
    });

    it('should handle null button gracefully', () => {
      expect(() => showCopyFeedback(null)).not.toThrow();
    });

    it('should show custom message', () => {
      showCopyFeedback(button, 'Custom message!', 100);
      const feedback = button.querySelector('.copy-feedback');
      expect(feedback.textContent).toBe('Custom message!');
    });
  });

  describe('assembleCopyAllPayload', () => {
    it('assembles speech only with quotes and strips HTML when allowed', () => {
      const { text, hasSpeech, hasThoughts, hasNotes } = assembleCopyAllPayload({
        speechContent: '<b>Hello</b> *wave*',
        allowSpeechHtml: true,
      });

      expect(text).toBe('"Hello *wave*"');
      expect(hasSpeech).toBe(true);
      expect(hasThoughts).toBe(false);
      expect(hasNotes).toBe(false);
    });

    it('assembles speech, thoughts, and notes in order with blank lines', () => {
      const { text, hasSpeech, hasThoughts, hasNotes } = assembleCopyAllPayload({
        speechContent: 'Hello',
        thoughts: 'Thinking...',
        notes: { text: 'Note here' },
        speakerName: 'Iris',
      });

      expect(text).toBe(
        '"Hello"\n\nIris\'s thoughts:\nThinking...\n\nNote here'
      );
      expect(hasSpeech).toBe(true);
      expect(hasThoughts).toBe(true);
      expect(hasNotes).toBe(true);
    });

    it('returns empty payload when all segments are blank', () => {
      const payload = assembleCopyAllPayload({
        speechContent: '   ',
        thoughts: ' ',
        notes: [],
      });

      expect(payload.text).toBe('');
      expect(payload.hasSpeech).toBe(false);
      expect(payload.hasThoughts).toBe(false);
      expect(payload.hasNotes).toBe(false);
    });
  });
});
