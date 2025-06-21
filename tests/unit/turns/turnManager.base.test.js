// src/tests/turns/turnManager.base.test.js
// --- FILE START (Corrected) ---

import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
  afterEach,
} from '@jest/globals';
import { createDefaultActors } from '../../common/turns/testActors.js';

describe('TurnManager', () => {
  let testBed;
  let mockPlayerEntity;
  let mockAiEntity1;

  beforeEach(() => {
    testBed = new TurnManagerTestBed();

    ({ player: mockPlayerEntity, ai1: mockAiEntity1 } = createDefaultActors());
  });

  afterEach(() => testBed.cleanup());

  // --- Basic Sanity / Setup Tests ---

  test('should exist and be a class', () => {
    // Re-instantiate to check constructor log specifically
    jest.clearAllMocks(); // Clear previous beforeEach logs
    const instance = new TurnManagerTestBed().turnManager;

    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(testBed.turnManager.constructor);
  });

  test('mock entities should behave as configured', () => {
    // This tests the helper, doesn't directly involve TurnManager instance much
    expect(mockPlayerEntity.id).toBe('player1');
    expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
    expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
    expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
  });

  test('EntityManager mock allows setting active entities', () => {
    // This tests the mock helper, doesn't directly involve TurnManager instance much
    const entities = [mockPlayerEntity, mockAiEntity1];
    testBed.setActiveEntities(...entities);
    expect(Array.from(testBed.mocks.entityManager.entities)).toEqual(entities);
  });

  // Add more tests for start, stop, advanceTurn, etc. later
});
// --- FILE END ---
