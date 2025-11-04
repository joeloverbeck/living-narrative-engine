/**
 * @file Integration tests for the ballet:do_bourree_couru_on_pointe action.
 * @description Ensures the bourrée couru on pointe action definition and handler rule function as expected.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_bourree_couru_on_pointe.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_bourree_couru_on_pointe.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-bourree-couru-on-pointe.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_bourree_couru_on_pointe',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Bourrée Couru on Pointe',
  template: 'do bourrée couru on pointe',
  description: 'Perform gliding travel on pointe with rapid tiny steps',
  logMessageSuffix:
    'rises onto pointe and glides across the floor with rapid micro-steps',
});
