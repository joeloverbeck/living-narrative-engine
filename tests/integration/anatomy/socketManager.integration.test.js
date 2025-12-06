/**
 * @file Integration tests for the SocketManager coordinating with the anatomy system.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

const HUMAN_BALANCED_RECIPE = 'anatomy:human_female_balanced';

/**
 * Extracts debug log messages from the test bed logger for easier assertions.
 *
 * @param {AnatomyIntegrationTestBed} testBed - The active integration test bed.
 * @returns {string[]} The collected debug messages.
 */
function getDebugMessages(testBed) {
  return testBed.logger.debug.mock.calls.map(([message]) => message);
}

describe('SocketManager integration', () => {
  let testBed;
  let actor;
  let entityManager;
  let socketManager;
  let anatomyService;
  let torsoId;
  /** @type {Record<string, string>} */
  let anatomyParts;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    actor = await testBed.createActor({ recipeId: HUMAN_BALANCED_RECIPE });
    anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    entityManager = testBed.container.get('IEntityManager');
    socketManager = testBed.container.get('SocketManager');

    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyBody = actorInstance.getComponentData('anatomy:body');
    torsoId = anatomyBody.body.root;
    anatomyParts = anatomyBody.body.parts;

    testBed.logger.debug.mockClear();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should retrieve sockets and report missing ones using live entity data', () => {
    const leftShoulder = socketManager.getSocket(torsoId, 'left_shoulder');
    expect(leftShoulder).toBeDefined();
    expect(leftShoulder.orientation).toBe('left');
    expect(leftShoulder.allowedTypes).toEqual(expect.arrayContaining(['arm']));

    const missing = socketManager.getSocket(torsoId, 'nonexistent_socket');
    expect(missing).toBeUndefined();

    const leftHandId = anatomyParts['left hand'];
    const noSockets = socketManager.getSocket(leftHandId, 'anything');
    expect(noSockets).toBeNull();

    const debugMessages = getDebugMessages(testBed);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `SocketManager: Socket 'nonexistent_socket' not found on entity '${torsoId}'`
        ),
        expect.stringContaining(
          `SocketManager: No sockets component found on entity '${leftHandId}'`
        ),
      ])
    );
  });

  it('should validate socket availability for required and optional attachments', async () => {
    const occupancy = new Set();
    const parentEntity = entityManager.getEntityInstance(torsoId);
    const expectedParentId = parentEntity?.definitionId || torsoId;

    expect(
      socketManager.isSocketOccupied(torsoId, 'left_shoulder', occupancy)
    ).toBe(false);

    const available = socketManager.validateSocketAvailability(
      torsoId,
      'left_shoulder',
      occupancy,
      true
    );
    expect(available.valid).toBe(true);
    expect(available.socket?.id).toBe('left_shoulder');

    const optionalMissing = socketManager.validateSocketAvailability(
      torsoId,
      'missing_socket',
      occupancy,
      false
    );
    expect(optionalMissing.valid).toBe(false);
    expect(optionalMissing.error).toBeUndefined();

    const requiredMissing = socketManager.validateSocketAvailability(
      torsoId,
      'missing_socket',
      occupancy,
      true
    );
    expect(requiredMissing.valid).toBe(false);
    expect(requiredMissing.error).toContain(
      "Socket 'missing_socket' not found"
    );
    expect(requiredMissing.error).toContain(expectedParentId);

    socketManager.occupySocket(torsoId, 'left_shoulder', occupancy);
    expect(
      socketManager.isSocketOccupied(torsoId, 'left_shoulder', occupancy)
    ).toBe(true);

    const optionalOccupied = socketManager.validateSocketAvailability(
      torsoId,
      'left_shoulder',
      occupancy,
      false
    );
    expect(optionalOccupied.valid).toBe(false);
    expect(optionalOccupied.error).toBeUndefined();

    const requiredOccupied = socketManager.validateSocketAvailability(
      torsoId,
      'left_shoulder',
      occupancy,
      true
    );
    expect(requiredOccupied.valid).toBe(false);
    expect(requiredOccupied.error).toContain(
      "Socket 'left_shoulder' is already occupied"
    );

    const debugMessages = getDebugMessages(testBed);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "SocketManager: Socket 'missing_socket' not found on parent entity"
        ),
        expect.stringContaining(
          `SocketManager: Socket 'missing_socket' not found on parent entity '${expectedParentId}' (optional socket)`
        ),
        expect.stringContaining(
          `SocketManager: Socket 'left_shoulder' is already occupied on parent '${torsoId}'`
        ),
      ])
    );
  });

  it('should verify occupied socket tracking and validation', () => {
    const occupancy = new Set();

    socketManager.occupySocket(torsoId, 'left_shoulder', occupancy);
    let errors = socketManager.validateOccupiedSockets(occupancy);
    expect(errors).toHaveLength(0);

    occupancy.add('unknown_parent:missing_socket');
    errors = socketManager.validateOccupiedSockets(occupancy);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(
      "Occupied socket 'missing_socket' not found on entity 'unknown_parent'"
    );
  });

  it('should respect allowed part types including wildcard sockets', async () => {
    const leftArmId = anatomyParts['left arm'];
    const leftArmEntity = entityManager.getEntityInstance(leftArmId);
    const leftArmSockets = leftArmEntity.getComponentData('anatomy:sockets');
    const wristSocket = leftArmSockets.sockets.find((s) => s.id === 'wrist');

    expect(socketManager.isPartTypeAllowed(wristSocket, 'hand')).toBe(true);
    expect(socketManager.isPartTypeAllowed(wristSocket, 'leg')).toBe(false);

    const headId = anatomyParts['head'];
    const headEntity = entityManager.getEntityInstance(headId);
    const headSockets = headEntity.getComponentData('anatomy:sockets');

    headSockets.sockets.push({
      id: 'universal_attachment',
      allowedTypes: ['*'],
    });

    await entityManager.addComponent(headId, 'anatomy:sockets', headSockets);

    const universalSocket = socketManager.getSocket(
      headId,
      'universal_attachment'
    );
    expect(universalSocket).toBeDefined();
    expect(socketManager.isPartTypeAllowed(universalSocket, 'horn')).toBe(true);
    expect(socketManager.isPartTypeAllowed(universalSocket, 'tail')).toBe(true);
  });

  it('should generate part names from templates and skip sockets without templates', async () => {
    const leftArmId = anatomyParts['left arm'];
    const leftHandId = anatomyParts['left hand'];
    const leftArmEntity = entityManager.getEntityInstance(leftArmId);
    const leftArmSockets = leftArmEntity.getComponentData('anatomy:sockets');
    const wristSocket = leftArmSockets.sockets.find((s) => s.id === 'wrist');

    const generatedName = socketManager.generatePartName(
      wristSocket,
      leftHandId,
      leftArmId
    );
    expect(generatedName).toBe('left hand');

    const headId = anatomyParts['head'];
    const headEntity = entityManager.getEntityInstance(headId);
    const headSockets = headEntity.getComponentData('anatomy:sockets');

    headSockets.sockets.push({
      id: 'adornment',
      allowedTypes: ['ornament'],
    });

    await entityManager.addComponent(headId, 'anatomy:sockets', headSockets);

    const adornmentSocket = socketManager.getSocket(headId, 'adornment');
    const noseId = anatomyParts['nose'];
    const nameWithoutTemplate = socketManager.generatePartName(
      adornmentSocket,
      noseId,
      headId
    );
    expect(nameWithoutTemplate).toBeNull();

    const debugMessages = getDebugMessages(testBed);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `SocketManager: Generating name for child '${leftHandId}' with template`
        ),
        expect.stringContaining(
          "SocketManager: Generated name 'left hand' for part using template"
        ),
      ])
    );
  });
});
