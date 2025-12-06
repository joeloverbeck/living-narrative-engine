import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  FormValidationHelper,
  ValidationPatterns,
} from '../../../src/shared/characterBuilder/formValidationHelper.js';
import { UI_STATES } from '../../../src/shared/characterBuilder/uiStateManager.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_CONFIRM = global.confirm;

let controllerTestContainer;

beforeAll(async () => {
  controllerTestContainer = await createTestContainer();
});

const getControllerSupportDependencies = () => {
  if (!controllerTestContainer) {
    throw new Error('Test container not initialized');
  }

  const { schemaValidator: _unused, ...supportDeps } =
    resolveControllerDependencies(controllerTestContainer);

  return supportDeps;
};

const createDependencySet = () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const eventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const characterBuilderService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn(),
    updateCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    getThematicDirections: jest.fn(),
    getCharacterConcept: jest.fn(),
    generateThematicDirections: jest.fn(),
  };

  const schemaValidator = {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    validateAgainstSchema: jest
      .fn()
      .mockReturnValue({ isValid: true, errors: [] }),
    addSchema: jest.fn(),
    removeSchema: jest.fn(),
    listSchemas: jest.fn().mockReturnValue([]),
    getSchema: jest.fn().mockReturnValue(null),
  };

  const controllerDeps = getControllerSupportDependencies();

  return {
    logger,
    eventBus,
    characterBuilderService,
    schemaValidator,
    controllerDeps,
  };
};

describe('CharacterConceptsManagerController constructor coverage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps missing logger dependency errors', () => {
    const {
      characterBuilderService,
      eventBus,
      schemaValidator,
      controllerDeps,
    } = createDependencySet();

    expect(
      () =>
        new CharacterConceptsManagerController({
          characterBuilderService,
          eventBus,
          schemaValidator,
          ...controllerDeps,
        })
    ).toThrow('Missing required dependency: ILogger');
  });

  it('maps missing character builder service dependency errors', () => {
    const { logger, eventBus, schemaValidator, controllerDeps } =
      createDependencySet();

    expect(
      () =>
        new CharacterConceptsManagerController({
          logger,
          eventBus,
          schemaValidator,
          ...controllerDeps,
        })
    ).toThrow('Missing required dependency: CharacterBuilderService');
  });

  it('maps missing event bus dependency errors', () => {
    const { logger, characterBuilderService, schemaValidator, controllerDeps } =
      createDependencySet();

    expect(
      () =>
        new CharacterConceptsManagerController({
          logger,
          characterBuilderService,
          schemaValidator,
          ...controllerDeps,
        })
    ).toThrow('Missing required dependency: ISafeEventDispatcher');
  });

  it('provides fallbacks for missing schema validator', () => {
    const { logger, characterBuilderService, eventBus, controllerDeps } =
      createDependencySet();

    const controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
      ...controllerDeps,
    });

    expect(controller.schemaValidator.validate()).toEqual({
      isValid: true,
      errors: [],
    });
    expect(
      controller.schemaValidator.validateAgainstSchema('concept', {})
    ).toEqual({ isValid: true, errors: [] });
  });

  it('adds backward compatible service methods when missing', async () => {
    const { logger, eventBus, schemaValidator, controllerDeps } =
      createDependencySet();
    const incompleteService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    const controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService: incompleteService,
      eventBus,
      schemaValidator,
      ...controllerDeps,
    });

    await expect(
      controller.characterBuilderService.getCharacterConcept('id-1')
    ).resolves.toBeNull();
    await expect(
      controller.characterBuilderService.generateThematicDirections('id-1')
    ).resolves.toEqual([]);
  });
});

