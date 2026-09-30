/** A bounded dot → outline → fill sequence on opt-in plain headings. */
export function textAnimator(node,{document,view,enabled,request,cancel,now}) {
  const canvas=document.createElement('canvas'),context=canvas.getContext?.('2d')
  if(!context)return undefined
  const originalPhase=node.getAttribute('data-workbench-title-phase')
  const ownedClass=!node.classList.contains('wbTitleMotionTarget')
  const position={value:node.style.getPropertyValue('position'),priority:node.style.getPropertyPriority?.('position')??''}
  const positioned=view.getComputedStyle(node).position==='static'
  const source=plainText(node),identity=source
  let frame=null,disposed=false,color,started=0
  if(ownedClass)node.classList.add('wbTitleMotionTarget')
  if(positioned)node.style.setProperty('position','relative')
  canvas.className='wbTitleMotionCanvas';canvas.setAttribute('data-workbench-title-canvas','theme');canvas.setAttribute('aria-hidden','true')
  node.append(canvas)
  function restoreColor(){if(color&&node.style.getPropertyValue('color')==='transparent'&&(node.style.getPropertyPriority?.('color')??'')===''){color.value?node.style.setProperty('color',color.value,color.priority):node.style.removeProperty('color')}color=undefined}
  function reset(){if(frame!==null)cancel(frame);frame=null;restoreColor();canvas.style.removeProperty('display');if(!disposed)node.setAttribute('data-workbench-title-phase','static')}
  function replay(){
    reset()
    if(disposed||!node.isConnected||document.hidden||!enabled()||plainText(node)!==identity)return
    const bounds=node.getBoundingClientRect(),style=view.getComputedStyle(node),size=parseFloat(style.fontSize)
    if(!Number.isFinite(size)||bounds.width<=0||bounds.height<=0||bounds.width>1200||bounds.height>size*1.8||Number.isFinite(view.innerHeight)&&(bounds.bottom<=0||bounds.top>=view.innerHeight))return
    const width=Math.ceil(bounds.width),height=Math.ceil(bounds.height),scale=Math.min(view.devicePixelRatio||1,1.5)
    const scratch=document.createElement('canvas');scratch.width=width;scratch.height=height
    const sample=scratch.getContext?.('2d',{willReadFrequently:true});if(!sample)return
    const font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,align=style.textAlign==='center'?'center':style.textAlign==='right'?'right':'left',x=align==='center'?width/2:align==='right'?width:0
    sample.font=font;sample.textBaseline='middle';sample.textAlign=align
    if('letterSpacing' in sample)sample.letterSpacing=style.letterSpacing
    let pixels
    try{sample.fillText(source,x,height/2);pixels=sample.getImageData(0,0,width,height).data}catch{return}
    const points=[]
    for(let px=1;px<width-1;px+=3)for(let py=1;py<height-1;py+=3){const i=(py*width+px)*4;if(pixels[i+3]>90&&[i-4,i+4,i-width*4,i+width*4].some(k=>pixels[k+3]<90))points.push({x:px,y:py})}
    const stride=Math.max(1,Math.ceil(points.length/170)),dots=points.filter((_,i)=>i%stride===0)
    if(!dots.length)return
    canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);canvas.style.setProperty('width',width+'px');canvas.style.setProperty('height',height+'px');canvas.style.setProperty('display','block')
    context.setTransform(scale,0,0,scale,0,0);context.font=font;context.textBaseline='middle';context.textAlign=align;context.lineWidth=.65
    if('letterSpacing' in context)context.letterSpacing=style.letterSpacing
    const ink=style.color,accent=view.getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim()||ink
    color={value:node.style.getPropertyValue('color'),priority:node.style.getPropertyPriority?.('color')??''}
    node.style.setProperty('color','transparent');node.setAttribute('data-workbench-title-phase','starting')
    canvas.setAttribute('data-workbench-title-dots',String(dots.length));canvas.setAttribute('data-workbench-title-frames','0');started=now();let frames=0
    const paint=time=>{
      frame=null
      const visible=node.getBoundingClientRect()
      if(disposed||!node.isConnected||document.hidden||!enabled()||canvas.parentElement!==node||plainText(node)!==identity||!eligible(node)||!visible.width||!visible.height||Math.abs(visible.width-bounds.width)>.5||Math.abs(visible.height-bounds.height)>.5||visible.height>size*1.8||node.style.getPropertyValue('color')!=='transparent'||(node.style.getPropertyPriority?.('color')??'')!==''||Number.isFinite(view.innerHeight)&&(visible.bottom<=0||visible.top>=view.innerHeight)){reset();return}
      const t=Math.min(1,Math.max(0,(time-started)/1050))
      node.setAttribute('data-workbench-title-phase',t<.38?'dots':t<.65?'outline':t<1?'fill':'complete');canvas.setAttribute('data-workbench-title-frames',String(++frames))
      context.clearRect(0,0,width,height);context.strokeStyle=ink;context.globalAlpha=Math.min(1,t*2.1);context.strokeText(source,x,height/2);context.fillStyle=ink;context.globalAlpha=Math.max(.15,(t-.44)/.56);context.fillText(source,x,height/2)
      dots.forEach((point,i)=>{const progress=Math.max(0,Math.min(1,(t-i/dots.length*.48)*3.4)),ease=1-(1-progress)**3,phase=i*.73;context.globalAlpha=Math.min(1,progress*4)*Math.max(0,1-(t-.68)*4);context.fillStyle=i%7===0?accent:ink;context.beginPath();context.arc(point.x+(1-ease)*Math.cos(phase)*13,point.y+(1-ease)*Math.sin(phase)*10,i%7===0?2.1:.85,0,Math.PI*2);context.fill()})
      context.globalAlpha=1
      if(t<1)frame=request(paint);else{restoreColor();canvas.style.removeProperty('display')}
    }
    frame=request(paint)
  }
  node.addEventListener('pointerenter',replay)
  return {identity,canvas,replay,reset,dispose(){if(disposed)return;reset();disposed=true;node.removeEventListener('pointerenter',replay);canvas.remove();if(ownedClass)node.classList.remove('wbTitleMotionTarget');if(positioned&&node.style.getPropertyValue('position')==='relative'&&(node.style.getPropertyPriority?.('position')??'')===''){position.value?node.style.setProperty('position',position.value,position.priority):node.style.removeProperty('position')}originalPhase===null?node.removeAttribute('data-workbench-title-phase'):node.setAttribute('data-workbench-title-phase',originalPhase)}}
}
function plainText(node){return (node.textContent??'').replace(/\s+/g,' ').trim()}
function eligible(node){if(node.matches?.('button,a[href],input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[tabindex],[contenteditable]')||node.isContentEditable||node.closest?.('button,a[href],[role="button"],[role="link"],[role="textbox"],[contenteditable]'))return false;const text=plainText(node);return text.length>0&&text.length<=80&&!node.querySelector('button,input,textarea,select,[contenteditable]')&&Array.from(node.children).every(child=>child.hasAttribute('data-workbench-title-canvas'))}

