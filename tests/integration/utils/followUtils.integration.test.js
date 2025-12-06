import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { FOLLOWING_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  getLeaderId,
  detectCycle,
  wouldCreateCycle,
} from '../../../src/utils/followUtils.js';

/**
 * Creates an entity definition with an optional following component.
 *
 * @param {string} id
 * @param {string | null} leaderId
 * @returns {{id: string, components: Record<string, any>}}
 */
function makeEntity(id, leaderId = null) {
  const components = {};
  if (leaderId) {
    components[FOLLOWING_COMPONENT_ID] = { leaderId };
  }
  return { id, components };
}

describe('followUtils integration', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
  });

  it('reads leader relationships through the entity access pipeline', async () => {
    entityManager.setEntities([
      makeEntity('leaderA'),
      makeEntity('follower1', 'leaderA'),
    ]);

    expect(getLeaderId('follower1', entityManager)).toBe('leaderA');

    await entityManager.addComponent('follower1', FOLLOWING_COMPONENT_ID, {
      leaderId: 'leaderB',
    });
    entityManager.createEntity('leaderB');

    expect(getLeaderId('follower1', entityManager)).toBe('leaderB');
  });

  it('returns null when leader data cannot be resolved', () => {
    entityManager.setEntities([makeEntity('solitary')]);

    expect(getLeaderId('', entityManager)).toBeNull();
    expect(getLeaderId('solitary', null)).toBeNull();
    expect(getLeaderId('missing', entityManager)).toBeNull();
    expect(getLeaderId('solitary', entityManager)).toBeNull();
  });

  it('detects a direct cycle across real entity records', () => {
    entityManager.setEntities([
      makeEntity('leaderA', 'follower1'),
      makeEntity('follower1', 'leaderA'),
    ]);

    expect(detectCycle('follower1', 'leaderA', entityManager)).toBe(true);
  });

  it('stops traversal when the follow chain terminates', () => {
    entityManager.setEntities([makeEntity('leaderA'), makeEntity('observer')]);

    expect(detectCycle('observer', 'leaderA', entityManager)).toBe(false);
  });

  it('guards against unrelated cycles encountered during traversal', () => {
    entityManager.setEntities([
      makeEntity('loopA', 'loopB'),
      makeEntity('loopB', 'loopA'),
      makeEntity('scout'),
    ]);

    expect(detectCycle('scout', 'loopA', entityManager)).toBe(false);
  });

  it('treats missing identifiers or managers as non-cycles', () => {
    expect(wouldCreateCycle('', 'leaderA', entityManager)).toBe(false);
    expect(wouldCreateCycle('scout', '', entityManager)).toBe(false);
    expect(wouldCreateCycle('scout', 'leaderA', null)).toBe(false);
    expect(detectCycle('scout', '', entityManager)).toBe(false);
  });

  it('reports multi-hop cycles when a follower re-enters the graph', () => {
    entityManager.setEntities([
      makeEntity('leaderA', 'midpoint'),
      makeEntity('midpoint', 'scout'),
      makeEntity('scout'),
    ]);

    expect(wouldCreateCycle('scout', 'leaderA', entityManager)).toBe(true);
  });
});
