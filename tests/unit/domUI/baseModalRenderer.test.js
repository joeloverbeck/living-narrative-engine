// tests/domUI/baseModalRenderer.test.js
import { BaseModalRenderer } from '../../../src/domUI/baseModalRenderer.js';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'; // Rely on global 'jest'

jest.mock('../../../src/domUI/boundDomRendererBase.js', () => {
  // We don't need to requireActual for RendererBase here if we replicate its logic.
  const currentMockAddDomListener = jest.fn();
  const currentMockSuperDestroyFn = jest.fn();

  const MockCtor = jest.fn().mockImplementation(function (deps) {
    // Manually replicate RendererBase constructor essentials for `this` context
    this.logger = deps.logger;
    this.documentContext = deps.documentContext;
    this.validatedEventDispatcher = deps.validatedEventDispatcher;

    const className = this.constructor.name; // Will be 'TestableModalRenderer'
    this._logPrefix = `[${className}]`;

    this._managedVedEventSubscriptions = [];
    this._managedDomListeners = [];

    // BoundDomRendererBase (mocked) specific parts
    this.elementsConfig = deps.elementsConfig;
    this.elements = {};

    if (
      deps.elementsConfig &&
      deps.documentContext &&
      typeof deps.documentContext.query === 'function'
    ) {
      for (const key in deps.elementsConfig) {
        if (Object.prototype.hasOwnProperty.call(deps.elementsConfig, key)) {
          const configValue = deps.elementsConfig[key];
          let selector;
          if (typeof configValue === 'string') {
            selector = configValue;
          } else if (
            typeof configValue === 'object' &&
            configValue !== null &&
            typeof configValue.selector === 'string'
          ) {
            selector = configValue.selector;
          } else {
            // Use this._logPrefix which should now be set
            if (this.logger && this.logger.warn)
              this.logger.warn(
                `${this._logPrefix} Invalid config for element ${key}`
              );
            continue;
          }
          try {
            const el = deps.documentContext.query(selector);
            this.elements[key] = el || null;
          } catch (e) {
            if (this.logger && this.logger.error)
              this.logger.error(
                `${this._logPrefix} Error querying for ${key}`,
                e
              );
            this.elements[key] = null;
          }
        }
      }
    }
    // Assign the mock function for _addDomListener to the instance
    this._addDomListener = currentMockAddDomListener;
  });

  // For `super.destroy()` calls from BaseModalRenderer
  MockCtor.prototype.destroy = currentMockSuperDestroyFn;
  // If BaseModalRenderer uses super._addSubscription or other RendererBase methods, they'd need to be on prototype.
  // MockCtor.prototype._addSubscription = jest.fn(); // Example if needed

  // Static properties to access the mock functions from tests
  MockCtor._mockAddDomListener = currentMockAddDomListener;
  MockCtor._mockSuperDestroy = currentMockSuperDestroyFn;

  return { BoundDomRendererBase: MockCtor };
});

import { BoundDomRendererBase as MockedBoundDomRendererBase } from '../../../src/domUI/boundDomRendererBase.js';

const mockAddDomListener = MockedBoundDomRendererBase._mockAddDomListener;
const mockSuperDestroy = MockedBoundDomRendererBase._mockSuperDestroy;

