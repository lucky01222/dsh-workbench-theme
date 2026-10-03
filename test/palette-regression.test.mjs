import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { HAIBARA_TOKENS } from '../src/palette.mjs'

const source = readFileSync(new URL('../src/appearance.css', import.meta.url), 'utf8')
const compiled = transformSync(source, { loader: 'css', legalComments: 'none' })
// These static scope checks complement the real Host's computed-style verification.
const rules = Array.from(compiled.code.matchAll(/([^{}]+)\{([^{}]*)\}/g), match => ({
  selectors: match[1].trim().split(',').map(selector => selector.trim()),
  declarations: Object.fromEntries(match[2].split(';').map(value => {
    const colon = value.indexOf(':')
    return colon < 0 ? [] : [value.slice(0, colon).trim(), value.slice(colon + 1).trim()]
  }).filter(pair => pair.length === 2)),
}))

test('conversation surface paint stops at the main root, leaving editable phases transparent', () => {
  assert.deepEqual(compiled.warnings, [])
  const painted = rules.filter(rule => rule.declarations.background === 'var(--dsw-theme-conversation-surface)')
  assert.ok(painted.length > 0)
  for (const rule of painted) for (const selector of rule.selectors) {
    assert.match(selector, /\[data-slot=(?:["']?main["']?)\]\s*>\s*\[class\*=["']?_root["']?\]$/)
    assert.doesNotMatch(selector, /\[data-phase|contenteditable|data-input-scroll/)
  }
  assert.doesNotMatch(source, /\[data-phase(?:[\s=\]])/)
  for (const scheme of ['light', 'dark']) {
    assert.equal(HAIBARA_TOKENS['--dsw-specific-input-major'][scheme], HAIBARA_TOKENS['--dsw-theme-composer-surface'][scheme])
  }
})

test('document tabs join the panel surface through local tokens, including the empty bar', () => {
  const bars = rules.filter(rule => rule.selectors.some(selector => selector.includes('_documentBar')))
  assert.equal(bars.length, 1)
  const bar = bars[0]
  for (const selector of bar.selectors) {
    assert.match(selector, /^body\[data-workbench-theme\]\s+\[data-slot=["']?main["']?\]\s+\[class\*=["']?_documentBar["']?\]$/)
    assert.doesNotMatch(selector, /:has|data-dsw-document-tabs|data-active/)
  }
  assert.equal(bar.declarations.background, 'var(--dsw-theme-application-surface)')
  assert.equal(bar.declarations['--dsw-alias-bg-base'], 'var(--dsw-theme-panel-surface)')
  assert.equal(bar.declarations['--dsw-alias-border-l3'], 'var(--dsw-alias-border-l2)')
  assert.doesNotMatch(source, /!\s*important/i)
})

test('document chrome overrides cannot recolor the actual sidebar or the whole application', () => {
  for (const name of ['--dsw-alias-bg-base', '--dsw-alias-border-l3']) {
    const owners = rules.filter(rule => Object.hasOwn(rule.declarations, name))
    assert.equal(owners.length, 1)
    for (const selector of owners[0].selectors) {
      assert.ok(selector.includes('_documentBar'))
      assert.doesNotMatch(selector, /data-slot=["']?sidebar/)
    }
  }
  assert.ok(rules.every(rule => !Object.hasOwn(rule.declarations, '--dsw-specific-sidebar-fill')))
  const sidebar = rules.find(rule => rule.selectors.some(selector => /data-slot=["']?sidebar/.test(selector)))
  assert.ok(sidebar.declarations.background.includes('var(--dsw-theme-sidebar-surface)'))
})
