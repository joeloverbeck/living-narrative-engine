import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import DocumentContext, {
  detectDocumentContext,
} from '../../../src/domUI/documentContext.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('DocumentContext integration', () => {
  let originalDocumentDescriptor;

  beforeEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'document'
    );
  });

  afterEach(() => {
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
    }
  });

  it('detects document contexts and proxies DOM operations', () => {
    document.body.innerHTML = `
      <section id="panel">
        <div class="item">Primary</div>
      </section>
    `;

    const logger = createLogger();

    expect(detectDocumentContext(document, logger)).toBe(document);

    const sectionEl = document.getElementById('panel');
    expect(sectionEl).not.toBeNull();
    expect(detectDocumentContext(sectionEl, logger)).toBe(document);

    const customDocument = {
      querySelector: jest.fn().mockReturnValue('custom-match'),
      createElement: jest.fn().mockReturnValue({ tagName: 'CUSTOM' }),
    };
    expect(detectDocumentContext(customDocument, logger)).toBe(customDocument);

    // Falls back to the global document when no root is provided
    expect(detectDocumentContext(undefined, logger)).toBe(document);
    // Invoking without an explicit logger exercises the default ConsoleLogger branch
    expect(detectDocumentContext()).toBe(document);

    const ctx = new DocumentContext(document, logger);
    const found = ctx.query('.item');
    expect(found?.textContent).toBe('Primary');

    const created = ctx.create('article');
    expect(created?.tagName).toBe('ARTICLE');

    // Exercise error handling paths for query and create
    expect(ctx.query('[')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[DocumentContext] Error during query('["),
      expect.any(Error)
    );

    expect(ctx.create('')).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[DocumentContext] Error during create('')"),
      expect.any(Error)
    );

    expect(ctx.document).toBe(document);

    const defaultLoggerContext = new DocumentContext(document);
    expect(defaultLoggerContext.document).toBe(document);

    const customCtx = new DocumentContext(customDocument, logger);
    expect(customCtx.query('#anything')).toBe('custom-match');
    expect(customDocument.querySelector).toHaveBeenCalledWith('#anything');

    const customCreated = customCtx.create('section');
    expect(customCreated).toEqual({ tagName: 'CUSTOM' });
    expect(customDocument.createElement).toHaveBeenCalledWith('section');
  });

  it('logs failures when no usable document context is available', () => {
    const logger = createLogger();

    const originalQuery = globalThis.document.querySelector;
    const originalCreate = globalThis.document.createElement;
    const originalDocumentCtor = globalThis.Document;
    const originalHTMLElementCtor = globalThis.HTMLElement;

    Object.defineProperty(globalThis.document, 'querySelector', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis.document, 'createElement', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      globalThis.Document = undefined;
      globalThis.HTMLElement = undefined;
    } catch (error) {
      // Some environments may not allow reassignment; ensure they are restored later
    }

    try {
      const ctx = new DocumentContext(null, logger);
      expect(ctx.document).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Construction failed')
      );

      expect(ctx.query('#missing')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "[DocumentContext] query('#missing') attempted, but no document context is available."
      );

      expect(ctx.create('aside')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "[DocumentContext] create('aside') attempted, but no document context is available."
      );
    } finally {
      Object.defineProperty(globalThis.document, 'querySelector', {
        configurable: true,
        writable: true,
        value: originalQuery,
      });
      Object.defineProperty(globalThis.document, 'createElement', {
        configurable: true,
        writable: true,
        value: originalCreate,
      });
      if (typeof originalDocumentCtor !== 'undefined') {
        globalThis.Document = originalDocumentCtor;
      }
      if (typeof originalHTMLElementCtor !== 'undefined') {
        globalThis.HTMLElement = originalHTMLElementCtor;
      }
    }
  });
});