describe('BaseModalRenderer', () => {
  let mockLogger;
  let mockDocumentForModal;
  let mockDocumentContextService;
  let mockModalElement;
  let mockCloseButton;
  let mockStatusElement;
  let mockConfirmButton;
  let mockCancelButton;
  let elementsConfig;
  let baseModalInstance;

  let onShowSpy;
  let onHideSpy;
  let getInitialFocusElementSpy;
  let getReturnFocusElementSpy;

  const getExpectedLogPrefix = (instance) => `[${instance.constructor.name}]`;

  class TestableModalRenderer extends BaseModalRenderer {
    constructor(dependencies) {
      super(dependencies);
    }
  }

  beforeEach(() => {
    mockAddDomListener.mockClear();
    mockSuperDestroy.mockClear();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockModalElement = {
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(
          (cls) =>
            mockModalElement._classes && mockModalElement._classes.has(cls)
        ),
        _classes: new Set(),
      },
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      hasAttribute: jest.fn().mockReturnValue(false),
      focus: jest.fn(),
      offsetParent: {},
    };
    mockModalElement.classList.add.mockImplementation((cls) =>
      mockModalElement.classList._classes.add(cls)
    );
    mockModalElement.classList.remove.mockImplementation((cls) =>
      mockModalElement.classList._classes.delete(cls)
    );
    mockModalElement.classList._classes.clear();

    mockCloseButton = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      focus: jest.fn(),
      disabled: false,
      offsetParent: {},
    };

    mockStatusElement = {
      textContent: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(
          (cls) =>
            mockStatusElement.classList._classes &&
            mockStatusElement.classList._classes.has(cls)
        ),
        _classes: new Set(),
      },
      style: { display: '' },
    };
    mockStatusElement.classList.add.mockImplementation((cls) =>
      mockStatusElement.classList._classes.add(cls)
    );
    mockStatusElement.classList.remove.mockImplementation((cls) =>
      mockStatusElement.classList._classes.delete(cls)
    );
    mockStatusElement.classList._classes.clear();

    mockConfirmButton = { disabled: false, offsetParent: {} };
    mockCancelButton = { disabled: false, offsetParent: {} };

    mockDocumentForModal = {
      activeElement: null,
      body: {
        contains: jest.fn().mockReturnValue(true),
        focus: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    mockDocumentContextService = {
      query: jest.fn((selector) => {
        switch (selector) {
          case '#modal':
            return mockModalElement;
          case '#close':
            return mockCloseButton;
          case '#status':
            return mockStatusElement;
          case '#confirm':
            return mockConfirmButton;
          case '#cancel':
            return mockCancelButton;
          case '#nonDisableable':
            return { id: 'nonDisableable', offsetParent: {} };
          default:
            return null;
        }
      }),
      create: jest.fn((tagName) => ({
        tagName: tagName.toUpperCase(),
        appendChild: jest.fn(),
        setAttribute: jest.fn(),
        style: {},
        classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
      })),
      document: mockDocumentForModal,
    };

    elementsConfig = {
      modalElement: '#modal',
      closeButton: '#close',
      statusMessageElement: '#status',
      confirmButton: '#confirm',
      cancelButton: '#cancel',
    };

    baseModalInstance = new TestableModalRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContextService,
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      },
      elementsConfig: elementsConfig,
    });

    onShowSpy = jest
      .spyOn(baseModalInstance, '_onShow')
      .mockImplementation(() => {});
    onHideSpy = jest
      .spyOn(baseModalInstance, '_onHide')
      .mockImplementation(() => {});
    getInitialFocusElementSpy = jest
      .spyOn(baseModalInstance, '_getInitialFocusElement')
      .mockReturnValue(null);
    getReturnFocusElementSpy = jest
      .spyOn(baseModalInstance, '_getReturnFocusElement')
      .mockReturnValue(null);

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Constructor & Initialization', () => {
    it('should initialize with isVisible = false', () => {
      expect(baseModalInstance.isVisible).toBe(false);
    });

    it('should call _addDomListener for close button, backdrop, and Escape key via _bindCoreModalEvents', () => {
      expect(mockAddDomListener).toHaveBeenCalledTimes(3);
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockCloseButton,
        'click',
        expect.any(Function)
      );
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockModalElement,
        'click',
        expect.any(Function)
      );
      expect(mockAddDomListener).toHaveBeenCalledWith(
        mockDocumentForModal,
        'keydown',
        expect.any(Function)
      );
    });

    it('should set initial aria-hidden attribute on modalElement if it exists', () => {
      expect(mockModalElement.setAttribute).toHaveBeenCalledWith(
        'aria-hidden',
        'true'
      );
    });

    it('should log error if modalElement is not found during construction', () => {
      const tempDocContext = {
        ...mockDocumentContextService,
        query: jest.fn((selector) =>
          selector === '#close' ? mockCloseButton : null
        ),
      };
      const newInstance = new TestableModalRenderer({
        logger: mockLogger,
        documentContext: tempDocContext,
        elementsConfig: { modalElement: '#modal', closeButton: '#close' },
        validatedEventDispatcher: {
          dispatch: jest.fn(),
          subscribe: jest.fn(),
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(newInstance)} 'modalElement' is not defined in 'elementsConfig' or not found in the DOM.`
        )
      );
    });

    it('should log error if closeButton specified in dependencyInjection is not found', () => {
      const tempDocContext = {
        ...mockDocumentContextService,
        query: jest.fn((selector) =>
          selector === '#modal' ? mockModalElement : null
        ),
      };
      const newInstance = new TestableModalRenderer({
        logger: mockLogger,
        documentContext: tempDocContext,
        elementsConfig: { modalElement: '#modal', closeButton: '#close' },
        validatedEventDispatcher: {
          dispatch: jest.fn(),
          subscribe: jest.fn(),
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(newInstance)} 'closeButton' was configured in 'elementsConfig' but not found in the DOM.`
        )
      );
    });

    it('should log warning if closeButton is not specified in dependencyInjection', () => {
      const { closeButton, ...configWithoutClose } = elementsConfig;
      const tempDocContextQuery = jest.fn((selector) => {
        if (selector === '#modal') return mockModalElement;
        if (selector === '#status' && configWithoutClose.statusMessageElement)
          return null;
        return null;
      });
      const tempDocContext = {
        ...mockDocumentContextService,
        query: tempDocContextQuery,
      };

      const newInstance = new TestableModalRenderer({
        logger: mockLogger,
        documentContext: tempDocContext,
        elementsConfig: configWithoutClose,
        validatedEventDispatcher: {
          dispatch: jest.fn(),
          subscribe: jest.fn(),
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(newInstance)} 'closeButton' was not specified in 'elementsConfig'.`
        )
      );
      if (configWithoutClose.statusMessageElement) {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `${getExpectedLogPrefix(newInstance)} 'statusMessageElement' was configured in 'elementsConfig' but not found in the DOM.`
          )
        );
      }
    });
  });

  describe('show()', () => {
    it('should make the modal visible, update styles, classes, and ARIA attributes', () => {
      baseModalInstance.show();
      expect(baseModalInstance.isVisible).toBe(true);
      expect(mockModalElement.style.display).toBe('flex');
      jest.runAllTimers();
      expect(mockModalElement.classList.add).toHaveBeenCalledWith('visible');
      expect(mockModalElement.setAttribute).toHaveBeenCalledWith(
        'aria-hidden',
        'false'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Modal shown.`
      );
    });

    it('should call lifecycle hooks: _clearStatusMessage (if exists), _onShow, _getInitialFocusElement', () => {
      const clearStatusSpy = jest.spyOn(
        baseModalInstance,
        '_clearStatusMessage'
      );
      baseModalInstance.show();
      expect(clearStatusSpy).toHaveBeenCalled();
      expect(onShowSpy).toHaveBeenCalled();
      expect(getInitialFocusElementSpy).toHaveBeenCalled();
    });

    it('should focus element from _getInitialFocusElement', () => {
      const mockFocusTarget = { focus: jest.fn(), offsetParent: {} };
      getInitialFocusElementSpy.mockReturnValue(mockFocusTarget);
      baseModalInstance.show();
      expect(mockFocusTarget.focus).toHaveBeenCalled();
    });

    it('should fallback to focus closeButton if _getInitialFocusElement returns null and closeButton is focusable', () => {
      getInitialFocusElementSpy.mockReturnValue(null);
      if (getInitialFocusElementSpy.mockRestore)
        getInitialFocusElementSpy.mockRestore();
      baseModalInstance.elements.closeButton = mockCloseButton;
      mockCloseButton.focus = jest.fn();
      baseModalInstance.show();
      expect(mockCloseButton.focus).toHaveBeenCalled();
    });

    it('should fallback to focus modalElement if _getInitialFocusElement and closeButton fail/absent and modal has tabindex and is focusable', () => {
      getInitialFocusElementSpy.mockReturnValue(null);
      if (getInitialFocusElementSpy.mockRestore)
        getInitialFocusElementSpy.mockRestore();
      baseModalInstance.elements.closeButton = null;
      baseModalInstance.elements.modalElement = mockModalElement;
      mockModalElement.hasAttribute.mockReturnValue(true);
      mockModalElement.focus = jest.fn();
      baseModalInstance.show();
      expect(mockModalElement.focus).toHaveBeenCalled();
    });

    it('should store document.activeElement as _previouslyFocusedElement', () => {
      const dummyActiveElement = {
        id: 'dummy-active',
        focus: jest.fn(),
        offsetParent: {},
      };
      mockDocumentForModal.activeElement = dummyActiveElement;
      baseModalInstance.show();
      expect(baseModalInstance._previouslyFocusedElement).toBe(
        dummyActiveElement
      );
    });

    it('should log warning and return if already visible', () => {
      baseModalInstance.isVisible = true;
      mockModalElement.classList.add.mockClear();
      baseModalInstance.show();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} show() called when modal is already visible.`
      );
      expect(mockModalElement.classList.add).not.toHaveBeenCalledWith(
        'visible'
      );
    });

    it('should log error and return if modalElement is not available (e.g. destroyed)', () => {
      baseModalInstance.elements.modalElement = null;
      baseModalInstance.show();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Cannot show modal, 'modalElement' is not available.`
      );
      expect(baseModalInstance.isVisible).toBe(false);
    });
  });

  describe('hide()', () => {
    beforeEach(() => {
      baseModalInstance.isVisible = true;
      mockModalElement.classList._classes.add('visible');
      mockModalElement.style.display = 'flex';
      baseModalInstance._previouslyFocusedElement = {
        focus: jest.fn(),
        offsetParent: {},
      };
      mockDocumentForModal.body.contains.mockReturnValue(true);
    });

    it('should make the modal hidden, update styles, classes, and ARIA attributes', () => {
      baseModalInstance.hide();
      expect(baseModalInstance.isVisible).toBe(false);
      expect(mockModalElement.classList.remove).toHaveBeenCalledWith('visible');
      expect(mockModalElement.setAttribute).toHaveBeenCalledWith(
        'aria-hidden',
        'true'
      );
      jest.runAllTimers();
      expect(mockModalElement.style.display).toBe('none');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Modal hidden.`
      );
    });

    it('should call lifecycle hooks: _onHide, _getReturnFocusElement', () => {
      baseModalInstance.hide();
      expect(onHideSpy).toHaveBeenCalled();
      expect(getReturnFocusElementSpy).toHaveBeenCalled();
    });

    it('should return focus to element from _getReturnFocusElement if provided and focusable', () => {
      const mockReturnFocusTarget = { focus: jest.fn(), offsetParent: {} };
      getReturnFocusElementSpy.mockReturnValue(mockReturnFocusTarget);
      baseModalInstance.hide();
      expect(mockReturnFocusTarget.focus).toHaveBeenCalled();
    });

    it('should return focus to _previouslyFocusedElement if _getReturnFocusElement is null and element is focusable', () => {
      const dummyPrevActiveElement = { focus: jest.fn(), offsetParent: {} };
      baseModalInstance._previouslyFocusedElement = dummyPrevActiveElement;
      getReturnFocusElementSpy.mockReturnValue(null);
      mockDocumentForModal.body.contains.mockReturnValue(true);
      baseModalInstance.hide();
      expect(dummyPrevActiveElement.focus).toHaveBeenCalled();
      expect(baseModalInstance._previouslyFocusedElement).toBeNull();
    });

    it('should not try to focus _previouslyFocusedElement if it is no longer in document', () => {
      const dummyPrevActiveElement = { focus: jest.fn(), offsetParent: {} };
      baseModalInstance._previouslyFocusedElement = dummyPrevActiveElement;
      getReturnFocusElementSpy.mockReturnValue(null);
      mockDocumentForModal.body.contains.mockReturnValue(false);
      baseModalInstance.hide();
      expect(dummyPrevActiveElement.focus).not.toHaveBeenCalled();
    });

    it('should return early if not visible', () => {
      baseModalInstance.isVisible = false;
      mockModalElement.classList.remove.mockClear();
      onHideSpy.mockClear();
      baseModalInstance.hide();
      expect(mockModalElement.classList.remove).not.toHaveBeenCalledWith(
        'visible'
      );
      expect(onHideSpy).not.toHaveBeenCalled();
    });

    it('should log error if modalElement is not available', () => {
      baseModalInstance.elements.modalElement = null;
      baseModalInstance.hide();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Cannot hide modal, 'modalElement' is not available.`
      );
      expect(baseModalInstance.isVisible).toBe(false);
    });
  });

  describe('Event Handling via _bindCoreModalEvents', () => {
    let closeButtonClickHandler;
    let backdropClickHandler;
    let escapeKeyHandler;
    let hidePrototypeSpy; // Changed to prototype spy

    beforeEach(() => {
      mockAddDomListener.mockClear();
      // Spy on the prototype *before* instance creation
      hidePrototypeSpy = jest.spyOn(TestableModalRenderer.prototype, 'hide');

      baseModalInstance = new TestableModalRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContextService,
        validatedEventDispatcher: {
          dispatch: jest.fn(),
          subscribe: jest.fn(),
        },
        elementsConfig: elementsConfig,
      });
      // Instance spy removed: hideSpy = jest.spyOn(baseModalInstance, 'hide');

      const closeCall = mockAddDomListener.mock.calls.find(
        (call) =>
          call[0] === baseModalInstance.elements.closeButton &&
          call[1] === 'click'
      );
      closeButtonClickHandler = closeCall ? closeCall[2] : null;

      const backdropCall = mockAddDomListener.mock.calls.find(
        (call) =>
          call[0] === baseModalInstance.elements.modalElement &&
          call[1] === 'click'
      );
      backdropClickHandler = backdropCall ? backdropCall[2] : null;

      const escapeCall = mockAddDomListener.mock.calls.find(
        (call) => call[0] === mockDocumentForModal && call[1] === 'keydown'
      );
      escapeKeyHandler = escapeCall ? escapeCall[2] : null;
    });

    afterEach(() => {
      // Added afterEach for this describe block
      if (hidePrototypeSpy) {
        hidePrototypeSpy.mockRestore();
      }
    });

    it('should hide modal on closeButton click', () => {
      baseModalInstance.isVisible = true;
      closeButtonClickHandler();
      expect(hidePrototypeSpy).toHaveBeenCalled(); // Check prototype spy
    });

    it('should hide modal on backdrop click (event.target is modalElement)', () => {
      expect(backdropClickHandler).toBeInstanceOf(Function);
      baseModalInstance.isVisible = true;
      const event = { target: baseModalInstance.elements.modalElement };
      backdropClickHandler(event);
      expect(hidePrototypeSpy).toHaveBeenCalled(); // Check prototype spy
    });

    it('should NOT hide modal on click inside modal content (event.target is not modalElement)', () => {
      expect(backdropClickHandler).toBeInstanceOf(Function);
      baseModalInstance.isVisible = true;
      const mockModalContent = { id: 'modal-content' };
      const event = { target: mockModalContent };
      backdropClickHandler(event);
      expect(hidePrototypeSpy).not.toHaveBeenCalled(); // Check prototype spy
    });

    it('should hide modal on Escape key press when visible', () => {
      expect(escapeKeyHandler).toBeInstanceOf(Function);
      baseModalInstance.isVisible = true;
      const event = { key: 'Escape' };
      escapeKeyHandler(event);
      expect(hidePrototypeSpy).toHaveBeenCalled(); // Check prototype spy
    });

    it('should NOT hide modal on Escape key press when not visible', () => {
      expect(escapeKeyHandler).toBeInstanceOf(Function);
      baseModalInstance.isVisible = false;
      const event = { key: 'Escape' };
      escapeKeyHandler(event);
      expect(hidePrototypeSpy).not.toHaveBeenCalled(); // Check prototype spy
    });

    it('should NOT hide modal on other key press when visible', () => {
      expect(escapeKeyHandler).toBeInstanceOf(Function);
      baseModalInstance.isVisible = true;
      const event = { key: 'Enter' };
      escapeKeyHandler(event);
      expect(hidePrototypeSpy).not.toHaveBeenCalled(); // Check prototype spy
    });
  });

  describe('Status Message Methods', () => {
    beforeEach(() => {
      baseModalInstance.elements.statusMessageElement = mockStatusElement;
      mockStatusElement.classList.remove.mockClear();
      mockStatusElement.classList.add.mockClear();
      mockStatusElement.textContent = '';
      baseModalInstance._currentStatusTypeClass = null;
    });

    it('_displayStatusMessage should set text and class', () => {
      baseModalInstance._displayStatusMessage('Test message', 'success');
      expect(mockStatusElement.textContent).toBe('Test message');
      expect(mockStatusElement.classList.add).toHaveBeenCalledWith(
        'status-message-area'
      );
      expect(mockStatusElement.classList.add).toHaveBeenCalledWith(
        'status-message-success'
      );
      expect(mockStatusElement.style.display).toBe('');
    });

    it('_displayStatusMessage should remove previous type class', () => {
      baseModalInstance._currentStatusTypeClass = 'status-message-info';
      mockStatusElement.classList._classes.add('status-message-info');
      baseModalInstance._displayStatusMessage('New message', 'error');
      expect(mockStatusElement.classList.remove).toHaveBeenCalledWith(
        'status-message-info'
      );
      expect(mockStatusElement.classList.add).toHaveBeenCalledWith(
        'status-message-error'
      );
      expect(baseModalInstance._currentStatusTypeClass).toBe(
        'status-message-error'
      );
    });

    it('_displayStatusMessage should log warning if statusElement is not available', () => {
      baseModalInstance.elements.statusMessageElement = null;
      baseModalInstance._displayStatusMessage('No show', 'info');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} '_displayStatusMessage' called, but 'statusMessageElement' is not available. Message: "No show" (type: info)`
      );
    });

    it('_clearStatusMessage should clear text and remove class', () => {
      mockStatusElement.textContent = 'Old message';
      baseModalInstance._currentStatusTypeClass = 'status-message-success';
      mockStatusElement.classList._classes.add('status-message-success');
      baseModalInstance._clearStatusMessage();
      expect(mockStatusElement.textContent).toBe('');
      expect(mockStatusElement.classList.remove).toHaveBeenCalledWith(
        'status-message-success'
      );
      expect(baseModalInstance._currentStatusTypeClass).toBeNull();
    });

    it('_clearStatusMessage should do nothing if statusElement not available (no error, logs debug)', () => {
      baseModalInstance.elements.statusMessageElement = null;
      expect(() => baseModalInstance._clearStatusMessage()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} '_clearStatusMessage' called, but 'statusMessageElement' is not available. No message to clear.`
      );
    });
  });

  describe('_setOperationInProgress()', () => {
    beforeEach(() => {
      baseModalInstance.elements.confirmButton = mockConfirmButton;
      baseModalInstance.elements.cancelButton = mockCancelButton;
      mockConfirmButton.disabled = false;
      mockCancelButton.disabled = false;
      baseModalInstance._operationInProgressAffectedElements = [
        'confirmButton',
        'cancelButton',
      ];
    });

    it('should disable configured elements when inProgress is true', () => {
      baseModalInstance._setOperationInProgress(true);
      expect(mockConfirmButton.disabled).toBe(true);
      expect(mockCancelButton.disabled).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Operation in progress state set to true. Affected elements: confirmButton, cancelButton.`
      );
    });

    it('should enable configured elements when inProgress is false', () => {
      mockConfirmButton.disabled = true;
      mockCancelButton.disabled = true;
      baseModalInstance._setOperationInProgress(false);
      expect(mockConfirmButton.disabled).toBe(false);
      expect(mockCancelButton.disabled).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Operation in progress state set to false. Affected elements: confirmButton, cancelButton.`
      );
    });

    it('should log debug if an element key is configured but element not found', () => {
      baseModalInstance.elements.cancelButton = null;
      baseModalInstance._setOperationInProgress(true);
      expect(mockConfirmButton.disabled).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(baseModalInstance)} Element "cancelButton" not found for _setOperationInProgress (may be optional for this modal).`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(baseModalInstance)} Operation in progress state set to true.`
        )
      );
    });

    it('should log warning if an element is found but does not support "disabled" property', () => {
      const mockNonDisableableElement = {
        id: 'nonDisableable',
        offsetParent: {},
      };
      baseModalInstance.elements.nonDisableableButton =
        mockNonDisableableElement;
      baseModalInstance._operationInProgressAffectedElements = [
        'nonDisableableButton',
      ];
      baseModalInstance._setOperationInProgress(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `${getExpectedLogPrefix(baseModalInstance)} Element "nonDisableableButton" found for '_setOperationInProgress' but does not support 'disabled' property.`
        )
      );
    });

    it('should log debug and return if _operationInProgressAffectedElements is empty', () => {
      baseModalInstance._operationInProgressAffectedElements = [];
      baseModalInstance._setOperationInProgress(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} No elements configured for '_setOperationInProgress'.`
      );
      expect(mockConfirmButton.disabled).toBe(false);
    });
  });

  describe('Default Lifecycle Hook Behaviors', () => {
    beforeEach(() => {
      if (getInitialFocusElementSpy && getInitialFocusElementSpy.mockRestore)
        getInitialFocusElementSpy.mockRestore();
      if (getReturnFocusElementSpy && getReturnFocusElementSpy.mockRestore)
        getReturnFocusElementSpy.mockRestore();
      if (onShowSpy && onShowSpy.mockRestore) onShowSpy.mockRestore();
      if (onHideSpy && onHideSpy.mockRestore) onHideSpy.mockRestore();

      baseModalInstance = new TestableModalRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContextService,
        validatedEventDispatcher: {
          dispatch: jest.fn(),
          subscribe: jest.fn(),
        },
        elementsConfig: elementsConfig,
      });
    });

    it('_getInitialFocusElement should return closeButton by default if available and focusable', () => {
      expect(baseModalInstance.elements.closeButton).toBe(mockCloseButton);
      expect(typeof baseModalInstance.elements.closeButton.focus).toBe(
        'function'
      );
      const focusElement = baseModalInstance._getInitialFocusElement();
      expect(focusElement).toBe(mockCloseButton);
    });

    it('_getInitialFocusElement should return modalElement if closeButton is unavailable and modalElement has tabindex and is focusable', () => {
      baseModalInstance.elements.closeButton = null;
      baseModalInstance.elements.modalElement = mockModalElement;
      mockModalElement.hasAttribute.mockReturnValue(true);
      expect(typeof baseModalInstance.elements.modalElement.focus).toBe(
        'function'
      );
      const focusElement = baseModalInstance._getInitialFocusElement();
      expect(focusElement).toBe(mockModalElement);
    });

    it('_getInitialFocusElement should return null if no suitable element is found', () => {
      baseModalInstance.elements.closeButton = null;
      baseModalInstance.elements.modalElement = mockModalElement;
      mockModalElement.hasAttribute.mockReturnValue(false);
      const focusElement = baseModalInstance._getInitialFocusElement();
      expect(focusElement).toBeNull();
    });

    it('_getReturnFocusElement should return null by default', () => {
      expect(baseModalInstance._getReturnFocusElement()).toBeNull();
    });

    it('_onShow default implementation should not throw', () => {
      expect(() => baseModalInstance._onShow()).not.toThrow();
    });

    it('_onHide default implementation should not throw', () => {
      expect(() => baseModalInstance._onHide()).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('should call hide() if modal is visible', () => {
      const hideSpy = jest.spyOn(baseModalInstance, 'hide');
      baseModalInstance.isVisible = true;
      baseModalInstance.destroy();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('should not call hide() if modal is not visible', () => {
      const hideSpy = jest.spyOn(baseModalInstance, 'hide');
      baseModalInstance.isVisible = false;
      baseModalInstance.destroy();
      expect(hideSpy).not.toHaveBeenCalled();
    });

    it('should call super.destroy() if it exists', () => {
      baseModalInstance.destroy();
      expect(mockSuperDestroy).toHaveBeenCalled();
    });

    it('should log that it was destroyed', () => {
      baseModalInstance.destroy();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${getExpectedLogPrefix(baseModalInstance)} Destroyed.`
      );
    });
  });
});
