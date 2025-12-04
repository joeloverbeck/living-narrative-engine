import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';
import { PromptPreviewModal } from '../../../src/domUI/PromptPreviewModal.js';

// Mock methods for BaseModalRenderer
const mockShow = jest.fn();
const mockHide = jest.fn();
const mockDisplayStatusMessage = jest.fn();
const mockClearStatusMessage = jest.fn();
const mockAddDomListener = jest.fn();

// Mock BaseModalRenderer
jest.mock('../../../src/domUI/baseModalRenderer.js', () => {
  return {
    BaseModalRenderer: class MockBaseModalRenderer {
      constructor({ logger, documentContext, validatedEventDispatcher, elementsConfig }) {
        this.logger = logger;
        this.documentContext = documentContext;
        this.validatedEventDispatcher = validatedEventDispatcher;
        this.elementsConfig = elementsConfig;
        this.elements = {};
        
        // Simulate element lookup logic
        Object.keys(elementsConfig).forEach(key => {
            const config = elementsConfig[key];
            let selector = null;
            if (typeof config === 'string') {
                selector = config;
            } else if (config && typeof config.selector === 'string') {
                selector = config.selector;
            }
            
            if (selector) {
                this.elements[key] = documentContext.query(selector);
            }
        });

        this._logPrefix = '[PromptPreviewModal]';
        this.isVisible = false;
      }

      // Define methods on prototype so super.method() works
      show() { mockShow(); }
      hide() { mockHide(); }
      _displayStatusMessage(msg, type) { mockDisplayStatusMessage(msg, type); }
      _clearStatusMessage() { mockClearStatusMessage(); }
      _addDomListener(el, type, fn) { mockAddDomListener(el, type, fn); }
    }
  };
});

describe('PromptPreviewModal', () => {
  let modal;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockElements;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockElements = {
      '#llm-prompt-debug-modal': { id: 'modal' },
      '#llm-prompt-debug-close-button': { id: 'close-btn' },
      '#llm-prompt-debug-status': { id: 'status', textContent: '' },
      '#llm-prompt-debug-content': { id: 'content', textContent: '' },
      '#llm-prompt-copy-button': { id: 'copy-btn', addEventListener: jest.fn() },
      '#llm-prompt-meta-actor': { id: 'meta-actor', textContent: '' },
      '#llm-prompt-meta-llm': { id: 'meta-llm', textContent: '' },
      '#llm-prompt-meta-actions': { id: 'meta-actions', textContent: '' },
    };

    mockDocumentContext = {
      query: jest.fn((selector) => mockElements[selector] || null),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockDomElementFactory = {};

    // Mock navigator.clipboard
    Object.assign(navigator, {
        clipboard: {
            writeText: jest.fn().mockResolvedValue(undefined),
        },
    });

    modal = new PromptPreviewModal({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
    });
  });

  afterEach(() => {
      jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize and bind copy button', () => {
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#llm-prompt-copy-button');
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockElements['#llm-prompt-copy-button'],
        'click',
        expect.any(Function)
      );
    });

    it('should warn if copy button is missing', () => {
        const localMockDocContext = {
             query: jest.fn(selector => {
                 if (selector === '#llm-prompt-copy-button') return null;
                 return mockElements[selector] || {}; 
             })
        };
        
        mockLogger.warn.mockClear();

        new PromptPreviewModal({
            logger: mockLogger,
            documentContext: localMockDocContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Copy button (#llm-prompt-copy-button) not found'));
    });
  });

  describe('show()', () => {
    it('should call super.show() and render payload', () => {
      const payload = {
        prompt: 'This is a test prompt.',
        actorName: 'Hero',
        llmId: 'gpt-4',
        actionCount: 5,
      };

      modal.show(payload);

      expect(mockShow).toHaveBeenCalled();
      expect(mockElements['#llm-prompt-debug-content'].textContent).toBe('This is a test prompt.');
      expect(mockElements['#llm-prompt-meta-actor'].textContent).toBe('Hero');
      expect(mockElements['#llm-prompt-meta-llm'].textContent).toBe('gpt-4');
      expect(mockElements['#llm-prompt-meta-actions'].textContent).toBe('5');
      expect(mockClearStatusMessage).toHaveBeenCalled();
    });

    it('should handle missing payload gracefully', () => {
      modal.show(null);
      expect(mockShow).toHaveBeenCalled();
      expect(mockDisplayStatusMessage).toHaveBeenCalledWith('No data received.', 'error');
      expect(mockElements['#llm-prompt-debug-content'].textContent).toBe('');
    });

    it('should display errors if present', () => {
      const payload = {
        errors: ['Error 1', 'Error 2'],
      };
      modal.show(payload);
      expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Errors: Error 1; Error 2', 'error');
      expect(mockElements['#llm-prompt-debug-content'].textContent).toBe('');
    });

    it('should display partial prompt with errors', () => {
        const payload = {
            prompt: 'Partial prompt',
            errors: ['Something went wrong'],
        };
        modal.show(payload);
        expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Errors: Something went wrong', 'error');
        expect(mockElements['#llm-prompt-debug-content'].textContent).toBe('Partial prompt');
    });

    it('should handle missing metadata fields', () => {
       const payload = { prompt: 'Prompt' };
       modal.show(payload);
       expect(mockElements['#llm-prompt-meta-actor'].textContent).toBe('Unknown'); 
       expect(mockElements['#llm-prompt-meta-llm'].textContent).toBe('N/A'); 
       expect(mockElements['#llm-prompt-meta-actions'].textContent).toBe('-'); 
    });
  });

  describe('setLoading()', () => {
      it('should display loading message when true', () => {
          modal.setLoading(true);
          expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Generating prompt...', 'info');
          // content is cleared via _clearContent implicitly? No, explicit call in setLoading
          expect(mockElements['#llm-prompt-debug-content'].textContent).toBe('');
          expect(mockShow).toHaveBeenCalled(); 
      });

      it('should clear loading message when false', () => {
        mockElements['#llm-prompt-debug-status'].textContent = 'Generating prompt...';
        modal.setLoading(false);
        expect(mockClearStatusMessage).toHaveBeenCalled();
      });
  });

  describe('Copy Functionality', () => {
      it('should copy text to clipboard on button click', async () => {
          mockElements['#llm-prompt-debug-content'].textContent = 'Text to copy';
          
          const calls = mockAddDomListener.mock.calls;
          const copyCall = calls.find(c => c[0] === mockElements['#llm-prompt-copy-button']);
          const clickHandler = copyCall[2];

          await clickHandler();

          expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Text to copy');
          expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Copied!', 'success');
      });

      it('should handle copy errors', async () => {
        mockElements['#llm-prompt-debug-content'].textContent = 'Text to copy';
        navigator.clipboard.writeText.mockRejectedValue(new Error('Copy failed'));

        const calls = mockAddDomListener.mock.calls;
        const copyCall = calls.find(c => c[0] === mockElements['#llm-prompt-copy-button']);
        const clickHandler = copyCall[2];

        await clickHandler();

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Failed to copy.', 'error');
      });
      
      it('should warn if nothing to copy', async () => {
        mockElements['#llm-prompt-debug-content'].textContent = '';
        const calls = mockAddDomListener.mock.calls;
        const copyCall = calls.find(c => c[0] === mockElements['#llm-prompt-copy-button']);
        const clickHandler = copyCall[2];

        await clickHandler();
        
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        expect(mockDisplayStatusMessage).toHaveBeenCalledWith('Nothing to copy.', 'warning');
      });
  });
});