import { describe, it, expect, beforeEach } from '@jest/globals';

import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class InMemoryDataRegistry {
  constructor() {
    this.#store = new Map();
  }

  #store;

  register(type, id, value) {
    if (!this.#store.has(type)) {
      this.#store.set(type, new Map());
    }
    this.#store.get(type).set(id, value);
  }

  get(type, id) {
    return this.#store.get(type)?.get(id) ?? null;
  }
}

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(...args) {
    this.debugMessages.push(args.map(String).join(' '));
  }

  info(...args) {
    this.infoMessages.push(args.map(String).join(' '));
  }

  warn(...args) {
    this.warnMessages.push(args.map(String).join(' '));
  }

  error(...args) {
    this.errorMessages.push(args.map(String).join(' '));
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class RecordingEventDispatchService {
  constructor(eventDispatcher) {
    this.#dispatcher = eventDispatcher;
    this.dispatched = [];
  }

  #dispatcher;

  async safeDispatchEvent(eventId, payload) {
    this.dispatched.push({ eventId, payload });
    return this.#dispatcher.dispatch(eventId, payload);
  }
}

class InMemoryEntityManager {
  constructor() {
    this.definitions = new Map();
    this.instances = new Map();
    this.createdEntities = [];
    this.cleanedEntities = [];
    this.#counter = 0;
  }

  definitions;
  instances;
  createdEntities;
  cleanedEntities;
  #counter;

  registerDefinition(id, components = {}) {
    this.definitions.set(id, structuredClone(components));
  }

  async createEntityInstance(definitionId) {
    if (!this.definitions.has(definitionId)) {
      throw new Error(`Definition ${definitionId} not registered`);
    }

    const entityId = `${definitionId}#${++this.#counter}`;
    const components = new Map();
    const template = this.definitions.get(definitionId);
    for (const [componentId, value] of Object.entries(template)) {
      components.set(componentId, structuredClone(value));
    }

    this.instances.set(entityId, {
      id: entityId,
      definitionId,
      components,
    });
    this.createdEntities.push(entityId);
    return { id: entityId, definitionId };
  }

  getEntityInstance(entityId) {
    const instance = this.instances.get(entityId);
    return instance ? { id: instance.id, definitionId: instance.definitionId } : null;
  }

  getComponentData(entityId, componentId) {
    const instance = this.instances.get(entityId);
    if (!instance) return null;
    const value = instance.components.get(componentId);
    return value === undefined ? null : structuredClone(value);
  }

  async addComponent(entityId, componentId, value) {
    const instance = this.instances.get(entityId);
    if (!instance) {
      throw new Error(`Entity ${entityId} not found`);
    }
    instance.components.set(componentId, structuredClone(value));
  }

  async removeComponent(entityId, componentId) {
    const instance = this.instances.get(entityId);
    if (!instance) return;
    instance.components.delete(componentId);
  }

  cleanupEntities(entityIds) {
    for (const entityId of entityIds) {
      if (this.instances.delete(entityId)) {
        this.cleanedEntities.push(entityId);
      }
    }
  }
}

class SimpleRecipeProcessor {
  constructor(recipes) {
    this.#recipes = recipes;
  }

  #recipes;

  loadRecipe(recipeId) {
    const recipe = this.#recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe ${recipeId} not found`);
    }
    return structuredClone(recipe);
  }

  processRecipe(recipe) {
    const processed = structuredClone(recipe);
    processed.recipeId = recipe.id || recipe.recipeId || 'unknown';
    processed.slots = processed.slots || {};
    return processed;
  }

  mergeSlotRequirements(slotRequirements = {}, recipeSlot = {}) {
    return {
      ...structuredClone(slotRequirements),
      ...structuredClone(recipeSlot),
    };
  }
}

class DeterministicPartSelectionService {
  constructor(slotSelections = {}) {
    this.#slotSelections = slotSelections;
    this.selectionCalls = [];
  }

  #slotSelections;
  selectionCalls;

