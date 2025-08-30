/**
 * @file Defines PortraitModalRenderer, a class for displaying portrait images in a modal dialog.
 * @see baseModalRenderer.js
 */

import { BaseModalRenderer } from './baseModalRenderer.js';
import { validateDependency, assertNonBlankString, assertPresent } from '../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/**
 * @typedef {import('./baseModalRenderer.js').ModalElementsConfig} ModalElementsConfig
 */

/**
 * @class PortraitModalRenderer
 * @augments BaseModalRenderer
 * @description Manages the display of portrait images in a modal dialog.
 * Handles image loading, error states, and responsive sizing.
 */
export class PortraitModalRenderer extends BaseModalRenderer {
  #domElementFactory;
  #currentPortraitPath;
  #currentSpeakerName;
  #originalFocusElement;
  #imageElement;
  #loadingSpinner;
  #errorMessage;

  /**
   * Constructs a PortraitModalRenderer instance.
   *
   * @param {object} dependencies - The dependencies for the renderer.
   * @param {import('../interfaces/IDocumentContext.js').IDocumentContext} dependencies.documentContext - The document context abstraction.
   * @param {import('../interfaces/IDomElementFactory.js').IDomElementFactory} dependencies.domElementFactory - Factory for creating DOM elements.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - The logger instance.
   * @param {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher.
   */
  constructor({ documentContext, domElementFactory, logger, validatedEventDispatcher }) {
    // Configuration for BaseModalRenderer
    const elementsConfig = {
      modalElement: '.portrait-modal-overlay',
      closeButton: '.portrait-modal-close',
      statusMessageElement: '.portrait-error-message',
      modalImage: '.portrait-modal-image',
      loadingSpinner: '.portrait-loading-spinner',
      modalTitle: '#portrait-modal-title'
    };
    
    super({ logger, documentContext, validatedEventDispatcher, elementsConfig });
    
    validateDependency(domElementFactory, 'IDomElementFactory', logger, {
      requiredMethods: ['img', 'div', 'button']
    });
    
    this.#domElementFactory = domElementFactory;
    this.#initializeElements();
  }

  /**
   * Initializes and caches element references.
   *
   * @private
   */
  #initializeElements() {
    this.#imageElement = this.elements.modalImage;
    this.#loadingSpinner = this.elements.loadingSpinner;
    this.#errorMessage = this.elements.statusMessageElement;

