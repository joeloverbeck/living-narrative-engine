/**
 * @file Integration tests for speech bubble copy-to-clipboard functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildSpeechMeta } from '../../../src/domUI/helpers/buildSpeechMeta.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

describe('Speech Bubble Copy Integration', () => {
  let domFactory;
  let originalClipboard;
  let documentContext;

  beforeEach(() => {
    // Reset document body
    document.body.innerHTML = '';

    // Create proper document context
    documentContext = new DocumentContext(document.body);
    domFactory = new DomElementFactory(documentContext);

    // Mock clipboard API
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  describe('Thoughts copying', () => {
    it('should copy thoughts with character name when clicking the thoughts button', async () => {
      const thoughts = 'I wonder what will happen next...';
      const speakerName = 'Test Character';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts, speakerName });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      expect(thoughtsBtn).toBeTruthy();

      // Click the button
      thoughtsBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "Test Character's thoughts:\nI wonder what will happen next..."
      );
    });

    it('should fall back to generic header if no speaker name provided', async () => {
      const thoughts = 'I wonder what will happen next...';
      // No speakerName provided
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Thoughts:\nI wonder what will happen next...'
      );
    });

    it('should show copy feedback after successful copy', async () => {
      const thoughts = 'Test thoughts';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const feedback = thoughtsBtn.querySelector('.copy-feedback');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toBe('Copied!');
      expect(thoughtsBtn.classList.contains('meta-btn--copied')).toBe(true);
    });

    it('should maintain tooltip visibility during copy', async () => {
      const thoughts = 'Test thoughts';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      const tooltip = thoughtsBtn.querySelector('.meta-tooltip');

      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toBe(thoughts);

      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Tooltip should still be there
      expect(thoughtsBtn.querySelector('.meta-tooltip')).toBeTruthy();
    });
  });

  describe('Notes copying', () => {
    it('should copy single note when clicking notes button', async () => {
      const notes = {
        text: 'Important observation',
        subject: 'The Door',
        subjectType: 'Location',
      };

      const fragment = buildSpeechMeta(document, domFactory, { notes });
      document.body.appendChild(fragment);

      const notesBtn = document.querySelector('.meta-btn.notes');
      expect(notesBtn).toBeTruthy();

      notesBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '[Location] The Door: Important observation'
      );
    });

    it('should copy multiple notes with proper formatting', async () => {
      const notes = [
        { text: 'First observation', subject: 'Character A' },
        { text: 'Second observation', subject: 'Character B' },
      ];

      const fragment = buildSpeechMeta(document, domFactory, { notes });
      document.body.appendChild(fragment);

      const notesBtn = document.querySelector('.meta-btn.notes');
      notesBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Notes (2):\n\n1. Character A: First observation\n\n2. Character B: Second observation'
      );
    });

    it('should show copy feedback for notes', async () => {
      const notes = { text: 'Test note' };
      const fragment = buildSpeechMeta(document, domFactory, { notes });

      document.body.appendChild(fragment);

      const notesBtn = document.querySelector('.meta-btn.notes');
      notesBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const feedback = notesBtn.querySelector('.copy-feedback');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toBe('Copied!');
    });
  });

  describe('Both thoughts and notes', () => {
    it('should create separate copy buttons for thoughts and notes', async () => {
      const thoughts = 'My thoughts';
      const notes = { text: 'My notes' };

      const fragment = buildSpeechMeta(document, domFactory, {
        thoughts,
        notes,
      });
      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      const notesBtn = document.querySelector('.meta-btn.notes');

      expect(thoughtsBtn).toBeTruthy();
      expect(notesBtn).toBeTruthy();

      // Click thoughts button
      thoughtsBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Thoughts:\nMy thoughts'
      );

      // Click notes button
      notesBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('My notes');
    });
  });

  describe('Error handling', () => {
    it('should show error feedback when clipboard fails', async () => {
      navigator.clipboard.writeText.mockRejectedValue(
        new Error('Permission denied')
      );
      document.execCommand = jest.fn().mockReturnValue(false);

      const thoughts = 'Test thoughts';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const feedback = thoughtsBtn.querySelector('.copy-feedback');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toBe('Copy failed');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on copy buttons', () => {
      const thoughts = 'Test thoughts';
      const notes = { text: 'Test notes' };

      const fragment = buildSpeechMeta(document, domFactory, {
        thoughts,
        notes,
      });
      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      const notesBtn = document.querySelector('.meta-btn.notes');

      expect(thoughtsBtn.getAttribute('aria-label')).toBe(
        'Click to copy thoughts to clipboard'
      );
      expect(notesBtn.getAttribute('aria-label')).toBe(
        'Click to copy notes to clipboard'
      );
    });

    it('should have title attributes for tooltips', () => {
      const thoughts = 'Test thoughts';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      expect(thoughtsBtn.getAttribute('title')).toBe('Click to copy thoughts');
    });

    it('should have proper ARIA attributes on feedback', async () => {
      const thoughts = 'Test';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      document.body.appendChild(fragment);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const feedback = thoughtsBtn.querySelector('.copy-feedback');
      expect(feedback.getAttribute('role')).toBe('status');
      expect(feedback.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Event propagation', () => {
    it('should prevent event propagation when clicking copy button', async () => {
      const thoughts = 'Test thoughts';
      const fragment = buildSpeechMeta(document, domFactory, { thoughts });

      const container = document.createElement('div');
      container.addEventListener('click', jest.fn());
      container.appendChild(fragment);
      document.body.appendChild(container);

      const thoughtsBtn = document.querySelector('.meta-btn.thoughts');
      const containerClickHandler = container.onclick || jest.fn();

      thoughtsBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Container click handler should not be called due to stopPropagation
      expect(containerClickHandler).not.toHaveBeenCalled();
    });
  });
});
