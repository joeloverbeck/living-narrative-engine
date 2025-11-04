/**
 * @file Integration tests for the gymnastics:do_forward_roll action.
 * @description Exercises the forward roll action data and verifies the handler triggers turn ending effects.
 */

import actionDefinition from '../../../../data/mods/gymnastics/actions/do_forward_roll.action.json';
import ruleDefinition from '../../../../data/mods/gymnastics/rules/handle_do_forward_roll.rule.json';
import conditionDefinition from '../../../../data/mods/gymnastics/conditions/event-is-action-do-forward-roll.condition.json';
import { runGymnasticsActionIntegrationTests } from './gymnasticsActionTestHelpers.js';

runGymnasticsActionIntegrationTests({
  actionId: 'gymnastics:do_forward_roll',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Forward Roll',
  template: 'do forward roll',
  description:
    'Tuck tightly and roll forward along the spine for a smooth transition',
  logMessageSuffix:
    'completes a fluid forward roll, returning to a ready stance',
});
