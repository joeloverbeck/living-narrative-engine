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
        targetDefinitions: { [ALL_MULTI_TARGET_ROLES[2]]: {} },
      })
    ).toBe(true);

    expect(isLegacyTargetPayload(null)).toBe(false);
    expect(isMultiTargetPayload(null)).toBe(false);
  });
});
