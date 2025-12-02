import { jest } from '@jest/globals';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { EntityGraphBuilder } from '../../../src/anatomy/entityGraphBuilder.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createMockSafeEventDispatcher,
  createMockEventDispatchService,
} from '../../common/mockFactories/index.js';

describe('EntityGraphBuilder integration', () => {
  /**
   * Registers an entity definition in the provided registry using the production
   * {@link EntityDefinition} class so that the {@link EntityManager} can create
   * real entity instances.
   *
   * @param {InMemoryDataRegistry} registry
   * @param {string} id
   * @param {Record<string, object>} components
   */
  function registerDefinition(registry, id, components = {}) {
    const definition = new EntityDefinition(id, {
      description: `${id} definition`,
      components,
    });

    registry.store('entityDefinitions', id, definition);
  }

  /**
   * Creates a fully wired {@link EntityGraphBuilder} instance with the
   * production collaborators that would normally be present in runtime. The
   * collaborators are the real implementations – the entity manager works
   * against an {@link InMemoryDataRegistry} and the {@link PartSelectionService}
   * uses its actual filtering logic – while the logger and dispatch service are
   * controllable Jest spies so the tests can assert behaviour.
   */
  function createBuilderContext() {
    const logger = createMockLogger();
    const registry = new InMemoryDataRegistry({ logger });
    const validator = createMockSchemaValidator();
    const dispatcher = createMockSafeEventDispatcher();
    const entityManager = new EntityManager({
      registry,
      validator,
      logger,
      dispatcher,
    });
    const eventDispatchService = createMockEventDispatchService();
    const partSelectionService = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService,
    });
    const builder = new EntityGraphBuilder({
      entityManager,
      dataRegistry: registry,
      logger,
      partSelectionService,
    });

    return {
      logger,
      registry,
      validator,
      dispatcher,
      entityManager,
      eventDispatchService,
      partSelectionService,
      builder,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('constructor validation', () => {
    it('requires all collaborators to be provided', () => {
      const logger = createMockLogger();
      const registry = new InMemoryDataRegistry({ logger });
      const eventDispatchService = createMockEventDispatchService();
      const partSelectionService = new PartSelectionService({
        dataRegistry: registry,
        logger,
        eventDispatchService,
      });

      expect(
        () =>
          new EntityGraphBuilder({
            dataRegistry: registry,
            logger,
            partSelectionService,
          })
      ).toThrow('entityManager is required');

      expect(
        () =>
          new EntityGraphBuilder({
            entityManager: {},
            logger,
            partSelectionService,
          })
      ).toThrow('dataRegistry is required');

      expect(
        () =>
          new EntityGraphBuilder({
            entityManager: {},
            dataRegistry: registry,
            partSelectionService,
          })
      ).toThrow('logger is required');

      expect(
        () =>
          new EntityGraphBuilder({
            entityManager: {},
            dataRegistry: registry,
            logger,
          })
      ).toThrow('partSelectionService is required');
    });
  });

  describe('createRootEntity', () => {
    it('prefers recipe torso override when definition is valid and adds ownership & overrides', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso', structure: 'baseline' },
      });
      registerDefinition(ctx.registry, 'recipe:torso', {
        'anatomy:part': { subType: 'torso', structure: 'custom' },
      });

      const recipe = {
        slots: {
          torso: {
            preferId: 'recipe:torso',
          },
        },
      };

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe,
        'owner-01',
        {
          'core:descriptor': { label: 'bespoke' },
        }
      );

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('recipe:torso');
      expect(
        ctx.entityManager.getComponentData(rootId, 'core:owned_by')
      ).toEqual({ ownerId: 'owner-01' });
      expect(
        ctx.entityManager.getComponentData(rootId, 'core:descriptor')
      ).toEqual({ label: 'bespoke' });
      expect(ctx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using recipe torso override 'recipe:torso'")
      );

      ctx.entityManager.clearAll();
    });

    it('falls back to default torso when override is not an anatomy torso', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'invalid:torso', {
        'anatomy:part': { subType: 'arm' },
      });

      const recipe = {
        slots: {
          torso: {
            preferId: 'invalid:torso',
          },
        },
      };

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe
      );

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('default:torso');
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Recipe torso override 'invalid:torso' is not a valid torso part"
        )
      );

      ctx.entityManager.clearAll();
    });

    it('warns when override definition is missing', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const recipe = {
        slots: {
          torso: {
            preferId: 'missing:torso',
          },
        },
      };

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe
      );

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('default:torso');
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Recipe torso override 'missing:torso' not found in registry"
        )
      );

      ctx.entityManager.clearAll();
    });

    it('uses property-based selection when recipe defines torso properties', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso', style: 'classic' },
      });
      registerDefinition(ctx.registry, 'variant:torso', {
        'anatomy:part': { subType: 'torso', style: 'athletic' },
      });

      const recipe = {
        slots: {
          torso: {
            properties: {
              'anatomy:part': { style: 'athletic' },
            },
          },
        },
      };

      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe
      );

      randomSpy.mockRestore();

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('variant:torso');
      expect(ctx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selected torso')
      );

      ctx.entityManager.clearAll();
    });

    it('logs warning when property-based selection finds no matching torso', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const recipe = {
        slots: {
          torso: {
            properties: {
              'anatomy:part': { style: 'nonexistent' },
            },
          },
        },
      };

      jest
        .spyOn(ctx.partSelectionService, 'selectPart')
        .mockResolvedValue(null);

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe
      );

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('default:torso');
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No torso found matching recipe properties')
      );

      ctx.entityManager.clearAll();
    });

    it('logs and falls back when property-based selection throws', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const recipe = {
        slots: {
          torso: {
            properties: {
              'anatomy:part': { rarity: 'legendary' },
            },
          },
        },
      };

      jest
        .spyOn(ctx.partSelectionService, 'selectPart')
        .mockRejectedValue(new Error('selection failed'));

      const rootId = await ctx.builder.createRootEntity(
        'default:torso',
        recipe
      );

      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('default:torso');
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Property-based torso selection failed')
      );

      ctx.entityManager.clearAll();
    });

    it('retries when entity verification initially fails', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const originalGet = ctx.entityManager.getEntityInstance.bind(
        ctx.entityManager
      );
      const getSpy = jest
        .spyOn(ctx.entityManager, 'getEntityInstance')
        .mockImplementation((id) => {
          if (getSpy.mock.calls.length === 1) {
            return undefined;
          }
          return originalGet(id);
        });

      const rootId = await ctx.builder.createRootEntity('default:torso', {});
      const entity = ctx.entityManager.getEntityInstance(rootId);
      expect(entity.definitionId).toBe('default:torso');
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not immediately available, retry'),
        expect.objectContaining({
          entityId: rootId,
          definitionId: 'default:torso',
        })
      );

      getSpy.mockRestore();
      ctx.entityManager.clearAll();
    });

    it('throws when entity verification never succeeds', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'default:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      jest
        .spyOn(ctx.entityManager, 'getEntityInstance')
        .mockReturnValue(undefined);

      await expect(
        ctx.builder.createRootEntity('default:torso', {})
      ).rejects.toThrow('Entity creation-verification race condition');
      expect(ctx.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Entity creation-verification failed after'),
        expect.objectContaining({
          entityId: expect.any(String),
        })
      );

      ctx.entityManager.clearAll();
    });
  });

  describe('createAndAttachPart', () => {
    it('creates part, adds joint, propagates orientation and ownership', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'child:arm', {
        'anatomy:part': { subType: 'arm' },
      });

      const parentId = await ctx.builder.createRootEntity('root:torso', {});

      const childId = await ctx.builder.createAndAttachPart(
        parentId,
        'left_socket',
        'child:arm',
        'owner-02',
        'forward',
        {
          'core:descriptor': { tone: 'bronze' },
        }
      );

      expect(childId).toEqual(expect.any(String));
      expect(
        ctx.entityManager.getComponentData(childId, 'anatomy:joint')
      ).toEqual({ parentId, socketId: 'left_socket' });
      expect(
        ctx.entityManager.getComponentData(childId, 'core:owned_by')
      ).toEqual({ ownerId: 'owner-02' });
      expect(
        ctx.entityManager.getComponentData(childId, 'anatomy:part')
      ).toMatchObject({ subType: 'arm', orientation: 'forward' });
      expect(
        ctx.entityManager.getComponentData(childId, 'core:descriptor')
      ).toEqual({ tone: 'bronze' });

      ctx.entityManager.clearAll();
    });

    it('performs a retry when the child entity is not immediately available', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'child:arm', {
        'anatomy:part': { subType: 'arm' },
      });

      const parentId = await ctx.builder.createRootEntity('root:torso', {});

      const originalGet = ctx.entityManager.getEntityInstance.bind(
        ctx.entityManager
      );
      const getSpy = jest
        .spyOn(ctx.entityManager, 'getEntityInstance')
        .mockImplementation((id) => {
          if (getSpy.mock.calls.length === 1) {
            return undefined;
          }
          return originalGet(id);
        });

      const childId = await ctx.builder.createAndAttachPart(
        parentId,
        'arm_socket',
        'child:arm'
      );

      expect(childId).toEqual(expect.any(String));
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Created child entity'),
        expect.objectContaining({
          entityId: expect.any(String),
          parentId,
          partDefinitionId: 'child:arm',
        })
      );

      getSpy.mockRestore();
      ctx.entityManager.clearAll();
    });

    it('returns null and logs when creation fails', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const parentId = await ctx.builder.createRootEntity('root:torso', {});

      jest
        .spyOn(ctx.entityManager, 'createEntityInstance')
        .mockRejectedValue(new Error('creation failed'));

      const result = await ctx.builder.createAndAttachPart(
        parentId,
        'socket',
        'missing:arm'
      );

      expect(result).toBeNull();
      expect(ctx.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create and attach part'),
        expect.objectContaining({ error: expect.any(Error) })
      );

      ctx.entityManager.clearAll();
    });
  });

  describe('utility helpers', () => {
    it('sets entity name component', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const rootId = await ctx.builder.createRootEntity('root:torso', {});
      await ctx.builder.setEntityName(rootId, 'Atlas');

      expect(ctx.entityManager.getComponentData(rootId, 'core:name')).toEqual({
        text: 'Atlas',
      });
      expect(ctx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Set name 'Atlas' on entity")
      );

      ctx.entityManager.clearAll();
    });

    it('adds sockets to entity', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });

      const rootId = await ctx.builder.createRootEntity('root:torso', {});
      const sockets = [
        { id: 'left', allowed: ['arm'] },
        { id: 'right', allowed: ['arm'] },
      ];

      await ctx.builder.addSocketsToEntity(rootId, sockets);

      expect(
        ctx.entityManager.getComponentData(rootId, 'anatomy:sockets')
      ).toEqual({ sockets });
      expect(ctx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Added 2 sockets to entity')
      );

      ctx.entityManager.clearAll();
    });

    it('returns part type when anatomy component exists and unknown otherwise', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'misc:block', {
        'core:identity': { label: 'block' },
      });

      const torsoId = await ctx.builder.createRootEntity('root:torso', {});
      const blockId = await ctx.builder.createRootEntity('misc:block', {});

      expect(ctx.builder.getPartType(torsoId)).toBe('torso');
      expect(ctx.builder.getPartType(blockId)).toBe('unknown');

      ctx.entityManager.clearAll();
    });

    it('cleans up entities in reverse order and logs failures', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'child:arm', {
        'anatomy:part': { subType: 'arm' },
      });

      const rootId = await ctx.builder.createRootEntity('root:torso', {});
      const childId = await ctx.builder.createAndAttachPart(
        rootId,
        'socket',
        'child:arm'
      );

      const ids = [rootId, childId];
      const removeSpy = jest
        .spyOn(ctx.entityManager, 'removeEntityInstance')
        .mockImplementation(async (id) => {
          if (id === rootId) {
            throw new Error('removal failed');
          }
          return undefined;
        });

      await ctx.builder.cleanupEntities(ids);
      expect(removeSpy).toHaveBeenNthCalledWith(1, childId);
      expect(removeSpy).toHaveBeenNthCalledWith(2, rootId);
      expect(ctx.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to cleanup entity '" + rootId),
        expect.objectContaining({ error: expect.any(Error) })
      );

      removeSpy.mockRestore();
      ctx.entityManager.clearAll();
    });

    it('validates entities and reports missing anatomy component or entity', async () => {
      const ctx = createBuilderContext();
      registerDefinition(ctx.registry, 'root:torso', {
        'anatomy:part': { subType: 'torso' },
      });
      registerDefinition(ctx.registry, 'misc:block', {
        'core:identity': { label: 'block' },
      });

      const torsoId = await ctx.builder.createRootEntity('root:torso', {});
      const blockId = await ctx.builder.createRootEntity('misc:block', {});

      expect(ctx.builder.validateEntity('missing-id')).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalledWith(
        "EntityGraphBuilder: Entity 'missing-id' not found"
      );

      expect(ctx.builder.validateEntity(blockId)).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalledWith(
        `EntityGraphBuilder: Entity '${blockId}' missing anatomy:part component`
      );

      expect(ctx.builder.validateEntity(torsoId)).toBe(true);

      ctx.entityManager.clearAll();
    });
  });
});
