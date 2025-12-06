/**
 * @file Unit tests for the InjuryStatusPanel class.
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { InjuryStatusPanel } from '../../../src/domUI/injuryStatusPanel.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';

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

const createMockInjuryAggregationService = () => ({
  aggregateInjuries: jest.fn().mockReturnValue({
    entityId: 'test-entity',
    injuredParts: [],
    bleedingParts: [],
    burningParts: [],
    poisonedParts: [],
    fracturedParts: [],
    destroyedParts: [],
    overallHealthPercentage: 100,
    isDying: false,
    isDead: false,
    dyingTurnsRemaining: 0,
    causeOfDeath: null,
  }),
});

const createMockInjuryNarrativeFormatterService = () => ({
  formatFirstPerson: jest.fn().mockReturnValue(''),
});

const createHealthySummary = () => ({
  entityId: 'test-entity',
  injuredParts: [],
  bleedingParts: [],
  burningParts: [],
  poisonedParts: [],
  fracturedParts: [],
  destroyedParts: [],
  overallHealthPercentage: 100,
  isDying: false,
  isDead: false,
  dyingTurnsRemaining: 0,
  causeOfDeath: null,
});

const createInjuredSummary = (overrides = {}) => ({
  entityId: 'test-entity',
  injuredParts: [{ partName: 'arm', damage: 30 }],
  bleedingParts: [],
  burningParts: [],
  poisonedParts: [],
  fracturedParts: [],
  destroyedParts: [],
  overallHealthPercentage: 70,
  isDying: false,
  isDead: false,
  dyingTurnsRemaining: 0,
  causeOfDeath: null,
  ...overrides,
});

describe('InjuryStatusPanel', () => {
  let narrativeElement;
  let contentElement;
  let deps;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="injury-status-widget">
        <h3 id="injury-status-heading">Physical Condition</h3>
        <div id="injury-status-content">
          <div id="injury-narrative"></div>
        </div>
      </div>
    `;
    narrativeElement = document.getElementById('injury-narrative');
    contentElement = document.getElementById('injury-status-content');

    deps = {
      logger: createMockLogger(),
      documentContext: createMockDocumentContext(),
      validatedEventDispatcher: createMockVed(),
      injuryAggregationService: createMockInjuryAggregationService(),
      injuryNarrativeFormatterService:
        createMockInjuryNarrativeFormatterService(),
    };
  });

  /**
   * Helper to get the dynamically created narrative element from contentElement
   */
  const getNarrativeElement = () =>
    contentElement.querySelector('#injury-narrative');

  /**
   * Helper to get the health bar wrapper from contentElement
   */
  const getHealthBarWrapper = () =>
    contentElement.querySelector('.health-bar-wrapper');

  /**
   * Helper to get the health bar fill from contentElement
   */
  const getHealthBarFill = () =>
    contentElement.querySelector('.health-bar-fill');

  /**
   * Helper to get the health percentage text from contentElement
   */
  const getHealthPercentageText = () =>
    contentElement.querySelector('.health-percentage-text');

  describe('constructor', () => {
    it('constructs and subscribes to TURN_STARTED_ID event', () => {
      const panel = new InjuryStatusPanel(deps);
      expect(deps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        expect.any(Function)
      );
      expect(panel.elements.narrativeElement).toBe(narrativeElement);
      expect(panel.elements.contentElement).toBe(contentElement);
    });

    it('initializes with healthy state by default including 100% health bar', () => {
      new InjuryStatusPanel(deps);
      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.textContent).toBe('I feel fine.');
      expect(narrativeEl.className).toBe('injury-healthy-message');

      // Verify health bar shows 100%
      const healthBar = getHealthBarWrapper();
      expect(healthBar).not.toBeNull();
      expect(healthBar.classList.contains('severity-healthy')).toBe(true);
      expect(getHealthBarFill().style.width).toBe('100%');
      expect(getHealthPercentageText().textContent).toBe('100%');
    });

    it('throws when injuryAggregationService is null', () => {
      deps.injuryAggregationService = null;
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryAggregationService dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'InjuryAggregationService dependency is missing'
        )
      );
    });

    it('throws when injuryAggregationService lacks aggregateInjuries method', () => {
      deps.injuryAggregationService = {};
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryAggregationService must have aggregateInjuries method.'
      );
    });

    it('throws when injuryAggregationService.aggregateInjuries is not a function', () => {
      deps.injuryAggregationService = { aggregateInjuries: 'not-a-function' };
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryAggregationService must have aggregateInjuries method.'
      );
    });

    it('throws when injuryNarrativeFormatterService is null', () => {
      deps.injuryNarrativeFormatterService = null;
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryNarrativeFormatterService dependency is missing.'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'InjuryNarrativeFormatterService dependency is missing'
        )
      );
    });

    it('throws when injuryNarrativeFormatterService lacks formatFirstPerson method', () => {
      deps.injuryNarrativeFormatterService = {};
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryNarrativeFormatterService must have formatFirstPerson method.'
      );
    });

    it('throws when injuryNarrativeFormatterService.formatFirstPerson is not a function', () => {
      deps.injuryNarrativeFormatterService = {
        formatFirstPerson: 'not-a-function',
      };
      expect(() => new InjuryStatusPanel(deps)).toThrow(
        '[InjuryStatusPanel] InjuryNarrativeFormatterService must have formatFirstPerson method.'
      );
    });

    it('logs error when required DOM elements are not bound', () => {
      const originalQuery = deps.documentContext.query;
      deps.documentContext.query = jest.fn((selector) => {
        if (selector === '#injury-narrative') {
          return null;
        }
        return originalQuery(selector);
      });

      new InjuryStatusPanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('One or more required DOM elements not bound')
      );
    });

    it('logs error when subscription to TURN_STARTED_ID fails', () => {
      deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      new InjuryStatusPanel(deps);

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to subscribe to ${TURN_STARTED_ID}`),
        expect.any(Error)
      );
    });
  });

  describe('handleTurnStarted (via event)', () => {
    it('updates panel with actor injury status when event is valid', () => {
      const summary = createInjuredSummary();
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My arm hurts.'
      );

      new InjuryStatusPanel(deps);

      // Get the subscription callback and call it
      const subscribeCall =
        deps.validatedEventDispatcher.subscribe.mock.calls.find(
          (call) => call[0] === TURN_STARTED_ID
        );
      const handler = subscribeCall[1];

      handler({ payload: { entityId: 'test-entity' } });

      expect(
        deps.injuryAggregationService.aggregateInjuries
      ).toHaveBeenCalledWith('test-entity');
      expect(
        deps.injuryNarrativeFormatterService.formatFirstPerson
      ).toHaveBeenCalledWith(summary);
      expect(getNarrativeElement().textContent).toBe('My arm hurts.');
    });

    it('renders healthy state when payload is null', () => {
      new InjuryStatusPanel(deps);

      const subscribeCall =
        deps.validatedEventDispatcher.subscribe.mock.calls.find(
          (call) => call[0] === TURN_STARTED_ID
        );
      const handler = subscribeCall[1];

      handler({ payload: null });

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Expected entityId string in .payload.entityId was missing or invalid'
        ),
        expect.objectContaining({ receivedData: { payload: null } })
      );
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });

    it('renders healthy state when payload is empty object', () => {
      new InjuryStatusPanel(deps);

      const subscribeCall =
        deps.validatedEventDispatcher.subscribe.mock.calls.find(
          (call) => call[0] === TURN_STARTED_ID
        );
      const handler = subscribeCall[1];

      handler({ payload: {} });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });

    it('renders healthy state when entityId is empty string', () => {
      new InjuryStatusPanel(deps);

      const subscribeCall =
        deps.validatedEventDispatcher.subscribe.mock.calls.find(
          (call) => call[0] === TURN_STARTED_ID
        );
      const handler = subscribeCall[1];

      handler({ payload: { entityId: '' } });

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Expected entityId string in .payload.entityId was missing or invalid'
        ),
        expect.objectContaining({ receivedData: { payload: { entityId: '' } } })
      );
    });

    it('renders healthy state when entityId is not a string', () => {
      new InjuryStatusPanel(deps);

      const subscribeCall =
        deps.validatedEventDispatcher.subscribe.mock.calls.find(
          (call) => call[0] === TURN_STARTED_ID
        );
      const handler = subscribeCall[1];

      handler({ payload: { entityId: 123 } });

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });
  });

  describe('updateForActor', () => {
    it('updates panel for valid entityId', () => {
      const summary = createInjuredSummary();
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My arm is wounded.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('hero-123');

      expect(
        deps.injuryAggregationService.aggregateInjuries
      ).toHaveBeenCalledWith('hero-123');
      expect(getNarrativeElement().textContent).toBe('My arm is wounded.');
    });

    it('renders healthy state when entityId is null', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor(null);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('updateForActor called with invalid entityId'),
        expect.objectContaining({ entityId: null })
      );
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });

    it('renders healthy state when entityId is undefined', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor(undefined);

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });

    it('renders healthy state when entityId is not a string', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor(42);

      expect(deps.logger.warn).toHaveBeenCalled();
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });

    it('renders healthy state when aggregation throws error', () => {
      deps.injuryAggregationService.aggregateInjuries.mockImplementation(() => {
        throw new Error('Aggregation failed');
      });

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('hero-123');

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error aggregating injuries for entity hero-123'
        ),
        expect.any(Error)
      );
      expect(getNarrativeElement().textContent).toBe('I feel fine.');
    });
  });

  describe('renderSummary (via updateForActor)', () => {
    it('renders healthy state when no injuries', () => {
      const summary = createHealthySummary();
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('healthy-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.textContent).toBe('I feel fine.');
      expect(narrativeEl.className).toBe('injury-healthy-message');
    });

    it('renders dead state when isDead is true', () => {
      const summary = createInjuredSummary({
        isDead: true,
        causeOfDeath: 'massive trauma',
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('dead-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.className).toBe('injury-dead');
      expect(narrativeEl.innerHTML).toContain('I am dead');
      expect(narrativeEl.innerHTML).toContain('(massive trauma)');
      // Verify 0% health bar for dead state
      expect(getHealthBarFill().style.width).toBe('0%');
      expect(getHealthPercentageText().textContent).toBe('0%');
    });

    it('renders dead state without cause when causeOfDeath is null', () => {
      const summary = createInjuredSummary({
        isDead: true,
        causeOfDeath: null,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('dead-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.innerHTML).toContain('I am dead');
      expect(narrativeEl.innerHTML).not.toContain('(');
    });

    it('renders dying state with countdown', () => {
      const summary = createInjuredSummary({
        isDying: true,
        dyingTurnsRemaining: 3,
        overallHealthPercentage: 15,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I am bleeding out.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('dying-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.className).toBe('injury-dying');
      expect(narrativeEl.innerHTML).toContain("I'm dying!");
      expect(narrativeEl.innerHTML).toContain('3 turns remaining');
      expect(narrativeEl.innerHTML).toContain('I am bleeding out.');
      // Verify health bar shows 15%
      expect(getHealthBarFill().style.width).toBe('15%');
      expect(getHealthPercentageText().textContent).toBe('15%');
    });

    it('renders dying state with singular turn text when 1 turn remaining', () => {
      const summary = createInjuredSummary({
        isDying: true,
        dyingTurnsRemaining: 1,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        ''
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('dying-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.innerHTML).toContain('1 turn remaining');
      expect(narrativeEl.innerHTML).not.toContain('turns remaining');
    });

    it('renders dying state without narrative when formatFirstPerson returns empty', () => {
      const summary = createInjuredSummary({
        isDying: true,
        dyingTurnsRemaining: 2,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        ''
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('dying-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.innerHTML).toContain("I'm dying! 2 turns remaining.");
    });

    it('renders with severity-destroyed class when destroyedParts exist', () => {
      const summary = createInjuredSummary({
        destroyedParts: [{ partName: 'left arm' }],
        overallHealthPercentage: 50,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My arm is gone!'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('maimed-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-destroyed')).toBe(true);
    });

    it('renders with severity-healthy class when health >= 90%', () => {
      const summary = createInjuredSummary({
        injuredParts: [{ partName: 'finger', damage: 5 }],
        overallHealthPercentage: 95,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My finger stings slightly.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('minor-wound');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-healthy')).toBe(true);
    });

    it('renders with severity-scratched class when health 75-89%', () => {
      const summary = createInjuredSummary({
        overallHealthPercentage: 80,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I have some scratches.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('scratched-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-scratched')).toBe(true);
    });

    it('renders with severity-wounded class when health 50-74%', () => {
      const summary = createInjuredSummary({
        overallHealthPercentage: 60,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I am wounded.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('wounded-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-wounded')).toBe(true);
    });

    it('renders with severity-injured class when health 25-49%', () => {
      const summary = createInjuredSummary({
        overallHealthPercentage: 40,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I am seriously injured.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('injured-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-injured')).toBe(true);
    });

    it('renders with severity-critical class when health < 25%', () => {
      const summary = createInjuredSummary({
        overallHealthPercentage: 10,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I am critically wounded.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('critical-entity');

      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-critical')).toBe(true);
    });

    it('renders healthy when only bleeding parts exist', () => {
      const summary = createHealthySummary();
      summary.bleedingParts = [{ partName: 'arm' }];
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I am bleeding from my arm.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('bleeding-entity');

      expect(getNarrativeElement().textContent).toBe(
        'I am bleeding from my arm.'
      );
    });

    it('renders healthy when only burning parts exist', () => {
      const summary = createHealthySummary();
      summary.burningParts = [{ partName: 'leg' }];
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My leg is on fire!'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('burning-entity');

      expect(getNarrativeElement().textContent).toBe('My leg is on fire!');
    });

    it('renders healthy when only poisoned parts exist', () => {
      const summary = createHealthySummary();
      summary.poisonedParts = [{ partName: 'torso' }];
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'I feel sick.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('poisoned-entity');

      expect(getNarrativeElement().textContent).toBe('I feel sick.');
    });

    it('renders healthy when only fractured parts exist', () => {
      const summary = createHealthySummary();
      summary.fracturedParts = [{ partName: 'rib' }];
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'My rib is broken.'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('fractured-entity');

      expect(getNarrativeElement().textContent).toBe('My rib is broken.');
    });

    it('logs warning and returns early when narrative element is missing during render', () => {
      const panel = new InjuryStatusPanel(deps);

      // Simulate element becoming null after construction
      panel.elements.narrativeElement = null;

      const summary = createInjuredSummary();
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      panel.updateForActor('test-entity');

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot render: narrative element not available'
        )
      );
    });
  });

  describe('renderNarrative edge cases', () => {
    it('clears existing CSS classes when rendering new state', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 70 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'First injury'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity-1');

      let narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-wounded')).toBe(true);

      // Now update with healthy state
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(
        createHealthySummary()
      );
      panel.updateForActor('entity-2');

      narrativeEl = getNarrativeElement();
      expect(narrativeEl.className).toBe('injury-healthy-message');
      expect(narrativeEl.classList.contains('severity-wounded')).toBe(false);
    });

    it('handles empty severity class gracefully', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 95 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Minor'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      // Should have severity-healthy class
      const narrativeEl = getNarrativeElement();
      expect(narrativeEl.classList.contains('severity-healthy')).toBe(true);
    });
  });

  describe('edge cases for dying and dead states', () => {
    it('handles dying state with null narrative element', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.elements.narrativeElement = null;

      const summary = createInjuredSummary({
        isDying: true,
        dyingTurnsRemaining: 2,
      });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      // Should not throw
      expect(() => panel.updateForActor('dying-entity')).not.toThrow();
    });

    it('handles dead state with null narrative element', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.elements.narrativeElement = null;

      const summary = createInjuredSummary({ isDead: true });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);

      // Should not throw
      expect(() => panel.updateForActor('dead-entity')).not.toThrow();
    });

    it('handles healthy state with null narrative element', () => {
      const panel = new InjuryStatusPanel(deps);
      panel.elements.narrativeElement = null;

      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(
        createHealthySummary()
      );

      // Should not throw
      expect(() => panel.updateForActor('healthy-entity')).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('disposes properly and clears elements', () => {
      const panel = new InjuryStatusPanel(deps);

      // Verify elements are bound initially
      expect(panel.elements.narrativeElement).toBe(narrativeElement);
      expect(panel.elements.contentElement).toBe(contentElement);

      // Call dispose
      panel.dispose();

      // Verify elements are cleared
      expect(panel.elements).toEqual({});
      expect(deps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bound DOM elements cleared')
      );
    });
  });

  describe('getSeverityClass boundary conditions', () => {
    it('returns severity-healthy at exactly 90%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 90 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Minimal'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(getNarrativeElement().classList.contains('severity-healthy')).toBe(
        true
      );
    });

    it('returns severity-scratched at exactly 75%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 75 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Light'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(
        getNarrativeElement().classList.contains('severity-scratched')
      ).toBe(true);
    });

    it('returns severity-wounded at exactly 50%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 50 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Moderate'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(getNarrativeElement().classList.contains('severity-wounded')).toBe(
        true
      );
    });

    it('returns severity-injured at exactly 25%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 25 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Severe'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(getNarrativeElement().classList.contains('severity-injured')).toBe(
        true
      );
    });

    it('returns severity-critical at exactly 24%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 24 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Critical'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(
        getNarrativeElement().classList.contains('severity-critical')
      ).toBe(true);
    });

    it('returns severity-critical at 0%', () => {
      const summary = createInjuredSummary({ overallHealthPercentage: 0 });
      deps.injuryAggregationService.aggregateInjuries.mockReturnValue(summary);
      deps.injuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
        'Near death'
      );

      const panel = new InjuryStatusPanel(deps);
      panel.updateForActor('entity');

      expect(
        getNarrativeElement().classList.contains('severity-critical')
      ).toBe(true);
    });
  });
});