  async selectPart(mergedRequirements, allowedTypes, recipeSlot) {
    const slotKey = recipeSlot?.slotKey || mergedRequirements.slotKey;
    this.selectionCalls.push({ mergedRequirements, allowedTypes, recipeSlot });

    if (recipeSlot?.preferId) {
      return recipeSlot.preferId;
    }

    if (slotKey && this.#slotSelections[slotKey] !== undefined) {
      return this.#slotSelections[slotKey];
    }

    if (recipeSlot?.optionalSelection === false) {
      return null;
    }

    return null;
  }
}

class SimpleSocketManager {
  constructor({ entityManager, logger }) {
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.occupied = new Set();
    this.validationOverrides = new Map();
  }

  #entityManager;
  #logger;
  occupied;
  validationOverrides;

  setValidationOverride(slotKey, result) {
    this.validationOverrides.set(slotKey, result);
  }

  #getSocket(parentId, socketId) {
    const sockets = this.#entityManager.getComponentData(
      parentId,
      'anatomy:sockets'
    );
    return sockets?.sockets?.find((socket) => socket.id === socketId) ?? null;
  }

  validateSocketAvailability(parentId, socketId, socketOccupancy, isRequired) {
    if (this.validationOverrides.has(socketId)) {
      return this.validationOverrides.get(socketId);
    }

    const socket = this.#getSocket(parentId, socketId);
    if (!socket) {
      if (isRequired) {
        return {
          valid: false,
          error: `Socket '${socketId}' not defined on '${parentId}'`,
        };
      }
      return { valid: false };
    }

    const occupancyKey = `${parentId}:${socketId}`;
    if (this.occupied.has(occupancyKey)) {
      if (isRequired) {
        return {
          valid: false,
          error: `Socket '${socketId}' already used`,
        };
      }
      return { valid: false };
    }

    return { valid: true, socket };
  }

  occupySocket(parentId, socketId) {
    const occupancyKey = `${parentId}:${socketId}`;
    this.occupied.add(occupancyKey);
    this.#logger.debug(
      `occupy ${socketId} on ${parentId}`
    );
  }

  generatePartName(socket, childEntityId, parentId) {
    if (!socket.nameTpl) {
      return null;
    }

    const anatomyPart = this.#entityManager.getComponentData(
      childEntityId,
      'anatomy:part'
    );
    const orientation =
      anatomyPart?.orientation || socket.orientation || 'unknown';
    const parentName =
      this.#entityManager.getComponentData(parentId, 'core:name')?.text ||
      parentId;

    this.#logger.debug(
      `generate name ${socket.nameTpl} for ${childEntityId} using orientation ${orientation}`
    );

    return socket.nameTpl
      .replace('{{orientation}}', socket.orientation || orientation)
      .replace('{{effective_orientation}}', orientation)
      .replace('{{parent}}', parentName);
  }
}

class SimpleEntityGraphBuilder {
  constructor({ entityManager, logger }) {
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.cleanupCalls = [];
    this.createdParts = [];
    this.shouldFailSlot = null;
    this.nullForSocket = null;
  }

  #entityManager;
  #logger;
  cleanupCalls;
  createdParts;
  shouldFailSlot;
  nullForSocket;

  async createRootEntity(definitionId, recipe, ownerId) {
    const root = await this.#entityManager.createEntityInstance(definitionId);
    if (ownerId) {
      await this.#entityManager.addComponent(root.id, 'core:owned_by', {
        ownerId,
      });
    }
    await this.#entityManager.addComponent(root.id, 'core:name', {
      text: `${definitionId}-root`,
    });
    this.#logger.info(`root created ${root.id}`);
    return root.id;
  }

  async createAndAttachPart(
    parentId,
    socketId,
    partDefinitionId,
    ownerId,
    orientation
  ) {
    if (this.shouldFailSlot === socketId) {
      throw new Error(`Forced failure for socket ${socketId}`);
    }

    if (this.nullForSocket === socketId) {
      return null;
    }

    const child = await this.#entityManager.createEntityInstance(
      partDefinitionId
    );
    this.createdParts.push(child.id);
    await this.#entityManager.addComponent(child.id, 'anatomy:joint', {
      parentId,
      socketId,
      orientation,
    });
    if (ownerId) {
      await this.#entityManager.addComponent(child.id, 'core:owned_by', {
        ownerId,
      });
    }
    return child.id;
  }

  getPartType(entityId) {
    return (
      this.#entityManager.getComponentData(entityId, 'anatomy:part')?.subType ||
      'unknown'
    );
  }

  async setEntityName(entityId, name) {
    await this.#entityManager.addComponent(entityId, 'core:name', { text: name });
  }

  async cleanupEntities(entityIds) {
    this.cleanupCalls.push([...entityIds]);
    this.#entityManager.cleanupEntities(entityIds);
  }
}

