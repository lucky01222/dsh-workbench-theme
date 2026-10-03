/**
 * Behavior regression for the built Client bundle on official DSH rc.2.
 * Real ModuleSystem and Cordis own materialization, HMR and effect disposal.
 * A small in-memory DOM and service fixtures avoid rendering, network/model
 * calls, and writes to a daily DSH profile. No target implementation is copied.
 *
 * npm test runs top-level unit tests; this integration lives in test/client.
 * npm run test:client uses scripts/test-client.mjs and requires the runtime.
 * DSH_CLIENT_PACKAGE_ROOT overrides this repo (useful for frozen old packages).
 * DSH_PEER_PACKAGE_ROOT supplies the other real Shell/Theme package.
 * DSH_CLIENT_DEPENDENCY_ROOT supplies React when it is not in repo/runtime.
 * DSH_STYLE_EVIDENCE_PATH optionally writes versions, hashes and stage results.
 */
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash, webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const runtimeRoot = process.env.DSH_RUNTIME_ROOT ? resolve(process.env.DSH_RUNTIME_ROOT) : null
const targetRoot = resolve(process.env.DSH_CLIENT_PACKAGE_ROOT || repositoryRoot)
const evidencePath = process.env.DSH_STYLE_EVIDENCE_PATH
const checksum = value => createHash('sha256').update(value).digest('hex')
const report = {
  observedAtUTC: new Date().toISOString(), nodeVersion: process.version,
  result: 'pending',
  dailyWorkbenchTouched: false, modelCalls: false,
  scope: 'Real official rc.2 Client ModuleSystem, Cordis and built bundles with in-memory DOM/services; component rendering is outside this test',
  runtime: null, packages: [], scenarios: [],
}
let inputsPromise

async function readPackage(root) {
  const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const bundlePath = resolve(root, 'dist/client.js')
  const bundle = await readFile(bundlePath, 'utf8')
  assert.ok(['dsh-workbench-shell', 'dsh-workbench-theme'].includes(metadata.name), `Unsupported target package: ${metadata.name}`)
  return { id: metadata.name, version: metadata.version, root, bundlePath, bundle, sha256: checksum(bundle) }
}

async function inputs() {
  if (!inputsPromise) inputsPromise = (async () => {
    assert.ok(runtimeRoot, 'Set DSH_RUNTIME_ROOT to the official runtime directory containing node_modules')
    const nodeRoot = resolve(runtimeRoot, 'node_modules')
    const officialPath = resolve(nodeRoot, '@deepseek-ai/dsh-client-modules/lib/client.js')
    const official = await readFile(officialPath, 'utf8')
    const harness = JSON.parse(await readFile(resolve(nodeRoot, '@deepseek-ai/dsh/package.json'), 'utf8'))
    const client = JSON.parse(await readFile(resolve(nodeRoot, '@deepseek-ai/dsh-client-modules/package.json'), 'utf8'))
    assert.equal(harness.version, '0.1.7-rc.2', 'This regression is bound to official Harness 0.1.7-rc.2')
    assert.equal(client.version, '0.1.7-rc.2', 'This regression requires the matching official Client Modules 0.1.7-rc.2')
    const [{ Context }, { default: Loader }] = await Promise.all([
      import(pathToFileURL(resolve(nodeRoot, '@deepseek-ai/cordis/lib/index.js'))),
      import(pathToFileURL(resolve(nodeRoot, '@deepseek-ai/cordis-plugin-loader/lib/index.js'))),
    ])
    let require
    for (const root of [process.env.DSH_CLIENT_DEPENDENCY_ROOT, targetRoot, runtimeRoot].filter(Boolean)) {
      const candidate = createRequire(resolve(root, 'package.json'))
      try { candidate.resolve('react'); candidate.resolve('react/jsx-runtime'); require = candidate; break } catch {}
    }
    assert.ok(require, 'React is needed only as a platform fixture; install it as a dev dependency or set DSH_CLIENT_DEPENDENCY_ROOT to an existing package root containing React')
    const target = await readPackage(targetRoot)
    const counterpart = target.id === 'dsh-workbench-shell' ? 'dsh-workbench-theme' : 'dsh-workbench-shell'
    const peerRoot = resolve(process.env.DSH_PEER_PACKAGE_ROOT || resolve(targetRoot, '..', counterpart))
    const peer = await readPackage(peerRoot)
    assert.equal(peer.id, counterpart, 'DSH_PEER_PACKAGE_ROOT must point to the other real appearance plugin')
    report.runtime = { harnessVersion: harness.version, clientModuleVersion: client.version, officialSha256: checksum(official) }
    report.packages = [target, peer].map(({ id, version, sha256 }) => ({ id, version, bundleSha256: sha256 }))
    return { Context, Loader, require, official, officialPath, target, peer }
  })()
  return inputsPromise
}

