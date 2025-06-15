import { JSDOM } from 'jsdom';
import { setupRadioListNavigation } from '../../src/utils/listNavigation.js';
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
});
