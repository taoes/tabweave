import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { COLOR_CLASS, GROUP_COLORS } from './lib/constants'
import { getPreferences, getRules, resetRules, savePreferences, saveRules } from './lib/storage'
import { applyTheme } from './lib/theme'
import { formatShortcut, isMacPlatform } from './lib/shortcuts'
import { getDomain, isValidRegex, sortCurrentWindowGroupsByRuleOrder, testPattern } from './lib/grouping'
import type { AutoGroupRule, MatchMode, MatchTarget, Preferences, RuleScope, ThemeMode } from './lib/types'
import { AnchorSelect, DangerButton, FieldLabel, GhostButton, PrimaryButton, Switch, TextArea, TextInput } from './components/ui'

const now = () => Date.now()

const HEADER_ACTION_CLASS = 'inline-flex h-9 appearance-none items-center justify-center rounded-xl bg-zinc-900/70 px-3 font-sans text-sm font-medium leading-none text-zinc-200 antialiased ring-1 ring-white/10 transition hover:bg-zinc-800 active:scale-[.98]'

const TARGET_OPTIONS: { value: MatchTarget; label: string; description: string }[] = [
  { value: 'domain', label: '域名', description: '只匹配 hostname' },
  { value: 'url', label: 'URL', description: '匹配完整地址' },
  { value: 'title', label: '标题', description: '匹配页面标题' },
]

const MODE_OPTIONS: { value: MatchMode; label: string; description: string }[] = [
  { value: 'contains', label: '包含', description: '忽略大小写包含' },
  { value: 'equals', label: '等于', description: '完整相等' },
  { value: 'regex', label: '正则', description: 'RegExp / i' },
]

const SCOPE_OPTIONS: { value: RuleScope; label: string; description: string }[] = [
  { value: 'currentWindow', label: '当前窗口', description: '只整理当前窗口' },
  { value: 'allWindows', label: '所有窗口', description: '预留跨窗口规则' },
]


const THEME_ICON_OPTIONS: { value: ThemeMode; label: string; title: string }[] = [
  { value: 'dark', label: '深色', title: '深色主题' },
  { value: 'light', label: '浅色', title: '浅色主题' },
  { value: 'system', label: '系统', title: '跟随系统' },
]


function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 0.9a.7.7 0 0 1 .7.7v1a.7.7 0 1 1-1.4 0v-1A.7.7 0 0 1 8 .9ZM8 12.7a.7.7 0 0 1 .7.7v1a.7.7 0 1 1-1.4 0v-1a.7.7 0 0 1 .7-.7ZM15.1 8a.7.7 0 0 1-.7.7h-1a.7.7 0 1 1 0-1.4h1a.7.7 0 0 1 .7.7ZM3.3 8a.7.7 0 0 1-.7.7h-1a.7.7 0 1 1 0-1.4h1a.7.7 0 0 1 .7.7ZM13.02 2.98a.7.7 0 0 1 0 .99l-.7.7a.7.7 0 1 1-.99-.99l.7-.7a.7.7 0 0 1 .99 0ZM4.67 11.33a.7.7 0 0 1 0 .99l-.7.7a.7.7 0 1 1-.99-.99l.7-.7a.7.7 0 0 1 .99 0ZM13.02 13.02a.7.7 0 0 1-.99 0l-.7-.7a.7.7 0 1 1 .99-.99l.7.7a.7.7 0 0 1 0 .99ZM4.67 4.67a.7.7 0 0 1-.99 0l-.7-.7a.7.7 0 1 1 .99-.99l.7.7a.7.7 0 0 1 0 .99Z" />
      </svg>
    )
  }

  if (mode === 'system') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="8" rx="1.5" fill="currentColor" opacity="0.22" />
        <path d="M4 11h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M6.5 14h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 11v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 3v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
        <path d="M3.5 5.2A1.2 1.2 0 0 1 4.7 4h2.6v6H4.7a1.2 1.2 0 0 1-1.2-1.2V5.2Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.42 10.15A6.35 6.35 0 0 1 5.85 2.58a.55.55 0 0 0-.68-.67A6.55 6.55 0 1 0 14.1 10.83a.55.55 0 0 0-.68-.68Z" />
    </svg>
  )
}

