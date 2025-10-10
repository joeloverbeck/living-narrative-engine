import { describe, it, expect } from '@jest/globals';
import * as eventIds from '../../../src/constants/eventIds.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/systemEventIds.js';

const EXPECTED_EVENT_IDS = Object.freeze({
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
  GAME_SAVED_ID: 'core:game_saved',
  TURN_STARTED_ID: 'core:turn_started',
  TURN_ENDED_ID: 'core:turn_ended',
  PLAYER_TURN_PROMPT_ID: 'core:player_turn_prompt',
  PLAYER_TURN_SUBMITTED_ID: 'core:player_turn_submitted',
  DISPLAY_ERROR_ID: 'core:display_error',
  DISPLAY_WARNING_ID: 'core:display_warning',
  ACTION_DECIDED_ID: 'core:action_decided',
  ATTEMPT_ACTION_ID: 'core:attempt_action',
  ENTITY_SPOKE_ID: 'core:entity_spoke',
  ENTITY_THOUGHT_ID: 'core:entity_thought',
  DISPLAY_SPEECH_ID: 'core:display_speech',
  DISPLAY_THOUGHT_ID: 'core:display_thought',
  PORTRAIT_CLICKED: 'core:portrait_clicked',
  TURN_PROCESSING_STARTED: 'core:turn_processing_started',
  TURN_PROCESSING_ENDED: 'core:turn_processing_ended',
  ENGINE_INITIALIZING_UI: 'core:ui_initializing',
  ENGINE_READY_UI: 'core:ui_ready',
  ENGINE_OPERATION_IN_PROGRESS_UI: 'core:ui_operation_in_progress',
  ENGINE_OPERATION_FAILED_UI: 'core:ui_operation_failed',
  ENGINE_STOPPED_UI: 'core:ui_stopped',
  REQUEST_SHOW_SAVE_GAME_UI: 'core:ui_request_show_save_game',
  REQUEST_SHOW_LOAD_GAME_UI: 'core:ui_request_show_load_game',
  CANNOT_SAVE_GAME_INFO: 'core:ui_cannot_save_game_info',
  INITIALIZATION_SERVICE_FAILED_ID: 'initialization:initialization_service:failed',
  UI_SHOW_FATAL_ERROR_ID: 'ui:show_fatal_error',
  ENTITY_CREATED_ID: 'core:entity_created',
  ENTITY_REMOVED_ID: 'core:entity_removed',
  COMPONENT_ADDED_ID: 'core:component_added',
  COMPONENTS_BATCH_ADDED_ID: 'core:components_batch_added',
  COMPONENT_REMOVED_ID: 'core:component_removed',
  WORLDINIT_ENTITY_INSTANTIATED_ID: 'core:entity_instantiated',
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID: 'worldinit:entity_instantiation_failed',
  AI_DECISION_REQUESTED: 'core:ai_decision_requested',
  AI_DECISION_RECEIVED: 'core:ai_decision_received',
  AI_DECISION_FAILED: 'core:ai_decision_failed',
  ACTION_EXECUTION_STARTED: 'core:action_execution_started',
  ACTION_EXECUTION_COMPLETED: 'core:action_execution_completed',
  ACTION_EXECUTION_FAILED: 'core:action_execution_failed',
  ACTION_VALIDATION_FAILED: 'core:action_validation_failed',
});

describe('eventIds constants', () => {
  it('exports the canonical event identifiers used across the engine', () => {
    expect(eventIds).toEqual(EXPECTED_EVENT_IDS);
  });

  it('exposes unique, namespaced identifiers for every event type', () => {
    const values = Object.values(eventIds);
    values.forEach((value) => {
      expect(typeof value).toBe('string');
      expect(value).toContain(':');
    });
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});
