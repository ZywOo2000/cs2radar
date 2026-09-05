import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='.checks/extension-package';
await mkdir(out,{recursive:true});await mkdir('public/downloads',{recursive:true});
await build({entryPoints:['extension/worker.mjs','extension/extractor.mjs','extension/bridge.mjs'],outdir:out,bundle:true,platform:'browser',target:'chrome120',format:'iife',minify:true});
await copyFile('extension/manifest.json',out+'/manifest.json');
await copyFile('extension/README.md',out+'/README.txt');
if(process.platform==='win32'){
 execFileSync('tar.exe',['-a','-cf','public/downloads/cs2-radar-extension.zip','-C',out,'manifest.json','worker.js','extractor.js','bridge.js','README.txt']);
}else{execFileSync('zip',['-j','-q','public/downloads/cs2-radar-extension.zip',out+'/manifest.json',out+'/worker.js',out+'/extractor.js',out+'/bridge.js',out+'/README.txt'])}
const {version}=JSON.parse(await readFile('extension/manifest.json','utf8'));
await writeFile('public/downloads/extension-version.json',JSON.stringify({version}));
console.log('Extension package ready.');
