import { describe, it, expect } from '@jest/globals';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';

describe('Scope DSL support for hyphenated identifiers', () => {
  it('parses scope references where the mod id contains hyphens', () => {
    const ast = parseDslExpression(
      'sex-dry-intimacy:actors_with_covered_penis_im_facing_away_from'
    );

    expect(ast).toEqual({
      type: 'ScopeReference',
      scopeId: 'sex-dry-intimacy:actors_with_covered_penis_im_facing_away_from',
    });
  });

  it('parses scope definitions that reference hyphenated mods inside expressions', () => {
    const content = `
      sex-dry-intimacy:actors_with_covered_penis_im_facing_away_from := sex-core:actors_with_penis_in_intimacy[][
        {
          "and": [
            { "condition_ref": "facing-states:entity-in-facing-away" },
            { "isSocketCovered": [".", "penis"] }
          ]
        }
      ]
    `;

    const result = parseScopeDefinitions(
      content,
      'sex-dry-intimacy/scopes/test.scope'
    );

    expect(result.size).toBe(1);
    const scopeDef = result.get(
      'sex-dry-intimacy:actors_with_covered_penis_im_facing_away_from'
    );

    expect(scopeDef).toBeDefined();
    expect(scopeDef.expr).toContain('sex-core:actors_with_penis_in_intimacy');
    expect(scopeDef.ast).toBeDefined();
  });
});