describe('CharacterConceptsManagerController additional coverage', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    sessionStorage.clear();
    process.env.NODE_ENV = ORIGINAL_ENV;
    global.confirm = ORIGINAL_CONFIRM;
    await testBase.cleanup();
  });

  it('navigates to the menu by updating window.location', () => {
    try {
      controller._navigateToMenu();
    } catch (error) {
      expect(error.message).toContain('Not implemented');
    }
  });

  it('validates the concept form using FormValidationHelper', () => {
    const conceptText = controller._getElement('conceptText');
    const result = controller._validateConceptForm();

    expect(FormValidationHelper.validateField).toHaveBeenCalledWith(
      conceptText,
      ValidationPatterns.concept,
      'Concept'
    );
    expect(result).toBe(true);
  });

  it('sets up concept form validation with cloned textarea and listeners', () => {
    const conceptText = controller._getElement('conceptText');
    if (!conceptText.parentNode) {
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      wrapper.appendChild(conceptText);
    }

    controller._setupConceptFormValidation();

    expect(FormValidationHelper.setupRealTimeValidation).toHaveBeenCalledWith(
      controller._getElement('conceptText'),
      ValidationPatterns.concept,
      {
        debounceMs: 300,
        countElement: controller._getElement('charCount'),
        maxLength: 6000,
      }
    );

    const updatedTextarea = controller._getElement('conceptText');
    const saveButton = controller._getElement('saveConceptBtn');
    updatedTextarea.dispatchEvent(new Event('input'));

    expect(FormValidationHelper.updateCharacterCount).toHaveBeenCalledWith(
      updatedTextarea,
      controller._getElement('charCount'),
      6000
    );
    expect(saveButton.disabled).toBe(false);
  });

  it('resets the concept form and clears validation state', () => {
    const conceptForm = controller._getElement('conceptForm');
    const conceptText = controller._getElement('conceptText');
    const saveButton = controller._getElement('saveConceptBtn');
    saveButton.disabled = false;
    controller._testExports.searchFilter = 'query';

    controller._resetConceptForm();

    expect(conceptForm.reset).toHaveBeenCalled();
    expect(controller._getElement('charCount').textContent).toBe('0/6000');
    expect(FormValidationHelper.clearFieldError).toHaveBeenCalledWith(
      conceptText
    );
    expect(saveButton.disabled).toBe(true);
    expect(controller._testExports.searchFilter).toBe('query');
  });

  it('animates modals across success, fallback, and error paths', () => {
    const modal = controller._getElement('conceptModal');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const animation = {
      playState: 'running',
      cancel: jest.fn(),
      addEventListener: jest.fn((event, handler) => {
        if (event === 'finish') {
          handler();
        }
      }),
    };
    const cleanupSpy = jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation(() => {});

    modal.animate = jest.fn(() => animation);
    controller._animateModalEntrance(modal);
    expect(modal.animate).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalledWith(
      expect.any(Function),
      'Modal entrance animation cleanup'
    );

    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 1;
      });
    modal.animate = undefined;
    controller._animateModalEntrance(modal);
    expect(rafSpy).toHaveBeenCalled();

    const warnSpy = jest.spyOn(controller.logger, 'warn');
    modal.animate = jest.fn(() => {
      throw new Error('boom');
    });
    controller._animateModalEntrance(modal);
    expect(warnSpy).toHaveBeenCalledWith(
      'Modal animation failed, showing without animation',
      expect.any(Error)
    );

    process.env.NODE_ENV = 'production';
    modal.animate = jest.fn(() => animation);
    controller._animateModalExit(modal, jest.fn());
    expect(modal.animate).toHaveBeenCalled();

    modal.animate = undefined;
    controller._animateModalExit(modal, jest.fn());
    modal.animate = jest.fn(() => {
      throw new Error('exit');
    });
    controller._animateModalExit(modal, jest.fn());
    expect(warnSpy).toHaveBeenCalledWith(
      'Modal exit animation failed',
      expect.any(Error)
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('creates concept cards and wires event handlers', () => {
    const concept = testBase.createTestConcept({
      id: 'card-1',
      concept: 'Mystic hero',
      createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const conceptData = { concept, directionCount: 2 };

    const displaySpy = jest
      .spyOn(controller, '_getDisplayText')
      .mockReturnValue(concept.concept);
    const editSpy = jest
      .spyOn(controller, '_showEditModal')
      .mockResolvedValue();
    const deleteSpy = jest
      .spyOn(controller, '_showDeleteConfirmation')
      .mockImplementation(() => {});
    const viewSpy = jest
      .spyOn(controller, '_viewThematicDirections')
      .mockImplementation(() => {});
    const detailsSpy = jest
      .spyOn(controller, '_viewConceptDetails')
      .mockImplementation(() => {});
    const menuSpy = jest
      .spyOn(controller, '_showConceptMenu')
      .mockImplementation(() => {});

    const card = controller._createConceptCard(concept, 2, 0);
    expect(displaySpy).toHaveBeenCalledWith(concept, 150);

    controller._getElement('conceptsResults').appendChild(card);
    card.click();
    expect(detailsSpy).toHaveBeenCalledWith(concept);

    card.querySelector('[data-action="edit"]').click();
    expect(editSpy).toHaveBeenCalledWith('card-1');
    card.querySelector('[data-action="delete"]').click();
    expect(deleteSpy).toHaveBeenCalledWith(concept, 2);
    card.querySelector('[data-action="view-directions"]').click();
    expect(viewSpy).toHaveBeenCalledWith('card-1');
    card.querySelector('.concept-menu-btn').click();
    expect(menuSpy).toHaveBeenCalledWith(concept, expect.any(HTMLElement));

    controller._testExports.conceptsData = [conceptData];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 1;
      });
    const cardSpy = jest.spyOn(controller, '_createConceptCard');
    controller._displayConcepts([conceptData]);
    expect(cardSpy).toHaveBeenCalledWith(concept, 2, 0);
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    cardSpy.mockRestore();
  });

  it('calculates statistics and updates advanced insights', () => {
    let statsDisplay = document.querySelector('.stats-display');
    if (!statsDisplay) {
      statsDisplay = document.createElement('div');
      statsDisplay.className = 'stats-display';
      document.body.appendChild(statsDisplay);
      controller._cacheElements();
    }

    const concepts = [
      {
        concept: testBase.createTestConcept({
          id: 'stat-1',
          concept: 'First',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        directionCount: 0,
      },
      {
        concept: testBase.createTestConcept({
          id: 'stat-2',
          concept: 'Second',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        directionCount: 3,
      },
    ];
    controller._testExports.conceptsData = concepts;

    const stats = controller._calculateStatistics();
    expect(stats.totalConcepts).toBe(2);
    expect(stats.conceptsWithDirections).toBe(1);
    expect(stats.totalDirections).toBe(3);

    const element = controller._getElement('totalConcepts');
    element.textContent = '0';
    controller._animateStatValue(element, 5);
    jest.advanceTimersByTime(600);
    expect(element.textContent).toBe('5');

    const updateSpy = jest.spyOn(controller, '_updateAdvancedStatValue');
    controller._updateAdvancedStatistics(stats);
    expect(updateSpy).toHaveBeenCalledWith(
      'completion-rate',
      `${stats.completionRate}%`
    );
    updateSpy.mockRestore();
  });

  it('loads concepts data and handles direction fetch failures gracefully', async () => {
    const conceptA = testBase.createTestConcept({ id: 'concept-a' });
    const conceptB = testBase.createTestConcept({ id: 'concept-b' });
    const { characterBuilderService, logger } = testBase.mocks;
    characterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      conceptA,
      conceptB,
    ]);
    characterBuilderService.getThematicDirections.mockImplementation((id) => {
      if (id === 'concept-a') {
        return Promise.resolve([testBase.createTestDirection({ id: 'dir-1' })]);
      }
      return Promise.reject(new Error('Directions failed'));
    });

    const execSpy = jest
      .spyOn(controller, '_executeWithErrorHandling')
      .mockImplementation((fn) => fn());
    const filterSpy = jest
      .spyOn(controller, '_filterConcepts')
      .mockImplementation((data) => data);
    const displaySpy = jest
      .spyOn(controller, '_displayConcepts')
      .mockImplementation(() => {});
    const statsSpy = jest
      .spyOn(controller, '_updateStatistics')
      .mockImplementation(() => {});
    const updateSearchSpy = jest
      .spyOn(controller, '_updateSearchState')
      .mockImplementation(() => {});

    controller._testExports.searchStateRestored = true;
    controller._getElement('conceptSearch').value = 'arcane';

    await controller._loadConceptsData();

    expect(filterSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ concept: conceptA, directionCount: 1 }),
        expect.objectContaining({ concept: conceptB, directionCount: 0 }),
      ])
    );
    expect(displaySpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ concept: conceptA, directionCount: 1 }),
        expect.objectContaining({ concept: conceptB, directionCount: 0 }),
      ])
    );
    expect(statsSpy).toHaveBeenCalled();
    expect(updateSearchSpy).toHaveBeenCalledWith('arcane', 2);
    expect(controller._testExports.conceptsData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ concept: conceptA, directionCount: 1 }),
        expect.objectContaining({ concept: conceptB, directionCount: 0 }),
      ])
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to get directions for concept concept-b',
      expect.any(Error)
    );
    expect(controller._testExports.searchStateRestored).toBe(false);

    execSpy.mockRestore();
    filterSpy.mockRestore();
    displaySpy.mockRestore();
    statsSpy.mockRestore();
    updateSearchSpy.mockRestore();
  });

  it('initializes cross-tab synchronization and registers cleanup', () => {
    const originalBroadcastChannel = global.BroadcastChannel;
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const close = jest.fn();
    const postMessage = jest.fn();
    const channelInstance = {
      addEventListener,
      removeEventListener,
      close,
      postMessage,
    };
    global.BroadcastChannel = jest.fn(() => channelInstance);

    const cleanupSpy = jest.spyOn(controller, '_registerCleanupTask');
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    const leaderSpy = jest
      .spyOn(controller, '_performLeaderElection')
      .mockImplementation(() => {});

    controller._initializeCrossTabSync();

    expect(global.BroadcastChannel).toHaveBeenCalledWith(
      'character-concepts-manager'
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    expect(cleanupSpy).toHaveBeenCalledWith(
      expect.any(Function),
      'Cross-tab synchronization cleanup'
    );
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tab-opened' })
    );
    expect(leaderSpy).toHaveBeenCalled();

    // Execute cleanup task
    cleanupSpy.mock.calls[0][0]();
    expect(removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    expect(close).toHaveBeenCalled();

    global.BroadcastChannel = originalBroadcastChannel;
    cleanupSpy.mockRestore();
    broadcastSpy.mockRestore();
    leaderSpy.mockRestore();
  });

  it('handles missing BroadcastChannel support gracefully', () => {
    const originalBroadcastChannel = global.BroadcastChannel;
    global.BroadcastChannel = jest.fn(() => {
      throw new Error('unsupported');
    });

    controller._initializeCrossTabSync();

    expect(controller.logger.warn).toHaveBeenCalledWith(
      'BroadcastChannel not supported, cross-tab sync disabled',
      expect.any(Error)
    );

    global.BroadcastChannel = originalBroadcastChannel;
  });

  it('processes cross-tab messages for coordination scenarios', () => {
    const leaderSpy = jest
      .spyOn(controller, '_performLeaderElection')
      .mockImplementation(() => {});
    const remoteSpy = jest
      .spyOn(controller, '_handleRemoteDataChange')
      .mockImplementation(() => {});
    const warnSpy = controller.logger.warn;

    const freshTimestamp = Date.now();
    controller._handleCrossTabMessage({
      type: 'tab-opened',
      timestamp: freshTimestamp,
    });
    controller._handleCrossTabMessage({
      type: 'tab-closed',
      wasLeader: true,
      timestamp: freshTimestamp,
    });
    controller._handleCrossTabMessage({
      type: 'data-changed',
      changeType: 'updated',
      data: { id: '1' },
      tabId: 'different-tab',
      timestamp: freshTimestamp,
    });
    controller._handleCrossTabMessage({
      type: 'leader-elected',
      tabId: 'some-tab',
      timestamp: freshTimestamp,
    });
    controller._handleCrossTabMessage({
      type: 'unknown',
      timestamp: freshTimestamp,
    });

    // Old message ignored
    controller._handleCrossTabMessage({
      type: 'tab-opened',
      timestamp: Date.now() - 60000,
    });

    expect(leaderSpy).toHaveBeenCalledTimes(2);
    expect(remoteSpy).toHaveBeenCalledWith('updated', { id: '1' });
    expect(warnSpy).toHaveBeenCalledWith('Unknown cross-tab message type', {
      type: 'unknown',
    });

    leaderSpy.mockRestore();
    remoteSpy.mockRestore();
  });

  it('broadcasts messages with metadata and logs failures', () => {
    const originalBroadcastChannel = global.BroadcastChannel;
    const postMessage = jest.fn();
    const channelInstance = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
      postMessage,
    };
    global.BroadcastChannel = jest.fn(() => channelInstance);

    controller._initializeCrossTabSync();

    postMessage.mockClear();
    controller._broadcastMessage({ type: 'ping' });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ping', tabId: expect.any(String) })
    );

    postMessage.mockImplementation(() => {
      throw new Error('post-failed');
    });
    controller._broadcastMessage({ type: 'pong' });
    expect(controller.logger.error).toHaveBeenCalledWith(
      'Failed to broadcast message',
      expect.any(Error),
      expect.objectContaining({ type: 'pong' })
    );

    controller.destroy();
    global.BroadcastChannel = originalBroadcastChannel;
  });

  it('debounces remote data changes before reloading concepts', () => {
    const loadSpy = jest
      .spyOn(controller, '_loadConceptsData')
      .mockImplementation(() => {});

    controller._handleRemoteDataChange('updated', {});
    controller._handleRemoteDataChange('updated', {});

    jest.advanceTimersByTime(499);
    expect(loadSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2);
    expect(loadSpy).toHaveBeenCalledTimes(1);

    loadSpy.mockRestore();
  });

  it('performs leader election and schedules heartbeat broadcasts', () => {
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    const setIntervalSpy = jest
      .spyOn(controller, '_setInterval')
      .mockReturnValue(123);
    const clearIntervalSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});

    controller._performLeaderElection();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leader-elected' })
    );
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

    controller._performLeaderElection();
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);

    broadcastSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('animates directions generation with status transitions', () => {
    const originalGetElement = controller._getElement.bind(controller);
    const countElement = { textContent: '0' };
    const statusElement = {
      classList: { remove: jest.fn(), add: jest.fn() },
      textContent: 'No Directions',
    };
    const card = {
      classList: { add: jest.fn(), remove: jest.fn() },
      querySelector: jest.fn((selector) => {
        if (selector === '.direction-count strong') return countElement;
        if (selector === '.concept-status') return statusElement;
        return null;
      }),
    };
    const results = {
      querySelector: jest.fn(() => card),
    };
    const animateSpy = jest
      .spyOn(controller, '_animateNumberChange')
      .mockImplementation(() => {});

    controller._getElement = jest.fn((key) => {
      if (key === 'conceptsResults') {
        return results;
      }
      return originalGetElement(key);
    });

    controller._animateDirectionsGenerated('concept-1', 0, 3);

    expect(results.querySelector).toHaveBeenCalledWith(
      '[data-concept-id="concept-1"]'
    );
    expect(card.classList.add).toHaveBeenCalledWith('directions-generated');
    expect(animateSpy).toHaveBeenCalledWith(countElement, 0, 3);
    expect(statusElement.classList.remove).toHaveBeenCalledWith('draft');
    expect(statusElement.classList.add).toHaveBeenCalledWith('completed');
    expect(statusElement.textContent).toBe('Has Directions');

    jest.advanceTimersByTime(1000);
    expect(card.classList.remove).toHaveBeenCalledWith('directions-generated');

    animateSpy.mockRestore();
    controller._getElement = originalGetElement;
  });

  it('animates number changes using timed intervals', () => {
    const element = document.createElement('span');
    controller._animateNumberChange(element, 0, 5);

    jest.advanceTimersByTime(500);
    expect(element.textContent).toBe('5');
  });

  it('cleans up animation intervals registered on elements', () => {
    const clearSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});
    const animatedElement = document.createElement('div');
    animatedElement.setAttribute('data-animation', 'pulse');
    animatedElement.animationInterval = 456;
    document.body.appendChild(animatedElement);

    controller._cleanupAnimations();

    expect(clearSpy).toHaveBeenCalledWith(456);
    animatedElement.remove();
    clearSpy.mockRestore();
  });

  it('handles directions generated events for cached concepts', () => {
    const concept = testBase.createTestConcept({ id: 'concept-xyz' });
    controller._testExports.conceptsData = [{ concept, directionCount: 0 }];

    jest.spyOn(controller, '_isConceptVisible').mockReturnValue(true);
    const updateCardSpy = jest
      .spyOn(controller, '_updateConceptCard')
      .mockImplementation(() => {});
    const animateSpy = jest
      .spyOn(controller, '_animateDirectionsGenerated')
      .mockImplementation(() => {});
    const statsSpy = jest
      .spyOn(controller, '_updateStatistics')
      .mockImplementation(() => {});
    const milestoneSpy = jest
      .spyOn(controller, '_checkMilestones')
      .mockImplementation(() => {});
    const notificationSpy = jest
      .spyOn(controller, '_showNotification')
      .mockImplementation(() => {});
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastDataChange')
      .mockImplementation(() => {});

    controller._handleDirectionsGenerated({
      payload: { conceptId: 'concept-xyz', directions: [{}, {}] },
    });

    expect(controller._testExports.conceptsData[0].directionCount).toBe(2);
    expect(updateCardSpy).toHaveBeenCalledWith(concept, 2);
    expect(animateSpy).toHaveBeenCalledWith('concept-xyz', 0, 2);
    expect(statsSpy).toHaveBeenCalled();
    expect(milestoneSpy).toHaveBeenCalledWith('directions-added');
    expect(notificationSpy).toHaveBeenCalledWith(
      '✨ 2 thematic directions generated',
      'success'
    );
    expect(broadcastSpy).toHaveBeenCalledWith('directions-generated', {
      conceptId: 'concept-xyz',
      directionCount: 2,
    });

    updateCardSpy.mockRestore();
    animateSpy.mockRestore();
    statsSpy.mockRestore();
    milestoneSpy.mockRestore();
    notificationSpy.mockRestore();
    broadcastSpy.mockRestore();
  });

  it('logs a warning when directions are generated for unknown concepts', () => {
    controller._testExports.conceptsData = [];
    controller.logger.warn.mockClear();

    controller._handleDirectionsGenerated({
      payload: { conceptId: 'missing', directions: [] },
    });

    expect(controller.logger.warn).toHaveBeenCalledWith(
      'Concept not found for directions update',
      { conceptId: 'missing' }
    );
  });

  it('shows creation and deletion feedback notifications', () => {
    const originalGetElement = controller._getElement.bind(controller);
    const card = {
      classList: { add: jest.fn(), remove: jest.fn() },
      scrollIntoView: jest.fn(),
    };
    const results = {
      querySelector: jest.fn(() => card),
    };
    const notificationSpy = jest
      .spyOn(controller, '_showNotification')
      .mockImplementation(() => {});

    controller._getElement = jest.fn((key) => {
      if (key === 'conceptsResults') {
        return results;
      }
      return originalGetElement(key);
    });

    controller._showConceptCreatedFeedback({ id: 'concept-1' });
    jest.advanceTimersByTime(100);
    expect(card.classList.add).toHaveBeenCalledWith('concept-new');
    expect(card.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
    jest.advanceTimersByTime(2000);
    expect(card.classList.remove).toHaveBeenCalledWith('concept-new');
    expect(notificationSpy).toHaveBeenCalledWith(
      '✅ Character concept created successfully',
      'success'
    );

    controller._showConceptDeletedFeedback(3);
    controller._showConceptDeletedFeedback(0);
    expect(notificationSpy).toHaveBeenCalledWith(
      '🗑️ Character concept deleted (3 directions also removed)',
      'info'
    );
    expect(notificationSpy).toHaveBeenCalledWith(
      '🗑️ Character concept deleted',
      'info'
    );

    controller._getElement = originalGetElement;
    notificationSpy.mockRestore();
  });

  it('executes delete handler when confirming deletion', () => {
    const handler = jest.fn();
    controller._testExports.deleteHandler = handler;

    controller._confirmDelete();
    expect(handler).toHaveBeenCalledTimes(1);

    controller._testExports.deleteHandler = null;
    controller._confirmDelete();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('exports statistics and converts to CSV', () => {
    controller._testExports.conceptsData = [
      {
        concept: testBase.createTestConcept({
          id: 'exp',
          concept: 'Exportable',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        directionCount: 1,
      },
    ];

    const createObjectURLSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:url');
    const revokeSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click');

    controller._exportStatistics('json');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    const csv = controller._convertToCSV({
      exportDate: 'today',
      statistics: {
        totalConcepts: 1,
        conceptsWithDirections: 1,
        totalDirections: 1,
        averageDirectionsPerConcept: 1,
        completionRate: 100,
        maxDirections: 1,
      },
    });
    expect(csv).toContain('"Total Concepts","1"');

    revokeSpy.mockRestore();
  });

  it('formats text and dates safely', () => {
    expect(controller._escapeHtml('<p>')).toBe('&lt;p&gt;');
    expect(controller._truncateText('short', 10)).toBe('short');
    expect(
      controller._truncateText('This sentence is intentionally long.', 10)
    ).toContain('...');

    const baseNow = new Date('2024-01-01T00:10:00Z');
    const originalNow = Date.now();
    jest.setSystemTime(baseNow);
    expect(controller._formatRelativeDate('2024-01-01T00:09:30Z')).toBe(
      'just now'
    );
    expect(controller._formatRelativeDate('2024-01-01T00:05:00Z')).toBe(
      '5 minutes ago'
    );
    expect(controller._formatRelativeDate('2024-01-01T00:00:00Z')).toBe(
      '10 minutes ago'
    );
    expect(controller._formatRelativeDate('2023-12-30T00:00:00Z')).toBe(
      '2 days ago'
    );
    jest.setSystemTime(originalNow);

    expect(controller._formatFullDate('2024-01-01T00:00:00Z')).toContain(
      '2024'
    );
  });

  it('renders empty states and clears search filters', () => {
    controller._testExports.searchFilter = 'hero';
    controller._showEmptyState();
    const clearBtn = document.getElementById('clear-search-btn');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    expect(controller._testExports.searchFilter).toBe('');

    controller._testExports.searchFilter = '';
    controller._showEmptyState();
    const createBtn = document.getElementById('create-first-btn');
    expect(createBtn).toBeTruthy();
  });

  it('manages delete confirmation flows and error recovery', async () => {
    const concept = testBase.createTestConcept({
      id: 'delete',
      concept: 'Delete concept',
    });

    const deleteModal = controller._getElement('deleteModal');
    deleteModal.animate = jest.fn(() => ({
      addEventListener: jest.fn((event, handler) => {
        if (event === 'finish') {
          handler();
        }
      }),
    }));

    const deleteConceptSpy = jest
      .spyOn(controller, '_deleteConcept')
      .mockResolvedValue();

    document.body.appendChild(controller._getElement('deleteModalMessage'));
    controller._showDeleteConfirmation(concept, 2);
    const handler = controller._testExports.deleteHandler;
    expect(typeof handler).toBe('function');

    await handler();
    expect(deleteConceptSpy).toHaveBeenCalledWith(concept.id, 2);

    deleteConceptSpy.mockRejectedValueOnce(new Error('fail'));
    controller._testExports.conceptToDelete = { concept, directionCount: 2 };
    const errorSpy = jest.spyOn(controller.logger, 'error');
    await handler();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to delete concept',
      expect.any(Error)
    );

    controller._setDeleteModalEnabled(false);
    expect(controller._getElement('confirmDeleteBtn').disabled).toBe(true);
    controller._setDeleteModalEnabled(true);

    controller._setFormEnabled(false);
    expect(controller._getElement('conceptText').disabled).toBe(true);
    controller._setFormEnabled(true);

    controller._setSaveButtonLoading(true);
    expect(controller._getElement('saveConceptBtn').textContent).toBe(
      'Saving...'
    );
    controller._setSaveButtonLoading(false);

    const formErrorSpy = jest.spyOn(FormValidationHelper, 'showFieldError');
    controller._showFormError('error');
    expect(formErrorSpy).toHaveBeenCalledWith(
      controller._getElement('conceptText'),
      'error'
    );

    const successSpy = jest.spyOn(controller.logger, 'info');
    controller._showSuccessNotification('success');
    expect(successSpy).toHaveBeenCalledWith('success');
  });

  it('handles create and edit modal lifecycle with validation', async () => {
    const modal = controller._getElement('conceptModal');
    modal.animate = jest.fn(() => ({
      addEventListener: jest.fn((event, handler) => {
        if (event === 'finish') {
          handler();
        }
      }),
    }));

    controller._showCreateModal();

    const concept = testBase.createTestConcept({
      id: 'edit-1',
      concept: 'Original concept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    controller._testExports.conceptsData = [{ concept, directionCount: 1 }];

    await controller._showEditModal('edit-1');
    const conceptText = controller._getElement('conceptText');
    conceptText.value = 'Modified concept text';
    conceptText.dispatchEvent(new window.Event('input', { bubbles: true }));
    controller._trackFormChanges();
    expect(
      controller._getElement('saveConceptBtn').classList.contains('has-changes')
    ).toBe(true);

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    controller._closeConceptModal();
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('loads concept data and handles direction errors', async () => {
    const loadConcept = testBase.createTestConcept({
      id: 'load-1',
      concept: 'Load concept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
      [loadConcept]
    );
    testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
      [testBase.createTestDirection()]
    );
    const displaySpy = jest
      .spyOn(controller, '_displayConcepts')
      .mockImplementation(() => {});
    const statsSpy = jest
      .spyOn(controller, '_updateStatistics')
      .mockImplementation(() => {});

    await controller._loadConceptsData();
    expect(displaySpy).toHaveBeenCalled();
    expect(statsSpy).toHaveBeenCalled();
    expect(controller._testExports.conceptsData[0].directionCount).toBe(1);

    displaySpy.mockRestore();
    statsSpy.mockRestore();

    testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
      [{ ...loadConcept, id: 'load-2' }]
    );
    testBase.mocks.characterBuilderService.getThematicDirections.mockRejectedValueOnce(
      new Error('fail')
    );
    await controller._loadConceptsData();
    expect(controller._testExports.conceptsData[0].directionCount).toBe(0);
  });

  it('handles search persistence and analytics updates', () => {
    const conceptA = testBase.createTestConcept({
      id: 'search-1',
      concept: 'Heroic tale',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const conceptB = testBase.createTestConcept({
      id: 'search-2',
      concept: 'Villain saga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    controller._testExports.conceptsData = [
      { concept: conceptA, directionCount: 2 },
      { concept: conceptB, directionCount: 0 },
    ];

    const displaySpy = jest
      .spyOn(controller, '_displayFilteredConcepts')
      .mockImplementation(() => {});
    const stateSpy = jest
      .spyOn(controller, '_updateSearchState')
      .mockImplementation(() => {});
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastDataChange')
      .mockImplementation(() => {});

    controller._handleSearch('hero');
    expect(displaySpy).toHaveBeenCalled();
    expect(stateSpy).toHaveBeenCalledWith('hero', expect.any(Number));
    expect(broadcastSpy).toHaveBeenCalledWith('search-updated', {
      searchTerm: 'hero',
    });

    displaySpy.mockRestore();
    stateSpy.mockRestore();
    broadcastSpy.mockRestore();

    const panelContainer = document.createElement('div');
    panelContainer.className = 'cb-panel';
    const panelTitle = document.createElement('div');
    panelTitle.className = 'cb-panel-title';
    panelContainer.appendChild(panelTitle);
    panelContainer.appendChild(controller._getElement('conceptsResults'));
    document.body.appendChild(panelContainer);

    controller._cacheElements();
    let searchStatusElement = controller._getElement('searchStatus');
    if (!searchStatusElement) {
      searchStatusElement = document.createElement('div');
      searchStatusElement.id = 'search-status';
      document.body.appendChild(searchStatusElement);
      controller._cacheElements();
    }

    controller._updateSearchStatus('hero', 0);
    controller._updateSearchStatus('hero', 2);

    const searchInput = controller._getElement('conceptSearch');
    if (!searchInput.parentElement) {
      const wrapper = document.createElement('div');
      wrapper.appendChild(searchInput);
      document.body.appendChild(wrapper);
      controller._cacheElements();
    }

    controller._updateClearButton(true);
    controller._updateClearButton(false);

    controller._getElement('conceptSearch').value = 'hero';
    controller._clearSearch();
    expect(controller._getElement('conceptSearch').value).toBe('');

    const highlighted = controller._highlightSearchTerms('Heroic hero', 'hero');
    expect(highlighted).toContain('<mark>');
    expect(controller._escapeRegex('hero.*')).toBe(String.raw`hero\.\*`);

    controller._saveEnhancedSearchState('hero', 2);
    expect(sessionStorage.getItem('conceptsManagerSearch')).toBe('hero');
    const savedState = JSON.parse(
      sessionStorage.getItem('conceptsSearchState')
    );
    expect(savedState.filter).toBe('hero');

    const enhancedState = {
      searchTerm: 'villain',
      filter: 'villain',
      resultCount: 1,
      timestamp: Date.now(),
      scrollPosition: 42,
      analytics: { searches: [], noResultSearches: [] },
    };
    sessionStorage.setItem(
      'conceptsSearchState',
      JSON.stringify(enhancedState)
    );
    const scrollSpy = jest
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 1;
      });
    controller._restoreEnhancedSearchState();
    expect(controller._testExports.searchFilter).toBe('villain');
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
    rafSpy.mockRestore();
  });

  it('processes concept events and updates local cache', async () => {
    const concept = testBase.createTestConcept({
      id: 'event-1',
      concept: 'Event concept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const loadSpy = jest
      .spyOn(controller, '_loadConceptsData')
      .mockResolvedValue();
    const celebrateSpy = jest
      .spyOn(controller, '_celebrateCreation')
      .mockImplementation(() => {});
    const feedbackSpy = jest
      .spyOn(controller, '_showConceptCreatedFeedback')
      .mockImplementation(() => {});

    await controller._handleConceptCreated({ payload: { concept } });
    expect(loadSpy).toHaveBeenCalled();
    expect(celebrateSpy).toHaveBeenCalled();
    expect(feedbackSpy).toHaveBeenCalledWith(concept);

    loadSpy.mockRestore();
    celebrateSpy.mockRestore();
    feedbackSpy.mockRestore();

    controller._testExports.conceptsData = [{ concept, directionCount: 0 }];
    const infoSpy = jest.spyOn(controller.logger, 'info');
    await controller._handleConceptUpdated({ payload: { concept } });
    expect(infoSpy).toHaveBeenCalledWith(
      'Concept updated event received',
      expect.any(Object)
    );

    const warnSpy = jest.spyOn(controller.logger, 'warn');
    controller._handleConceptUpdated({
      payload: { concept: { ...concept, id: 'missing' } },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Updated concept not found in cache',
      expect.any(Object)
    );

    const removeSpy = jest
      .spyOn(controller, '_removeConceptCard')
      .mockImplementation(() => {});
    const deletedFeedbackSpy = jest
      .spyOn(controller, '_showConceptDeletedFeedback')
      .mockImplementation(() => {});
    controller._testExports.conceptsData = [{ concept, directionCount: 2 }];
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    await controller._handleConceptDeleted({
      payload: { conceptId: concept.id, cascadedDirections: ['d1'] },
    });
    expect(removeSpy).toHaveBeenCalledWith(concept.id);
    expect(deletedFeedbackSpy).toHaveBeenCalledWith(['d1']);
    removeSpy.mockRestore();
    deletedFeedbackSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('dispatches analytics event when showing the create modal', () => {
    const modal = controller._getElement('conceptModal');
    const animation = {
      playState: 'finished',
      cancel: jest.fn(),
      addEventListener: jest.fn(),
    };
    modal.animate = jest.fn(() => animation);

    const focusSource = document.createElement('button');
    focusSource.focus = jest.fn();
    document.body.appendChild(focusSource);
    document.activeElement = focusSource;

    const conceptText = controller._getElement('conceptText');
    if (!conceptText.parentNode) {
      const wrapper = document.createElement('div');
      wrapper.appendChild(conceptText);
      document.body.appendChild(wrapper);
      controller._cacheElements();
    }

    const originalDispatch = controller.eventBus.dispatch;
    controller.eventBus.dispatch = jest.fn();

    controller.logger.error.mockClear();

    controller._showCreateModal();

    expect(controller.logger.error).not.toHaveBeenCalled();

    expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
      'core:ui_modal_opened',
      { modalType: 'create-concept' }
    );

    controller.eventBus.dispatch = originalDispatch;
    modal.animate = undefined;
  });

  it('cancels an in-flight entrance animation during destruction', () => {
    const modal = controller._getElement('conceptModal');
    const animation = {
      playState: 'running',
      cancel: jest.fn(),
      addEventListener: jest.fn(),
    };
    modal.animate = jest.fn(() => animation);
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    controller._animateModalEntrance(modal);
    controller.destroy();

    expect(animation.cancel).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('restores focus when closing the concept modal successfully', () => {
    const modal = controller._getElement('conceptModal');
    modal.style.display = 'flex';
    modal.animate = jest.fn(() => ({
      playState: 'finished',
      cancel: jest.fn(),
      addEventListener: jest.fn(),
    }));

    const focusTarget = document.createElement('button');
    focusTarget.focus = jest.fn();
    document.body.appendChild(focusTarget);
    document.activeElement = focusTarget;

    const conceptText = controller._getElement('conceptText');
    if (!conceptText.parentNode) {
      const wrapper = document.createElement('div');
      wrapper.appendChild(conceptText);
      document.body.appendChild(wrapper);
      controller._cacheElements();
    }

    controller._showCreateModal();
    focusTarget.focus.mockClear();

    const originalDispatch = controller.eventBus.dispatch;
    controller.eventBus.dispatch = jest.fn();

    controller._testExports.hasUnsavedChanges = false;
    controller._closeConceptModal();

    expect(focusTarget.focus).toHaveBeenCalled();
    expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
      'core:ui_modal_closed',
      { modalType: 'concept' }
    );

    controller.eventBus.dispatch = originalDispatch;
  });

  it('aborts modal closing when the user cancels the confirmation prompt', () => {
    const modal = controller._getElement('conceptModal');
    modal.style.display = 'flex';
    controller._testExports.hasUnsavedChanges = true;
    controller._testExports.editingConceptId = 'concept-123';
    const animateExitSpy = jest
      .spyOn(controller, '_animateModalExit')
      .mockImplementation(() => {});
    global.confirm = jest.fn(() => false);

    controller._closeConceptModal();

    expect(global.confirm).toHaveBeenCalled();
    expect(animateExitSpy).not.toHaveBeenCalled();

    animateExitSpy.mockRestore();
  });

  it('falls back to simple hide if close animation throws an error', () => {
    const modal = controller._getElement('conceptModal');
    modal.style.display = 'flex';
    const error = new Error('close failed');
    jest.spyOn(controller, '_animateModalExit').mockImplementation(() => {
      throw error;
    });

    controller._closeConceptModal();

    expect(controller.logger.error).toHaveBeenCalledWith(
      'Error closing modal',
      error
    );
    expect(modal.style.display).toBe('none');
  });

  it('shows the results state immediately when UI state is available', () => {
    const showStateSpy = jest
      .spyOn(controller, '_showState')
      .mockImplementation(() => {});
    const stateSpy = jest
      .spyOn(controller, 'currentState', 'get')
      .mockReturnValue(UI_STATES.EMPTY);

    const concept = testBase.createTestConcept({
      id: 'display-1',
      concept: 'Display concept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    controller._displayConcepts([{ concept, directionCount: 1 }]);

    expect(showStateSpy).toHaveBeenCalledWith('results');

    showStateSpy.mockRestore();
    stateSpy.mockRestore();
  });

  it('safely filters concepts that lack textual content', () => {
    controller._testExports.searchFilter = 'mystic';

    const result = controller._filterConcepts([
      { concept: { id: 'no-text', concept: null }, directionCount: 0 },
    ]);

    expect(result).toHaveLength(0);
  });

  it('updates advanced statistics values with temporary highlight', () => {
    const statElement = document.createElement('span');
    statElement.textContent = 'old';
    const addSpy = jest.spyOn(statElement.classList, 'add');
    const removeSpy = jest.spyOn(statElement.classList, 'remove');
    const getElementSpy = jest
      .spyOn(document, 'getElementById')
      .mockReturnValue(statElement);

    controller._updateAdvancedStatValue('avg-directions', '5.0');

    expect(statElement.textContent).toBe('5.0');
    expect(addSpy).toHaveBeenCalledWith('stat-updated');

    jest.advanceTimersByTime(300);

    expect(removeSpy).toHaveBeenCalledWith('stat-updated');

    getElementSpy.mockRestore();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('updates completion progress styling for each threshold', () => {
    const progressFill = document.createElement('div');
    const addSpy = jest.spyOn(progressFill.classList, 'add');
    const removeSpy = jest.spyOn(progressFill.classList, 'remove');
    const conceptsComplete = document.createElement('span');
    const conceptsTotal = document.createElement('span');
    const querySpy = jest
      .spyOn(document, 'querySelector')
      .mockImplementation((selector) => {
        switch (selector) {
          case '.progress-fill':
            return progressFill;
          case '.concepts-complete':
            return conceptsComplete;
          case '.concepts-total':
            return conceptsTotal;
          default:
            return null;
        }
      });

    controller._testExports.conceptsData = [
      { concept: { id: 'a', concept: 'A' }, directionCount: 2 },
      { concept: { id: 'b', concept: 'B' }, directionCount: 0 },
    ];

    controller._updateCompletionProgress(100);
    expect(addSpy).toHaveBeenCalledWith('complete');

    controller._updateCompletionProgress(80);
    expect(addSpy).toHaveBeenCalledWith('good');

    controller._updateCompletionProgress(55);
    expect(addSpy).toHaveBeenCalledWith('moderate');

    controller._updateCompletionProgress(20);
    expect(addSpy).toHaveBeenCalledWith('low');

    expect(conceptsComplete.textContent).toBe('1');
    expect(conceptsTotal.textContent).toBe('2');

    expect(removeSpy).toHaveBeenCalledWith(
      'complete',
      'good',
      'moderate',
      'low'
    );

    querySpy.mockRestore();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