function createDocument() {
  const styles = []
  const attributes = new Map()
  const document = {
    styles,
    body: {
      getAttribute: key => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, String(value)),
      removeAttribute: key => attributes.delete(key), dataset: {},
    },
    documentElement: { dataset: {}, hasAttribute: () => false },
    head: { append: element => styles.push(element) },
    createElement(tag) {
      assert.equal(tag, 'style', 'Only stylesheet effects are exercised by this DOM fixture')
      const attrs = new Map()
      return {
        textContent: '',
        setAttribute: (key, value) => attrs.set(key, String(value)),
        getAttribute: key => attrs.get(key) ?? null,
        removeAttribute: key => attrs.delete(key),
        remove() { const index = styles.indexOf(this); if (index >= 0) styles.splice(index, 1) },
      }
    },
    querySelector: () => null,
    querySelectorAll(selector) {
      if (selector === 'style:not([data-plugin])') return styles.filter(element => element.getAttribute('data-plugin') === null)
      if (selector === 'style[data-plugin]') return styles.filter(element => element.getAttribute('data-plugin') !== null)
      const match = /^style\[data-plugin=(".*")\]$/.exec(selector)
      if (match) return styles.filter(element => element.getAttribute('data-plugin') === JSON.parse(match[1]))
      return []
    },
    addEventListener() {}, removeEventListener() {},
  }
  return document
}

const syntheticPeer = 'test-style-peer'
const row = (id, rev = 'r0') => ({ id, rev, url: `/plugins/??${id}/client.js&rev=${rev}` })
const graph = entries => ({
  rev: JSON.stringify(entries), entries,
  batches: entries.map(entry => ({ phase: 'application', url: entry.url, rev: entry.rev, entries: [entry.id] })),
})

async function createFixture(initialIds, document = createDocument()) {
  const input = await inputs()
  const packages = new Map([input.target, input.peer].map(pkg => [pkg.id, pkg]))
  const media = { matches: false, addEventListener() {}, removeEventListener() {} }
  let registration
  const sandbox = vm.createContext({
    window: {
      __ModuleLoader__: { load: value => { registration = value } },
      matchMedia: () => media, addEventListener() {}, removeEventListener() {},
    },
    document, MutationObserver: class { observe() {} disconnect() {} },
    console, URL, structuredClone, crypto: webcrypto, clearTimeout, setTimeout, AbortController,
  })
  vm.runInContext(input.official, sandbox, { filename: input.officialPath })
  const official = registration.factory(() => { throw new Error('Unexpected official Loader external module') })
  const facade = { mode: 'queue', pendingQueue: [], load() {} }
  const rows = new Map(initialIds.map(id => [id, row(id)]))
  const modules = official.createClientModuleSystem(facade, {
    id: 'bootstrap', exports: { inject: ['loader'], apply: official.apply },
  }, {
    boot: graph([...rows.values()]),
    staticModules: {
      react: input.require('react'), 'react/jsx-runtime': input.require('react/jsx-runtime'),
      'react-dom': { createPortal: () => null }, '@deepseek-ai/dsh-client-ui-primitives': {},
    },
    loadBundle: async url => {
      const match = /\/\?\?([^/]+)\/client\.js/.exec(url)
      assert.ok(match, `Unexpected fixture transport URL: ${url}`)
      const id = match[1]
      if (packages.has(id)) {
        const pkg = packages.get(id)
        vm.runInContext(pkg.bundle, sandbox, { filename: pkg.bundlePath })
        return
      }
      assert.equal(id, syntheticPeer)
      // An ordinary peer emits CSS during factory materialization; the real
      // official Loader discovers and tags it, exercising the late-claim bug.
      facade.load({ id, factory() {
        const element = document.createElement('style')
        element.setAttribute('data-test-style-peer', '')
        element.textContent = '.test-style-peer { --alive: 1; }'
        document.head.append(element)
        return { apply(ctx) { ctx.effect(() => () => element.remove()) } }
      } })
    },
  })
  sandbox.window.__ModuleLoader__ = facade
  const ctx = new input.Context()
  ctx.provide('slots', { inject() {} })
  ctx.provide('locale', { register: () => () => {}, bind: () => key => key })
  ctx.provide('layout', { panelInfo: { getSnapshot: () => ({ activePanelId: null }), subscribe: () => () => {} } })
  ctx.provide('configForms', { get: () => ({ getSnapshot: () => ({ mode: 'memory', status: 'unavailable' }), subscribe: () => () => {} }) })
  ctx.provide('theme', { overrideTokens: () => () => {} })
  const fixture = {
    document, ctx, modules,
    async start() {
      await ctx.plugin(input.Loader)
      ctx.loader.internal = modules
      // First materialize the actual bundle, then let official entry lifecycle
      // activate it. This intentionally distinguishes factory from apply CSS.
      for (const id of initialIds) await modules.import(id)
      await modules.entries.start(ctx.loader, modules.manifest)
      fixture.assertActive(initialIds)
    },
    async sync(ids) {
      for (const id of ids) if (!rows.has(id)) rows.set(id, row(id))
      await modules.entries.sync(graph(ids.map(id => rows.get(id))))
      fixture.assertActive(ids)
    },
    async reload(id, rev) {
      rows.set(id, row(id, rev))
      await modules.entries.reload(id, rev)
      fixture.assertActive([...ctx.loader.entries()].filter(entry => !entry.disabled).map(entry => entry.options.name))
    },
    async disable(id, disabled) {
      const entry = [...ctx.loader.entries()].find(entry => entry.options.name === id)
      assert.ok(entry, `Missing real Loader entry: ${id}`)
      await ctx.loader.update(entry.id, { disabled })
      await ctx.loader.await()
      if (!disabled) fixture.assertActive([id])
    },
    assertActive(ids) {
      assert.equal(modules.entries.state.getSnapshot().failures.length, 0, 'Official Client Loader reports no failures')
      for (const id of ids) {
        const entry = [...ctx.loader.entries()].find(entry => entry.options.name === id)
        assert.equal(entry?.fiber?.state, 2, `${id} is active under real Cordis`)
      }
    },
    ownStyles(id) {
      // These pre-existing public markers identify the CSS being exercised;
      // data-plugin remains observed evidence rather than the lookup oracle.
      // This lets the old bundle run all the way to peer HMR's actual deletion.
      const marker = id === syntheticPeer ? 'data-test-style-peer'
        : id === 'dsh-workbench-shell' ? 'data-workbench-navigation-style' : 'data-workbench-theme-style'
      return document.styles.filter(element => element.getAttribute(marker) !== null)
    },
    singleStyle(id) {
      const own = fixture.ownStyles(id)
      assert.equal(own.length, 1, `${id} has exactly one owned stylesheet`)
      assert.ok(own[0].textContent.length > 0, `${id} stylesheet is non-empty`)
      return own[0]
    },
    snapshot(stage) {
      return { stage, styles: document.styles.map(element => ({ owner: element.getAttribute('data-plugin'), cssSha256: checksum(element.textContent) })),
        entries: [...ctx.loader.entries()].map(entry => ({ id: entry.options.name, disabled: entry.disabled, state: entry.fiber?.state ?? null })) }
    },
    async close() { await ctx.fiber.dispose(); await ctx.fiber.await() },
  }
  return fixture
}

