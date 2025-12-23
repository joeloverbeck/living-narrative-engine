/**
 * @file Unit tests for ActionIndex to verify ALL required components are checked
 * @see src/actions/actionIndex.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

describe('ActionIndex - ALL Required Components', () => {
  let entityManager;
  let actionIndex;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([], logger);
    actionIndex = new ActionIndex({ logger, entityManager });
  });

  it('should only return actions when actor has ALL required components', () => {
    // Create test actions
    const actionRequiringBoth = {
      id: 'test:action_both',
      name: 'Action Requiring Both',
      required_components: {
        actor: ['component:a', 'component:b'],
      },
    };

    const actionRequiringOne = {
      id: 'test:action_one',
      name: 'Action Requiring One',
      required_components: {
        actor: ['component:a'],
      },
    };

    const actionRequiringNone = {
      id: 'test:action_none',
      name: 'Action Requiring None',
      // No required_components property at all
    };

    // Build index
    actionIndex.buildIndex([
      actionRequiringBoth,
      actionRequiringOne,
      actionRequiringNone,
    ]);

    // Test case 1: Actor has only component:a
    const actor1 = 'actor1';
    entityManager.addComponent(actor1, 'component:a', {});
    const actor1Entity = entityManager.getEntityInstance(actor1);

    const candidates1 = actionIndex.getCandidateActions(actor1Entity);
    const candidateIds1 = candidates1.map((a) => a.id);

    expect(candidateIds1).toContain('test:action_one'); // Has the required component
    expect(candidateIds1).toContain('test:action_none'); // No requirements
    expect(candidateIds1).not.toContain('test:action_both'); // Missing component:b

    // Test case 2: Actor has both components
    const actor2 = 'actor2';
    entityManager.addComponent(actor2, 'component:a', {});
    entityManager.addComponent(actor2, 'component:b', {});
    const actor2Entity = entityManager.getEntityInstance(actor2);

    const candidates2 = actionIndex.getCandidateActions(actor2Entity);
    const candidateIds2 = candidates2.map((a) => a.id);

    expect(candidateIds2).toContain('test:action_one'); // Has component:a
    expect(candidateIds2).toContain('test:action_none'); // No requirements
    expect(candidateIds2).toContain('test:action_both'); // Has both components

    // Test case 3: Actor has no components
    const actor3 = 'actor3';
    // Create the entity by adding ANY component first
    entityManager.addComponent(actor3, 'core:name', { name: 'Actor3' });
    // Then remove it to have an entity with no components we care about
    entityManager.removeComponent(actor3, 'core:name');

    const actor3Entity = entityManager.getEntityInstance(actor3);

    const candidates3 = actionIndex.getCandidateActions(actor3Entity);
    const candidateIds3 = candidates3.map((a) => a.id);

    expect(candidateIds3).not.toContain('test:action_one'); // Missing component:a
    expect(candidateIds3).toContain('test:action_none'); // No requirements
    expect(candidateIds3).not.toContain('test:action_both'); // Missing both components
  });

  it('should work with real positioning action scenario', () => {
    // Simulate the turn_around_to_face action
    const turnAroundAction = {
      id: 'positioning:turn_around_to_face',
      name: 'Turn Around to Face',
      required_components: {
        actor: ['personal-space-states:closeness', 'facing-states:facing_away'],
      },
    };

    actionIndex.buildIndex([turnAroundAction]);

    // Actor with only closeness
    const actor1 = 'actor1';
    entityManager.addComponent(actor1, 'personal-space-states:closeness', {
      partners: ['someone'],
    });
    const actor1Entity = entityManager.getEntityInstance(actor1);

    const candidates1 = actionIndex.getCandidateActions(actor1Entity);
    expect(candidates1.map((a) => a.id)).not.toContain(
      'positioning:turn_around_to_face'
    );

    // Actor with only facing_away
    const actor2 = 'actor2';
    entityManager.addComponent(actor2, 'facing-states:facing_away', {
      facing_away_from: ['someone'],
    });
    const actor2Entity = entityManager.getEntityInstance(actor2);

    const candidates2 = actionIndex.getCandidateActions(actor2Entity);
    expect(candidates2.map((a) => a.id)).not.toContain(
      'positioning:turn_around_to_face'
    );

    // Actor with both components
    const actor3 = 'actor3';
    entityManager.addComponent(actor3, 'personal-space-states:closeness', {
      partners: ['someone'],
    });
    entityManager.addComponent(actor3, 'facing-states:facing_away', {
      facing_away_from: ['someone'],
    });
    const actor3Entity = entityManager.getEntityInstance(actor3);

    const candidates3 = actionIndex.getCandidateActions(actor3Entity);
    expect(candidates3.map((a) => a.id)).toContain(
      'positioning:turn_around_to_face'
    );
  });
});
