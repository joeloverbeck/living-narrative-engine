import { describe, it, expect } from '@jest/globals';
import fs from 'fs';

/**
 * Ensures that actorTurnHandler.js defines the ActorTurnHandler class.
 */
describe('actorTurnHandler file', () => {
  it('defines the ActorTurnHandler class', () => {
    const contents = fs.readFileSync(
      'src/turns/handlers/actorTurnHandler.js',
      'utf8'
    );
    expect(contents).toMatch(/class ActorTurnHandler/);
  });
});