async function scenario(name, run) {
  const evidence = { name, result: 'pending', stages: [] }
  report.scenarios.push(evidence)
  try { await run(evidence.stages); evidence.result = 'passed' }
  catch (error) { evidence.result = 'failed'; evidence.error = String(error); throw error }
}

test('late peer materialization and peer HMR retain the active plugin CSS', async () => {
  await scenario('late-peer-and-peer-HMR', async stages => {
    const { target } = await inputs()
    const fixture = await createFixture([target.id])
    try {
      await fixture.start()
      stages.push(fixture.snapshot('target-active'))
      const original = fixture.singleStyle(target.id)
      const css = original.textContent
      await fixture.sync([target.id, syntheticPeer])
      stages.push(fixture.snapshot('peer-materialized'))
      assert.strictEqual(fixture.singleStyle(target.id), original, 'Peer materialization retains the target style node')
      assert.equal(original.textContent, css)
      const peer = fixture.singleStyle(syntheticPeer)
      await fixture.reload(syntheticPeer, 'r1')
      stages.push(fixture.snapshot('peer-HMR'))
      assert.strictEqual(fixture.singleStyle(target.id), original, 'Peer HMR preserves the active target CSS')
      assert.equal(original.textContent, css)
      assert.equal(original.getAttribute('data-plugin'), target.id, 'Retained target CSS belongs to the active target plugin')
      assert.ok(!fixture.document.styles.includes(peer), 'Peer HMR releases its previous CSS')
      fixture.singleStyle(syntheticPeer)
      assert.equal(fixture.document.styles.length, 2)
    } finally { await fixture.close() }
    assert.equal(fixture.document.styles.length, 0, 'All styles release after root disposal')
  })
})

