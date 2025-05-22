// --- FILE START ---
import {jest, describe, beforeEach, it, expect} from '@jest/globals';
import {BaseTurnHandler} from '../../../src/turns/handlers/baseTurnHandler.js';

// Minimal concrete subclass – we never start real turns in this suite.
class TestTurnHandler extends BaseTurnHandler {
    async startTurn() { /* not needed for these tests */
    }
}

const mkLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

describe('BaseTurnHandler._handleTurnEnd', () => {
    let handler;
    let logger;

    beforeEach(() => {
        logger = mkLogger();
        handler = new TestTurnHandler({logger});
    });

    it('returns quietly when called after the handler is destroyed', async () => {
        handler._isDestroyed = true;               // simulate prior destroy()

        await expect(
            handler._handleTurnEnd('actor1', null, /* fromDestroy = */ false),
        ).resolves.toBeUndefined();                // no throw / rejection

        expect(logger.warn)
            .toHaveBeenCalledWith(
                expect.stringContaining('_handleTurnEnd ignored'),
            );
    });

    it('still runs normally when handler is active', async () => {
        handler._isDestroyed = false;

        await expect(
            handler._handleTurnEnd('actor1', null, false),
        ).resolves.toBeUndefined();

        // Should NOT log the “ignored” early-out warning
        expect(logger.warn)
            .not.toHaveBeenCalledWith(expect.stringContaining('_handleTurnEnd ignored'));
    });
});
// --- FILE END ---