import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import insertMultipleFingersIntoAssholeRuleJson from '../../../../data/mods/sex-anal-penetration/rules/handle_insert_multiple_fingers_into_asshole.rule.json' assert { type: 'json' };
import insertMultipleFingersIntoAssholeConditionJson from '../../../../data/mods/sex-anal-penetration/conditions/event-is-action-insert-multiple-fingers-into-asshole.condition.json' assert { type: 'json' };

describe('sex-anal-penetration:insert_multiple_fingers_into_asshole Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_multiple_fingers_into_asshole',
      insertMultipleFingersIntoAssholeRuleJson,
      insertMultipleFingersIntoAssholeConditionJson
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('should successfully execute insert multiple fingers into asshole action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Alice pushes three fingers into Bob's asshole, feeling it stretching out."
      );
    });

    it('should correctly interpolate actor and target names', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Samantha',
        'Derek',
      ]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Samantha pushes three fingers into Derek's asshole, feeling it stretching out."
      );
    });
  });
});
