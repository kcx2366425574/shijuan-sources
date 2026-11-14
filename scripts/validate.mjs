#!/usr/bin/env node
/**
 * 书源仓库校验。
 * 用法：node scripts/validate.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const warnings = []

function readJson(file) {
  const full = path.resolve(ROOT, file)
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch (e) {
    errors.push(`${file}: 无法读取或 JSON 格式错误：${e.message}`)
    return null
  }
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.bookSources)) return payload.bookSources
  if (payload && Array.isArray(payload.sources)) return payload.sources
  if (payload && typeof payload === 'object') return [payload]
  return []
}

function validateSource(source, file) {
  const label = `${file} · ${source && (source.bookSourceName || source.name) || '未命名'}`
  if (!source || typeof source !== 'object') {
    errors.push(`${file}: 书源不是对象`)
    return
  }
  const name = source.bookSourceName || source.name
  const url = source.bookSourceUrl || source.url
  if (!name) errors.push(`${label}: 缺少 bookSourceName`)
  if (!url) errors.push(`${label}: 缺少 bookSourceUrl`)
  else if (!/^https?:\/\//i.test(url)) errors.push(`${label}: bookSourceUrl 必须是 http(s) 地址`)
  const indexed = source.searchMode === 'crawl-index' || !!source.indexPagePattern || !!source.searchIndexUrl
  if (!source.direct && !source.singleChapter) {
    if (!indexed && !source.searchUrl) errors.push(`${label}: 缺少 searchUrl（直链源请设置 direct: true，索引源请设置 searchMode: crawl-index）`)
    else if (!indexed && !source.searchUrl.includes('{{key}}') && !(source.searchBody || '').includes('{{key}}')) {
      warnings.push(`${label}: searchUrl / searchBody 里没有 {{key}}，请确认是否为固定搜索地址`)
    }
    if (!source.ruleSearch || !source.ruleSearch.bookList) errors.push(`${label}: 缺少 ruleSearch.bookList`)
    if (!source.ruleSearch || !source.ruleSearch.name) warnings.push(`${label}: 缺少 ruleSearch.name`)
    if (!source.ruleSearch || !source.ruleSearch.bookUrl) warnings.push(`${label}: 缺少 ruleSearch.bookUrl`)
    if (indexed && !source.indexPagePattern && !source.searchIndexUrl) errors.push(`${label}: 索引源缺少 indexPagePattern 或 searchIndexUrl`)
  }
  if (!source.singleChapter && (!source.ruleToc || !source.ruleToc.chapterList)) errors.push(`${label}: 缺少 ruleToc.chapterList`)
  if (!source.ruleContent || !source.ruleContent.content) errors.push(`${label}: 缺少 ruleContent.content`)
  if (source.searchMethod && !['GET', 'POST'].includes(String(source.searchMethod).toUpperCase())) {
    errors.push(`${label}: searchMethod 只能是 GET 或 POST`)
  }
  const ruleStrings = []
  for (const group of ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent']) {
    for (const value of Object.values(source[group] || {})) {
      if (typeof value === 'string') ruleStrings.push(value)
    }
  }
  if (ruleStrings.some((rule) => rule.includes('@js:'))) {
    warnings.push(`${label}: 使用了 @js 规则，当前引擎不支持`)
  }
  if (ruleStrings.some((rule) => /@XPath:|^\/\//i.test(rule))) {
    warnings.push(`${label}: 使用了 XPath 规则，当前引擎不支持`)
  }
}

const index = readJson('index.json')
if (!index) {
  finish()
}

if (!index.name) errors.push('index.json: 缺少 name')
if (!Number.isFinite(Number(index.version)) || Number(index.version) < 1) errors.push('index.json: version 必须是大于 0 的数字')
if (index.engine != null && (!Number.isFinite(Number(index.engine)) || Number(index.engine) < 1)) {
  errors.push('index.json: engine 必须是大于 0 的数字')
}
if (!Array.isArray(index.sources) || !index.sources.length) errors.push('index.json: sources 不能为空')

const ids = new Set()
const files = new Set()
for (const entry of index.sources || []) {
  if (!entry || typeof entry !== 'object') {
    errors.push('index.json: sources 条目必须是对象')
    continue
  }
  if (!entry.id) errors.push('index.json: 书源条目缺少 id')
  else if (ids.has(entry.id)) errors.push(`index.json: 重复 id ${entry.id}`)
  else ids.add(entry.id)
  if (!entry.name) warnings.push(`index.json: ${entry.id || '未知条目'} 缺少 name`)
  if (!entry.path) {
    if (!entry.source) errors.push(`index.json: ${entry.id || '未知条目'} 缺少 path 或 inline source`)
    continue
  }
  if (files.has(entry.path)) warnings.push(`index.json: 多个条目引用同一文件 ${entry.path}`)
  files.add(entry.path)
  const payload = readJson(entry.path)
  if (!payload) continue
  const list = normalizeList(payload)
  if (!list.length) errors.push(`${entry.path}: 没有找到书源对象`)
  for (const source of list) validateSource(source, entry.path)
}

finish()

function finish() {
  for (const warning of warnings) console.warn('⚠ ' + warning)
  for (const error of errors) console.error('✖ ' + error)
  if (errors.length) {
    console.error(`\n校验失败：${errors.length} 个错误，${warnings.length} 个警告`)
    process.exit(1)
  }
  console.log(`✓ 书源库校验通过：${ids.size} 个书源，${warnings.length} 个警告`)
}
