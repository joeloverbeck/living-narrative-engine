/**
 * @file Unit tests for handle_travel_through_dimensions rule schema validation
 * @description Tests that the rule correctly uses descriptionText field for perceptible events
 */

import { describe, it, expect } from '@jest/globals';
import handleTravelThroughDimensionsRule from '../../../../data/mods/movement/rules/handle_travel_through_dimensions.rule.json' assert { type: 'json' };

describe('handle_travel_through_dimensions Rule Schema', () => {
  describe('Perceptible Event Payload Structure', () => {
    it('should use descriptionText field instead of message for perceptible events', () => {
      const dispatchEventOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) => action.type === 'DISPATCH_EVENT'
        );

      const perceptibleEvents = dispatchEventOperations.filter(
        (op) => op.parameters.eventType === 'core:perceptible_event'
      );

      // There should be exactly 2 perceptible events (departure and arrival)
      expect(perceptibleEvents.length).toBe(2);

      perceptibleEvents.forEach((event) => {
        const payload = event.parameters.payload;

        // Must have descriptionText field
        expect(payload).toHaveProperty('descriptionText');
        expect(payload.descriptionText).toBeDefined();

        // Must NOT have message field (that's for other event types)
        expect(payload).not.toHaveProperty('message');

        // Verify the descriptionText uses the logMessage variable
        expect(payload.descriptionText).toBe('{context.logMessage}');
      });
    });

    it('should include all required perceptible event fields', () => {
      const dispatchEventOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) => action.type === 'DISPATCH_EVENT'
        );

      const perceptibleEvents = dispatchEventOperations.filter(
        (op) => op.parameters.eventType === 'core:perceptible_event'
      );

      perceptibleEvents.forEach((event) => {
        const payload = event.parameters.payload;

        // Required fields per schema
        expect(payload).toHaveProperty('eventName');
        expect(payload).toHaveProperty('locationId');
        expect(payload).toHaveProperty('descriptionText');
        expect(payload).toHaveProperty('timestamp');
        expect(payload).toHaveProperty('perceptionType');
        expect(payload).toHaveProperty('actorId');

        // Validate eventName
        expect(payload.eventName).toBe('core:perceptible_event');
      });
    });

    it('should only include allowed perceptible event fields', () => {
      const dispatchEventOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) => action.type === 'DISPATCH_EVENT'
        );

      const perceptibleEvents = dispatchEventOperations.filter(
        (op) => op.parameters.eventType === 'core:perceptible_event'
      );

      const allowedFields = [
        'eventName',
        'locationId',
        'descriptionText',
        'timestamp',
        'perceptionType',
        'actorId',
        'targetId',
        'involvedEntities',
        'contextualData',
      ];

      perceptibleEvents.forEach((event) => {
        const payload = event.parameters.payload;
        const payloadKeys = Object.keys(payload);

        payloadKeys.forEach((key) => {
          expect(allowedFields).toContain(key);
        });
      });
    });

    it('should have correct perceptionType values', () => {
      const dispatchEventOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) => action.type === 'DISPATCH_EVENT'
        );

      const perceptibleEvents = dispatchEventOperations.filter(
        (op) => op.parameters.eventType === 'core:perceptible_event'
      );

      // First event should be departure (character_exit)
      expect(perceptibleEvents[0].parameters.payload.perceptionType).toBe(
        '{context.perceptionType}'
      );

      // Second event should be arrival (character_enter)
      expect(perceptibleEvents[1].parameters.payload.perceptionType).toBe(
        '{context.perceptionType}'
      );

      // Verify the SET_VARIABLE operations set the correct values
      const setPerceptionTypeOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) =>
            action.type === 'SET_VARIABLE' &&
            action.parameters.variable_name === 'perceptionType'
        );

      expect(setPerceptionTypeOperations.length).toBe(2);
      expect(setPerceptionTypeOperations[0].parameters.value).toBe(
        'movement.departure'
      );
      expect(setPerceptionTypeOperations[1].parameters.value).toBe(
        'movement.arrival'
      );
    });

    it('should use display_successful_action_result with message field correctly', () => {
      const dispatchEventOperations =
        handleTravelThroughDimensionsRule.actions.filter(
          (action) => action.type === 'DISPATCH_EVENT'
        );

      const displayEvents = dispatchEventOperations.filter(
        (op) =>
          op.parameters.eventType === 'core:display_successful_action_result'
      );

      // There should be exactly 1 display event
      expect(displayEvents.length).toBe(1);

      const payload = displayEvents[0].parameters.payload;

      // This event type SHOULD use 'message' field
      expect(payload).toHaveProperty('message');
      expect(payload.message).toBeDefined();

      // Should NOT use 'descriptionText' for this event type
      expect(payload).not.toHaveProperty('descriptionText');
    });
  });
});
