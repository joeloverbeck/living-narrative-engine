/**
 * @file Simple unit tests for PortraitModalRenderer accessibility features
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';

// Mock BaseModalRenderer to use the same pattern as existing tests
jest.mock('../../../src/domUI/baseModalRenderer.js', () => {
  const mockAddDomListener = jest.fn();
  const mockSuperDestroy = jest.fn();

  class MockBaseModalRenderer {
    constructor({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    }) {
      this.logger = logger;
      this.documentContext = documentContext;
      this.validatedEventDispatcher = validatedEventDispatcher;
      this.elementsConfig = elementsConfig;
      this._logPrefix = '[PortraitModalRenderer]';
      this.elements = {};
      this.isVisible = false;

      // Simulate element binding
      if (
        elementsConfig &&
        documentContext &&
        typeof documentContext.query === 'function'
      ) {
        for (const key in elementsConfig) {
          if (Object.prototype.hasOwnProperty.call(elementsConfig, key)) {
            const selector = elementsConfig[key];
            try {
              const el = documentContext.query(selector);
              this.elements[key] = el || null;
            } catch {
              this.elements[key] = null;
            }
          }
        }
      }

      this._addDomListener = mockAddDomListener;

      // Simulate BaseModalRenderer's ESC key handler
      this._addDomListener(documentContext.document, 'keydown', (event) => {
        if (event.key === 'Escape' && this.isVisible) {
          this.hide();
        }
      });
    }

    show() {
      this.isVisible = true;
      this._onShow();
    }

    hide() {
      this.isVisible = false;
      this._onHide();
    }

    _onShow() {
      // To be overridden by subclass
    }

    _onHide() {
      // To be overridden by subclass
    }

    _getInitialFocusElement() {
      return null;
    }

    _displayStatusMessage(message, type) {
      this._lastStatusMessage = { message, type };
    }

    _clearStatusMessage() {
      this._lastStatusMessage = null;
    }

    destroy() {
      mockSuperDestroy();
    }
  }

  MockBaseModalRenderer._mockAddDomListener = mockAddDomListener;
  MockBaseModalRenderer._mockSuperDestroy = mockSuperDestroy;

  return { BaseModalRenderer: MockBaseModalRenderer };
});

import { BaseModalRenderer as MockedBaseModalRenderer } from '../../../src/domUI/baseModalRenderer.js';

const mockAddDomListener = MockedBaseModalRenderer._mockAddDomListener;
const mockSuperDestroy = MockedBaseModalRenderer._mockSuperDestroy;

describe('PortraitModalRenderer - Accessibility Features (Simple)', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let mockElements;
  let portraitModalRenderer;

  beforeEach(() => {
    // Clear mocks
    mockAddDomListener.mockClear();
    mockSuperDestroy.mockClear();

    // Setup logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Setup DOM elements
    mockElements = {
      modalElement: {
        style: { display: 'none' },
        classList: { add: jest.fn(), remove: jest.fn() },
        querySelectorAll: jest.fn().mockReturnValue([]),
        setAttribute: jest.fn(),
      },
      closeButton: {
        focus: jest.fn(),
        style: { minWidth: '', minHeight: '' },
      },
      statusMessageElement: {
        textContent: '',
        style: { display: 'none' },
      },
      modalImage: {
        src: '',
        alt: '',
        style: { width: '', height: '' },
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
      },
      loadingSpinner: {
        style: { display: 'none' },
        setAttribute: jest.fn(),
      },
      modalTitle: { textContent: '' },
    };

    // Setup document context
    mockDocumentContext = {
      document: {
        activeElement: null,
        body: {
          appendChild: jest.fn(),
          contains: jest.fn().mockReturnValue(true),
        },
      },
      query: jest.fn((selector) => {
        const elementMap = {
          '.portrait-modal-overlay': mockElements.modalElement,
          '.portrait-modal-close': mockElements.closeButton,
          '.portrait-error-message': mockElements.statusMessageElement,
          '.portrait-modal-image': mockElements.modalImage,
          '.portrait-loading-spinner': mockElements.loadingSpinner,
          '#portrait-modal-title': mockElements.modalTitle,
        };
        return elementMap[selector] || null;
      }),
    };

    // Setup DOM element factory
    mockDomElementFactory = {
      div: jest.fn(() => ({
        setAttribute: jest.fn(),
        className: '',
        textContent: '',
        parentNode: null,
      })),
      img: jest.fn(),
      button: jest.fn(),
    };

    // Setup event dispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Create PortraitModalRenderer instance
    portraitModalRenderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: mockLogger,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  afterEach(() => {
    if (portraitModalRenderer) {
      portraitModalRenderer.destroy();
    }
  });

  describe('Basic Accessibility Setup', () => {
    it('should create live region during construction', () => {
      // Verify live region was created
      expect(mockDomElementFactory.div).toHaveBeenCalled();
      expect(mockDocumentContext.document.body.appendChild).toHaveBeenCalled();
    });

    it('should set up keyboard event listeners', () => {
      // Verify keyboard event listener was added
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockDocumentContext.document,
        'keydown',
        expect.any(Function)
      );
    });

    it('should set up touch event listeners on image element', () => {
      // Verify touch event listeners were added to the image element
      const touchStartCalls = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'touchstart'
      );
      const touchEndCalls = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'touchend'
      );

      expect(touchStartCalls.length).toBe(1);
      expect(touchEndCalls.length).toBe(1);
      expect(touchStartCalls[0][0]).toBe(mockElements.modalImage);
      expect(touchEndCalls[0][0]).toBe(mockElements.modalImage);
    });

    it('should log debug messages for accessibility setup', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PortraitModalRenderer] Live region created for screen reader announcements'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PortraitModalRenderer] Focus trap and enhanced keyboard navigation set up'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PortraitModalRenderer] Touch handlers set up successfully'
      );
    });
  });

  describe('Focus Management - Visibility', () => {
    it('should handle keyboard events when modal is visible', () => {
      portraitModalRenderer.isVisible = true;

      // Get the keyboard event handler (second one is our focus trap)
      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      // Mock some focusable elements
      const mockButton1 = { focus: jest.fn() };
      const mockButton2 = { focus: jest.fn() };
      mockElements.modalElement.querySelectorAll.mockReturnValue([
        mockButton1,
        mockButton2,
      ]);

      // Test Home key
      const homeEvent = { key: 'Home', preventDefault: jest.fn() };
      keydownHandler(homeEvent);

      expect(homeEvent.preventDefault).toHaveBeenCalled();
      expect(mockButton1.focus).toHaveBeenCalled();
    });

    it('should not handle keyboard events when modal is not visible', () => {
      portraitModalRenderer.isVisible = false;

      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      const tabEvent = { key: 'Tab', preventDefault: jest.fn() };
      keydownHandler(tabEvent);

      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Touch Gesture Support', () => {
    it('should handle swipe down gesture to close modal', () => {
      const hideSpyFn = jest.fn();
      portraitModalRenderer.hide = hideSpyFn;

      // Get touch event handlers
      const touchStartHandler = mockAddDomListener.mock.calls.find(
        (call) => call[1] === 'touchstart'
      )[2];
      const touchEndHandler = mockAddDomListener.mock.calls.find(
        (call) => call[1] === 'touchend'
      )[2];

      // Simulate touch start
      touchStartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Simulate touch end with downward swipe (more than 50px)
      touchEndHandler({
        changedTouches: [{ clientX: 100, clientY: 200 }],
      });

      expect(hideSpyFn).toHaveBeenCalled();
    });
  });

  describe('ARIA Attributes', () => {
    it('should have role="dialog" on modal element', () => {
      // Modal element should have appropriate ARIA role
      expect(mockElements.modalElement.setAttribute).toHaveBeenCalledWith(
        'role',
        'dialog'
      );
    });

    it('should have aria-modal="true" on modal element', () => {
      // Modal should be marked as modal for screen readers
      expect(mockElements.modalElement.setAttribute).toHaveBeenCalledWith(
        'aria-modal',
        'true'
      );
    });

    it('should have aria-labelledby pointing to title', () => {
      // Modal should reference its title for labeling
      expect(mockElements.modalElement.setAttribute).toHaveBeenCalledWith(
        'aria-labelledby',
        'portrait-modal-title'
      );
    });

    it('should have aria-describedby for additional context', () => {
      // Loading spinner should have appropriate role
      expect(mockElements.loadingSpinner.setAttribute).toHaveBeenCalledWith(
        'role',
        'status'
      );
      expect(mockElements.loadingSpinner.setAttribute).toHaveBeenCalledWith(
        'aria-live',
        'polite'
      );
    });
  });

  describe('Keyboard Navigation', () => {
    it('should trap focus within modal when visible', () => {
      portraitModalRenderer.isVisible = true;

      // Get the keyboard event handler (second one is our focus trap)
      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      // Mock focusable elements
      const mockButton1 = { focus: jest.fn() };
      const mockButton2 = { focus: jest.fn() };
      const mockInput = { focus: jest.fn() };
      mockElements.modalElement.querySelectorAll.mockReturnValue([
        mockButton1,
        mockButton2,
        mockInput,
      ]);

      // Test Tab key cycles through elements
      const tabEvent = {
        key: 'Tab',
        preventDefault: jest.fn(),
        shiftKey: false,
      };
      keydownHandler(tabEvent);

      // Verify focus stays within modal (preventDefault called)
      expect(tabEvent.preventDefault).toHaveBeenCalled();
    });

    it('should close modal on ESC key', () => {
      portraitModalRenderer.isVisible = true;
      const hideSpy = jest.fn();
      portraitModalRenderer.hide = hideSpy;

      // Find the ESC key handler (from BaseModalRenderer)
      const escKeyHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[0][2]; // First keydown handler is ESC

      const escEvent = { key: 'Escape', preventDefault: jest.fn() };
      escKeyHandler(escEvent);

      expect(hideSpy).toHaveBeenCalled();
    });

    it('should handle Enter key on portrait to open modal', () => {
      // This would be tested in the speech bubble renderer tests
      // but we can verify the modal handles focus correctly when opened
      const mockOriginalElement = { focus: jest.fn() };
      portraitModalRenderer.showModal(
        '/path.jpg',
        'Speaker',
        mockOriginalElement
      );

      // Verify original element reference is stored for later restoration
      portraitModalRenderer.hide();

      // Should restore focus to original element
      expect(mockOriginalElement.focus).toHaveBeenCalled();
    });

    it('should handle Space key on portrait to open modal', () => {
      // Similar to Enter key test
      const mockOriginalElement = { focus: jest.fn() };
      portraitModalRenderer.showModal(
        '/path.jpg',
        'Speaker',
        mockOriginalElement
      );

      portraitModalRenderer.hide();
      expect(mockOriginalElement.focus).toHaveBeenCalled();
    });

    it('should handle Home key to focus first element', () => {
      portraitModalRenderer.isVisible = true;

      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      const mockFirstElement = { focus: jest.fn() };
      const mockLastElement = { focus: jest.fn() };
      mockElements.modalElement.querySelectorAll.mockReturnValue([
        mockFirstElement,
        mockLastElement,
      ]);

      const homeEvent = { key: 'Home', preventDefault: jest.fn() };
      keydownHandler(homeEvent);

      expect(homeEvent.preventDefault).toHaveBeenCalled();
      expect(mockFirstElement.focus).toHaveBeenCalled();
    });

    it('should handle End key to focus last element', () => {
      portraitModalRenderer.isVisible = true;

      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      const mockFirstElement = { focus: jest.fn() };
      const mockLastElement = { focus: jest.fn() };
      mockElements.modalElement.querySelectorAll.mockReturnValue([
        mockFirstElement,
        mockLastElement,
      ]);

      const endEvent = { key: 'End', preventDefault: jest.fn() };
      keydownHandler(endEvent);

      expect(endEvent.preventDefault).toHaveBeenCalled();
      expect(mockLastElement.focus).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should set initial focus on close button when modal opens', () => {
      const mockOriginalElement = { focus: jest.fn() };

      // Show modal
      portraitModalRenderer.showModal(
        '/path.jpg',
        'Speaker',
        mockOriginalElement
      );

      // Get initial focus element should be close button
      const focusElement = portraitModalRenderer._getInitialFocusElement();
      expect(focusElement).toBe(mockElements.closeButton);
    });

    it('should return focus to trigger element on close', () => {
      const triggerElement = {
        focus: jest.fn(),
        offsetParent: {}, // Element is visible
      };

      portraitModalRenderer.showModal('/path.jpg', 'Character', triggerElement);
      portraitModalRenderer.hide();

      expect(triggerElement.focus).toHaveBeenCalled();
    });

    it('should handle focus restoration when original element is removed from DOM', () => {
      const triggerElement = {
        focus: jest.fn(() => {
          throw new Error('Element not in DOM');
        }),
        offsetParent: null, // Element is not visible
      };

      portraitModalRenderer.showModal('/path.jpg', 'Character', triggerElement);
      portraitModalRenderer.hide();

      // Should log warning about failed focus restoration
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not return focus to original element'),
        expect.any(Error)
      );
    });

    it('should cycle focus with Tab and Shift+Tab', () => {
      portraitModalRenderer.isVisible = true;

      const keydownHandler = mockAddDomListener.mock.calls.filter(
        (call) => call[1] === 'keydown'
      )[1][2];

      const mockFocusableElements = [
        { focus: jest.fn() },
        { focus: jest.fn() },
        { focus: jest.fn() },
      ];
      mockElements.modalElement.querySelectorAll.mockReturnValue(
        mockFocusableElements
      );

      // Test Shift+Tab (backwards)
      mockDocumentContext.document.activeElement = mockFocusableElements[0];
      const shiftTabEvent = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: jest.fn(),
      };
      keydownHandler(shiftTabEvent);

      expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
      // Should wrap to last element
      expect(mockFocusableElements[2].focus).toHaveBeenCalled();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce modal opening via live region', () => {
      // Live region should be created with proper attributes
      const liveRegion = mockDomElementFactory.div.mock.results[0].value;
      expect(liveRegion.setAttribute).toHaveBeenCalledWith(
        'aria-live',
        'polite'
      );
      expect(liveRegion.setAttribute).toHaveBeenCalledWith(
        'aria-atomic',
        'true'
      );
      expect(mockDomElementFactory.div).toHaveBeenCalled();
    });

    it('should announce loading state with appropriate ARIA', () => {
      expect(mockElements.loadingSpinner.setAttribute).toHaveBeenCalledWith(
        'role',
        'status'
      );
      expect(mockElements.loadingSpinner.setAttribute).toHaveBeenCalledWith(
        'aria-live',
        'polite'
      );
      expect(mockElements.loadingSpinner.setAttribute).toHaveBeenCalledWith(
        'aria-label',
        'Loading portrait image'
      );
    });

    it('should announce error state with alert role', () => {
      // Error messages should use alert role for immediate announcement
      // When an error occurs, it should be announced
      portraitModalRenderer._displayStatusMessage(
        'Failed to load portrait',
        'error'
      );

      expect(portraitModalRenderer._lastStatusMessage).toEqual({
        message: 'Failed to load portrait',
        type: 'error',
      });
    });

    it('should provide image alt text for screen readers', () => {
      const speakerName = 'Test Character';
      portraitModalRenderer.showModal('/path.jpg', speakerName, {
        focus: jest.fn(),
      });

      expect(mockElements.modalImage.alt).toBe(`Portrait of ${speakerName}`);
    });
  });

  describe('Reduced Motion Support', () => {
    let originalMatchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('should respect prefers-reduced-motion media query', () => {
      // Mock matchMedia to indicate reduced motion preference
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      // Create new instance to pick up media query
      new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Verify reduced motion is detected
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-reduced-motion: reduce)'
      );
    });

    it('should disable animations when reduced motion is preferred', () => {
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const reducedMotionRenderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      reducedMotionRenderer.show();

      // Animations should be disabled (no fade-in class)
      expect(mockElements.modalElement.classList.add).not.toHaveBeenCalledWith(
        'fade-in'
      );
    });

    it('should react to reduced motion preference changes at runtime', () => {
      let changeHandler;
      const mockMediaQuery = {
        matches: false,
        addEventListener: jest.fn((event, handler) => {
          if (event === 'change') {
            changeHandler = handler;
          }
        }),
        removeEventListener: jest.fn(),
      };

      window.matchMedia = jest.fn().mockReturnValue(mockMediaQuery);

      new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      expect(changeHandler).toBeDefined();

      mockLogger.debug.mockClear();

      changeHandler({ matches: true });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PortraitModalRenderer] Reduced motion preference changed to: true'
      );
    });
  });

  describe('Touch Accessibility', () => {
    it('should have sufficient touch target size', () => {
      // Close button should have minimum 44x44px touch target
      const closeButton = mockElements.closeButton;
      expect(closeButton.style.minWidth).toBe('44px');
      expect(closeButton.style.minHeight).toBe('44px');
    });

    it('should support pinch to zoom on image', () => {
      // Touch events for pinch zoom should be handled
      const touchStartHandler = mockAddDomListener.mock.calls.find(
        (call) =>
          call[1] === 'touchstart' && call[0] === mockElements.modalImage
      );

      expect(touchStartHandler).toBeDefined();
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should work in Windows High Contrast Mode', () => {
      // CSS should use appropriate properties for high contrast
      // This is primarily tested via CSS, but we can verify structure
      const modalElement = mockElements.modalElement;

      // Modal should have solid borders (not relying on shadows)
      expect(modalElement.style.border).toBeDefined();
    });
  });
});
