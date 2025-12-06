import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionLoader from '../../../src/loaders/actionLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  validateVisualProperties,
  hasVisualProperties,
  countActionsWithVisualProperties,
} from '../../../src/validation/visualPropertiesValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

/**
 * Creates an ActionLoader wired with lightweight service implementations that mirror
 * the real loader flow closely enough for integration coverage around visual properties.
 *
 * @returns {{ loader: ActionLoader, logger: ReturnType<typeof createMockLogger>, registry: InMemoryDataRegistry }}
 */
function createLoaderWithDependencies() {
  const logger = createMockLogger();
  const registry = new InMemoryDataRegistry({ logger });

  const config = {
    getModsBasePath: () => './mods',
    getContentTypeSchemaId: () =>
      'schema://living-narrative-engine/action.schema.json',
  };

  const pathResolver = {
    resolveModContentPath: (modId, folder, filename) =>
      `${modId}/${folder}/${filename}`,
  };

  const dataFetcher = {
    fetch: jest.fn(),
  };

  const schemaValidator = {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    getValidator: jest
      .fn()
      .mockReturnValue(() => ({ isValid: true, errors: null })),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
  };

  const loader = new ActionLoader(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );

  return { loader, logger, registry };
}

describe('Integration: visualPropertiesValidator with ActionLoader', () => {
  let loader;
  let logger;
  let registry;

  beforeEach(() => {
    ({ loader, logger, registry } = createLoaderWithDependencies());
  });

  it('logs and counts visual properties for loaded actions', async () => {
    const modId = 'stylishMod';
    const registryKey = 'actions';

    const richVisuals = {
      id: 'pose_action',
      commandVerb: 'pose',
      description: 'Strike a pose',
      visual: {
        backgroundColor: '#123456',
        textColor: 'white',
        hoverBackgroundColor: 'rgba(10, 20, 30, 0.5)',
        hoverTextColor: 'cornflowerblue',
      },
    };

    const plainAction = {
      id: 'plain_action',
      commandVerb: 'stand',
      description: 'Just stand there',
    };

    await loader._processFetchedItem(
      modId,
      'pose_action.json',
      `${modId}/actions/pose_action.json`,
      richVisuals,
      registryKey
    );
    await loader._processFetchedItem(
      modId,
      'plain_action.json',
      `${modId}/actions/plain_action.json`,
      plainAction,
      registryKey
    );

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');

    expect(
      debugMessages.some((message) =>
        message.includes(
          'Action stylishMod:pose_action loaded with visual properties:'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'Action stylishMod:plain_action loaded with visual properties:'
        )
      )
    ).toBe(false);

    const storedActions = registry.getAll('actions');
    expect(storedActions).toHaveLength(2);
    expect(countActionsWithVisualProperties(storedActions)).toBe(1);

    const [storedRichAction] = storedActions.filter(
      (action) => action.id === 'stylishMod:pose_action'
    );
    const validated = validateVisualProperties(
      storedRichAction.visual,
      storedRichAction.id
    );
    expect(validated).toEqual(richVisuals.visual);
  });

  it('surfaces detailed validation errors for invalid visual configuration', () => {
    const invalidVisual = {
      backgroundColor: 'not-a-color',
      hoverBackgroundColor: 123,
      hoverTextColor: 'papayawhip',
      unknownFlag: 'experimental',
    };

    expect(() =>
      validateVisualProperties(invalidVisual, 'stylishMod:glitchy_action')
    ).toThrow(
      /Invalid visual properties for action stylishMod:glitchy_action:\nbackgroundColor: Invalid CSS color value: "not-a-color"\. Expected hex \(#RGB or #RRGGBB\), rgb\(\), rgba\(\), or named color\.\nhoverBackgroundColor: Color must be a string\nUnknown visual properties: unknownFlag/
    );
  });

  it('handles empty, null, and malformed visual definitions when loading actions', async () => {
    const modId = 'quirkyMod';
    const registryKey = 'actions';

    const emptyVisualAction = {
      id: 'empty_visual',
      commandVerb: 'blink',
      description: 'Blink and you miss it',
      visual: {},
    };

    const nullVisualAction = {
      id: 'null_visual',
      commandVerb: 'shrug',
      description: 'No flair here',
      visual: null,
    };

    await loader._processFetchedItem(
      modId,
      'empty_visual.json',
      `${modId}/actions/empty_visual.json`,
      emptyVisualAction,
      registryKey
    );
    await loader._processFetchedItem(
      modId,
      'null_visual.json',
      `${modId}/actions/null_visual.json`,
      nullVisualAction,
      registryKey
    );

    const storedActions = registry.getAll('actions');
    const emptyStored = storedActions.find(
      (action) => action.id === 'quirkyMod:empty_visual'
    );
    const nullStored = storedActions.find(
      (action) => action.id === 'quirkyMod:null_visual'
    );

    expect(hasVisualProperties(emptyStored)).toBe(false);
    expect(hasVisualProperties(nullStored)).toBe(false);
    expect(countActionsWithVisualProperties(storedActions)).toBe(0);

    expect(() =>
      validateVisualProperties(null, 'quirkyMod:null_visual')
    ).toThrow(
      'Invalid visual properties for action quirkyMod:null_visual: expected object'
    );
    expect(countActionsWithVisualProperties('not-an-array')).toBe(0);
  });
});
