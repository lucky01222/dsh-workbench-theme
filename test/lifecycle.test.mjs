import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
const currentVersion=JSON.parse(readFileSync('package.json','utf8')).version
function harness() {
 const attrs=new Map([['data-foreign','keep']]),styles=new Set(),events=new Set(),windowEvents=new Map(),effects=[],subscriptions=new Set(),registrations=new Map(),pending=new Set(),layers=new Map([['foreign',{}]])
 let plugin,observers=0
 const document={body:{getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},head:{append:style=>styles.add(style)},createElement:()=>{const style={setAttribute(){},remove:()=>styles.delete(style)};return style},querySelectorAll:()=>[],addEventListener:(_name,fn)=>events.add(fn),removeEventListener:(_name,fn)=>events.delete(fn)}
 const react={useSyncExternalStore:(_subscribe,get)=>get(),useState:initial=>[initial,()=>{}]},jsx={jsx:()=>null,jsxs:()=>null,Fragment:()=>null}
 const media={matches:false,addEventListener:(_name,fn)=>events.add(fn),removeEventListener:(_name,fn)=>events.delete(fn)}
 const sandbox={document,window:{addEventListener:(name,fn)=>{let handlers=windowEvents.get(name);if(!handlers){handlers=new Set();windowEvents.set(name,handlers)}handlers.add(fn)},removeEventListener:(name,fn)=>{const handlers=windowEvents.get(name);handlers?.delete(fn);if(!handlers?.size)windowEvents.delete(name)},matchMedia:()=>media,__ModuleLoader__:{load:entry=>{plugin=entry.factory(id=>id==='react'?react:id==='react/jsx-runtime'?jsx:id==='react-dom'?{createPortal:()=>null}:{})}}},MutationObserver:class{observe(){observers++}disconnect(){observers--}},Object,Promise}
 vm.runInNewContext(readFileSync('dist/client.js','utf8'),sandbox)
 const form={getSnapshot:()=>({mode:'memory',status:'unavailable'}),subscribe:fn=>{subscriptions.add(fn);return()=>subscriptions.delete(fn)}}
 const effect=fn=>{const dispose=fn();if(dispose)effects.push(dispose);return dispose}
 const ctx={effect,on:(_name,fn)=>{events.add(fn);effects.push(()=>events.delete(fn))},locale:{register:()=>()=>{},bind:()=>key=>key},configForms:{get:()=>form},theme:{overrideTokens:(source,tokens)=>{layers.set(source,tokens);return()=>layers.delete(source)}},slots:{inject:(name,fn)=>{if(name==='workbench.brand.mark'){pending.add(name);effects.push(()=>pending.delete(name));return}effect(fn)},register:(options,component)=>{registrations.set(options.name,{options,component});return()=>registrations.delete(options.name)}}}
 plugin.apply(ctx)
 return {plugin,attrs,styles,events,windowEvents,subscriptions,registrations,pending,layers,get observers(){return observers},dispose:()=>{for(const fn of effects.reverse())fn()}}
}
test('theme activates without navigation and registers official paired tokens and independent portals',()=>{
 const h=harness();assert.deepEqual(Array.from(h.plugin.inject),['slots','locale','configForms','theme'])
 assert.equal(h.attrs.get('data-workbench-theme'),currentVersion);assert.equal(h.pending.has('workbench.brand.mark'),true)
 assert.equal(h.windowEvents.get('resize').size,1);assert.equal(h.windowEvents.get('blur').size,1)
 assert.equal(h.registrations.get('shell.overlay').options.id,'workbench.theme-artwork')
 assert.equal(h.registrations.has('settings.general.item'),true)
 assert.equal(h.layers.get('dsh-workbench-theme')['--dsw-alias-bg-base'].dark,'#251d2d')
 for(const modes of Object.values(h.layers.get('dsh-workbench-theme'))){assert.equal(typeof modes.light,'string');assert.equal(typeof modes.dark,'string')}
 h.dispose()
})
test('theme unload releases its complete lifetime and retains foreign theme data',()=>{
 const h=harness();h.dispose()
 assert.equal(h.styles.size+h.events.size+h.windowEvents.size+h.subscriptions.size+h.pending.size+h.registrations.size,0);assert.equal(h.observers,0)
 assert.equal(h.attrs.has('data-workbench-theme'),false);assert.equal(h.attrs.has('data-dsh-theme'),false)
 assert.equal(h.attrs.get('data-foreign'),'keep');assert.equal(h.layers.has('foreign'),true);assert.equal(h.layers.has('dsh-workbench-theme'),false)
})
