/**
 * @file Integration tests for the EventValidationService using real schema validation.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';

import EventValidationService from '../../../src/validation/eventValidationService.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

class TestLogger {
  constructor() {
    this.entries = [];
  }

  #record(level, args) {
    this.entries.push({ level, args });
  }

  debug(...args) {
    this.#record('debug', args);
  }

  info(...args) {
    this.#record('info', args);
  }

  warn(...args) {
    this.#record('warn', args);
  }

  error(...args) {
    this.#record('error', args);
  }

  clear() {
    this.entries = [];
  }
}

const loadJson = (relativePath) => {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const buildValidEvent = (overrides = {}) => ({
  eventName: 'core:attempt_action',
  actorId: 'core:hero',
  actionId: 'core:attack',
  targets: {
    primary: 'npc:villager_001',
    item: 'item:iron_sword',
  },
  targetId: 'npc:villager_001',
  originalInput: 'attack villager with sword',
  ...overrides,
});

describe('EventValidationService Integration', () => {
  let logger;
  let schemaValidator;
  let service;

  beforeAll(async () => {
    logger = new TestLogger();
    schemaValidator = new AjvSchemaValidator({ logger });

    const commonSchema = loadJson('data/schemas/common.schema.json');
    const attemptActionEvent = loadJson(
      'data/mods/core/events/attempt_action.event.json'
    );

    await schemaValidator.addSchema(commonSchema, commonSchema.$id);
    await schemaValidator.addSchema(
      JSON.parse(JSON.stringify(attemptActionEvent.payloadSchema)),
      'core:attempt_action'
    );
  });

  beforeEach(() => {
    logger.clear();
    service = new EventValidationService({ logger, schemaValidator });
    service.resetPerformanceMetrics();
  });

  afterEach(() => {
    logger.clear();
    jest.restoreAllMocks();
    service.resetPerformanceMetrics();
  });

  it('validates well-formed events end-to-end', async () => {
    const event = buildValidEvent();

    const result = await service.validateEvent(event);

    expect(result.isValid).toBe(true);
    expect(result.source).toBe('complete');
    expect(result.errors).toEqual([]);
    expect(result.details).toMatchObject({
      hasMultipleTargets: true,
      targetCount: 2,
      primaryTarget: 'npc:villager_001',
    });
  });

  it('returns schema validation errors when required fields are missing', async () => {
    const invalidEvent = buildValidEvent({
      actorId: undefined,
      targetId: 'npc:villager_001',
    });
    delete invalidEvent.actorId;

    const result = await service.validateEvent(invalidEvent);

    expect(result.isValid).toBe(false);
    expect(result.source).toBe('schema');
    expect(result.warnings).toEqual([]);
    const messages = (result.errors || []).map((error) => error.message || '');
    expect(messages.join(' ')).toContain(
      "must have required property 'actorId'"
    );
  });

  it('exposes business rule errors when schema passes but legacy expectations fail', async () => {
    const legacyMismatchEvent = buildValidEvent({ targetId: null });

    const result = await service.validateEvent(legacyMismatchEvent);

    expect(result.isValid).toBe(false);
    expect(result.source).toBe('business_rules');
    expect(result.errors).toContain(
      'targetId is required for backward compatibility when targets object is present'
    );
  });

  it('surfaces multi-target consistency warnings alongside schema validation', async () => {
    const mismatchedTargetEvent = buildValidEvent({
      targetId: 'npc:unrelated_999',
    });

    const result = await service.validateEvent(mismatchedTargetEvent);

    expect(result.isValid).toBe(true);
    expect(result.source).toBe('complete');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'targetId "npc:unrelated_999" does not match any target in targets object',
        'targetId "npc:unrelated_999" does not match expected primary target "npc:villager_001"',
      ])
    );
    expect(result.details.consistencyIssues).toEqual(
      expect.arrayContaining(['targetId_mismatch', 'primary_target_mismatch'])
    );
  });

  it('validates batches of events and preserves per-event context', async () => {
    const events = [
      buildValidEvent(),
      buildValidEvent({
        targets: { primary: 'npc:helper_002' },
        targetId: 'npc:helper_002',
        originalInput: 'ask helper for aid',
      }),
      buildValidEvent({
        originalInput: 'attempt action with missing actor',
      }),
    ];
    delete events[2].actorId;

    const results = await service.validateEvents(events);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      index: 0,
      isValid: true,
      source: 'complete',
    });
    expect(results[1]).toMatchObject({
      index: 1,
      isValid: true,
      source: 'complete',
    });
    expect(results[2].isValid).toBe(false);
    expect(results[2].source).toBe('schema');
    const finalMessages = (results[2].errors || []).map(
      (error) => error.message || ''
    );
    expect(finalMessages.join(' ')).toContain(
      "must have required property 'actorId'"
    );
  });

  it('handles unexpected errors while validating a batch and continues processing', async () => {
    const event = buildValidEvent();
    const originalValidateEvent = service.validateEvent.bind(service);
    jest
      .spyOn(service, 'validateEvent')
      .mockImplementationOnce(async () => {
        throw new Error('simulated validator failure');
      })
      .mockImplementation((evt, schemaId) =>
        originalValidateEvent(evt, schemaId)
      );

    const results = await service.validateEvents([event, buildValidEvent()]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      index: 0,
      isValid: false,
      source: 'batch_error',
      warnings: [],
    });
    expect(results[0].errors).toEqual([
      'Validation error: simulated validator failure',
    ]);
    expect(results[1]).toMatchObject({
      index: 1,
      isValid: true,
      source: 'complete',
    });

    const errorLog = logger.entries.find((entry) => entry.level === 'error');
    expect(errorLog).toBeDefined();
    expect(String(errorLog.args[0])).toContain(
      'Failed to validate event at index 0'
    );
  });

  it('reports and resets performance metrics from the multi-target validator', async () => {
    const firstResult = await service.validateEvent(buildValidEvent());
    expect(firstResult.isValid).toBe(true);
    const secondResult = await service.validateEvent(
      buildValidEvent({
        targets: {
          primary: 'npc:villager_002',
          item: 'item:steel_sword',
          location: 'location:town_square',
        },
        targetId: 'npc:villager_002',
        originalInput: 'attack second villager with steel sword',
      })
    );
    expect(secondResult.isValid).toBe(true);

    const metricsBeforeReset = service.getPerformanceMetrics();
    expect(
      metricsBeforeReset.multiTarget.validationCount
    ).toBeGreaterThanOrEqual(2);
    expect(metricsBeforeReset.multiTarget.averageTime).toBeGreaterThanOrEqual(
      0
    );

    service.resetPerformanceMetrics();
    const metricsAfterReset = service.getPerformanceMetrics();
    expect(metricsAfterReset.multiTarget.validationCount).toBe(0);
    expect(metricsAfterReset.multiTarget.totalTime).toBe(0);
    expect(metricsAfterReset.multiTarget.errorCount).toBe(0);
    expect(metricsAfterReset.multiTarget.averageTime).toBe(0);
    expect(metricsAfterReset.multiTarget.errorRate).toBe(0);
  });
});
