# TabWeave

TabWeave 是一个 Chrome Tab 分组管理扩展：支持查看和管理当前窗口分组，并通过域名、URL、标题与正则规则自动把标签页整理到对应分组。

## 技术栈

- Vite
- React
- TypeScript
- Tailwind CSS
- Chrome Extension Manifest V3

## 功能

- Popup：查看当前窗口 Tab Groups、折叠/展开、关闭分组、手动把未分组标签创建为新分组
- Options：管理自动分组规则，支持新增、复制、删除、启停、颜色与作用范围
- 匹配方式：包含、等于、正则
- 匹配字段：域名、URL、标题
- 自动触发：新标签创建、URL 加载完成
- 规则导入 / 导出
- 规则测试器
- 偏好设置：是否自动整理、是否使用 Chrome 同步存储

## 开发

```bash
npm install
npm run dev
```

开发服务器用于调试 React 页面。Chrome 扩展能力需要构建后加载 `dist`。

## 构建并加载到 Chrome

```bash
npm run build
```

然后：

1. 打开 Chrome `chrome://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目的 `dist` 目录

## 项目结构

```text
src/
  background.ts        # MV3 service worker，监听标签页事件并执行自动分组
  popup.tsx            # 扩展 Popup UI
  options.tsx          # 设置页 / 规则管理 UI
  components/ui.tsx    # 基础 UI 组件
  lib/
    constants.ts       # 默认规则、颜色、存储键
    grouping.ts        # 匹配、分组、窗口快照逻辑
    storage.ts         # chrome.storage 封装
    types.ts           # 类型定义
public/
  manifest.json        # Chrome Extension Manifest V3
```

## 规则说明

规则按列表顺序执行。标签页匹配到第一条启用规则后，会被移动到该规则指定的分组。如果当前窗口中已有同名分组，TabWeave 会复用它。

默认规则会把 `chrome://settings/`、`chrome://extensions/` 和扩展的 `options.html` 汇总到 `Chrome` 分组。
