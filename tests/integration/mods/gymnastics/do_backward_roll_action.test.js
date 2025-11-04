/**
 * @file Integration tests for the gymnastics:do_backward_roll action.
 * @description Exercises the backward roll action data and verifies the handler triggers turn ending effects.
 */

import actionDefinition from '../../../../data/mods/gymnastics/actions/do_backward_roll.action.json';
import ruleDefinition from '../../../../data/mods/gymnastics/rules/handle_do_backward_roll.rule.json';
import conditionDefinition from '../../../../data/mods/gymnastics/conditions/event-is-action-do-backward-roll.condition.json';
import { runGymnasticsActionIntegrationTests } from './gymnasticsActionTestHelpers.js';

runGymnasticsActionIntegrationTests({
  actionId: 'gymnastics:do_backward_roll',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Backward Roll',
  template: 'do backward roll',
  description:
    'Roll backward through a tucked inversion to recover facing forward',
  logMessageSuffix:
    'tucks down and rolls backward smoothly, rising centered and alert.',
});
