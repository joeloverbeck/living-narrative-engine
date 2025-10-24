import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
  getPlaceholderForRole,
  getRolesWithRequirements,
  isLegacyTargetPayload,
  isMultiTargetPayload,
  isSupportedRole,
} from '../../../../src/actions/pipeline/TargetRoleRegistry.js';

describe('TargetRoleRegistry', () => {
  it('reports supported roles', () => {
    expect(isSupportedRole(LEGACY_TARGET_ROLE)).toBe(true);
    for (const role of ALL_MULTI_TARGET_ROLES) {
      expect(isSupportedRole(role)).toBe(true);
    }
    expect(isSupportedRole(ACTOR_ROLE)).toBe(true);
    expect(isSupportedRole('unknown-role')).toBe(false);
  });

  it('derives roles from requirements', () => {
    const roles = getRolesWithRequirements({
      [LEGACY_TARGET_ROLE]: ['comp.a'],
      [ALL_MULTI_TARGET_ROLES[0]]: ['comp.b'],
      ignored: ['comp.c'],
    });

    expect(roles).toEqual([LEGACY_TARGET_ROLE, ALL_MULTI_TARGET_ROLES[0]]);
  });

  it('locates placeholders for roles', () => {
    const placeholder = getPlaceholderForRole(ALL_MULTI_TARGET_ROLES[1], {
      [ALL_MULTI_TARGET_ROLES[1]]: { placeholder: 'target.secondary' },
    });

    expect(placeholder).toBe('target.secondary');
    expect(getPlaceholderForRole('missing', {})).toBeUndefined();
    expect(getPlaceholderForRole('missing', null)).toBeUndefined();
    expect(
      getPlaceholderForRole(ALL_MULTI_TARGET_ROLES[0], {
        [ALL_MULTI_TARGET_ROLES[0]]: 'not-an-object',
      })
    ).toBeUndefined();
  });

  it('detects payload shapes', () => {
    expect(
      isLegacyTargetPayload({
        target_entity: { id: 'legacy' },
      })
    ).toBe(true);

    expect(
      isLegacyTargetPayload({
        resolvedTargets: { [LEGACY_TARGET_ROLE]: [{ id: 'legacy' }] },
      })
    ).toBe(true);

    expect(
      isMultiTargetPayload({
        target_entities: { [ALL_MULTI_TARGET_ROLES[0]]: { id: 'multi' } },
      })
    ).toBe(true);

    expect(
      isMultiTargetPayload({
        resolvedTargets: { [ALL_MULTI_TARGET_ROLES[1]]: [{ id: 'multi' }] },
      })
    ).toBe(true);

    expect(
      isMultiTargetPayload({
        targetDefinitions: { [ALL_MULTI_TARGET_ROLES[2]]: {} },
      })
    ).toBe(true);

    expect(isLegacyTargetPayload(null)).toBe(false);
    expect(isMultiTargetPayload(null)).toBe(false);
    expect(isMultiTargetPayload({})).toBe(false);
    expect(
      isLegacyTargetPayload({
        targets: { [LEGACY_TARGET_ROLE]: { id: 'legacy' } },
      })
    ).toBe(true);

    expect(
      isLegacyTargetPayload({
        resolvedTargets: {},
        targets: {},
      })
    ).toBe(false);
  });

  it('handles missing or empty requirements safely', () => {
    expect(getRolesWithRequirements(undefined)).toEqual([]);
    expect(getRolesWithRequirements('invalid')).toEqual([]);
    expect(
      getRolesWithRequirements({
        [LEGACY_TARGET_ROLE]: [],
        [ALL_MULTI_TARGET_ROLES[0]]: null,
        [ALL_MULTI_TARGET_ROLES[1]]: ['comp.c'],
      })
    ).toEqual([ALL_MULTI_TARGET_ROLES[1]]);
  });
});
