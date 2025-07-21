import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';

describe('Forbidden Components - Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new TestBedClass();
    await testBed.initialize({
      loadRealGame: false,
      createPlayer: true,
    });
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
        actor: ['core:stats']
      },
      forbidden_components: {
        actor: ['status:paralyzed']
      }
    };

    // Add action to game data
    testBed.gameDataRepository.actions.push(testAction);
    
    // Rebuild action index
    const actionIndex = testBed.container.get('IActionIndex');
    actionIndex.buildIndex(testBed.gameDataRepository.actions);

    // Get player entity
    const player = testBed.entityManager.getEntityById('player');
    
    // Add required component
    testBed.entityManager.addComponent('player', 'core:stats', { health: 100 });

    // Test without forbidden component - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map(a => a.id);
    expect(actionIds).toContain('test:forbidden_action');

    // Add forbidden component
    testBed.entityManager.addComponent('player', 'status:paralyzed', {});

    // Test with forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map(a => a.id);
    expect(actionIds).not.toContain('test:forbidden_action');
  });

  it('should handle multiple forbidden components correctly', async () => {
    // Create test action with multiple forbidden components
    const testAction = {
      id: 'test:multi_forbidden',
      name: 'Multi Forbidden Action',
      description: 'Action that forbids multiple status components',
      scope: 'core:environment',
      template: 'perform multi forbidden action',
      forbidden_components: {
        actor: ['status:stunned', 'status:sleeping', 'status:confused']
      }
    };

    // Add action to game data
    testBed.gameDataRepository.actions.push(testAction);
    
    // Rebuild action index
    const actionIndex = testBed.container.get('IActionIndex');
    actionIndex.buildIndex(testBed.gameDataRepository.actions);

    // Get player entity
    const player = testBed.entityManager.getEntityById('player');

    // Test without any forbidden components - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map(a => a.id);
    expect(actionIds).toContain('test:multi_forbidden');

    // Add one of the forbidden components
    testBed.entityManager.addComponent('player', 'status:sleeping', {});

    // Test with one forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map(a => a.id);
    expect(actionIds).not.toContain('test:multi_forbidden');
  });

  it('should work with both required and forbidden components', async () => {
    // Create test action with both required and forbidden components
    const testAction = {
      id: 'test:complex_requirements',
      name: 'Complex Requirements Action',
      description: 'Action with both required and forbidden components',
      scope: 'core:environment',
      template: 'perform complex action',
      required_components: {
        actor: ['core:stats', 'core:inventory']
      },
      forbidden_components: {
        actor: ['status:disabled', 'status:blocked']
      }
    };

    // Add action to game data
    testBed.gameDataRepository.actions.push(testAction);
    
    // Rebuild action index
    const actionIndex = testBed.container.get('IActionIndex');
    actionIndex.buildIndex(testBed.gameDataRepository.actions);

    // Get player entity
    const player = testBed.entityManager.getEntityById('player');

    // Add required components
    testBed.entityManager.addComponent('player', 'core:stats', { health: 100 });
    testBed.entityManager.addComponent('player', 'core:inventory', { items: [] });

    // Test with required components but no forbidden - action should be available
    let candidates = actionIndex.getCandidateActions(player);
    let actionIds = candidates.map(a => a.id);
    expect(actionIds).toContain('test:complex_requirements');

    // Add a forbidden component
    testBed.entityManager.addComponent('player', 'status:blocked', {});

    // Test with forbidden component - action should NOT be available
    candidates = actionIndex.getCandidateActions(player);
    actionIds = candidates.map(a => a.id);
    expect(actionIds).not.toContain('test:complex_requirements');
  });

  it('should validate forbidden components match schema pattern', async () => {
    const validator = testBed.container.get('ISchemaValidator');
    
    // Valid action with forbidden components
    const validAction = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test:valid_forbidden',
      name: 'Valid Forbidden Action',
      description: 'Action with valid forbidden components',
      scope: 'core:environment',
      template: 'perform action',
      forbidden_components: {
        actor: ['mod:component1', 'mod:component2']
      }
    };

    const validationResult = validator.validate(validAction, 'schema://living-narrative-engine/action.schema.json');
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
        actor: ['invalid-format', 'mod:valid', 'also invalid']
      }
    };

    const invalidResult = validator.validate(invalidAction, 'schema://living-narrative-engine/action.schema.json');
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors).toBeDefined();
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});