/**
 * @file DamageHistoryTracker.test.js
 * @description Unit tests for DamageHistoryTracker
 */

import DamageHistoryTracker from '../../../../src/domUI/damage-simulator/DamageHistoryTracker.js';
import { jest } from '@jest/globals';

describe('DamageHistoryTracker', () => {
  let mockLogger;
  let mockEventBus;
  let mockContainerElement;
  let damageHistoryTracker;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockContainerElement = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
    };

    damageHistoryTracker = new DamageHistoryTracker({
      containerElement: mockContainerElement,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (damageHistoryTracker) {
      damageHistoryTracker.destroy();
    }
  });

  describe('Constructor', () => {
    it('should validate required dependencies - missing containerElement', () => {
      expect(
        () =>
          new DamageHistoryTracker({
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing eventBus', () => {
      expect(
        () =>
          new DamageHistoryTracker({
            containerElement: mockContainerElement,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing logger', () => {
      expect(
        () =>
          new DamageHistoryTracker({
            containerElement: mockContainerElement,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create tracker with all valid dependencies', () => {
      expect(damageHistoryTracker).toBeInstanceOf(DamageHistoryTracker);
    });

    it('should use default maxEntries of 50', () => {
      expect(DamageHistoryTracker.MAX_ENTRIES_DEFAULT).toBe(50);
    });

    it('should accept custom maxEntries', () => {
      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        maxEntries: 10,
      });
      expect(tracker).toBeInstanceOf(DamageHistoryTracker);
      tracker.destroy();
    });

    it('should subscribe to execution-complete and entity-loading events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DamageHistoryTracker.EVENTS.ENTITY_LOADING,
        expect.any(Function)
      );
    });
  });

  describe('record', () => {
    it('should record damage result', () => {
      const result = {
        success: true,
        targetPartId: 'part-head',
        targetPartName: 'Head',
        damageDealt: 10,
        damageType: 'slashing',
        severity: 'moderate',
      };

      damageHistoryTracker.record(result);

      const entries = damageHistoryTracker.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].targetPartId).toBe('part-head');
      expect(entries[0].targetPartName).toBe('Head');
      expect(entries[0].damageDealt).toBe(10);
      expect(entries[0].damageType).toBe('slashing');
      expect(entries[0].severity).toBe('moderate');
    });

    it('should skip unsuccessful results', () => {
      const result = {
        success: false,
        error: 'Failed to apply damage',
      };

      damageHistoryTracker.record(result);

      expect(damageHistoryTracker.getEntries()).toHaveLength(0);
    });

    it('should skip null results', () => {
      damageHistoryTracker.record(null);
      expect(damageHistoryTracker.getEntries()).toHaveLength(0);
    });

    it('should assign incremental IDs', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 5 });
      damageHistoryTracker.record({ success: true, damageDealt: 10 });

      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].id).toBe(1);
      expect(entries[1].id).toBe(2);
    });

    it('should add timestamp to entries', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 5 });

      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle results with missing optional fields', () => {
      damageHistoryTracker.record({ success: true });

      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].targetPartId).toBe('unknown');
      expect(entries[0].targetPartName).toBe('Unknown');
      expect(entries[0].damageDealt).toBe(0);
      expect(entries[0].damageType).toBe('unknown');
      expect(entries[0].severity).toBe('unknown');
    });
  });

  describe('display entries in order', () => {
    it('should display entries in order', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 5, targetPartName: 'First' });
      damageHistoryTracker.record({ success: true, damageDealt: 10, targetPartName: 'Second' });
      damageHistoryTracker.record({ success: true, damageDealt: 15, targetPartName: 'Third' });

      const entries = damageHistoryTracker.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].targetPartName).toBe('First');
      expect(entries[1].targetPartName).toBe('Second');
      expect(entries[2].targetPartName).toBe('Third');
    });
  });

  describe('format timestamp correctly', () => {
    it('should format timestamp correctly', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 5 });
      damageHistoryTracker.render();

      // Check that innerHTML contains a time format (HH:MM:SS pattern)
      const html = mockContainerElement.innerHTML;
      expect(html).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('show target part name', () => {
    it('should show target part name', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        targetPartName: 'Left Arm',
      });
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('Left Arm');
    });

    it('should use targetPartId as fallback if no targetPartName', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        targetPartId: 'part-left-arm',
      });

      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].targetPartName).toBe('part-left-arm');
    });
  });

  describe('show damage amount', () => {
    it('should show damage amount', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 25,
        damageType: 'piercing',
      });
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('25');
      expect(mockContainerElement.innerHTML).toContain('piercing');
    });
  });

  describe('show severity', () => {
    it('should show severity', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        severity: 'critical',
      });
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('critical');
      expect(mockContainerElement.innerHTML).toContain('ds-severity-critical');
    });

    it('should show dash for unknown severity', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
      });
      damageHistoryTracker.render();

      // Unknown severity should display as —
      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].severity).toBe('unknown');
    });
  });

  describe('limit entries to maxEntries', () => {
    it('should limit entries to maxEntries', () => {
      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        maxEntries: 3,
      });

      for (let i = 1; i <= 5; i++) {
        tracker.record({ success: true, damageDealt: i });
      }

      const entries = tracker.getEntries();
      expect(entries).toHaveLength(3);
      // Should keep the newest entries (3, 4, 5)
      expect(entries[0].damageDealt).toBe(3);
      expect(entries[1].damageDealt).toBe(4);
      expect(entries[2].damageDealt).toBe(5);

      tracker.destroy();
    });
  });

  describe('clearHistory', () => {
    it('should clear history on clearHistory()', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      damageHistoryTracker.record({ success: true, damageDealt: 20 });
      expect(damageHistoryTracker.getEntries()).toHaveLength(2);

      damageHistoryTracker.clearHistory();

      expect(damageHistoryTracker.getEntries()).toHaveLength(0);
    });

    it('should reset entry IDs after clear', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      expect(damageHistoryTracker.getEntries()[0].id).toBe(1);

      damageHistoryTracker.clearHistory();
      damageHistoryTracker.record({ success: true, damageDealt: 20 });

      expect(damageHistoryTracker.getEntries()[0].id).toBe(1);
    });
  });

  describe('clear history on entity change', () => {
    it('should clear history on entity change', () => {
      let entityLoadingHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageHistoryTracker.EVENTS.ENTITY_LOADING) {
          entityLoadingHandler = handler;
        }
        return () => {};
      });

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      tracker.record({ success: true, damageDealt: 10 });
      expect(tracker.getEntries()).toHaveLength(1);

      // Simulate entity loading event
      entityLoadingHandler({ payload: {} });

      expect(tracker.getEntries()).toHaveLength(0);
      tracker.destroy();
    });
  });

  describe('getStatistics', () => {
    it('should calculate total damage', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      damageHistoryTracker.record({ success: true, damageDealt: 25 });
      damageHistoryTracker.record({ success: true, damageDealt: 15 });

      const stats = damageHistoryTracker.getStatistics();
      expect(stats.totalDamage).toBe(50);
    });

    it('should calculate hit count', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      damageHistoryTracker.record({ success: true, damageDealt: 25 });
      damageHistoryTracker.record({ success: true, damageDealt: 15 });

      const stats = damageHistoryTracker.getStatistics();
      expect(stats.hitCount).toBe(3);
    });

    it('should return zero stats for empty history', () => {
      const stats = damageHistoryTracker.getStatistics();
      expect(stats.totalDamage).toBe(0);
      expect(stats.hitCount).toBe(0);
    });
  });

  describe('render', () => {
    it('should render empty state message when no entries', () => {
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('No damage applied yet');
    });

    it('should render table with entries', () => {
      damageHistoryTracker.record({
        success: true,
        targetPartName: 'Head',
        damageDealt: 10,
        damageType: 'slashing',
        severity: 'moderate',
      });
      damageHistoryTracker.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-history-table');
      expect(html).toContain('Head');
      expect(html).toContain('10');
      expect(html).toContain('slashing');
    });

    it('should render summary statistics', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      damageHistoryTracker.record({ success: true, damageDealt: 20 });
      damageHistoryTracker.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('30'); // total damage
      expect(html).toContain('2'); // hit count
    });

    it('should render clear button', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('clear-history-btn');
    });

    it('should disable clear button when no entries', () => {
      damageHistoryTracker.render();

      expect(mockContainerElement.innerHTML).toContain('disabled');
    });
  });

  describe('event subscriptions', () => {
    it('should record results from execution-complete events', () => {
      let executionCompleteHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE) {
          executionCompleteHandler = handler;
        }
        return () => {};
      });

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Simulate execution complete event with results
      executionCompleteHandler({
        payload: {
          results: [
            { success: true, damageDealt: 10, targetPartName: 'Head' },
            { success: true, damageDealt: 15, targetPartName: 'Arm' },
          ],
        },
      });

      expect(tracker.getEntries()).toHaveLength(2);
      tracker.destroy();
    });

    it('should handle empty results array', () => {
      let executionCompleteHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE) {
          executionCompleteHandler = handler;
        }
        return () => {};
      });

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Simulate execution complete event with empty results
      executionCompleteHandler({ payload: { results: [] } });

      expect(tracker.getEntries()).toHaveLength(0);
      tracker.destroy();
    });

    it('should handle missing payload', () => {
      let executionCompleteHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE) {
          executionCompleteHandler = handler;
        }
        return () => {};
      });

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Simulate execution complete event with no payload
      executionCompleteHandler({});

      expect(tracker.getEntries()).toHaveLength(0);
      tracker.destroy();
    });
  });

  describe('getEntries', () => {
    it('should return a copy of entries', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });

      const entries1 = damageHistoryTracker.getEntries();
      const entries2 = damageHistoryTracker.getEntries();

      expect(entries1).not.toBe(entries2);
      expect(entries1).toEqual(entries2);
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events on destroy', () => {
      const unsubscribeMock1 = jest.fn();
      const unsubscribeMock2 = jest.fn();
      let callCount = 0;

      mockEventBus.subscribe.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? unsubscribeMock1 : unsubscribeMock2;
      });

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      tracker.destroy();

      expect(unsubscribeMock1).toHaveBeenCalledTimes(1);
      expect(unsubscribeMock2).toHaveBeenCalledTimes(1);
    });

    it('should clear entries on destroy', () => {
      damageHistoryTracker.record({ success: true, damageDealt: 10 });
      expect(damageHistoryTracker.getEntries()).toHaveLength(1);

      damageHistoryTracker.destroy();

      expect(damageHistoryTracker.getEntries()).toHaveLength(0);
    });
  });

  describe('Static constants', () => {
    it('should expose EVENTS', () => {
      expect(DamageHistoryTracker.EVENTS).toBeDefined();
      expect(DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE).toBe(
        'core:damage_simulator_execution_complete'
      );
      expect(DamageHistoryTracker.EVENTS.ENTITY_LOADING).toBe(
        'core:damage_simulator_entity_loading'
      );
    });

    it('should expose MAX_ENTRIES_DEFAULT', () => {
      expect(DamageHistoryTracker.MAX_ENTRIES_DEFAULT).toBe(50);
    });
  });

  describe('clear button click handler', () => {
    it('should call clearHistory and render when clear button is clicked', () => {
      // Create a mock button that captures the click handler
      let capturedClickHandler;
      const mockClearBtn = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') {
            capturedClickHandler = handler;
          }
        }),
      };

      // Set up querySelector to return the mock button
      const localMockContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
        querySelector: jest.fn((selector) => {
          if (selector === '#clear-history-btn') {
            return mockClearBtn;
          }
          return null;
        }),
      };

      const tracker = new DamageHistoryTracker({
        containerElement: localMockContainer,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Add an entry so there's data to clear
      tracker.record({ success: true, damageDealt: 10, targetPartName: 'Head' });
      expect(tracker.getEntries()).toHaveLength(1);

      // Trigger render which calls #attachEventListeners
      tracker.render();

      // Verify event listener was attached
      expect(mockClearBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Simulate the click by calling the captured handler
      expect(capturedClickHandler).toBeDefined();
      capturedClickHandler();

      // Verify clearHistory was called (entries cleared)
      expect(tracker.getEntries()).toHaveLength(0);

      // Verify render was called (innerHTML updated to empty state)
      expect(localMockContainer.innerHTML).toContain('No damage applied yet');

      tracker.destroy();
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in part names', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        targetPartName: '<script>alert("xss")</script>',
      });
      damageHistoryTracker.render();

      const html = mockContainerElement.innerHTML;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in damage types', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        damageType: '<img src=x onerror=alert(1)>',
      });
      damageHistoryTracker.render();

      const html = mockContainerElement.innerHTML;
      expect(html).not.toContain('<img');
    });

  });

  describe('edge cases', () => {
    it('should default empty severity to unknown', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: 10,
        severity: '', // Empty string - falsy, should default to 'unknown'
      });

      const entries = damageHistoryTracker.getEntries();
      expect(entries[0].severity).toBe('unknown');
    });

    it('should handle non-function unsubscribers gracefully during destroy', () => {
      // Create a tracker with mocked subscribe that returns non-function
      const localMockEventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn().mockReturnValue('not-a-function'), // Return non-function
      };

      const tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: localMockEventBus,
        logger: mockLogger,
      });

      // Should not throw when destroy is called with non-function unsubscribers
      expect(() => tracker.destroy()).not.toThrow();
    });

    it('should handle null damageDealt in statistics calculation', () => {
      damageHistoryTracker.record({
        success: true,
        damageDealt: null, // Null damage
      });

      const stats = damageHistoryTracker.getStatistics();
      expect(stats.totalDamage).toBe(0);
      expect(stats.hitCount).toBe(1);
    });
  });
});
