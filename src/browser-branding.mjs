const NATIVE_TITLE = 'DeepSeek Harness'

/** rc.2 owns the session prefix; the theme only projects its product suffix. */
export function installBrowserBranding({ document, Observer, title, icon, favicon }) {
  let sourceTitle = document.title, projectedTitle, disposed = false
  const attributes = ['href', 'type', 'sizes']
  const icons = Array.from(document.querySelectorAll('link[rel~="icon"]'), node => ({
    node, original: attributes.map(name => node.getAttribute(name)), applied: null,
  }))
  let ownedIcon

  function syncTitle() {
    if (disposed) return
    const current = document.title
    if (current !== projectedTitle) sourceTitle = current
    projectedTitle = sourceTitle === NATIVE_TITLE ? title()
      : sourceTitle.endsWith(` — ${NATIVE_TITLE}`)
        ? sourceTitle.slice(0, -NATIVE_TITLE.length) + title() : sourceTitle
    if (current !== projectedTitle) document.title = projectedTitle
  }

  function restoreIcons() {
    for (const entry of icons) {
      if (!entry.applied) continue
      // Respect a later owner of an individual attribute.
      attributes.forEach((name, index) => {
        if (entry.node.getAttribute(name) !== entry.applied[index]) return
        const previous = entry.original[index]
        if (previous === null) entry.node.removeAttribute(name)
        else entry.node.setAttribute(name, previous)
      })
      entry.applied = null
    }
    ownedIcon?.remove()
    ownedIcon = undefined
  }

  function sync() {
    if (disposed) return
    syncTitle()
    if (icon() === 'native') return restoreIcons()
    if (!icons.length) {
      if (!ownedIcon) {
        ownedIcon = document.createElement('link')
        ownedIcon.setAttribute('rel', 'icon')
        ownedIcon.setAttribute('data-workbench-browser-icon', '')
        ownedIcon.setAttribute('href', favicon)
        ownedIcon.setAttribute('type', 'image/svg+xml')
        ownedIcon.setAttribute('sizes', 'any')
        document.head.append(ownedIcon)
      }
      return
    }
    for (const entry of icons) {
      if (entry.applied) continue
      entry.original = attributes.map(name => entry.node.getAttribute(name))
      entry.applied = [favicon, 'image/svg+xml', 'any']
      attributes.forEach((name, index) => entry.node.setAttribute(name, entry.applied[index]))
    }
  }

  const observer = new Observer(syncTitle)
  // Official Web rc.2 has one persistent title element. Observing only its
  // contents avoids reacting to unrelated plugin styles or favicon changes.
  const titleElement = document.querySelector('title')
  if (titleElement) observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
  sync()
  return { sync, dispose() {
    if (disposed) return
    disposed = true
    observer.disconnect()
    if (document.title === projectedTitle) document.title = sourceTitle
    restoreIcons()
  } }
}
