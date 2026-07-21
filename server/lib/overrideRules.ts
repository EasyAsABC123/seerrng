import type OverrideRule from '@server/entity/OverrideRule';

export const overrideRuleConditionFields = [
  'users',
  'genre',
  'language',
  'keywords',
] as const satisfies readonly (keyof OverrideRule)[];
export type OverrideRuleConditionField =
  (typeof overrideRuleConditionFields)[number];
const MAX_OVERRIDE_RULE_ROUTING_ID = 1_000_000_000;
const MAX_OVERRIDE_RULE_ROUTING_TAGS = 100;

const hasConditionValue = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

export const getOverrideRuleSpecificity = (
  rule: OverrideRule,
  conditionFields: readonly OverrideRuleConditionField[] = overrideRuleConditionFields
): number =>
  conditionFields.reduce(
    (specificity, field) =>
      specificity + (hasConditionValue(rule[field]) ? 1 : 0),
    0
  );

/**
 * Chooses the most constrained matching rule without mutating the repository
 * result. Rule IDs provide a stable oldest-first tie break for configurations
 * whose conditions are equally specific.
 */
export const selectMostSpecificOverrideRule = (
  rules: OverrideRule[],
  conditionFields: readonly OverrideRuleConditionField[] = overrideRuleConditionFields
): OverrideRule | undefined =>
  [...rules].sort(
    (left, right) =>
      getOverrideRuleSpecificity(right, conditionFields) -
        getOverrideRuleSpecificity(left, conditionFields) ||
      (left.id ?? Number.MAX_SAFE_INTEGER) -
        (right.id ?? Number.MAX_SAFE_INTEGER)
  )[0];

export const overrideRuleMatchesUser = (
  rule: OverrideRule,
  userId: number
): boolean =>
  !hasConditionValue(rule.users) ||
  rule
    .users!.split(',')
    .map((value) => Number(value.trim()))
    .some((configuredUserId) => configuredUserId === userId);

export const getOverrideRuleProfileId = (
  rule: OverrideRule
): number | undefined =>
  Number.isSafeInteger(rule.profileId) &&
  rule.profileId! >= 0 &&
  rule.profileId! <= MAX_OVERRIDE_RULE_ROUTING_ID
    ? rule.profileId
    : undefined;

export const getOverrideRuleTagIds = (rule: OverrideRule): number[] => {
  if (!hasConditionValue(rule.tags)) {
    return [];
  }

  const tagIds = rule
    .tags!.split(',')
    .slice(0, MAX_OVERRIDE_RULE_ROUTING_TAGS)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .filter(
      (value) =>
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= MAX_OVERRIDE_RULE_ROUTING_ID
    );

  return [...new Set(tagIds)];
};
