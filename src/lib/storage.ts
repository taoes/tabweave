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

function normalizeRule(rule: AutoGroupRule): AutoGroupRule {
  const migratedRule =
    rule.id === 'chrome-management-default'
      ? {
          ...rule,
          name: 'Chrome 与扩展页面',
          target: 'url' as const,
          mode: 'regex' as const,
          pattern: '^chrome-extension://|^chrome://(?!newtab/?$)',
          groupTitle: rule.groupTitle || 'Chrome',
          color: rule.color || 'blue',
          updatedAt: Date.now(),
        }
      : rule.id === 'video-default'
        ? {
            ...rule,
            name: rule.name || '视频与流媒体',
            target: 'domain' as const,
            mode: 'regex' as const,
            pattern: '(youtube\\.com|youtu\\.be|netflix\\.com|vimeo\\.com|twitch\\.tv)\n(bilibili\\.com|douyin\\.com|kuaishou\\.com|iqiyi\\.com|youku\\.com)',
            conditions: [
              {
                id: 'video-global-condition',
                target: 'domain' as const,
                mode: 'regex' as const,
                pattern: '(youtube\\.com|youtu\\.be|netflix\\.com|vimeo\\.com|twitch\\.tv)',
              },
              {
                id: 'video-cn-condition',
                target: 'domain' as const,
                mode: 'regex' as const,
                pattern: '(bilibili\\.com|douyin\\.com|kuaishou\\.com|iqiyi\\.com|youku\\.com)',
              },
            ],
            groupTitle: rule.groupTitle || 'Video',
            color: rule.color || 'red',
            updatedAt: Date.now(),
          }
        : rule

  if (Array.isArray(migratedRule.conditions) && migratedRule.conditions.length > 0) return migratedRule
  return {
    ...migratedRule,
    conditions: [
      {
        id: `${migratedRule.id}-condition-1`,
        target: migratedRule.target,
        mode: migratedRule.mode,
        pattern: migratedRule.pattern,
      },
    ],
  }
}

function mergeDefaultRules(rules: AutoGroupRule[]): AutoGroupRule[] {
  const existingIds = new Set(rules.map((rule) => rule.id))
  const migrated = rules.map(normalizeRule)
  const additions = DEFAULT_RULES.filter((rule) => !existingIds.has(rule.id)).map(normalizeRule)
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
