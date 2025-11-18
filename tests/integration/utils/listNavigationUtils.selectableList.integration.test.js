import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { SelectableListDisplayComponent } from '../../../src/domUI/selectableListDisplayComponent.js';
import { setupRadioListNavigation } from '../../../src/utils/listNavigationUtils.js';

class RecordingLogger {
  constructor() {
    this.entries = [];
    for (const level of ['debug', 'info', 'warn', 'error']) {
      this[level] = (message, meta) => {
        this.entries.push({ level, message, meta });
      };
    }
  }
}

class SimpleValidatedDispatcher {
  constructor() {
    this.listeners = new Map();
  }

  dispatch(eventName, payload) {
    const listeners = this.listeners.get(eventName);
    if (!listeners || listeners.size === 0) {
      return Promise.resolve(true);
    }
    const event = { type: eventName, payload };
    const executions = Array.from(listeners, (listener) =>
      Promise.resolve().then(() => listener(event))
    );
    return Promise.allSettled(executions).then(() => true);
  }

  subscribe(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    return () => this.unsubscribe(eventName, handler);
  }

  unsubscribe(eventName, handler) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }
    listeners.delete(handler);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }
}

class TestSelectableList extends SelectableListDisplayComponent {
  constructor(params) {
    super({ ...params, autoRefresh: false });
    this._data = [];
  }

  setData(list) {
    this._data = Array.isArray(list) ? list : [];
  }

  async _getListItemsData() {
    return this._data;
  }

  _renderListItem(item, index) {
    const element = this.documentContext.create('button');
    element.type = 'button';
    element.className = 'list-item';
    element.setAttribute('role', 'radio');
    element.dataset[this._datasetKey] = String(item[this._datasetKey]);
    element.textContent = item.label;
    element.tabIndex = index === 0 ? 0 : -1;
    return element;
  }

  _getEmptyListMessage() {
    return 'No entries';
  }
}

describe('setupRadioListNavigation integration via SelectableListDisplayComponent', () => {
  /** @type {HTMLDivElement} */
  let container;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {DocumentContext} */
  let documentContext;
  /** @type {SimpleValidatedDispatcher} */
  let dispatcher;
  /** @type {TestSelectableList} */
  let component;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="list" role="radiogroup"></div>
      <div id="outside"></div>
    `;
    container = document.getElementById('list');
    logger = new RecordingLogger();
    documentContext = new DocumentContext(document, logger);
    dispatcher = new SimpleValidatedDispatcher();
    component = new TestSelectableList({
      datasetKey: 'id',
      logger,
      documentContext,
      validatedEventDispatcher: dispatcher,
      elementsConfig: {
        listContainerElement: {
          selector: '#list',
          required: true,
          expectedType: HTMLDivElement,
        },
      },
    });
    component.setData([
      { id: 1, label: 'North' },
      { id: 2, label: 'East' },
      { id: 3, label: 'South' },
      { id: 4, label: 'West' },
    ]);
    await component.renderList();
  });

  afterEach(() => {
    component?.dispose?.();
    document.body.innerHTML = '';
  });

  /**
   *
   */
  function getItems() {
    return Array.from(container.querySelectorAll('[role="radio"]'));
  }

  /**
   *
   * @param target
   * @param key
   */
  function dispatchKey(target, key) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('cycles focus with arrow keys and updates selection metadata', () => {
    const items = getItems();
    items[0].focus();

    dispatchKey(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    expect(component.selectedItemData).toEqual({ id: 2, label: 'East' });
    expect(items[1].getAttribute('aria-checked')).toBe('true');
    expect(items[0].getAttribute('aria-checked')).toBe('false');

    dispatchKey(items[1], 'ArrowRight');
    expect(document.activeElement).toBe(items[2]);
    expect(component.selectedItemData).toEqual({ id: 3, label: 'South' });

    dispatchKey(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[3]);

    dispatchKey(items[3], 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });

    dispatchKey(items[0], 'ArrowUp');
    expect(document.activeElement).toBe(items[3]);

    dispatchKey(items[3], 'ArrowLeft');
    expect(document.activeElement).toBe(items[2]);
  });

  it('supports home and end keys while reusing dataset values', () => {
    const items = getItems();
    items[2].focus();

    dispatchKey(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });

    dispatchKey(items[0], 'End');
    expect(document.activeElement).toBe(items[3]);
    expect(component.selectedItemData).toEqual({ id: 4, label: 'West' });
  });

  it('ignores disabled items and events from outside the list', () => {
    const items = getItems();
    component._selectItem(items[1], { id: 2, label: 'East' });
    items[1].classList.add('disabled-interaction');
    items[1].focus();

    dispatchKey(items[1], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(component.selectedItemData).toEqual({ id: 2, label: 'East' });

    const outside = document.getElementById('outside');
    const event = dispatchKey(outside, 'ArrowDown');
    expect(event.defaultPrevented).toBe(false);
    expect(component.selectedItemData).toEqual({ id: 2, label: 'East' });
  });

  it('gracefully handles missing items and non-navigation keys', () => {
    const items = getItems();
    component._selectItem(items[0], { id: 1, label: 'North' });

    const enterEvent = dispatchKey(items[0], 'Enter');
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });

    container.innerHTML = '';
    const handler = component._arrowKeyHandler;
    const orphanEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(orphanEvent);
    handler?.(orphanEvent);
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });

    const detachedItem = document.createElement('div');
    detachedItem.className = 'list-item';
    detachedItem.setAttribute('role', 'radio');
    detachedItem.dataset.id = 'detached';
    const emptyEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(emptyEvent, 'target', {
      value: detachedItem,
      enumerable: true,
    });
    handler?.(emptyEvent);
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });

    const nullHandler = setupRadioListNavigation(
      null,
      '[role="radio"]',
      'id',
      () => logger.debug('noop')
    );
    nullHandler(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.selectedItemData).toEqual({ id: 1, label: 'North' });
  });
});
