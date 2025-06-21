// tests/turns/ports/interfaces.test.js
// -----------------------------------------------------------------------------
// Simple tests exercising the minimal interface classes in src/turns/ports.
// Each class exposes a method that is expected to throw when called directly.
// These tests ensure those methods behave as intended so coverage reflects their
// existence.
// -----------------------------------------------------------------------------

import { describe, it, expect } from '@jest/globals';
import { IPromptOutputPort } from '../../../../src/turns/ports/iPromptOutputPort.js';
import { ITurnEndPort } from '../../../../src/turns/ports/iTurnEndPort.js';
import { ICommandInputPort } from '../../../../src/turns/ports/iCommandInputPort.js';
import { IActionIndexer } from '../../../../src/turns/ports/iActionIndexer.js';
import { ILLMChooser } from '../../../../src/turns/ports/iLLMChooser.js';
import { ITurnActionFactory } from '../../../../src/turns/ports/iTurnActionFactory.js';

describe('Turn port interface classes', () => {
  it('IPromptOutputPort.prompt rejects when not implemented', async () => {
    const port = new IPromptOutputPort();
    await expect(port.prompt('id', [], undefined)).rejects.toThrow(
      'IPromptOutputPort.prompt method not implemented.'
    );
  });

  it('ITurnEndPort.notifyTurnEnded rejects when not implemented', async () => {
    const port = new ITurnEndPort();
    await expect(port.notifyTurnEnded('id', true)).rejects.toThrow(
      'ITurnEndPort.notifyTurnEnded() not implemented.'
    );
  });

  it('ICommandInputPort.onCommand rejects when not implemented', () => {
    const port = new ICommandInputPort();
    expect(() => port.onCommand(() => {})).toThrow(
      'ICommandInputPort.onCommand method not implemented.'
    );
  });

  it('IActionIndexer.index rejects when not implemented', () => {
    const indexer = new IActionIndexer();
    expect(() => indexer.index([], 'id')).toThrow('Interface method');
  });

  it('ILLMChooser.choose rejects when not implemented', () => {
    const chooser = new ILLMChooser();
    expect(() =>
      chooser.choose({
        actor: {},
        context: {},
        actions: [],
        abortSignal: new AbortController().signal,
      })
    ).toThrow('Interface method');
  });

  it('ITurnActionFactory.create rejects when not implemented', () => {
    const factory = new ITurnActionFactory();
    expect(() => factory.create({}, null)).toThrow('Interface');
  });
});
