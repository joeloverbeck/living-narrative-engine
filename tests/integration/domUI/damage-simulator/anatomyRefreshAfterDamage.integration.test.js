/**
 * @file anatomyRefreshAfterDamage.integration.test.js
 * @description Integration test verifying that the Anatomy section refreshes
 * after damage is applied via the Apply Damage button.
 *
 * Bug: After pressing "Apply Damage", the "HITS TO DESTROY" section updates
 * but the "Anatomy" section (hierarchical body part tree) did not refresh.
 *
 * Root cause: DamageSimulatorUI.refreshAnatomyDisplay() was not calling
 * this.#renderAnatomy(anatomyData) after re-extracting anatomy data.
 */

import { jest } from '@jest/globals';
import DamageSimulatorUI from '../../../../src/domUI/damage-simulator/DamageSimulatorUI.js';

describe('Anatomy Refresh After Damage - Integration', () => {
  let mockLogger;
  let mockRecipeSelectorService;
  let mockEntityLoadingService;
  let mockAnatomyDataExtractor;
  let mockEventBus;
  let mockAnatomyRenderer;
  let mockExecutionService;
  let mockDamageComposer;
  let damageSimulatorUI;
  let getElementByIdSpy;
  let mockElements;

  const createMockElement = (id) => {
    const element = document.createElement('div');
    element.id = id;
    element.addEventListenerSpy = jest.fn();
    const originalAddEventListener = element.addEventListener.bind(element);
    element.addEventListener = (event, handler, options) => {
      element.addEventListenerSpy(event, handler, options);
      return originalAddEventListener(event, handler, options);
    };
    return element;
  };

  beforeEach(async () => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock services
    mockRecipeSelectorService = {
      populateWithComponent: jest.fn().mockReturnValue([
        { id: 'core:human', name: 'Human' },
      ]),
    };

    mockEntityLoadingService = {
      loadEntityWithAnatomy: jest.fn().mockResolvedValue('instance-123'),
    };

    // Initial anatomy data (before damage)
    mockAnatomyDataExtractor = {
      extractFromEntity: jest.fn().mockResolvedValue({
        rootPart: {
          id: 'body',
          name: 'Body',
          health: { current: 100, max: 100 },
          children: [
            {
              id: 'head',
              name: 'Head',
              health: { current: 50, max: 50 },
              children: [],
            },
            {
              id: 'torso',
              name: 'Torso',
              health: { current: 100, max: 100 },
              children: [],
            },
          ],
        },
      }),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    // Mock anatomy renderer - key component for this bug fix
    mockAnatomyRenderer = {
      render: jest.fn(),
      clear: jest.fn(),
      updatePart: jest.fn(),
    };

    // Mock execution service (simulates damage application)
    mockExecutionService = {
      applyDamage: jest.fn().mockResolvedValue({ success: true }),
      getTargetableParts: jest.fn().mockReturnValue([
        { id: 'head', name: 'Head', weight: 10 },
        { id: 'torso', name: 'Torso', weight: 30 },
      ]),
    };

    // Mock damage composer
    mockDamageComposer = {
      getDamageEntry: jest.fn().mockReturnValue({ type: 'slashing', value: 20 }),
      getDamageMultiplier: jest.fn().mockReturnValue(1.0),
    };

    // Create mock DOM elements
    mockElements = {
      'entity-select': createMockElement('entity-select'),
      'anatomy-tree': createMockElement('anatomy-tree'),
      'damage-form': createMockElement('damage-form'),
      'hits-to-destroy': createMockElement('hits-to-destroy'),
      'hit-probability': createMockElement('hit-probability'),
      'history-log': createMockElement('history-log'),
      'apply-damage-btn': createMockElement('apply-damage-btn'),
      'target-part': createMockElement('target-part'),
    };

    // Mock select element for target-part
    mockElements['target-part'].value = '';

    getElementByIdSpy = jest
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => mockElements[id] || null);

    // Mock querySelectorAll for radio buttons
    jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
    jest.spyOn(document, 'querySelector').mockReturnValue({
      value: 'random',
    });

    // Create and initialize DamageSimulatorUI
    damageSimulatorUI = new DamageSimulatorUI({
      recipeSelectorService: mockRecipeSelectorService,
      entityLoadingService: mockEntityLoadingService,
      anatomyDataExtractor: mockAnatomyDataExtractor,
      eventBus: mockEventBus,
      logger: mockLogger,
    });

    // Set child components
    damageSimulatorUI.setChildComponent('anatomyRenderer', mockAnatomyRenderer);
    damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
    damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

    await damageSimulatorUI.initialize();
  });

  afterEach(() => {
    getElementByIdSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should refresh anatomy tree after damage is applied', async () => {
    // Step 1: Load an entity
    await damageSimulatorUI.handleEntitySelection('core:human');

    // Verify initial render
    expect(mockAnatomyRenderer.render).toHaveBeenCalledTimes(1);
    expect(mockAnatomyRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        rootPart: expect.objectContaining({
          health: { current: 100, max: 100 },
        }),
      })
    );

    // Step 2: Prepare updated anatomy data (after damage)
    const updatedAnatomyData = {
      rootPart: {
        id: 'body',
        name: 'Body',
        health: { current: 80, max: 100 }, // Damaged!
        children: [
          {
            id: 'head',
            name: 'Head',
            health: { current: 30, max: 50 }, // Damaged!
            children: [],
          },
          {
            id: 'torso',
            name: 'Torso',
            health: { current: 100, max: 100 },
            children: [],
          },
        ],
      },
    };

    mockAnatomyDataExtractor.extractFromEntity.mockResolvedValue(updatedAnatomyData);
    mockAnatomyRenderer.render.mockClear();

    // Step 3: Call refreshAnatomyDisplay (simulating what happens after Apply Damage)
    await damageSimulatorUI.refreshAnatomyDisplay();

    // Step 4: Assert that anatomyRenderer.render() was called with updated data
    expect(mockAnatomyRenderer.render).toHaveBeenCalledTimes(1);
    expect(mockAnatomyRenderer.render).toHaveBeenCalledWith(updatedAnatomyData);

    // Verify the updated health values were passed
    expect(mockAnatomyRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        rootPart: expect.objectContaining({
          health: { current: 80, max: 100 },
          children: expect.arrayContaining([
            expect.objectContaining({
              id: 'head',
              health: { current: 30, max: 50 },
            }),
          ]),
        }),
      })
    );
  });

  it('should emit ENTITY_LOADED event after refreshing anatomy', async () => {
    // Load entity first
    await damageSimulatorUI.handleEntitySelection('core:human');
    mockEventBus.dispatch.mockClear();

    // Prepare updated data
    const updatedData = {
      rootPart: { id: 'body', health: { current: 70, max: 100 }, children: [] },
    };
    mockAnatomyDataExtractor.extractFromEntity.mockResolvedValue(updatedData);

    // Refresh anatomy display
    await damageSimulatorUI.refreshAnatomyDisplay();

    // Verify ENTITY_LOADED event was emitted with updated data
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:damage_simulator_entity_loaded',
      expect.objectContaining({
        anatomyData: updatedData,
      })
    );
  });

  it('should update stored anatomy data after refresh', async () => {
    // Load entity first
    await damageSimulatorUI.handleEntitySelection('core:human');

    // Verify initial data
    const initialData = damageSimulatorUI.getCurrentEntityData();
    expect(initialData.anatomyData.rootPart.health.current).toBe(100);

    // Prepare updated data
    const updatedData = {
      rootPart: { id: 'body', health: { current: 60, max: 100 }, children: [] },
    };
    mockAnatomyDataExtractor.extractFromEntity.mockResolvedValue(updatedData);

    // Refresh
    await damageSimulatorUI.refreshAnatomyDisplay();

    // Verify stored data is updated
    const refreshedData = damageSimulatorUI.getCurrentEntityData();
    expect(refreshedData.anatomyData.rootPart.health.current).toBe(60);
  });

  it('should render with correct sequence: extract -> render -> emit event', async () => {
    const callOrder = [];

    // Load entity first
    await damageSimulatorUI.handleEntitySelection('core:human');

    // Clear and setup tracking
    mockAnatomyDataExtractor.extractFromEntity.mockClear();
    mockAnatomyRenderer.render.mockClear();
    mockEventBus.dispatch.mockClear();

    mockAnatomyDataExtractor.extractFromEntity.mockImplementation(async () => {
      callOrder.push('extract');
      return { rootPart: { id: 'body', health: { current: 50, max: 100 }, children: [] } };
    });

    mockAnatomyRenderer.render.mockImplementation(() => {
      callOrder.push('render');
    });

    const originalDispatch = mockEventBus.dispatch;
    mockEventBus.dispatch = jest.fn().mockImplementation((eventType) => {
      if (eventType === 'core:damage_simulator_entity_loaded') {
        callOrder.push('emit');
      }
      return originalDispatch(eventType);
    });

    // Refresh
    await damageSimulatorUI.refreshAnatomyDisplay();

    // Verify correct order: extract → render → emit
    expect(callOrder).toEqual(['extract', 'render', 'emit']);
  });
});
