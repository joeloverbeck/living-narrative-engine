/**
 * @jest-environment node
 *
 * Sub‑Ticket 2 of 5 – Logic Operators Verification
 * ------------------------------------------------
 * This test suite verifies that JsonLogicEvaluationService correctly delegates
 * standard composite logical operators (and, or, not, !) to the underlying
 * json‑logic‑js library and that evaluation context data (event, actor, target,
 * context) is accessible within nested logical structures.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Class under test
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

// Context helper
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js';

// --- Mocks -----------------------------------------------------------------

/** @type {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** @type {jest.Mocked<import('../../src/entities/entityManager.js').default>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
  // Un‑used members stubbed for type‑safety
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Utility: create a trivial entity object (shape doesn’t matter for tests)
const makeEntity = (id) => ({ id });

// Base event for context
const baseEvent = { type: 'TEST_EVENT', payload: {} };

// Actor / target ids for context tests
const actorId = 'player';
const targetId = 'door';

// ---------------------------------------------------------------------------

describe('JsonLogicEvaluationService – composite logical operators', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });
  });

  // -----------------------------------------------------------------------
  // Basic truth‑table checks
  // -----------------------------------------------------------------------
  describe('and operator', () => {
    const cases = [
      { rule: { and: [true, true] }, expected: true },
      { rule: { and: [true, false] }, expected: false },
      { rule: { and: [false, false] }, expected: false },
    ];

    test.each(cases)('eval %o ⇒ $expected', ({ rule, expected }) => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });
  });

  describe('or operator', () => {
    const cases = [
      { rule: { or: [false, true] }, expected: true },
      { rule: { or: [false, false] }, expected: false },
      { rule: { or: [true, true] }, expected: true },
    ];

    test.each(cases)('eval %o ⇒ $expected', ({ rule, expected }) => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });
  });

  describe('not / ! operator', () => {
    const cases = [
      { rule: { not: true }, expected: false },
      { rule: { not: false }, expected: true },
      { rule: { '!': true }, expected: false },
      { rule: { '!': false }, expected: true },
    ];

    test.each(cases)('eval %o ⇒ $expected', ({ rule, expected }) => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });
  });

  // -----------------------------------------------------------------------
  // Nested logic scenarios
  // -----------------------------------------------------------------------
  describe('nested composites', () => {
    test('or wrapping and (true path)', () => {
      const rule = { or: [{ and: [true, false] }, true] }; // should short‑circuit to true
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('and containing not/! (false path)', () => {
      const rule = { and: [{ not: true }, { '!': false }] }; // false && true ⇒ false
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Context accessibility checks
  // -----------------------------------------------------------------------
  describe('context variable access inside composites', () => {
    beforeEach(() => {
      // Arrange mocked actor & target with minimal component data
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId || id === targetId ? makeEntity(id) : undefined
      );

      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === 'Locked') return false; // door is *unlocked*
        return undefined;
      });
    });

    test('complex rule from parent ticket evaluates to true', () => {
      /*
              Rule mirrors parent‑ticket example:
              {
                "or": [
                  {"==": [ {"var": "target.components.Locked"}, true ]},
                  {"and": [
                    {">=": [ {"var": "actor.components.SecurityLevel"}, 3 ]},
                    {"==": [ {"var": "actor.components.Alarm"}, false ]}
                  ]}
                ]
              }
             */
      const rule = {
        or: [
          { '==': [{ var: 'target.components.Locked' }, true] },
          {
            and: [
              { '>=': [{ var: 'actor.components.SecurityLevel' }, 3] },
              { '==': [{ var: 'actor.components.Alarm' }, false] },
            ],
          },
        ],
      };

      // Provide actor components so nested AND is true (SecurityLevel ≥ 3 and Alarm == false)
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === 'Locked') return false; // unlocked door ⇒ first OR branch false
        if (id === actorId && compId === 'SecurityLevel') return 4; // meets threshold
        if (id === actorId && compId === 'Alarm') return false; // expected value
        return undefined;
      });

      const ctx = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('event.type inside and/or structure', () => {
      const rule = {
        and: [
          { '==': [{ var: 'event.type' }, 'TEST_EVENT'] },
          { or: [false, true] }, // irrelevant branch, ensures nested evaluation
        ],
      };
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('actor.id negated with ! operator', () => {
      const rule = { '!': { '==': [{ var: 'actor.id' }, 'nobody'] } }; // actor.id != 'nobody'

      // Provide actor entity but no components needed
      mockEntityManager.getEntityInstance.mockReturnValue(makeEntity(actorId));

      const ctx = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(true);
    });
  });
});
