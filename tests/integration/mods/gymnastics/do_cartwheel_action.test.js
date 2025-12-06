/**
 * @file Integration tests for the gymnastics:do_cartwheel action.
 * @description Exercises the cartwheel action data and verifies the handler triggers turn ending effects.
 */

import actionDefinition from '../../../../data/mods/gymnastics/actions/do_cartwheel.action.json';
import ruleDefinition from '../../../../data/mods/gymnastics/rules/handle_do_cartwheel.rule.json';
import conditionDefinition from '../../../../data/mods/gymnastics/conditions/event-is-action-do-cartwheel.condition.json';
import { runGymnasticsActionIntegrationTests } from './gymnasticsActionTestHelpers.js';

runGymnasticsActionIntegrationTests({
  actionId: 'gymnastics:do_cartwheel',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Cartwheel',
  template: 'do cartwheel',
  description:
    'Swing laterally through a hand-supported inversion to land facing the opposite direction',
  logMessageSuffix:
    'performs a cartwheel with precision, landing aligned and balanced.',
});
