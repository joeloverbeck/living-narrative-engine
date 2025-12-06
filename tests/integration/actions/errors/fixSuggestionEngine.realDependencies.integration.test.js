/**
 * @file Integration coverage for FixSuggestionEngine with real collaborators.
 * @description Verifies fix suggestion generation by wiring FixSuggestionEngine to
 *              ActionErrorContextBuilder, ActionIndex, and SimpleEntityManager without mocks.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

class RecordingLogger {
  constructor(prefix = 'test') {
    this.prefix = prefix;
    this.records = [];
  }

  #record(level, message, args) {
    this.records.push({ level, message, args });
  }

  debug(message, ...args) {
    this.#record('debug', message, args);
  }

  info(message, ...args) {
    this.#record('info', message, args);
  }

  warn(message, ...args) {
    this.#record('warn', message, args);
  }

  error(message, ...args) {
    this.#record('error', message, args);
  }

  groupCollapsed() {}

  groupEnd() {}
}

class InMemoryGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

describe('FixSuggestionEngine real dependency integration', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {ActionIndex} */
  let actionIndex;
  /** @type {FixSuggestionEngine} */
  let fixSuggestionEngine;
  /** @type {ActionErrorContextBuilder} */
  let errorContextBuilder;
  /** @type {RecordingLogger} */
  let logger;
  let primaryAction;

  beforeEach(() => {
    logger = new RecordingLogger('integration');
    entityManager = new SimpleEntityManager([
      {
        id: 'hero-1',
        components: {
          'core:position': { locationId: 'plaza' },
          'core:location': { value: 'plaza' },
          'core:state': { stance: 'ready' },
          'core:status': { stamina: 3 },
          'core:condition': { morale: 'low' },
        },
      },
      {
        id: 'scout-2',
        components: {
          'core:status': { stamina: 1 },
        },
      },
    ]);

    primaryAction = {
      id: 'core:scout-area',
      name: 'Scout Area',
      template: 'Scout the area',
      scope: 'core:nearby',
      required_components: {
        actor: ['core:position'],
      },
      prerequisites: [
        {
          all: [
            { hasComponent: 'core:energy' },
            {
              all: [
                { hasComponent: 'core:morale' },
                { hasComponent: 'core:focus' },
              ],
            },
          ],
        },
      ],
    };

    const supportiveAction = {
      id: 'core:observe',
      name: 'Observe',
      template: 'Observe surroundings',
      scope: 'core:nearby',
      required_components: { actor: [] },
    };

    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([primaryAction, supportiveAction]);

    fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository: new InMemoryGameDataRepository(),
      actionIndex,
    });

    errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });
  });

  it('produces actionable fixes for validation failures with missing components and prerequisites', () => {
    const validationError = new Error("Missing component 'core:energy'");
    const context = errorContextBuilder.buildErrorContext({
      error: validationError,
      actionDef: primaryAction,
      actorId: 'hero-1',
      phase: ERROR_PHASES.VALIDATION,
    });

    expect(context.actorSnapshot.components['core:position']).toEqual({
      locationId: 'plaza',
    });
    expect(context.environmentContext.phase).toBe(ERROR_PHASES.VALIDATION);

    const missingEnergyFix = context.suggestedFixes.find(
      (fix) =>
        fix.type === FIX_TYPES.MISSING_COMPONENT &&
        fix.details.componentId === 'core:energy'
    );
    expect(missingEnergyFix).toBeDefined();
    expect(missingEnergyFix.details.actorId).toBe('hero-1');

    const moraleFix = context.suggestedFixes.find(
      (fix) =>
        fix.type === FIX_TYPES.MISSING_COMPONENT &&
        fix.details.componentId === 'core:morale'
    );
    expect(moraleFix).toBeDefined();

    const prerequisiteSummary = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.MISSING_PREREQUISITE
    );
    expect(prerequisiteSummary).toBeDefined();
    expect(prerequisiteSummary.details.prerequisites).toEqual(
      expect.arrayContaining(primaryAction.prerequisites)
    );

    expect(logger.records.some((entry) => entry.level === 'debug')).toBe(true);
  });

  it('suggests fixes for invalid states, scope issues, and target failures across phases', () => {
    const baselineSnapshot = errorContextBuilder.buildErrorContext({
      error: new Error('baseline'),
      actionDef: primaryAction,
      actorId: 'hero-1',
      phase: ERROR_PHASES.EXECUTION,
    }).actorSnapshot;

    const invalidStateError = new Error('Invalid state transition detected');
    invalidStateError.name = 'InvalidStateError';
    const invalidStateFixes = fixSuggestionEngine.suggestFixes(
      invalidStateError,
      primaryAction,
      baselineSnapshot,
      ERROR_PHASES.EXECUTION
    );
    expect(
      invalidStateFixes.some((fix) => fix.type === FIX_TYPES.INVALID_STATE)
    ).toBe(true);

    const scopeError = new Error('Scope resolution failed: no valid targets');
    const scoutSnapshot = errorContextBuilder.buildErrorContext({
      error: scopeError,
      actionDef: primaryAction,
      actorId: 'scout-2',
      phase: ERROR_PHASES.EXECUTION,
    }).actorSnapshot;
    const scopeFixes = fixSuggestionEngine.suggestFixes(
      scopeError,
      primaryAction,
      scoutSnapshot,
      ERROR_PHASES.EXECUTION
    );
    expect(
      scopeFixes.some((fix) => fix.type === FIX_TYPES.SCOPE_RESOLUTION)
    ).toBe(true);
    expect(
      scopeFixes.some(
        (fix) =>
          fix.type === FIX_TYPES.INVALID_STATE &&
          fix.description.includes('location')
      )
    ).toBe(true);

    const targetError = new Error('Target entity not found for interaction');
    const targetFixes = fixSuggestionEngine.suggestFixes(
      targetError,
      primaryAction,
      baselineSnapshot,
      ERROR_PHASES.EXECUTION
    );
    expect(
      targetFixes.some((fix) => fix.type === FIX_TYPES.INVALID_TARGET)
    ).toBe(true);
  });
});
