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
    partSelectionService: {
      selectPart: jest.fn(),
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
      partSelectionService: mocks.partSelectionService,
    });
  });

  it('constructor validates dependencies', () => {
    expect(
      () =>
        new EntityGraphBuilder({
          dataRegistry: mocks.dataRegistry,
          logger: mocks.logger,
          partSelectionService: mocks.partSelectionService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new EntityGraphBuilder({
          entityManager: mocks.entityManager,
          logger: mocks.logger,
          partSelectionService: mocks.partSelectionService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new EntityGraphBuilder({
          entityManager: mocks.entityManager,
          dataRegistry: mocks.dataRegistry,
          partSelectionService: mocks.partSelectionService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new EntityGraphBuilder({
          entityManager: mocks.entityManager,
          dataRegistry: mocks.dataRegistry,
          logger: mocks.logger,
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
        't2',
        { componentOverrides: {} }
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
        'base',
        { componentOverrides: {} }
      );
      expect(id).toBe('base');
    });

    it('warns when preferId does not reference a torso part', async () => {
      mocks.dataRegistry.get.mockReturnValue({
        components: { 'anatomy:part': { subType: 'arm' } },
      });

      const id = await builder.createRootEntity('base', {
        slots: { torso: { preferId: 'badTorso' } },
      });

      expect(mocks.logger.warn).toHaveBeenCalledWith(
        "EntityGraphBuilder: Recipe torso override 'badTorso' is not a valid torso part, using blueprint default"
      );
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'base',
        { componentOverrides: {} }
      );
      expect(id).toBe('base');
    });

    it('uses PartSelectionService when recipe has torso properties but no preferId', async () => {
      // Mock PartSelectionService to return a specific torso
      mocks.partSelectionService.selectPart.mockResolvedValue(
        'anatomy:selected_torso'
      );
      mocks.entityManager.createEntityInstance.mockResolvedValue({
        id: 'selected-entity-123',
      });

      const recipe = {
        slots: {
          torso: {
            partType: 'torso',
            properties: {
              'descriptors:build': { build: 'thick' },
              'descriptors:body_hair': { density: 'hairy' },
            },
          },
        },
      };

      const id = await builder.createRootEntity(
        'anatomy:default_torso',
        recipe
      );

      // Should have called PartSelectionService with correct parameters
      expect(mocks.partSelectionService.selectPart).toHaveBeenCalledWith(
        {
          partType: 'torso',
          components: ['anatomy:part'],
        },
        ['torso'],
        recipe.slots.torso,
        expect.any(Function)
      );

      // Should have created entity with the selected torso
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:selected_torso',
        { componentOverrides: {} }
      );
      expect(id).toBe('selected-entity-123');

      // Should log the property-based selection
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'No preferId specified for torso, attempting property-based selection'
        )
      );
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Selected torso 'anatomy:selected_torso' based on recipe properties"
        )
      );
    });

    it('falls back to blueprint default when PartSelectionService fails', async () => {
      // Mock PartSelectionService to throw an error
      mocks.partSelectionService.selectPart.mockRejectedValue(
        new Error('No matching torso found')
      );
      mocks.entityManager.createEntityInstance.mockResolvedValue({
        id: 'default-entity-123',
      });

      const recipe = {
        slots: {
          torso: {
            partType: 'torso',
            properties: {
              'descriptors:build': { build: 'nonexistent' },
            },
          },
        },
      };

      const id = await builder.createRootEntity(
        'anatomy:default_torso',
        recipe
      );

      // Should have attempted PartSelectionService
      expect(mocks.partSelectionService.selectPart).toHaveBeenCalled();

      // Should fall back to blueprint default
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:default_torso',
        { componentOverrides: {} }
      );
      expect(id).toBe('default-entity-123');

      // Should log the fallback
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Property-based torso selection failed')
      );
    });

    it('warns when property-based torso search finds no match', async () => {
      mocks.partSelectionService.selectPart.mockResolvedValue(undefined);
      mocks.entityManager.createEntityInstance.mockResolvedValue({
        id: 'default-entity-123',
      });

      const recipe = {
        slots: {
          torso: {
            properties: {
              'descriptors:build': { build: 'tall' },
            },
          },
        },
      };

      const id = await builder.createRootEntity(
        'anatomy:default_torso',
        recipe
      );

      expect(mocks.partSelectionService.selectPart).toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        "EntityGraphBuilder: No torso found matching recipe properties, using blueprint default 'anatomy:default_torso'"
      );
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:default_torso',
        { componentOverrides: {} }
      );
      expect(id).toBe('default-entity-123');
    });

    it('retries entity verification before succeeding', async () => {
      jest.useFakeTimers();
      try {
        mocks.entityManager.createEntityInstance.mockResolvedValue({
          id: 'entity-123',
        });
        const getEntityMock = jest
          .fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({ id: 'entity-123' });
        mocks.entityManager.getEntityInstance = getEntityMock;

        const promise = builder.createRootEntity('base', {});

        await jest.advanceTimersByTimeAsync(10);
        await jest.advanceTimersByTimeAsync(20);

        const id = await promise;

        expect(id).toBe('entity-123');
        expect(getEntityMock).toHaveBeenCalledTimes(3);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('not immediately available'),
          expect.any(Object)
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('throws when entity is never verified after retries', async () => {
      jest.useFakeTimers();
      try {
        mocks.entityManager.createEntityInstance.mockResolvedValue({
          id: 'entity-999',
        });
        const getEntityMock = jest.fn().mockReturnValue(null);
        mocks.entityManager.getEntityInstance = getEntityMock;

        let caughtError;
        const promise = builder
          .createRootEntity('base', {})
          .catch((error) => {
            caughtError = error;
            return null;
          });

        await jest.advanceTimersByTimeAsync(10);
        await jest.advanceTimersByTimeAsync(20);
        await jest.advanceTimersByTimeAsync(40);
        await jest.advanceTimersByTimeAsync(80);
        await jest.advanceTimersByTimeAsync(160);

        await promise;

        expect(caughtError).toBeInstanceOf(Error);
        expect(caughtError.message).toBe(
          'Entity creation-verification race condition: entity-999'
        );
        expect(getEntityMock).toHaveBeenCalledTimes(6);
        expect(mocks.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Entity creation-verification failed after 5 retries'),
          expect.objectContaining({
            entityId: 'entity-999',
            definitionId: 'base',
          })
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('prefers preferId over properties when both are specified', async () => {
      // Mock valid preferId
      mocks.dataRegistry.get.mockReturnValue({
        components: { 'anatomy:part': { subType: 'torso' } },
      });
      mocks.entityManager.createEntityInstance.mockResolvedValue({
        id: 'preferred-entity-123',
      });

      const recipe = {
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:preferred_torso',
            properties: {
              'descriptors:build': { build: 'thick' }, // This should be ignored
            },
          },
        },
      };

      const id = await builder.createRootEntity(
        'anatomy:default_torso',
        recipe
      );

      // Should NOT have called PartSelectionService
      expect(mocks.partSelectionService.selectPart).not.toHaveBeenCalled();

      // Should use the preferId
      expect(mocks.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:preferred_torso',
        { componentOverrides: {} }
      );
      expect(id).toBe('preferred-entity-123');
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
        'armDef',
        { componentOverrides: {} }
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
          parentEntity: 'torso',
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

    it('retries child verification before continuing', async () => {
      jest.useFakeTimers();
      try {
        mocks.entityManager.createEntityInstance.mockResolvedValue({
          id: 'child-1',
        });
        const getEntityMock = jest
          .fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({ id: 'child-1' });
        mocks.entityManager.getEntityInstance = getEntityMock;

        const promise = builder.createAndAttachPart(
          'torso',
          'shoulder',
          'armDef'
        );

        await jest.advanceTimersByTimeAsync(10);

        const id = await promise;

        expect(id).toBe('child-1');
        expect(getEntityMock).toHaveBeenCalledTimes(2);
        expect(mocks.logger.error).toHaveBeenCalledWith(
          'EntityGraphBuilder: Created child entity child-1 not immediately available',
          { entityId: 'child-1', partDefinitionId: 'armDef', parentId: 'torso' }
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns null when child verification fails after retry', async () => {
      jest.useFakeTimers();
      try {
        mocks.entityManager.createEntityInstance.mockResolvedValue({
          id: 'child-2',
        });
        const getEntityMock = jest.fn().mockReturnValue(null);
        mocks.entityManager.getEntityInstance = getEntityMock;

        const promise = builder.createAndAttachPart(
          'torso',
          'shoulder',
          'armDef'
        );

        await jest.advanceTimersByTimeAsync(10);

        const id = await promise;

        expect(id).toBeNull();
        expect(getEntityMock).toHaveBeenCalledTimes(2);
        expect(mocks.logger.error).toHaveBeenCalledWith(
          'EntityGraphBuilder: Created child entity child-2 not immediately available',
          { entityId: 'child-2', partDefinitionId: 'armDef', parentId: 'torso' }
        );
        expect(mocks.logger.error).toHaveBeenCalledWith(
          "EntityGraphBuilder: Failed to create and attach part 'armDef'",
          expect.objectContaining({ error: expect.any(Error) })
        );
      } finally {
        jest.useRealTimers();
      }
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

  it('addSocketsToEntity attaches sockets component and logs details', async () => {
    const sockets = [
      { id: 'socket-1', position: 'left' },
      { id: 'socket-2', position: 'right' },
    ];

    await builder.addSocketsToEntity('entity-42', sockets);

    expect(mocks.entityManager.addComponent).toHaveBeenCalledWith(
      'entity-42',
      'anatomy:sockets',
      { sockets }
    );
    expect(mocks.logger.debug).toHaveBeenCalledWith(
      "EntityGraphBuilder: Added 2 sockets to entity 'entity-42'"
    );
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