class ToggleableConstraintEvaluator {
  constructor() {
    this.nextResult = { valid: true };
    this.calls = [];
  }

  evaluateConstraints(entities, recipe) {
    this.calls.push({ entities, recipe });
    return this.nextResult;
  }
}

class ToggleableGraphValidator {
  constructor() {
    this.nextResult = { valid: true };
    this.calls = [];
  }

  async validateGraph(entities, recipe, socketOccupancy) {
    this.calls.push({ entities, recipe, socketOccupancy });
    return this.nextResult;
  }
}

const createBlueprint = () => ({
  id: 'blueprint:humanoid',
  root: 'def:torso',
  slots: {
    left_arm: {
      parent: null,
      socket: 'left-shoulder',
      requirements: { slotKey: 'left_arm', trait: 'dexterity' },
    },
    left_hand: {
      parent: 'left_arm',
      socket: 'left-wrist',
      requirements: { slotKey: 'left_hand', grip: 'fine' },
    },
    accessory: {
      parent: 'left_arm',
      socket: 'grip',
      requirements: { slotKey: 'accessory', strength: 4 },
      optional: true,
    },
    right_leg: {
      parent: null,
      socket: 'hip-right',
      requirements: { slotKey: 'right_leg' },
    },
    wing: {
      parent: null,
      socket: 'back',
      requirements: { slotKey: 'wing', rarity: 'mythic' },
      optional: true,
    },
  },
});

const createRecipe = () => ({
  id: 'recipe:humanoid',
  slots: {
    left_arm: { slotKey: 'left_arm', preferId: 'def:left-arm' },
    left_hand: { slotKey: 'left_hand', preferId: 'def:left-hand' },
    right_leg: { slotKey: 'right_leg', preferId: 'def:right-leg' },
    wing: { slotKey: 'wing', optionalSelection: true },
    torso: { slotKey: 'torso', preferId: 'def:torso' },
  },
});

const setupEntityDefinitions = (entityManager) => {
  entityManager.registerDefinition('def:torso', {
    'anatomy:sockets': {
      sockets: [
        {
          id: 'left-shoulder',
          allowedTypes: ['arm'],
          orientation: 'left',
          nameTpl: '{{orientation}} arm',
        },
        {
          id: 'hip-right',
          allowedTypes: ['leg'],
          nameTpl: '{{effective_orientation}} leg',
        },
        {
          id: 'back',
          allowedTypes: ['wing'],
          nameTpl: '{{parent}} wing',
        },
        {
          id: 'decor-loop',
          allowedTypes: ['ornament'],
        },
      ],
    },
    'anatomy:part': { subType: 'torso' },
    'core:name': { text: 'Blueprint Torso' },
  });

  entityManager.registerDefinition('def:left-arm', {
    'anatomy:part': { subType: 'arm', orientation: 'left' },
    'anatomy:sockets': {
      sockets: [
        {
          id: 'left-wrist',
          allowedTypes: ['hand'],
          orientation: 'left',
          nameTpl: '{{effective_orientation}} hand',
        },
        {
          id: 'grip',
          allowedTypes: [],
        },
        {
          id: 'utility-hook',
          allowedTypes: ['tool'],
        },
      ],
    },
    'core:name': { text: 'Left Arm' },
  });

  entityManager.registerDefinition('def:left-hand', {
    'anatomy:part': { subType: 'hand', orientation: 'left' },
    'core:name': { text: 'Left Hand' },
  });

  entityManager.registerDefinition('def:right-leg', {
    'anatomy:part': { subType: 'leg', orientation: 'right' },
    'core:name': { text: 'Right Leg' },
  });

  entityManager.registerDefinition('def:ornament', {
    'anatomy:part': { subType: 'ornament' },
    'core:name': { text: 'Ornament Default' },
  });
};

