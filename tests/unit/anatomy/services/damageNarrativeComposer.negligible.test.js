import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DamageNarrativeComposer from '../../../../src/anatomy/services/damageNarrativeComposer.js';

const baseEntry = {
  entityId: 'entity-1',
  entityName: 'Rill',
  entityPronoun: 'she',
  entityPossessive: 'her',
  partId: 'torso-1',
  partType: 'torso',
  orientation: null,
  amount: 1,
  damageType: 'piercing',
  propagatedFrom: null,
  effectsTriggered: [],
};

describe('DamageNarrativeComposer - negligible severity formatting', () => {
  let composer;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    composer = new DamageNarrativeComposer({ logger });
  });

  it('qualifies primary damage when severity is negligible', () => {
    const result = composer.compose([
      {
        ...baseEntry,
        severity: 'negligible',
      },
    ]);

    expect(result).toBe("Rill's torso suffers negligible piercing damage.");
  });

  it('keeps existing phrasing for standard severity', () => {
    const result = composer.compose([
      {
        ...baseEntry,
        damageType: 'slashing',
        severity: 'standard',
      },
    ]);

    expect(result).toBe("Rill's torso suffers slashing damage.");
  });

  it('adds negligible qualifier to propagated groups when all entries are negligible', () => {
    const result = composer.compose([
      {
        ...baseEntry,
        severity: 'standard',
      },
      {
        ...baseEntry,
        partId: 'heart-1',
        partType: 'heart',
        propagatedFrom: 'torso-1',
        severity: 'negligible',
      },
      {
        ...baseEntry,
        partId: 'lung-left',
        partType: 'lung',
        orientation: 'left',
        propagatedFrom: 'torso-1',
        severity: 'negligible',
      },
    ]);

    expect(result).toBe(
      "Rill's torso suffers piercing damage. As a result, her heart and left lung suffer negligible piercing damage."
    );
  });

  it('does not mislabel mixed-propagation severities as negligible', () => {
    const result = composer.compose([
      {
        ...baseEntry,
        severity: 'standard',
      },
      {
        ...baseEntry,
        partId: 'heart-1',
        partType: 'heart',
        propagatedFrom: 'torso-1',
        severity: 'standard',
      },
      {
        ...baseEntry,
        partId: 'lung-left',
        partType: 'lung',
        orientation: 'left',
        propagatedFrom: 'torso-1',
        severity: 'negligible',
      },
    ]);

    expect(result).toBe(
      "Rill's torso suffers piercing damage. As a result, her heart and left lung suffer piercing damage."
    );
  });
});
