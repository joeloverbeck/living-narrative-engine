/**
 * @file Focused event bus and initialization error handling tests
 * @description Exercises edge cases in BaseCharacterBuilderController that previously lacked coverage.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  BaseCharacterBuilderController,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

/**
 * Concrete controller used for exercising protected helper methods in tests.
 */
class TestableController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.showErrorMock = jest.fn();
    this.showStateMock = jest.fn();
    this.initializationErrorHook = jest
      .fn()
      .mockResolvedValue(undefined);
  }

  _cacheElements() {}

  _setupEventListeners() {}

  _showError(message) {
    this.showErrorMock(message);
  }

  _showState(state, payload) {
    this.showStateMock(state, payload);
  }

  async _onInitializationError(error) {
    return this.initializationErrorHook(error);
  }
}

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockCharacterBuilderService = () => ({
  initialize: jest.fn(),
  getAllCharacterConcepts: jest.fn(),
  createCharacterConcept: jest.fn(),
  updateCharacterConcept: jest.fn(),
  deleteCharacterConcept: jest.fn(),
  getCharacterConcept: jest.fn(),
  generateThematicDirections: jest.fn(),
  getThematicDirections: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
});

describe('BaseCharacterBuilderController event bus lifecycle', () => {
  let logger;
  let characterBuilderService;
  let schemaValidator;
  let eventBus;
  let controller;
  let unsubscribeMap;
  let failingEventType;

  beforeEach(() => {
    logger = createMockLogger();
    characterBuilderService = createMockCharacterBuilderService();
    schemaValidator = createMockSchemaValidator();
    unsubscribeMap = new Map();
    failingEventType = null;

    eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType) => {
        const unsubscribe = jest.fn(() => {
          if (eventType === failingEventType) {
            throw new Error('unsubscribe failure');
          }
        });
        unsubscribeMap.set(eventType, unsubscribe);
        return unsubscribe;
      }),
      unsubscribe: jest.fn(),
    };

    controller = new TestableController({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
    });

    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detaches event bus listeners while preserving DOM listeners and logging errors', () => {
    const domElement = document.createElement('button');
    document.body.appendChild(domElement);
    const domHandler = jest.fn();

    controller._addEventListener(domElement, 'click', domHandler);

    controller._subscribeToEvent('SUCCESS_EVENT', () => {});
    failingEventType = 'FAIL_EVENT';
    controller._subscribeToEvent('FAIL_EVENT', () => {});

    const initialStats = controller._getEventListenerStats();
    expect(initialStats.dom).toBe(1);
    expect(initialStats.eventBus).toBe(2);

    controller._detachEventBus();

    expect(controller.eventBus).toBeNull();

    expect(unsubscribeMap.get('SUCCESS_EVENT')).toHaveBeenCalledTimes(1);
    expect(unsubscribeMap.get('FAIL_EVENT')).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `${controller.constructor.name}: Error detaching event bus listener`,
      expect.objectContaining({ message: 'unsubscribe failure' })
    );

    const detachLogMessage = logger.debug.mock.calls
      .map(([message]) => message)
      .find((message) =>
        message.includes('Detached from event bus after unsubscribing')
      );
    expect(detachLogMessage).toBeDefined();
    expect(detachLogMessage).toContain(
      'Detached from event bus after unsubscribing 1 listener(s)'
    );

    const postStats = controller._getEventListenerStats();
    expect(postStats.eventBus).toBe(0);
    expect(postStats.dom).toBe(1);
    expect(postStats.total).toBe(1);

    logger.debug.mockClear();
    controller._detachEventBus();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('surfaces initialization failures to the UI, event bus, and subclass hook', async () => {
    const error = new Error('Initialization failure');
    error.phase = 'loading';

    await controller._handleInitializationError(error);

    expect(controller.showErrorMock).toHaveBeenCalledWith(
      'Failed to initialize page. Please refresh and try again.'
    );

    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      'SYSTEM_ERROR_OCCURRED',
      expect.objectContaining({
        error: 'Initialization failure',
        context: `${controller.constructor.name} initialization`,
        phase: 'loading',
        stack: error.stack,
        timestamp: expect.any(String),
      })
    );

    expect(controller.initializationErrorHook).toHaveBeenCalledTimes(1);
    expect(controller.initializationErrorHook).toHaveBeenCalledWith(error);
  });
});
