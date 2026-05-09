import type { AutoGroupRule, GroupSnapshot, TabSnapshot, WindowSnapshot } from './types'

export const UNGROUPED_ID = typeof chrome !== 'undefined' && chrome.tabGroups ? chrome.tabGroups.TAB_GROUP_ID_NONE : -1

export function getDomain(url = ''): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function testPattern(value: string, pattern: string, mode: AutoGroupRule['mode']): boolean {
  if (!pattern.trim()) return false
  if (mode === 'equals') return value.toLowerCase() === pattern.toLowerCase()
  if (mode === 'contains') return value.toLowerCase().includes(pattern.toLowerCase())
  try {
    return new RegExp(pattern, 'i').test(value)
  } catch {
    return false
  }
}

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export function matchRule(rule: AutoGroupRule, tab: chrome.tabs.Tab): boolean {
  if (!rule.enabled) return false
  const value = rule.target === 'domain' ? getDomain(tab.url) : rule.target === 'title' ? tab.title ?? '' : tab.url ?? ''
  return testPattern(value, rule.pattern, rule.mode)
}

async function findExistingGroup(windowId: number, title: string) {
  const groups = await chrome.tabGroups.query({ windowId })
  return groups.find((group) => group.title === title)
}

export async function applyRuleToTab(rule: AutoGroupRule, tab: chrome.tabs.Tab): Promise<boolean> {
  if (!tab.id) return false
  if (!matchRule(rule, tab)) return false

  const groupWindowId = tab.windowId
  const existing = await findExistingGroup(groupWindowId, rule.groupTitle)
  const groupId = await chrome.tabs.group({ tabIds: [tab.id], groupId: existing?.id })
  await chrome.tabGroups.update(groupId, {
    title: rule.groupTitle,
    color: rule.color,
    collapsed: false,
  })
  return true
}

export async function applyRulesToTabs(rules: AutoGroupRule[], tabs: chrome.tabs.Tab[]): Promise<number> {
  let changed = 0
  const enabledRules = rules.filter((rule) => rule.enabled)
  for (const tab of tabs) {
    for (const rule of enabledRules) {
      if (rule.scope === 'currentWindow' && tabs[0]?.windowId !== tab.windowId) continue
      const applied = await applyRuleToTab(rule, tab)
      if (applied) {
        changed += 1
        break
      }
    }
  }
  return changed
}

export async function getTargetWindowId(): Promise<number | undefined> {
  try {
    const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ['normal'] })
    if (typeof lastFocused.id === 'number') return lastFocused.id
  } catch {
    // Ignore and fallback below.
  }

  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
  return windows.find((window) => typeof window.id === 'number')?.id
}

export async function queryTargetWindowTabs(): Promise<chrome.tabs.Tab[]> {
  const windowId = await getTargetWindowId()
  if (typeof windowId === 'number') return chrome.tabs.query({ windowId })
  return chrome.tabs.query({ currentWindow: true })
}

export async function regroupCurrentWindow(rules: AutoGroupRule[]): Promise<number> {
  const tabs = await queryTargetWindowTabs()
  return applyRulesToTabs(rules, tabs)
}

export async function getCurrentWindowSnapshot(): Promise<WindowSnapshot> {
  const windowId = await getTargetWindowId()
  const [tabs, groups] = await Promise.all([
    typeof windowId === 'number' ? chrome.tabs.query({ windowId }) : chrome.tabs.query({ currentWindow: true }),
    typeof windowId === 'number' ? chrome.tabGroups.query({ windowId }) : chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
  ])

  const tabSnapshots: TabSnapshot[] = tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
    .map((tab) => ({
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl,
      groupId: tab.groupId ?? UNGROUPED_ID,
      active: Boolean(tab.active),
    }))

  const grouped: GroupSnapshot[] = groups.map((group) => ({
    id: group.id,
    title: group.title || '未命名分组',
    color: group.color,
    collapsed: Boolean(group.collapsed),
    tabs: tabSnapshots.filter((tab) => tab.groupId === group.id),
  }))

  return {
    groups: grouped,
    ungroupedTabs: tabSnapshots.filter((tab) => tab.groupId === UNGROUPED_ID),
  }
}

export async function createGroupFromTabs(tabIds: number[], title: string, color: chrome.tabGroups.TabGroup['color']): Promise<void> {
  if (tabIds.length === 0) return
  const normalizedTabIds = tabIds as [number, ...number[]]
  const groupId = await chrome.tabs.group({ tabIds: normalizedTabIds })
  await chrome.tabGroups.update(groupId, { title, color })
}

export async function sortCurrentWindowGroupsByRuleOrder(rules: AutoGroupRule[]): Promise<number> {
  const windowId = await getTargetWindowId()
  if (typeof windowId !== 'number') return 0

  const groups = await chrome.tabGroups.query({ windowId })
  const orderByTitle = new Map<string, number>()
  rules.forEach((rule, index) => {
    if (!orderByTitle.has(rule.groupTitle)) orderByTitle.set(rule.groupTitle, index)
  })

  const sortableGroups = groups
    .map((group, originalIndex) => ({
      group,
      originalIndex,
      order: orderByTitle.get(group.title ?? '') ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.order - b.order || a.originalIndex - b.originalIndex)

  let moved = 0
  for (const [index, item] of sortableGroups.entries()) {
    if (!Number.isFinite(item.order)) continue
    await chrome.tabGroups.move(item.group.id, { index, windowId })
    moved += 1
  }

  return moved
}
