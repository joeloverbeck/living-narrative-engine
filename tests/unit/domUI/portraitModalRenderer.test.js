/**
 * @file Unit tests for PortraitModalRenderer
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

// Mock BaseModalRenderer
jest.mock('../../../src/domUI/baseModalRenderer.js', () => {
  const mockAddDomListener = jest.fn();
  const mockSuperDestroy = jest.fn();
  
  class MockBaseModalRenderer {
    constructor({ logger, documentContext, validatedEventDispatcher, elementsConfig }) {
      this.logger = logger;
      this.documentContext = documentContext;
      this.validatedEventDispatcher = validatedEventDispatcher;
      this.elementsConfig = elementsConfig;
      this._logPrefix = '[PortraitModalRenderer]';
      this.elements = {};
      this.isVisible = false;
      
      // Simulate element binding
      if (elementsConfig && documentContext && typeof documentContext.query === 'function') {
        for (const key in elementsConfig) {
          if (Object.prototype.hasOwnProperty.call(elementsConfig, key)) {
            const selector = elementsConfig[key];
            try {
              const el = documentContext.query(selector);
              this.elements[key] = el || null;
            } catch (e) {
              this.elements[key] = null;
            }
          }
        }
      }
      
      this._addDomListener = mockAddDomListener;
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
      // To be overridden by subclass
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

describe('PortraitModalRenderer', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let mockModalElement;
  let mockCloseButton;
  let mockStatusElement;
  let mockImageElement;
  let mockLoadingSpinner;
  let mockModalTitle;
  let mockOriginalElement;
  let renderer;

  // Mock Image constructor
  let mockImageInstance;
  let originalImage;

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
    mockModalElement = {
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockCloseButton = {
      focus: jest.fn(),
    };

    mockStatusElement = {
      textContent: '',
      style: { display: 'none' },
    };

    mockImageElement = {
      src: '',
      alt: '',
      style: { width: '', height: '' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockLoadingSpinner = {
      style: { display: 'none' },
    };

    mockModalTitle = {
      textContent: '',
    };

    mockOriginalElement = {
      focus: jest.fn(),
      offsetParent: {},
    };

    // Setup document context
    const mockDocument = {
      body: {
        contains: jest.fn(() => true),
      },
    };

    mockDocumentContext = {
      document: mockDocument,
      query: jest.fn((selector) => {
        const elements = {
          '.portrait-modal-overlay': mockModalElement,
          '.portrait-modal-close': mockCloseButton,
          '.portrait-error-message': mockStatusElement,
          '.portrait-modal-image': mockImageElement,
          '.portrait-loading-spinner': mockLoadingSpinner,
          '#portrait-modal-title': mockModalTitle,
        };
        return elements[selector] || null;
      }),
    };

    // Setup DOM element factory
    mockDomElementFactory = {
      img: jest.fn(),
      div: jest.fn(),
      button: jest.fn(),
    };

    // Setup event dispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Mock Image constructor
    originalImage = global.Image;
    mockImageInstance = {
      src: '',
      naturalWidth: 800,
      naturalHeight: 600,
      onload: null,
      onerror: null,
    };
    
    global.Image = jest.fn(() => mockImageInstance);
    Object.defineProperty(mockImageInstance, 'src', {
      set: function(value) {
        this._src = value;
        // Simulate async image loading
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      get: function() {
        return this._src;
      },
    });
  });

  afterEach(() => {
    // Restore original Image constructor
    global.Image = originalImage;
    
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(() => {
        renderer = new PortraitModalRenderer({
          documentContext: mockDocumentContext,
          domElementFactory: mockDomElementFactory,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        });
      }).not.toThrow();

      expect(renderer).toBeDefined();
    });

    it('should validate domElementFactory dependency', () => {
      expect(() => {
        renderer = new PortraitModalRenderer({
          documentContext: mockDocumentContext,
          domElementFactory: null,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should validate domElementFactory has required methods', () => {
      const invalidFactory = { img: jest.fn() }; // Missing div and button

      expect(() => {
        renderer = new PortraitModalRenderer({
          documentContext: mockDocumentContext,
          domElementFactory: invalidFactory,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should initialize element references', () => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      expect(mockDocumentContext.query).toHaveBeenCalledWith('.portrait-modal-image');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('.portrait-loading-spinner');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('.portrait-error-message');
    });

    it('should log warnings for missing elements', () => {
      mockDocumentContext.query = jest.fn(() => null);

      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Modal image element not found')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Loading spinner element not found')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error message element not found')
      );
    });
  });

  describe('showModal', () => {
    beforeEach(() => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should validate portraitPath parameter', () => {
      expect(() => {
        renderer.showModal('', 'Speaker Name', mockOriginalElement);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        renderer.showModal(null, 'Speaker Name', mockOriginalElement);
      }).toThrow(InvalidArgumentError);
    });

    it('should validate speakerName parameter', () => {
      expect(() => {
        renderer.showModal('/path/to/portrait.jpg', '', mockOriginalElement);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        renderer.showModal('/path/to/portrait.jpg', null, mockOriginalElement);
      }).toThrow(InvalidArgumentError);
    });

    it('should validate originalElement parameter', () => {
      expect(() => {
        renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', null);
      }).toThrow(InvalidArgumentError);
    });

    it('should update modal title with speaker name', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      expect(mockModalTitle.textContent).toBe('Speaker Name');
    });

    it('should reset image state before showing', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      expect(mockImageElement.src).toBe('');
      expect(mockImageElement.classList.remove).toHaveBeenCalledWith('loaded');
    });

    it('should call parent show method', () => {
      const showSpy = jest.spyOn(MockedBaseModalRenderer.prototype, 'show');
      
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      expect(showSpy).toHaveBeenCalled();
      expect(renderer.isVisible).toBe(true);
    });
  });

  describe('_onShow', () => {
    beforeEach(() => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should start loading the portrait image', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      // Check that loading spinner is shown immediately
      expect(mockLoadingSpinner.style.display).toBe('block');
      
      // Check that Image was created
      expect(global.Image).toHaveBeenCalled();
      
      // Check that src was set on the image
      expect(mockImageInstance._src).toBe('/path/to/portrait.jpg');
    });

    it('should add fade-in animation class', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      expect(mockModalElement.classList.add).toHaveBeenCalledWith('fade-in');
    });

    it('should dispatch PORTRAIT_MODAL_OPENED event', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'PORTRAIT_MODAL_OPENED',
        payload: {
          portraitPath: '/path/to/portrait.jpg',
          speakerName: 'Speaker Name',
        },
      });
    });
  });

  describe('_onHide', () => {
    beforeEach(() => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should clean up resources', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);
      renderer.hide();

      expect(mockImageElement.src).toBe('');
      expect(mockImageElement.style.width).toBe('');
      expect(mockImageElement.style.height).toBe('');
    });

    it('should return focus to original element', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);
      renderer.hide();

      expect(mockOriginalElement.focus).toHaveBeenCalled();
    });

    it('should dispatch PORTRAIT_MODAL_CLOSED event', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);
      
      // Clear previous dispatch calls
      mockValidatedEventDispatcher.dispatch.mockClear();
      
      renderer.hide();

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'PORTRAIT_MODAL_CLOSED',
        payload: {
          portraitPath: '/path/to/portrait.jpg',
          speakerName: 'Speaker Name',
        },
      });
    });

    it('should handle focus restoration errors gracefully', () => {
      mockOriginalElement.focus = jest.fn(() => {
        throw new Error('Focus error');
      });

      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);
      renderer.hide();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not return focus to original element'),
        expect.any(Error)
      );
    });
  });

  describe('_getInitialFocusElement', () => {
    it('should return close button for initial focus', () => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const focusElement = renderer._getInitialFocusElement();
      expect(focusElement).toBe(mockCloseButton);
    });

    it('should return null if close button not found', () => {
      mockDocumentContext.query = jest.fn((selector) => {
        if (selector === '.portrait-modal-close') return null;
        return mockImageElement;
      });

      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const focusElement = renderer._getInitialFocusElement();
      expect(focusElement).toBeNull();
    });
  });

  describe('Image loading', () => {
    beforeEach(() => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should handle successful image loading', () => {
      // Override window dimensions for testing
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      // Trigger the onload callback
      if (mockImageInstance.onload) {
        mockImageInstance.onload();
      }

      // Check loading spinner was hidden
      expect(mockLoadingSpinner.style.display).toBe('none');
      
      // Check image was updated
      expect(mockImageElement.src).toBe('/path/to/portrait.jpg');
      expect(mockImageElement.alt).toBe('Portrait of Speaker Name');
      expect(mockImageElement.classList.add).toHaveBeenCalledWith('loaded');
      
      // Check dimensions were set (image fits within constraints)
      expect(mockImageElement.style.width).toBe('800px');
      expect(mockImageElement.style.height).toBe('600px');
    });

    it('should handle image loading errors', () => {
      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      // Trigger the onerror callback instead of onload
      if (mockImageInstance.onerror) {
        mockImageInstance.onerror();
      }

      // Check loading spinner was hidden
      expect(mockLoadingSpinner.style.display).toBe('none');
      
      // Check error message was displayed
      expect(renderer._lastStatusMessage).toEqual({
        message: 'Failed to load portrait',
        type: 'error'
      });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load portrait image')
      );
    });

    it('should resize large images to fit viewport', () => {
      // Set large image dimensions
      mockImageInstance.naturalWidth = 3000;
      mockImageInstance.naturalHeight = 2000;
      
      // Set window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      // Trigger the onload callback
      if (mockImageInstance.onload) {
        mockImageInstance.onload();
      }

      // Check image was resized to fit
      // Max width = 1920 * 0.9 = 1728px
      // Max height = 1080 * 0.7 = 756px
      // Aspect ratio = 3000/2000 = 1.5
      // Width/Height ratio limit = 1728/756 = 2.285
      // Since 2.285 > 1.5, height is the limiting factor
      expect(mockImageElement.style.height).toBe('756px');
      expect(mockImageElement.style.width).toBe('auto');
    });

    it('should handle portrait orientation images', () => {
      // Set portrait dimensions
      mockImageInstance.naturalWidth = 1000;
      mockImageInstance.naturalHeight = 2000;
      
      // Set window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);

      // Trigger the onload callback
      if (mockImageInstance.onload) {
        mockImageInstance.onload();
      }

      // Max height = 1080 * 0.7 = 756px
      // Height is limiting for portrait orientation
      expect(mockImageElement.style.height).toBe('756px');
      expect(mockImageElement.style.width).toBe('auto');
    });
  });

  describe('destroy', () => {
    it('should clean up resources and call parent destroy', () => {
      renderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      renderer.showModal('/path/to/portrait.jpg', 'Speaker Name', mockOriginalElement);
      renderer.destroy();

      expect(mockImageElement.src).toBe('');
      expect(mockSuperDestroy).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Destroying PortraitModalRenderer')
      );
    });
  });
});