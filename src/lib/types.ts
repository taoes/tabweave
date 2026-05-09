export type MatchTarget = 'url' | 'title' | 'domain'
export type MatchMode = 'contains' | 'regex' | 'equals'
export type RuleScope = 'currentWindow' | 'allWindows'
export type ThemeMode = 'dark' | 'light' | 'system'

export type ChromeGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange'

export interface AutoGroupRule {
  id: string
  name: string
  enabled: boolean
  target: MatchTarget
  mode: MatchMode
  pattern: string
  groupTitle: string
  color: ChromeGroupColor
  scope: RuleScope
  createdAt: number
  updatedAt: number
}

export interface Preferences {
  autoGroupOnCreate: boolean
  autoGroupOnUpdate: boolean
  syncRules: boolean
  autoGroupOnPopupOpen: boolean
  themeMode: ThemeMode
}

export interface ShortcutInfo {
  name: string
  description?: string
  shortcut?: string
}

export interface TabSnapshot {
  id: number
  title: string
  url: string
  favIconUrl?: string
  groupId: number
  active: boolean
}

export interface GroupSnapshot {
  id: number
  title: string
  color: ChromeGroupColor
  collapsed: boolean
  tabs: TabSnapshot[]
}

export interface WindowSnapshot {
  groups: GroupSnapshot[]
  ungroupedTabs: TabSnapshot[]
}
