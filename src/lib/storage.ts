import { DEFAULT_PREFERENCES, DEFAULT_RULES, STORAGE_KEYS } from './constants'
import type { AutoGroupRule, Preferences } from './types'

const hasChromeStorage = () => typeof chrome !== 'undefined' && Boolean(chrome.storage)

const localFallback = new Map<string, unknown>()

async function getArea(sync = true) {
  return sync ? chrome.storage.sync : chrome.storage.local
}

export async function getPreferences(): Promise<Preferences> {
  if (!hasChromeStorage()) return DEFAULT_PREFERENCES
  const result = await chrome.storage.sync.get(STORAGE_KEYS.preferences)
  return { ...DEFAULT_PREFERENCES, ...(result[STORAGE_KEYS.preferences] ?? {}) }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  if (!hasChromeStorage()) {
    localFallback.set(STORAGE_KEYS.preferences, preferences)
    return
  }
  await chrome.storage.sync.set({ [STORAGE_KEYS.preferences]: preferences })
}

function mergeDefaultRules(rules: AutoGroupRule[]): AutoGroupRule[] {
  const existingIds = new Set(rules.map((rule) => rule.id))
  const migrated = rules.map((rule) =>
    rule.id === 'chrome-management-default'
      ? {
          ...rule,
          name: 'Chrome 与扩展页面',
          target: 'url' as const,
          mode: 'regex' as const,
          pattern: '^chrome(-extension)?://',
          groupTitle: rule.groupTitle || 'Chrome',
          color: rule.color || 'blue',
          updatedAt: Date.now(),
        }
      : rule,
  )

  const additions = DEFAULT_RULES.filter((rule) => !existingIds.has(rule.id))
  return additions.length > 0 ? [...additions, ...migrated] : migrated
}

export async function getRules(): Promise<AutoGroupRule[]> {
  if (!hasChromeStorage()) return mergeDefaultRules((localFallback.get(STORAGE_KEYS.rules) as AutoGroupRule[]) ?? DEFAULT_RULES)
  const preferences = await getPreferences()
  const primary = await (await getArea(preferences.syncRules)).get(STORAGE_KEYS.rules)
  const rules = primary[STORAGE_KEYS.rules]
  if (Array.isArray(rules)) {
    const merged = mergeDefaultRules(rules)
    if (merged.length !== rules.length || JSON.stringify(merged) !== JSON.stringify(rules)) {
      await saveRules(merged)
    }
    return merged
  }
  await saveRules(DEFAULT_RULES)
  return DEFAULT_RULES
}

export async function saveRules(rules: AutoGroupRule[]): Promise<void> {
  if (!hasChromeStorage()) {
    localFallback.set(STORAGE_KEYS.rules, rules)
    return
  }
  const preferences = await getPreferences()
  await (await getArea(preferences.syncRules)).set({ [STORAGE_KEYS.rules]: rules })
}

export async function resetRules(): Promise<AutoGroupRule[]> {
  await saveRules(DEFAULT_RULES)
  return DEFAULT_RULES
}
