import { JSDOM } from 'jsdom';
import { setupRadioListNavigation } from '../../../src/utils/listNavigationUtils.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('setupRadioListNavigation', () => {
  /** @type {Document} */
  let document;
  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLElement[]} */
  let items;
  /** @type {jest.Mock} */
  let selectMock;
  /** @type {(e: KeyboardEvent) => void} */
  let handler;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><div id="c">
      <div class="item" data-index="0" tabindex="0"></div>
      <div class="item" data-index="1" tabindex="-1"></div>
      <div class="item" data-index="2" tabindex="-1"></div>
    </div>`);
    document = dom.window.document;
    container = document.getElementById('c');
    items = Array.from(container.querySelectorAll('.item'));
    selectMock = jest.fn();
    handler = setupRadioListNavigation(container, '.item', 'index', selectMock);
  });

  /**
   *
   * @param key
   * @param targetIndex
   */
  function trigger(key, targetIndex) {
    const event = new document.defaultView.KeyboardEvent('keydown', { key });
    Object.defineProperty(event, 'target', {
      value: items[targetIndex],
      enumerable: true,
    });
    handler(event);
  }

  it('navigates with ArrowDown and ArrowUp', () => {
    trigger('ArrowDown', 0);
    expect(selectMock).toHaveBeenCalledWith(items[1], '1');
    trigger('ArrowUp', 1);
    expect(selectMock).toHaveBeenLastCalledWith(items[0], '0');
  });

  it('handles Home and End keys', () => {
    trigger('End', 0);
    expect(selectMock).toHaveBeenCalledWith(items[2], '2');
    trigger('Home', 2);
    expect(selectMock).toHaveBeenLastCalledWith(items[0], '0');
  });

  it('navigates with ArrowLeft and ArrowRight', () => {
    trigger('ArrowRight', 1);
    expect(selectMock).toHaveBeenCalledWith(items[2], '2');
    trigger('ArrowLeft', 2);
    expect(selectMock).toHaveBeenLastCalledWith(items[1], '1');
  });

  it('ignores events when container is missing or target not matching', () => {
    const noContainerHandler = setupRadioListNavigation(
      null,
      '.item',
      'index',
      selectMock
    );
    const event = new document.defaultView.KeyboardEvent('keydown', {
      key: 'ArrowDown',
    });
    Object.defineProperty(event, 'target', {
      value: container,
      enumerable: true,
    });
    noContainerHandler(event);
    expect(selectMock).not.toHaveBeenCalled();

    const wrongTargetEvent = new document.defaultView.KeyboardEvent('keydown', {
      key: 'ArrowDown',
    });
    Object.defineProperty(wrongTargetEvent, 'target', {
      value: container,
      enumerable: true,
    });
    handler(wrongTargetEvent);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('handles events from matching elements outside the container', () => {
    const externalItem = document.createElement('div');
    externalItem.className = 'item';
    externalItem.dataset.index = '99';
    const event = new document.defaultView.KeyboardEvent('keydown', {
      key: 'ArrowDown',
    });
    Object.defineProperty(event, 'target', {
      value: externalItem,
      enumerable: true,
    });
    handler(event);
    expect(selectMock).toHaveBeenCalledWith(items[0], '0');
  });

  it('returns early for disabled items or no items', () => {
    items[0].classList.add('disabled-interaction');
    trigger('ArrowDown', 0);
    expect(selectMock).not.toHaveBeenCalled();

    const emptyDom = new JSDOM('<div id="c"></div>');
    const emptyHandler = setupRadioListNavigation(
      emptyDom.window.document.getElementById('c'),
      '.item',
      'index',
      selectMock
    );
    const noItemEvent = new emptyDom.window.KeyboardEvent('keydown', {
      key: 'ArrowDown',
    });
    Object.defineProperty(noItemEvent, 'target', {
      value: emptyDom.window.document.getElementById('c'),
      enumerable: true,
    });
    emptyHandler(noItemEvent);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('does nothing for unsupported keys or same index', () => {
    trigger('Enter', 0);
    expect(selectMock).not.toHaveBeenCalled();

    const singleDom = new JSDOM(
      '<div class="item" data-index="0" tabindex="0"></div>'
    );
    const singleContainer = singleDom.window.document.body.firstElementChild;
    const singleHandler = setupRadioListNavigation(
      singleContainer,
      '.item',
      'index',
      selectMock
    );
    const singleEvent = new singleDom.window.KeyboardEvent('keydown', {
      key: 'ArrowUp',
    });
    Object.defineProperty(singleEvent, 'target', {
      value: singleContainer,
      enumerable: true,
    });
    singleHandler(singleEvent);
    expect(selectMock).not.toHaveBeenCalled();
  });
});
