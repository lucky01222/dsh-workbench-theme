/** Verified official Web 0.1.7-rc.2 adapter. Unknown host markup is left untouched. */
export function rc2Surfaces({document,active,own,mark,attribute,roles}) {
  const next=[];
  for(const slot of document.querySelectorAll('[data-slot="conversation.hero.brand.mark"]')) {
      const headline=slot.closest('[class*="_headline"]'),group=headline?.querySelector('[class*="_titleGroup"]')
      if(!headline||!group)continue
      mark(group,'wbHeroTitleGroup')
      for(const child of group.children)if(!child.hasAttribute('data-workbench-artwork-owner'))attribute(child,'data-workbench-original-hero-copy','')
      next.push(own(group,'wbHeroTitle','title'))
      mark(headline,'wbHomeHeading');attribute(headline,'data-workbench-art-motion','')
      if(active)next.push(own(headline,'wbHomeArtwork','art',roles['home-heading']))
    }
    for(const header of document.querySelectorAll('[data-slot="main"] > [class*="_page"] > header[class*="_pageHead"]')) {
      mark(header,'wbPluginHeading');attribute(header,'data-workbench-art-motion','')
      const title=header.querySelector?.('h1')
      if(title)attribute(title,'data-workbench-title','')
      if(active)next.push(own(header,'wbPluginArtwork','art',roles['page-heading']))
      // A gutter belongs to the page layout; never borrow space from cards or controls.
      const page=header.parentElement
      if(active&&page&&roles['page-margin']) {
        // The public slot marker uses display:contents in rc.2; its box is zero.
        const r=header.getBoundingClientRect(),bounds=page.getBoundingClientRect()
        if(Number.isFinite(r.right)&&Number.isFinite(bounds.right)&&bounds.right-r.right>=122) {
          const entry=own(page,'wbPageMarginArtwork','art',roles['page-margin'])
          const right=Math.max(14,(document.documentElement.clientWidth??bounds.right)-bounds.right+14)+'px'
          if(entry.node.style.getPropertyValue('--wb-page-margin-right')!==right)entry.node.style.setProperty('--wb-page-margin-right',right)
          attribute(entry.node,'data-workbench-margin-visible',r.bottom<=bounds.top+4?'true':null)
          next.push(entry)
        }
      }
    }
  return next
}
