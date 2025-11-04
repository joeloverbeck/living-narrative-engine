/**
 * @file Integration tests for the ballet:do_plies_in_fifth action.
 * @description Ensures the pliés in fifth action definition and handler macro behavior are correct.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_plies_in_fifth.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_plies_in_fifth.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-plies-in-fifth.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_plies_in_fifth',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Pliés in Fifth',
  template: 'do pliés in fifth',
  description:
    'Perform classical pliés in fifth position, establishing turnout and alignment',
  logMessageSuffix:
    'bends gracefully in fifth position, demonstrating perfect turnout and alignment',
});
