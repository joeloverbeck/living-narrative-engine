import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import MonteCarloReportModal from '../../../../src/domUI/expression-diagnostics/MonteCarloReportModal.js';

// Mock methods for BaseModalRenderer
const mockShow = jest.fn();
const mockHide = jest.fn();
const mockDisplayStatusMessage = jest.fn();
const mockClearStatusMessage = jest.fn();
const mockAddDomListener = jest.fn();

// Mock BaseModalRenderer
jest.mock('../../../../src/domUI/baseModalRenderer.js', () => {
  return {
    BaseModalRenderer: class MockBaseModalRenderer {
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
        this.elements = {};

        // Simulate element lookup logic
        Object.keys(elementsConfig).forEach((key) => {
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

        this._logPrefix = '[MonteCarloReportModal]';
        this.isVisible = false;
      }

      show() {
        this.isVisible = true;
        mockShow();
        this._onShow?.();
      }
      hide() {
        this.isVisible = false;
        mockHide();
        this._onHide?.();
      }
      _displayStatusMessage(msg, type) {
        mockDisplayStatusMessage(msg, type);
      }
      _clearStatusMessage() {
        mockClearStatusMessage();
      }
      _addDomListener(el, type, fn) {
        mockAddDomListener(el, type, fn);
      }
    },
  };
});

// Mock clipboardUtils
jest.mock('../../../../src/domUI/helpers/clipboardUtils.js', () => ({
  copyToClipboard: jest.fn(),
}));

import { copyToClipboard } from '../../../../src/domUI/helpers/clipboardUtils.js';

describe('MonteCarloReportModal', () => {
  let modal;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockElements;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockElements = {
      '#mc-report-modal': { id: 'modal' },
      '#mc-report-close-btn': { id: 'close-btn' },
      '#mc-report-status': { id: 'status', textContent: '' },
      '#mc-report-content': { id: 'content', textContent: '' },
      '#mc-report-copy-btn': { id: 'copy-btn' },
    };

    mockDocumentContext = {
      query: jest.fn((selector) => mockElements[selector] || null),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    modal = new MonteCarloReportModal({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct elements config', () => {
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#mc-report-modal');
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#mc-report-close-btn'
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#mc-report-status'
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#mc-report-content'
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#mc-report-copy-btn'
      );
    });

    it('should bind copy button click event', () => {
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockElements['#mc-report-copy-btn'],
        'click',
        expect.any(Function)
      );
    });

    it('should set copyButton as operation-in-progress affected element', () => {
      expect(modal._operationInProgressAffectedElements).toEqual(['copyButton']);
    });
  });

  describe('showReport()', () => {
    it('should store content and call show()', () => {
      const testContent = '# Test Report\n\nSome content here.';

      modal.showReport(testContent);

      expect(mockShow).toHaveBeenCalled();
    });

    it('should populate content area in _onShow()', () => {
      const testContent = '# Test Report\n\nSome content here.';

      modal.showReport(testContent);

      expect(mockElements['#mc-report-content'].textContent).toBe(testContent);
    });
  });

  describe('_onShow lifecycle', () => {
    it('should populate content area with stored report content', () => {
      const testContent = '# Monte Carlo Analysis\n\nTrigger rate: 50%';

      modal.showReport(testContent);

      expect(mockElements['#mc-report-content'].textContent).toBe(testContent);
    });

    it('should handle missing content area gracefully', () => {
      const localMockDocContext = {
        query: jest.fn((selector) => {
          if (selector === '#mc-report-content') return null;
          return mockElements[selector] || {};
        }),
      };

      const localModal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: localMockDocContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Should not throw
      expect(() => localModal.showReport('test content')).not.toThrow();
    });
  });

  describe('_onHide lifecycle', () => {
    it('should clear content area when modal is hidden', () => {
      const testContent = '# Test Report';
      modal.showReport(testContent);
      expect(mockElements['#mc-report-content'].textContent).toBe(testContent);

      modal.hide();

      expect(mockElements['#mc-report-content'].textContent).toBe('');
    });

    it('should handle missing content area gracefully on hide', () => {
      const localMockDocContext = {
        query: jest.fn((selector) => {
          if (selector === '#mc-report-content') return null;
          return mockElements[selector] || {};
        }),
      };

      const localModal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: localMockDocContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      localModal.showReport('test');
      // Should not throw
      expect(() => localModal.hide()).not.toThrow();
    });
  });

  describe('_getInitialFocusElement', () => {
    it('should return copy button as initial focus element', () => {
      const result = modal._getInitialFocusElement();

      expect(result).toBe(mockElements['#mc-report-copy-btn']);
    });

    it('should fallback to close button if copy button is missing', () => {
      const localMockDocContext = {
        query: jest.fn((selector) => {
          if (selector === '#mc-report-copy-btn') return null;
          return mockElements[selector] || {};
        }),
      };

      const localModal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: localMockDocContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const result = localModal._getInitialFocusElement();

      expect(result).toBe(mockElements['#mc-report-close-btn']);
    });

    it('should return null if both copy and close buttons are missing', () => {
      const localMockDocContext = {
        query: jest.fn((selector) => {
          if (
            selector === '#mc-report-copy-btn' ||
            selector === '#mc-report-close-btn'
          ) {
            return null;
          }
          return mockElements[selector] || {};
        }),
      };

      const localModal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: localMockDocContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const result = localModal._getInitialFocusElement();

      expect(result).toBeNull();
    });
  });

  describe('Copy functionality', () => {
    it('should copy report content to clipboard on button click', async () => {
      copyToClipboard.mockResolvedValue(true);
      const testContent = '# Test Report';
      modal.showReport(testContent);

      const calls = mockAddDomListener.mock.calls;
      const copyCall = calls.find(
        (c) => c[0] === mockElements['#mc-report-copy-btn']
      );
      const clickHandler = copyCall[2];

      await clickHandler();

      expect(copyToClipboard).toHaveBeenCalledWith(testContent);
      expect(mockDisplayStatusMessage).toHaveBeenCalledWith(
        'Copied to clipboard!',
        'success'
      );
    });

    it('should show error message if copy fails', async () => {
      copyToClipboard.mockResolvedValue(false);
      const testContent = '# Test Report';
      modal.showReport(testContent);

      const calls = mockAddDomListener.mock.calls;
      const copyCall = calls.find(
        (c) => c[0] === mockElements['#mc-report-copy-btn']
      );
      const clickHandler = copyCall[2];

      await clickHandler();

      expect(mockDisplayStatusMessage).toHaveBeenCalledWith(
        'Failed to copy. Please select and copy manually.',
        'error'
      );
    });

    it('should show error message if no content to copy', async () => {
      // Don't call showReport - no content stored

      const calls = mockAddDomListener.mock.calls;
      const copyCall = calls.find(
        (c) => c[0] === mockElements['#mc-report-copy-btn']
      );
      const clickHandler = copyCall[2];

      await clickHandler();

      expect(copyToClipboard).not.toHaveBeenCalled();
      expect(mockDisplayStatusMessage).toHaveBeenCalledWith(
        'No content to copy.',
        'error'
      );
    });

    it('should handle clipboard API errors gracefully', async () => {
      copyToClipboard.mockRejectedValue(new Error('Clipboard API failed'));
      const testContent = '# Test Report';
      modal.showReport(testContent);

      const calls = mockAddDomListener.mock.calls;
      const copyCall = calls.find(
        (c) => c[0] === mockElements['#mc-report-copy-btn']
      );
      const clickHandler = copyCall[2];

      await clickHandler();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Clipboard copy failed:',
        expect.any(Error)
      );
      expect(mockDisplayStatusMessage).toHaveBeenCalledWith(
        'Failed to copy. Please select and copy manually.',
        'error'
      );
    });

    it('should auto-clear status message after 2 seconds', async () => {
      copyToClipboard.mockResolvedValue(true);
      const testContent = '# Test Report';
      modal.showReport(testContent);

      const calls = mockAddDomListener.mock.calls;
      const copyCall = calls.find(
        (c) => c[0] === mockElements['#mc-report-copy-btn']
      );
      const clickHandler = copyCall[2];

      await clickHandler();

      expect(mockClearStatusMessage).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2000);

      expect(mockClearStatusMessage).toHaveBeenCalled();
    });
  });

  describe('Event binding', () => {
    it('should not bind event if copy button is missing', () => {
      const localMockDocContext = {
        query: jest.fn((selector) => {
          if (selector === '#mc-report-copy-btn') return null;
          return mockElements[selector] || {};
        }),
      };

      mockAddDomListener.mockClear();

      new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: localMockDocContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Should not have bound to copy button
      const copyButtonBindings = mockAddDomListener.mock.calls.filter(
        (c) => c[1] === 'click' && c[0] === null
      );
      expect(copyButtonBindings).toHaveLength(0);
    });
  });
});
