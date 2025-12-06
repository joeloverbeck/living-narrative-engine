import { describe, it, expect } from '@jest/globals';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class MemoryLogger {
  constructor() {
    this.entries = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  info(message, ...args) {
    this.entries.info.push({ message, args });
  }

  warn(message, ...args) {
    this.entries.warn.push({ message, args });
  }

  error(message, ...args) {
    this.entries.error.push({ message, args });
  }

  debug(message, ...args) {
    this.entries.debug.push({ message, args });
  }

  getMessages(level) {
    return this.entries[level].map(({ message }) => message);
  }
}

class IncrementingClock {
  constructor(start = 0) {
    this.current = start;
  }

  tick() {
    this.current += 1;
    return this.current;
  }
}

class WorkflowRunner {
  constructor() {
    this.executions = [];
  }

  execute(payload, { clock, logger }) {
    const acceptedAt = clock();
    logger.debug(`runner accepted ${payload.action} at ${acceptedAt}`);

    const completedAt = clock();
    logger.info(`runner finished ${payload.action}`);

    const record = { payload, acceptedAt, completedAt, status: 'ok' };
    this.executions.push(record);
    return { ...record, completedAt };
  }
}

class WorkflowBase {
  constructor({ logger, dependencies }) {
    this._args = { logger, dependencies };
    this._serviceSetup = new ServiceSetup();
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) {
      return this._logger;
    }

    const { logger, dependencies } = this._args;
    this._logger = this._serviceSetup.setupService('Workflow', logger, {
      runner: { value: dependencies.runner, requiredMethods: ['execute'] },
      clock: { value: dependencies.clock, isFunction: true },
    });
    this._runner = dependencies.runner;
    this._clock = dependencies.clock;
    this._initialized = true;
    return this._logger;
  }

  execute(payload) {
    this.initialize();

    this._logger.info(`processing ${payload.action} for ${payload.actor}`);
    const result = this._runner.execute(payload, {
      clock: this._clock,
      logger: this._logger,
    });

    if (result.status === 'ok') {
      this._logger.debug(
        `completed ${payload.action} at ${result.completedAt}`
      );
    } else {
      this._logger.error(`failed ${payload.action}: ${result.reason}`);
    }

    return result;
  }
}

const ValidatedWorkflow = withValidatedDeps(WorkflowBase, (args) => [
  {
    dependency: args?.dependencies?.runner,
    name: 'Workflow dependencies: runner',
    methods: ['execute'],
  },
  {
    dependency: args?.dependencies?.clock,
    name: 'Workflow dependencies: clock',
    isFunction: true,
  },
]);

describe('withValidatedDeps integration', () => {
  it('creates a workflow that coordinates real dependencies with prefixed logging', () => {
    const logger = new MemoryLogger();
    const clock = new IncrementingClock(0);
    const runner = new WorkflowRunner();

    const workflow = new ValidatedWorkflow({
      logger,
      dependencies: {
        runner,
        clock: clock.tick.bind(clock),
      },
    });

    const result = workflow.execute({
      actor: 'hero',
      action: 'gather resources',
    });

    expect(result.status).toBe('ok');
    expect(result.acceptedAt).toBe(1);
    expect(result.completedAt).toBe(2);
    expect(runner.executions).toHaveLength(1);
    expect(runner.executions[0].payload.actor).toBe('hero');

    expect(logger.getMessages('info')).toEqual([
      'Workflow: processing gather resources for hero',
      'Workflow: runner finished gather resources',
    ]);

    expect(logger.getMessages('debug')).toEqual([
      'Workflow: runner accepted gather resources at 1',
      'Workflow: completed gather resources at 2',
    ]);

    expect(logger.getMessages('error')).toEqual([]);
  });

  it('surfaces validation errors when dependencies are incomplete', () => {
    const logger = new MemoryLogger();

    expect(
      () =>
        new ValidatedWorkflow({
          logger,
          dependencies: {
            runner: {},
            clock: () => 42,
          },
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.getMessages('error')).toContain(
      "Invalid or missing method 'execute' on dependency 'Workflow dependencies: runner'."
    );
  });

  it('rejects non-function clocks and records the failure on the provided logger', () => {
    const logger = new MemoryLogger();

    expect(
      () =>
        new ValidatedWorkflow({
          logger,
          dependencies: {
            runner: new WorkflowRunner(),
            clock: 13,
          },
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.getMessages('error')).toContain(
      "Dependency 'Workflow dependencies: clock' must be a function, but got number."
    );
  });
});
