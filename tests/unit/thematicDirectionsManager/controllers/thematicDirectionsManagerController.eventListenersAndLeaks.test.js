/**
 * @file Additional unit tests for ThematicDirectionsManagerController
 * @description Provides comprehensive coverage for event listener wiring and leak detection flows.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

const mockPreviousItemsDropdown = {
  loadItems: jest.fn(),
  clear: jest.fn(),
  enable: jest.fn(),
  destroy: jest.fn(),
};

const inPlaceEditorInstances = [];

jest.mock(
  '../../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => ({
    PreviousItemsDropdown: jest
      .fn()
      .mockImplementation(() => mockPreviousItemsDropdown),
  })
);

jest.mock(
  '../../../../src/shared/characterBuilder/inPlaceEditor.js',
  () => ({
    InPlaceEditor: jest.fn().mockImplementation((options) => {
      const instance = {
        destroy: jest.fn(),
        options,
      };
      inPlaceEditorInstances.push(instance);
      return instance;
    }),
  })
);

describe('ThematicDirectionsManagerController - Event listeners and leak detection coverage', () => {
  let testBase;
  let controller;
  let originalEnv;
  let originalSetTimeout;

  /**
   * Adds all DOM nodes required for the scenarios in this suite.
   */
  const addRequiredDom = () => {
    testBase.addDOMElement(
      '<select id="concept-selector"><option value="">All Concepts</option><option value="concept-1">Concept 1</option></select>'
    );
    testBase.addDOMElement('<input id="direction-filter" />');
    testBase.addDOMElement('<div id="directions-results"></div>');
    testBase.addDOMElement('<button id="refresh-btn"></button>');
    testBase.addDOMElement('<button id="retry-btn"></button>');
    testBase.addDOMElement('<button id="cleanup-orphans-btn"></button>');
    testBase.addDOMElement('<button id="back-to-menu-btn"></button>');
    testBase.addDOMElement(
      '<div id="concept-display-container" style="display:none;"></div>'
    );
    testBase.addDOMElement('<div id="concept-display-content"></div>');
    testBase.addDOMElement(
      `
      <div id="confirmation-modal" class="modal" style="display:none;">
        <button id="modal-confirm-btn"></button>
        <button id="modal-cancel-btn"></button>
        <button id="close-modal-btn"></button>
      </div>
    `
    );
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    inPlaceEditorInstances.length = 0;
    originalEnv = process.env.NODE_ENV;
    originalSetTimeout = global.setTimeout;

    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    addRequiredDom();

    controller = new ThematicDirectionsManagerController(testBase.mocks);
    controller._cacheElements();
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    if (originalSetTimeout) {
      global.setTimeout = originalSetTimeout;
    }

    await testBase.cleanup();
    jest.restoreAllMocks();
  });

  const createDirectionsPayload = () => [
    {
      direction: {
        id: 'direction-1',
        title: 'A dramatic title',
        description: 'An extended thematic description that exceeds limits.',
        coreTension: 'Sustained conflict in the narrative arc.',
        uniqueTwist: 'A surprising spin introduced midway through the plot.',
        narrativePotential: 'Opens pathways for sequels and character growth.',
      },
      concept: {
        id: 'concept-1',
        concept: 'An overarching concept exploring resilience.',
        status: 'draft',
        createdAt: new Date().toISOString(),
        thematicDirections: [{ id: 'direction-1' }],
      },
    },
  ];

  it('wires all interactive event listeners and handles keyboard navigation', async () => {
    controller.refreshDropdown = jest.fn();
    const showAlertSpy = jest
      .spyOn(controller, '_showAlert')
      .mockImplementation(() => {});
    const modalConfirmSpy = jest
      .spyOn(controller, '_handleModalConfirm')
      .mockImplementation(() => {});
    const modalCancelSpy = jest
      .spyOn(controller, '_handleModalCancel')
      .mockImplementation(() => {});

    controller._setupEventListeners();

    // Trigger cleanup action
    document
      .getElementById('cleanup-orphans-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(showAlertSpy).toHaveBeenCalled();

    // Trigger refresh action
    document
      .getElementById('refresh-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(controller.refreshDropdown).toHaveBeenCalled();

    // Trigger retry action (ensures private loader path executes without errors)
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      []
    );
    document
      .getElementById('retry-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    // Trigger back navigation handler
    expect(() => {
      document
        .getElementById('back-to-menu-btn')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();

    // Trigger filter input handler
    const filterInput = document.getElementById('direction-filter');
    const focusSpy = jest.spyOn(filterInput, 'focus');
    filterInput.value = 'Mystery';
    document
      .getElementById('direction-filter')
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({
        properties: expect.objectContaining({
          action: 'filter',
          value: expect.objectContaining({ filterText: 'mystery' }),
        }),
      })
    );

    // Trigger modal confirmation and cancellation paths
    document
      .getElementById('modal-confirm-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modalConfirmSpy).toHaveBeenCalled();

    document
      .getElementById('modal-cancel-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modalCancelSpy).toHaveBeenCalledTimes(1);

    document
      .getElementById('close-modal-btn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modalCancelSpy).toHaveBeenCalledTimes(2);

    const modalElement = document.getElementById('confirmation-modal');
    const backdropClick = new Event('click', { bubbles: true });
    Object.defineProperty(backdropClick, 'target', {
      value: modalElement,
    });
    Object.defineProperty(backdropClick, 'currentTarget', {
      value: modalElement,
    });
    modalElement.dispatchEvent(backdropClick);
    expect(modalCancelSpy).toHaveBeenCalledTimes(3);

    // Trigger keyboard navigation on concept selector
    const conceptSelector = document.getElementById('concept-selector');
    conceptSelector.value = 'concept-1';
    const escapeEvent = new Event('keydown', { bubbles: true, cancelable: true });
    escapeEvent.key = 'Escape';
    escapeEvent.preventDefault = jest.fn();
    conceptSelector.dispatchEvent(escapeEvent);
    expect(escapeEvent.preventDefault).toHaveBeenCalled();

    // Trigger keyboard shortcut to focus filter
    const slashEvent = new Event('keydown', { bubbles: true, cancelable: true });
    slashEvent.key = '/';
    slashEvent.ctrlKey = true;
    conceptSelector.dispatchEvent(slashEvent);
    expect(focusSpy).toHaveBeenCalled();

    // Trigger confirm selection via keyboard
    conceptSelector.value = 'concept-1';
    const enterEvent = new Event('keydown', { bubbles: true });
    enterEvent.key = 'Enter';
    conceptSelector.dispatchEvent(enterEvent);

    // Trigger filter clearing via keyboard shortcut
    filterInput.value = 'detective story';
    const filterEscape = new Event('keydown', { bubbles: true, cancelable: true });
    filterEscape.key = 'Escape';
    filterEscape.preventDefault = jest.fn();
    filterInput.dispatchEvent(filterEscape);
    expect(filterEscape.preventDefault).toHaveBeenCalled();

    focusSpy.mockRestore();

    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({
        properties: expect.objectContaining({
          action: 'keyboard',
          value: expect.objectContaining({ action: 'clear_filter' }),
        }),
      })
    );
  });

  it('performs leak detection cleanup in production mode', async () => {
    process.env.NODE_ENV = 'production';
    mockPreviousItemsDropdown.loadItems.mockResolvedValue();
    const directions = createDirectionsPayload();
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      directions
    );

    controller._setupEventListeners();
    await controller._initializeAdditionalServices();
    await controller.refreshDropdown();

    controller._showSuccess('Saved successfully', 1000);
    controller._showConfirmationModal({
      title: 'Confirm',
      message: 'Proceed?',
      onConfirm: () => {},
    });

    const orphanedEditor = document.createElement('div');
    orphanedEditor.className = 'in-place-editor';
    document.body.appendChild(orphanedEditor);

    global.setTimeout = jest.fn((callback) => {
      callback();
      return 123;
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    controller._postDestroy();

    expect(mockPreviousItemsDropdown.destroy).toHaveBeenCalled();
    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ThematicDirectionsManagerController: Potential memory leaks detected'),
      expect.objectContaining({ leaks: expect.arrayContaining([expect.stringContaining('InPlaceEditor instances')]) })
    );
    expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Triggering automatic memory cleanup due to detected leaks')
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(inPlaceEditorInstances.length).toBeGreaterThan(0);
    inPlaceEditorInstances.forEach((instance) => {
      expect(instance.destroy).toHaveBeenCalled();
    });
  });

  it('reports leaks verbosely in development mode', async () => {
    process.env.NODE_ENV = 'development';
    mockPreviousItemsDropdown.loadItems.mockResolvedValue();
    const directions = createDirectionsPayload();
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      directions
    );

    await controller._initializeAdditionalServices();
    await controller.refreshDropdown();

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    controller._postDestroy();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Potential memory leaks detected:',
      expect.arrayContaining([expect.stringContaining('InPlaceEditor instances')])
    );
    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ThematicDirectionsManagerController: Potential memory leaks detected'),
      expect.objectContaining({ leaks: expect.arrayContaining([expect.stringContaining('InPlaceEditor instances')]) })
    );
    expect(testBase.mocks.logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Triggering automatic memory cleanup due to detected leaks')
    );
  });
});
