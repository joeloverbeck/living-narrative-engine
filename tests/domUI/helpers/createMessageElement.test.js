/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import createMessageElement from '../../../src/domUI/helpers/createMessageElement.js';

describe('createMessageElement', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates paragraph with class and text', () => {
    const el = createMessageElement(factory, 'test-class', 'hello');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe('P');
    expect(el.classList.contains('test-class')).toBe(true);
    expect(el.textContent).toBe('hello');
  });

  it('returns text node when factory is missing', () => {
    const node = createMessageElement(undefined, 'x', 'msg');
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('msg');
  });

  it('returns text node when factory fails to create', () => {
    const badFactory = { p: () => null };
    const node = createMessageElement(badFactory, 'x', 'msg');
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('msg');
  });
});
