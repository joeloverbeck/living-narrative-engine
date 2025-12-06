/**
 * @file Integration tests covering multi-signal analysis behaviour in FixSuggestionEngine.
 * @description Ensures the engine combines suggestions from every detector and
 *              sorts them by confidence when several error heuristics trigger
 *              at the same time.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

class RecordingLogger {
  constructor() {
    /** @type {{ level: string, message: string, context?: unknown }[]} */
    this.entries = [];
  }

  debug(message, context) {
    this.entries.push({ level: 'debug', message, context });
  }

  info(message, context) {
    this.entries.push({ level: 'info', message, context });
  }

  warn(message, context) {
    this.entries.push({ level: 'warn', message, context });
  }

  error(message, context) {
    this.entries.push({ level: 'error', message, context });
  }
}

class StubGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

class StubActionIndex {
  getCandidateActions() {
    return [];
  }
}

describe('FixSuggestionEngine combined detector integration', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {FixSuggestionEngine} */
  let engine;

  beforeEach(() => {
    logger = new RecordingLogger();
    engine = new FixSuggestionEngine({
      logger,
      gameDataRepository: new StubGameDataRepository(),
      actionIndex: new StubActionIndex(),
    });
  });

  it('aggregates suggestions from every detector and orders them by confidence', () => {
    const actorSnapshot = {
      id: 'agent-7',
      components: {
        'core:state': { status: 'stunned', duration: 3 },
        'core:status': { stunned: true },
        'core:condition': { fatigue: 'extreme' },
      },
      location: 'none',
    };

    const actionDef = {
      id: 'stealth:shadow_step',
      name: 'Shadow Step',
      scope: 'stealth:guard_post',
      prerequisites: [
        { hasComponent: 'stealth:training' },
        {
          logic: {
            or: [
              {
                all: [
                  { hasComponent: 'core:agility' },
                  { logic: { all: [{ hasComponent: 'core:focus' }] } },
                ],
              },
              { hasComponent: 'core:shadow' },
            ],
          },
        },
      ],
    };

    const aggregatedError = new Error(
      "Scope resolution failed: missing component 'stealth:training' produced an invalid state for target evaluation"
    );
    aggregatedError.name = 'ScopeResolutionError';

    const suggestions = engine.suggestFixes(
      aggregatedError,
      actionDef,
      actorSnapshot,
      ERROR_PHASES.VALIDATION
    );

    expect(suggestions.length).toBeGreaterThan(0);

    const confidences = suggestions.map((fix) => fix.confidence);
    const sortedConfidences = [...confidences].sort((a, b) => b - a);
    expect(confidences).toEqual(sortedConfidences);

    const hasSuggestion = (predicate) => suggestions.some(predicate);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.MISSING_COMPONENT &&
          fix.details.componentId === 'stealth:training' &&
          fix.details.requiredBy === 'stealth:shadow_step'
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.MISSING_COMPONENT &&
          fix.details.componentId === 'stealth:training' &&
          fix.details.source === 'prerequisite_analysis'
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.MISSING_COMPONENT &&
          fix.details.componentId === 'core:focus' &&
          fix.details.source === 'prerequisite_analysis'
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.INVALID_STATE &&
          fix.details.componentId === 'core:state' &&
          fix.details.currentValue?.status === 'stunned' &&
          fix.details.currentValue?.duration === 3
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.SCOPE_RESOLUTION &&
          fix.details.scope === 'stealth:guard_post' &&
          fix.details.actorLocation === actorSnapshot.location
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.INVALID_STATE &&
          ((typeof fix.details.suggestion === 'string' &&
            fix.details.suggestion.includes('valid location')) ||
            (typeof fix.description === 'string' &&
              fix.description.includes('Actor has no valid location')))
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.MISSING_PREREQUISITE &&
          Array.isArray(fix.details.prerequisites) &&
          fix.details.prerequisites.some(
            (entry) => entry.hasComponent === 'stealth:training'
          )
      )
    ).toBe(true);

    expect(
      hasSuggestion(
        (fix) =>
          fix.type === FIX_TYPES.INVALID_TARGET &&
          fix.details.actionScope === actionDef.scope
      )
    ).toBe(true);

    expect(
      logger.entries.some(
        (entry) =>
          entry.level === 'debug' &&
          entry.message.includes('Analyzing error for fixes')
      )
    ).toBe(true);
  });
});