    if (!this.#imageElement) {
      this.logger.warn(`${this._logPrefix} Modal image element not found.`);
    }
    if (!this.#loadingSpinner) {
      this.logger.warn(`${this._logPrefix} Loading spinner element not found.`);
    }
    if (!this.#errorMessage) {
      this.logger.warn(`${this._logPrefix} Error message element not found.`);
    }
  }

  /**
   * Shows the portrait modal with the specified image.
   *
   * @param {string} portraitPath - Path to the portrait image.
   * @param {string} speakerName - Name of the character for the modal title.
   * @param {HTMLElement} originalElement - The portrait element that was clicked (for focus return).
   */
  showModal(portraitPath, speakerName, originalElement) {
    // Validate parameters
    assertNonBlankString(portraitPath, 'portraitPath', 'showModal validation', this.logger);
    assertNonBlankString(speakerName, 'speakerName', 'showModal validation', this.logger);
    assertPresent(originalElement, 'originalElement is required', InvalidArgumentError, this.logger);

    // Store state
    this.#currentPortraitPath = portraitPath;
    this.#currentSpeakerName = speakerName;
    this.#originalFocusElement = originalElement;

    // Update modal title
    if (this.elements.modalTitle) {
      this.elements.modalTitle.textContent = speakerName;
    }

    // Reset state before showing
    this._clearStatusMessage();
    if (this.#imageElement) {
      this.#imageElement.src = '';
      this.#imageElement.classList.remove('loaded');
    }

    // Show the modal using parent class method
    this.show();
  }

  /**
   * Override: Custom logic when modal is shown.
   *
   * @protected
   * @override
   */
  _onShow() {
    this.logger.debug(`${this._logPrefix} Starting portrait load for ${this.#currentSpeakerName}`);
    
    // Start loading the portrait image
    this.#loadPortraitImage(this.#currentPortraitPath);

    // Add fade-in animation class if modal element exists
    if (this.elements.modalElement) {
      this.elements.modalElement.classList.add('fade-in');
    }

    // Dispatch event for modal opened
    if (this.validatedEventDispatcher) {
      try {
        this.validatedEventDispatcher.dispatch({
          type: 'PORTRAIT_MODAL_OPENED',
          payload: {
            portraitPath: this.#currentPortraitPath,
            speakerName: this.#currentSpeakerName
          }
        });
      } catch (error) {
        this.logger.error(`${this._logPrefix} Failed to dispatch PORTRAIT_MODAL_OPENED event`, error);
      }
    }
  }

  /**
   * Override: Custom logic when modal is hidden.
   *
   * @protected
   * @override
   */
  _onHide() {
    this.logger.debug(`${this._logPrefix} Hiding portrait modal`);

    // Store values before cleanup for event dispatch
    const portraitPath = this.#currentPortraitPath;
    const speakerName = this.#currentSpeakerName;

    // Return focus to original element
    if (this.#originalFocusElement && typeof this.#originalFocusElement.focus === 'function') {
      try {
        if (this.documentContext.document.body.contains(this.#originalFocusElement) &&
            this.#originalFocusElement.offsetParent !== null) {
          this.#originalFocusElement.focus();
        }
      } catch (error) {
        this.logger.warn(`${this._logPrefix} Could not return focus to original element`, error);
      }
    }

    // Dispatch event for modal closed
    if (this.validatedEventDispatcher) {
      try {
        this.validatedEventDispatcher.dispatch({
          type: 'PORTRAIT_MODAL_CLOSED',
          payload: {
            portraitPath: portraitPath,
            speakerName: speakerName
          }
        });
      } catch (error) {
        this.logger.error(`${this._logPrefix} Failed to dispatch PORTRAIT_MODAL_CLOSED event`, error);
      }
    }

    // Clean up resources after event dispatch
    this.#cleanup();
  }

  /**
   * Override: Returns the element that should receive initial focus.
   *
   * @protected
   * @override
   * @returns {HTMLElement|null} The close button element for initial focus.
   */
  _getInitialFocusElement() {
    return this.elements.closeButton || null;
  }

  /**
   * Loads the portrait image with loading state management.
   *
   * @private
   * @param {string} portraitPath - Path to the portrait image.
   */
  #loadPortraitImage(portraitPath) {
    // Show loading spinner
    if (this.#loadingSpinner) {
      this.#loadingSpinner.style.display = 'block';
    }
    
    if (this.#imageElement) {
      this.#imageElement.classList.remove('loaded');
    }
    
    // Create new image object for preloading
    const tempImg = new Image();
    
    tempImg.onload = () => {
      this.#handleImageLoad(tempImg, portraitPath);
    };
    
    tempImg.onerror = () => {
      this.#handleImageError(tempImg);
    };
    
    // Start loading
    tempImg.src = portraitPath;
  }

  /**
   * Handles successful image loading.
   *
   * @private
   * @param {HTMLImageElement} tempImg - The temporary image used for preloading.
   * @param {string} portraitPath - Path to the portrait image.
   */
  #handleImageLoad(tempImg, portraitPath) {
    this.logger.debug(`${this._logPrefix} Portrait loaded successfully`);

    // Hide loading spinner
    if (this.#loadingSpinner) {
      this.#loadingSpinner.style.display = 'none';
    }
    
    // Update modal image
    if (this.#imageElement) {
      this.#imageElement.src = portraitPath;
      this.#imageElement.alt = `Portrait of ${this.#currentSpeakerName}`;
      
      // Add loaded class for animation
      this.#imageElement.classList.add('loaded');
      
      // Calculate optimal dimensions
      const maxWidth = window.innerWidth * 0.9;
      const maxHeight = window.innerHeight * 0.7;
      
      if (tempImg.naturalWidth > maxWidth || tempImg.naturalHeight > maxHeight) {
        const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
        
        if (aspectRatio > maxWidth / maxHeight) {
          this.#imageElement.style.width = `${maxWidth}px`;
          this.#imageElement.style.height = 'auto';
        } else {
          this.#imageElement.style.height = `${maxHeight}px`;
          this.#imageElement.style.width = 'auto';
        }
      } else {
        // Image fits within constraints, use natural dimensions
        this.#imageElement.style.width = `${tempImg.naturalWidth}px`;
        this.#imageElement.style.height = `${tempImg.naturalHeight}px`;
      }
    }
  }

  /**
   * Handles image loading failure.
   *
   * @private
   * @param {HTMLImageElement} tempImg - The temporary image that failed to load.
   */
  #handleImageError(tempImg) {
    this.logger.error(`${this._logPrefix} Failed to load portrait image`);

    // Hide loading spinner
    if (this.#loadingSpinner) {
      this.#loadingSpinner.style.display = 'none';
    }
    
    // Show error message using BaseModalRenderer's method
    this._displayStatusMessage('Failed to load portrait', 'error');
  }

  /**
   * Cleans up resources to prevent memory leaks.
   *
   * @private
   */
  #cleanup() {
    // Clear image sources to free memory
    if (this.#imageElement) {
      this.#imageElement.src = '';
      this.#imageElement.style.width = '';
      this.#imageElement.style.height = '';
    }
    
    // Clear stored references
    this.#currentPortraitPath = null;
    this.#currentSpeakerName = null;
    this.#originalFocusElement = null;
  }

  /**
   * Cleans up all resources when the renderer is destroyed.
   *
   * @override
   */
  destroy() {
    this.logger.debug(`${this._logPrefix} Destroying PortraitModalRenderer`);
    
    // Clean up any resources
    this.#cleanup();
    
    // Call parent destroy
    super.destroy();
  }
}