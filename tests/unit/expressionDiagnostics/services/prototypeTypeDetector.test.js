/**
 * @file Unit tests for prototype type detection behavior in PrototypeFitRankingService.
 */

import { describe, expect, it, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function createService({ getAllPrototypes } = {}) {
  const logger = createLogger();
  const dataRegistry = {
    get: jest.fn(),
    getLookupData: jest.fn(),
  };
  const prototypeRegistryService = {
    getPrototypesByType: jest.fn(),
    getAllPrototypes: getAllPrototypes || jest.fn(() => []),
    getPrototypeDefinitions: jest.fn(),
    getPrototype: jest.fn(),
  };

  return {
    prototypeRegistryService,
    service: new PrototypeFitRankingService({
      dataRegistry,
      logger,
      prototypeRegistryService,
    }),
  };
}

function createStoredContexts() {
  return [
    {
      moodAxes: { valence: 0.2, arousal: 0.1, threat: 0.1, engagement: 0.3 },
      sexualAxes: { sexual_arousal: 0.2 },
      affectTraits: {},
    },
  ];
}

describe('PrototypeTypeDetector behavior via PrototypeFitRankingService', () => {
  it('detects emotion references in comparison operators', () => {
    const { service, prototypeRegistryService } = createService();
    const expression = {
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ],
    };

    service.computeImpliedPrototype(expression, []);

    expect(prototypeRegistryService.getAllPrototypes).toHaveBeenCalledWith({
      hasEmotions: true,
      hasSexualStates: false,
    });
  });

  it('detects sexual references in comparison operators', () => {
    const { service, prototypeRegistryService } = createService();
    const expression = {
      prerequisites: [
        { logic: { '<=': [{ var: 'sexualStates.passion' }, 0.4] } },
      ],
    };

    service.computeImpliedPrototype(expression, []);

    expect(prototypeRegistryService.getAllPrototypes).toHaveBeenCalledWith({
      hasEmotions: false,
      hasSexualStates: true,
    });
  });

  it('detects mixed types across nested and/or logic', () => {
    const { service, prototypeRegistryService } = createService();
    const expression = {
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              {
                or: [
                  { '>=': [{ var: 'sexualStates.passion' }, 0.3] },
                  { '>=': [{ var: 'moodAxes.valence' }, 0.1] },
                ],
              },
            ],
          },
        },
      ],
    };

    service.computeImpliedPrototype(expression, []);

    expect(prototypeRegistryService.getAllPrototypes).toHaveBeenCalledWith({
      hasEmotions: true,
      hasSexualStates: true,
    });
  });

  it('falls back to emotion prototypes when references are only under unsupported operators', () => {
    const { service, prototypeRegistryService } = createService();
    const expression = {
      prerequisites: [
        {
          logic: {
            not: { '>=': [{ var: 'sexualStates.passion' }, 0.3] },
          },
        },
      ],
    };

    service.computeImpliedPrototype(expression, []);

    expect(prototypeRegistryService.getAllPrototypes).toHaveBeenCalledWith({
      hasEmotions: true,
      hasSexualStates: false,
    });
  });

  it('extracts the first prototype reference from comparison logic', () => {
    const { service } = createService({
      getAllPrototypes: jest.fn(() => [
        { id: 'joy', type: 'emotion', weights: {}, gates: [] },
        { id: 'passion', type: 'sexual', weights: {}, gates: [] },
      ]),
    });

    const expression = {
      prerequisites: [
        {
          logic: {
            and: [
              { '<=': [{ var: 'sexualStates.passion' }, 0.6] },
              { '>=': [{ var: 'emotions.joy' }, 0.2] },
            ],
          },
        },
      ],
    };

    const result = service.analyzeAllPrototypeFit(
      expression,
      createStoredContexts()
    );

    expect(result.currentPrototype).toEqual(
      expect.objectContaining({ prototypeId: 'passion', type: 'sexual' })
    );
  });

  it('does not extract prototypes from equality comparisons', () => {
    const { service } = createService({
      getAllPrototypes: jest.fn(() => [
        { id: 'joy', type: 'emotion', weights: {}, gates: [] },
      ]),
    });

    const expression = {
      prerequisites: [
        { logic: { '==': [{ var: 'emotions.joy' }, 1] } },
      ],
    };

    const result = service.analyzeAllPrototypeFit(
      expression,
      createStoredContexts()
    );

    expect(result.currentPrototype).toBeNull();
  });
});
