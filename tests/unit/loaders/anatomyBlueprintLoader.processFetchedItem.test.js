import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyBlueprintLoader from '../../../src/loaders/anatomyBlueprintLoader.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({
    qualifiedId: 'core:blueprint',
    didOverride: false,
  }),
}));

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

describe('AnatomyBlueprintLoader._processFetchedItem', () => {
  let loader;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyBlueprintLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    jest.clearAllMocks();
  });

  it('processes a valid blueprint and stores it', async () => {
    const data = {
      id: 'core:human',
      root: 'body',
      attachments: [{ parent: 'body', socket: 'head', child: 'head' }],
    };

    const validateSpy = jest.spyOn(loader, '_validateAttachments');

    const result = await loader._processFetchedItem(
      'core',
      'human.blueprint.json',
      '/tmp/human.blueprint.json',
      data,
      'anatomyBlueprints'
    );

    expect(validateSpy).toHaveBeenCalledWith(
      data.attachments,
      'core',
      'human.blueprint.json'
    );
    expect(processAndStoreItem).toHaveBeenCalledWith(
      loader,
      expect.objectContaining({
        data,
        idProp: 'id',
        category: 'anatomyBlueprints',
        modId: 'core',
        filename: 'human.blueprint.json',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyBlueprintLoader [core]: Processing fetched item: human.blueprint.json (Type: anatomyBlueprints)'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyBlueprintLoader [core]: Successfully processed anatomy blueprint from human.blueprint.json. Final registry key: core:blueprint, Overwrite: false'
    );
    expect(result).toEqual({
      qualifiedId: 'core:blueprint',
      didOverride: false,
    });
  });

  it('throws if id is missing', async () => {
    const data = { root: 'body' };
    await expect(
      loader._processFetchedItem(
        'core',
        'missing.blueprint.json',
        '/tmp/missing.blueprint.json',
        data,
        'anatomyBlueprints'
      )
    ).rejects.toThrow(
      "Invalid blueprint in 'missing.blueprint.json' from mod 'core'. Missing required 'id' field."
    );
  });

  it('throws if root is missing', async () => {
    const data = { id: 'core:human' };
    await expect(
      loader._processFetchedItem(
        'core',
        'missingroot.blueprint.json',
        '/tmp/missingroot.blueprint.json',
        data,
        'anatomyBlueprints'
      )
    ).rejects.toThrow(
      "Invalid blueprint in 'missingroot.blueprint.json' from mod 'core'. Missing required 'root' field."
    );
  });

  it('skips attachment validation when attachments is not an array', async () => {
    const data = { id: 'core:human', root: 'body', attachments: null };
    const validateSpy = jest.spyOn(loader, '_validateAttachments');

    await loader._processFetchedItem(
      'core',
      'noattach.blueprint.json',
      '/tmp/noattach.blueprint.json',
      data,
      'anatomyBlueprints'
    );

    expect(validateSpy).not.toHaveBeenCalled();
  });
});

describe('AnatomyBlueprintLoader._validateAttachments', () => {
  let loader;
  let logger;

  beforeEach(() => {
    loader = new AnatomyBlueprintLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
      createSimpleMockDataRegistry(),
      (logger = createMockLogger())
    );
    jest.clearAllMocks();
  });

  it('throws when an attachment is missing required fields', () => {
    expect(() =>
      loader._validateAttachments(
        [{ parent: 'body', socket: 'head' }],
        'core',
        'file.blueprint.json'
      )
    ).toThrow(
      "Invalid attachment in blueprint 'file.blueprint.json' from mod 'core'. Each attachment must have parent, socket, and child fields."
    );
  });

  it('warns when duplicate parent-socket pairs are present', () => {
    loader._validateAttachments(
      [
        { parent: 'body', socket: 'head', child: 'head1' },
        { parent: 'body', socket: 'head', child: 'head2' },
      ],
      'core',
      'dup.blueprint.json'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "AnatomyBlueprintLoader [core]: Duplicate parent-socket pair 'body:head' in blueprint 'dup.blueprint.json'. Only the last definition will be used."
    );
  });

  it('does not warn for unique parent-socket pairs', () => {
    loader._validateAttachments(
      [
        { parent: 'body', socket: 'left', child: 'arm' },
        { parent: 'body', socket: 'right', child: 'arm' },
      ],
      'core',
      'unique.blueprint.json'
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
