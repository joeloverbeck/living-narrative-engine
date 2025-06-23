/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import {
  renderGenericSlotItem,
  renderSlotItem,
} from '../../../../src/domUI/helpers/renderSlotItem.js';

describe('renderSlotItem', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates slot element with info and playtime', () => {
    const handler = jest.fn();
    const slot = renderSlotItem(
      factory,
      'slotId',
      '1',
      {
        name: 'Save1',
        timestamp: 'Saved: now',
        playtime: 'Playtime: 00:10:00',
      },
      handler
    );
    expect(slot).toBeInstanceOf(HTMLElement);
    expect(slot.dataset.slotId).toBe('1');
    expect(slot.querySelector('.slot-name').textContent).toBe('Save1');
    expect(slot.querySelector('.slot-timestamp').textContent).toBe(
      'Saved: now'
    );
    expect(slot.querySelector('.slot-playtime').textContent).toBe(
      'Playtime: 00:10:00'
    );
    slot.click();
    expect(handler).toHaveBeenCalled();
  });

  it('returns null when factory is missing', () => {
    const res = renderSlotItem(null, 'id', '1', {}, undefined);
    expect(res).toBeNull();
  });

  it('sets tabindex correctly via renderGenericSlotItem', () => {
    const slot = renderGenericSlotItem(
      factory,
      'slotId',
      '1',
      { name: 'Save1' },
      0,
      undefined
    );
    expect(slot?.getAttribute('tabindex')).toBe('0');
  });
});
