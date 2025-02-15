import type { FormItemRule } from 'naive-ui'
import isEmail from 'validator/lib/isEmail'

export interface AppFormItemRule extends FormItemRule {
  /**
   * whether the rule schema is for dropdown
   * @default false
   */
  dropdown?: boolean
  /**
   * triggers used for validation
   * @default ['input', 'blur']
   */
  trigger?: string[]
}
export type AppFormRules<T> = {
  [path in keyof T]: AppFormRules<T> | AppFormItemRule | AppFormItemRule[]
}

export function withRuleTriggers<T>(rules: AppFormRules<Partial<T>>): AppFormRules<Partial<T>> {
  const _converted: AppFormRules<T> = Object.keys(rules).reduce((acc, path) => {
    acc = acc as AppFormRules<T>
    const rule = Array.isArray(rules[path]) ? rules[path][0] : rules[path]

    acc[path] = {
      trigger: ['input', 'blur'],
      ...rule,
    }

    if (rule.dropdown === true) {
      acc[path].trigger.push('change')
    }

    return acc
  }, {} as AppFormRules<T>)

  return _converted
}

export function emailValidator(rule, val) {
  return isEmail(val) ? true : new Error('Provide a valid Email')
}
