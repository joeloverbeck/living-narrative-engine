import { BaseModalRenderer } from './baseModalRenderer.js';
import { buildModalElementsConfig } from './helpers/buildModalElementsConfig.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').DomElementFactory} DomElementFactory
 */

/**
 * @typedef {object} PromptPreviewPayload
 * @property {string} [prompt] - The assembled prompt text.
 * @property {string} [actorId] - The ID of the acting actor.
 * @property {string} [actorName] - The display name of the acting actor.
 * @property {string} [llmId] - The ID of the LLM config used.
 * @property {number} [actionCount] - The number of actions available.
 * @property {string[]} [errors] - A list of error messages, if any.
 */

/**
 * @class PromptPreviewModal
 * @augments BaseModalRenderer
 * @description Manages the LLM Prompt Preview modal.
 * Displays the fully composed prompt, metadata, and handles the copy-to-clipboard functionality.
 */
export class PromptPreviewModal extends BaseModalRenderer {
  /**
   * Creates an instance of PromptPreviewModal.
   *
   * @param {object} dependencies - The dependencies for this class.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @param {IDocumentContext} dependencies.documentContext - The document context.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher.
   * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
  }) {
    const elementsConfig = buildModalElementsConfig({
      modalElement: '#llm-prompt-debug-modal',
      closeButton: '#llm-prompt-debug-close-button',
      statusMessageElement: '#llm-prompt-debug-status',
      // Custom elements for this modal
      contentArea: '#llm-prompt-debug-content',
      copyButton: '#llm-prompt-copy-button',
      metaActor: '#llm-prompt-meta-actor',
      metaLlm: '#llm-prompt-meta-llm',
      metaActions: '#llm-prompt-meta-actions',
    });

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    this.domElementFactory = domElementFactory;

    // Bind the copy button listener
    if (this.elements.copyButton) {
      this._addDomListener(this.elements.copyButton, 'click', () =>
        this._handleCopy()
      );
    } else {
      this.logger.warn(
        `${this._logPrefix} Copy button (#llm-prompt-copy-button) not found.`
      );
    }
  }

  /**
   * Shows the modal with the provided payload data.
   *
   * @param {PromptPreviewPayload} payload - The data to display.
   */
  show(payload) {
    // Call super.show() first to handle visibility and focus
    super.show();
    this._renderPayload(payload);
  }

  /**
   * Renders the payload data into the modal elements.
   *
   * @param {PromptPreviewPayload} payload - The data to display.
   * @private
   */
  _renderPayload(payload) {
    if (!payload) {
      this._displayStatusMessage('No data received.', 'error');
      this._clearContent();
      return;
    }

    if (payload.errors && payload.errors.length > 0) {
      const errorMsg = payload.errors.join('; ');
      this._displayStatusMessage(`Errors: ${errorMsg}`, 'error');
      // We might still want to show partial content if available, or clear it.
      // The ticket says "If payload.prompt is present... Injects...".
      // If strictly errors, maybe just show errors.
      // But usually a partial prompt is better than nothing for debugging.
    }

    if (payload.prompt) {
      if (this.elements.contentArea) {
        this.elements.contentArea.textContent = payload.prompt;
      }
      // If we have a prompt, we might want to clear any previous "loading" or "error" status
      // unless we explicitly want to show the errors alongside the prompt.
      // If there are no errors, clear status.
      if (!payload.errors || payload.errors.length === 0) {
        this._clearStatusMessage();
      }
    } else if (!payload.errors || payload.errors.length === 0) {
      // No prompt and no errors?
      if (this.elements.contentArea) {
        this.elements.contentArea.textContent = '';
      }
      this._displayStatusMessage('No prompt generated.', 'warning');
    }

    this._updateMetadata(payload);
  }

  /**
   * Updates the metadata fields.
   *
   * @param {PromptPreviewPayload} payload - The data containing metadata.
   * @private
   */
  _updateMetadata(payload) {
    if (this.elements.metaActor) {
      const name = payload.actorName || payload.actorId || 'Unknown';
      this.elements.metaActor.textContent = name;
    }

    if (this.elements.metaLlm) {
      this.elements.metaLlm.textContent = payload.llmId || 'N/A';
    }

    if (this.elements.metaActions) {
      this.elements.metaActions.textContent =
        typeof payload.actionCount === 'number'
          ? String(payload.actionCount)
          : '-';
    }
  }

  /**
   * Clears the content area and metadata.
   *
   * @private
   */
  _clearContent() {
    if (this.elements.contentArea) {
      this.elements.contentArea.textContent = '';
    }
    if (this.elements.metaActor) this.elements.metaActor.textContent = '-';
    if (this.elements.metaLlm) this.elements.metaLlm.textContent = '-';
    if (this.elements.metaActions) this.elements.metaActions.textContent = '-';
  }

  /**
   * Handles the copy button click.
   * Copies the prompt text to the clipboard.
   *
   * @private
   * @async
   */
  async _handleCopy() {
    if (!this.elements.contentArea) {
      this.logger.error(
        `${this._logPrefix} Cannot copy: Content area element not found.`
      );
      return;
    }

    const textToCopy = this.elements.contentArea.textContent;
    if (!textToCopy) {
      this._displayStatusMessage('Nothing to copy.', 'warning');
      return;
    }

    try {
      // We use the Clipboard API.
      // Note: This might fail in some contexts (e.g. non-secure context),
      // but standard modern browsers support it.
      await navigator.clipboard.writeText(textToCopy);
      this._displayStatusMessage('Copied!', 'success');
      
      // Optionally clear the success message after a delay
      setTimeout(() => {
        // Only clear if it's still the "Copied!" message
        if (this.elements.statusMessageElement && this.elements.statusMessageElement.textContent === 'Copied!') {
           this._clearStatusMessage();
        }
      }, 2000);

    } catch (err) {
      this.logger.error(`${this._logPrefix} Failed to copy text:`, err);
      this._displayStatusMessage('Failed to copy.', 'error');
    }
  }

  /**
   * Sets the loading state of the modal.
   *
   * @param {boolean} isLoading - Whether the modal is in a loading state.
   * @public
   */
  setLoading(isLoading) {
    if (isLoading) {
      this._displayStatusMessage('Generating prompt...', 'info');
      this._clearContent(); // Optional: clear old content while loading
      // If not already visible, show it? 
      // The caller might call show() then setLoading(true), or just setLoading(true) implies show().
      // For now, assume the caller handles visibility if they want to show the "Loading" modal.
      // But usually, you'd show the modal *then* set loading.
      if (!this.isVisible) {
          super.show();
      }
    } else {
       // If loading is done, we expect show(payload) to be called, which updates the UI.
       // Or explicitly clear the loading message if it wasn't cleared by show().
       // But show() calls _clearStatusMessage() via super.show(), wait.
       // super.show() clears status message.
       // If setLoading(true) calls super.show(), it clears status, then sets "Generating prompt...".
       // If setLoading(false) is called, it might just clear status.
       if (this.elements.statusMessageElement && this.elements.statusMessageElement.textContent === 'Generating prompt...') {
           this._clearStatusMessage();
       }
    }
  }
}