function createRule(): AutoGroupRule {
  return {
    id: crypto.randomUUID(),
    name: '新规则',
    enabled: true,
    target: 'domain',
    mode: 'contains',
    pattern: 'example.com',
    groupTitle: 'Research',
    color: 'blue',
    scope: 'currentWindow',
    createdAt: now(),
    updatedAt: now(),
  }
}

export function Options() {
  const [rules, setRules] = useState<AutoGroupRule[]>([])
  const [preferences, setPreferences] = useState<Preferences>({ autoGroupOnCreate: true, autoGroupOnUpdate: true, syncRules: true, autoGroupOnPopupOpen: false, themeMode: 'dark' })
  const [selectedId, setSelectedId] = useState<string>('')
  const [sample, setSample] = useState('https://github.com/openai/codex — GitHub repository documentation')
  const [status, setStatus] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null)
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'reset' }
    | { type: 'delete'; rule: AutoGroupRule }
    | null
  >(null)

  const selectedRule = useMemo(() => rules.find((rule) => rule.id === selectedId) ?? rules[0], [rules, selectedId])

  useEffect(() => {
    void (async () => {
      const [loadedRules, loadedPreferences] = await Promise.all([getRules(), getPreferences()])
      applyTheme(loadedPreferences.themeMode)
      setRules(loadedRules)
      setPreferences(loadedPreferences)
      setSelectedId(loadedRules[0]?.id ?? '')
    })()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = () => {
      if (preferences.themeMode === 'system') applyTheme('system')
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [preferences.themeMode])

  async function persist(nextRules: AutoGroupRule[]) {
    setRules(nextRules)
    await saveRules(nextRules)
    setStatus('已保存规则')
  }

  async function updateRule(id: string, patch: Partial<AutoGroupRule>) {
    const next = rules.map((rule) => (rule.id === id ? { ...rule, ...patch, updatedAt: now() } : rule))
    await persist(next)
  }

  async function addRule() {
    const rule = createRule()
    const next = [rule, ...rules]
    setSelectedId(rule.id)
    await persist(next)
  }

  async function duplicateRule(rule: AutoGroupRule) {
    const copy: AutoGroupRule = { ...rule, id: crypto.randomUUID(), name: `${rule.name} 副本`, createdAt: now(), updatedAt: now() }
    setSelectedId(copy.id)
    await persist([copy, ...rules])
  }

  async function removeRule(id: string) {
    const next = rules.filter((rule) => rule.id !== id)
    setSelectedId(next[0]?.id ?? '')
    await persist(next)
  }

  async function reorderRule(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    const sourceIndex = rules.findIndex((rule) => rule.id === sourceId)
    const targetIndex = rules.findIndex((rule) => rule.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...rules]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    await persist(next)
    const movedGroups = await sortCurrentWindowGroupsByRuleOrder(next)
    setStatus(movedGroups > 0 ? '已更新规则顺序，并同步排序当前窗口分组' : '已更新规则顺序')
  }

  async function updatePreferences(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    if (patch.themeMode) applyTheme(patch.themeMode)
    await savePreferences(next)
    if (typeof patch.syncRules === 'boolean') {
      await saveRules(rules)
    }
  }

  async function restoreDefaults() {
    const restored = await resetRules()
    setRules(restored)
    setSelectedId(restored[0]?.id ?? '')
    setStatus('已恢复默认规则')
  }

  async function confirmDangerAction() {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    if (action.type === 'reset') {
      await restoreDefaults()
      return
    }
    await removeRule(action.rule.id)
  }

  async function regroupNow() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return
    const response = await chrome.runtime.sendMessage({ type: 'TABWEAVE_REGROUP' })
    setStatus(response?.ok ? `当前窗口已整理 ${response.changed} 个标签页` : '整理失败')
  }

  async function openShortcutSettings() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
      return
    }
    window.open('chrome://extensions/shortcuts', '_blank')
  }

  function exportRules() {
    const blob = new Blob([JSON.stringify({ rules, preferences }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tabweave-rules.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importRules(value: string) {
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed.rules)) throw new Error('Invalid file')
      await persist(parsed.rules)
      if (parsed.preferences) await updatePreferences(parsed.preferences)
      setSelectedId(parsed.rules[0]?.id ?? '')
      setStatus('导入成功')
    } catch {
      setStatus('导入失败：文件格式不正确')
    }
  }

  const sampleValue = selectedRule?.target === 'domain' ? getDomain(sample.split(' ')[0]) : selectedRule?.target === 'url' ? sample.split(' ')[0] : sample
  const sampleMatched = selectedRule ? testPattern(sampleValue, selectedRule.pattern, selectedRule.mode) : false
  const regexInvalid = selectedRule?.mode === 'regex' && !isValidRegex(selectedRule.pattern)
  const openPopupShortcutLabel = formatShortcut(isMacPlatform() ? 'Command+Shift+Y' : 'Ctrl+Shift+Y')
  const regroupShortcutLabel = formatShortcut(isMacPlatform() ? 'Alt+Shift+G' : 'Ctrl+Shift+G')

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.14),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,.2),transparent_30%),#09090b] text-zinc-100">
      <header className="shrink-0 border-b border-white/10 px-8 py-6">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-300">TabWeave</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em]">规则驱动的标签分组</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">用域名、标题、URL 与正则规则，把新打开或已存在的标签页自动编织进合适的 Chrome 分组。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-xl bg-zinc-900/70 p-1 ring-1 ring-white/10" aria-label="主题切换">
              {THEME_ICON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.title}
                  aria-label={option.title}
                  aria-pressed={preferences.themeMode === option.value}
                  onClick={() => updatePreferences({ themeMode: option.value })}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${
                    preferences.themeMode === option.value
                      ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <ThemeIcon mode={option.value} />
                  <span className="sr-only">{option.label}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={exportRules} className={HEADER_ACTION_CLASS}>导出</button>
            <button type="button" onClick={() => importInputRef.current?.click()} className={HEADER_ACTION_CLASS}>导入</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then(importRules)
              }}
            />
            <PrimaryButton onClick={regroupNow} className="h-9">整理当前窗口</PrimaryButton>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-[320px_1fr_340px] items-start gap-6 px-8 py-6">
        <aside className="flex max-h-full min-h-0 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Rules</h2>
              <p className="mt-1 text-[11px] text-zinc-600">拖拽卡片调整匹配优先级</p>
            </div>
            <PrimaryButton onClick={addRule} className="px-2 py-1 text-xs">新增</PrimaryButton>
          </div>
          <div className="soft-scrollbar scroll-mask-y-10 -m-1 flex-1 space-y-2 overflow-auto p-1 pr-2">
            {rules.map((rule) => {
              const isDragging = draggingRuleId === rule.id
              const isDragOver = dragOverRuleId === rule.id && draggingRuleId !== rule.id
              return (
                <button
                  key={rule.id}
                  draggable
                  onClick={() => setSelectedId(rule.id)}
                  onDragStart={(event) => {
                    setDraggingRuleId(rule.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', rule.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverRuleId(rule.id)
                  }}
                  onDragLeave={() => setDragOverRuleId((current) => (current === rule.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceId = event.dataTransfer.getData('text/plain') || draggingRuleId
                    setDraggingRuleId(null)
                    setDragOverRuleId(null)
                    if (sourceId) void reorderRule(sourceId, rule.id)
                  }}
                  onDragEnd={() => {
                    setDraggingRuleId(null)
                    setDragOverRuleId(null)
                  }}
                  className={`group relative w-full rounded-2xl p-3 text-left ring-1 transition ${
                    selectedRule?.id === rule.id ? 'bg-white/[0.08] ring-violet-400/40' : 'bg-white/[0.035] ring-white/10 hover:bg-white/[0.06]'
                  } ${isDragging ? 'scale-[.98] opacity-45' : ''} ${isDragOver ? 'translate-y-0.5 ring-violet-300/70' : ''}`}
                  title="拖拽调整规则优先级"
                >
                  {isDragOver && <span className="absolute -top-1 left-3 right-3 h-0.5 rounded-full bg-violet-300" />}
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-4 shrink-0 place-items-center text-zinc-600 transition group-hover:text-zinc-400" aria-hidden="true">
                      <span className="leading-none">⋮⋮</span>
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full ${COLOR_CLASS[rule.color]}`} />
                    <span className="truncate text-sm font-semibold">{rule.name}</span>
                    {!rule.enabled && <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">停用</span>}
                  </div>
                  <div className="mt-2 truncate pl-6 text-xs text-zinc-500">{rule.target} · {rule.mode} · {rule.pattern}</div>
                  <div className="mt-1 pl-6 text-xs text-zinc-600">→ {rule.groupTitle}</div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="soft-scrollbar max-h-full min-h-0 overflow-auto rounded-[28px] bg-zinc-950/70 p-6 ring-1 ring-white/10 backdrop-blur">
          {selectedRule ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.04em]">{selectedRule.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">编辑匹配条件、目标分组与颜色。规则按左侧顺序优先匹配。</p>
                </div>
                <Switch checked={selectedRule.enabled} onChange={(checked) => updateRule(selectedRule.id, { enabled: checked })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>规则名称</FieldLabel>
                  <TextInput value={selectedRule.name} onChange={(e) => updateRule(selectedRule.id, { name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>目标分组</FieldLabel>
                  <TextInput value={selectedRule.groupTitle} onChange={(e) => updateRule(selectedRule.id, { groupTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>匹配字段</FieldLabel>
                  <AnchorSelect value={selectedRule.target} options={TARGET_OPTIONS} onChange={(target) => updateRule(selectedRule.id, { target })} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>匹配方式</FieldLabel>
                  <AnchorSelect value={selectedRule.mode} options={MODE_OPTIONS} onChange={(mode) => updateRule(selectedRule.id, { mode })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <FieldLabel>匹配内容</FieldLabel>
                  <TextInput value={selectedRule.pattern} onChange={(e) => updateRule(selectedRule.id, { pattern: e.target.value })} placeholder="github.com 或 (docs|文档)" />
                  {regexInvalid && <div className="text-xs text-red-300">正则表达式无效，请检查括号、转义和量词。</div>}
                </div>
                <div className="space-y-2">
                  <FieldLabel>颜色</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button key={color} onClick={() => updateRule(selectedRule.id, { color })} className={`h-8 w-8 rounded-full ${COLOR_CLASS[color]} ${selectedRule.color === color ? 'ring-4 ring-white/30' : 'ring-1 ring-white/10'}`} title={color} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>作用范围</FieldLabel>
                  <AnchorSelect value={selectedRule.scope} options={SCOPE_OPTIONS} onChange={(scope) => updateRule(selectedRule.id, { scope })} />
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">正则 / 规则测试</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${sampleMatched && !regexInvalid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                    {sampleMatched && !regexInvalid ? '匹配' : '未匹配'}
                  </span>
                </div>
                <TextArea rows={3} value={sample} onChange={(e) => setSample(e.target.value)} />
                <div className="mt-2 text-xs text-zinc-600">实际测试值：{sampleValue || '空'}</div>
              </div>

              <div className="flex justify-start border-t border-white/10 pt-5">
                <div className="flex gap-2">
                  <GhostButton onClick={() => duplicateRule(selectedRule)}>复制规则</GhostButton>
                  <DangerButton onClick={() => setConfirmAction({ type: 'delete', rule: selectedRule })}>删除规则</DangerButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">创建一条规则开始使用。</div>
          )}
        </section>

        <aside className="soft-scrollbar max-h-full min-h-0 space-y-5 overflow-auto p-1 pr-2">
          <section className="rounded-[24px] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <h2 className="text-sm font-semibold">自动化偏好</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-200">新标签创建后整理</div>
                  <div className="text-xs text-zinc-600">适合打开新网页时即时归组。</div>
                </div>
                <Switch checked={preferences.autoGroupOnCreate} onChange={(checked) => updatePreferences({ autoGroupOnCreate: checked })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-200">URL 加载完成后整理</div>
                  <div className="text-xs text-zinc-600">适合从空白页跳转后的匹配。</div>
                </div>
                <Switch checked={preferences.autoGroupOnUpdate} onChange={(checked) => updatePreferences({ autoGroupOnUpdate: checked })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-200">打开 Popup 时整理</div>
                  <div className="text-xs text-zinc-600">每次唤起面板前先整理当前窗口。</div>
                </div>
                <Switch checked={preferences.autoGroupOnPopupOpen} onChange={(checked) => updatePreferences({ autoGroupOnPopupOpen: checked })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-200">规则跨设备同步</div>
                  <div className="text-xs text-zinc-600">使用 chrome.storage.sync。</div>
                </div>
                <Switch checked={preferences.syncRules} onChange={(checked) => updatePreferences({ syncRules: checked })} />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">规则维护</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-600">恢复默认会替换整套规则，不影响自动化偏好。</p>
              </div>
              <DangerButton onClick={() => setConfirmAction({ type: 'reset' })} className="shrink-0 px-2 py-1 text-xs">恢复默认</DangerButton>
            </div>
          </section>

          <section className="rounded-[24px] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <h2 className="text-sm font-semibold">快捷键</h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-500">
              <div className="flex justify-between gap-3"><span>打开 Popup</span><span className="text-zinc-300">{openPopupShortcutLabel}</span></div>
              <div className="flex justify-between gap-3"><span>立即整理</span><span className="text-zinc-300">{regroupShortcutLabel}</span></div>
              <p className="text-xs leading-5 text-zinc-600">
                如果快捷键显示“未设置”，通常是与 Chrome 内置快捷键冲突；可在{' '}
                <button type="button" onClick={openShortcutSettings} className="font-medium text-violet-300 underline decoration-violet-400/30 underline-offset-4 hover:text-violet-200">
                  chrome://extensions/shortcuts
                </button>{' '}
                修改绑定。
              </p>
            </div>
          </section>

          <section className="rounded-[24px] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <h2 className="text-sm font-semibold">规则策略</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-500">
              {[
                '第一条匹配成功的规则会决定标签所在分组。',
                '如果同名分组已存在，会复用该分组。',
                'Chrome 与扩展页面会按默认规则进入 Chrome 分组。',
                '正则默认忽略大小写。',
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70 ring-4 ring-violet-400/10" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {status && <div className="rounded-2xl bg-violet-500/10 px-4 py-3 text-sm text-violet-200">{status}</div>}
        </aside>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-zinc-950 p-5 text-zinc-100 shadow-2xl shadow-black/50 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-red-400/20">!</div>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  {confirmAction.type === 'reset' ? '恢复默认规则？' : '删除这条规则？'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {confirmAction.type === 'reset'
                    ? '这会替换当前整套规则，但不会影响自动化偏好设置。此操作不能撤销。'
                    : `“${confirmAction.rule.name}” 会从规则列表中移除。此操作不能撤销。`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => setConfirmAction(null)}>取消</GhostButton>
              <DangerButton onClick={confirmDangerAction}>{confirmAction.type === 'reset' ? '恢复默认' : '删除规则'}</DangerButton>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
