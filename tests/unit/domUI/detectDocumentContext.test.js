import { describe, it, expect, beforeEach } from '@jest/globals';
import { detectDocumentContext } from '../../../src/domUI/documentContext.js';

// Use the JSDOM environment provided by Jest

describe('detectDocumentContext (JSDOM)', () => {
  let window;
  let document;

  beforeEach(() => {
    window = global.window;
    document = global.document;
    document.body.innerHTML = '<div id="root"><span class="foo"></span></div>';
    global.HTMLElement = window.HTMLElement;
    global.Document = window.Document;
  });

  it('returns the global document when no root is provided', () => {
    const ctx = detectDocumentContext();
    expect(ctx).toBe(document);
  });

  it("returns the root's ownerDocument when given an element", () => {
    const rootEl = document.getElementById('root');
    const ctx = detectDocumentContext(rootEl);
    expect(ctx).toBe(document);
  });

  it('returns the provided document when passed directly', () => {
    const ctx = detectDocumentContext(document);
    expect(ctx).toBe(document);
  });

  it('uses duck-typed document-like objects', () => {
    const fakeDoc = {
      querySelector: () => null,
      createElement: () => null,
    };
    const ctx = detectDocumentContext(fakeDoc);
    expect(ctx).toBe(fakeDoc);
  });
});
