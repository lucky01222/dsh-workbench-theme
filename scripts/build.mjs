import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { resolve } from 'node:path'
await mkdir('dist', { recursive: true })
await writeFile('dist/index.mjs', await readFile('src/index.mjs', 'utf8'))
const inlineCSS={name:'inline-css',setup(build){
  build.onResolve({filter:/\.css\?inline$/},args=>({path:resolve(args.resolveDir,args.path.slice(0,-7)),namespace:'inline-css'}))
  build.onLoad({filter:/.*/,namespace:'inline-css'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))
}}
const result = await build({ entryPoints:['src/client.mjs'], outfile:'dist/client-body.js', write:false, bundle:true, platform:'browser', format:'cjs', jsx:'automatic', target:'es2022', external:['react','react/jsx-runtime','react-dom','@deepseek-ai/*'], loader:{'.png':'dataurl','.jpg':'dataurl','.svg':'dataurl'},plugins:[inlineCSS] })
const js = result.outputFiles.find(file => file.path.endsWith('.js')).text
const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? ''
await writeFile('dist/client.js', `window.__ModuleLoader__.load({id:'dsh-workbench-theme',factory(require){var module={exports:{}};var exports=module.exports;${js}\nconst plugin=module.exports;return {...plugin,apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.setAttribute('data-workbench-theme-style','');style.textContent=${JSON.stringify(css)};document.head.append(style);return()=>style.remove()});return plugin.apply(ctx)}}}});\n`)
console.log('Built independent shared theme for official Web client')
