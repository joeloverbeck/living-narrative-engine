import { describe, it, expect } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../src/turns/states/awaitingActorDecisionState.js';
import { TurnContext } from '../../../src/turns/context/turnContext.js';
import { ACTION_DECIDED_ID } from '../../../src/constants/eventIds.js';
import {
  determineActorType,
  determineSpecificPlayerType,
} from '../../../src/utils/actorTypeUtils.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';

class RecordingLogger {
  constructor() {
    this.records = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(message, context) {
    this.records.debug.push({ message, context });
  }

  info(message, context) {
    this.records.info.push({ message, context });
  }

  warn(message, context) {
    this.records.warn.push({ message, context });
  }

  error(message, context) {
    this.records.error.push({ message, context });
  }
}

class RecordingSafeEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class StaticStrategy {
  constructor(action, extractedData) {
    this._action = action;
    this._extractedData = extractedData;
  }

  async decideAction() {
    return {
      action: this._action,
      extractedData: this._extractedData,
    };
  }
}

class TestTurnHandler {
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this._turnContext = null;
    this.transitions = [];
    this.endedWith = null;
  }

  setTurnContext(ctx) {
    this._turnContext = ctx;
  }

  getTurnContext() {
    return this._turnContext;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }

  resetStateAndResources(reason) {
    this.resetReason = reason;
  }

  async requestIdleStateTransition() {
    this.transitions.push({ type: 'idle' });
  }

  async requestAwaitingInputStateTransition() {
    this.transitions.push({ type: 'awaiting-input' });
  }

  async requestAwaitingExternalTurnEndStateTransition() {
    this.transitions.push({ type: 'awaiting-external' });
  }

  async requestProcessingCommandStateTransition(commandString, action) {
    this.transitions.push({
      type: 'processing',
      commandString,
      action,
    });
  }

  onEndTurn = (error) => {
    this.endedWith = error ?? null;
  };
}

let actorSequence = 0;

/**
 *
 * @param root0
 * @param root0.baseComponents
 * @param root0.overrides
 * @param root0.extraProps
 */
function buildActor({ baseComponents = {}, overrides = {}, extraProps = {} }) {
  const actor = createEntityInstance({
    instanceId: `integration-actor-${++actorSequence}`,
    baseComponents,
    overrides,
  });
  Object.assign(actor, extraProps);
  return actor;
}

/**
 *
 * @param root0
 * @param root0.actor
 * @param root0.extractedData
 */
async function runDecisionWorkflow({ actor, extractedData }) {
  const logger = new RecordingLogger();
  const dispatcher = new RecordingSafeEventDispatcher();
  const handler = new TestTurnHandler(logger, dispatcher);
  const action = {
    actionDefinitionId: 'core:test_action',
    commandString: 'core:test_action',
  };
  const strategy = new StaticStrategy(action, extractedData);
  const turnContext = new TurnContext({
    actor,
    logger,
    services: { safeEventDispatcher: dispatcher },
    strategy,
    onEndTurnCallback: handler.onEndTurn,
    handlerInstance: handler,
  });

  handler.setTurnContext(turnContext);
  const state = new AwaitingActorDecisionState(handler);

  await state.enterState(handler, null);

  return {
    state,
    handler,
    dispatcher,
    logger,
    turnContext,
    action,
  };
}

