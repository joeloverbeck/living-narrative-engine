import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class IntegrationEntityManager {
  constructor(entities) {
    this.entities = entities;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    return entity ? entity[componentId] : undefined;
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.entities.get(entityId);
    return entity ? Object.keys(entity) : [];
  }
}

describe('GraphIntegrityValidator integration', () => {
  const buildEntityMap = (entries) =>
    new Map(entries.map(([id, components]) => [id, components]));

  it('validates a well-formed anatomy graph without issues', async () => {
    const entities = buildEntityMap([
      [
        'body',
        {
          'anatomy:sockets': {
            sockets: [
              { id: 'left-arm', allowedTypes: ['limb'] },
              { id: 'right-arm', allowedTypes: ['limb'] },
            ],
          },
          'anatomy:part': { subType: 'torso' },
          'core:name': { text: 'Body' },
          'core:description': { text: 'Well formed body' },
        },
      ],
      [
        'leftArm',
        {
          'anatomy:joint': { parentId: 'body', socketId: 'left-arm' },
          'anatomy:part': { subType: 'limb' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'Left Arm' },
          'core:description': { text: 'Arm ready' },
        },
      ],
    ]);

    const entityIds = ['body', 'leftArm'];
    const socketOccupancy = new Set(['body:left-arm']);
    const recipe = {
      constraints: {
        requires: [
          {
            partTypes: ['limb'],
            components: ['core:description'],
          },
        ],
        excludes: [
          {
            components: ['core:cybernetic', 'core:organic'],
          },
        ],
      },
      slots: {
        limb: { type: 'limb', count: 1 },
      },
    };

    const logger = new TestLogger();
    const validator = new GraphIntegrityValidator({
      entityManager: new IntegrationEntityManager(entities),
      logger,
    });

    const result = await validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
    expect(logger.errorMessages).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
    expect(
      logger.debugMessages.some(({ message }) =>
        message.includes('Validation passed without issues')
      )
    ).toBe(true);
  });

  it('detects structural and constraint violations across validation rules', async () => {
    const entities = buildEntityMap([
      [
        'body',
        {
          'anatomy:sockets': {
            sockets: [{ id: 'left-arm', allowedTypes: ['limb'] }],
          },
          'anatomy:part': { subType: 'torso' },
          'core:name': { text: 'Problematic Body' },
          'core:poison': {},
          'core:antidote': {},
        },
      ],
      [
        'wing',
        {
          'anatomy:joint': { parentId: 'body', socketId: 'left-arm' },
          'anatomy:part': { subType: 'wing' },
          'core:name': { text: 'Wing Attachment' },
        },
      ],
      [
        'orphan',
        {
          'anatomy:joint': {
            parentId: 'ghost-parent',
            socketId: 'missing-socket',
          },
          'anatomy:part': { subType: 'limb' },
        },
      ],
      [
        'cycleA',
        {
          'anatomy:joint': { parentId: 'cycleB', socketId: 'loop' },
          'anatomy:sockets': {
            sockets: [{ id: 'loop', allowedTypes: ['limb'] }],
          },
          'anatomy:part': { subType: 'limb' },
        },
      ],
      [
        'cycleB',
        {
          'anatomy:joint': { parentId: 'cycleA', socketId: 'loop' },
          'anatomy:sockets': {
            sockets: [{ id: 'loop', allowedTypes: ['limb'] }],
          },
          'anatomy:part': { subType: 'limb' },
        },
      ],
      [
        'extraRoot',
        {
          'anatomy:sockets': { sockets: [] },
          'anatomy:part': { subType: 'limb' },
        },
      ],
    ]);

    const entityIds = [
      'body',
      'wing',
      'orphan',
      'cycleA',
      'cycleB',
      'extraRoot',
    ];
    const socketOccupancy = new Set(['body:left-arm', 'body:ghost-socket']);
    const recipe = {
      constraints: {
        requires: [
          {
            partTypes: ['limb'],
            components: ['core:stabilizer'],
          },
        ],
        excludes: [
          {
            components: ['core:poison', 'core:antidote'],
          },
        ],
      },
      slots: {
        limbs: { type: 'limb', count: 1 },
      },
    };

    const logger = new TestLogger();
    const validator = new GraphIntegrityValidator({
      entityManager: new IntegrationEntityManager(entities),
      logger,
    });

    const result = await validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Socket 'ghost-socket' not found on entity 'body'"
        ),
        expect.stringContaining('Required constraint not satisfied'),
        expect.stringContaining('Exclusion constraint violated'),
        expect.stringContaining(
          "Slot 'limbs': expected exactly 1 parts of type 'limb'"
        ),
        expect.stringContaining('Cycle detected in anatomy graph'),
        expect.stringContaining(
          "Entity 'orphan' has joint referencing non-existent parent 'ghost-parent'"
        ),
        expect.stringContaining(
          "Orphaned part 'orphan' has parent 'ghost-parent' not in graph"
        ),
        expect.stringContaining(
          "Part type 'wing' not allowed in socket 'left-arm'"
        ),
      ])
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Multiple root entities found'),
      ])
    );
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('Validation failed')
      )
    ).toBe(true);
    expect(logger.warnMessages).toHaveLength(0);
  });
});
