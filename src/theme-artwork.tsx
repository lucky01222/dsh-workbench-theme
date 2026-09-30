import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import portrait from './assets/ytv-portrait.png'
import standee from './assets/haibara-standee.png'
import calm from './assets/ytv-still-01.jpg'
import sleepy from './assets/ytv-still-02.jpg'
import cheerful from './assets/ytv-still-03.jpg'
import cinema from './assets/tms-submarine-08.jpg'
import drawing from './assets/shogakukan-character.jpg'
import './theme-artwork.css'
import './theme-surfaces.css'

export const ARTWORK_VARIANTS = ['cutout','corner','silver-calm','silver-sleepy','silver-cheerful','cinema','drawing','silver-cinema'] as const
export type ArtworkVariant = typeof ARTWORK_VARIANTS[number]
const imagery: Record<ArtworkVariant,string> = {cutout:standee,corner:portrait,'silver-calm':calm,'silver-sleepy':sleepy,'silver-cheerful':cheerful,cinema,drawing,'silver-cinema':cinema}

/** Original source pixels; the shared CSS owns cropping, depth and silver material. */
export function ThemeArtwork({variant}: {variant:ArtworkVariant}) {
  const image=<img src={imagery[variant]} alt="" draggable={false}/>
  return <div className={`wb-theme-art wb-art-${variant}`} aria-hidden="true">
    {variant==='cutout'?<><span className="wb-art-lettering">Ai Haibara</span><div className="wb-art-cutout-frame"/><div className="wb-art-cutout-figure">{image}</div></>:
      variant==='corner'?<><div className="wb-art-corner-frame"><span>Ai<br/>Haibara</span></div><div className="wb-art-corner-figure">{image}</div></>:
      variant.startsWith('silver-')?<><div className="wb-art-foil">{image}</div>{variant==='silver-cinema'&&<span className="wb-art-film-lettering">Ai Haibara</span>}</>:<><div className="wb-art-image-frame">{image}</div>{variant==='cinema'&&<span className="wb-art-image-lettering">Ai Haibara</span>}</>}
  </div>
}

export function ThemePortals({projection,title}) {
  const entries=useSyncExternalStore(projection.subscribe,projection.getSnapshot)
  return <>{entries.map(entry=>createPortal(
    entry.type==='title'?<span data-workbench-title="">{title}</span>:
      <>{(Array.isArray(entry.variant)?entry.variant:[entry.variant]).map((variant:ArtworkVariant)=><ThemeArtwork key={variant} variant={variant}/>)}</>,entry.node,entry.id,
  ))}</>
}
