/**
 * @file Service for creating and managing motivation block display components
 * @see CoreMotivationsGeneratorController.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../characterBuilder/models/coreMotivation.js').CoreMotivation} CoreMotivation
 */

/**
 * Service for creating motivation display blocks with card-based layout
 */
export class CoreMotivationsDisplayEnhancer {
  #logger;

  /**
   * Create a new CoreMotivationsDisplayEnhancer instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
  }

  /**
   * Validate a motivation object has required fields
   *
   * @private
   * @param {CoreMotivation} motivation - Motivation to validate
   * @throws {Error} If motivation is invalid
   */
  #validateMotivation(motivation) {
    if (!motivation || typeof motivation !== 'object') {
      throw new Error('Motivation object is required');
    }

    const required = [
      'id',
      'coreDesire',
      'internalContradiction',
      'centralQuestion',
    ];
    for (const field of required) {
      if (!motivation[field]) {
        throw new Error(`Motivation missing required field: ${field}`);
      }
    }

    if (typeof motivation.id !== 'string') {
      throw new Error('Motivation ID must be a string');
    }
  }

  /**
   * Sanitize text content before display
   *
   * @private
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  #sanitizeText(text) {
    if (!text) return '';
    // Remove any potential script tags or HTML
    return String(text)
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  /**
   * Create a motivation block DOM element
   *
   * @param {CoreMotivation} motivation - Core motivation object
   * @returns {HTMLElement} Motivation block DOM element
   */
  createMotivationBlock(motivation) {
    try {
      this.#validateMotivation(motivation);
    } catch (error) {
      this.#logger.error(
        `Invalid motivation provided to createMotivationBlock: ${error.message}`
      );
      throw error;
    }

    // Create main container with accessibility attributes
    const blockElement = document.createElement('div');
    blockElement.className = 'motivation-block';
    blockElement.setAttribute('data-motivation-id', motivation.id);
    blockElement.setAttribute('role', 'article');
    blockElement.setAttribute(
      'aria-label',
      `Core motivation block created ${this.formatTimestamp(motivation.createdAt)}`
    );

    // Create header
    const header = this.#createHeader(motivation);
    blockElement.appendChild(header);

    // Create content sections
    const content = this.#createContent(motivation);
    blockElement.appendChild(content);

    this.#logger.debug(`Created motivation block for ID: ${motivation.id}`);
    return blockElement;
  }

  /**
   * Create the header section with timestamp and actions
   *
   * @private
   * @param {CoreMotivation} motivation - Core motivation object
   * @returns {HTMLElement} Header element
   */
  #createHeader(motivation) {
    const header = document.createElement('div');
    header.className = 'motivation-block-header';

    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.className = 'motivation-timestamp';
    timestamp.textContent = this.formatTimestamp(motivation.createdAt);
    header.appendChild(timestamp);

    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'motivation-actions';

    // Copy button with enhanced accessibility
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute(
      'aria-label',
      `Copy motivation to clipboard: ${motivation.coreDesire.substring(0, 50)}${motivation.coreDesire.length > 50 ? '...' : ''}`
    );
    copyBtn.setAttribute('title', 'Copy this motivation to clipboard');
    // Store handler reference for cleanup
    const copyHandler = () => this.handleCopy(motivation);
    copyBtn.addEventListener('click', copyHandler);
    copyBtn._copyHandler = copyHandler;
    copyBtn._motivation = motivation;
    actions.appendChild(copyBtn);

    // Delete button with enhanced accessibility
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-motivation-id', motivation.id);
    deleteBtn.setAttribute(
      'aria-label',
      `Delete motivation: ${motivation.coreDesire.substring(0, 50)}${motivation.coreDesire.length > 50 ? '...' : ''}`
    );
    deleteBtn.setAttribute('title', 'Delete this motivation permanently');
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    return header;
  }

  /**
   * Create the content sections
   *
   * @private
   * @param {CoreMotivation} motivation - Core motivation object
   * @returns {HTMLElement} Content container
   */
  #createContent(motivation) {
    const content = document.createElement('div');
    content.className = 'motivation-content';

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    // Core Motivation section
    const coreSection = this.#createSection(
      'core-motivation',
      'Core Motivation',
      motivation.coreDesire
    );
    fragment.appendChild(coreSection);

    // Internal Contradiction section
    const contradictionSection = this.#createSection(
      'contradiction',
      'Internal Contradiction',
      motivation.internalContradiction
    );
    fragment.appendChild(contradictionSection);

    // Central Question section
    const questionSection = this.#createSection(
      'central-question',
      'Central Question',
      motivation.centralQuestion
    );
    fragment.appendChild(questionSection);

    content.appendChild(fragment);
    return content;
  }

  /**
   * Create a motivation section
   *
   * @private
   * @param {string} className - CSS class for the section
   * @param {string} title - Section title
   * @param {string} text - Section content
   * @returns {HTMLElement} Section element
   */
  #createSection(className, title, text) {
    const section = document.createElement('div');
    section.className = `motivation-section ${className}`;
    section.setAttribute('role', 'section');
    section.setAttribute(
      'aria-labelledby',
      `${className}-heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );

    const heading = document.createElement('h4');
    heading.textContent = title;
    heading.setAttribute('id', section.getAttribute('aria-labelledby'));
    section.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.textContent = this.#sanitizeText(text || '');
    paragraph.setAttribute('aria-describedby', heading.id);
    section.appendChild(paragraph);

    return section;
  }

  /**
   * Format ISO timestamp for display
   *
   * @param {string} isoString - ISO date string
   * @returns {string} Formatted date string
   */
  formatTimestamp(isoString) {
    if (!isoString) {
      return 'Unknown date';
    }

    try {
      const date = new Date(isoString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        this.#logger.warn(`Invalid date string: ${isoString}`);
        return 'Invalid date';
      }

      // Format as "Dec 20, 2024 3:45 PM"
      const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };

      return date.toLocaleString('en-US', options);
    } catch (error) {
      this.#logger.error(`Error formatting timestamp: ${error.message}`);
      return 'Unknown date';
    }
  }

  /**
   * Handle copy button click
   *
   * @param {CoreMotivation} motivation - Motivation to copy
   */
  async handleCopy(motivation) {
    // Check if Clipboard API is available
    if (!navigator.clipboard) {
      this.#logger.warn('Clipboard API not available');
      document.dispatchEvent(
        new CustomEvent('motivationCopyFailed', {
          detail: {
            motivationId: motivation.id,
            error: 'Clipboard API not supported',
          },
        })
      );
      return;
    }

    try {
      const text = this.#formatMotivationForCopy(motivation);
      await navigator.clipboard.writeText(text);

      this.#logger.info(`Copied motivation ${motivation.id} to clipboard`);

      // Dispatch custom event for UI feedback
      document.dispatchEvent(
        new CustomEvent('motivationCopied', {
          detail: { motivationId: motivation.id },
        })
      );
    } catch (error) {
      this.#logger.error(`Failed to copy motivation: ${error.message}`);

      // Dispatch error event
      document.dispatchEvent(
        new CustomEvent('motivationCopyFailed', {
          detail: {
            motivationId: motivation.id,
            error: error.message,
          },
        })
      );
    }
  }

  /**
   * Handle delete button click
   *
   * @param {string} motivationId - ID of motivation to delete
   */
  handleDelete(motivationId) {
    if (!motivationId || typeof motivationId !== 'string') {
      this.#logger.error('Invalid motivation ID provided for deletion');
      return;
    }

    this.#logger.info(`Triggering deletion for motivation ${motivationId}`);

    // Dispatch custom event for controller to handle
    document.dispatchEvent(
      new CustomEvent('motivationDeleteRequested', {
        detail: { motivationId },
      })
    );
  }

  /**
   * Format a single motivation for clipboard copy
   *
   * @private
   * @param {CoreMotivation} motivation - Motivation to format
   * @returns {string} Formatted text
   */
  #formatMotivationForCopy(motivation) {
    return [
      `Core Motivation: ${motivation.coreDesire}`,
      `Internal Contradiction: ${motivation.internalContradiction}`,
      `Central Question: ${motivation.centralQuestion}`,
      `Created: ${this.formatTimestamp(motivation.createdAt)}`,
    ].join('\n\n');
  }

  /**
   * Format a single motivation for clipboard copy (public API)
   * Exposes the private formatting method as public API
   *
   * @param {CoreMotivation} motivation - Motivation to format
   * @returns {string} Formatted text
   */
  formatSingleMotivation(motivation) {
    if (!motivation || typeof motivation !== 'object') {
      this.#logger.error(
        'Invalid motivation provided to formatSingleMotivation'
      );
      throw new Error('Valid motivation object is required');
    }

    return this.#formatMotivationForCopy(motivation);
  }

  /**
   * Format multiple motivations for export
   *
   * @param {CoreMotivation[]} motivations - Array of motivations
   * @param {object} [direction] - Optional direction information
   * @returns {string} Formatted text for export
   */
  formatMotivationsForExport(motivations, direction) {
    if (!motivations || motivations.length === 0) {
      return 'No motivations to export';
    }

    const header = direction
      ? `Core Motivations for "${direction.title || direction.name || 'Unknown Direction'}"\n${'='.repeat(50)}\n\n`
      : 'Core Motivations Export\n' + '='.repeat(50) + '\n\n';

    const motivationTexts = motivations.map((motivation, index) => {
      return [
        `Motivation ${index + 1}`,
        '-'.repeat(20),
        this.#formatMotivationForCopy(motivation),
      ].join('\n');
    });

    return header + motivationTexts.join('\n\n' + '='.repeat(50) + '\n\n');
  }

  /**
   * Attach event handlers for a motivation block
   * This method can be called after blocks are added to the DOM
   *
   * @param {HTMLElement} blockElement - The motivation block element
   * @param {object} callbacks - Callback functions
   * @param {Function} [callbacks.onDelete] - Delete callback
   */
  attachEventHandlers(blockElement, callbacks = {}) {
    if (!blockElement) {
      this.#logger.warn('No block element provided for event attachment');
      return;
    }

    const motivationId = blockElement.getAttribute('data-motivation-id');

    // Attach delete handler if callback provided
    if (callbacks.onDelete) {
      const deleteBtn = blockElement.querySelector('.delete-btn');
      if (deleteBtn) {
        const deleteHandler = () => {
          callbacks.onDelete(motivationId);
        };
        deleteBtn.addEventListener('click', deleteHandler);
        // Store handler reference for cleanup
        deleteBtn._deleteHandler = deleteHandler;
      }
    }

    this.#logger.debug(
      `Event handlers attached for motivation ${motivationId}`
    );
  }

  /**
   * Clean up event listeners from a motivation block
   * Call this before removing blocks from DOM to prevent memory leaks
   *
   * @param {HTMLElement} blockElement - Block to clean up
   */
  cleanupEventListeners(blockElement) {
    if (!blockElement) {
      this.#logger.warn('No block element provided for cleanup');
      return;
    }

    const copyBtn = blockElement.querySelector('.copy-btn');
    if (copyBtn && copyBtn._copyHandler) {
      copyBtn.removeEventListener('click', copyBtn._copyHandler);
      delete copyBtn._copyHandler;
      delete copyBtn._motivation;
      this.#logger.debug(
        `Cleaned up event listeners for motivation ${blockElement.getAttribute(
          'data-motivation-id'
        )}`
      );
    }

    // Clean up any delete handlers attached via attachEventHandlers
    const deleteBtn = blockElement.querySelector('.delete-btn');
    if (deleteBtn && deleteBtn._deleteHandler) {
      deleteBtn.removeEventListener('click', deleteBtn._deleteHandler);
      delete deleteBtn._deleteHandler;
    }
  }
}

export default CoreMotivationsDisplayEnhancer;