describe('actorTypeUtils integration through AwaitingActorDecisionState', () => {
  it('emits human actor type when player_type component is human and normalizes extracted data', async () => {
    const actor = buildActor({
      baseComponents: {
        'core:player_type': { type: 'human' },
      },
    });

    const { state, handler, dispatcher, turnContext } =
      await runDecisionWorkflow({
        actor,
        extractedData: {
          thoughts: 'Ready to act',
          notes: null,
        },
      });

    try {
      expect(dispatcher.events).toHaveLength(1);
      const dispatched = dispatcher.events[0];
      expect(dispatched.eventId).toBe(ACTION_DECIDED_ID);
      expect(dispatched.payload.actorId).toBe(actor.id);
      expect(dispatched.payload.actorType).toBe('human');
      expect(dispatched.payload.extractedData).toEqual({
        thoughts: 'Ready to act',
        notes: [],
      });

      expect(turnContext.getDecisionMeta()).toEqual({
        thoughts: 'Ready to act',
        notes: null,
      });
      expect(Object.isFrozen(turnContext.getDecisionMeta())).toBe(true);
      expect(turnContext.getChosenAction()).toEqual({
        actionDefinitionId: 'core:test_action',
        commandString: 'core:test_action',
      });
      expect(
        handler.transitions.some(
          (transition) =>
            transition.type === 'processing' &&
            transition.commandString === 'core:test_action'
        )
      ).toBe(true);

      expect(determineSpecificPlayerType(actor)).toBe('human');
    } finally {
      await state.destroy(handler);
    }
  });

  it('maps non-human player_type to ai, preserves notes, and returns specific type', async () => {
    const actor = buildActor({
      baseComponents: {
        'core:player_type': { type: 'llm' },
        ai: { type: 'GOAP' },
      },
    });

    const { state, handler, dispatcher, turnContext } =
      await runDecisionWorkflow({
        actor,
        extractedData: {
          notes: [{ text: 'remember the objective' }],
        },
      });

    try {
      const dispatched = dispatcher.events[0];
      expect(dispatched.payload.actorType).toBe('ai');
      expect(dispatched.payload.extractedData).toEqual({
        thoughts: '',
        notes: [{ text: 'remember the objective' }],
      });
      expect(determineSpecificPlayerType(actor)).toBe('llm');
      expect(turnContext.getDecisionMeta()).toEqual({
        notes: [{ text: 'remember the objective' }],
      });
    } finally {
      await state.destroy(handler);
    }
  });

  it('falls back to ai component when player_type is absent for specific type detection', async () => {
    const actor = buildActor({
      baseComponents: {
        ai: { type: 'GOAP' },
      },
    });

    const { state, handler, dispatcher } = await runDecisionWorkflow({
      actor,
      extractedData: {},
    });

    try {
      const dispatched = dispatcher.events[0];
      expect(determineActorType(actor)).toBe('human');
      expect(dispatched.payload.actorType).toBe('human');
      expect(determineSpecificPlayerType(actor)).toBe('goap');
    } finally {
      await state.destroy(handler);
    }
  });

  it('falls back to core:player component for actor type when no player_type is present', async () => {
    const actor = buildActor({
      baseComponents: {
        'core:player': { role: 'primary' },
      },
    });

    const { state, handler, dispatcher } = await runDecisionWorkflow({
      actor,
      extractedData: {},
    });

    try {
      const dispatched = dispatcher.events[0];
      expect(dispatched.payload.actorType).toBe('human');
      expect(determineSpecificPlayerType(actor)).toBe('human');
    } finally {
      await state.destroy(handler);
    }
  });

  it('supports actors provided as plain component maps without entity helpers', async () => {
    const plainHumanActor = {
      id: 'plain-human',
      components: {
        'core:player_type': { type: 'human' },
      },
    };

    const humanRun = await runDecisionWorkflow({
      actor: plainHumanActor,
      extractedData: {},
    });

    try {
      const dispatched = humanRun.dispatcher.events[0];
      expect(dispatched.payload.actorType).toBe('human');
      expect(determineSpecificPlayerType(plainHumanActor)).toBe('human');
    } finally {
      await humanRun.state.destroy(humanRun.handler);
    }

    const plainAiActor = {
      id: 'plain-ai',
      components: {
        ai: { type: 'GOAP' },
      },
    };

    const aiRun = await runDecisionWorkflow({
      actor: plainAiActor,
      extractedData: {},
    });

    try {
      expect(determineActorType(plainAiActor)).toBe('human');
      expect(determineSpecificPlayerType(plainAiActor)).toBe('goap');
    } finally {
      await aiRun.state.destroy(aiRun.handler);
    }

    const plainLegacyActor = {
      id: 'plain-legacy',
      components: {
        'core:player': { role: 'secondary' },
      },
    };

    const legacyRun = await runDecisionWorkflow({
      actor: plainLegacyActor,
      extractedData: {},
    });

    try {
      expect(legacyRun.dispatcher.events[0].payload.actorType).toBe('human');
      expect(determineSpecificPlayerType(plainLegacyActor)).toBe('human');
    } finally {
      await legacyRun.state.destroy(legacyRun.handler);
    }

    const plainUnknownActor = {
      id: 'plain-unknown',
      components: {
        unrelated: {},
      },
    };

    const unknownRun = await runDecisionWorkflow({
      actor: plainUnknownActor,
      extractedData: {},
    });

    try {
      expect(determineSpecificPlayerType(plainUnknownActor)).toBe('human');
    } finally {
      await unknownRun.state.destroy(unknownRun.handler);
    }
  });

  it('uses legacy isAi flag and defaults to human when no indicators exist', async () => {
    const aiActor = buildActor({
      baseComponents: {},
      extraProps: { isAi: true },
    });
    const humanActor = buildActor({ baseComponents: {} });

    const aiRun = await runDecisionWorkflow({
      actor: aiActor,
      extractedData: {},
    });
    const humanRun = await runDecisionWorkflow({
      actor: humanActor,
      extractedData: {},
    });

    try {
      expect(aiRun.dispatcher.events[0].payload.actorType).toBe('ai');
      expect(determineSpecificPlayerType(aiActor)).toBe('llm');
      expect(humanRun.dispatcher.events[0].payload.actorType).toBe('human');
      expect(determineSpecificPlayerType(humanActor)).toBe('human');
    } finally {
      await aiRun.state.destroy(aiRun.handler);
      await humanRun.state.destroy(humanRun.handler);
    }
  });
});
