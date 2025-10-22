import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('Forbidden Components - Integration', () => {
  let entityManager;
  let actionIndex;
  let schemaValidator;
  let logger;
  let gameDataRepository;

  beforeEach(() => {
    // Create logger
    logger = createMockLogger();

    // Create mock entity manager
    const entities = new Map();
    entityManager = {
      entities,
      createEntity: (id) => {
        const entity = {
          id,
          components: {},
          hasComponent: (componentId) => componentId in entity.components,
          getComponentData: (componentId) =>
            entity.components[componentId] || null,
        };
        entities.set(id, entity);
        return entity;
      },
      getEntityById: (id) => entities.get(id),
      getEntityInstance: (id) => entities.get(id),
      addComponent: (entityId, componentId, data) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data;
        }
      },
      getAllComponentTypesForEntity: (entityId) => {
        const entity =
          typeof entityId === 'string' ? entities.get(entityId) : entityId;
        return entity ? Object.keys(entity.components || {}) : [];
      },
      clear: () => entities.clear(),
    };

    // Create action index
    actionIndex = new ActionIndex({ logger, entityManager });

    // Create schema validator
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load action schema
    const actionSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/action.schema.json',
      type: 'object',
      properties: {
        $schema: { type: 'string' },
        id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$' },
        name: { type: 'string' },
        description: { type: 'string' },
        scope: { type: 'string' },
        template: { type: 'string' },
        required_components: {
          type: 'object',
          properties: {
            actor: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        forbidden_components: {
          type: 'object',
          properties: {
            actor: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$',
              },
            },
          },
        },
      },
      required: ['id', 'scope', 'template'],
    };
    schemaValidator.addSchema(
      actionSchema,
      'schema://living-narrative-engine/action.schema.json'
    );

    // Create game data repository
    gameDataRepository = {
      actions: [],
    };

    // Create player entity
    entityManager.createEntity('player');
  });

  afterEach(() => {
    // Clear all entities
    entityManager.clear();
  });

  it('should exclude actions when actor has forbidden components', async () => {
    // Create test action with forbidden components
    const testAction = {
      id: 'test:forbidden_action',
      name: 'Forbidden Test Action',
      description: 'Action that forbids paralyzed component',
      scope: 'core:environment',
      template: 'perform forbidden action',
      required_components: {
        actor: ['core:stats'],
      },
      forbidden_components: {
        actor: ['status:paralyzed'],
      },
    };

    // Add action to game data
    gameDataRepository.actions.push(testAction);

    // Rebuild action index
    actionIndex.buildIndex(gameDataRepository.actions);

    // Get player entity
    const player = entityManager.getEntityById('player');

    // Add required component
    entityManager.addComponent('player', 'core:stats', { health: 100 });

    // Test without forbidden component - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map((a) => a.id);
    expect(actionIds).toContain('test:forbidden_action');

    // Add forbidden component
    entityManager.addComponent('player', 'status:paralyzed', {});

    // Test with forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map((a) => a.id);
    expect(actionIds).not.toContain('test:forbidden_action');
  });

  it('should handle multiple forbidden components correctly', () => {
    // Create test action with multiple forbidden components
    const testAction = {
      id: 'test:multi_forbidden',
      name: 'Multi Forbidden Action',
      description: 'Action that forbids multiple status components',
      scope: 'core:environment',
      template: 'perform multi forbidden action',
      forbidden_components: {
        actor: ['status:stunned', 'status:sleeping', 'status:confused'],
      },
    };

    // Add action to game data
    gameDataRepository.actions.push(testAction);

    // Rebuild action index
    actionIndex.buildIndex(gameDataRepository.actions);

    // Get player entity
    const player = entityManager.getEntityById('player');

    // Test without any forbidden components - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map((a) => a.id);
    expect(actionIds).toContain('test:multi_forbidden');

    // Add one of the forbidden components
    entityManager.addComponent('player', 'status:sleeping', {});

    // Test with one forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map((a) => a.id);
    expect(actionIds).not.toContain('test:multi_forbidden');
  });

  it('should work with both required and forbidden components', () => {
    // Create test action with both required and forbidden components
    const testAction = {
      id: 'test:complex_requirements',
      name: 'Complex Requirements Action',
      description: 'Action with both required and forbidden components',
      scope: 'core:environment',
      template: 'perform complex action',
      required_components: {
        actor: ['core:stats', 'core:inventory'],
      },
      forbidden_components: {
        actor: ['status:disabled', 'status:blocked'],
      },
    };

    // Add action to game data
    gameDataRepository.actions.push(testAction);

    // Rebuild action index
    actionIndex.buildIndex(gameDataRepository.actions);

    // Get player entity
    const player = entityManager.getEntityById('player');

    // Add required components
    entityManager.addComponent('player', 'core:stats', { health: 100 });
    entityManager.addComponent('player', 'core:inventory', { items: [] });

    // Test with required components but no forbidden - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map((a) => a.id);
    expect(actionIds).toContain('test:complex_requirements');

    // Add a forbidden component
    entityManager.addComponent('player', 'status:blocked', {});

    // Test with forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map((a) => a.id);
    expect(actionIds).not.toContain('test:complex_requirements');
  });

  it('should validate forbidden components match schema pattern', () => {
    // Valid action with forbidden components
    const validAction = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test:valid_forbidden',
      name: 'Valid Forbidden Action',
      description: 'Action with valid forbidden components',
      scope: 'core:environment',
      template: 'perform action',
      forbidden_components: {
        actor: ['mod:component1', 'mod:component2'],
      },
    };

    const validationResult = schemaValidator.validate(
      'schema://living-narrative-engine/action.schema.json',
      validAction
    );
    expect(validationResult.isValid).toBe(true);

    // Invalid action with malformed component IDs
    const invalidAction = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test:invalid_forbidden',
      name: 'Invalid Forbidden Action',
      description: 'Action with invalid forbidden components',
      scope: 'core:environment',
      template: 'perform action',
      forbidden_components: {
        actor: ['invalid-format', 'mod:valid', 'also invalid'],
      },
    };

    const invalidResult = schemaValidator.validate(
      'schema://living-narrative-engine/action.schema.json',
      invalidAction
    );
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors).toBeDefined();
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
