import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import SocketManager from '../../../src/anatomy/socketManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';

const PARENT_DEFINITION_ID = 'anatomy:test_parent';
const LEFT_PART_DEFINITION_ID = 'anatomy:left_part';
const RIGHT_PART_DEFINITION_ID = 'anatomy:right_part';
const COMPONENTLESS_DEFINITION_ID = 'anatomy:componentless';

const parentDefinition = new EntityDefinition(PARENT_DEFINITION_ID, {
  components: {
    'core:name': { text: 'Integration Torso' },
    'anatomy:sockets': {
      sockets: [
        {
          id: 'left_mount',
          allowedTypes: ['arm'],
          orientation: 'left',
          nameTpl: '{{orientation}} {{type}} mount{{index}} on {{parent.name}}',
        },
        {
          id: 'right_mount',
          allowedTypes: ['arm'],
          orientation: 'right',
          nameTpl: '{{orientation}} {{type}} for {{parent.name}}',
        },
        {
          id: 'neutral_mount',
          allowedTypes: ['arm'],
          nameTpl: '{{effective_orientation}} socket for {{parent.name}}',
        },
        {
          id: 'universal_adapter',
          allowedTypes: ['*'],
        },
      ],
    },
  },
});

const leftPartDefinition = new EntityDefinition(LEFT_PART_DEFINITION_ID, {
  components: {
    'core:name': { text: 'Left Upper Arm' },
    'anatomy:part': { subType: 'upper_arm', orientation: 'left' },
  },
});

const rightPartDefinition = new EntityDefinition(RIGHT_PART_DEFINITION_ID, {
  components: {
    'core:name': { text: 'Replacement Limb' },
    'anatomy:part': { subType: 'upper_arm', orientation: 'right' },
  },
});

const componentlessDefinition = new EntityDefinition(
  COMPONENTLESS_DEFINITION_ID,
  {
    components: {
      'core:name': { text: 'Componentless Node' },
    },
  }
);

