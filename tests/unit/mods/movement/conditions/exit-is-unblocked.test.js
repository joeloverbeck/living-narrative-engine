import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { createMinimalTestContainer } from '../../../../common/scopeDsl/minimalTestContainer.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';

const MOVEMENT_CONDITIONS_DIR = path.resolve(
  process.cwd(),
  'data/mods/movement/conditions',
);

describe('movement:exit-is-unblocked', () => {
  let services;
  let jsonLogicEval;
  let cleanup;

  beforeAll(async () => {
    const env = await createMinimalTestContainer();
    services = env.services;
    cleanup = env.cleanup;

    jsonLogicEval = new JsonLogicEvaluationService({
      logger: services.logger,
      gameDataRepository: services.dataRegistry,
    });

    // Register get_component_value operator
    jsonLogicEval.addOperation('get_component_value', (entityRef, componentId, propertyPath = null) => {
      const entityId = entityRef && typeof entityRef === 'object' && 'id' in entityRef ? entityRef.id : entityRef;
      if (!entityId) return null;
      
      const componentData = services.entityManager.getComponentData(entityId, componentId);
      if (!componentData) return null;
      
      if (!propertyPath) return componentData;
      
      return propertyPath.split('.').reduce((obj, key) => obj && obj[key], componentData);
    });

    // Load the condition manually
    const conditionPath = path.join(MOVEMENT_CONDITIONS_DIR, 'exit-is-unblocked.condition.json');
    const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));
    services.dataRegistry.store('conditions', condition.id, condition);
  });

  afterAll(async () => {
    await cleanup?.();
  });

  beforeEach(() => {
     // Clear entities
     const ids = services.entityManager.getEntityIds();
     ids.forEach(id => services.entityManager.deleteEntity(id));
  });

  function evaluate(context) {
    const condition = services.dataRegistry.getConditionDefinition('movement:exit-is-unblocked');
    return jsonLogicEval.evaluate(condition.logic, context);
  }

  it('returns true when there is no blocker', () => {
    const context = { entity: { blocker: null } };
    expect(evaluate(context)).toBe(true);
  });

  it('returns true when blocker exists but has no mechanisms:openable component', () => {
    const blocker = { id: 'blocker1', components: {} };
    services.entityManager.addEntity(blocker);
    const context = { entity: { blocker: services.entityManager.getEntityInstance(blocker.id) } };
    expect(evaluate(context)).toBe(true);
  });

  it('returns true when blocker exists and has mechanisms:openable with isLocked=false', () => {
    const blocker = {
      id: 'blocker2',
      components: {
        'mechanisms:openable': { isLocked: false, requiredKeyId: 'key' }
      }
    };
    services.entityManager.addEntity(blocker);
    const context = { entity: { blocker: services.entityManager.getEntityInstance(blocker.id) } };
    expect(evaluate(context)).toBe(true);
  });

  it('returns false when blocker exists and has mechanisms:openable with isLocked=true', () => {
    const blocker = {
      id: 'blocker3',
      components: {
        'mechanisms:openable': { isLocked: true, requiredKeyId: 'key' }
      }
    };
    services.entityManager.addEntity(blocker);
    const context = { entity: { blocker: services.entityManager.getEntityInstance(blocker.id) } };
    expect(evaluate(context)).toBe(false);
  });
});