/** All observers, media subscriptions, canvases and frames belong to this lifetime. */
export function titleMotion({document,view=document.defaultView,Observer,enabled,media,request=view?.requestAnimationFrame?.bind(view),cancel=view?.cancelAnimationFrame?.bind(view),now=()=>view.performance.now()}) {
  const controllers=new Map();let stopped=false,observer,scheduled=null
  const active=()=>enabled()&&!media.reduced.matches&&media.fine.matches
  const refresh=()=>{
    if(stopped)return
    const nodes=new Set(Array.from(document.querySelectorAll('[data-workbench-title]')).filter(eligible))
    for(const [node,controller] of controllers)if(!node.isConnected||!nodes.has(node)||controller.identity!==plainText(node)||controller.canvas.parentElement!==node){controller.dispose();controllers.delete(node)}
    for(const node of nodes)if(!controllers.has(node)){const controller=textAnimator(node,{document,view,enabled:active,request,cancel,now});if(controller){controllers.set(node,controller);controller.replay()}}
    if(!active())for(const controller of controllers.values())controller.reset()
  }
  const schedule=()=>{if(stopped||scheduled!==null)return;scheduled=request(()=>{scheduled=null;refresh()})}
  const reset=()=>{for(const controller of controllers.values())controller.reset()}
  const mediaChanged=()=>{reset();refresh()}
  const visibilityChanged=()=>{if(document.hidden)reset();else refresh()}
  return {
    refresh,reset,
    replayWithin(node){for(const [title,controller] of controllers)if(node.contains(title))controller.replay()},
    start(){refresh();observer=new Observer(schedule);observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-workbench-title','contenteditable','tabindex','role','href']});document.addEventListener('visibilitychange',visibilityChanged);media.reduced.addEventListener('change',mediaChanged);media.fine.addEventListener('change',mediaChanged);return()=>{if(stopped)return;stopped=true;observer.disconnect();if(scheduled!==null)cancel(scheduled);document.removeEventListener('visibilitychange',visibilityChanged);media.reduced.removeEventListener('change',mediaChanged);media.fine.removeEventListener('change',mediaChanged);for(const controller of controllers.values())controller.dispose();controllers.clear()}},
  }
}
