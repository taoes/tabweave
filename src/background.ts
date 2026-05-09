import { getPreferences, getRules } from './lib/storage'
import { applyRuleToTab, applyRulesToTabs, queryTargetWindowTabs } from './lib/grouping'

async function regroupCurrentWindow() {
  const rules = await getRules()
  const tabs = await queryTargetWindowTabs()
  return applyRulesToTabs(rules, tabs)
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
  for (const rule of rules) {
    const applied = await applyRuleToTab(rule, tab)
    if (applied) break
  }
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'regroup-current-window') return
  void regroupCurrentWindow()
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
