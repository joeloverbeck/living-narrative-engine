/**
 * @file DamageSimulatorUI.test.js
 * @description Unit tests for DamageSimulatorUI controller
 */

import DamageSimulatorUI from '../../../../src/domUI/damage-simulator/DamageSimulatorUI.js';
import { jest } from '@jest/globals';

describe('DamageSimulatorUI', () => {
  let mockLogger;
  let mockRecipeSelectorService;
  let mockEntityLoadingService;
  let mockAnatomyDataExtractor;
  let mockEventBus;
  let damageSimulatorUI;
  let getElementByIdSpy;
  let mockElements;

  const createMockElement = (id) => {
    const element = document.createElement('div');
    element.id = id;
    // Add spies for methods we want to track
    element.addEventListenerSpy = jest.fn();
    const originalAddEventListener = element.addEventListener.bind(element);
    element.addEventListener = (event, handler, options) => {
      element.addEventListenerSpy(event, handler, options);
      return originalAddEventListener(event, handler, options);
    };
    return element;
  };

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock recipe selector service
    mockRecipeSelectorService = {
      populateWithComponent: jest.fn().mockReturnValue([
        { id: 'core:human', name: 'Human' },
        { id: 'core:elf', name: 'Elf' },
      ]),
    };

    // Mock entity loading service
    mockEntityLoadingService = {
      loadEntityWithAnatomy: jest.fn().mockResolvedValue('instance-123'),
    };

    // Mock anatomy data extractor
    mockAnatomyDataExtractor = {
      extractFromEntity: jest.fn().mockResolvedValue({
        bodyParts: [{ id: 'head', name: 'Head' }],
      }),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    // Create mock DOM elements in jsdom
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

    // Make target-part a select element for realistic behavior
    mockElements['target-part'] = document.createElement('select');
    mockElements['target-part'].id = 'target-part';
    mockElements['target-part'].innerHTML = '<option value="">Select part...</option>';

    // Make apply-damage-btn a button element
    mockElements['apply-damage-btn'] = document.createElement('button');
    mockElements['apply-damage-btn'].id = 'apply-damage-btn';
    mockElements['apply-damage-btn'].disabled = true;

    // Spy on document.getElementById to return our mock elements
    getElementByIdSpy = jest
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => mockElements[id] || null);
  });

  afterEach(() => {
    getElementByIdSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should validate dependencies in constructor', () => {
      // Missing recipeSelectorService
      expect(
        () =>
          new DamageSimulatorUI({
            entityLoadingService: mockEntityLoadingService,
            anatomyDataExtractor: mockAnatomyDataExtractor,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing entityLoadingService
      expect(
        () =>
          new DamageSimulatorUI({
            recipeSelectorService: mockRecipeSelectorService,
            anatomyDataExtractor: mockAnatomyDataExtractor,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing anatomyDataExtractor
      expect(
        () =>
          new DamageSimulatorUI({
            recipeSelectorService: mockRecipeSelectorService,
            entityLoadingService: mockEntityLoadingService,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing eventBus
      expect(
        () =>
          new DamageSimulatorUI({
            recipeSelectorService: mockRecipeSelectorService,
            entityLoadingService: mockEntityLoadingService,
            anatomyDataExtractor: mockAnatomyDataExtractor,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing logger
      expect(
        () =>
          new DamageSimulatorUI({
            recipeSelectorService: mockRecipeSelectorService,
            entityLoadingService: mockEntityLoadingService,
            anatomyDataExtractor: mockAnatomyDataExtractor,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      expect(damageSimulatorUI).toBeInstanceOf(DamageSimulatorUI);
      expect(damageSimulatorUI.getCurrentState()).toBe('idle');
      expect(damageSimulatorUI.getCurrentEntityData()).toBeNull();
    });

    it('should expose static constants', () => {
      expect(DamageSimulatorUI.ELEMENT_IDS).toBeDefined();
      expect(DamageSimulatorUI.ELEMENT_IDS.entitySelect).toBe('entity-select');
      expect(DamageSimulatorUI.ELEMENT_IDS.anatomyTree).toBe('anatomy-tree');

      expect(DamageSimulatorUI.UI_STATES).toBeDefined();
      expect(DamageSimulatorUI.UI_STATES.IDLE).toBe('idle');
      expect(DamageSimulatorUI.UI_STATES.LOADING).toBe('loading');
      expect(DamageSimulatorUI.UI_STATES.LOADED).toBe('loaded');
      expect(DamageSimulatorUI.UI_STATES.ERROR).toBe('error');

      expect(DamageSimulatorUI.UI_EVENTS).toBeDefined();
      expect(DamageSimulatorUI.UI_EVENTS.ENTITY_LOADED).toBe(
        'core:damage_simulator_entity_loaded'
      );
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
    });

    it('should bind to required DOM elements', async () => {
      await damageSimulatorUI.initialize();

      expect(getElementByIdSpy).toHaveBeenCalledWith('entity-select');
      expect(getElementByIdSpy).toHaveBeenCalledWith('anatomy-tree');
      expect(getElementByIdSpy).toHaveBeenCalledWith('damage-form');
      expect(getElementByIdSpy).toHaveBeenCalledWith('hits-to-destroy');
      expect(getElementByIdSpy).toHaveBeenCalledWith('hit-probability');
      expect(getElementByIdSpy).toHaveBeenCalledWith('history-log');
    });

    it('should populate entity selector on initialization', async () => {
      await damageSimulatorUI.initialize();

      expect(mockRecipeSelectorService.populateWithComponent).toHaveBeenCalledWith(
        mockElements['entity-select'],
        'anatomy:body',
        { placeholderText: 'Select an entity...' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Found 2 entities with anatomy:body'
      );
    });

    it('should handle missing DOM elements gracefully', async () => {
      getElementByIdSpy.mockReturnValue(null);

      await damageSimulatorUI.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DOM element not found')
      );
    });

    it('should log initialization completion', async () => {
      await damageSimulatorUI.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Initialization complete'
      );
    });

    it('should setup change event listener on entity select', async () => {
      await damageSimulatorUI.initialize();

      expect(mockElements['entity-select'].addEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
        undefined
      );
    });
  });

  describe('handleEntitySelection()', () => {
    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await damageSimulatorUI.initialize();
    });

    it('should call EntityLoadingService on entity selection', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(mockEntityLoadingService.loadEntityWithAnatomy).toHaveBeenCalledWith(
        'core:human'
      );
    });

    it('should show loading state while entity loads', async () => {
      const loadPromise = damageSimulatorUI.handleEntitySelection('core:human');

      expect(damageSimulatorUI.getCurrentState()).toBe('loading');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_entity_loading',
        { definitionId: 'core:human' }
      );

      await loadPromise;
    });

    it('should emit events for child component coordination', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_entity_loading',
        { definitionId: 'core:human' }
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_entity_loaded',
        expect.objectContaining({
          definitionId: 'core:human',
          instanceId: 'instance-123',
          anatomyData: expect.any(Object),
        })
      );
    });

    it('should update state to loaded on success', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(damageSimulatorUI.getCurrentState()).toBe('loaded');
      expect(damageSimulatorUI.getCurrentEntityData()).toEqual({
        definitionId: 'core:human',
        instanceId: 'instance-123',
        anatomyData: { bodyParts: [{ id: 'head', name: 'Head' }] },
      });
    });

    it('should show error state on load failure', async () => {
      const error = new Error('Failed to load entity');
      mockEntityLoadingService.loadEntityWithAnatomy.mockRejectedValue(error);

      await damageSimulatorUI.handleEntitySelection('core:invalid');

      expect(damageSimulatorUI.getCurrentState()).toBe('error');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_entity_load_error',
        {
          definitionId: 'core:invalid',
          error: 'Failed to load entity',
        }
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should clear state on empty selection', async () => {
      // First load an entity
      await damageSimulatorUI.handleEntitySelection('core:human');
      expect(damageSimulatorUI.getCurrentEntityData()).not.toBeNull();

      // Then clear it
      await damageSimulatorUI.handleEntitySelection('');

      expect(damageSimulatorUI.getCurrentState()).toBe('idle');
      expect(damageSimulatorUI.getCurrentEntityData()).toBeNull();
    });

    it('should clear state on null selection', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');
      await damageSimulatorUI.handleEntitySelection(null);

      expect(damageSimulatorUI.getCurrentState()).toBe('idle');
      expect(damageSimulatorUI.getCurrentEntityData()).toBeNull();
    });
  });

  describe('refreshAnatomyDisplay()', () => {
    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await damageSimulatorUI.initialize();
    });

    it('should do nothing if no entity is loaded', async () => {
      await damageSimulatorUI.refreshAnatomyDisplay();

      expect(mockAnatomyDataExtractor.extractFromEntity).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No entity loaded')
      );
    });

    it('should re-extract anatomy data and emit events', async () => {
      // Load an entity first
      await damageSimulatorUI.handleEntitySelection('core:human');

      // Clear previous calls
      mockEventBus.dispatch.mockClear();
      mockAnatomyDataExtractor.extractFromEntity.mockClear();

      // Updated anatomy data
      mockAnatomyDataExtractor.extractFromEntity.mockResolvedValue({
        bodyParts: [
          { id: 'head', name: 'Head' },
          { id: 'arm', name: 'Arm' },
        ],
      });

      await damageSimulatorUI.refreshAnatomyDisplay();

      expect(mockAnatomyDataExtractor.extractFromEntity).toHaveBeenCalledWith(
        'instance-123'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_refresh_requested',
        { instanceId: 'instance-123' }
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:damage_simulator_entity_loaded',
        expect.objectContaining({
          anatomyData: {
            bodyParts: [
              { id: 'head', name: 'Head' },
              { id: 'arm', name: 'Arm' },
            ],
          },
        })
      );
    });

    it('should call anatomyRenderer.render() with updated anatomy data', async () => {
      // Load an entity first
      await damageSimulatorUI.handleEntitySelection('core:human');

      // Setup mock anatomy renderer
      const mockAnatomyRenderer = { render: jest.fn(), clear: jest.fn() };
      damageSimulatorUI.setChildComponent('anatomyRenderer', mockAnatomyRenderer);
      mockAnatomyRenderer.render.mockClear(); // Clear initial render call from handleEntitySelection

      // Updated anatomy data with modified health
      const updatedAnatomyData = {
        bodyParts: [
          { id: 'head', name: 'Head', health: 50 },
          { id: 'arm', name: 'Arm', health: 80 },
        ],
      };
      mockAnatomyDataExtractor.extractFromEntity.mockResolvedValue(updatedAnatomyData);

      // Act
      await damageSimulatorUI.refreshAnatomyDisplay();

      // Assert: anatomyRenderer.render() is called with updated data
      expect(mockAnatomyRenderer.render).toHaveBeenCalledTimes(1);
      expect(mockAnatomyRenderer.render).toHaveBeenCalledWith(updatedAnatomyData);
    });
  });

  describe('Child Component Management', () => {
    beforeEach(() => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
    });

    it('should set and get child components', () => {
      const mockAnatomyRenderer = { render: jest.fn() };

      damageSimulatorUI.setChildComponent('anatomyRenderer', mockAnatomyRenderer);

      expect(damageSimulatorUI.getChildComponent('anatomyRenderer')).toBe(
        mockAnatomyRenderer
      );
    });

    it('should warn on unknown child component name', () => {
      damageSimulatorUI.setChildComponent('unknownComponent', {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown child component name')
      );
    });

    it('should return undefined for unset component', () => {
      expect(damageSimulatorUI.getChildComponent('anatomyRenderer')).toBeUndefined();
    });

    it('should accept valid child component names', () => {
      const validNames = ['anatomyRenderer', 'damageComposer', 'analytics'];

      validNames.forEach((name) => {
        damageSimulatorUI.setChildComponent(name, { test: true });
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining(name)
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await damageSimulatorUI.initialize();
    });

    it('should handle recipe selector errors gracefully', async () => {
      mockRecipeSelectorService.populateWithComponent.mockImplementation(() => {
        throw new Error('Selector error');
      });

      // Create new instance and initialize
      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      await ui.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to populate entity selector'),
        expect.any(Error)
      );
    });

    it('should escape HTML in error messages', async () => {
      const xssError = new Error('<script>alert("xss")</script>');
      mockEntityLoadingService.loadEntityWithAnatomy.mockRejectedValue(xssError);

      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();
      await ui.handleEntitySelection('core:human');

      // Verify the innerHTML doesn't contain raw script tag
      const anatomyTree = mockElements['anatomy-tree'];
      expect(anatomyTree.innerHTML).not.toContain('<script>');
      expect(anatomyTree.innerHTML).toContain('&lt;script&gt;');
    });

    it('should handle anatomy extraction errors', async () => {
      mockAnatomyDataExtractor.extractFromEntity.mockRejectedValue(
        new Error('Extraction failed')
      );

      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(damageSimulatorUI.getCurrentState()).toBe('error');
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await damageSimulatorUI.initialize();
    });

    it('should transition idle -> loading -> loaded on success', async () => {
      expect(damageSimulatorUI.getCurrentState()).toBe('idle');

      const promise = damageSimulatorUI.handleEntitySelection('core:human');
      expect(damageSimulatorUI.getCurrentState()).toBe('loading');

      await promise;
      expect(damageSimulatorUI.getCurrentState()).toBe('loaded');
    });

    it('should transition idle -> loading -> error on failure', async () => {
      mockEntityLoadingService.loadEntityWithAnatomy.mockRejectedValue(
        new Error('Failed')
      );

      expect(damageSimulatorUI.getCurrentState()).toBe('idle');

      const promise = damageSimulatorUI.handleEntitySelection('core:human');
      expect(damageSimulatorUI.getCurrentState()).toBe('loading');

      await promise;
      expect(damageSimulatorUI.getCurrentState()).toBe('error');
    });

    it('should transition loaded -> idle on clear', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');
      expect(damageSimulatorUI.getCurrentState()).toBe('loaded');

      await damageSimulatorUI.handleEntitySelection('');
      expect(damageSimulatorUI.getCurrentState()).toBe('idle');
    });

    it('should log state transitions', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('State: idle → loading')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('State: loading → loaded')
      );
    });
  });

  describe('Event Listener Callbacks', () => {
    let querySelectorAllSpy;
    let querySelectorSpy;
    let mockRadioButtons;

    beforeEach(() => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Create mock radio buttons
      mockRadioButtons = [
        document.createElement('input'),
        document.createElement('input'),
      ];
      mockRadioButtons[0].type = 'radio';
      mockRadioButtons[0].name = 'target-mode';
      mockRadioButtons[0].value = 'random';
      mockRadioButtons[1].type = 'radio';
      mockRadioButtons[1].name = 'target-mode';
      mockRadioButtons[1].value = 'specific';

      // Mock querySelectorAll for radio buttons
      querySelectorAllSpy = jest
        .spyOn(document, 'querySelectorAll')
        .mockReturnValue(mockRadioButtons);

      // Mock querySelector for checked radio
      querySelectorSpy = jest.spyOn(document, 'querySelector');
    });

    afterEach(() => {
      querySelectorAllSpy.mockRestore();
      querySelectorSpy.mockRestore();
    });

    it('should trigger handleEntitySelection when entity select change event fires', async () => {
      await damageSimulatorUI.initialize();

      const entitySelect = mockElements['entity-select'];
      entitySelect.value = 'core:elf';

      // Create and dispatch a real change event
      const changeEvent = new Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: { value: 'core:elf' },
        writable: false,
      });

      entitySelect.dispatchEvent(changeEvent);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockEntityLoadingService.loadEntityWithAnatomy).toHaveBeenCalledWith(
        'core:elf'
      );
    });

    it('should trigger #handleApplyDamage when apply button is clicked', async () => {
      await damageSimulatorUI.initialize();

      // Load an entity first to enable apply damage
      await damageSimulatorUI.handleEntitySelection('core:human');

      const applyBtn = mockElements['apply-damage-btn'];

      // Setup child components for apply damage to work
      const mockExecutionService = {
        applyDamage: jest.fn().mockResolvedValue({ success: true }),
        getTargetableParts: jest.fn().mockReturnValue([]),
      };
      const mockDamageComposer = {
        getDamageEntry: jest.fn().mockReturnValue({ type: 'slashing', amount: 10 }),
        getDamageMultiplier: jest.fn().mockReturnValue(1.0),
      };
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      // Mock querySelector for target mode
      querySelectorSpy.mockReturnValue({ value: 'random' });

      // Dispatch click event
      const clickEvent = new Event('click', { bubbles: true });
      applyBtn.dispatchEvent(clickEvent);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockExecutionService.applyDamage).toHaveBeenCalled();
    });

    it('should toggle targetPartSelect disabled state when target mode radio changes', async () => {
      await damageSimulatorUI.initialize();

      const targetPartSelect = mockElements['target-part'];

      // Initially disabled (random mode)
      expect(targetPartSelect.disabled).toBe(false); // Not set yet

      // Simulate change to specific mode
      const specificEvent = new Event('change', { bubbles: true });
      Object.defineProperty(specificEvent, 'target', {
        value: { value: 'specific' },
        writable: false,
      });
      mockRadioButtons[1].dispatchEvent(specificEvent);

      expect(targetPartSelect.disabled).toBe(false);

      // Simulate change to random mode
      const randomEvent = new Event('change', { bubbles: true });
      Object.defineProperty(randomEvent, 'target', {
        value: { value: 'random' },
        writable: false,
      });
      mockRadioButtons[0].dispatchEvent(randomEvent);

      expect(targetPartSelect.disabled).toBe(true);
    });

    it('should warn when apply damage button is not found', async () => {
      // Remove apply button from mock elements
      mockElements['apply-damage-btn'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      await damageSimulatorUI.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Apply damage button not found'
      );
    });

    it('should warn when target part select is not found for target mode listeners', async () => {
      // Remove target part select from mock elements
      mockElements['target-part'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      await damageSimulatorUI.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Target part select not found'
      );
    });
  });

  describe('Apply Damage Workflow', () => {
    let querySelectorSpy;
    let mockExecutionService;
    let mockDamageComposer;

    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Mock querySelectorAll for radios (empty for these tests)
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);

      // Mock querySelector for target mode
      querySelectorSpy = jest.spyOn(document, 'querySelector');
      querySelectorSpy.mockReturnValue({ value: 'random' });

      mockExecutionService = {
        applyDamage: jest.fn().mockResolvedValue({ success: true }),
        getTargetableParts: jest.fn().mockReturnValue([
          { id: 'head', name: 'Head', weight: 10 },
          { id: 'torso', name: 'Torso', weight: 30 },
        ]),
      };

      mockDamageComposer = {
        getDamageEntry: jest.fn().mockReturnValue({ type: 'slashing', amount: 10 }),
        getDamageMultiplier: jest.fn().mockReturnValue(1.5),
      };

      await damageSimulatorUI.initialize();
    });

    afterEach(() => {
      querySelectorSpy.mockRestore();
      jest.spyOn(document, 'querySelectorAll').mockRestore();
    });

    it('should warn and return early when no entity is loaded', async () => {
      // Don't load any entity
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      // Trigger apply damage via button click
      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageSimulatorUI] No entity loaded'
      );
      expect(mockExecutionService.applyDamage).not.toHaveBeenCalled();
    });

    it('should warn and return early when no executionService is set', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);
      // Don't set executionService

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageSimulatorUI] No executionService child component set'
      );
    });

    it('should warn and return early when no damageComposer is set', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      // Don't set damageComposer

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageSimulatorUI] No damageComposer child component set'
      );
    });

    it('should apply damage successfully and refresh anatomy display', async () => {
      await damageSimulatorUI.handleEntitySelection('core:human');
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockExecutionService.applyDamage).toHaveBeenCalledWith({
        entityId: 'instance-123',
        damageEntry: { type: 'slashing', amount: 10 },
        multiplier: 1.5,
        targetPartId: null, // random mode
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Damage applied successfully'
      );
    });

    it('should log error when damage application fails with result.success = false', async () => {
      mockExecutionService.applyDamage.mockResolvedValue({
        success: false,
        error: 'Invalid damage configuration',
      });

      await damageSimulatorUI.handleEntitySelection('core:human');
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Damage application failed:',
        'Invalid damage configuration'
      );
    });

    it('should log error when applyDamage throws an exception', async () => {
      const error = new Error('Network failure');
      mockExecutionService.applyDamage.mockRejectedValue(error);

      await damageSimulatorUI.handleEntitySelection('core:human');
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Error applying damage:',
        error
      );
    });

    it('should use specific target part when target mode is specific', async () => {
      // Set target mode to specific
      querySelectorSpy.mockReturnValue({ value: 'specific' });

      // Set child components FIRST so dropdown gets populated during handleEntitySelection
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      await damageSimulatorUI.handleEntitySelection('core:human');

      // Set target part value AFTER handleEntitySelection (which populates the dropdown)
      mockElements['target-part'].value = 'head';

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockExecutionService.applyDamage).toHaveBeenCalledWith({
        entityId: 'instance-123',
        damageEntry: { type: 'slashing', amount: 10 },
        multiplier: 1.5,
        targetPartId: 'head',
      });
    });
  });

  describe('Target Mode and Part Selection', () => {
    let querySelectorSpy;

    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      querySelectorSpy = jest.spyOn(document, 'querySelector');

      await damageSimulatorUI.initialize();
    });

    afterEach(() => {
      querySelectorSpy.mockRestore();
      jest.spyOn(document, 'querySelectorAll').mockRestore();
    });

    it('should return random when no radio is checked', async () => {
      querySelectorSpy.mockReturnValue(null);

      await damageSimulatorUI.handleEntitySelection('core:human');

      const mockExecutionService = {
        applyDamage: jest.fn().mockResolvedValue({ success: true }),
        getTargetableParts: jest.fn().mockReturnValue([]),
      };
      const mockDamageComposer = {
        getDamageEntry: jest.fn().mockReturnValue({ type: 'slashing', amount: 10 }),
        getDamageMultiplier: jest.fn().mockReturnValue(1.0),
      };
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockExecutionService.applyDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPartId: null, // random mode returns null
        })
      );
    });

    it('should return null for target part when targetPartSelect has no value', async () => {
      querySelectorSpy.mockReturnValue({ value: 'specific' });
      mockElements['target-part'].value = '';

      await damageSimulatorUI.handleEntitySelection('core:human');

      const mockExecutionService = {
        applyDamage: jest.fn().mockResolvedValue({ success: true }),
        getTargetableParts: jest.fn().mockReturnValue([]),
      };
      const mockDamageComposer = {
        getDamageEntry: jest.fn().mockReturnValue({ type: 'slashing', amount: 10 }),
        getDamageMultiplier: jest.fn().mockReturnValue(1.0),
      };
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);
      damageSimulatorUI.setChildComponent('damageComposer', mockDamageComposer);

      const applyBtn = mockElements['apply-damage-btn'];
      applyBtn.dispatchEvent(new Event('click'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Specific mode but no value selected returns null
      expect(mockExecutionService.applyDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPartId: null,
        })
      );
    });
  });

  describe('Target Part Dropdown Population', () => {
    let mockExecutionService;

    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      jest.spyOn(document, 'querySelector').mockReturnValue(null);

      mockExecutionService = {
        applyDamage: jest.fn().mockResolvedValue({ success: true }),
        getTargetableParts: jest.fn().mockReturnValue([
          { id: 'head', name: 'Head', weight: 10 },
          { id: 'torso', name: 'Torso', weight: 30 },
          { id: 'left_arm', name: 'Left Arm', weight: 15 },
        ]),
      };

      await damageSimulatorUI.initialize();
    });

    afterEach(() => {
      jest.spyOn(document, 'querySelectorAll').mockRestore();
      jest.spyOn(document, 'querySelector').mockRestore();
    });

    it('should populate dropdown with parts from executionService', async () => {
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);

      await damageSimulatorUI.handleEntitySelection('core:human');

      const targetPartSelect = mockElements['target-part'];

      expect(mockExecutionService.getTargetableParts).toHaveBeenCalledWith(
        'instance-123'
      );

      // Check that options were added
      const options = targetPartSelect.querySelectorAll('option');
      expect(options.length).toBe(4); // placeholder + 3 parts

      expect(options[1].value).toBe('head');
      expect(options[1].textContent).toBe('Head (weight: 10)');

      expect(options[2].value).toBe('torso');
      expect(options[2].textContent).toBe('Torso (weight: 30)');

      expect(options[3].value).toBe('left_arm');
      expect(options[3].textContent).toBe('Left Arm (weight: 15)');
    });

    it('should log the number of parts populated', async () => {
      damageSimulatorUI.setChildComponent('executionService', mockExecutionService);

      await damageSimulatorUI.handleEntitySelection('core:human');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DamageSimulatorUI] Populated 3 parts in target dropdown'
      );
    });

    it('should not populate when executionService is not set', async () => {
      // Don't set executionService
      const targetPartSelect = mockElements['target-part'];

      await damageSimulatorUI.handleEntitySelection('core:human');

      // Should only have placeholder
      expect(targetPartSelect.innerHTML).toBe(
        '<option value="">Select part...</option>'
      );
    });

    it('should early return when targetPartSelect element is missing', async () => {
      mockElements['target-part'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      // Re-initialize with missing element
      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      ui.setChildComponent('executionService', mockExecutionService);

      // Should not throw
      await ui.handleEntitySelection('core:human');

      // executionService.getTargetableParts should not be called
      expect(mockExecutionService.getTargetableParts).not.toHaveBeenCalled();
    });
  });

  describe('Clear Entity State', () => {
    let mockAnatomyRenderer;

    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      jest.spyOn(document, 'querySelector').mockReturnValue(null);

      mockAnatomyRenderer = {
        render: jest.fn(),
        clear: jest.fn(),
      };

      await damageSimulatorUI.initialize();
    });

    afterEach(() => {
      jest.spyOn(document, 'querySelectorAll').mockRestore();
      jest.spyOn(document, 'querySelector').mockRestore();
    });

    it('should call renderer.clear() when clearing entity with renderer set', async () => {
      damageSimulatorUI.setChildComponent('anatomyRenderer', mockAnatomyRenderer);

      // Load entity first
      await damageSimulatorUI.handleEntitySelection('core:human');
      expect(damageSimulatorUI.getCurrentEntityData()).not.toBeNull();

      // Clear entity
      await damageSimulatorUI.handleEntitySelection('');

      expect(mockAnatomyRenderer.clear).toHaveBeenCalled();
    });

    it('should reset targetPartSelect innerHTML when clearing entity', async () => {
      const targetPartSelect = mockElements['target-part'];

      // Add some options to simulate populated dropdown
      targetPartSelect.innerHTML =
        '<option value="">Select...</option><option value="head">Head</option>';

      // Load entity first
      await damageSimulatorUI.handleEntitySelection('core:human');

      // Clear entity
      await damageSimulatorUI.handleEntitySelection('');

      expect(targetPartSelect.innerHTML).toBe(
        '<option value="">Select part...</option>'
      );
    });

    it('should disable apply damage button when clearing entity', async () => {
      const applyBtn = mockElements['apply-damage-btn'];

      // Load entity (which enables button)
      await damageSimulatorUI.handleEntitySelection('core:human');
      expect(applyBtn.disabled).toBe(false);

      // Clear entity
      await damageSimulatorUI.handleEntitySelection('');

      expect(applyBtn.disabled).toBe(true);
    });

    it('should set anatomyTree placeholder when clearing entity', async () => {
      const anatomyTree = mockElements['anatomy-tree'];

      // Load entity first
      await damageSimulatorUI.handleEntitySelection('core:human');

      // Clear entity
      await damageSimulatorUI.handleEntitySelection('');

      expect(anatomyTree.innerHTML).toContain('Select an entity to view anatomy');
    });
  });

  describe('Enable Apply Damage Button', () => {
    beforeEach(async () => {
      damageSimulatorUI = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      jest.spyOn(document, 'querySelector').mockReturnValue(null);

      await damageSimulatorUI.initialize();
    });

    afterEach(() => {
      jest.spyOn(document, 'querySelectorAll').mockRestore();
      jest.spyOn(document, 'querySelector').mockRestore();
    });

    it('should enable apply damage button after entity loads', async () => {
      const applyBtn = mockElements['apply-damage-btn'];

      // Initially disabled
      expect(applyBtn.disabled).toBe(true);

      // Load entity
      await damageSimulatorUI.handleEntitySelection('core:human');

      // Should be enabled
      expect(applyBtn.disabled).toBe(false);
    });

    it('should handle missing apply button gracefully', async () => {
      mockElements['apply-damage-btn'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      // Should not throw when trying to enable/disable button
      await ui.handleEntitySelection('core:human');

      // No error should occur
      expect(ui.getCurrentState()).toBe('loaded');
    });
  });

  describe('Missing Element Branches', () => {
    beforeEach(async () => {
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      jest.spyOn(document, 'querySelector').mockReturnValue(null);
    });

    afterEach(() => {
      jest.spyOn(document, 'querySelectorAll').mockRestore();
      jest.spyOn(document, 'querySelector').mockRestore();
    });

    it('should handle missing anatomyTree in #showLoadingState gracefully', async () => {
      // Set anatomyTree to null
      mockElements['anatomy-tree'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      // handleEntitySelection calls #showLoadingState internally
      // Should not throw when anatomyTree is null
      await ui.handleEntitySelection('core:human');

      // Should still reach LOADED state
      expect(ui.getCurrentState()).toBe('loaded');
    });

    it('should handle missing anatomyTree in #showErrorState gracefully', async () => {
      // Set anatomyTree to null
      mockElements['anatomy-tree'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      // Mock loading to fail
      mockEntityLoadingService.loadEntityWithAnatomy.mockRejectedValue(
        new Error('Loading failed')
      );

      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      // handleEntitySelection calls #showErrorState when loading fails
      // Should not throw when anatomyTree is null
      await ui.handleEntitySelection('core:human');

      // Should be in ERROR state
      expect(ui.getCurrentState()).toBe('error');
    });

    it('should handle missing anatomyTree in #clearCurrentEntity gracefully', async () => {
      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      // Load entity first
      await ui.handleEntitySelection('core:human');

      // Now remove anatomyTree
      mockElements['anatomy-tree'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      // Clear entity (calls #clearCurrentEntity)
      // Note: #clearCurrentEntity uses cached #elements.anatomyTree, so we need fresh instance
      const ui2 = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui2.initialize();
      await ui2.handleEntitySelection('core:human');
      await ui2.handleEntitySelection(''); // Clear

      // Should not throw and should be in IDLE state
      expect(ui2.getCurrentState()).toBe('idle');
    });

    it('should handle missing targetPartSelect in #clearCurrentEntity gracefully', async () => {
      // Remove targetPartSelect
      mockElements['target-part'] = null;
      getElementByIdSpy.mockImplementation((id) => mockElements[id] || null);

      const ui = new DamageSimulatorUI({
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
        anatomyDataExtractor: mockAnatomyDataExtractor,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      await ui.initialize();

      // Load entity
      await ui.handleEntitySelection('core:human');

      // Clear entity (calls #clearCurrentEntity which has targetPartSelect check)
      await ui.handleEntitySelection('');

      // Should not throw and should be in IDLE state
      expect(ui.getCurrentState()).toBe('idle');
    });
  });
});