describe('SocketManager standalone integration', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  /** @type {import('../../../src/anatomy/socketManager.js').SocketManager} */
  let socketManager;
  /** @type {string} */
  let parentId;
  /** @type {string} */
  let leftPartId;
  /** @type {string} */
  let rightPartId;
  /** @type {string} */
  let componentlessId;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();
    testBed.setupDefinitions(
      parentDefinition,
      leftPartDefinition,
      rightPartDefinition,
      componentlessDefinition
    );

    const parent = await testBed.entityManager.createEntityInstance(
      parentDefinition.id,
      { instanceId: 'torso-1' }
    );
    parentId = parent.id;

    const leftPart = await testBed.entityManager.createEntityInstance(
      leftPartDefinition.id,
      { instanceId: 'arm-left' }
    );
    leftPartId = leftPart.id;

    const rightPart = await testBed.entityManager.createEntityInstance(
      rightPartDefinition.id,
      { instanceId: 'arm-right' }
    );
    rightPartId = rightPart.id;

    const componentless = await testBed.entityManager.createEntityInstance(
      componentlessDefinition.id,
      { instanceId: 'componentless' }
    );
    componentlessId = componentless.id;

    socketManager = new SocketManager({
      entityManager: testBed.entityManager,
      logger: testBed.mocks.logger,
    });
    testBed.mocks.logger.debug.mockClear();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('requires concrete dependencies', () => {
    expect(
      () =>
        new SocketManager({
          // @ts-expect-error intentionally invalid for coverage
          entityManager: null,
          logger: testBed.mocks.logger,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new SocketManager({
          entityManager: testBed.entityManager,
          // @ts-expect-error intentionally invalid for coverage
          logger: null,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('retrieves sockets and handles missing lookups through the entity manager', () => {
    const leftSocket = socketManager.getSocket(parentId, 'left_mount');
    expect(leftSocket).toBeDefined();
    expect(leftSocket.orientation).toBe('left');

    const missingSocket = socketManager.getSocket(parentId, 'unknown_socket');
    expect(missingSocket).toBeUndefined();

    const missingComponent = socketManager.getSocket(componentlessId, 'any');
    expect(missingComponent).toBeNull();

    const missingEntity = socketManager.getSocket('missing-entity', 'any');
    expect(missingEntity).toBeNull();
  });

  it('tracks occupancy state and differentiates required versus optional sockets', () => {
    const occupancy = new Set();

    expect(
      socketManager.isSocketOccupied(parentId, 'left_mount', occupancy)
    ).toBe(false);

    const available = socketManager.validateSocketAvailability(
      parentId,
      'left_mount',
      occupancy,
      true
    );
    expect(available.valid).toBe(true);
    expect(available.socket?.id).toBe('left_mount');

    const optionalMissing = socketManager.validateSocketAvailability(
      parentId,
      'ghost_socket',
      occupancy,
      false
    );
    expect(optionalMissing.valid).toBe(false);
    expect(optionalMissing.error).toBeUndefined();

    const requiredMissing = socketManager.validateSocketAvailability(
      parentId,
      'ghost_socket',
      occupancy,
      true
    );
    expect(requiredMissing.valid).toBe(false);
    expect(requiredMissing.error).toContain("Socket 'ghost_socket' not found");
    expect(requiredMissing.error).toContain(parentDefinition.id);

    socketManager.occupySocket(parentId, 'left_mount', occupancy);
    expect(
      socketManager.isSocketOccupied(parentId, 'left_mount', occupancy)
    ).toBe(true);

    const optionalOccupied = socketManager.validateSocketAvailability(
      parentId,
      'left_mount',
      occupancy,
      false
    );
    expect(optionalOccupied.valid).toBe(false);
    expect(optionalOccupied.error).toBeUndefined();

    const requiredOccupied = socketManager.validateSocketAvailability(
      parentId,
      'left_mount',
      occupancy,
      true
    );
    expect(requiredOccupied.valid).toBe(false);
    expect(requiredOccupied.error).toContain(
      "Socket 'left_mount' is already occupied"
    );

    let errors = socketManager.validateOccupiedSockets(occupancy);
    expect(errors).toHaveLength(0);

    occupancy.add('ghost_parent:missing_socket');
    errors = socketManager.validateOccupiedSockets(occupancy);
    expect(errors).toEqual([
      "Occupied socket 'missing_socket' not found on entity 'ghost_parent'",
    ]);
  });

  it('evaluates allowed part types including wildcard sockets', () => {
    const leftSocket = socketManager.getSocket(parentId, 'left_mount');
    expect(socketManager.isPartTypeAllowed(leftSocket, 'arm')).toBe(true);
    expect(socketManager.isPartTypeAllowed(leftSocket, 'leg')).toBe(false);

    const universalSocket = socketManager.getSocket(
      parentId,
      'universal_adapter'
    );
    expect(universalSocket).toBeDefined();
    expect(socketManager.isPartTypeAllowed(universalSocket, 'horn')).toBe(true);
    expect(socketManager.isPartTypeAllowed(universalSocket, 'tail')).toBe(true);
  });

  it('generates descriptive names using orientation fallbacks and skips sockets without templates', () => {
    const leftSocket = socketManager.getSocket(parentId, 'left_mount');
    const leftName = socketManager.generatePartName(
      leftSocket,
      leftPartId,
      parentId
    );
    expect(leftName).toBe('left upper arm mount on Integration Torso');

    const neutralSocket = socketManager.getSocket(parentId, 'neutral_mount');
    const neutralName = socketManager.generatePartName(
      neutralSocket,
      leftPartId,
      parentId
    );
    expect(neutralName).toBe('left socket for Integration Torso');

    const rightSocket = socketManager.getSocket(parentId, 'right_mount');
    expect(rightSocket.orientation).toBe('right');
    const rightName = socketManager.generatePartName(
      rightSocket,
      leftPartId,
      parentId
    );
    const debugMessages = testBed.mocks.logger.debug.mock.calls.map(
      ([message]) => message
    );
    expect(debugMessages[debugMessages.length - 2]).toContain(
      "socket.orientation: 'right'"
    );
    expect(debugMessages[debugMessages.length - 2]).toContain(
      "effectiveOrientation: 'left'"
    );
    expect(rightName).toBe('right upper arm for Integration Torso');

    const universalSocket = socketManager.getSocket(
      parentId,
      'universal_adapter'
    );
    const nameWithoutTemplate = socketManager.generatePartName(
      universalSocket,
      rightPartId,
      parentId
    );
    expect(nameWithoutTemplate).toBeNull();
  });
});
