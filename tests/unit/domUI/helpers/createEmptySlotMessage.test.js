/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import createEmptySlotMessage from '../../../../src/domUI/helpers/createEmptySlotMessage.js';

describe('createEmptySlotMessage', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates <li> with message when possible', () => {
    const el = createEmptySlotMessage(factory, 'msg');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe('LI');
    expect(el.classList.contains('empty-slot-message')).toBe(true);
    expect(el.textContent).toBe('msg');
  });

  it('falls back to <p> when li fails', () => {
    jest.spyOn(factory, 'li').mockReturnValue(null);
    const pSpy = jest.spyOn(factory, 'p');
    const el = createEmptySlotMessage(factory, 'msg');
    expect(el.tagName).toBe('P');
    expect(pSpy).toHaveBeenCalledWith('empty-slot-message', 'msg');
  });

  it('returns string when factory missing', () => {
    const result = createEmptySlotMessage(null, 'msg');
    expect(result).toBe('msg');
  });
});
