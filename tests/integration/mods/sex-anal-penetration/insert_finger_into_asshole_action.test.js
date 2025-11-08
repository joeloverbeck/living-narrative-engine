import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import insertFingerIntoAssholeRuleJson from '../../../../data/mods/sex-anal-penetration/rules/handle_insert_finger_into_asshole.rule.json' assert { type: 'json' };
import insertFingerIntoAssholeConditionJson from '../../../../data/mods/sex-anal-penetration/conditions/event-is-action-insert-finger-into-asshole.condition.json' assert { type: 'json' };

describe('sex-anal-penetration:insert_finger_into_asshole Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole',
      insertFingerIntoAssholeRuleJson,
      insertFingerIntoAssholeConditionJson
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('should successfully execute insert finger into asshole action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Alice inserts a finger into Bob's asshole, opening it up."
      );
    });

    it('should correctly interpolate actor and target names', async () => {
      const scenario = testFixture.createStandardActorTarget(['Samantha', 'Derek']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Samantha inserts a finger into Derek's asshole, opening it up."
      );
    });
  });
});
