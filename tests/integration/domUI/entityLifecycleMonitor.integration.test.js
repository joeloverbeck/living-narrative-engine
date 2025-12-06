import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { EntityLifecycleMonitor } from '../../../src/domUI/entityLifecycleMonitor.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class RecordingLogger {
  constructor() {
    /** @type {Array<{level:string,message:string,details?:any}>} */
    this.entries = [];
  }

  #record(level, message, details) {
    this.entries.push({ level, message, details });
  }

  debug(message, ...details) {
    this.#record('debug', message, details);
  }

  info(message, ...details) {
    this.#record('info', message, details);
  }

  warn(message, ...details) {
    this.#record('warn', message, details);
  }

  error(message, ...details) {
    this.#record('error', message, details);
  }
}

class RecordingValidatedEventDispatcher {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.handlers = new Map();
    /** @type {string[]} */
    this.subscribeCalls = [];
  }

  subscribe(eventName, handler) {
    this.subscribeCalls.push(eventName);
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    const handlerSet = this.handlers.get(eventName);
    handlerSet.add(handler);
    return () => {
      handlerSet.delete(handler);
      if (handlerSet.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  async dispatch(eventName, payload) {
    const handlerSet = this.handlers.get(eventName);
    if (!handlerSet) return true;
    for (const handler of Array.from(handlerSet)) {
      await handler({ type: eventName, payload });
    }
    return true;
  }
}

describe('EntityLifecycleMonitor integration', () => {
  let dom;
  /** @type {Document} */
  let document;
  /** @type {HTMLElement} */
  let container;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {RecordingValidatedEventDispatcher} */
  let eventDispatcher;
  /** @type {SimpleEntityManager} */
  let entityManager;
  let documentContext;
  let elementFactory;
  /** @type {EntityLifecycleMonitor | null} */
  let monitor;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="entity-lifecycle-monitor"></div></body></html>'
    );
    document = dom.window.document;

    global.window = dom.window;
    global.document = document;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLDivElement = dom.window.HTMLDivElement;
    global.HTMLUListElement = dom.window.HTMLUListElement;
    global.HTMLLIElement = dom.window.HTMLLIElement;

    jest.useFakeTimers();

    container = document.getElementById('entity-lifecycle-monitor');
    Object.defineProperty(container, 'scrollHeight', {
      value: 1000,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(container, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });

    logger = new RecordingLogger();
    eventDispatcher = new RecordingValidatedEventDispatcher();
    entityManager = new SimpleEntityManager();
    documentContext = new DocumentContext(document);
    elementFactory = new DomElementFactory(documentContext);
    monitor = null;
  });

  afterEach(() => {
    if (monitor) {
      monitor.dispose();
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.HTMLDivElement;
    delete global.HTMLUListElement;
    delete global.HTMLLIElement;
  });

  it('renders lifecycle activity and surfaces component tooltips with real services', async () => {
    const actorId = 'actor-123';
    await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Alpha',
    });
    await entityManager.addComponent(actorId, 'core:description', {
      text: 'Heroic figure',
    });

    monitor = new EntityLifecycleMonitor({
      logger,
      documentContext,
      validatedEventDispatcher: eventDispatcher,
      domElementFactory: elementFactory,
      entityManager,
    });

    const entityInstance = entityManager.getEntityInstance(actorId);

    await eventDispatcher.dispatch('core:entity_created', {
      instanceId: actorId,
      definitionId: 'hero-definition',
      wasReconstructed: true,
    });

    await eventDispatcher.dispatch('core:component_added', {
      entity: entityInstance,
      componentTypeId: 'core:description',
      oldComponentData: { text: 'Outdated' },
    });

    await eventDispatcher.dispatch('core:component_removed', {
      entity: entityInstance,
      componentTypeId: 'core:description',
    });

    await eventDispatcher.dispatch('core:display_entity_components', {
      entityId: actorId,
      components: entityInstance.getAllComponents(),
    });

    jest.runOnlyPendingTimers();

    const entries = Array.from(
      container.querySelectorAll('li.entity-event-entry')
    );
    expect(entries).toHaveLength(4);

    const createdEntry = entries[0].textContent;
    expect(createdEntry).toContain(
      'Entity created: Alpha (actor-123) from hero-definition (reconstructed)'
    );

    const componentAddedEntry = entries[1];
    expect(componentAddedEntry.textContent).toContain(
      'Component updated: core:description on Alpha (actor-123)'
    );
    const tooltip = componentAddedEntry.querySelector(
      '.component-data-tooltip'
    );
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('"Heroic figure"');

    const removedEntry = entries[2].textContent;
    expect(removedEntry).toContain(
      'Component removed: core:description from Alpha (actor-123)'
    );

    const displayEntry = entries[3].textContent;
    expect(displayEntry).toContain('Entity Alpha (actor-123) has 2 components');
    expect(displayEntry).toContain('core:name');
    expect(displayEntry).toContain('core:description');

    expect(container.scrollTop).toBe(container.scrollHeight);
  });

  it('limits rendered history, clears output, and unsubscribes on dispose', async () => {
    const actorId = 'entity-for-limit-test';
    await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Delta',
    });

    monitor = new EntityLifecycleMonitor({
      logger,
      documentContext,
      validatedEventDispatcher: eventDispatcher,
      domElementFactory: elementFactory,
      entityManager,
    });

    const entityInstance = entityManager.getEntityInstance(actorId);

    for (let i = 0; i < 60; i += 1) {
      await eventDispatcher.dispatch('core:component_added', {
        entity: entityInstance,
        componentTypeId: `test:component-${i}`,
      });
    }

    jest.runOnlyPendingTimers();

    const listItems = Array.from(
      container.querySelectorAll('li.entity-event-entry')
    );
    expect(listItems).toHaveLength(50);
    const firstVisible = listItems[0].textContent;
    expect(firstVisible).toContain('test:component-10');

    monitor.clearEvents();
    expect(container.querySelectorAll('li.entity-event-entry')).toHaveLength(0);

    monitor.dispose();
    monitor = null;

    for (const handlerSet of eventDispatcher.handlers.values()) {
      expect(handlerSet.size).toBe(0);
    }

    expect(
      logger.entries.some((entry) =>
        entry.message.includes('EntityLifecycleMonitor disposed')
      )
    ).toBe(true);
  });

  it('logs a warning when container is missing and avoids subscriptions', async () => {
    container.remove();

    monitor = new EntityLifecycleMonitor({
      logger,
      documentContext,
      validatedEventDispatcher: eventDispatcher,
      domElementFactory: elementFactory,
      entityManager,
    });

    expect(eventDispatcher.subscribeCalls).toHaveLength(0);
    expect(
      logger.entries.some(
        (entry) =>
          entry.level === 'warn' &&
          entry.message.includes(
            "Container element '#entity-lifecycle-monitor' not found"
          )
      )
    ).toBe(true);

    await eventDispatcher.dispatch('core:entity_created', {
      instanceId: 'unused',
      definitionId: 'missing',
    });

    expect(container.querySelectorAll('li.entity-event-entry')).toHaveLength(0);
  });
});
