/**
 * @file Unit tests for companionship:follow rule description regeneration
 * @description Ensures that the follow rule refreshes both leader and follower descriptions
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const rulePath = path.resolve(
  process.cwd(),
  'data/mods/companionship/rules/follow.rule.json'
);
const rule = JSON.parse(fs.readFileSync(rulePath, 'utf8'));

const successBranchActions = (() => {
  const successBranch = rule.actions.find(
    (action) =>
      action.type === 'IF' &&
      action.parameters?.condition?.not &&
      action.parameters?.then_actions
  );

  if (!successBranch) {
    return [];
  }

  return successBranch.parameters.then_actions;
})();

describe('companionship:follow rule description regeneration', () => {
  it('should include REGENERATE_DESCRIPTION actions for follower and leader', () => {
    const regenerateActions = successBranchActions.filter(
      (action) => action.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenerateActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameters: { entity_ref: 'actor' },
        }),
        expect.objectContaining({
          parameters: {
            entity_ref: { entityId: '{event.payload.targetId}' },
          },
        }),
      ])
    );
  });

  it('should regenerate descriptions immediately after establishing the follow relation', () => {
    const establishIndex = successBranchActions.findIndex(
      (action) => action.type === 'ESTABLISH_FOLLOW_RELATION'
    );

    expect(establishIndex).toBeGreaterThan(-1);

    const followerRegen = successBranchActions[establishIndex + 1];
    const leaderRegen = successBranchActions[establishIndex + 2];

    expect(followerRegen).toBeDefined();
    expect(followerRegen.type).toBe('REGENERATE_DESCRIPTION');
    expect(followerRegen.parameters.entity_ref).toBe('actor');

    expect(leaderRegen).toBeDefined();
    expect(leaderRegen.type).toBe('REGENERATE_DESCRIPTION');
    expect(leaderRegen.parameters.entity_ref).toEqual({
      entityId: '{event.payload.targetId}',
    });
  });
});
