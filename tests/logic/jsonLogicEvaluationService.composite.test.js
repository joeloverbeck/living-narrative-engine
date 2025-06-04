// src/tests/logic/jsonLogicEvaluationService.composite.test.js

/**
 * @jest-environment node
 *
 * Sub-Ticket 3 of 5 – Composite Logical Conditions
 * ------------------------------------------------
 * This suite exercises *all* composite-operator paths (and, or, not/!) in
 * JsonLogicEvaluationService.evaluate – including nesting, edge-cases, context
 * interaction, and short-circuit behaviour.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// SUT
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

// Context helper
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks
// ─────────────────────────────────────────────────────────────────────────────

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
  // un-used stubs
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

const makeEntity = (id) => ({ id }); // trivial entity factory

const baseEvent = { type: 'TEST_EVENT', payload: {} };
const actorId = 'player';
const targetId = 'door';

// ─────────────────────────────────────────────────────────────────────────────
// Test-suite
// ─────────────────────────────────────────────────────────────────────────────
describe('JsonLogicEvaluationService – composite operator coverage', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });
  });

  // =========================================================================
  // 1. Basic truth tables
  // =========================================================================
  describe('basic operator truth-tables', () => {
    test.each([
      { rule: { and: [true, true] }, expected: true },
      { rule: { and: [true, false] }, expected: false },
      { rule: { and: [false, false, true] }, expected: false },
      { rule: { and: [true, true, true] }, expected: true },
    ])('AND %o → %s', ({ rule, expected }) => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });

    test.each([
      { rule: { or: [false, false] }, expected: false },
      { rule: { or: [false, true] }, expected: true },
      { rule: { or: [true, false, true] }, expected: true },
    ])('OR  %o → %s', ({ rule, expected }) => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });

    test.each([
      { rule: { not: true }, expected: false },
      { rule: { not: false }, expected: true },
      { rule: { '!': true }, expected: false },
      { rule: { '!': false }, expected: true },
    ])('NOT %o → %s', ({ rule, expected }) => {
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

  // =========================================================================
  // 2. Edge-cases (empty operands, non-boolean values)
  // =========================================================================
  describe('edge-cases', () => {
    test('{and: []} yields true', () => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate({ and: [] }, ctx)).toBe(true);
    });

    test('{or: []} yields false', () => {
      const ctx = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate({ or: [] }, ctx)).toBe(false);
    });

    test('not applied to truthy / falsy non-boolean values', () => {
      // actor.id is a *truthy* string ⇒ not → false
      mockEntityManager.getEntityInstance.mockReturnValue(makeEntity(actorId));
      const ctxWithActor = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate({ not: { var: 'actor.id' } }, ctxWithActor)).toBe(
        false
      );

      // nonexistent path ⇒ null/falsy ⇒ not → true
      const ctxNoActor = createJsonLogicContext(
        baseEvent,
        null,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(
        service.evaluate({ not: { var: 'never.there' } }, ctxNoActor)
      ).toBe(true);
    });
  });

  // =========================================================================
  // 3. Composite nesting
  // =========================================================================
  describe('operator nesting', () => {
    const ctx = createJsonLogicContext(
      baseEvent,
      null,
      null,
      mockEntityManager,
      mockLogger
    );

    test('AND containing OR', () => {
      const rule = { and: [true, { or: [false, true] }] }; // true && (true) → true
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('OR containing AND', () => {
      const rule = { or: [{ and: [true, false] }, false] }; // (false) || false → false
      expect(service.evaluate(rule, ctx)).toBe(false);
    });

    test('NOT applied to AND expression', () => {
      const rule = { not: { and: [true, false] } }; // not(false) → true
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('NOT applied to OR expression', () => {
      const rule = { '!': { or: [false, true] } }; // not(true) → false
      expect(service.evaluate(rule, ctx)).toBe(false);
    });

    test('multi-level nesting (and > or > not > constant)', () => {
      const rule = {
        and: [
          {
            or: [
              { '!': false }, // not(false) → true
              false,
            ],
          },
          true,
        ],
      };
      expect(service.evaluate(rule, ctx)).toBe(true);
    });
  });

  // =========================================================================
  // 4. Complex example from parent ticket – all paths
  // =========================================================================
  describe('parent-ticket complex rule', () => {
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

    beforeEach(() => {
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === actorId || id === targetId ? makeEntity(id) : undefined
      );
    });

    const scenarios = [
      {
        name: 'locked=true  →  true (first branch)',
        ctxFn: () => {
          mockEntityManager.getComponentData.mockImplementation((id, comp) =>
            id === targetId && comp === 'Locked' ? true : undefined
          );
        },
        expected: true,
      },
      {
        name: 'unlocked & security<3  →  false',
        ctxFn: () => {
          mockEntityManager.getComponentData.mockImplementation((id, comp) => {
            if (id === targetId && comp === 'Locked') return false;
            if (id === actorId && comp === 'SecurityLevel') return 2;
            if (id === actorId && comp === 'Alarm') return false;
            return undefined;
          });
        },
        expected: false,
      },
      {
        name: 'unlocked & security≥3 & alarm=true  →  false',
        ctxFn: () => {
          mockEntityManager.getComponentData.mockImplementation((id, comp) => {
            if (id === targetId && comp === 'Locked') return false;
            if (id === actorId && comp === 'SecurityLevel') return 3;
            if (id === actorId && comp === 'Alarm') return true;
            return undefined;
          });
        },
        expected: false,
      },
      {
        name: 'unlocked & security≥3 & alarm=false  →  true (second branch)',
        ctxFn: () => {
          mockEntityManager.getComponentData.mockImplementation((id, comp) => {
            if (id === targetId && comp === 'Locked') return false;
            if (id === actorId && comp === 'SecurityLevel') return 5;
            if (id === actorId && comp === 'Alarm') return false;
            return undefined;
          });
        },
        expected: true,
      },
    ];

    test.each(scenarios)('$name', ({ ctxFn, expected }) => {
      ctxFn(); // configure mocked component data
      const ctx = createJsonLogicContext(
        baseEvent,
        actorId,
        targetId,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate(rule, ctx)).toBe(expected);
    });
  });

  // =========================================================================
  // 5. Context interaction outside of components
  // =========================================================================
  describe('context variable fetch inside composites', () => {
    test('event.type used under AND/OR', () => {
      const rule = {
        and: [
          { '==': [{ var: 'event.type' }, 'TEST_EVENT'] },
          { or: [false, true] },
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

    test('NOT of actor.id string', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(makeEntity(actorId));
      const ctx = createJsonLogicContext(
        baseEvent,
        actorId,
        null,
        mockEntityManager,
        mockLogger
      );
      expect(service.evaluate({ '!': { var: 'actor.id' } }, ctx)).toBe(false); // 'player' is truthy; !truthy → false
    });
  });

  // =========================================================================
  // 6. Short-circuit verification
  // =========================================================================
  describe('short-circuit behaviour', () => {
    beforeEach(() => {
      // custom operator that *must* never run when short-circuited
      service.addOperation('throw_error_operator', () => {
        throw new Error('Operator should not have been executed');
      });
    });

    const ctx = createJsonLogicContext(
      baseEvent,
      null,
      null,
      mockEntityManager,
      mockLogger
    );

    test('OR short-circuits after first true operand', () => {
      const rule = {
        or: [
          { '==': [1, 1] }, // true  – should satisfy rule
          { throw_error_operator: [] }, // would throw if executed
        ],
      };
      expect(() => service.evaluate(rule, ctx)).not.toThrow();
      expect(service.evaluate(rule, ctx)).toBe(true);
    });

    test('AND short-circuits after first false operand', () => {
      const rule = {
        and: [
          { '==': [1, 2] }, // false – forces short-circuit
          { throw_error_operator: [] }, // would throw if executed
        ],
      };
      expect(() => service.evaluate(rule, ctx)).not.toThrow();
      expect(service.evaluate(rule, ctx)).toBe(false);
    });
  });
});
