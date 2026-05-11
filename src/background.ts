import { getPreferences, getRules } from './lib/storage'
import { applyRulesToTabs, getTargetWindowId, queryTargetWindowTabs, reconcileTabWithRules } from './lib/grouping'

async function regroupCurrentWindow() {
  const rules = await getRules()
  const tabs = await queryTargetWindowTabs()
  return applyRulesToTabs(rules, tabs)
}

async function collapseAllGroups(): Promise<number> {
  const windowId = await getTargetWindowId()
  if (typeof windowId !== 'number') return 0
  const groups = await chrome.tabGroups.query({ windowId })
  let collapsed = 0
  for (const group of groups) {
    if (!group.collapsed) {
      await chrome.tabGroups.update(group.id, { collapsed: true })
      collapsed++
    }
  }
  return collapsed
}

let lastShortcutActionWasOrganize = false

async function toggleOrganizeOrCollapse() {
  if (lastShortcutActionWasOrganize) {
    lastShortcutActionWasOrganize = false
    return collapseAllGroups()
  }
  lastShortcutActionWasOrganize = true
  return regroupCurrentWindow()
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await getRules()
    await getPreferences()
  }
})

chrome.tabs.onCreated.addListener(async (tab) => {
  const preferences = await getPreferences()
  if (!preferences.autoGroupOnCreate) return
  const rules = await getRules()
  await applyRulesToTabs(rules, [tab])
})

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return
  const preferences = await getPreferences()
  if (!preferences.autoGroupOnUpdate) return
  const rules = await getRules()
  await reconcileTabWithRules(rules, tab)
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'regroup-current-window') return
  void toggleOrganizeOrCollapse()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TABWEAVE_REGROUP') {
    void regroupCurrentWindow()
      .then((changed) => sendResponse({ ok: true, changed }))
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      })
    return true
  }

  if (message?.type === 'TABWEAVE_GET_COMMANDS') {
    void chrome.commands
      .getAll()
      .then((commands) => sendResponse({ ok: true, commands }))
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      })
    return true
  }

  return false
})
