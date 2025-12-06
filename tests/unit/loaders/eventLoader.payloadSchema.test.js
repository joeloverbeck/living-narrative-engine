import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventLoader from '../../../src/loaders/eventLoader.js';

const createConfig = () => ({
  getContentTypeSchemaId: jest
    .fn()
    .mockImplementation((key) =>
      key === 'events'
        ? 'schema://living-narrative-engine/event.schema.json'
        : null
    ),
  getModsBasePath: jest.fn().mockReturnValue('/mods'),
  getSchemaBasePath: jest.fn(),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn(),
  getBaseDataPath: jest.fn(),
  getGameConfigFilename: jest.fn(),
  getModManifestFilename: jest.fn(),
  getContentBasePath: jest.fn(),
});

const createPathResolver = () => ({
  resolveModContentPath: jest.fn(),
});

const createDataFetcher = () => ({
  fetch: jest.fn(),
});

const createSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn(),
});

const createRegistry = () => ({
  store: jest.fn(),
  get: jest.fn(),
});

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('EventLoader payload handling', () => {
  let loader;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    loader = new EventLoader(
      createConfig(),
      createPathResolver(),
      createDataFetcher(),
      createSchemaValidator(),
      createRegistry(),
      logger
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers inline payload schemas when provided', async () => {
    const registerSpy = jest
      .spyOn(loader, '_registerItemSchema')
      .mockResolvedValue(undefined);
    const storeSpy = jest
      .spyOn(loader, '_storeItemInRegistry')
      .mockReturnValue({ qualifiedId: 'core:test.event', didOverride: false });

    const payloadSchema = {
      type: 'object',
      properties: {
        outcome: { type: 'string' },
      },
      required: ['outcome'],
    };

    const result = await loader._processFetchedItem(
      'core',
      'event.json',
      '/mods/core/events/event.json',
      { id: 'core:test.event', payloadSchema },
      'events'
    );

    expect(registerSpy).toHaveBeenCalledTimes(1);
    const [dataArg, propName, schemaId, messages] = registerSpy.mock.calls[0];
    expect(dataArg).toEqual({ id: 'core:test.event', payloadSchema });
    expect(propName).toBe('payloadSchema');
    expect(schemaId).toBe('core:test.event#payload');
    expect(messages).toMatchObject({
      warnMessage: expect.stringContaining(
        "EventLoader [core]: Payload schema ID 'core:test.event#payload'"
      ),
      successDebugMessage: expect.stringContaining(
        'Successfully registered payload schema'
      ),
      errorLogMessage: expect.stringContaining(
        'CRITICAL - Failed to register payload schema'
      ),
      throwErrorMessage: expect.stringContaining(
        'CRITICAL: Failed to register payload schema'
      ),
    });

    expect(messages.errorContext?.()).toEqual({
      modId: 'core',
      filename: 'event.json',
      eventId: 'core:test.event',
    });

    expect(storeSpy).toHaveBeenCalledWith(
      'events',
      'core',
      'test.event',
      { id: 'core:test.event', payloadSchema },
      'event.json'
    );
    expect(result).toEqual({
      qualifiedId: 'core:test.event',
      didOverride: false,
    });

    // ensure logging captures the informative branches as well
    expect(logger.debug).toHaveBeenCalledWith(
      "EventLoader [core]: Found valid payloadSchema in event.json for event 'core:test.event'."
    );
  });

  it('skips schema registration when payload schema is missing or empty', async () => {
    const registerSpy = jest
      .spyOn(loader, '_registerItemSchema')
      .mockResolvedValue(undefined);
    const storeSpy = jest
      .spyOn(loader, '_storeItemInRegistry')
      .mockReturnValue({ qualifiedId: 'core:test.event', didOverride: true });

    const result = await loader._processFetchedItem(
      'core',
      'event.json',
      '/mods/core/events/event.json',
      { id: 'core:test.event', payloadSchema: {} },
      'events'
    );

    expect(registerSpy).not.toHaveBeenCalled();
    expect(storeSpy).toHaveBeenCalledWith(
      'events',
      'core',
      'test.event',
      { id: 'core:test.event', payloadSchema: {} },
      'event.json'
    );
    expect(result).toEqual({
      qualifiedId: 'core:test.event',
      didOverride: true,
    });

    // verify debug logging covers the storage delegation path
    expect(logger.debug).toHaveBeenCalledWith(
      "EventLoader [core]: Delegating storage for event (base ID: 'test.event') from event.json to base helper."
    );
  });
});
