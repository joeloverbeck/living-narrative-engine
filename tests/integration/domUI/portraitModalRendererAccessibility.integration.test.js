/**
 * @file Advanced integration tests for PortraitModalRenderer accessibility and image handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

function createRegistryMocks() {
  return {
    getWorldDefinition: jest.fn(),
    getAllWorldDefinitions: jest.fn(() => []),
    getStartingPlayerId: jest.fn(),
    getStartingLocationId: jest.fn(),
    getActionDefinition: jest.fn(),
    getAllActionDefinitions: jest.fn(() => []),
    getEntityDefinition: jest.fn(),
    getAllEntityDefinitions: jest.fn(() => []),
    getEntityInstanceDefinition: jest.fn(),
    getAllEntityInstanceDefinitions: jest.fn(() => []),
    getEventDefinition: jest.fn(),
    getAllEventDefinitions: jest.fn(() => []),
    getComponentDefinition: jest.fn(),
    getAllComponentDefinitions: jest.fn(() => []),
    getConditionDefinition: jest.fn(),
    getAllConditionDefinitions: jest.fn(() => []),
    getGoalDefinition: jest.fn(),
    getAllGoalDefinitions: jest.fn(() => []),
    getComponentRegistry: jest.fn(() => ({})),
    getActionRegistry: jest.fn(() => ({})),
    getEntityRegistry: jest.fn(() => ({})),
    getEventRegistry: jest.fn(() => ({})),
    registerEventDefinition: jest.fn(),
    registerComponentDefinition: jest.fn(),
    registerActionDefinition: jest.fn(),
    registerEntityDefinition: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(() => []),
    clear: jest.fn(),
    store: jest.fn(),
  };
}

function createValidatedDispatcher(logger) {
  const eventBus = new EventBus({ logger });
  const registry = createRegistryMocks();
  const schemaValidator = new AjvSchemaValidator({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);
  const dispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });

  const eventDefinitions = {
    'core:portrait_modal_opened': {
      id: 'core:portrait_modal_opened',
      description: 'Dispatched when a portrait modal is opened',
      payloadSchema: {
        type: 'object',
        properties: {
          portraitPath: { type: 'string' },
          speakerName: { type: 'string' },
        },
        required: ['portraitPath', 'speakerName'],
        additionalProperties: false,
      },
    },
    'core:portrait_modal_closed': {
      id: 'core:portrait_modal_closed',
      description: 'Dispatched when a portrait modal is closed',
      payloadSchema: {
        type: 'object',
        properties: {
          portraitPath: { type: 'string' },
          speakerName: { type: 'string' },
        },
        required: ['portraitPath', 'speakerName'],
        additionalProperties: false,
      },
    },
  };

  registry.getEventDefinition.mockImplementation(
    (id) => eventDefinitions[id] || null
  );

  return { dispatcher, eventBus, registry, schemaValidator };
}

function setupModalDom({
  includeImage = true,
  includeSpinner = true,
  includeStatus = true,
} = {}) {
  document.body.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'portrait-modal-overlay';
  overlay.setAttribute('tabindex', '-1');
  overlay.style.display = 'none';

  const closeButton = document.createElement('button');
  closeButton.className = 'portrait-modal-close';
  closeButton.textContent = 'Close';
  overlay.appendChild(closeButton);

  const secondaryButton = document.createElement('button');
  secondaryButton.className = 'secondary-action';
  secondaryButton.textContent = 'Secondary';
  overlay.appendChild(secondaryButton);

  const focusLink = document.createElement('a');
  focusLink.href = '#';
  focusLink.textContent = 'Details';
  overlay.appendChild(focusLink);

  let statusElement = null;
  if (includeStatus) {
    statusElement = document.createElement('div');
    statusElement.className = 'portrait-error-message';
    overlay.appendChild(statusElement);
  }

  let imageElement = null;
  if (includeImage) {
    imageElement = document.createElement('img');
    imageElement.className = 'portrait-modal-image';
    overlay.appendChild(imageElement);
  }

  let spinnerElement = null;
  if (includeSpinner) {
    spinnerElement = document.createElement('div');
    spinnerElement.className = 'portrait-loading-spinner';
    overlay.appendChild(spinnerElement);
  }

  const modalTitle = document.createElement('h2');
  modalTitle.id = 'portrait-modal-title';
  modalTitle.textContent = 'Portrait';
  overlay.appendChild(modalTitle);

  document.body.appendChild(overlay);

  const triggerButton = document.createElement('button');
  triggerButton.textContent = 'Open portrait';
  triggerButton.id = 'portrait-trigger';
  document.body.appendChild(triggerButton);

  return {
    overlay,
    closeButton,
    secondaryButton,
    focusLink,
    statusElement,
    imageElement,
    spinnerElement,
    modalTitle,
    triggerButton,
  };
}

function buildRenderer(options = {}) {
  const logger = createMockLogger();
  const {
    overlay,
    closeButton,
    secondaryButton,
    focusLink,
    statusElement,
    imageElement,
    spinnerElement,
    modalTitle,
    triggerButton,
  } = setupModalDom(options);

  const documentContext = new DocumentContext(document, logger);
  const domElementFactory = new DomElementFactory(documentContext);
  const { dispatcher, eventBus } = createValidatedDispatcher(logger);

  const renderer = new PortraitModalRenderer({
    documentContext,
    domElementFactory,
    logger,
    validatedEventDispatcher: dispatcher,
  });

  return {
    renderer,
    logger,
    overlay,
    closeButton,
    secondaryButton,
    focusLink,
    statusElement,
    imageElement,
    spinnerElement,
    modalTitle,
    triggerButton,
    documentContext,
    domElementFactory,
    validatedEventDispatcher: dispatcher,
    eventBus,
  };
}

describe('PortraitModalRenderer accessibility integration', () => {
  let originalMatchMedia;
  let originalRequestAnimationFrame;
  let originalImage;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalImage = global.Image;
    window.requestAnimationFrame = (cb) => cb();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    global.Image = originalImage;
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('configures accessibility affordances and manages focus, gestures, and reduced motion updates', () => {
    jest.useFakeTimers();

    const mediaQueryLists = [];
    window.matchMedia = jest.fn().mockImplementation((query) => {
      const mediaQuery = {
        media: query,
        matches: true,
        addEventListener: jest.fn((event, handler) => {
          mediaQuery.listener = handler;
        }),
        removeEventListener: jest.fn(),
      };
      mediaQueryLists.push(mediaQuery);
      return mediaQuery;
    });

    class PassiveImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }

      set src(value) {
        this._src = value;
      }
    }
    global.Image = PassiveImage;

    const {
      renderer,
      overlay,
      closeButton,
      secondaryButton,
      focusLink,
      statusElement,
      imageElement,
      spinnerElement,
      triggerButton,
      logger,
      validatedEventDispatcher,
    } = buildRenderer();

    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('aria-labelledby')).toBe('portrait-modal-title');

    expect(spinnerElement.getAttribute('role')).toBe('status');
    expect(spinnerElement.getAttribute('aria-live')).toBe('polite');
    expect(spinnerElement.getAttribute('aria-label')).toBe('Loading portrait image');

    expect(closeButton.style.minWidth).toBe('44px');
    expect(closeButton.style.minHeight).toBe('44px');
    expect(overlay.style.border).toBe('1px solid transparent');

    const liveRegion = document.body.querySelector('.portrait-modal-announcer');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('role')).toBe('status');

    const dispatchedEvents = [];
    jest
      .spyOn(validatedEventDispatcher, 'dispatch')
      .mockImplementation((eventName, payload) => {
        dispatchedEvents.push({ eventName, payload });
      });

    renderer.showModal('/images/portrait-wide.jpg', 'Explorer', triggerButton);

    expect(statusElement.textContent).toBe('');
    expect(imageElement.alt).toBe('Portrait of Explorer');
    expect(overlay.classList.contains('fade-in')).toBe(false);

    jest.advanceTimersByTime(150);
    expect(liveRegion.textContent).toBe('Loading portrait image');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Announced to screen reader: Opened portrait modal for Explorer')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Announced to screen reader: Loading portrait image')
    );

    jest.advanceTimersByTime(1000);
    expect(liveRegion.textContent).toBe('');

    focusLink.focus();
    const forwardTab = new Event('keydown', { bubbles: true });
    Object.defineProperty(forwardTab, 'key', { value: 'Tab' });
    Object.defineProperty(forwardTab, 'shiftKey', { value: false });
    forwardTab.preventDefault = jest.fn();
    document.dispatchEvent(forwardTab);
    expect(forwardTab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    const backwardTab = new Event('keydown', { bubbles: true });
    Object.defineProperty(backwardTab, 'key', { value: 'Tab' });
    Object.defineProperty(backwardTab, 'shiftKey', { value: true });
    backwardTab.preventDefault = jest.fn();
    document.dispatchEvent(backwardTab);
    expect(backwardTab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(focusLink);

    secondaryButton.focus();
    const homeEvent = new Event('keydown', { bubbles: true });
    Object.defineProperty(homeEvent, 'key', { value: 'Home' });
    homeEvent.preventDefault = jest.fn();
    document.dispatchEvent(homeEvent);
    expect(homeEvent.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(closeButton);

    const endEvent = new Event('keydown', { bubbles: true });
    Object.defineProperty(endEvent, 'key', { value: 'End' });
    endEvent.preventDefault = jest.fn();
    document.dispatchEvent(endEvent);
    expect(endEvent.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(focusLink);

    triggerButton.remove();

    const hideSpy = jest.spyOn(renderer, 'hide');
    const touchStart = new Event('touchstart');
    touchStart.touches = [{ clientX: 5, clientY: 5 }];
    imageElement.dispatchEvent(touchStart);

    const touchEnd = new Event('touchend');
    touchEnd.changedTouches = [{ clientX: 10, clientY: 120 }];
    imageElement.dispatchEvent(touchEnd);

    expect(hideSpy).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Swipe down detected, closing modal')
    );

    jest.advanceTimersByTime(150);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not return focus to original element'),
      expect.any(Error)
    );

    jest.advanceTimersByTime(1000);

    expect(dispatchedEvents[0]).toEqual({
      eventName: 'core:portrait_modal_opened',
      payload: {
        portraitPath: '/images/portrait-wide.jpg',
        speakerName: 'Explorer',
      },
    });
    expect(dispatchedEvents[1]).toEqual({
      eventName: 'core:portrait_modal_closed',
      payload: {
        portraitPath: '/images/portrait-wide.jpg',
        speakerName: 'Explorer',
      },
    });

    const mediaQuery = mediaQueryLists[0];
    mediaQuery.matches = false;
    mediaQuery.listener?.({ matches: false });
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Reduced motion preference changed to: false')
    );

    const newTrigger = document.createElement('button');
    newTrigger.textContent = 'Reopen';
    document.body.appendChild(newTrigger);

    renderer.showModal('/images/portrait-wide.jpg', 'Explorer', newTrigger);
    expect(overlay.classList.contains('fade-in')).toBe(true);

    hideSpy.mockRestore();
    validatedEventDispatcher.dispatch.mockRestore();
    renderer.destroy();
  });

  it('handles portrait image loading success and error states with DOM collaborators', () => {
    jest.useFakeTimers();
    window.innerWidth = 1200;
    window.innerHeight = 800;
    window.matchMedia = undefined;

    const createdImages = [];
    class ControlledImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        createdImages.push(this);
      }

      set src(value) {
        this._src = value;
      }

      triggerLoad(width, height) {
        this.naturalWidth = width;
        this.naturalHeight = height;
        this.onload?.();
      }

      triggerError() {
        this.onerror?.();
      }
    }
    global.Image = ControlledImage;

    const {
      renderer,
      imageElement,
      spinnerElement,
      statusElement,
      triggerButton,
      logger,
      validatedEventDispatcher,
    } = buildRenderer();

    const originalDispatch = validatedEventDispatcher.dispatch.bind(
      validatedEventDispatcher
    );
    jest
      .spyOn(validatedEventDispatcher, 'dispatch')
      .mockImplementation((eventName, payload) => {
        if (
          eventName === 'core:portrait_modal_opened' &&
          payload.portraitPath === '/error-dispatch.jpg'
        ) {
          throw new Error('dispatch failure');
        }
        if (
          eventName === 'core:portrait_modal_closed' &&
          payload.portraitPath === '/error-dispatch.jpg'
        ) {
          throw new Error('close failure');
        }
        return originalDispatch(eventName, payload);
      });

    renderer.showModal('/portraits/wide.jpg', 'Explorer', triggerButton);
    expect(spinnerElement.style.display).toBe('block');

    createdImages[0].triggerLoad(2000, 1000);
    expect(spinnerElement.style.display).toBe('none');
    expect(spinnerElement.getAttribute('aria-hidden')).toBe('true');
    expect(imageElement.src).toContain('/portraits/wide.jpg');
    expect(imageElement.classList.contains('loaded')).toBe(true);
    expect(imageElement.style.width).toBe('1080px');
    expect(imageElement.style.height).toBe('auto');

    renderer.hide();
    expect(imageElement.style.width).toBe('');
    expect(imageElement.style.height).toBe('');

    renderer.showModal('/portraits/tall.jpg', 'Explorer', triggerButton);
    createdImages[1].triggerLoad(600, 1400);
    expect(imageElement.style.height).toBe('560px');
    expect(imageElement.style.width).toBe('auto');

    renderer.hide();

    renderer.showModal('/portraits/compact.jpg', 'Explorer', triggerButton);
    createdImages[2].triggerLoad(500, 400);
    expect(imageElement.style.width).toBe('500px');
    expect(imageElement.style.height).toBe('400px');

    renderer.hide();

    renderer.showModal('/error-path.jpg', 'Explorer', triggerButton);
    createdImages[3].triggerError();

    expect(spinnerElement.style.display).toBe('none');
    expect(statusElement.textContent).toBe('Failed to load portrait');
    expect(statusElement.classList.contains('status-message-error')).toBe(true);

    jest.advanceTimersByTime(150);
    const announcer = document.querySelector('[role="alert"]');
    expect(announcer).toBeTruthy();

    jest.advanceTimersByTime(3000);
    expect(document.querySelector('[role="alert"]')).toBeNull();

    renderer.hide();

    renderer.showModal('/error-dispatch.jpg', 'Explorer', triggerButton);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch core:portrait_modal_opened event'),
      expect.any(Error)
    );

    renderer.hide();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch core:portrait_modal_closed event'),
      expect.any(Error)
    );

    validatedEventDispatcher.dispatch.mockRestore();
    renderer.destroy();
  });

  it('warns when critical DOM elements are missing during initialization', () => {
    const { renderer, logger } = buildRenderer({
      includeImage: false,
      includeSpinner: false,
      includeStatus: false,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Modal image element not found.')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Loading spinner element not found.')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error message element not found.')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Modal image element not found, touch handlers not added')
    );

    renderer.destroy();
  });
});
