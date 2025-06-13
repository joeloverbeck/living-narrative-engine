/**
 * @file Test suite for the decision meta methods of TurnContext.
 * @see tests/turns/context/turnContext.decisionMeta.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../src/turns/context/turnContext.js';

// Type Imports
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TKT-011: TurnContext Decision Metadata', () => {
  /** @type {TurnContext} */
  let turnContext;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {Entity} */
  let mockActor;
  /** @type {IActorTurnStrategy} */
  let mockStrategy;
  /** @type {Function} */
  let mockOnEndTurnCallback;
  /** @type {BaseTurnHandler} */
  let mockHandlerInstance;

  beforeEach(() => {
    mockLogger = mockDeep();
    mockActor = mock();
    mockStrategy = mockDeep();
    mockOnEndTurnCallback = jest.fn();
    mockHandlerInstance = mockDeep();

    turnContext = new TurnContext({
      actor: mockActor,
      logger: mockLogger,
      services: {}, // Keep it simple, not needed for this test
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    });
  });

  test('should initially have null decision metadata', () => {
    expect(turnContext.getDecisionMeta()).toBeNull();
  });

  test('setDecisionMeta should store the provided metadata object', () => {
    // ARRANGE
    const meta = { speech: 'Hello world', thoughts: 'Testing...', notes: [] };

    // ACT
    turnContext.setDecisionMeta(meta);
    const result = turnContext.getDecisionMeta();

    // ASSERT
    expect(result).toBe(meta); // Should be the exact same object reference
    expect(result).toEqual({
      speech: 'Hello world',
      thoughts: 'Testing...',
      notes: [],
    });
  });

  test('getDecisionMeta should return a frozen object if one was set', () => {
    // ARRANGE
    const meta = { speech: 'Hi', thoughts: null, notes: null };
    // The caller (AwaitingPlayerInputState) is responsible for freezing.
    const frozenMeta = Object.freeze(meta);

    // ACT
    turnContext.setDecisionMeta(frozenMeta);
    const result = turnContext.getDecisionMeta();

    // ASSERT
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('setDecisionMeta should handle null and undefined by setting metadata to null', () => {
    // ARRANGE
    const meta = { speech: 'Some data', thoughts: null, notes: null };
    turnContext.setDecisionMeta(meta);
    expect(turnContext.getDecisionMeta()).not.toBeNull(); // Pre-condition check

    // ACT
    turnContext.setDecisionMeta(null);
    // ASSERT
    expect(turnContext.getDecisionMeta()).toBeNull();

    // ARRANGE
    turnContext.setDecisionMeta(meta);
    expect(turnContext.getDecisionMeta()).not.toBeNull(); // Pre-condition check

    // ACT
    turnContext.setDecisionMeta(undefined);
    // ASSERT
    expect(turnContext.getDecisionMeta()).toBeNull();
  });

  test('endTurn should reset decision metadata to null', () => {
    // ARRANGE
    const meta = { speech: 'Data before end', thoughts: null, notes: null };
    turnContext.setDecisionMeta(meta);
    expect(turnContext.getDecisionMeta()).not.toBeNull(); // Pre-condition check

    // ACT
    turnContext.endTurn();

    // ASSERT
    expect(turnContext.getDecisionMeta()).toBeNull();
  });

  test('A new instance should have null decision metadata', () => {
    // ARRANGE & ACT
    const newContext = new TurnContext({
      actor: mockActor,
      logger: mockLogger,
      services: {},
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    });

    // ASSERT
    expect(newContext.getDecisionMeta()).toBeNull();
  });
});
