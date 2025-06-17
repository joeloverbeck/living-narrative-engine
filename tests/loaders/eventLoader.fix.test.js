import { jest, describe, expect, it } from '@jest/globals';
import EventLoader from '../../src/loaders/eventLoader.js';

// 🔧  tiny test doubles – enough for this unit
const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};
const pathResolver = {
  resolveModContentPath: jest.fn((m, d, f) => `/fake/${m}/${d}/${f}`),
};
const dataFetcher = {
  fetch: jest.fn(async () => ({ id: 'core:dummy', payloadSchema: {} })),
};

class StubValidator {
  constructor() {
    this.loaded = new Set(['http://example.com/schemas/event.schema.json']);
    this.validate = jest.fn(() => ({ isValid: true, errors: null }));
  }

  isSchemaLoaded = (id) => this.loaded.has(id);
  getValidator = () => () => true;
}

class StubRegistry {
  store() {}

  get() {}
}

const CONFIG_FIX = {
  // mirrors the code fix above
  getContentTypeSchemaId: (t) =>
    ({
      events: 'http://example.com/schemas/event.schema.json',
    })[t] || null,
  getModsBasePath: () => '',
};

describe('EventLoader – schema mapping', () => {
  it('binds to the event schema, not the component schema', async () => {
    const validator = new StubValidator();
    const loader = new EventLoader(
      CONFIG_FIX,
      pathResolver,
      dataFetcher,
      validator,
      new StubRegistry(),
      logger
    );

    // private but testable: _primarySchemaId is set in the base-ctor
    expect(loader._primarySchemaId).toBe(
      'http://example.com/schemas/event.schema.json'
    );

    // run one tiny file through the complete wrapper ­– the stub validator gets called
    await loader.loadItemsForMod(
      'core',
      { content: { events: ['dummy.event.json'] } }, // minimal manifest
      'events',
      'events',
      'events'
    );

    expect(validator.validate).toHaveBeenCalledWith(
      'http://example.com/schemas/event.schema.json',
      expect.any(Object)
    );
  });
});
