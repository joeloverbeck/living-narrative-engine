/**
 * @file This file contains unit tests for the EntityFactory class.
 * @see src/entities/factories/entityFactory.js
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import EntityFactory from '../../../../src/entities/factories/entityFactory.js';
import Entity from '../../../../src/entities/entity.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { DefinitionNotFoundError } from '../../../../src/errors/definitionNotFoundError.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../../src/errors/invalidInstanceIdError.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
} from '../../../common/mockFactories.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('EntityFactory', () => {
  let factory;
  let mocks;
  let mockIdGenerator;
  let mockCloner;
  let mockDefaultPolicy;

  beforeEach(() => {
    mocks = {
      validator: createMockSchemaValidator(),
      logger: createMockLogger(),
      registry: createSimpleMockDataRegistry(),
    };

    mockIdGenerator = jest.fn(() => 'test-entity-id-123');
    mockCloner = jest.fn((data) => JSON.parse(JSON.stringify(data)));
    mockDefaultPolicy = {};

    factory = new EntityFactory({
      validator: mocks.validator,
      logger: mocks.logger,
      idGenerator: mockIdGenerator,
      cloner: mockCloner,
      defaultPolicy: mockDefaultPolicy,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should instantiate successfully with valid dependencies', () => {
      expect(factory).toBeInstanceOf(EntityFactory);
    });

    it('should throw an error if validator is missing', () => {
      expect(() => {
        new EntityFactory({
          validator: null,
          logger: mocks.logger,
          idGenerator: mockIdGenerator,
          cloner: mockCloner,
          defaultPolicy: mockDefaultPolicy,
        });
      }).toThrow('Missing required dependency: ISchemaValidator.');
    });

    it('should throw an error if logger is missing', () => {
      expect(() => {
        new EntityFactory({
          validator: mocks.validator,
          logger: null,
          idGenerator: mockIdGenerator,
          cloner: mockCloner,
          defaultPolicy: mockDefaultPolicy,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });

    it('should throw an error if idGenerator is not a function', () => {
      expect(() => {
        new EntityFactory({
          validator: mocks.validator,
          logger: mocks.logger,
          idGenerator: 'not-a-function',
          cloner: mockCloner,
          defaultPolicy: mockDefaultPolicy,
        });
      }).toThrow('idGenerator must be a function');
    });

    it('should throw an error if cloner is not a function', () => {
      expect(() => {
        new EntityFactory({
          validator: mocks.validator,
          logger: mocks.logger,
          idGenerator: mockIdGenerator,
          cloner: 'not-a-function',
          defaultPolicy: mockDefaultPolicy,
        });
      }).toThrow('cloner must be a function');
    });

    it('should throw an error if defaultPolicy is not an object', () => {
      expect(() => {
        new EntityFactory({
          validator: mocks.validator,
          logger: mocks.logger,
          idGenerator: mockIdGenerator,
          cloner: mockCloner,
          defaultPolicy: 'not-an-object',
        });
      }).toThrow('defaultPolicy must be an object');
    });
  });

  describe('create', () => {
    const testDefinition = new EntityDefinition('test-def:basic', {
      description: 'A basic definition for testing',
      components: { 'core:name': { name: 'Basic' } },
    });

    beforeEach(() => {
      mocks.registry.getEntityDefinition.mockReturnValue(testDefinition);
      mocks.validator.validate.mockReturnValue({ isValid: true });
    });

    it('should create an entity with generated ID when no instanceId provided', () => {
      const entity = factory.create(
        'test-def:basic',
        {},
        mocks.registry,
        { has: () => false },
        null
      );

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('test-entity-id-123');
      expect(entity.definitionId).toBe('test-def:basic');
      expect(mockIdGenerator).toHaveBeenCalledTimes(1);
    });

    it('should create an entity with provided instanceId', () => {
      const entity = factory.create(
        'test-def:basic',
        { instanceId: 'custom-id' },
        mocks.registry,
        { has: () => false },
        null
      );

      expect(entity.id).toBe('custom-id');
      expect(mockIdGenerator).not.toHaveBeenCalled();
    });

    it('should throw TypeError if definitionId is not a string', () => {
      expect(() => {
        factory.create(null, {}, mocks.registry, { has: () => false }, null);
      }).toThrow('definitionId must be a non-empty string.');

      expect(() => {
        factory.create(
          undefined,
          {},
          mocks.registry,
          { has: () => false },
          null
        );
      }).toThrow('definitionId must be a non-empty string.');

      expect(() => {
        factory.create(123, {}, mocks.registry, { has: () => false }, null);
      }).toThrow('definitionId must be a non-empty string.');
    });

    it('should throw DefinitionNotFoundError if definition not found', () => {
      mocks.registry.getEntityDefinition.mockReturnValue(null);

      expect(() => {
        factory.create(
          'non-existent',
          {},
          mocks.registry,
          { has: () => false },
          null
        );
      }).toThrow(new DefinitionNotFoundError('non-existent'));
    });

    it('should throw error if entity with same ID already exists', () => {
      const repository = { has: jest.fn(() => true) };

      expect(() => {
        factory.create(
          'test-def:basic',
          { instanceId: 'existing-id' },
          mocks.registry,
          repository,
          null
        );
      }).toThrow("Entity with ID 'existing-id' already exists.");
    });

    it('should apply component overrides correctly', () => {
      const overrides = {
        'core:description': { text: 'Overridden Description' },
        'new:component': { data: 'xyz' },
      };

      const entity = factory.create(
        'test-def:basic',
        { componentOverrides: overrides },
        mocks.registry,
        { has: () => false },
        null
      );

      expect(entity.getComponentData('core:description').text).toBe(
        'Overridden Description'
      );
      expect(entity.hasComponent('new:component')).toBe(true);
      expect(entity.getComponentData('new:component').data).toBe('xyz');
    });

    it('calls validator for each component override', () => {
      const overrides = {
        'core:name': { name: 'test' },
        extra1: { a: 1 },
        extra2: { b: 2 },
      };

      factory.create(
        'test-def:basic',
        { componentOverrides: overrides },
        mocks.registry,
        { has: () => false },
        null
      );

      expect(mocks.validator.validate).toHaveBeenCalledTimes(3);
    });

    it('should validate component overrides', () => {
      const overrides = { 'core:description': { text: 'Test' } };
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid data'],
      });

      expect(() => {
        factory.create(
          'test-def:basic',
          { componentOverrides: overrides },
          mocks.registry,
          { has: () => false },
          null
        );
      }).toThrow(
        'New component core:description on entity test-entity-id-123 Errors:'
      );
    });

    it('should inject default components for actor entities', () => {
      const actorDefinition = new EntityDefinition('test-def:actor', {
        description: 'An actor definition',
        components: { [ACTOR_COMPONENT_ID]: {} },
      });
      mocks.registry.getEntityDefinition.mockReturnValue(actorDefinition);

      const entity = factory.create(
        'test-def:actor',
        {},
        mocks.registry,
        { has: () => false },
        null
      );

      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
    });

    it('should not inject default components for non-actor entities', () => {
      const entity = factory.create(
        'test-def:basic',
        {},
        mocks.registry,
        { has: () => false },
        null
      );

      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(false);
    });

    it('should not inject default components that already exist', () => {
      const actorDefinition = new EntityDefinition('test-def:actor', {
        description: 'An actor definition',
        components: {
          [ACTOR_COMPONENT_ID]: {},
          [SHORT_TERM_MEMORY_COMPONENT_ID]: {
            thoughts: ['existing'],
            maxEntries: 5,
          },
        },
      });
      mocks.registry.getEntityDefinition.mockReturnValue(actorDefinition);

      const entity = factory.create(
        'test-def:actor',
        {},
        mocks.registry,
        { has: () => false },
        null
      );

      // Should not override existing STM component
      expect(
        entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID).thoughts
      ).toEqual(['existing']);
      expect(
        entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID).maxEntries
      ).toBe(5);
    });
  });

  describe('reconstruct', () => {
    const testDefinition = new EntityDefinition('test-def:basic', {
      description: 'A basic definition for testing',
      components: { 'core:name': { name: 'Basic' } },
    });

    beforeEach(() => {
      mocks.registry.getEntityDefinition.mockReturnValue(testDefinition);
      mocks.validator.validate.mockReturnValue({ isValid: true });
    });

    it('should reconstruct entity from serialized data', () => {
      const serializedEntity = {
        instanceId: 'reconstructed-id',
        definitionId: 'test-def:basic',
        components: {
          'core:name': { name: 'Reconstructed' },
          'core:description': { text: 'Reconstructed entity' },
        },
      };

      const entity = factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('reconstructed-id');
      expect(entity.definitionId).toBe('test-def:basic');
      expect(entity.getComponentData('core:name').name).toBe('Reconstructed');
      expect(entity.getComponentData('core:description').text).toBe(
        'Reconstructed entity'
      );
    });

    it('should throw error if serializedEntity is invalid', () => {
      expect(() => {
        factory.reconstruct(null, mocks.registry, { has: () => false });
      }).toThrow(SerializedEntityError);

      expect(() => {
        factory.reconstruct('invalid', mocks.registry, { has: () => false });
      }).toThrow(SerializedEntityError);
    });

    it('should throw error if instanceId is invalid', () => {
      const serializedEntity = {
        instanceId: null,
        definitionId: 'test-def:basic',
        components: {},
      };

      expect(() => {
        factory.reconstruct(serializedEntity, mocks.registry, {
          has: () => false,
        });
      }).toThrow(InvalidInstanceIdError);
    });

    it('should throw error if entity with same ID already exists', () => {
      const serializedEntity = {
        instanceId: 'existing-id',
        definitionId: 'test-def:basic',
        components: {},
      };

      const repository = { has: jest.fn(() => true) };

      expect(() => {
        factory.reconstruct(serializedEntity, mocks.registry, repository);
      }).toThrow(
        "EntityFactory.reconstruct: Entity with ID 'existing-id' already exists. Reconstruction aborted."
      );
    });

    it('should throw DefinitionNotFoundError if definition not found', () => {
      const serializedEntity = {
        instanceId: 'test-id',
        definitionId: 'non-existent',
        components: {},
      };

      mocks.registry.getEntityDefinition.mockReturnValue(null);

      expect(() => {
        factory.reconstruct(serializedEntity, mocks.registry, {
          has: () => false,
        });
      }).toThrow(new DefinitionNotFoundError('non-existent'));
    });

    it('should validate components during reconstruction', () => {
      const serializedEntity = {
        instanceId: 'test-id',
        definitionId: 'test-def:basic',
        components: {
          'core:description': { text: 'Test' },
        },
      };

      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid component'],
      });

      expect(() => {
        factory.reconstruct(serializedEntity, mocks.registry, {
          has: () => false,
        });
      }).toThrow(
        'Reconstruction component core:description for entity test-id (definition test-def:basic) Errors:'
      );
    });

    it('should handle null component data', () => {
      const serializedEntity = {
        instanceId: 'test-id',
        definitionId: 'test-def:basic',
        components: {
          'core:description': null,
        },
      };

      const entity = factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(entity.getComponentData('core:description')).toBeNull();
    });

    it('calls validator for each serialized component', () => {
      const serializedEntity = {
        instanceId: 'call-count',
        definitionId: 'test-def:basic',
        components: {
          'core:name': { name: 'n1' },
          new1: { val: 1 },
          new2: null,
        },
      };

      factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(mocks.validator.validate).toHaveBeenCalledTimes(2);
    });

    it('should inject default components for actor entities during reconstruction', () => {
      const actorDefinition = new EntityDefinition('test-def:actor', {
        description: 'An actor definition',
        components: { [ACTOR_COMPONENT_ID]: {} },
      });
      mocks.registry.getEntityDefinition.mockReturnValue(actorDefinition);

      const serializedEntity = {
        instanceId: 'actor-id',
        definitionId: 'test-def:actor',
        components: { [ACTOR_COMPONENT_ID]: {} },
      };

      const entity = factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
    });

    it('should handle empty components object', () => {
      const serializedEntity = {
        instanceId: 'test-id',
        definitionId: 'test-def:basic',
        components: {},
      };

      const entity = factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('test-id');
    });

    it('should handle missing components property', () => {
      const serializedEntity = {
        instanceId: 'test-id',
        definitionId: 'test-def:basic',
      };

      const entity = factory.reconstruct(serializedEntity, mocks.registry, {
        has: () => false,
      });

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('test-id');
    });
  });
});
