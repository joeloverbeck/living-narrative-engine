import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionIndexingService from '../../../../src/turns/services/actionIndexingService.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, details) {
    this.debugLogs.push({ message, details });
  }

  info(message, details) {
    this.infoLogs.push({ message, details });
  }

  warn(message, details) {
    this.warnLogs.push({ message, details });
  }

  error(message, details) {
    this.errorLogs.push({ message, details });
  }
}

function createTrickyParams() {
  let accessCount = 0;
  const params = {
    get volatileValue() {
      accessCount += 1;
      if (accessCount === 3) {
        throw new Error('volatile access during formatting');
      }
      return 'steady';
    },
  };
  return params;
}

function buildComplexParams() {
  const symbolKey = Symbol('sigil');
  const helperFn = function helperTransform() {};
  const nestedMap = new Map([
    ['depth', { layer: 1 }],
    [symbolKey, 42],
  ]);
  const nestedSet = new Set([1, 'two', new Date('2023-01-01T00:00:00Z')]);
  nestedMap.set('nestedSet', nestedSet);

  const baseSet = new Set([{ label: 'alpha' }]);
  baseSet.add(new Map([['inner', 'value']]));

  return {
    negativeZero: -0,
    regularNumber: 99,
    booleanTrue: true,
    undefinedValue: undefined,
    text: 'hello world',
    big: 12n,
    symbolValue: symbolKey,
    helperFn,
    array: [1, undefined, -0, { inner: 'value' }],
    date: new Date('2021-04-05T00:00:00Z'),
    invalidDate: new Date('invalid'),
    regex: /test/gi,
    map: nestedMap,
    readOnlySet: baseSet,
    nested: { deeper: { arr: [1, 2, 3] } },
  };
}

function buildComplexVisual() {
  return {
    palette: ['crimson', 'cobalt'],
    frames: new Set([{ frame: 1 }]),
    metadata: new Map([
      ['exposure', { level: 3 }],
      ['timestamp', new Date('2022-06-01T12:00:00Z')],
    ]),
    emphasis: /visual/gi,
  };
}

describe('ActionIndexingService serialization and logging integration', () => {
  let logger;
  let indexingService;
  const actorId = 'actor-complex';

  beforeEach(() => {
    logger = new RecordingLogger();
    indexingService = new ActionIndexingService({ logger });
  });

  it('indexes complex payloads, suppresses duplicates, and freezes structures', () => {
    const trickyParams = createTrickyParams();
    const alternateTargetSet = new Set(['primary', 'secondary']);
    const complexParams = buildComplexParams();
    const complexVisual = buildComplexVisual();

    const discovered = [
      null,
      17,
      { id: '', command: 'missing' },
      { id: 'broken:command', command: 123 },
      {
        id: 'alpha',
        command: 'alpha:cmd',
        params: trickyParams,
        description: 'Alpha ability',
        visual: { palette: new Set(['scarlet']) },
      },
      {
        id: 'alpha',
        command: 'alpha:cmd',
        params: trickyParams,
        description: 'Alpha ability duplicate',
        visual: { palette: new Set(['emerald']) },
      },
      {
        id: 'alpha',
        command: 'alpha:cmd-alt',
        params: {
          variant: 'alt',
          targets: alternateTargetSet,
        },
        description: 'Alpha variant',
        visual: null,
      },
      {
        id: 'beta',
        command: 'beta:cmd',
        params: complexParams,
        description: 'Beta ability',
        visual: complexVisual,
      },
      {
        id: 'gamma',
        command: null,
        params: { empty: true },
        description: 'Gamma ability',
      },
    ];

    const composites = indexingService.indexActions(actorId, discovered);

    expect(composites).toHaveLength(4);
    expect(composites.map((c) => c.actionId)).toEqual([
      'alpha',
      'alpha',
      'beta',
      'gamma',
    ]);

    const invalidLog = logger.warnLogs.find((entry) =>
      entry.message.includes('invalid action entries')
    );
    expect(invalidLog).toBeDefined();
    expect(invalidLog.message).toContain('ignored 4 invalid action entries');

    const suppressedLog = logger.infoLogs.find((entry) =>
      entry.message.includes('suppressed 1 duplicate actions')
    );
    expect(suppressedLog.message).toContain('[Unserializable params]');

    const visualDebugLog = logger.debugLogs.find((entry) =>
      entry.message.includes('actions have visual properties')
    );
    expect(visualDebugLog).toBeDefined();

    const [primaryAlpha, alternateAlpha, betaComposite, gammaComposite] = composites;

    expect(primaryAlpha.commandString).toBe('alpha:cmd');
    expect(alternateAlpha.commandString).toBe('alpha:cmd-alt');
    expect(betaComposite.commandString).toBe('beta:cmd');
    expect(gammaComposite.commandString).toBeNull();

    expect(Object.isFrozen(primaryAlpha)).toBe(true);
    expect(Object.isFrozen(primaryAlpha.params)).toBe(true);
    expect(Object.isFrozen(betaComposite.params)).toBe(true);
    expect(Object.isFrozen(betaComposite.visual)).toBe(true);

    expect(() => betaComposite.params.readOnlySet.add('new'))
      .toThrow('Cannot modify frozen set');
    expect(() => betaComposite.params.map.set('other', 5)).toThrow(
      'Cannot modify frozen map'
    );
    expect(() => alternateAlpha.params.targets.clear()).toThrow(
      'Cannot modify frozen set'
    );

    expect(betaComposite.params.date).not.toBe(complexParams.date);
    expect(betaComposite.params.date.getTime()).toBe(
      complexParams.date.getTime()
    );
    expect(Number.isNaN(betaComposite.params.invalidDate.getTime())).toBe(true);
    expect(betaComposite.params.regex).not.toBe(complexParams.regex);
    expect(betaComposite.params.map).not.toBe(complexParams.map);
    expect(betaComposite.params.readOnlySet).not.toBe(complexParams.readOnlySet);

    const framesSet = betaComposite.visual.frames;
    expect(() => framesSet.add({ frame: 2 })).toThrow('Cannot modify frozen set');
    const metadataMap = betaComposite.visual.metadata;
    expect(() => metadataMap.delete('exposure')).toThrow(
      'Cannot modify frozen map'
    );

    expect(typeof betaComposite.params.helperFn).toBe('function');
    expect(betaComposite.params.symbolValue.description).toBe('sigil');
    expect(betaComposite.params.big).toBe(12n);
    expect(Object.isFrozen(betaComposite.params.array)).toBe(true);
    expect(Object.isFrozen(betaComposite.params.nested.deeper)).toBe(true);

    const reused = indexingService.indexActions(actorId, []);
    expect(reused).toHaveLength(4);
    expect(logger.debugLogs.some((entry) => entry.message.includes('reused cached actions'))).toBe(true);

    indexingService.beginTurn(actorId);
    expect(() => indexingService.getIndexedList(actorId)).toThrow();

    const overflow = Array.from({ length: MAX_AVAILABLE_ACTIONS_PER_TURN }, (_, index) => ({
      id: `overflow:${index}`,
      command: `overflow:${index}`,
    }));
    const overflowComposites = indexingService.indexActions(actorId, overflow);
    expect(overflowComposites).toHaveLength(MAX_AVAILABLE_ACTIONS_PER_TURN);
  });
});
