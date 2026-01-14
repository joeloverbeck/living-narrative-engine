/**
 * @file Unit tests for InvariantValidator.
 */

import { describe, it, expect } from '@jest/globals';
import InvariantValidator from '../../../../src/expressionDiagnostics/services/InvariantValidator.js';

describe('InvariantValidator', () => {
  it('flags probability and count invariant violations', () => {
    const validator = new InvariantValidator();

    const diagnosticFacts = {
      overallPassRate: 1.2,
      clauses: [
        {
          clauseId: 'var:emotions.joy:>=:0.4',
          failRateInMood: -0.1,
          conditionalFailRate: 1.1,
          nearMissRate: 0.5,
        },
      ],
      prototypes: [
        {
          prototypeId: 'joy',
          moodSampleCount: 10,
          gatePassCount: 12,
          thresholdPassCount: 11,
          gatePassRate: 0.5,
          gateFailRate: 0.6,
          pThreshGivenGate: 0.5,
          pThreshEffective: 0.1,
          meanValueGivenGate: 1.2,
        },
      ],
    };

    const invariants = validator.validate(diagnosticFacts, { epsilon: 1e-6 });

    expect(
      invariants.find((inv) => inv.id === 'rate:overallPassRate')?.ok
    ).toBe(false);
    expect(
      invariants.find(
        (inv) => inv.id === 'count:joy:gatePassWithinMood'
      )?.ok
    ).toBe(false);
    expect(
      invariants.find((inv) => inv.id === 'probabilityIdentity:joy')?.ok
    ).toBe(false);
  });
});