describe('BodyBlueprintFactory integration', () => {
  let registry;
  let logger;
  let eventDispatcher;
  let eventDispatchService;
  let entityManager;
  let recipeProcessor;
  let partSelectionService;
  let socketManager;
  let entityGraphBuilder;
  let constraintEvaluator;
  let validator;

  beforeEach(() => {
    registry = new InMemoryDataRegistry();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingDispatcher();
    eventDispatchService = new RecordingEventDispatchService(eventDispatcher);
    entityManager = new InMemoryEntityManager();
    setupEntityDefinitions(entityManager);
    recipeProcessor = new SimpleRecipeProcessor(new Map());
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: 'def:left-arm',
      left_hand: 'def:left-hand',
      right_leg: 'def:right-leg',
    });
    socketManager = new SimpleSocketManager({
      entityManager,
      logger,
    });
    entityGraphBuilder = new SimpleEntityGraphBuilder({
      entityManager,
      logger,
    });
    constraintEvaluator = new ToggleableConstraintEvaluator();
    validator = new ToggleableGraphValidator();
  });

  const createFactory = (overrides = {}) => {
    const mockSocketGenerator = {
      generateSockets: () => [],
    };
    const mockSlotGenerator = {
      generateBlueprintSlots: () => ({}),
    };
    const mockRecipePatternResolver = {
      resolveRecipePatterns: (recipe) => recipe,
    };

    return new BodyBlueprintFactory({
      entityManager,
      dataRegistry: registry,
      logger,
      eventDispatcher,
      eventDispatchService,
      recipeProcessor,
      partSelectionService,
      socketManager,
      entityGraphBuilder,
      constraintEvaluator,
      validator,
      socketGenerator: mockSocketGenerator,
      slotGenerator: mockSlotGenerator,
      recipePatternResolver: mockRecipePatternResolver,
      ...overrides,
    });
  };

  const registerBlueprintAndRecipe = () => {
    const blueprint = createBlueprint();
    const recipe = createRecipe();
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    recipeProcessor = new SimpleRecipeProcessor(
      new Map([[recipe.id, recipe]])
    );
  };

  it('constructs anatomy graph using real collaborators', async () => {
    registerBlueprintAndRecipe();
    const blueprint = registry.get('anatomyBlueprints', 'blueprint:humanoid');
    const recipe = createRecipe();
    const updatedProcessor = new SimpleRecipeProcessor(
      new Map([[recipe.id, recipe]])
    );
    recipeProcessor = updatedProcessor;
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(
      blueprint.id,
      recipe.id,
      { ownerId: 'actor-1', seed: 42 }
    );

    expect(result.entities).toHaveLength(4);
    expect(entityGraphBuilder.createdParts).toHaveLength(3);
    const handName = entityManager.getComponentData(
      entityGraphBuilder.createdParts.find((id) => id.includes('left-hand')),
      'core:name'
    );
    expect(handName?.text).toBe('left hand');
    const legName = entityManager.getComponentData(
      entityGraphBuilder.createdParts.find((id) => id.includes('right-leg')),
      'core:name'
    );
    expect(legName?.text).toBe('right leg');

    expect(eventDispatcher.events).toHaveLength(0);
    expect(logger.errorMessages).toHaveLength(0);
    expect(partSelectionService.selectionCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('skips optional slots when no part is selected', async () => {
    registerBlueprintAndRecipe();
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: 'def:left-arm',
      left_hand: 'def:left-hand',
      right_leg: 'def:right-leg',
      wing: null,
    });
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(
      'blueprint:humanoid',
      recipe.id
    );

    expect(result.entities.length).toBe(4);
    expect(entityGraphBuilder.createdParts.some((id) => id.includes('wing'))).toBe(
      false
    );
  });

  it('skips optional slots when socket is unavailable', async () => {
    const blueprint = createBlueprint();
    blueprint.slots.wing.socket = 'missing-socket';
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(blueprint.id, recipe.id);

    expect(result.entities.length).toBe(4);
    expect(entityGraphBuilder.createdParts.some((id) => id.includes('wing'))).toBe(
      false
    );
  });

  it('throws ValidationError when recipe slots are not defined in blueprint', async () => {
    const blueprint = createBlueprint();
    registry.register('anatomyBlueprints', blueprint.id, {
      ...blueprint,
      slots: {
        left_arm: blueprint.slots.left_arm,
      },
    });

    const recipe = {
      id: 'recipe:invalid',
      slots: {
        invalid_slot: { slotKey: 'invalid_slot' },
      },
    };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph(blueprint.id, recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    const dispatched = eventDispatcher.events.find(
      (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(dispatched).toBeDefined();
    expect(dispatched.payload.message).toContain("invalid slot keys");
  });

  it('cleans up entities when constraint evaluation fails', async () => {
    registerBlueprintAndRecipe();
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    constraintEvaluator.nextResult = {
      valid: false,
      errors: ['part limit exceeded'],
    };
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('blueprint:humanoid', recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    expect(entityGraphBuilder.cleanupCalls).toHaveLength(1);
  });

  it('cleans up entities when graph validation fails', async () => {
    registerBlueprintAndRecipe();
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    validator.nextResult = {
      valid: false,
      errors: ['disconnected limb'],
    };
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('blueprint:humanoid', recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    expect(entityGraphBuilder.cleanupCalls).toHaveLength(1);
  });

  it('throws when required part selection fails', async () => {
    registerBlueprintAndRecipe();
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: null,
    });
    const recipe = createRecipe();
    delete recipe.slots.left_arm.preferId;
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('blueprint:humanoid', recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when parent slot entity cannot be resolved', async () => {
    const blueprint = createBlueprint();
    blueprint.slots.left_hand.parent = 'missing_arm';
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph(blueprint.id, recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    expect(eventDispatchService.dispatched.length).toBeGreaterThan(0);
  });

  it('throws when socket validation fails for required slot', async () => {
    registerBlueprintAndRecipe();
    socketManager.setValidationOverride('left-shoulder', {
      valid: false,
      error: 'Socket missing',
    });
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('blueprint:humanoid', recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    expect(eventDispatchService.dispatched[0].eventId).toBe(
      SYSTEM_ERROR_OCCURRED_ID
    );
  });

  it('detects circular slot dependencies', async () => {
    const blueprint = {
      id: 'blueprint:circular',
      root: 'def:torso',
      slots: {
        first: { parent: 'second', socket: 'left-shoulder' },
        second: { parent: 'first', socket: 'hip-right' },
      },
    };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = {
      id: 'recipe:empty',
      slots: {},
    };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph(blueprint.id, recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when blueprint is missing from registry', async () => {
    const recipe = {
      id: 'recipe:empty',
      slots: {},
    };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('missing-blueprint', recipe.id)
    ).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('requires mandatory dependencies at construction time', () => {
    const baseDeps = {
      entityManager,
      dataRegistry: registry,
      logger,
      eventDispatcher,
      eventDispatchService,
      recipeProcessor,
      partSelectionService,
      socketManager,
      entityGraphBuilder,
      constraintEvaluator,
      validator,
    };

    const missingKeys = [
      'dataRegistry',
      'logger',
      'eventDispatcher',
      'eventDispatchService',
      'recipeProcessor',
      'partSelectionService',
      'socketManager',
      'entityGraphBuilder',
      'constraintEvaluator',
      'validator',
    ];

    for (const key of missingKeys) {
      const overrides = { ...baseDeps, [key]: null };
      expect(() => new BodyBlueprintFactory(overrides)).toThrow(
        InvalidArgumentError
      );
    }
  });

  it('dispatches error when slot processing fails internally', async () => {
    registerBlueprintAndRecipe();
    entityGraphBuilder.shouldFailSlot = 'left-shoulder';
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph('blueprint:humanoid', recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    const dispatched = eventDispatchService.dispatched.find(
      (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(dispatched).toBeDefined();
    expect(dispatched.payload.message).toContain('Failed to process blueprint slot');
  });

  it('skips slots that only signal equipment by requirements', async () => {
    const blueprint = createBlueprint();
    blueprint.slots.tool = {
      parent: 'left_arm',
      socket: 'utility-hook',
      requirements: { slotKey: 'tool', strength: 3 },
      optional: true,
    };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(blueprint.id, recipe.id);

    expect(result.entities.length).toBe(4);
    expect(
      entityGraphBuilder.createdParts.some((id) => id.includes('utility'))
    ).toBe(false);
  });

  it('creates anatomy when blueprint defines no slots', async () => {
    const blueprint = {
      id: 'blueprint:minimal',
      root: 'def:torso',
    };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = {
      id: 'recipe:minimal',
      slots: {},
    };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(blueprint.id, recipe.id);

    expect(result.entities).toEqual([result.rootId]);
  });

  it('ignores slots when part builder returns null', async () => {
    registerBlueprintAndRecipe();
    entityGraphBuilder.nullForSocket = 'back';
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: 'def:left-arm',
      left_hand: 'def:left-hand',
      right_leg: 'def:right-leg',
      wing: 'def:right-leg',
    });
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(
      'blueprint:humanoid',
      recipe.id
    );

    expect(result.entities).toHaveLength(4);
    expect(entityGraphBuilder.createdParts.some((id) => id.includes('right-leg'))).toBe(
      true
    );
  });

  it('dispatches validation error when blueprint has no slots but recipe does', async () => {
    const blueprint = { id: 'blueprint:empty', root: 'def:torso' };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    const recipe = {
      id: 'recipe:invalid-empty',
      slots: { left_arm: { slotKey: 'left_arm' } },
    };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    await expect(
      factory.createAnatomyGraph(blueprint.id, recipe.id)
    ).rejects.toBeInstanceOf(ValidationError);

    const dispatched = eventDispatcher.events.at(-1);
    expect(dispatched.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
  });

  it('creates parts without renaming when socket template missing', async () => {
    const blueprint = createBlueprint();
    blueprint.slots.ornament = {
      parent: null,
      socket: 'decor-loop',
      optional: false,
    };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: 'def:left-arm',
      left_hand: 'def:left-hand',
      right_leg: 'def:right-leg',
      ornament: 'def:ornament',
    });
    const recipe = createRecipe();
    recipe.slots.ornament = { slotKey: 'ornament' };
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(blueprint.id, recipe.id);

    expect(result.entities.length).toBe(5);
    const ornamentId = entityGraphBuilder.createdParts.find((id) =>
      id.includes('ornament')
    );
    expect(
      entityManager.getComponentData(ornamentId, 'core:name')?.text
    ).toBe('Ornament Default');
  });

  it('treats slots without requirements as non-equipment', async () => {
    const blueprint = createBlueprint();
    blueprint.slots.empty_slot = {
      parent: null,
      socket: 'decor-loop',
      optional: true,
    };
    registry.register('anatomyBlueprints', blueprint.id, blueprint);
    partSelectionService = new DeterministicPartSelectionService({
      left_arm: 'def:left-arm',
      left_hand: 'def:left-hand',
      right_leg: 'def:right-leg',
      empty_slot: null,
    });
    const recipe = createRecipe();
    recipeProcessor = new SimpleRecipeProcessor(new Map([[recipe.id, recipe]]));
    const factory = createFactory();

    const result = await factory.createAnatomyGraph(blueprint.id, recipe.id);

    expect(result.entities.length).toBe(4);
  });
});
