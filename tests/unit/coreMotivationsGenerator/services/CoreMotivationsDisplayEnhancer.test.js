/**
 * @file Unit tests for CoreMotivationsDisplayEnhancer service
 * @see CoreMotivationsDisplayEnhancer.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsDisplayEnhancer } from '../../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';

describe('CoreMotivationsDisplayEnhancer', () => {
  let displayEnhancer;
  let mockLogger;
  let mockMotivation;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create service instance
    displayEnhancer = new CoreMotivationsDisplayEnhancer({
      logger: mockLogger,
    });

    // Create mock motivation data
    mockMotivation = new CoreMotivation({
      id: 'test-motivation-123',
      directionId: 'direction-456',
      conceptId: 'concept-789',
      coreDesire: 'To achieve greatness and be remembered for generations',
      internalContradiction:
        'Desires fame but fears the loss of privacy and authentic relationships',
      centralQuestion:
        'Is lasting legacy worth sacrificing personal connections?',
      createdAt: '2024-12-20T15:45:00.000Z',
      metadata: {
        model: 'test-model',
        promptVersion: '1.0.0',
      },
    });

    // Setup DOM environment
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(displayEnhancer).toBeDefined();
      expect(displayEnhancer).toBeInstanceOf(CoreMotivationsDisplayEnhancer);
    });

    it('should throw error when logger is missing', () => {
      expect(() => new CoreMotivationsDisplayEnhancer({})).toThrow();
    });

    it('should throw error when logger lacks required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other methods
      expect(
        () => new CoreMotivationsDisplayEnhancer({ logger: invalidLogger })
      ).toThrow();
    });
  });

  describe('createMotivationBlock', () => {
    it('should create a complete motivation block with correct structure', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);

      expect(element).toBeDefined();
      expect(element.tagName).toBe('DIV');
      expect(element.className).toBe('motivation-block');
      expect(element.getAttribute('data-motivation-id')).toBe(
        'test-motivation-123'
      );
    });

    it('should include header with timestamp and actions', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);
      const header = element.querySelector('.motivation-block-header');

      expect(header).toBeDefined();

      const timestamp = header.querySelector('.motivation-timestamp');
      expect(timestamp).toBeDefined();
      expect(timestamp.textContent).toContain('Dec');
      expect(timestamp.textContent).toContain('2024');

      const actions = header.querySelector('.motivation-actions');
      expect(actions).toBeDefined();

      const copyBtn = actions.querySelector('.copy-btn');
      expect(copyBtn).toBeDefined();
      expect(copyBtn.textContent).toBe('Copy');

      const deleteBtn = actions.querySelector('.delete-btn');
      expect(deleteBtn).toBeDefined();
      expect(deleteBtn.textContent).toBe('Delete');
      expect(deleteBtn.getAttribute('data-motivation-id')).toBe(
        'test-motivation-123'
      );
    });

    it('should include all three content sections with correct classes', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);
      const content = element.querySelector('.motivation-content');

      expect(content).toBeDefined();

      // Check core motivation section
      const coreSection = content.querySelector(
        '.motivation-section.core-motivation'
      );
      expect(coreSection).toBeDefined();
      const coreHeading = coreSection.querySelector('h4');
      expect(coreHeading.textContent).toBe('Core Motivation');
      const coreText = coreSection.querySelector('p');
      expect(coreText.textContent).toBe(
        'To achieve greatness and be remembered for generations'
      );

      // Check contradiction section
      const contradictionSection = content.querySelector(
        '.motivation-section.contradiction'
      );
      expect(contradictionSection).toBeDefined();
      const contradictionHeading = contradictionSection.querySelector('h4');
      expect(contradictionHeading.textContent).toBe('Internal Contradiction');
      const contradictionText = contradictionSection.querySelector('p');
      expect(contradictionText.textContent).toBe(
        'Desires fame but fears the loss of privacy and authentic relationships'
      );

      // Check central question section
      const questionSection = content.querySelector(
        '.motivation-section.central-question'
      );
      expect(questionSection).toBeDefined();
      const questionHeading = questionSection.querySelector('h4');
      expect(questionHeading.textContent).toBe('Central Question');
      const questionText = questionSection.querySelector('p');
      expect(questionText.textContent).toBe(
        'Is lasting legacy worth sacrificing personal connections?'
      );
    });

    it('should throw error for invalid motivation object', () => {
      expect(() => displayEnhancer.createMotivationBlock(null)).toThrow(
        'Motivation object is required'
      );
      expect(() => displayEnhancer.createMotivationBlock(undefined)).toThrow(
        'Motivation object is required'
      );
      expect(() => displayEnhancer.createMotivationBlock('invalid')).toThrow(
        'Motivation object is required'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid motivation provided to createMotivationBlock'
        )
      );
    });

    it('should throw error for missing required fields', () => {
      const invalidMotivation = {
        id: 'test-123',
        coreDesire: 'Test desire',
        // Missing internalContradiction and centralQuestion
      };

      expect(() =>
        displayEnhancer.createMotivationBlock(invalidMotivation)
      ).toThrow('Motivation missing required field: internalContradiction');
    });

    it('should throw error for non-string ID', () => {
      const invalidMotivation = {
        id: 123, // Should be string
        coreDesire: 'Test desire',
        internalContradiction: 'Test contradiction',
        centralQuestion: 'Test question?',
      };

      expect(() =>
        displayEnhancer.createMotivationBlock(invalidMotivation)
      ).toThrow('Motivation ID must be a string');
    });

    it('should sanitize HTML in text content', () => {
      const maliciousMotivation = new CoreMotivation({
        id: 'test-xss',
        directionId: 'dir-456',
        conceptId: 'concept-789',
        coreDesire: 'Test <script>alert("XSS")</script> desire',
        internalContradiction:
          'Test <img src=x onerror=alert(1)> contradiction',
        centralQuestion: 'Test <b>bold</b> question?',
        createdAt: '2024-12-20T12:00:00.000Z',
      });

      const element =
        displayEnhancer.createMotivationBlock(maliciousMotivation);

      const coreText = element.querySelector('.core-motivation p').textContent;
      expect(coreText).toBe('Test alert("XSS") desire');
      expect(coreText).not.toContain('<script>');
      expect(coreText).not.toContain('</script>');

      const contradictionText =
        element.querySelector('.contradiction p').textContent;
      expect(contradictionText).toBe('Test  contradiction');
      expect(contradictionText).not.toContain('<img');
      expect(contradictionText).not.toContain('onerror');

      const questionText = element.querySelector(
        '.central-question p'
      ).textContent;
      expect(questionText).toBe('Test bold question?');
      expect(questionText).not.toContain('<b>');
      expect(questionText).not.toContain('</b>');
    });

    it('should add ARIA labels and title attributes to buttons', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);

      const copyBtn = element.querySelector('.copy-btn');
      expect(copyBtn.getAttribute('aria-label')).toBe(
        'Copy motivation to clipboard: To achieve greatness and be remembered for generat...'
      );
      expect(copyBtn.getAttribute('title')).toBe(
        'Copy this motivation to clipboard'
      );

      const deleteBtn = element.querySelector('.delete-btn');
      expect(deleteBtn.getAttribute('aria-label')).toBe(
        'Delete motivation: To achieve greatness and be remembered for generat...'
      );
      expect(deleteBtn.getAttribute('title')).toBe(
        'Delete this motivation permanently'
      );
    });

    it('should add accessibility attributes to main container', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);

      expect(element.getAttribute('role')).toBe('article');
      expect(element.getAttribute('aria-label')).toContain(
        'Core motivation block created'
      );
      expect(element.getAttribute('aria-label')).toContain('Dec 20, 2024');
    });

    it('should add accessibility attributes to content sections', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);
      const sections = element.querySelectorAll('.motivation-section');

      expect(sections.length).toBe(3);

      sections.forEach((section) => {
        expect(section.getAttribute('role')).toBe('section');
        expect(section.getAttribute('aria-labelledby')).toMatch(
          /^(core-motivation|contradiction|central-question)-heading-/
        );

        const heading = section.querySelector('h4');
        const paragraph = section.querySelector('p');

        expect(heading.getAttribute('id')).toBe(
          section.getAttribute('aria-labelledby')
        );
        expect(paragraph.getAttribute('aria-describedby')).toBe(heading.id);
      });
    });

    it('should log debug message when creating block', () => {
      displayEnhancer.createMotivationBlock(mockMotivation);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Created motivation block for ID: test-motivation-123'
      );
    });
  });

  describe('formatTimestamp', () => {
    it('should format valid ISO string correctly', () => {
      const result = displayEnhancer.formatTimestamp(
        '2024-12-20T15:45:00.000Z'
      );
      expect(result).toContain('Dec');
      expect(result).toContain('20');
      expect(result).toContain('2024');
      expect(result).toContain('PM');
    });

    it('should handle missing timestamp', () => {
      const result = displayEnhancer.formatTimestamp(null);
      expect(result).toBe('Unknown date');
    });

    it('should handle invalid date string', () => {
      const result = displayEnhancer.formatTimestamp('invalid-date');
      expect(result).toBe('Invalid date');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid date string: invalid-date'
      );
    });

    it('should handle empty string', () => {
      const result = displayEnhancer.formatTimestamp('');
      expect(result).toBe('Unknown date');
    });

    it('should log and return fallback when formatting throws', () => {
      const localeSpy = jest
        .spyOn(Date.prototype, 'toLocaleString')
        .mockImplementation(() => {
          throw new Error('Formatting failure');
        });

      const result = displayEnhancer.formatTimestamp(
        '2024-12-20T15:45:00.000Z'
      );

      expect(result).toBe('Unknown date');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error formatting timestamp: Formatting failure'
      );

      localeSpy.mockRestore();
    });

    it('should format different times correctly', () => {
      const morning = displayEnhancer.formatTimestamp(
        '2024-01-15T09:30:00.000Z'
      );
      expect(morning).toContain('Jan');
      expect(morning).toContain('15');
      expect(morning).toContain('2024');

      const evening = displayEnhancer.formatTimestamp(
        '2024-06-30T20:15:00.000Z'
      );
      expect(evening).toContain('Jun');
      expect(evening).toContain('30');
      expect(evening).toContain('2024');
    });
  });

  describe('handleCopy', () => {
    it('should handle missing Clipboard API gracefully', async () => {
      const dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');

      // Remove clipboard API temporarily
      const originalClipboard = navigator.clipboard;
      delete navigator.clipboard;

      await displayEnhancer.handleCopy(mockMotivation);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Clipboard API not available'
      );
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'motivationCopyFailed',
        })
      );

      const eventCall = dispatchEventSpy.mock.calls[0][0];
      expect(eventCall.detail).toEqual({
        motivationId: 'test-motivation-123',
        error: 'Clipboard API not supported',
      });

      // Restore clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });

      dispatchEventSpy.mockRestore();
    });
  });

  describe('handleCopy with Clipboard API', () => {
    let clipboardWriteTextSpy;
    let dispatchEventSpy;

    beforeEach(() => {
      // Mock clipboard API
      clipboardWriteTextSpy = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardWriteTextSpy },
        writable: true,
        configurable: true,
      });

      // Mock document.dispatchEvent
      dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
    });

    afterEach(() => {
      dispatchEventSpy.mockRestore();
    });

    it('should copy motivation text to clipboard', async () => {
      await displayEnhancer.handleCopy(mockMotivation);

      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(
        expect.stringContaining('Core Motivation: To achieve greatness')
      );
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(
        expect.stringContaining('Internal Contradiction: Desires fame')
      );
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(
        expect.stringContaining('Central Question: Is lasting legacy')
      );
    });

    it('should dispatch success event when copy succeeds', async () => {
      await displayEnhancer.handleCopy(mockMotivation);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'motivationCopied',
        })
      );

      const eventCall = dispatchEventSpy.mock.calls[0][0];
      expect(eventCall.detail).toEqual({ motivationId: 'test-motivation-123' });
    });

    it('should log info message on successful copy', async () => {
      await displayEnhancer.handleCopy(mockMotivation);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Copied motivation test-motivation-123 to clipboard'
      );
    });

    it('should handle clipboard API failure', async () => {
      clipboardWriteTextSpy.mockRejectedValue(
        new Error('Clipboard access denied')
      );

      await displayEnhancer.handleCopy(mockMotivation);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to copy motivation: Clipboard access denied'
      );
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'motivationCopyFailed',
        })
      );

      const eventCall = dispatchEventSpy.mock.calls[0][0];
      expect(eventCall.detail).toEqual({
        motivationId: 'test-motivation-123',
        error: 'Clipboard access denied',
      });
    });
  });

  describe('handleDelete', () => {
    let dispatchEventSpy;

    beforeEach(() => {
      dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
    });

    afterEach(() => {
      dispatchEventSpy.mockRestore();
    });

    it('should handle non-string motivation ID', () => {
      displayEnhancer.handleDelete(123);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid motivation ID provided for deletion'
      );
      expect(dispatchEventSpy).not.toHaveBeenCalled();

      displayEnhancer.handleDelete({ id: 'test' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid motivation ID provided for deletion'
      );
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    it('should dispatch delete event with motivation ID', () => {
      displayEnhancer.handleDelete('test-motivation-123');

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'motivationDeleteRequested',
        })
      );

      const eventCall = dispatchEventSpy.mock.calls[0][0];
      expect(eventCall.detail).toEqual({ motivationId: 'test-motivation-123' });
    });

    it('should log info message when triggering deletion', () => {
      displayEnhancer.handleDelete('test-motivation-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Triggering deletion for motivation test-motivation-123'
      );
    });

    it('should handle missing motivation ID', () => {
      displayEnhancer.handleDelete(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid motivation ID provided for deletion'
      );
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    it('should handle empty string motivation ID', () => {
      displayEnhancer.handleDelete('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid motivation ID provided for deletion'
      );
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('formatMotivationsForExport', () => {
    it('should format single motivation for export', () => {
      const result = displayEnhancer.formatMotivationsForExport([
        mockMotivation,
      ]);

      expect(result).toContain('Core Motivations Export');
      expect(result).toContain('Motivation 1');
      expect(result).toContain('Core Motivation: To achieve greatness');
      expect(result).toContain('Internal Contradiction: Desires fame');
      expect(result).toContain('Central Question: Is lasting legacy');
    });

    it('should format multiple motivations for export', () => {
      const motivation2 = new CoreMotivation({
        id: 'test-motivation-456',
        directionId: 'direction-456',
        conceptId: 'concept-789',
        coreDesire: 'To find inner peace',
        internalContradiction: 'Seeks tranquility but driven by ambition',
        centralQuestion: 'Can one achieve peace while pursuing goals?',
        createdAt: '2024-12-21T10:30:00.000Z',
      });

      const result = displayEnhancer.formatMotivationsForExport([
        mockMotivation,
        motivation2,
      ]);

      expect(result).toContain('Motivation 1');
      expect(result).toContain('Motivation 2');
      expect(result).toContain('To achieve greatness');
      expect(result).toContain('To find inner peace');
    });

    it('should include direction title when provided', () => {
      const direction = { title: "Hero's Journey" };
      const result = displayEnhancer.formatMotivationsForExport(
        [mockMotivation],
        direction
      );

      expect(result).toContain('Core Motivations for "Hero\'s Journey"');
    });

    it('should handle direction with name instead of title', () => {
      const direction = { name: 'Tragic Fall' };
      const result = displayEnhancer.formatMotivationsForExport(
        [mockMotivation],
        direction
      );

      expect(result).toContain('Core Motivations for "Tragic Fall"');
    });

    it('should handle empty motivations array', () => {
      const result = displayEnhancer.formatMotivationsForExport([]);
      expect(result).toBe('No motivations to export');
    });

    it('should handle null motivations array', () => {
      const result = displayEnhancer.formatMotivationsForExport(null);
      expect(result).toBe('No motivations to export');
    });
  });

  describe('attachEventHandlers', () => {
    let blockElement;
    let deleteCallback;

    beforeEach(() => {
      // Create a mock block element
      blockElement = document.createElement('div');
      blockElement.setAttribute('data-motivation-id', 'test-motivation-123');

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      blockElement.appendChild(deleteBtn);

      document.body.appendChild(blockElement);

      deleteCallback = jest.fn();
    });

    it('should attach delete handler when callback provided', () => {
      displayEnhancer.attachEventHandlers(blockElement, {
        onDelete: deleteCallback,
      });

      const deleteBtn = blockElement.querySelector('.delete-btn');
      deleteBtn.click();

      expect(deleteCallback).toHaveBeenCalledWith('test-motivation-123');
    });

    it('should log debug message when handlers attached', () => {
      displayEnhancer.attachEventHandlers(blockElement, {
        onDelete: deleteCallback,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Event handlers attached for motivation test-motivation-123'
      );
    });

    it('should handle missing block element', () => {
      displayEnhancer.attachEventHandlers(null, {
        onDelete: deleteCallback,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No block element provided for event attachment'
      );
      expect(deleteCallback).not.toHaveBeenCalled();
    });

    it('should handle missing callbacks object', () => {
      expect(() => {
        displayEnhancer.attachEventHandlers(blockElement);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Event handlers attached for motivation test-motivation-123'
      );
    });

    it('should not attach handler when delete button not found', () => {
      const emptyBlock = document.createElement('div');
      emptyBlock.setAttribute('data-motivation-id', 'test-456');

      displayEnhancer.attachEventHandlers(emptyBlock, {
        onDelete: deleteCallback,
      });

      expect(deleteCallback).not.toHaveBeenCalled();
    });
  });

  describe('Event button interactions', () => {
    it('should have clickable copy button that triggers handleCopy', async () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);
      const handleCopySpy = jest.spyOn(displayEnhancer, 'handleCopy');

      // Re-create element to get the spy attached
      const newElement = displayEnhancer.createMotivationBlock(mockMotivation);
      document.body.appendChild(newElement);

      const copyBtn = newElement.querySelector('.copy-btn');
      expect(copyBtn).toBeDefined();

      // Simulate click
      copyBtn.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handleCopySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-motivation-123',
        })
      );
    });

    it('should create buttons with correct types', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);

      const copyBtn = element.querySelector('.copy-btn');
      expect(copyBtn.type).toBe('button');

      const deleteBtn = element.querySelector('.delete-btn');
      expect(deleteBtn.type).toBe('button');
    });
  });

  describe('DOM structure validation', () => {
    it('should create nested structure matching CSS expectations', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);

      // Verify complete structure
      expect(element.className).toBe('motivation-block');

      const header = element.children[0];
      expect(header.className).toBe('motivation-block-header');

      const content = element.children[1];
      expect(content.className).toBe('motivation-content');

      // Verify all sections have correct double classes
      const sections = content.querySelectorAll('.motivation-section');
      expect(sections.length).toBe(3);

      expect(sections[0].classList.contains('core-motivation')).toBe(true);
      expect(sections[1].classList.contains('contradiction')).toBe(true);
      expect(sections[2].classList.contains('central-question')).toBe(true);
    });

    it('should handle minimal content gracefully', () => {
      const minimalMotivation = new CoreMotivation({
        id: 'minimal-123',
        directionId: 'dir-456',
        conceptId: 'concept-789',
        coreDesire: 'Brief desire',
        internalContradiction: 'Brief contradiction',
        centralQuestion: 'Brief question?',
        createdAt: '2024-12-20T12:00:00.000Z',
      });

      const element = displayEnhancer.createMotivationBlock(minimalMotivation);

      const coreSection = element.querySelector(
        '.motivation-section.core-motivation p'
      );
      expect(coreSection.textContent).toBe('Brief desire');

      const contradictionSection = element.querySelector(
        '.motivation-section.contradiction p'
      );
      expect(contradictionSection.textContent).toBe('Brief contradiction');

      const questionSection = element.querySelector(
        '.motivation-section.central-question p'
      );
      expect(questionSection.textContent).toBe('Brief question?');
    });
  });

  describe('formatSingleMotivation', () => {
    it('should format a single motivation using public API', () => {
      const result = displayEnhancer.formatSingleMotivation(mockMotivation);

      expect(result).toContain('Core Motivation: To achieve greatness');
      expect(result).toContain('Internal Contradiction: Desires fame');
      expect(result).toContain('Central Question: Is lasting legacy');
      expect(result).toContain('Created:');
    });

    it('should throw error for invalid motivation', () => {
      expect(() => displayEnhancer.formatSingleMotivation(null)).toThrow(
        'Valid motivation object is required'
      );
      expect(() => displayEnhancer.formatSingleMotivation('invalid')).toThrow(
        'Valid motivation object is required'
      );
      expect(() => displayEnhancer.formatSingleMotivation(undefined)).toThrow(
        'Valid motivation object is required'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid motivation provided to formatSingleMotivation'
      );
    });
  });

  describe('cleanupEventListeners', () => {
    it('should remove event listeners from copy button', () => {
      const element = displayEnhancer.createMotivationBlock(mockMotivation);
      const copyBtn = element.querySelector('.copy-btn');

      // Verify handler exists
      expect(copyBtn._copyHandler).toBeDefined();
      expect(copyBtn._motivation).toBeDefined();

      // Clean up
      displayEnhancer.cleanupEventListeners(element);

      // Verify handlers removed
      expect(copyBtn._copyHandler).toBeUndefined();
      expect(copyBtn._motivation).toBeUndefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleaned up event listeners for motivation test-motivation-123'
      );
    });

    it('should handle missing block element', () => {
      displayEnhancer.cleanupEventListeners(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No block element provided for cleanup'
      );
    });

    it('should handle block without copy button', () => {
      const emptyBlock = document.createElement('div');
      emptyBlock.setAttribute('data-motivation-id', 'test-456');

      expect(() =>
        displayEnhancer.cleanupEventListeners(emptyBlock)
      ).not.toThrow();
    });

    it('should clean up delete handler if present', () => {
      const blockElement = document.createElement('div');
      blockElement.setAttribute('data-motivation-id', 'test-123');

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      const deleteHandler = jest.fn();
      deleteBtn._deleteHandler = deleteHandler;
      blockElement.appendChild(deleteBtn);

      displayEnhancer.cleanupEventListeners(blockElement);

      expect(deleteBtn._deleteHandler).toBeUndefined();
    });
  });
});
