/**
 * @file MonteCarloReportModal - Modal for displaying and copying MC analysis reports
 * @see specs/monte-carlo-report-generator.md
 */

import { BaseModalRenderer } from '../baseModalRenderer.js';
import { buildModalElementsConfig } from '../helpers/buildModalElementsConfig.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';

/**
 * Modal renderer for displaying Monte Carlo analysis reports.
 * Extends BaseModalRenderer to provide standard modal behaviors
 * (show/hide, focus management, escape key handling) plus
 * report-specific functionality (copy to clipboard).
 */
class MonteCarloReportModal extends BaseModalRenderer {
  #reportContent = '';

  /**
   * Creates a new MonteCarloReportModal instance.
   *
   * @param {object} deps - The dependencies object.
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../../interfaces/IDocumentContext.js').IDocumentContext} deps.documentContext - Document context for DOM queries.
   * @param {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher.
   */
  constructor({ logger, documentContext, validatedEventDispatcher }) {
    const elementsConfig = buildModalElementsConfig({
      modalElement: '#mc-report-modal',
      closeButton: '#mc-report-close-btn',
      statusMessageElement: '#mc-report-status',
      contentArea: '#mc-report-content',
      copyButton: '#mc-report-copy-btn',
    });

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    this._operationInProgressAffectedElements = ['copyButton'];
    this.#bindEvents();
  }

  /**
   * Show the modal with the given markdown content.
   *
   * @param {string} markdownContent - The markdown report to display
   */
  showReport(markdownContent) {
    this.#reportContent = markdownContent;
    this.show();
  }

  /**
   * @override
   * Lifecycle hook called when modal is shown.
   */
  _onShow() {
    // Populate content area with markdown
    if (this.elements.contentArea) {
      this.elements.contentArea.textContent = this.#reportContent;
    }
  }

  /**
   * @override
   * Lifecycle hook called when modal is hidden.
   */
  _onHide() {
    // Clear stored content
    this.#reportContent = '';

    // Clear content area
    if (this.elements.contentArea) {
      this.elements.contentArea.textContent = '';
    }
  }

  /**
   * @override
   * Return the element to focus when modal opens.
   */
  _getInitialFocusElement() {
    return this.elements.copyButton || this.elements.closeButton || null;
  }

  /**
   * Bind event listeners for copy functionality.
   *
   * @private
   */
  #bindEvents() {
    if (this.elements.copyButton) {
      this._addDomListener(this.elements.copyButton, 'click', () =>
        this.#handleCopy()
      );
    }
  }

  /**
   * Handle copy button click.
   *
   * @private
   */
  async #handleCopy() {
    if (!this.#reportContent) {
      this._displayStatusMessage('No content to copy.', 'error');
      return;
    }

    try {
      const success = await copyToClipboard(this.#reportContent);

      if (success) {
        this._displayStatusMessage('Copied to clipboard!', 'success');
      } else {
        this._displayStatusMessage(
          'Failed to copy. Please select and copy manually.',
          'error'
        );
      }
    } catch (err) {
      this.logger.error('Clipboard copy failed:', err);
      this._displayStatusMessage(
        'Failed to copy. Please select and copy manually.',
        'error'
      );
    }

    // Auto-clear status after 2 seconds
    setTimeout(() => this._clearStatusMessage(), 2000);
  }
}

export default MonteCarloReportModal;
