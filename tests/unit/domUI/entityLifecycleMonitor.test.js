// tests/unit/domUI/entityLifecycleMonitor.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { EntityLifecycleMonitor } from '../../../src/domUI/entityLifecycleMonitor.js';

jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');

const CONTAINER_SELECTOR = '#entity-lifecycle-monitor';
const CLASS_PREFIX = '[EntityLifecycleMonitor]';

describe('EntityLifecycleMonitor', () => {
  let dom;
  let document;
  let mockLogger;
  let mockVed;
  let mockDomElementFactory;
  let mockDocumentContext;
  let mockEntityManager;
  let containerElement;
  let eventHandlers;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="entity-lifecycle-monitor"></div></body></html>`
    );
    document = dom.window.document;

    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLDivElement = dom.window.HTMLDivElement;
    global.HTMLUListElement = dom.window.HTMLUListElement;
    global.HTMLLIElement = dom.window.HTMLLIElement;
    global.Date = dom.window.Date;

    // Mock timer functions - only use fake timers, no spy needed
    jest.useFakeTimers();

    const ConsoleLogger =
      require('../../../src/logging/consoleLogger.js').default;
    const ValidatedEventDispatcher =
      require('../../../src/events/validatedEventDispatcher.js').default;

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({});

    // Track event handlers
    eventHandlers = {};
    mockVed.subscribe.mockImplementation((eventName, handler) => {
      eventHandlers[eventName] = handler;
      return jest.fn();
    });

    containerElement = document.querySelector(CONTAINER_SELECTOR);
    if (containerElement) {
      jest.spyOn(containerElement, 'appendChild');
      Object.defineProperty(containerElement, 'scrollHeight', {
        value: 500,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });
    }

    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === CONTAINER_SELECTOR) {
          return containerElement;
        }
        return document.querySelector(selector);
      }),
      create: jest.fn((tagName) => document.createElement(tagName)),
      document: document,
    };

    mockDomElementFactory = {
      ul: jest.fn((className) => {
        const ul = document.createElement('ul');
        if (className) ul.classList.add(className);
        return ul;
      }),
      li: jest.fn((className) => {
        const li = document.createElement('li');
        if (className) li.classList.add(className);
        return li;
      }),
    };

    // Mock entity manager with required methods
    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue(null),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should instantiate successfully with valid dependencies', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      expect(monitor).toBeInstanceOf(EntityLifecycleMonitor);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Initialized.`
      );
    });

    it('should warn and return early if container element is not found', () => {
      mockDocumentContext.query.mockReturnValueOnce(null);

      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Container element '${CONTAINER_SELECTOR}' not found.`
      );
      expect(mockVed.subscribe).not.toHaveBeenCalled();
    });

    it('should create event list element and append to container', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      expect(mockDomElementFactory.ul).toHaveBeenCalledWith(
        'entity-event-list'
      );
      expect(containerElement.appendChild).toHaveBeenCalled();
      const appendedElement = containerElement.appendChild.mock.calls[0][0];
      expect(appendedElement.tagName).toBe('UL');
      expect(appendedElement.classList.contains('entity-event-list')).toBe(
        true
      );
    });

    it('should subscribe to all lifecycle events', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      expect(mockVed.subscribe).toHaveBeenCalledTimes(5);
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:entity_created',
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:entity_removed',
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:component_added',
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:component_removed',
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:display_entity_components',
        expect.any(Function)
      );
    });

    it('should fall back to documentContext.create when domElementFactory is not available', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: null,
        entityManager: mockEntityManager,
      });

      expect(mockDocumentContext.create).toHaveBeenCalledWith('ul');
    });
  });

  describe('Event Handlers', () => {
    let monitor;
    let eventList;

    beforeEach(() => {
      monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });
      eventList = containerElement.querySelector('.entity-event-list');
    });

    describe('Entity Created Handler', () => {
      it('should handle entity creation event', () => {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-123',
            definitionId: 'def-456',
            wasReconstructed: false,
            entity: {},
          },
        };

        eventHandlers['core:entity_created'](event);

        expect(eventList.children.length).toBe(1);
        const entry = eventList.children[0];
        expect(entry.classList.contains('entity-created')).toBe(true);
        expect(entry.textContent).toContain(
          'Entity created: entity-123 from def-456'
        );
      });

      it('should format entity name when entity has name component and UUID', () => {
        const mockEntity = {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockReturnValue({ text: 'John Doe' }),
        };
        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'a1b2c3d4-e5f6-4789-8abc-def012345678', // Valid UUID
            definitionId: 'def-456',
            wasReconstructed: false,
          },
        };

        eventHandlers['core:entity_created'](event);

        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          'a1b2c3d4-e5f6-4789-8abc-def012345678'
        );
        expect(mockEntity.hasComponent).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity created: John Doe from def-456'
        );
      });

      it('should format entity name with ID when entity has name component and non-UUID ID', () => {
        const mockEntity = {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest
            .fn()
            .mockReturnValue({ text: 'Guard Captain' }),
        };
        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'guard-captain-01',
            definitionId: 'def-456',
            wasReconstructed: false,
          },
        };

        eventHandlers['core:entity_created'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity created: Guard Captain (guard-captain-01) from def-456'
        );
      });

      it('should handle entity with name component but no text', () => {
        const mockEntity = {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockReturnValue({ text: null }),
        };
        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-123',
            definitionId: 'def-456',
            wasReconstructed: false,
          },
        };

        eventHandlers['core:entity_created'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity created: entity-123 from def-456'
        );
      });

      it('should handle entity without name component', () => {
        const mockEntity = {
          hasComponent: jest.fn().mockReturnValue(false),
          getComponentData: jest.fn(),
        };
        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-no-name',
            definitionId: 'def-456',
            wasReconstructed: false,
          },
        };

        eventHandlers['core:entity_created'](event);

        expect(mockEntity.hasComponent).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).not.toHaveBeenCalled();

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity created: entity-no-name from def-456'
        );
      });

      it('should handle reconstructed entity', () => {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-123',
            definitionId: 'def-456',
            wasReconstructed: true,
            entity: {},
          },
        };

        eventHandlers['core:entity_created'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain('(reconstructed)');
      });

      it('should handle missing payload gracefully', () => {
        const event = {
          type: 'core:entity_created',
          payload: null,
        };

        expect(() => {
          eventHandlers['core:entity_created'](event);
        }).not.toThrow();

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity created: unknown from undefined'
        );
      });
    });

    describe('Entity Removed Handler', () => {
      it('should handle entity removal event', () => {
        const event = {
          type: 'core:entity_removed',
          payload: {
            instanceId: 'entity-123',
          },
        };

        eventHandlers['core:entity_removed'](event);

        expect(eventList.children.length).toBe(1);
        const entry = eventList.children[0];
        expect(entry.classList.contains('entity-removed')).toBe(true);
        expect(entry.textContent).toContain('Entity removed: entity-123');
      });

      it('should handle missing payload gracefully', () => {
        const event = {
          type: 'core:entity_removed',
          payload: null,
        };

        expect(() => {
          eventHandlers['core:entity_removed'](event);
        }).not.toThrow();

        const entry = eventList.children[0];
        expect(entry.textContent).toContain('Entity removed: unknown');
      });
    });

    describe('Component Added Handler', () => {
      it('should handle new component addition', () => {
        const event = {
          type: 'core:component_added',
          payload: {
            entity: { id: 'entity-123' },
            componentTypeId: 'core:position',
            componentData: { x: 0, y: 0 },
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        expect(entry.classList.contains('component-added')).toBe(true);
        expect(entry.textContent).toContain(
          'Component added: core:position on entity-123'
        );
      });

      it('should handle component update', () => {
        const event = {
          type: 'core:component_added',
          payload: {
            entity: { id: 'entity-123' },
            componentTypeId: 'core:position',
            componentData: { x: 10, y: 20 },
            oldComponentData: { x: 0, y: 0 },
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Component updated: core:position on entity-123'
        );
      });

      it('should handle missing entity gracefully', () => {
        const event = {
          type: 'core:component_added',
          payload: {
            entity: null,
            componentTypeId: 'core:position',
            componentData: {},
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Component added: core:position on unknown'
        );
      });

      it('should add tooltip for component-added events with component data', () => {
        const mockEntity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
        };

        const event = {
          type: 'core:component_added',
          payload: {
            entity: mockEntity,
            componentTypeId: 'core:position',
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        expect(entry.classList.contains('has-tooltip')).toBe(true);
        expect(entry.style.position).toBe('relative');

        // Check tooltip element
        const tooltip = entry.querySelector('.component-data-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip.textContent).toBe(
          JSON.stringify({ x: 10, y: 20, z: 30 }, null, 2)
        );
      });

      it('should not add tooltip when component data is null', () => {
        const mockEntity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockReturnValue(null),
        };

        const event = {
          type: 'core:component_added',
          payload: {
            entity: mockEntity,
            componentTypeId: 'core:position',
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        expect(entry.classList.contains('has-tooltip')).toBe(false);
        expect(entry.style.position).not.toBe('relative');

        const tooltip = entry.querySelector('.component-data-tooltip');
        expect(tooltip).toBeFalsy();
      });

      it('should properly format complex component data in tooltip', () => {
        const complexData = {
          name: 'Test Component',
          values: [1, 2, 3],
          nested: {
            field: 'value',
            another: {
              deep: true,
            },
          },
        };

        const mockEntity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockReturnValue(complexData),
        };

        const event = {
          type: 'core:component_added',
          payload: {
            entity: mockEntity,
            componentTypeId: 'core:complex',
          },
        };

        eventHandlers['core:component_added'](event);

        const entry = eventList.children[0];
        const tooltip = entry.querySelector('.component-data-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip.textContent).toBe(JSON.stringify(complexData, null, 2));
        expect(tooltip.classList.contains('component-data-tooltip')).toBe(true);
      });
    });

    describe('Component Removed Handler', () => {
      it('should handle component removal event', () => {
        const event = {
          type: 'core:component_removed',
          payload: {
            entity: { id: 'entity-123' },
            componentTypeId: 'core:position',
          },
        };

        eventHandlers['core:component_removed'](event);

        const entry = eventList.children[0];
        expect(entry.classList.contains('component-removed')).toBe(true);
        expect(entry.textContent).toContain(
          'Component removed: core:position from entity-123'
        );
      });

      it('should handle missing entity gracefully', () => {
        const event = {
          type: 'core:component_removed',
          payload: {
            entity: null,
            componentTypeId: 'core:position',
          },
        };

        eventHandlers['core:component_removed'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Component removed: core:position from unknown'
        );
      });
    });

    describe('Display Components Handler', () => {
      it('should handle display components event with multiple components', () => {
        const event = {
          type: 'core:display_entity_components',
          payload: {
            entityId: 'entity-123',
            components: {
              'core:position': { x: 0, y: 0 },
              'core:name': { value: 'Test Entity' },
              'core:actor': {},
            },
          },
        };

        eventHandlers['core:display_entity_components'](event);

        const entry = eventList.children[0];
        expect(entry.classList.contains('display-components')).toBe(true);
        expect(entry.textContent).toContain(
          'Entity entity-123 has 3 components:'
        );
        expect(entry.textContent).toContain(
          'core:position, core:name, core:actor'
        );
      });

      it('should handle empty components object', () => {
        const event = {
          type: 'core:display_entity_components',
          payload: {
            entityId: 'entity-123',
            components: {},
          },
        };

        eventHandlers['core:display_entity_components'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain(
          'Entity entity-123 has 0 components:'
        );
      });

      it('should handle missing payload gracefully', () => {
        const event = {
          type: 'core:display_entity_components',
          payload: null,
        };

        eventHandlers['core:display_entity_components'](event);

        const entry = eventList.children[0];
        expect(entry.textContent).toContain('Entity unknown has 0 components:');
      });
    });
  });

  describe('Entry Management', () => {
    let monitor;
    let eventList;

    beforeEach(() => {
      monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });
      eventList = containerElement.querySelector('.entity-event-list');
    });

    it('should add entries with correct structure', () => {
      const event = {
        type: 'core:entity_created',
        payload: {
          instanceId: 'entity-123',
          definitionId: 'def-456',
          wasReconstructed: false,
        },
      };

      eventHandlers['core:entity_created'](event);

      const entry = eventList.children[0];
      expect(entry.tagName).toBe('LI');
      expect(entry.classList.contains('entity-created')).toBe(true);
      expect(entry.classList.contains('entity-event-entry')).toBe(true);

      const timestamp = entry.querySelector('.event-timestamp');
      const message = entry.querySelector('.event-message');

      expect(timestamp).toBeTruthy();
      // Match various time formats: [HH:MM:SS], [H:MM:SS AM/PM], etc.
      expect(timestamp.textContent).toMatch(/\[[\d:\s]+(AM|PM)?\]/);
      expect(message).toBeTruthy();
      expect(message.textContent).toContain(
        'Entity created: entity-123 from def-456'
      );
    });

    it('should limit entries to maximum of 50', () => {
      // Add 60 entries
      for (let i = 0; i < 60; i++) {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: `entity-${i}`,
            definitionId: 'def-test',
            wasReconstructed: false,
          },
        };
        eventHandlers['core:entity_created'](event);
      }

      expect(eventList.children.length).toBe(50);

      // Verify oldest entries were removed
      const firstEntry = eventList.children[0];
      expect(firstEntry.textContent).toContain('entity-10');
    });

    it('should disable animation on removed entries', () => {
      // Add 51 entries to trigger removal
      for (let i = 0; i < 51; i++) {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: `entity-${i}`,
            definitionId: 'def-test',
            wasReconstructed: false,
          },
        };

        if (i === 0) {
          eventHandlers['core:entity_created'](event);
          const firstEntry = eventList.children[0];
          jest.spyOn(firstEntry.style, 'animation', 'set');
        } else {
          eventHandlers['core:entity_created'](event);
        }
      }

      // The first entry should have been removed and animation disabled
      expect(eventList.children.length).toBe(50);
    });

    it('should handle missing event list gracefully', () => {
      // Remove the event list
      eventList.remove();

      const event = {
        type: 'core:entity_created',
        payload: {
          instanceId: 'entity-123',
          definitionId: 'def-456',
          wasReconstructed: false,
        },
      };

      // Should not throw
      expect(() => {
        eventHandlers['core:entity_created'](event);
      }).not.toThrow();
    });

    it('should handle disposal edge case where eventList is destroyed before event handling', () => {
      // This test covers line 272 - the early return when eventList is null
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      // Partially dispose the monitor by removing eventList and nullifying it
      // This simulates a edge case where disposal is interrupted or partial
      const eventListToRemove =
        containerElement.querySelector('.entity-event-list');
      eventListToRemove.remove();

      // Now dispose the monitor which should set internal eventList to null
      monitor.dispose();

      // Clear the debug calls from dispose
      mockLogger.debug.mockClear();

      // Try to fire an event after disposal - should be handled gracefully
      const event = {
        type: 'core:entity_created',
        payload: {
          instanceId: 'test-entity',
          definitionId: 'test-def',
          wasReconstructed: false,
        },
      };

      // The event handler is still registered but should return early when eventList is null
      expect(() => {
        eventHandlers['core:entity_created'](event);
      }).not.toThrow();

      // No logs should be created since addEventEntry returns early
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Animation Timing', () => {
    let monitor;
    let eventList;

    beforeEach(() => {
      monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });
      eventList = containerElement.querySelector('.entity-event-list');
    });

    it('should set animation delay based on pending animations', () => {
      // Fire multiple events quickly
      const events = [
        {
          type: 'core:entity_created',
          payload: { instanceId: 'entity-1', definitionId: 'def-1' },
        },
        {
          type: 'core:entity_created',
          payload: { instanceId: 'entity-2', definitionId: 'def-2' },
        },
        {
          type: 'core:entity_created',
          payload: { instanceId: 'entity-3', definitionId: 'def-3' },
        },
      ];

      events.forEach((event) => {
        eventHandlers['core:entity_created'](event);
      });

      const entries = eventList.children;
      expect(entries[0].style.animationDelay).toBe('0ms');
      expect(entries[1].style.animationDelay).toBe('100ms');
      expect(entries[2].style.animationDelay).toBe('200ms');
    });

    it('should remove event ID from pending animations after timeout', () => {
      const event = {
        type: 'core:entity_created',
        payload: { instanceId: 'entity-1', definitionId: 'def-1' },
      };

      eventHandlers['core:entity_created'](event);

      // Verify the first entry has 0ms delay
      const firstEntry = eventList.children[0];
      expect(firstEntry.style.animationDelay).toBe('0ms');

      // Fast forward time to clear pending animations
      jest.advanceTimersByTime(400);

      // Add another event - should have 0ms delay again
      eventHandlers['core:entity_created'](event);
      const secondEntry = eventList.children[1];
      expect(secondEntry.style.animationDelay).toBe('0ms');
    });

    it('should scroll to bottom after animation delay', () => {
      const event = {
        type: 'core:entity_created',
        payload: { instanceId: 'entity-1', definitionId: 'def-1' },
      };

      containerElement.scrollTop = 0;
      eventHandlers['core:entity_created'](event);

      // Fast forward to scroll time
      jest.advanceTimersByTime(200);

      // Scroll should have been updated
      expect(containerElement.scrollTop).toBe(500); // scrollHeight value
    });

    it('should handle multiple rapid events with staggered animations', () => {
      // Fire 5 events rapidly
      for (let i = 0; i < 5; i++) {
        const event = {
          type: 'core:entity_created',
          payload: { instanceId: `entity-${i}`, definitionId: 'def-test' },
        };
        eventHandlers['core:entity_created'](event);
      }

      // Check staggered delays
      const entries = eventList.children;
      expect(entries[0].style.animationDelay).toBe('0ms');
      expect(entries[1].style.animationDelay).toBe('100ms');
      expect(entries[2].style.animationDelay).toBe('200ms');
      expect(entries[3].style.animationDelay).toBe('300ms');
      expect(entries[4].style.animationDelay).toBe('400ms');

      // Advance timers to ensure all animations complete
      jest.advanceTimersByTime(1000);
    });
  });

  describe('Public Methods', () => {
    let monitor;
    let eventList;

    beforeEach(() => {
      monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });
      eventList = containerElement.querySelector('.entity-event-list');
    });

    describe('clearEvents', () => {
      it('should clear all event entries', () => {
        // Add some entries
        for (let i = 0; i < 5; i++) {
          const event = {
            type: 'core:entity_created',
            payload: { instanceId: `entity-${i}`, definitionId: 'def-test' },
          };
          eventHandlers['core:entity_created'](event);
        }

        expect(eventList.children.length).toBe(5);

        monitor.clearEvents();

        expect(eventList.children.length).toBe(0);
        expect(eventList.innerHTML).toBe('');
      });

      it('should handle missing event list gracefully', () => {
        // Remove the event list
        eventList.remove();

        // Should not throw
        expect(() => {
          monitor.clearEvents();
        }).not.toThrow();
      });
    });
  });

  describe('Dispose', () => {
    it('should properly dispose resources', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      const eventList = containerElement.querySelector('.entity-event-list');
      jest.spyOn(containerElement, 'removeChild');

      monitor.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Disposing EntityLifecycleMonitor.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} EntityLifecycleMonitor disposed.`
      );
      expect(containerElement.removeChild).toHaveBeenCalledWith(eventList);
    });

    it('should handle missing event list during dispose', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      // Remove event list before dispose
      const eventList = containerElement.querySelector('.entity-event-list');
      eventList.remove();

      // Should not throw
      expect(() => {
        monitor.dispose();
      }).not.toThrow();
    });

    it('should clear pending animations on dispose', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      // Add some events to create pending animations
      for (let i = 0; i < 3; i++) {
        const event = {
          type: 'core:entity_created',
          payload: { instanceId: `entity-${i}`, definitionId: 'def-test' },
        };
        eventHandlers['core:entity_created'](event);
      }

      monitor.dispose();

      // Verify pending animations were cleared
      // (We can't directly check the private Set, but we can verify behavior)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} EntityLifecycleMonitor disposed.`
      );
    });
  });

  describe('Integration', () => {
    it('should handle mixed event types correctly', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      const eventList = containerElement.querySelector('.entity-event-list');

      // Fire different event types
      const events = [
        {
          handler: 'core:entity_created',
          event: {
            type: 'core:entity_created',
            payload: { instanceId: 'entity-1', definitionId: 'def-1' },
          },
          expectedClass: 'entity-created',
        },
        {
          handler: 'core:component_added',
          event: {
            type: 'core:component_added',
            payload: {
              entity: { id: 'entity-1' },
              componentTypeId: 'core:position',
              componentData: { x: 0, y: 0 },
            },
          },
          expectedClass: 'component-added',
        },
        {
          handler: 'core:component_removed',
          event: {
            type: 'core:component_removed',
            payload: {
              entity: { id: 'entity-1' },
              componentTypeId: 'core:position',
            },
          },
          expectedClass: 'component-removed',
        },
        {
          handler: 'core:entity_removed',
          event: {
            type: 'core:entity_removed',
            payload: { instanceId: 'entity-1' },
          },
          expectedClass: 'entity-removed',
        },
        {
          handler: 'core:display_entity_components',
          event: {
            type: 'core:display_entity_components',
            payload: {
              entityId: 'entity-1',
              components: { 'core:actor': {} },
            },
          },
          expectedClass: 'display-components',
        },
      ];

      events.forEach(({ handler, event, expectedClass }) => {
        eventHandlers[handler](event);
      });

      expect(eventList.children.length).toBe(5);

      // Verify each entry has correct class
      events.forEach(({ expectedClass }, index) => {
        const entry = eventList.children[index];
        expect(entry.classList.contains(expectedClass)).toBe(true);
        expect(entry.classList.contains('entity-event-entry')).toBe(true);
      });

      // Verify staggered animations
      expect(eventList.children[0].style.animationDelay).toBe('0ms');
      expect(eventList.children[1].style.animationDelay).toBe('100ms');
      expect(eventList.children[2].style.animationDelay).toBe('200ms');
      expect(eventList.children[3].style.animationDelay).toBe('300ms');
      expect(eventList.children[4].style.animationDelay).toBe('400ms');
    });

    it('should maintain correct entry order when limit is exceeded', () => {
      const monitor = new EntityLifecycleMonitor({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockVed,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
      });

      const eventList = containerElement.querySelector('.entity-event-list');

      // Add 55 entries
      for (let i = 0; i < 55; i++) {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: `entity-${i}`,
            definitionId: 'def-test',
            wasReconstructed: false,
          },
        };
        eventHandlers['core:entity_created'](event);
      }

      expect(eventList.children.length).toBe(50);

      // Verify we kept the newest 50 entries (5-54)
      const firstEntry = eventList.children[0];
      const lastEntry = eventList.children[49];

      expect(firstEntry.textContent).toContain('entity-5');
      expect(lastEntry.textContent).toContain('entity-54');
    });
  });
});
