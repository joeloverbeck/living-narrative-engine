/**
 * @file Defines PortraitModalRenderer, a class for displaying portrait images in a modal dialog.
 * @see baseModalRenderer.js
 */

import { BaseModalRenderer } from './baseModalRenderer.js';
import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../utils/dependencyUtils.js';
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

  // Accessibility enhancement fields
  #focusableElements = [];
  #firstFocusableElement = null;
  #lastFocusableElement = null;
  #liveRegion = null;

  // Touch support fields
  #touchStartX = 0;
  #touchStartY = 0;

  // Reduced motion preference
  #prefersReducedMotion = false;

  /**
   * Constructs a PortraitModalRenderer instance.
   *
   * @param {object} dependencies - The dependencies for the renderer.
   * @param {import('../interfaces/IDocumentContext.js').IDocumentContext} dependencies.documentContext - The document context abstraction.
   * @param {import('./domElementFactory.js').default} dependencies.domElementFactory - Factory for creating DOM elements.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - The logger instance.
   * @param {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher.
   */
  constructor({
    documentContext,
    domElementFactory,
    logger,
    validatedEventDispatcher,
  }) {
    // Configuration for BaseModalRenderer
    const elementsConfig = {
      modalElement: '.portrait-modal-overlay',
      closeButton: '.portrait-modal-close',
      statusMessageElement: '.portrait-error-message',
      modalImage: '.portrait-modal-image',
      loadingSpinner: '.portrait-loading-spinner',
      modalTitle: '#portrait-modal-title',
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    validateDependency(domElementFactory, 'IDomElementFactory', logger, {
      requiredMethods: ['img', 'div', 'button'],
    });

    this.#domElementFactory = domElementFactory;
    this.#initializeElements();
    this.#setupAccessibilityFeatures();
    this.#setupAriaAttributes();
    this.#setupReducedMotionSupport();
    this.#setupTouchAccessibility();
    this.#setupHighContrastSupport();
  }

  /**
   * Sets up static ARIA attributes for accessibility compliance.
   * These attributes must be set during construction phase for proper screen reader support.
   *
   * @private
   */
  #setupAriaAttributes() {
    // Modal element ARIA setup
    if (this.elements.modalElement) {
      this.elements.modalElement.setAttribute('role', 'dialog');
      this.elements.modalElement.setAttribute('aria-modal', 'true');
      this.elements.modalElement.setAttribute(
        'aria-labelledby',
        'portrait-modal-title'
      );
    }

    // Loading spinner ARIA setup
    if (this.elements.loadingSpinner) {
      this.elements.loadingSpinner.setAttribute('role', 'status');
      this.elements.loadingSpinner.setAttribute('aria-live', 'polite');
      this.elements.loadingSpinner.setAttribute(
        'aria-label',
        'Loading portrait image'
      );
    }
  }

  /**
   * Sets up reduced motion support based on user preferences.
   * Respects the prefers-reduced-motion media query for accessibility.
   *
   * @private
   */
  #setupReducedMotionSupport() {
    // Check if matchMedia is available (may not be in test environment)
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      // Detect user's motion preference
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.#prefersReducedMotion = mediaQuery.matches;

      // Listen for changes in motion preference
      mediaQuery.addEventListener('change', (e) => {
        this.#prefersReducedMotion = e.matches;
        this.logger.debug(
          `${this._logPrefix} Reduced motion preference changed to: ${e.matches}`
        );
      });
    }
  }

  /**
   * Sets up touch accessibility with minimum target sizes.
   * Ensures WCAG 2.1 AA compliance for touch targets (minimum 44x44px).
   *
   * @private
   */
  #setupTouchAccessibility() {
    // Ensure minimum 44x44px touch targets for WCAG compliance
    if (this.elements.closeButton && this.elements.closeButton.style) {
      const buttonStyles = this.elements.closeButton.style;
      if (!buttonStyles.minWidth) buttonStyles.minWidth = '44px';
      if (!buttonStyles.minHeight) buttonStyles.minHeight = '44px';
    }
  }

  /**
   * Sets up high contrast mode support for Windows accessibility.
   * Ensures modal has solid borders for visibility in high contrast mode.
   *
   * @private
   */
  #setupHighContrastSupport() {
    // Ensure modal has solid borders for high contrast mode
    if (this.elements.modalElement && this.elements.modalElement.style) {
      if (!this.elements.modalElement.style.border) {
        this.elements.modalElement.style.border = '1px solid transparent';
      }
    }
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
    assertNonBlankString(
      portraitPath,
      'portraitPath',
      'showModal validation',
      this.logger
    );
    assertNonBlankString(
      speakerName,
      'speakerName',
      'showModal validation',
      this.logger
    );
    assertPresent(
      originalElement,
      'originalElement is required',
      InvalidArgumentError,
      this.logger
    );

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
      // Set alt text immediately for screen readers
      this.#imageElement.alt = `Portrait of ${speakerName}`;
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
    this.logger.debug(
      `${this._logPrefix} Starting portrait load for ${this.#currentSpeakerName}`
    );

    // Announce modal opening with current speaker name
    const speakerName = this.#currentSpeakerName || 'Character';
    this.#announceToScreenReader(`Opened portrait modal for ${speakerName}`);

    // Start loading the portrait image
    this.#loadPortraitImage(this.#currentPortraitPath);

    // Add fade-in animation class only if reduced motion is not preferred
    if (this.elements.modalElement && !this.#prefersReducedMotion) {
      this.elements.modalElement.classList.add('fade-in');
    }

    // Dispatch event for modal opened
    if (this.validatedEventDispatcher) {
      try {
        this.validatedEventDispatcher.dispatch('core:portrait_modal_opened', {
          portraitPath: this.#currentPortraitPath,
          speakerName: this.#currentSpeakerName,
        });
      } catch (error) {
        this.logger.error(
          `${this._logPrefix} Failed to dispatch core:portrait_modal_opened event`,
          error
        );
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

    // Announce before cleanup
    if (speakerName) {
      this.#announceToScreenReader(`Closed portrait modal for ${speakerName}`);
    }

    // Return focus to original element
    if (
      this.#originalFocusElement &&
      typeof this.#originalFocusElement.focus === 'function'
    ) {
      try {
        if (
          this.documentContext.document.body.contains(
            this.#originalFocusElement
          ) &&
          this.#originalFocusElement.offsetParent !== null
        ) {
          this.#originalFocusElement.focus();
        } else {
          // Element is no longer in DOM or not visible
          this.logger.warn(
            `${this._logPrefix} Could not return focus to original element`,
            new Error('Element not in DOM or not visible')
          );
        }
      } catch (error) {
        this.logger.warn(
          `${this._logPrefix} Could not return focus to original element`,
          error
        );
      }
    }

    // Dispatch event for modal closed
    if (this.validatedEventDispatcher) {
      try {
        this.validatedEventDispatcher.dispatch('core:portrait_modal_closed', {
          portraitPath: portraitPath,
          speakerName: speakerName,
        });
      } catch (error) {
        this.logger.error(
          `${this._logPrefix} Failed to dispatch core:portrait_modal_closed event`,
          error
        );
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
      this.#loadingSpinner.setAttribute('aria-hidden', 'false');
    }

    if (this.#imageElement) {
      this.#imageElement.classList.remove('loaded');
    }

    // Announce loading to screen reader
    this.#announceToScreenReader('Loading portrait image');

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
      this.#loadingSpinner.setAttribute('aria-hidden', 'true');
    }

    // Announce successful loading to screen reader
    this.#announceToScreenReader('Portrait image loaded successfully');

    // Update modal image
    if (this.#imageElement) {
      this.#imageElement.src = portraitPath;
      this.#imageElement.alt = `Portrait of ${this.#currentSpeakerName}`;

      // Add loaded class for animation
      this.#imageElement.classList.add('loaded');

      // Calculate optimal dimensions
      const maxWidth = window.innerWidth * 0.9;
      const maxHeight = window.innerHeight * 0.7;

      if (
        tempImg.naturalWidth > maxWidth ||
        tempImg.naturalHeight > maxHeight
      ) {
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
   * @param {HTMLImageElement} _tempImg - The temporary image that failed to load.
   */
  #handleImageError(_tempImg) {
    this.logger.error(`${this._logPrefix} Failed to load portrait image`);

    // Hide loading spinner
    if (this.#loadingSpinner) {
      this.#loadingSpinner.style.display = 'none';
      this.#loadingSpinner.setAttribute('aria-hidden', 'true');
    }

    const errorMessage = 'Failed to load portrait';

    // Show error message using BaseModalRenderer's method
    this._displayStatusMessage(errorMessage, 'error');

    // Announce error to screen reader with assertive live region
    this.#announceError(errorMessage);
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
   * Sets up accessibility features including focus trap, keyboard navigation,
   * screen reader support, and touch gestures.
   *
   * @private
   */
  #setupAccessibilityFeatures() {
    this.#createLiveRegion();
    this.#setupFocusTrap();
    this.#setupTouchHandlers();
  }

  /**
   * Creates a live region for screen reader announcements.
   *
   * @private
   */
  #createLiveRegion() {
    const liveRegion = this.#domElementFactory.div();
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only portrait-modal-announcer';

    this.documentContext.document.body.appendChild(liveRegion);
    this.#liveRegion = liveRegion;

    this.logger.debug(
      `${this._logPrefix} Live region created for screen reader announcements`
    );
  }

  /**
   * Sets up focus trap and enhanced keyboard navigation.
   *
   * @private
   */
  #setupFocusTrap() {
    this._addDomListener(this.documentContext.document, 'keydown', (event) => {
      if (!this.isVisible) return;

      switch (event.key) {
        case 'Tab':
          this.#refreshFocusableElements();
          this.#handleTabKey(event);
          break;

        case 'Home':
          // Jump to first focusable element
          this.#refreshFocusableElements();
          if (this.#firstFocusableElement) {
            event.preventDefault();
            this.#firstFocusableElement.focus();
            this.logger.debug(
              `${this._logPrefix} Home key pressed, focused first element`
            );
          }
          break;

        case 'End':
          // Jump to last focusable element
          this.#refreshFocusableElements();
          if (this.#lastFocusableElement) {
            event.preventDefault();
            this.#lastFocusableElement.focus();
            this.logger.debug(
              `${this._logPrefix} End key pressed, focused last element`
            );
          }
          break;
      }
    });

    this.logger.debug(
      `${this._logPrefix} Focus trap and enhanced keyboard navigation set up`
    );
  }

  /**
   * Refreshes the list of focusable elements within the modal.
   *
   * @private
   */
  #refreshFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    if (this.elements.modalElement) {
      this.#focusableElements = Array.from(
        this.elements.modalElement.querySelectorAll(
          focusableSelectors.join(',')
        )
      );
      this.#firstFocusableElement = this.#focusableElements[0] || null;
      this.#lastFocusableElement =
        this.#focusableElements[this.#focusableElements.length - 1] || null;
    }
  }

  /**
   * Handles Tab key navigation within the focus trap.
   *
   * @private
   * @param {KeyboardEvent} event - The keyboard event
   */
  #handleTabKey(event) {
    if (!this.#focusableElements.length) return;

    const activeElement = this.documentContext.document.activeElement;
    const currentIndex = this.#focusableElements.indexOf(activeElement);

    if (event.shiftKey) {
      // Shift + Tab - going backwards
      if (currentIndex === 0 || currentIndex === -1) {
        event.preventDefault();
        this.#lastFocusableElement?.focus();
        this.logger.debug(
          `${this._logPrefix} Focus trap: wrapped to last element`
        );
      }
    } else {
      // Tab - going forwards
      if (
        currentIndex === this.#focusableElements.length - 1 ||
        currentIndex === -1
      ) {
        event.preventDefault();
        this.#firstFocusableElement?.focus();
        this.logger.debug(
          `${this._logPrefix} Focus trap: wrapped to first element`
        );
      }
    }
  }

  /**
   * Sets up touch gesture handlers for mobile devices.
   *
   * @private
   */
  #setupTouchHandlers() {
    if (!this.#imageElement) {
      this.logger.warn(
        `${this._logPrefix} Modal image element not found, touch handlers not added`
      );
      return;
    }

    this._addDomListener(this.#imageElement, 'touchstart', (e) => {
      this.#touchStartX = e.touches[0].clientX;
      this.#touchStartY = e.touches[0].clientY;
    });

    this._addDomListener(this.#imageElement, 'touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - this.#touchStartX;
      const deltaY = touchEndY - this.#touchStartY;

      // Swipe down to close (minimum 50px swipe distance)
      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 50) {
        this.logger.debug(
          `${this._logPrefix} Swipe down detected, closing modal`
        );
        this.hide();
      }
    });

    this.logger.debug(`${this._logPrefix} Touch handlers set up successfully`);
  }

  /**
   * Announces a message to screen readers using the live region.
   *
   * @private
   * @param {string} message - The message to announce
   */
  #announceToScreenReader(message) {
    if (!this.#liveRegion) {
      this.logger.warn(
        `${this._logPrefix} Live region not available for announcement: ${message}`
      );
      return;
    }

    // Clear previous announcement
    this.#liveRegion.textContent = '';

    // Set new announcement with delay for screen reader detection
    setTimeout(() => {
      if (this.#liveRegion) {
        this.#liveRegion.textContent = message;
        this.logger.debug(
          `${this._logPrefix} Announced to screen reader: ${message}`
        );
      }
    }, 100);

    // Clear after announcement
    setTimeout(() => {
      if (this.#liveRegion) {
        this.#liveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Announces an error message to screen readers using assertive live region.
   *
   * @private
   * @param {string} errorMessage - The error message to announce
   */
  #announceError(errorMessage) {
    // Create temporary assertive announcement for errors
    const errorAnnouncement = this.#domElementFactory.div();
    errorAnnouncement.setAttribute('role', 'alert');
    errorAnnouncement.setAttribute('aria-live', 'assertive');
    errorAnnouncement.className = 'sr-only';
    errorAnnouncement.textContent = errorMessage;

    this.documentContext.document.body.appendChild(errorAnnouncement);
    this.logger.debug(
      `${this._logPrefix} Error announced to screen reader: ${errorMessage}`
    );

    // Remove after announcement
    setTimeout(() => {
      if (errorAnnouncement.parentNode) {
        errorAnnouncement.parentNode.removeChild(errorAnnouncement);
      }
    }, 3000);
  }

  /**
   * Cleans up all resources when the renderer is destroyed.
   *
   * @override
   */
  /**
   * Hides the portrait modal.
   * This method acts as an alias to the inherited hide() method
   * to satisfy the IPortraitModalRenderer interface requirement.
   *
   * @public
   */
  hideModal() {
    this.hide();
  }

  destroy() {
    this.logger.debug(`${this._logPrefix} Destroying PortraitModalRenderer`);

    // Clean up live region
    if (this.#liveRegion && this.#liveRegion.parentNode) {
      this.#liveRegion.parentNode.removeChild(this.#liveRegion);
      this.#liveRegion = null;
    }

    // Clean up any resources
    this.#cleanup();

    // Call parent destroy
    super.destroy();
  }
}
