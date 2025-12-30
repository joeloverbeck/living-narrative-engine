export const FALLBACK_APPLY_ORDER = [
  'dismembered',
  'fractured',
  'bleeding',
  'burning',
  'poisoned',
];

export const FALLBACK_EFFECT_DEFINITIONS = {
  dismember: {
    id: 'dismembered',
    effectType: 'dismember',
    componentId: 'anatomy:dismembered',
    startedEventId: 'anatomy:dismembered',
    defaults: {
      thresholdFraction: 0.8,
    },
  },
  fracture: {
    id: 'fractured',
    effectType: 'fracture',
    componentId: 'anatomy:fractured',
    startedEventId: 'anatomy:fractured',
    defaults: {
      thresholdFraction: 0.5,
      stun: {
        componentId: 'anatomy:stunned',
        durationTurns: 1,
        chance: 0,
      },
    },
  },
  bleed: {
    id: 'bleeding',
    effectType: 'bleed',
    componentId: 'anatomy:bleeding',
    startedEventId: 'anatomy:bleeding_started',
    stoppedEventId: 'anatomy:bleeding_stopped',
    defaults: {
      baseDurationTurns: 2,
      severity: {
        minor: { tickDamage: 1 },
        moderate: { tickDamage: 3 },
        severe: { tickDamage: 5 },
      },
    },
  },
  burn: {
    id: 'burning',
    effectType: 'burn',
    componentId: 'anatomy:burning',
    startedEventId: 'anatomy:burning_started',
    stoppedEventId: 'anatomy:burning_stopped',
    defaults: {
      tickDamage: 1,
      durationTurns: 2,
      stacking: { canStack: false, defaultStacks: 1 },
    },
  },
  poison: {
    id: 'poisoned',
    effectType: 'poison',
    componentId: 'anatomy:poisoned',
    startedEventId: 'anatomy:poisoned_started',
    stoppedEventId: 'anatomy:poisoned_stopped',
    defaults: {
      tickDamage: 1,
      durationTurns: 3,
      scope: 'part',
    },
  },
};
