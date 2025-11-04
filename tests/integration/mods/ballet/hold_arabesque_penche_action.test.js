/**
 * @file Integration tests for the ballet:hold_arabesque_penche action.
 * @description Ensures the arabesque penché hold action and handler produce the expected narrative and events.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/hold_arabesque_penche.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_hold_arabesque_penche.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-hold-arabesque-penche.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:hold_arabesque_penche',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Hold Arabesque Penché',
  template: 'hold arabesque penché',
  description: 'Maintain arabesque position with controlled forward hinge',
  logMessageSuffix:
    'tilts forward while raising their back leg into a dramatic arabesque',
});