test('own disable, re-enable and HMR keep peer CSS and leave one own stylesheet', async () => {
  await scenario('disable-reenable-and-own-HMR', async stages => {
    const { target } = await inputs()
    const fixture = await createFixture([target.id])
    try {
      await fixture.start()
      await fixture.sync([target.id, syntheticPeer])
      const peer = fixture.singleStyle(syntheticPeer)
      for (let cycle = 1; cycle <= 3; cycle++) {
        const previous = fixture.singleStyle(target.id)
        await fixture.disable(target.id, true)
        stages.push(fixture.snapshot(`disabled-${cycle}`))
        assert.equal(fixture.ownStyles(target.id).length, 0, 'Disabled plugin releases its CSS without removing its module row')
        assert.strictEqual(fixture.singleStyle(syntheticPeer), peer, 'Disabling the target preserves peer CSS')
        assert.ok(!fixture.document.styles.includes(previous))
        await fixture.disable(target.id, false)
        stages.push(fixture.snapshot(`enabled-${cycle}`))
        const current = fixture.singleStyle(target.id)
        assert.notStrictEqual(current, previous)
        assert.strictEqual(fixture.singleStyle(syntheticPeer), peer)
        await fixture.reload(target.id, `r${cycle}`)
        stages.push(fixture.snapshot(`own-HMR-${cycle}`))
        fixture.singleStyle(target.id)
        assert.ok(!fixture.document.styles.includes(current), 'Own HMR releases its old style node')
        assert.strictEqual(fixture.singleStyle(syntheticPeer), peer, 'Own HMR preserves peer CSS')
        assert.equal(fixture.document.styles.length, 2)
      }
    } finally { await fixture.close() }
    assert.equal(fixture.document.styles.length, 0)
  })
})

test('disposing an older real Cordis instance cannot remove a newer instance CSS', async () => {
  await scenario('late-old-instance-disposer', async stages => {
    const { target } = await inputs()
    const document = createDocument()
    const old = await createFixture([target.id], document)
    const newer = await createFixture([target.id], document)
    try {
      await old.start()
      const oldStyle = old.singleStyle(target.id)
      await newer.start()
      stages.push(newer.snapshot('two-independent-contexts-active'))
      const candidates = newer.ownStyles(target.id)
      assert.equal(candidates.length, 2, 'Each independent context owns a distinct effect node')
      const newStyle = candidates.find(element => element !== oldStyle)
      assert.ok(newStyle)
      const newCSS = newStyle.textContent
      await old.close()
      stages.push(newer.snapshot('old-context-disposed'))
      assert.strictEqual(newer.singleStyle(target.id), newStyle, 'Old disposer only removes its own instance node')
      assert.equal(newStyle.textContent, newCSS)
      newer.assertActive([target.id])
      assert.ok(!document.styles.includes(oldStyle))
    } finally { await old.close(); await newer.close() }
    assert.equal(document.styles.length, 0)
  })
})

for (const order of [['dsh-workbench-shell', 'dsh-workbench-theme'], ['dsh-workbench-theme', 'dsh-workbench-shell']]) {
  test(`real Shell/Theme coexist in ${order.join(' -> ')} load order`, async () => {
    await scenario(`coexist-${order.join('-then-')}`, async stages => {
      const [first, second] = order
      const fixture = await createFixture([first])
      try {
        await fixture.start()
        const firstCSS = fixture.singleStyle(first)
        await fixture.sync(order)
        stages.push(fixture.snapshot('both-active'))
        assert.strictEqual(fixture.singleStyle(first), firstCSS, 'Loading the second real plugin preserves the first CSS')
        fixture.singleStyle(second)
        // Immediately refresh the later-loaded plugin. Refreshing the first
        // one beforehand would replace the style that the old Loader had
        // wrongly attributed to the second, hiding the coexistence defect.
        for (const id of [second, first]) {
          const other = id === first ? second : first
          const otherStyle = fixture.singleStyle(other)
          await fixture.reload(id, 'coexist-r1')
          stages.push(fixture.snapshot(`HMR-${id}`))
          fixture.singleStyle(id)
          assert.strictEqual(fixture.singleStyle(other), otherStyle, 'Real plugin HMR preserves the other plugin CSS')
          await fixture.disable(id, true)
          stages.push(fixture.snapshot(`disabled-${id}`))
          assert.equal(fixture.ownStyles(id).length, 0)
          assert.strictEqual(fixture.singleStyle(other), otherStyle)
          await fixture.disable(id, false)
          stages.push(fixture.snapshot(`enabled-${id}`))
          fixture.singleStyle(id)
          assert.strictEqual(fixture.singleStyle(other), otherStyle)
          assert.equal(fixture.document.styles.length, 2)
        }
      } finally { await fixture.close() }
      assert.equal(fixture.document.styles.length, 0)
    })
  })
}

after(async () => {
  report.result = report.scenarios.some(item => item.result !== 'passed') ? 'failed' : 'passed'
  if (evidencePath) {
    const output = resolve(evidencePath)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  }
  console.log(`Client style evidence: ${JSON.stringify({ result: report.result, runtime: report.runtime, packages: report.packages,
    scenarios: report.scenarios.map(({ name, result }) => ({ name, result })), evidencePath: evidencePath || null })}`)
})
