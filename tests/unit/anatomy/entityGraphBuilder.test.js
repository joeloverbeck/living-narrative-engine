import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EntityGraphBuilder } from '../../../src/anatomy/entityGraphBuilder.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

// Helper to create minimal mocks
const createMocks = () => {
  return {
    entityManager: {
      createEntityInstance: jest
        .fn()
        .mockImplementation((id) => Promise.resolve({ id })),
      addComponent: jest.fn().mockResolvedValue(true),
      removeEntityInstance: jest.fn().mockResolvedValue(undefined),
      getEntityInstance: jest.fn((id) => (id === 'missing' ? null : { id })),
      getComponentData: jest.fn((id, comp) =>
        id === 'missingPart'
          ? null
          : comp === 'anatomy:part'
            ? { subType: 'arm' }
            : null
      ),
    },
    dataRegistry: {
      get: jest.fn(),
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
};

describe('EntityGraphBuilder', () => {
  /** @type {ReturnType<typeof createMocks>} */
  let mocks;
  /** @type {EntityGraphBuilder} */
  let builder;

  beforeEach(() => {
    mocks = createMocks();
    builder = new EntityGraphBuilder({
      entityManager: mocks.entityManager,
      dataRegistry: mocks.dataRegistry,
      logger: mocks.logger,
    });
  });

  it('constructor validates dependencies', () => {
    expect(
      () =>
        new EntityGraphBuilder({
          dataRegistry: mocks.dataRegistry,
          logger: mocks.logger,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new EntityGraphBuilder({
          entityManager: mocks.entityManager,
          logger: mocks.logger,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new EntityGraphBuilder({
          entityManager: mocks.entityManager,
          dataRegistry: mocks.dataRegistry,
        })
    ).toThrow(InvalidArgumentError);
  });

  describe('createRootEntity', () => {
    it('uses recipe torso override when valid', async () => {
      mocks.dataRegistry.get.mockReturnValue({
        components: { 'anatomy:part': { subType: 'torso' } },
      });
      const id = await builder.createRootEntity(
        'torsoDefault',
        { slots: { torso: { preferId: 't2' } } },
        'owner'
      );
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        't2'
      );
      expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
        't2',
        'core:owned_by',
        { ownerId: 'owner' }
      );
      expect(mocks.logger.debug).toHaveBeenCalled();
      expect(id).toBe('t2');
    });

    it('falls back to default when override not found', async () => {
      mocks.dataRegistry.get.mockReturnValue(undefined);
      const id = await builder.createRootEntity('base', {
        slots: { torso: { preferId: 'missing' } },
      });
      expect(mocks.logger.warn).toHaveBeenCalled();
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'base'
      );
      expect(id).toBe('base');
    });
  });

  describe('createAndAttachPart', () => {
    it('creates and attaches part successfully', async () => {
      const id = await builder.createAndAttachPart(
        'torso',
        'shoulder',
        'armDef'
      );
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'armDef'
      );
      expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
        'armDef',
        'anatomy:joint',
        {
          parentId: 'torso',
          socketId: 'shoulder',
        }
      );
      expect(id).toBe('armDef');
    });

    it('propagates orientation from socket to child anatomy:part', async () => {
      mocks.entityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'armDef' && comp === 'anatomy:part') {
          return { subType: 'arm', someOtherField: 'value' };
        }
        return null;
      });

      const id = await builder.createAndAttachPart(
        'torso',
        'shoulder',
        'armDef',
        'owner123',
        'left'
      );

      expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
        'armDef',
        'anatomy:part',
        {
          subType: 'arm',
          someOtherField: 'value',
          orientation: 'left',
        }
      );
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        "EntityGraphBuilder: Propagated orientation 'left' to child entity 'armDef'"
      );
      expect(id).toBe('armDef');
    });

    it('creates part without orientation when not provided', async () => {
      mocks.entityManager.getComponentData.mockReturnValue(null);

      const id = await builder.createAndAttachPart(
        'torso',
        'shoulder',
        'armDef',
        'owner123'
      );

      // Should not call addComponent for anatomy:part when no orientation provided
      expect(mocks.entityManager.addComponent).not.toHaveBeenCalledWith(
        'armDef',
        'anatomy:part',
        expect.any(Object)
      );
      expect(id).toBe('armDef');
    });

    it('adds ownership component when ownerId provided', async () => {
      const id = await builder.createAndAttachPart(
        'torso',
        'shoulder',
        'armDef',
        'owner123'
      );

      expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
        'armDef',
        'core:owned_by',
        { ownerId: 'owner123' }
      );
      expect(id).toBe('armDef');
    });

    it('logs and returns null on failure', async () => {
      mocks.entityManager.createEntityInstance.mockImplementation(() => {
        throw new Error('fail');
      });
      const id = await builder.createAndAttachPart(
        'torso',
        'shoulder',
        'armDef'
      );
      expect(id).toBeNull();
      expect(mocks.logger.error).toHaveBeenCalled();
    });
  });

  it('setEntityName adds component and logs', async () => {
    await builder.setEntityName('ent1', 'Bob');
    expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
      'ent1',
      'core:name',
      { text: 'Bob' }
    );
    expect(mocks.logger.debug).toHaveBeenCalled();
  });

  it('getPartType returns subtype or unknown', () => {
    expect(builder.getPartType('any')).toBe('arm');
    expect(builder.getPartType('missingPart')).toBe('unknown');
  });

  it('cleanupEntities removes entities and logs errors', async () => {
    mocks.entityManager.removeEntityInstance.mockRejectedValueOnce(
      new Error('boom')
    );
    await builder.cleanupEntities(['e1', 'e2']);
    expect(mocks.entityManager.removeEntityInstance).toHaveBeenNthCalledWith(
      1,
      'e2'
    );
    expect(mocks.entityManager.removeEntityInstance).toHaveBeenNthCalledWith(
      2,
      'e1'
    );
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  describe('validateEntity', () => {
    it('returns false and logs when entity missing', () => {
      expect(builder.validateEntity('missing')).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        "EntityGraphBuilder: Entity 'missing' not found"
      );
    });

    it('returns false when anatomy:part missing', () => {
      expect(builder.validateEntity('missingPart')).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        "EntityGraphBuilder: Entity 'missingPart' missing anatomy:part component"
      );
    });

    it('returns true for valid entity', () => {
      expect(builder.validateEntity('valid')).toBe(true);
    });
  });
});
