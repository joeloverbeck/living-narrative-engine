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
    };

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
});
