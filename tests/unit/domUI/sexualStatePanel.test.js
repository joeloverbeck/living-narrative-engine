/**
 * @file Unit tests for the SexualStatePanel class.
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { SexualStatePanel } from '../../../src/domUI/sexualStatePanel.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../../../src/constants/eventIds.js';
import { SEXUAL_STATE_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockDocumentContext = () => ({
  query: jest.fn((sel) => document.querySelector(sel)),
  create: jest.fn((tag) => document.createElement(tag)),
});

const createMockVed = () => ({
  subscribe: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
});

const createMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
});

const createMockEmotionCalculatorService = () => ({
  calculateSexualArousal: jest.fn().mockReturnValue(0.5),
  calculateSexualStates: jest.fn().mockReturnValue(new Map()),
  getTopSexualStates: jest.fn().mockReturnValue([
    {
      name: 'romantic_yearning',
      displayName: 'romantic yearning',
      label: 'noticeable',
      intensity: 0.4,
    },
  ]),
  formatSexualStatesForPrompt: jest.fn().mockReturnValue('aroused'),
});

const createMockEntity = (hasSexualState = true, sexualStateData = null) => ({
  hasComponent: jest.fn((componentId) => {
    if (componentId === SEXUAL_STATE_COMPONENT_ID) return hasSexualState;
    return false;
  }),
  getComponentData: jest.fn((componentId) => {
    if (componentId === SEXUAL_STATE_COMPONENT_ID && hasSexualState) {
      return sexualStateData || createDefaultSexualStateData();
    }
    return null;
  }),
});

const createDefaultSexualStateData = () => ({
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
});

const createSexualStateData = (overrides = {}) => ({
  ...createDefaultSexualStateData(),
  ...overrides,
});

describe('SexualStatePanel', () => {
  let panelElement;
  let deps;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sexual-state-panel" class="widget hidden">
        <!-- Content rendered dynamically -->
      </div>
    `;
    panelElement = document.getElementById('sexual-state-panel');

    deps = {
      logger: createMockLogger(),
      documentContext: createMockDocumentContext(),
      validatedEventDispatcher: createMockVed(),
      entityManager: createMockEntityManager(),
      emotionCalculatorService: createMockEmotionCalculatorService(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to get the subscription callback for a given event ID.
   *
   * @param {string} eventId - The event ID to find
   * @returns {Function|null} The event handler callback or null if not found
   */
  const getEventHandler = (eventId) => {
    const subscribeCall = deps.validatedEventDispatcher.subscribe.mock.calls.find(
      (call) => call[0] === eventId
    );
    return subscribeCall ? subscribeCall[1] : null;
  };

  describe('constructor', () => {
    it('constructs and subscribes to TURN_STARTED_ID and COMPONENT_ADDED_ID events', () => {
      const panel = new SexualStatePanel(deps);

      expect(deps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        expect.any(Function)
      );
      expect(deps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.any(Function)
      );
      expect(panel.elements.panelElement).toBe(panelElement);
    });

    it('initializes with hidden state', () => {
      new SexualStatePanel(deps);
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('throws when entityManager is null', () => {
      deps.entityManager = null;
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EntityManager dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EntityManager dependency is missing')
      );
    });

    it('throws when entityManager lacks getEntityInstance method', () => {
      deps.entityManager = {};
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EntityManager must have getEntityInstance method.'
      );
    });

    it('throws when entityManager.getEntityInstance is not a function', () => {
      deps.entityManager = { getEntityInstance: 'not-a-function' };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EntityManager must have getEntityInstance method.'
      );
    });

    it('throws when emotionCalculatorService is null', () => {
      deps.emotionCalculatorService = null;
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EmotionCalculatorService dependency is missing')
      );
    });

    it('throws when emotionCalculatorService lacks calculateSexualArousal method', () => {
      deps.emotionCalculatorService = {
        calculateSexualStates: jest.fn(),
        getTopSexualStates: jest.fn(),
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have calculateSexualArousal method.'
      );
    });

    it('throws when emotionCalculatorService.calculateSexualArousal is not a function', () => {
      deps.emotionCalculatorService = {
        calculateSexualArousal: 'not-a-function',
        calculateSexualStates: jest.fn(),
        getTopSexualStates: jest.fn(),
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have calculateSexualArousal method.'
      );
    });

    it('throws when emotionCalculatorService lacks calculateSexualStates method', () => {
      deps.emotionCalculatorService = {
        calculateSexualArousal: jest.fn(),
        getTopSexualStates: jest.fn(),
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have calculateSexualStates method.'
      );
    });

    it('throws when emotionCalculatorService.calculateSexualStates is not a function', () => {
      deps.emotionCalculatorService = {
        calculateSexualArousal: jest.fn(),
        calculateSexualStates: 'not-a-function',
        getTopSexualStates: jest.fn(),
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have calculateSexualStates method.'
      );
    });

    it('throws when emotionCalculatorService lacks getTopSexualStates method', () => {
      deps.emotionCalculatorService = {
        calculateSexualArousal: jest.fn(),
        calculateSexualStates: jest.fn(),
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have getTopSexualStates method.'
      );
    });

    it('throws when emotionCalculatorService.getTopSexualStates is not a function', () => {
      deps.emotionCalculatorService = {
        calculateSexualArousal: jest.fn(),
        calculateSexualStates: jest.fn(),
        getTopSexualStates: 'not-a-function',
      };
      expect(() => new SexualStatePanel(deps)).toThrow(
        '[SexualStatePanel] EmotionCalculatorService must have getTopSexualStates method.'
      );
    });

    it('logs error when required DOM element is not bound', () => {
      const originalQuery = deps.documentContext.query;
      deps.documentContext.query = jest.fn((selector) => {
        if (selector === '#sexual-state-panel') {
          return null;
        }
        return originalQuery(selector);
      });

      new SexualStatePanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Required DOM element not bound')
      );
    });

    it('logs error when subscription fails', () => {
      deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      new SexualStatePanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to subscribe to events'),
        expect.any(Error)
      );
    });
  });

  describe('handleTurnStarted (via event)', () => {
    it('shows panel and renders sexual state data when actor has sexual_state component', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'test-entity' } });

      expect(deps.entityManager.getEntityInstance).toHaveBeenCalledWith('test-entity');
      expect(panelElement.classList.contains('hidden')).toBe(false);
      expect(panelElement.innerHTML).toContain('SEXUAL STATE');
    });

    it('hides panel when actor lacks sexual_state component', () => {
      const mockEntity = createMockEntity(false);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entity is not found', () => {
      deps.entityManager.getEntityInstance.mockReturnValue(null);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'nonexistent-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when payload is null', () => {
      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: null });

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expected entityId string in .payload.entityId was missing or invalid'),
        expect.any(Object)
      );
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when payload is empty object', () => {
      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: {} });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entityId is empty string', () => {
      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: '' } });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entityId is not a string', () => {
      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 123 } });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('handleComponentAdded (via event)', () => {
    it('re-renders when sexual_state component is added to current actor', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 30 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // First set the current actor
      turnHandler({ payload: { entityId: 'test-entity' } });

      // Clear previous calls
      deps.emotionCalculatorService.calculateSexualArousal.mockClear();

      // Trigger component added
      componentHandler({
        payload: { entityId: 'test-entity', componentId: SEXUAL_STATE_COMPONENT_ID },
      });

      // Should have re-rendered
      expect(deps.emotionCalculatorService.calculateSexualArousal).toHaveBeenCalled();
    });

    it('ignores component added events for other entities', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Set current actor
      turnHandler({ payload: { entityId: 'test-entity' } });
      deps.emotionCalculatorService.calculateSexualArousal.mockClear();

      // Trigger component added for different entity
      componentHandler({
        payload: { entityId: 'other-entity', componentId: SEXUAL_STATE_COMPONENT_ID },
      });

      // Should NOT have re-rendered
      expect(deps.emotionCalculatorService.calculateSexualArousal).not.toHaveBeenCalled();
    });

    it('ignores component added events for non-sexual_state components', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Set current actor
      turnHandler({ payload: { entityId: 'test-entity' } });
      deps.emotionCalculatorService.calculateSexualArousal.mockClear();

      // Trigger component added for different component
      componentHandler({
        payload: { entityId: 'test-entity', componentId: 'some:other:component' },
      });

      // Should NOT have re-rendered
      expect(deps.emotionCalculatorService.calculateSexualArousal).not.toHaveBeenCalled();
    });

    it('ignores events with missing payload properties', () => {
      new SexualStatePanel(deps);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Should not throw for various invalid payloads
      expect(() => componentHandler({ payload: null })).not.toThrow();
      expect(() => componentHandler({ payload: {} })).not.toThrow();
      expect(() => componentHandler({ payload: { entityId: 'test' } })).not.toThrow();
      expect(() => componentHandler({ payload: { componentId: 'test' } })).not.toThrow();
    });
  });

  describe('bar rendering', () => {
    it('renders all 3 bars (excitation, inhibition, arousal)', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const rows = panelElement.querySelectorAll('.sexual-state-panel__row');
      expect(rows.length).toBe(3);
    });

    it('renders excitation bar with correct percentage (0-100 scale)', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      // Find excitation row by label text
      const labels = panelElement.querySelectorAll('.sexual-state-panel__label');
      let excitationRow = null;
      labels.forEach((label) => {
        if (label.textContent === 'Excitation') {
          excitationRow = label.parentElement;
        }
      });

      const barFill = excitationRow.querySelector('.sexual-state-panel__bar-fill--excitation');
      expect(barFill).not.toBeNull();
      // 50% of 100 = 50%, minus 4px padding adjustment
      expect(barFill.style.width).toBe('calc(50% - 4px)');
    });

    it('renders inhibition bar with correct percentage (0-100 scale)', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_inhibition: 75 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      // Find inhibition row by label text
      const labels = panelElement.querySelectorAll('.sexual-state-panel__label');
      let inhibitionRow = null;
      labels.forEach((label) => {
        if (label.textContent === 'Inhibition') {
          inhibitionRow = label.parentElement;
        }
      });

      const barFill = inhibitionRow.querySelector('.sexual-state-panel__bar-fill--inhibition');
      expect(barFill).not.toBeNull();
      // 75% of 100 = 75%, minus 4px padding adjustment
      expect(barFill.style.width).toBe('calc(75% - 4px)');
    });

    it('renders arousal bar with correct percentage (0-1 scale)', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.5);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      // Find arousal row by label text
      const labels = panelElement.querySelectorAll('.sexual-state-panel__label');
      let arousalRow = null;
      labels.forEach((label) => {
        if (label.textContent === 'Arousal') {
          arousalRow = label.parentElement;
        }
      });

      const barFill = arousalRow.querySelector('.sexual-state-panel__bar-fill--arousal');
      expect(barFill).not.toBeNull();
      // 0.5 / 1 * 100 = 50%, minus 4px padding adjustment
      expect(barFill.style.width).toBe('calc(50% - 4px)');
    });

    it('clamps bar width to 0-100% range', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 150 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      // Find excitation row by label text
      const labels = panelElement.querySelectorAll('.sexual-state-panel__label');
      let excitationRow = null;
      labels.forEach((label) => {
        if (label.textContent === 'Excitation') {
          excitationRow = label.parentElement;
        }
      });

      const barFill = excitationRow.querySelector('.sexual-state-panel__bar-fill--excitation');
      // Should be clamped to 100%, minus 4px padding adjustment
      expect(barFill.style.width).toBe('calc(100% - 4px)');
    });

    it('displays excitation/inhibition values as integers', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 42, sex_inhibition: 28 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valueElements = panelElement.querySelectorAll('.sexual-state-panel__value');
      // First two should be excitation and inhibition (integers)
      expect(valueElements[0].textContent).toBe('42');
      expect(valueElements[1].textContent).toBe('28');
    });

    it('displays arousal value with 2 decimal places', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.75);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valueElements = panelElement.querySelectorAll('.sexual-state-panel__value');
      // Third should be arousal (2 decimal places)
      expect(valueElements[2].textContent).toBe('0.75');
    });

    it('handles missing sexual state data values gracefully (defaults to 0)', () => {
      const mockEntity = createMockEntity(true, { sex_excitation: 20 }); // Only excitation, others undefined
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // Should not throw
      expect(() => handler({ payload: { entityId: 'test-entity' } })).not.toThrow();

      // Should still render all bars
      const rows = panelElement.querySelectorAll('.sexual-state-panel__row');
      expect(rows.length).toBe(3);
    });
  });

  describe('baseline libido rendering', () => {
    it('renders baseline libido with + sign for positive values', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ baseline_libido: 25 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const baselineValue = panelElement.querySelector('.sexual-state-panel__baseline-value');
      expect(baselineValue.textContent).toBe('+25');
      expect(baselineValue.classList.contains('sexual-state-panel__baseline-value--positive')).toBe(true);
    });

    it('renders baseline libido without + sign for negative values', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ baseline_libido: -30 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const baselineValue = panelElement.querySelector('.sexual-state-panel__baseline-value');
      expect(baselineValue.textContent).toBe('-30');
      expect(baselineValue.classList.contains('sexual-state-panel__baseline-value--negative')).toBe(true);
    });

    it('renders baseline libido with + sign for zero value', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ baseline_libido: 0 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const baselineValue = panelElement.querySelector('.sexual-state-panel__baseline-value');
      expect(baselineValue.textContent).toBe('+0');
      // Zero value has neither positive nor negative class
      expect(baselineValue.classList.contains('sexual-state-panel__baseline-value--positive')).toBe(false);
      expect(baselineValue.classList.contains('sexual-state-panel__baseline-value--negative')).toBe(false);
    });

    it('renders baseline libido label', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const baselineLabel = panelElement.querySelector('.sexual-state-panel__baseline-label');
      expect(baselineLabel.textContent).toBe('Baseline Libido:');
    });
  });

  describe('sexual states text rendering', () => {
    it('renders calculated sexual states text below baseline', () => {
      const mockEntity = createMockEntity(true, createSexualStateData({ sex_excitation: 80 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopSexualStates.mockReturnValue([
        { name: 'aroused', displayName: 'aroused', label: 'strong', intensity: 0.7 },
        { name: 'passionate', displayName: 'passionate', label: 'noticeable', intensity: 0.5 },
      ]);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const statesContainer = panelElement.querySelector('.sexual-state-panel__states');
      expect(statesContainer).not.toBeNull();
      expect(statesContainer.textContent).toContain('aroused: strong');
      expect(statesContainer.textContent).toContain('passionate: noticeable');
    });

    it('calls emotionCalculatorService.calculateSexualArousal with sexual state data', () => {
      const sexualStateData = createSexualStateData({ sex_excitation: 60, sex_inhibition: 20 });
      const mockEntity = createMockEntity(true, sexualStateData);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(deps.emotionCalculatorService.calculateSexualArousal).toHaveBeenCalledWith(sexualStateData);
    });

    it('calls emotionCalculatorService.calculateSexualStates with null and arousal', () => {
      const sexualStateData = createSexualStateData();
      const mockEntity = createMockEntity(true, sexualStateData);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.calculateSexualArousal.mockReturnValue(0.65);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(deps.emotionCalculatorService.calculateSexualStates).toHaveBeenCalledWith(
        null,
        0.65,
        sexualStateData
      );
    });

    it('displays "Current: " label before sexual states', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopSexualStates.mockReturnValue([
        { name: 'interested', displayName: 'interested', label: 'mild', intensity: 0.2 },
      ]);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const statesLabel = panelElement.querySelector('.sexual-state-panel__states-label');
      expect(statesLabel.textContent).toBe('Current: ');
    });

    it('displays "neutral" when sexual states text is empty', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopSexualStates.mockReturnValue([]);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const statesContainer = panelElement.querySelector('.sexual-state-panel__states');
      expect(statesContainer.textContent).toBe('Current: neutral');
    });
  });

  describe('panel visibility', () => {
    it('shows panel when sexual_state component exists', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(false);
    });

    it('hides panel when sexual_state component does not exist', () => {
      const mockEntity = createMockEntity(false);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when switching from actor with sexual_state to actor without', () => {
      const entityWithSexualState = createMockEntity(true, createSexualStateData());
      const entityWithoutSexualState = createMockEntity(false);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor has sexual_state
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithSexualState);
      handler({ payload: { entityId: 'entity-with-sexual-state' } });
      expect(panelElement.classList.contains('hidden')).toBe(false);

      // Second actor lacks sexual_state
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithoutSexualState);
      handler({ payload: { entityId: 'entity-without-sexual-state' } });
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('clears content when hiding panel', () => {
      const entityWithSexualState = createMockEntity(true, createSexualStateData({ sex_excitation: 50 }));
      const entityWithoutSexualState = createMockEntity(false);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor has sexual_state - panel should have content
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithSexualState);
      handler({ payload: { entityId: 'entity-with-sexual-state' } });
      expect(panelElement.innerHTML).toContain('SEXUAL STATE');

      // Second actor lacks sexual_state - panel should be hidden
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithoutSexualState);
      handler({ payload: { entityId: 'entity-without-sexual-state' } });
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('disposes properly and clears elements', () => {
      const panel = new SexualStatePanel(deps);

      expect(panel.elements.panelElement).toBe(panelElement);

      panel.dispose();

      expect(panel.elements).toEqual({});
      expect(deps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bound DOM elements cleared')
      );
    });
  });

  describe('edge cases', () => {
    it('handles panel element becoming null after construction', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      const panel = new SexualStatePanel(deps);
      panel.elements.panelElement = null;

      const handler = getEventHandler(TURN_STARTED_ID);

      // Should not throw
      expect(() => handler({ payload: { entityId: 'test-entity' } })).not.toThrow();
    });

    it('updates correctly when actor changes', () => {
      const actor1 = createMockEntity(true, createSexualStateData({ sex_excitation: 30, sex_inhibition: 10 }));
      const actor2 = createMockEntity(true, createSexualStateData({ sex_excitation: 80, sex_inhibition: 5 }));

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor
      deps.entityManager.getEntityInstance.mockReturnValue(actor1);
      handler({ payload: { entityId: 'actor-1' } });

      let valueElements = panelElement.querySelectorAll('.sexual-state-panel__value');
      expect(valueElements[0].textContent).toBe('30'); // excitation
      expect(valueElements[1].textContent).toBe('10'); // inhibition

      // Second actor
      deps.entityManager.getEntityInstance.mockReturnValue(actor2);
      handler({ payload: { entityId: 'actor-2' } });

      valueElements = panelElement.querySelectorAll('.sexual-state-panel__value');
      expect(valueElements[0].textContent).toBe('80'); // excitation
      expect(valueElements[1].textContent).toBe('5');  // inhibition
    });

    it('renders title element', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const title = panelElement.querySelector('.sexual-state-panel__title');
      expect(title).not.toBeNull();
      expect(title.textContent).toBe('SEXUAL STATE');
    });

    it('handles arousal being null gracefully', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.calculateSexualArousal.mockReturnValue(null);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // Should not throw
      expect(() => handler({ payload: { entityId: 'test-entity' } })).not.toThrow();

      // Arousal bar should display 0.00
      const valueElements = panelElement.querySelectorAll('.sexual-state-panel__value');
      expect(valueElements[2].textContent).toBe('0.00');
    });

    it('renders divider between bars and baseline', () => {
      const mockEntity = createMockEntity(true, createSexualStateData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new SexualStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const divider = panelElement.querySelector('.sexual-state-panel__divider');
      expect(divider).not.toBeNull();
    });
  });
});
