import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 * Creates a logger instance that records debug/info/warn/error output.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Minimal body graph service that returns a controllable list of part ids.
 */
class StubBodyGraphService {
  constructor(parts = []) {
    this.parts = parts;
    this.calls = [];
  }

  setParts(parts) {
    this.parts = parts;
  }

  getAllParts(requested) {
    this.calls.push(requested);
    return this.parts;
  }
}

/**
 * In-memory entity finder that returns pre-registered entity objects.
 */
class InMemoryEntityFinder {
  constructor() {
    this.entities = new Map();
  }

  setEntity(entityId, entity) {
    this.entities.set(entityId, entity);
  }

  getEntityInstance(entityId) {
    return this.entities.get(entityId) || null;
  }
}

describe('BodyDescriptionComposer edge case integration', () => {
  let logger;
  let bodyGraphService;
  let entityFinder;
  let composer;
  let equipmentDescriptionService;

  beforeEach(() => {
    logger = createLogger();
    bodyGraphService = new StubBodyGraphService();
    entityFinder = new InMemoryEntityFinder();

    equipmentDescriptionService = {
      generateEquipmentDescription: jest.fn().mockResolvedValue(null),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {
        buildPartDescriptions: () => [],
      },
      bodyGraphService,
      entityFinder,
      anatomyFormattingService: {
        getDescriptionOrder: () => ['build', 'arm', 'equipment'],
      },
      partDescriptionGenerator: {
        generatePartDescription: () => '',
      },
      equipmentDescriptionService,
      logger,
    });

    composer.descriptionTemplate.createStructuredLine = jest
      .fn()
      .mockImplementation(
        (type, parts) => `${type}:${parts.map((p) => p.id).join(',')}`
      );
    composer.config.getDescriptionOrder = jest
      .fn()
      .mockReturnValue(['build', 'arm', 'equipment']);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles invalid or incomplete body entities defensively', async () => {
    await expect(composer.composeDescription(null)).resolves.toBe('');
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('bodyEntity is null or undefined')
      )
    ).toBe(true);

    const noHasComponent = {
      id: 'no-has',
      getComponentData: () => null,
    };
    await expect(composer.composeDescription(noHasComponent)).resolves.toBe('');
    expect(
      logger.error.mock.calls.some(
        ([message, context]) =>
          message.includes('does not have hasComponent method') &&
          context.bodyEntityId === 'no-has'
      )
    ).toBe(true);

    const noGetComponent = {
      id: 'no-get',
      hasComponent: () => true,
    };
    await expect(composer.composeDescription(noGetComponent)).resolves.toBe('');
    expect(
      logger.error.mock.calls.some(
        ([message, context]) =>
          message.includes('does not have getComponentData method') &&
          context.bodyEntityId === 'no-get'
      )
    ).toBe(true);

    const missingBodyComponent = {
      id: 'missing-body',
      hasComponent: (componentId) => componentId === 'something-else',
      getComponentData: () => null,
    };
    await expect(
      composer.composeDescription(missingBodyComponent)
    ).resolves.toBe('');
    expect(
      logger.debug.mock.calls.some(
        ([message, context]) =>
          message.includes('does not have anatomy:body component') &&
          context.bodyEntityId === 'missing-body'
      )
    ).toBe(true);

    const noRootComponent = {
      id: 'no-root',
      hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
      getComponentData: (componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID ? { body: {} } : null,
    };
    await expect(composer.composeDescription(noRootComponent)).resolves.toBe(
      ''
    );

    bodyGraphService.setParts([]);
    const noPartsEntity = {
      id: 'no-parts',
      hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
      getComponentData: (componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID
          ? { body: { root: 'root-1' } }
          : null,
    };
    await expect(composer.composeDescription(noPartsEntity)).resolves.toBe('');
    expect(bodyGraphService.calls).toHaveLength(1);
  });

  it('groups parts by subtype while warning about malformed entities', () => {
    const malformedMissingHas = { id: 'missing-has' };
    const malformedMissingGet = {
      id: 'missing-get',
      hasComponent: (componentId) => componentId === 'anatomy:part',
    };
    const malformedNotPart = {
      id: 'not-part',
      hasComponent: (componentId) => componentId === 'something-else',
      getComponentData: () => null,
    };
    const malformedNoSubtype = {
      id: 'no-subtype',
      hasComponent: (componentId) => componentId === 'anatomy:part',
      getComponentData: () => ({}),
    };
    const validArm = {
      id: 'arm-1',
      hasComponent: (componentId) => componentId === 'anatomy:part',
      getComponentData: (componentId) =>
        componentId === 'anatomy:part' ? { subType: 'arm' } : null,
    };
    const validHead = {
      id: 'head-1',
      hasComponent: (componentId) => componentId === 'anatomy:part',
      getComponentData: (componentId) =>
        componentId === 'anatomy:part' ? { subType: 'head' } : null,
    };

    entityFinder.setEntity('missing-has', malformedMissingHas);
    entityFinder.setEntity('missing-get', malformedMissingGet);
    entityFinder.setEntity('no-subtype', malformedNoSubtype);
    entityFinder.setEntity('not-part', malformedNotPart);
    entityFinder.setEntity('arm-left', validArm);
    entityFinder.setEntity('arm-right', { ...validArm, id: 'arm-right' });
    entityFinder.setEntity('head-main', validHead);

    const grouped = composer.groupPartsByType([
      'ghost',
      'missing-has',
      'missing-get',
      'no-subtype',
      'not-part',
      'arm-left',
      'arm-right',
      'head-main',
    ]);

    expect(grouped.get('arm')).toHaveLength(2);
    expect(grouped.get('head')).toHaveLength(1);
    expect(Array.from(grouped.keys())).toEqual(
      expect.arrayContaining(['arm', 'head'])
    );

    expect(
      logger.warn.mock.calls.some(
        ([message, details]) =>
          message.includes('Part entity missing hasComponent method') &&
          details.partId === 'missing-has'
      )
    ).toBe(true);
    expect(
      logger.warn.mock.calls.some(
        ([message, details]) =>
          message.includes('Part entity missing getComponentData method') &&
          details.partId === 'missing-get'
      )
    ).toBe(true);
  });

  it('extracts descriptors from body components and fallback entity-level data', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const bodyLessEntity = { id: 'no-get' };
    expect(composer.extractHeightDescription(bodyLessEntity)).toBe('');

    const fallbackEntity = {
      id: 'fallback',
      hasComponent: () => true,
      getComponentData: (componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          throw new Error('failed to load anatomy');
        }
        if (componentId === 'descriptors:height') {
          return { height: '6 ft' };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'lean muscle' };
        }
        if (componentId === 'descriptors:body_hair') {
          return { density: 'trimmed' };
        }
        if (componentId === 'descriptors:skin_color') {
          return { skinColor: 'tan' };
        }
        return null;
      },
    };

    expect(composer.extractHeightDescription(fallbackEntity)).toBe('6 ft');
    expect(composer.extractBuildDescription(fallbackEntity)).toBe('athletic');
    expect(composer.extractBodyCompositionDescription(fallbackEntity)).toBe(
      'lean muscle'
    );
    expect(composer.extractBodyHairDescription(fallbackEntity)).toBe('trimmed');
    expect(composer.extractSkinColorDescription(fallbackEntity)).toBe('tan');

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to get anatomy:body component',
      expect.any(Error)
    );
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(5);

    const descriptors = composer.extractBodyLevelDescriptors(fallbackEntity);
    expect(descriptors.height).toBe('Height: 6 ft');
    expect(descriptors.build).toBe('Build: athletic');
    expect(descriptors.body_composition).toBe('Body composition: lean muscle');
    expect(descriptors.body_hair).toBe('Body hair: trimmed');
    expect(descriptors.skin_color).toBe('Skin color: tan');

    const emptyDescriptorsEntity = {
      id: 'empty-descriptors',
      hasComponent: () => true,
      getComponentData: (componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { descriptors: {} } };
        }
        return null;
      },
    };

    expect(composer.extractHeightDescription(emptyDescriptorsEntity)).toBe('');
    expect(composer.extractBuildDescription(emptyDescriptorsEntity)).toBe('');
    expect(
      composer.extractBodyCompositionDescription(emptyDescriptorsEntity)
    ).toBe('');
    expect(composer.extractBodyHairDescription(emptyDescriptorsEntity)).toBe(
      ''
    );
    expect(composer.extractSkinColorDescription(emptyDescriptorsEntity)).toBe(
      ''
    );

    expect(
      composer.extractBodyLevelDescriptors(emptyDescriptorsEntity)
    ).toEqual({});

    const loggerWithoutDebug = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const composerWithoutDebug = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {
        buildPartDescriptions: () => [],
      },
      bodyGraphService: new StubBodyGraphService(),
      entityFinder: new InMemoryEntityFinder(),
      anatomyFormattingService: {
        getDescriptionOrder: () => ['build'],
      },
      partDescriptionGenerator: {
        generatePartDescription: () => '',
      },
      equipmentDescriptionService: null,
      logger: loggerWithoutDebug,
    });

    expect(
      composerWithoutDebug.extractHeightDescription(emptyDescriptorsEntity)
    ).toBe('');

    warnSpy.mockRestore();
  });

  it('composes descriptions using descriptor ordering and avoids duplicate part processing', async () => {
    bodyGraphService.setParts(['arm-left', 'arm-right']);

    entityFinder.setEntity('arm-left', {
      id: 'arm-left',
      hasComponent: (componentId) => componentId === 'anatomy:part',
      getComponentData: (componentId) =>
        componentId === 'anatomy:part' ? { subType: 'arm' } : null,
    });
    entityFinder.setEntity('arm-right', {
      id: 'arm-right',
      hasComponent: (componentId) => componentId === 'anatomy:part',
      getComponentData: (componentId) =>
        componentId === 'anatomy:part' ? { subType: 'arm' } : null,
    });

    composer.config.getDescriptionOrder.mockReturnValue([
      'build',
      'arm',
      'equipment',
      'arm',
    ]);
    equipmentDescriptionService.generateEquipmentDescription.mockResolvedValueOnce(
      'Equipped: reinforced gauntlets'
    );

    const bodyEntity = {
      id: 'actor-1',
      hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
      getComponentData: (componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'actor-root',
              descriptors: {
                height: 'six feet tall',
                build: 'muscular',
                composition: 'lean mass',
                hairDensity: 'light fuzz',
                skinColor: 'copper',
              },
            },
          };
        }
        return null;
      },
    };

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toContain('Height: six feet tall');
    expect(description).toContain('Build: muscular');
    expect(description).toContain('Equipped: reinforced gauntlets');

    const directDescriptors = composer.extractBodyLevelDescriptors(bodyEntity);
    expect(directDescriptors).toMatchObject({
      height: 'Height: six feet tall',
      build: 'Build: muscular',
      body_composition: 'Body composition: lean mass',
      body_hair: 'Body hair: light fuzz',
      skin_color: 'Skin color: copper',
    });

    expect(
      composer.descriptionTemplate.createStructuredLine
    ).toHaveBeenCalledTimes(1);
    expect(
      composer.descriptionTemplate.createStructuredLine
    ).toHaveBeenCalledWith(
      'arm',
      expect.arrayContaining([
        expect.objectContaining({ id: 'arm-left' }),
        expect.objectContaining({ id: 'arm-right' }),
      ])
    );
    expect(
      equipmentDescriptionService.generateEquipmentDescription
    ).toHaveBeenCalledWith('actor-1');

    const withoutEquipment = await composer.composeDescription(bodyEntity);
    expect(withoutEquipment).not.toContain('Equipped: reinforced gauntlets');
    expect(
      composer.descriptionTemplate.createStructuredLine
    ).toHaveBeenCalledTimes(2);
    expect(
      equipmentDescriptionService.generateEquipmentDescription
    ).toHaveBeenCalledTimes(2);

    const descriptorOrder = composer.getBodyDescriptorOrder(['build', 'arm']);
    expect(descriptorOrder[0]).toBe('height');
    const descriptorOrderWithHeight = composer.getBodyDescriptorOrder([
      'height',
      'build',
    ]);
    expect(descriptorOrderWithHeight).toEqual(['height', 'build']);
  });
});
