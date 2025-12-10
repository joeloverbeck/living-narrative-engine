import { describe, it, expect } from '@jest/globals';
import { deriveBaseRuleIdFromFilename } from '../../../../src/utils/ruleIdUtils.js';
import putOnNearbySurfaceRule from '../../../../data/mods/item-placement/rules/handle_put_on_nearby_surface.rule.json' assert { type: 'json' };
import takeFromNearbySurfaceRule from '../../../../data/mods/item-placement/rules/handle_take_from_nearby_surface.rule.json' assert { type: 'json' };

const modId = 'item-placement';

describe('item-placement rule IDs remain unprefixed in source data', () => {
  const cases = [
    {
      filename: 'handle_put_on_nearby_surface.rule.json',
      rule: putOnNearbySurfaceRule,
    },
    {
      filename: 'handle_take_from_nearby_surface.rule.json',
      rule: takeFromNearbySurfaceRule,
    },
  ];

  cases.forEach(({ filename, rule }) => {
    it(`uses an unprefixed rule_id in ${filename}`, () => {
      const baseRuleId = deriveBaseRuleIdFromFilename(filename);

      expect(rule.rule_id).toBe(baseRuleId);
      expect(rule.rule_id.startsWith(`${modId}:`)).toBe(false);
    });
  });
});
