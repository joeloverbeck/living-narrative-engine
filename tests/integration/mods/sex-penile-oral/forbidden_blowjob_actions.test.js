/**
 * @file Integration tests for forbidden_components validation with giving_blowjob.
 * @description Validates that mouth-based actions are correctly forbidden when actor
 * is already giving a blowjob, ensuring mouth engagement exclusivity.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

// Import all actions that should be forbidden during blowjob
import breatheTeasinglyOnPenisAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json';
import breatheTeasinglyOnPenisSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json';
import lickTesticlesSensuallyAction from '../../../../data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json';
import lickTesticlesSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json';
import suckleTesticleAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle.action.json';
import suckleTesticleSittingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_sitting_close.action.json';

const TEST_ACTIONS = [
  {
    id: 'sex-penile-oral:breathe_teasingly_on_penis',
    action: breatheTeasinglyOnPenisAction,
    description: 'breathe teasingly on penis (kneeling)',
  },
  {
    id: 'sex-penile-oral:breathe_teasingly_on_penis_sitting_close',
    action: breatheTeasinglyOnPenisSittingCloseAction,
    description: 'breathe teasingly on penis (sitting close)',
  },
  {
    id: 'sex-penile-oral:lick_testicles_sensually',
    action: lickTesticlesSensuallyAction,
    description: 'lick testicles sensually (kneeling)',
  },
  {
    id: 'sex-penile-oral:lick_testicles_sitting_close',
    action: lickTesticlesSittingCloseAction,
    description: 'lick testicles (sitting close)',
  },
  {
    id: 'sex-penile-oral:suckle_testicle',
    action: suckleTesticleAction,
    description: 'suckle testicle (kneeling)',
  },
  {
    id: 'sex-penile-oral:suckle_testicle_sitting_close',
    action: suckleTesticleSittingCloseAction,
    description: 'suckle testicle (sitting close)',
  },
];

describe('Forbidden Components - giving_blowjob', () => {
  let entityManager;
  let actionIndex;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();

    // Create simple mock entity manager
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
      removeComponent: (entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components[componentId]) {
          delete entity.components[componentId];
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

    // Create player entity
    entityManager.createEntity('player');
  });

  afterEach(() => {
    entityManager.clear();
  });

  describe('Baseline: Actions available without giving_blowjob component', () => {
    TEST_ACTIONS.forEach(({ id, action, description }) => {
      it(`${description} should be available without giving_blowjob`, () => {
        // Build action index with action
        actionIndex.buildIndex([action]);

        // Get player entity
        const player = entityManager.getEntityById('player');

        // Add required components from action definition
        const requiredActorComponents = action.required_components?.actor || [];
        requiredActorComponents.forEach((componentId) => {
          entityManager.addComponent('player', componentId, {});
        });

        // Test without forbidden component - action should be available
        let candidates = actionIndex.getCandidateActions(player);
        let actionIds = candidates.map((a) => a.id);
        expect(actionIds).toContain(id);
      });
    });
  });

  describe('Forbidden: Actions NOT available with giving_blowjob component', () => {
    TEST_ACTIONS.forEach(({ id, action, description }) => {
      it(`${description} should NOT be available when actor giving blowjob`, () => {
        // Build action index with action
        actionIndex.buildIndex([action]);

        // Get player entity
        const player = entityManager.getEntityById('player');

        // Add required components
        const requiredActorComponents = action.required_components?.actor || [];
        requiredActorComponents.forEach((componentId) => {
          entityManager.addComponent('player', componentId, {});
        });

        // Add forbidden component
        entityManager.addComponent('player', 'positioning:giving_blowjob', {
          receiving_entity_id: 'someone',
          initiated: true,
        });

        // Test with forbidden component - action should NOT be available
        let candidates = actionIndex.getCandidateActions(player);
        let actionIds = candidates.map((a) => a.id);
        expect(actionIds).not.toContain(id);
      });
    });
  });

  describe('Recovery: Actions become available after removing giving_blowjob', () => {
    TEST_ACTIONS.forEach(({ id, action, description }) => {
      it(`${description} should become available after removing giving_blowjob`, () => {
        // Build action index with action
        actionIndex.buildIndex([action]);

        // Get player entity
        const player = entityManager.getEntityById('player');

        // Add required components
        const requiredActorComponents = action.required_components?.actor || [];
        requiredActorComponents.forEach((componentId) => {
          entityManager.addComponent('player', componentId, {});
        });

        // Add forbidden component
        entityManager.addComponent('player', 'positioning:giving_blowjob', {
          receiving_entity_id: 'someone',
          initiated: true,
        });

        // Initially blocked with giving_blowjob
        let candidates = actionIndex.getCandidateActions(player);
        let actionIds = candidates.map((a) => a.id);
        expect(actionIds).not.toContain(id);

        // Remove giving_blowjob component
        entityManager.removeComponent('player', 'positioning:giving_blowjob');

        // Should now be available
        candidates = actionIndex.getCandidateActions(player);
        actionIds = candidates.map((a) => a.id);
        expect(actionIds).toContain(id);
      });
    });
  });
});
