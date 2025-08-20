/**
 * @file Integration tests for Core Motivations Generator Accessibility
 * Tests real accessibility features in browser environment
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';

describe('Core Motivations Generator - Accessibility Integration', () => {
  let displayEnhancer;
  let logger;

  beforeEach(() => {
    // Mock logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    displayEnhancer = new CoreMotivationsDisplayEnhancer({ logger });

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(),
      },
    });
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Motivation Block Accessibility', () => {
    it('should create motivation block with proper ARIA attributes', () => {
      // Arrange
      const motivation = {
        id: 'test-motivation-1',
        coreDesire: 'Seek adventure and discover new worlds',
        internalContradiction: 'Fears the unknown but craves excitement',
        centralQuestion: 'What will it take to overcome my fears?',
        createdAt: new Date().toISOString(),
      };

      // Act
      const block = displayEnhancer.createMotivationBlock(motivation);

      // Assert - Main container accessibility
      expect(block.getAttribute('role')).toBe('article');
      expect(block.getAttribute('aria-label')).toContain(
        'Core motivation block'
      );
      expect(block.getAttribute('data-motivation-id')).toBe(motivation.id);

      // Assert - Action buttons accessibility
      const copyBtn = block.querySelector('.copy-btn');
      const deleteBtn = block.querySelector('.delete-btn');

      expect(copyBtn.getAttribute('aria-label')).toContain(
        'Copy motivation to clipboard'
      );
      expect(copyBtn.getAttribute('title')).toBe(
        'Copy this motivation to clipboard'
      );
      expect(copyBtn.getAttribute('type')).toBe('button');

      expect(deleteBtn.getAttribute('aria-label')).toContain(
        'Delete motivation'
      );
      expect(deleteBtn.getAttribute('title')).toBe(
        'Delete this motivation permanently'
      );
      expect(deleteBtn.getAttribute('type')).toBe('button');
      expect(deleteBtn.getAttribute('data-motivation-id')).toBe(motivation.id);
    });

    it('should create content sections with proper ARIA structure', () => {
      // Arrange
      const motivation = {
        id: 'test-motivation-2',
        coreDesire: 'Become a respected leader',
        internalContradiction: 'Struggles with self-doubt',
        centralQuestion: 'How can I inspire others when I doubt myself?',
        createdAt: new Date().toISOString(),
      };

      // Act
      const block = displayEnhancer.createMotivationBlock(motivation);

      // Assert
      const sections = block.querySelectorAll('.motivation-section');
      expect(sections).toHaveLength(3); // Core desire, contradiction, question

      sections.forEach((section) => {
        expect(section.getAttribute('role')).toBe('section');
        expect(section.getAttribute('aria-labelledby')).toBeTruthy();

        const heading = section.querySelector('h4');
        expect(heading).toBeTruthy();
        expect(heading.id).toBe(section.getAttribute('aria-labelledby'));

        const paragraph = section.querySelector('p');
        expect(paragraph).toBeTruthy();
        expect(paragraph.getAttribute('aria-describedby')).toBe(heading.id);
      });
    });

    it('should handle copy functionality with accessibility feedback', async () => {
      // Arrange
      const motivation = {
        id: 'test-motivation-3',
        coreDesire: 'Master ancient magic',
        internalContradiction: 'Magic comes at a terrible cost',
        centralQuestion: 'Is power worth the sacrifice?',
        createdAt: new Date().toISOString(),
      };

      const block = displayEnhancer.createMotivationBlock(motivation);
      document.body.appendChild(block);

      const copyBtn = block.querySelector('.copy-btn');

      // Set up event listener to capture custom events
      let capturedEvent = null;
      document.addEventListener('motivationCopied', (event) => {
        capturedEvent = event;
      });

      // Act
      await copyBtn.click();

      // Assert
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Core Motivation: Master ancient magic')
      );
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.detail.motivationId).toBe(motivation.id);
    });
  });

  describe('Content Formatting', () => {
    it('should format single motivation for accessibility', () => {
      // Arrange
      const motivation = {
        id: 'test-motivation-4',
        coreDesire: 'Protect the innocent',
        internalContradiction: 'Violence disturbs their peaceful nature',
        centralQuestion: 'Can I save others without losing myself?',
        createdAt: new Date('2024-01-15T10:30:00Z').toISOString(),
      };

      // Act
      const formatted = displayEnhancer.formatSingleMotivation(motivation);

      // Assert
      expect(formatted).toContain('Core Motivation: Protect the innocent');
      expect(formatted).toContain(
        'Internal Contradiction: Violence disturbs their peaceful nature'
      );
      expect(formatted).toContain(
        'Central Question: Can I save others without losing myself?'
      );
      expect(formatted).toContain('Created: Jan 15, 2024');
    });

    it('should format multiple motivations for export with headings', () => {
      // Arrange
      const motivations = [
        {
          id: 'motivation-1',
          coreDesire: 'Find true love',
          internalContradiction: 'Fears commitment and vulnerability',
          centralQuestion: 'Can I open my heart without getting hurt?',
          createdAt: new Date('2024-01-10T09:00:00Z').toISOString(),
        },
        {
          id: 'motivation-2',
          coreDesire: 'Achieve immortality',
          internalContradiction: 'Values human connections that are temporary',
          centralQuestion: 'What is life without the people I love?',
          createdAt: new Date('2024-01-11T14:00:00Z').toISOString(),
        },
      ];

      const direction = {
        title: 'The Eternal Struggle',
        theme: 'Love versus ambition',
      };

      // Act
      const exported = displayEnhancer.formatMotivationsForExport(
        motivations,
        direction
      );

      // Assert
      expect(exported).toContain('Core Motivations for "The Eternal Struggle"');
      expect(exported).toContain('='.repeat(50));
      expect(exported).toContain('Motivation 1');
      expect(exported).toContain('Motivation 2');
      expect(exported).toContain('Find true love');
      expect(exported).toContain('Achieve immortality');
    });
  });

  describe('Error Handling with Accessibility', () => {
    it('should handle invalid motivation gracefully', () => {
      // Arrange
      const invalidMotivation = {
        id: 'invalid',
        // Missing required fields
      };

      // Act & Assert
      expect(() => {
        displayEnhancer.createMotivationBlock(invalidMotivation);
      }).toThrow('Motivation missing required field');
    });

    it('should handle clipboard API failure with custom event', async () => {
      // Arrange
      navigator.clipboard.writeText = jest
        .fn()
        .mockRejectedValue(new Error('Clipboard access denied'));

      const motivation = {
        id: 'test-motivation-5',
        coreDesire: 'Become legendary',
        internalContradiction: 'Seeks fame but values privacy',
        centralQuestion: 'Can I be famous and still be myself?',
        createdAt: new Date().toISOString(),
      };

      const block = displayEnhancer.createMotivationBlock(motivation);
      document.body.appendChild(block);

      let errorEvent = null;
      document.addEventListener('motivationCopyFailed', (event) => {
        errorEvent = event;
      });

      // Act
      await displayEnhancer.handleCopy(motivation);

      // Assert
      expect(errorEvent).toBeTruthy();
      expect(errorEvent.detail.motivationId).toBe(motivation.id);
      expect(errorEvent.detail.error).toContain('Clipboard access denied');
    });

    it('should handle missing clipboard API gracefully', async () => {
      // Arrange
      const originalClipboard = navigator.clipboard;
      delete navigator.clipboard;

      const motivation = {
        id: 'test-motivation-6',
        coreDesire: 'Unite the kingdoms',
        internalContradiction: 'Distrusts authority figures',
        centralQuestion: 'How can I lead those I cannot trust?',
        createdAt: new Date().toISOString(),
      };

      let errorEvent = null;
      document.addEventListener('motivationCopyFailed', (event) => {
        errorEvent = event;
      });

      // Act
      await displayEnhancer.handleCopy(motivation);

      // Assert
      expect(errorEvent).toBeTruthy();
      expect(errorEvent.detail.error).toBe('Clipboard API not supported');

      // Restore clipboard API
      navigator.clipboard = originalClipboard;
    });
  });

  describe('Timestamp Formatting for Screen Readers', () => {
    it('should format timestamps in accessible format', () => {
      // Arrange
      const testDate = '2024-03-15T16:45:30.123Z';

      // Act
      const formatted = displayEnhancer.formatTimestamp(testDate);

      // Assert
      expect(formatted).toMatch(/Mar 15, 2024/);
      expect(formatted).toMatch(/[0-9]:45 PM/); // Allow for timezone differences
    });

    it('should handle invalid dates gracefully', () => {
      // Act & Assert
      expect(displayEnhancer.formatTimestamp('invalid-date')).toBe(
        'Invalid date'
      );
      expect(displayEnhancer.formatTimestamp('')).toBe('Unknown date');
      expect(displayEnhancer.formatTimestamp(null)).toBe('Unknown date');
    });
  });

  describe('Event Handler Management', () => {
    it('should properly clean up event listeners', () => {
      // Arrange
      const motivation = {
        id: 'test-cleanup',
        coreDesire: 'Clean up after myself',
        internalContradiction: 'Tends to be messy',
        centralQuestion: 'Why is it so hard to stay organized?',
        createdAt: new Date().toISOString(),
      };

      const block = displayEnhancer.createMotivationBlock(motivation);
      const copyBtn = block.querySelector('.copy-btn');

      // Verify handler was attached
      expect(copyBtn._copyHandler).toBeDefined();
      expect(copyBtn._motivation).toBe(motivation);

      // Act - Clean up
      displayEnhancer.cleanupEventListeners(block);

      // Assert
      expect(copyBtn._copyHandler).toBeUndefined();
      expect(copyBtn._motivation).toBeUndefined();
    });
  });
});
