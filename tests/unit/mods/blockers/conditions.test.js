import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Blockers Conditions', () => {
  describe('Target Is Corroded Condition', () => {
    let condition;

    beforeEach(() => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/blockers/conditions/target-is-corroded.condition.json'
      );
      const conditionContent = fs.readFileSync(conditionPath, 'utf8');
      condition = JSON.parse(conditionContent);
    });

    it('should have correct ID', () => {
      expect(condition.id).toBe('blockers:target-is-corroded');
    });

    it('should have valid logic', () => {
      expect(condition.logic).toBeDefined();
      const logicStr = JSON.stringify(condition.logic);
      expect(logicStr).toContain('target.components.blockers:corroded');
    });
  });
});
