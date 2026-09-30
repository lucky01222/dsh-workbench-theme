import test from 'node:test'
import assert from 'node:assert/strict'
import {textAnimator,titleMotion} from '../src/title-motion.mjs'

class Element {
 constructor(tag='span',text=''){this.tagName=tag;this.label=text;this.children=[];this.attrs=new Map();this.classes=new Set();this.handlers=new Map();this.mounted=true;this.properties=new Map();this.priorities=new Map();this.style={getPropertyValue:k=>this.properties.get(k)||'',getPropertyPriority:k=>this.priorities.get(k)||'',setProperty:(k,v,p='')=>{this.properties.set(k,v);this.priorities.set(k,p)},removeProperty:k=>{this.properties.delete(k);this.priorities.delete(k)}};this.classList={contains:k=>this.classes.has(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)};this.bounds={left:0,top:0,right:450,bottom:30,width:450,height:30}}
 get parentElement(){return this.parent??null}
 get isConnected(){return this.parent?this.parent.isConnected:this.mounted}
 get textContent(){return this.label+this.children.map(x=>x.textContent).join('')}
 getAttribute(k){return this.attrs.get(k)??null}
 setAttribute(k,v){this.attrs.set(k,v)}
 removeAttribute(k){this.attrs.delete(k)}
 hasAttribute(k){return this.attrs.has(k)}
 querySelector(){return this.interactive?{}:null}
 append(node){node.parent=this;this.children.push(node)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.mounted=false}
 addEventListener(k,fn){this.handlers.set(k,fn)}
 removeEventListener(k){this.handlers.delete(k)}
 getBoundingClientRect(){return {...this.bounds}}
 contains(node){return node===this||this.children.some(child=>child.contains(node))}
}
function fixture(){
 const title=new Element('h1','比护的 AI 工作台'),body=new Element('body');body.append(title);title.setAttribute('data-workbench-title','')
 let time=0,next=0,enabled=true,graphics=true,observerCallback,observerCount=0,observedOptions
 const frames=new Map(),handlers=new Map()
 const draw={setTransform(){},clearRect(){},fillText(){},strokeText(){},beginPath(){},arc(){},fill(){},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x%2===1)data[(y*w+x)*4+3]=255;return {data}}}
 const document={body,hidden:false,createElement:tag=>{const node=new Element(tag);if(tag==='canvas')node.getContext=()=>graphics?draw:null;return node},querySelectorAll:()=>title.isConnected&&title.hasAttribute('data-workbench-title')?[title]:[],addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)}
 const request=fn=>{const id=++next;frames.set(id,fn);return id},cancel=id=>frames.delete(id)
 const view={devicePixelRatio:2,innerHeight:720,performance:{now:()=>time},getComputedStyle:node=>({fontSize:'20px',fontWeight:'600',fontFamily:'system-ui',position:'static',textAlign:'left',letterSpacing:'0px',color:node.style.getPropertyValue('color')||'#34253e',getPropertyValue:()=> '#664b7f'}),requestAnimationFrame:request,cancelAnimationFrame:cancel}
 const reducedHandlers=new Map(),fineHandlers=new Map(),media={reduced:{matches:false,addEventListener:(k,fn)=>reducedHandlers.set(k,fn),removeEventListener:k=>reducedHandlers.delete(k)},fine:{matches:true,addEventListener:(k,fn)=>fineHandlers.set(k,fn),removeEventListener:k=>fineHandlers.delete(k)}}
 const Observer=class{constructor(fn){observerCallback=fn}observe(_node,options){observerCount++;observedOptions=options}disconnect(){observerCount--}}
 return {title,document,view,media,Observer,frames,handlers,reducedHandlers,fineHandlers,request,cancel,now:()=>time,enabled:()=>enabled,setEnabled:v=>{enabled=v},setGraphics:v=>{graphics=v},get observerCount(){return observerCount},triggerObserver:()=>observerCallback(),setTextNodeData(value){title.label=value;if(observedOptions?.characterData)observerCallback([{type:'characterData'}])},tick(ms=16){time+=ms;const pending=Array.from(frames);frames.clear();for(const [,fn] of pending)fn(time)}}
}
test('title sequence bounds its particle count and stops after completing',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();assert.equal(f.title.style.getPropertyValue('color'),'transparent');assert.ok(Number(a.canvas.getAttribute('data-workbench-title-dots'))<=170)
 f.tick(150);assert.equal(f.title.getAttribute('data-workbench-title-phase'),'dots');f.tick(500);assert.equal(f.title.getAttribute('data-workbench-title-phase'),'outline');f.tick(450)
 assert.equal(f.title.getAttribute('data-workbench-title-phase'),'complete');assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(f.title.textContent,'比护的 AI 工作台');a.dispose()
})
test('replay cancels the older frame and unload restores styles and metadata',()=>{
 const f=fixture();f.title.style.setProperty('color','#123456');f.title.setAttribute('data-workbench-title-phase','foreign')
 const a=textAnimator(f.title,f);a.replay();a.replay();assert.equal(f.frames.size,1);a.dispose();a.dispose();f.tick(2000)
 assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'#123456');assert.equal(f.title.style.getPropertyValue('position'),'');assert.equal(f.title.getAttribute('data-workbench-title-phase'),'foreign');assert.equal(f.title.children.length,0);assert.equal(f.title.handlers.size,0)
})
test('foreign color writes during animation survive cleanup',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();f.title.style.setProperty('color','#abcdef');a.dispose();assert.equal(f.title.style.getPropertyValue('color'),'#abcdef')
})
test('hidden or disabled targets cancel rendering and restore readable text',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();f.document.hidden=true;f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'')
 f.document.hidden=false;a.replay();f.setEnabled(false);f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');a.dispose()
})
test('offscreen, multiline, missing graphics and detached targets stay readable',()=>{
 const f=fixture();f.setGraphics(false);assert.equal(textAnimator(f.title,f),undefined);assert.equal(f.title.children.length,0)
 f.setGraphics(true);const a=textAnimator(f.title,f);f.title.bounds.height=80;a.replay();assert.equal(f.frames.size,0)
 f.title.bounds.height=30;f.title.bounds.top=800;a.replay();assert.equal(f.frames.size,0)
 f.title.bounds.top=0;a.replay();f.title.remove();f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');a.dispose()
})
test('manager respects reduced motion and cleans all observers and pending work',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start();assert.equal(f.frames.size,1)
 f.media.reduced.matches=true;f.reducedHandlers.get('change')();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'')
 f.media.reduced.matches=false;f.media.fine.matches=false;manager.replayWithin(f.document.body);assert.equal(f.frames.size,0)
 f.triggerObserver();dispose();f.tick(2000);assert.equal(f.frames.size,0);assert.equal(f.observerCount,0);assert.equal(f.handlers.size+f.reducedHandlers.size+f.fineHandlers.size,0);assert.equal(f.title.children.length,0);assert.equal(f.title.hasAttribute('data-workbench-title-phase'),false)
})
test('manager skips interactive titles and adopts native text replacements',()=>{
 const f=fixture();f.title.interactive=true;const manager=titleMotion(f),dispose=manager.start();assert.equal(f.title.children.length,0)
 f.title.interactive=false;manager.refresh();assert.equal(f.title.children.length,1)
 f.title.label='Plugins';manager.refresh();assert.equal(f.title.children.length,1);assert.equal(f.title.textContent,'Plugins')
 f.title.removeAttribute('data-workbench-title');manager.refresh();assert.equal(f.title.children.length,0);assert.equal(f.title.style.getPropertyValue('color'),'');dispose()
})
test('React-style text-node updates invalidate the old glyphs without a child-list mutation',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start(),oldCanvas=f.title.children[0]
 f.setTextNodeData('Plugins');f.tick()
 assert.equal(oldCanvas.parentElement,null);assert.equal(f.title.children.length,1);assert.equal(f.title.textContent,'Plugins')
 f.tick(1100);f.title.handlers.get('pointerenter')();assert.equal(f.frames.size,1);dispose()
})
test('interactive roots and editable ancestors never acquire canvases',()=>{
 for(const kind of ['button','link','editable-ancestor']){const f=fixture();if(kind==='editable-ancestor')f.title.closest=()=>new Element('div');else f.title.matches=()=>true;const dispose=titleMotion(f).start();assert.equal(f.title.children.length,0);assert.equal(f.title.style.getPropertyValue('color'),'');dispose()}
})
test('same-value foreign important declarations survive animation teardown',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();f.title.style.setProperty('color','transparent','important');f.title.style.setProperty('position','relative','important');a.dispose()
 assert.equal(f.title.style.getPropertyValue('color'),'transparent');assert.equal(f.title.style.getPropertyPriority('color'),'important');assert.equal(f.title.style.getPropertyValue('position'),'relative');assert.equal(f.title.style.getPropertyPriority('position'),'important')
})
test('layout reflow during a sequence immediately restores every line of native text',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();f.title.bounds.height=80;f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(a.canvas.style.getPropertyValue('display'),'');a.dispose()
})
test('width-only reflow and a newly editable title also stop the overlay',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();f.title.bounds.width=280;f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'')
 a.replay();f.title.isContentEditable=true;f.tick();assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');a.dispose()
})
