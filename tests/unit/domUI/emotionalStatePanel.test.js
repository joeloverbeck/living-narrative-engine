/**
 * @file Unit tests for the EmotionalStatePanel class.
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { EmotionalStatePanel } from '../../../src/domUI/emotionalStatePanel.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../../../src/constants/eventIds.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

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
  calculateEmotions: jest.fn().mockReturnValue(new Map()),
  calculateSexualArousal: jest.fn().mockReturnValue(0),
  getTopEmotions: jest.fn().mockReturnValue([
    {
      name: 'calm',
      displayName: 'calm',
      label: 'mild',
      intensity: 0.2,
    },
  ]),
  formatEmotionsForPrompt: jest.fn().mockReturnValue('calm'),
});

const createMockEntity = (
  hasMood = true,
  moodData = null,
  hasSexualState = true,
  sexualStateData = null,
  entityId = 'test-entity'
) => ({
  id: entityId,
  hasComponent: jest.fn((componentId) => {
    if (componentId === MOOD_COMPONENT_ID) return hasMood;
    if (componentId === SEXUAL_STATE_COMPONENT_ID) return hasSexualState;
    return false;
  }),
  getComponentData: jest.fn((componentId) => {
    if (componentId === MOOD_COMPONENT_ID && hasMood) {
      return moodData || createDefaultMoodData();
    }
    if (componentId === SEXUAL_STATE_COMPONENT_ID && hasSexualState) {
      return sexualStateData || createDefaultSexualStateData();
    }
    return null;
  }),
});

const createDefaultMoodData = () => ({
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
});

const createMoodData = (overrides = {}) => ({
  ...createDefaultMoodData(),
  ...overrides,
});

const createDefaultSexualStateData = () => ({
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
});

describe('EmotionalStatePanel', () => {
  let panelElement;
  let deps;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="emotional-state-panel" class="widget hidden">
        <!-- Content rendered dynamically -->
      </div>
    `;
    panelElement = document.getElementById('emotional-state-panel');

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
      const panel = new EmotionalStatePanel(deps);

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
      new EmotionalStatePanel(deps);
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('throws when entityManager is null', () => {
      deps.entityManager = null;
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EntityManager dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EntityManager dependency is missing')
      );
    });

    it('throws when entityManager lacks getEntityInstance method', () => {
      deps.entityManager = {};
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EntityManager must have getEntityInstance method.'
      );
    });

    it('throws when entityManager.getEntityInstance is not a function', () => {
      deps.entityManager = { getEntityInstance: 'not-a-function' };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EntityManager must have getEntityInstance method.'
      );
    });

    it('throws when emotionCalculatorService is null', () => {
      deps.emotionCalculatorService = null;
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EmotionCalculatorService dependency is missing')
      );
    });

    it('throws when emotionCalculatorService lacks calculateEmotions method', () => {
      deps.emotionCalculatorService = { getTopEmotions: jest.fn() };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have calculateEmotions method.'
      );
    });

    it('throws when emotionCalculatorService.calculateEmotions is not a function', () => {
      deps.emotionCalculatorService = {
        calculateEmotions: 'not-a-function',
        calculateSexualArousal: jest.fn(),
        getTopEmotions: jest.fn(),
      };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have calculateEmotions method.'
      );
    });

    it('throws when emotionCalculatorService lacks calculateSexualArousal method', () => {
      deps.emotionCalculatorService = {
        calculateEmotions: jest.fn(),
        getTopEmotions: jest.fn(),
      };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have calculateSexualArousal method.'
      );
    });

    it('throws when emotionCalculatorService.calculateSexualArousal is not a function', () => {
      deps.emotionCalculatorService = {
        calculateEmotions: jest.fn(),
        calculateSexualArousal: 'not-a-function',
        getTopEmotions: jest.fn(),
      };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have calculateSexualArousal method.'
      );
    });

    it('throws when emotionCalculatorService lacks getTopEmotions method', () => {
      deps.emotionCalculatorService = {
        calculateEmotions: jest.fn(),
        calculateSexualArousal: jest.fn(),
      };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have getTopEmotions method.'
      );
    });

    it('throws when emotionCalculatorService.getTopEmotions is not a function', () => {
      deps.emotionCalculatorService = {
        calculateEmotions: jest.fn(),
        calculateSexualArousal: jest.fn(),
        getTopEmotions: 'not-a-function',
      };
      expect(() => new EmotionalStatePanel(deps)).toThrow(
        '[EmotionalStatePanel] EmotionCalculatorService must have getTopEmotions method.'
      );
    });

    it('logs error when required DOM element is not bound', () => {
      const originalQuery = deps.documentContext.query;
      deps.documentContext.query = jest.fn((selector) => {
        if (selector === '#emotional-state-panel') {
          return null;
        }
        return originalQuery(selector);
      });

      new EmotionalStatePanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Required DOM element not bound')
      );
    });

    it('logs error when subscription fails', () => {
      deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      new EmotionalStatePanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to subscribe to events'),
        expect.any(Error)
      );
    });
  });

  describe('handleTurnStarted (via event)', () => {
    it('shows panel and renders mood data when actor has mood component', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'test-entity' } });

      expect(deps.entityManager.getEntityInstance).toHaveBeenCalledWith('test-entity');
      expect(panelElement.classList.contains('hidden')).toBe(false);
      expect(panelElement.innerHTML).toContain('EMOTIONAL STATE');
    });

    it('hides panel when actor lacks mood component', () => {
      const mockEntity = createMockEntity(false);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entity is not found', () => {
      deps.entityManager.getEntityInstance.mockReturnValue(null);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 'nonexistent-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when payload is null', () => {
      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: null });

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expected entityId string in .payload.entityId was missing or invalid'),
        expect.any(Object)
      );
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when payload is empty object', () => {
      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: {} });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entityId is empty string', () => {
      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: '' } });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when entityId is not a string', () => {
      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      handler({ payload: { entityId: 123 } });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('handleComponentAdded (via event)', () => {
    it('re-renders when mood component is added with entity object (production format)', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 30 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // First set the current actor
      turnHandler({ payload: { entityId: 'test-entity' } });

      // Clear previous calls
      deps.emotionCalculatorService.calculateEmotions.mockClear();

      // Trigger component added with entity OBJECT (actual MoodPersistenceService format)
      componentHandler({
        payload: { entity: mockEntity, componentTypeId: MOOD_COMPONENT_ID },
      });

      // Should have re-rendered
      expect(deps.emotionCalculatorService.calculateEmotions).toHaveBeenCalled();
    });

    it('re-renders when mood component is added with string entity ID (backward compatibility)', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 30 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // First set the current actor
      turnHandler({ payload: { entityId: 'test-entity' } });

      // Clear previous calls
      deps.emotionCalculatorService.calculateEmotions.mockClear();

      // Trigger component added with string entity ID (backward compatibility)
      componentHandler({
        payload: { entity: 'test-entity', componentTypeId: MOOD_COMPONENT_ID },
      });

      // Should have re-rendered
      expect(deps.emotionCalculatorService.calculateEmotions).toHaveBeenCalled();
    });

    it('ignores component added events for other entities', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Set current actor
      turnHandler({ payload: { entityId: 'test-entity' } });
      deps.emotionCalculatorService.calculateEmotions.mockClear();

      // Trigger component added for different entity
      componentHandler({
        payload: { entity: 'other-entity', componentTypeId: MOOD_COMPONENT_ID },
      });

      // Should NOT have re-rendered
      expect(deps.emotionCalculatorService.calculateEmotions).not.toHaveBeenCalled();
    });

    it('ignores component added events for non-mood components', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const turnHandler = getEventHandler(TURN_STARTED_ID);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Set current actor
      turnHandler({ payload: { entityId: 'test-entity' } });
      deps.emotionCalculatorService.calculateEmotions.mockClear();

      // Trigger component added for different component
      componentHandler({
        payload: { entity: 'test-entity', componentTypeId: 'some:other:component' },
      });

      // Should NOT have re-rendered
      expect(deps.emotionCalculatorService.calculateEmotions).not.toHaveBeenCalled();
    });

    it('ignores events with missing payload properties', () => {
      new EmotionalStatePanel(deps);
      const componentHandler = getEventHandler(COMPONENT_ADDED_ID);

      // Should not throw for various invalid payloads (now checks for entity and componentTypeId)
      expect(() => componentHandler({ payload: null })).not.toThrow();
      expect(() => componentHandler({ payload: {} })).not.toThrow();
      expect(() => componentHandler({ payload: { entity: 'test' } })).not.toThrow();
      expect(() => componentHandler({ payload: { componentTypeId: 'test' } })).not.toThrow();
    });
  });

  describe('bar rendering', () => {
    it('renders all 8 mood axes', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const axes = panelElement.querySelectorAll('.emotional-state-panel__axis');
      expect(axes.length).toBe(8);
    });

    it('renders positive value bars extending right from center', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barFill = valenceAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.classList.contains('emotional-state-panel__bar-fill--positive')).toBe(true);
      expect(barFill.style.width).toBe('25%'); // 50/100 * 50% = 25%
    });

    it('renders negative value bars extending left from center', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: -50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barFill = valenceAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.classList.contains('emotional-state-panel__bar-fill--negative')).toBe(true);
      expect(barFill.style.width).toBe('25%');
    });

    it('renders no bar fill for zero values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 0 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barFill = valenceAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill).toBeNull();
    });

    it('renders maximum positive value correctly', () => {
      const mockEntity = createMockEntity(true, createMoodData({ arousal: 100 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const arousalAxis = panelElement.querySelector('[data-axis="arousal"]');
      const barFill = arousalAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.style.width).toBe('50%'); // 100/100 * 50% = 50%
    });

    it('renders maximum negative value correctly', () => {
      const mockEntity = createMockEntity(true, createMoodData({ threat: -100 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const threatAxis = panelElement.querySelector('[data-axis="threat"]');
      const barFill = threatAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.style.width).toBe('50%');
      expect(barFill.classList.contains('emotional-state-panel__bar-fill--negative')).toBe(true);
    });

    it('displays value with + sign for positive values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 42 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const valueDisplay = valenceAxis.querySelector('.emotional-state-panel__value');

      expect(valueDisplay.textContent).toBe('+42');
    });

    it('displays value without + sign for negative values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: -35 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const valueDisplay = valenceAxis.querySelector('.emotional-state-panel__value');

      expect(valueDisplay.textContent).toBe('-35');
    });

    it('displays +0 for zero values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 0 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const valueDisplay = valenceAxis.querySelector('.emotional-state-panel__value');

      expect(valueDisplay.textContent).toBe('+0');
    });

    it('applies correct colors for positive values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barFill = valenceAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.style.backgroundColor).toBe('rgb(40, 167, 69)'); // #28a745
    });

    it('applies correct colors for negative values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: -50 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barFill = valenceAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.style.backgroundColor).toBe('rgb(220, 53, 69)'); // #dc3545
    });

    it('renders axis labels correctly', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const leftLabel = valenceAxis.querySelector('.emotional-state-panel__label--left');
      const rightLabel = valenceAxis.querySelector('.emotional-state-panel__label--right');

      expect(leftLabel.textContent).toBe('Unpleasant');
      expect(rightLabel.textContent).toBe('Pleasant');
    });

    it('renders center marker for each axis', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const axes = panelElement.querySelectorAll('.emotional-state-panel__axis');
      axes.forEach((axis) => {
        const centerMarker = axis.querySelector('.emotional-state-panel__bar-center');
        expect(centerMarker).not.toBeNull();
      });
    });

    it('adds tooltip with value to bar container for positive values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 42 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barContainer = valenceAxis.querySelector('.emotional-state-panel__bar-container');

      expect(barContainer.title).toBe('Unpleasant ← +42 → Pleasant');
    });

    it('adds tooltip with value to bar container for negative values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: -35 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barContainer = valenceAxis.querySelector('.emotional-state-panel__bar-container');

      expect(barContainer.title).toBe('Unpleasant ← -35 → Pleasant');
    });

    it('adds tooltip with value to bar container for zero values', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 0 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      const barContainer = valenceAxis.querySelector('.emotional-state-panel__bar-container');

      expect(barContainer.title).toBe('Unpleasant ← +0 → Pleasant');
    });

    it('adds aria-label for accessibility on bar container', () => {
      const mockEntity = createMockEntity(true, createMoodData({ agency_control: 75 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const agencyAxis = panelElement.querySelector('[data-axis="agency_control"]');
      const barContainer = agencyAxis.querySelector('.emotional-state-panel__bar-container');

      // aria-label should replace underscores with spaces for readability
      expect(barContainer.getAttribute('aria-label')).toBe('agency control: +75');
    });

    it('handles missing mood data values gracefully', () => {
      const mockEntity = createMockEntity(true, { valence: 20 }); // Only valence, others undefined
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // Should not throw
      expect(() => handler({ payload: { entityId: 'test-entity' } })).not.toThrow();

      // Should still render all axes, with missing values treated as 0
      const axes = panelElement.querySelectorAll('.emotional-state-panel__axis');
      expect(axes.length).toBe(8);
    });

    it('renders affiliation axis with correct labels', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const affiliationAxis = panelElement.querySelector('[data-axis="affiliation"]');
      expect(affiliationAxis).not.toBeNull();

      const leftLabel = affiliationAxis.querySelector('.emotional-state-panel__label--left');
      const rightLabel = affiliationAxis.querySelector('.emotional-state-panel__label--right');

      expect(leftLabel.textContent).toBe('Detached');
      expect(rightLabel.textContent).toBe('Connected');
    });

    it('renders affiliation positive value with correct color', () => {
      const mockEntity = createMockEntity(true, createMoodData({ affiliation: 75 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const affiliationAxis = panelElement.querySelector('[data-axis="affiliation"]');
      const barFill = affiliationAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.classList.contains('emotional-state-panel__bar-fill--positive')).toBe(true);
      expect(barFill.style.backgroundColor).toBe('rgb(232, 62, 140)'); // #e83e8c
    });

    it('renders affiliation negative value with correct color', () => {
      const mockEntity = createMockEntity(true, createMoodData({ affiliation: -60 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const affiliationAxis = panelElement.querySelector('[data-axis="affiliation"]');
      const barFill = affiliationAxis.querySelector('.emotional-state-panel__bar-fill');

      expect(barFill.classList.contains('emotional-state-panel__bar-fill--negative')).toBe(true);
      expect(barFill.style.backgroundColor).toBe('rgb(78, 115, 223)'); // #4e73df
    });

    it('renders affiliation axis in correct position (8th)', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const axes = panelElement.querySelectorAll('.emotional-state-panel__axis');
      const lastAxis = axes[axes.length - 1];

      expect(lastAxis.getAttribute('data-axis')).toBe('affiliation');
    });
  });

  describe('emotions text rendering', () => {
    it('renders calculated emotions text below bars', () => {
      const mockEntity = createMockEntity(true, createMoodData({ valence: 50, arousal: 30 }));
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopEmotions.mockReturnValue([
        { name: 'happy', displayName: 'happy', label: 'mild', intensity: 0.3 },
        { name: 'excited', displayName: 'excited', label: 'noticeable', intensity: 0.5 },
      ]);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const emotionsContainer = panelElement.querySelector('.emotional-state-panel__emotions');
      expect(emotionsContainer).not.toBeNull();
      expect(emotionsContainer.textContent).toContain('happy: mild');
      expect(emotionsContainer.textContent).toContain('excited: noticeable');
    });

    it('calls emotionCalculatorService with mood data', () => {
      const moodData = createMoodData({ valence: 25, arousal: -15 });
      const sexualStateData = createDefaultSexualStateData();
      const mockEntity = createMockEntity(true, moodData, true, sexualStateData);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(deps.emotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0,
        sexualStateData
      );
    });

    it('displays "Current: " label before emotions', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopEmotions.mockReturnValue([
        { name: 'calm', displayName: 'calm', label: 'mild', intensity: 0.2 },
      ]);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const emotionsLabel = panelElement.querySelector('.emotional-state-panel__emotions-label');
      expect(emotionsLabel.textContent).toBe('Current: ');
    });

    it('displays "neutral" when emotions text is empty', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);
      deps.emotionCalculatorService.getTopEmotions.mockReturnValue([]);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const emotionsContainer = panelElement.querySelector('.emotional-state-panel__emotions');
      expect(emotionsContainer.textContent).toBe('Current: neutral');
    });
  });

  describe('panel visibility', () => {
    it('shows panel when mood component exists', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(false);
    });

    it('hides panel when mood component does not exist', () => {
      const mockEntity = createMockEntity(false);
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('hides panel when switching from actor with mood to actor without', () => {
      const entityWithMood = createMockEntity(true, createMoodData());
      const entityWithoutMood = createMockEntity(false);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor has mood
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithMood);
      handler({ payload: { entityId: 'entity-with-mood' } });
      expect(panelElement.classList.contains('hidden')).toBe(false);

      // Second actor lacks mood
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithoutMood);
      handler({ payload: { entityId: 'entity-without-mood' } });
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });

    it('clears content when hiding panel', () => {
      const entityWithMood = createMockEntity(true, createMoodData({ valence: 50 }));
      const entityWithoutMood = createMockEntity(false);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor has mood - panel should have content
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithMood);
      handler({ payload: { entityId: 'entity-with-mood' } });
      expect(panelElement.innerHTML).toContain('EMOTIONAL STATE');

      // Second actor lacks mood - panel should be hidden
      deps.entityManager.getEntityInstance.mockReturnValue(entityWithoutMood);
      handler({ payload: { entityId: 'entity-without-mood' } });
      expect(panelElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('disposes properly and clears elements', () => {
      const panel = new EmotionalStatePanel(deps);

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
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      const panel = new EmotionalStatePanel(deps);
      panel.elements.panelElement = null;

      const handler = getEventHandler(TURN_STARTED_ID);

      // Should not throw
      expect(() => handler({ payload: { entityId: 'test-entity' } })).not.toThrow();
    });

    it('updates correctly when actor changes', () => {
      const actor1 = createMockEntity(true, createMoodData({ valence: 30 }));
      const actor2 = createMockEntity(true, createMoodData({ valence: -70 }));

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);

      // First actor
      deps.entityManager.getEntityInstance.mockReturnValue(actor1);
      handler({ payload: { entityId: 'actor-1' } });

      let valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      let valueDisplay = valenceAxis.querySelector('.emotional-state-panel__value');
      expect(valueDisplay.textContent).toBe('+30');

      // Second actor
      deps.entityManager.getEntityInstance.mockReturnValue(actor2);
      handler({ payload: { entityId: 'actor-2' } });

      valenceAxis = panelElement.querySelector('[data-axis="valence"]');
      valueDisplay = valenceAxis.querySelector('.emotional-state-panel__value');
      expect(valueDisplay.textContent).toBe('-70');
    });

    it('renders title element', () => {
      const mockEntity = createMockEntity(true, createMoodData());
      deps.entityManager.getEntityInstance.mockReturnValue(mockEntity);

      new EmotionalStatePanel(deps);
      const handler = getEventHandler(TURN_STARTED_ID);
      handler({ payload: { entityId: 'test-entity' } });

      const title = panelElement.querySelector('.emotional-state-panel__title');
      expect(title).not.toBeNull();
      expect(title.textContent).toBe('EMOTIONAL STATE');
    });
  });
});
