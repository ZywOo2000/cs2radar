'use client';
import {useEffect,useRef,useState} from 'react';
import type {Dataset} from './stats';
const channel='cs2-radar-v1';
type Pending={resolve:(data:Dataset)=>void;reject:(e:Error)=>void;progress:(message:string)=>void;cleanup:()=>void};
export function useHltvExtension(){
 const [connected,setConnected]=useState(false);
 const pending=useRef(new Map<string,Pending>());
 function send(message:object){window.postMessage({channel,from:'website',...message},location.origin)}
 useEffect(()=>{
  const onMessage=(e:MessageEvent)=>{
   if(e.source!==window||e.origin!==location.origin||e.data?.channel!==channel||e.data.from!=='extension')return;
   const m=e.data;
   if(m.type==='ready'){setConnected(true);return}
   if(m.type==='disconnected'){setConnected(false);for(const p of pending.current.values()){p.cleanup();p.reject(new Error('扩展连接中断，请刷新网页后重试。'))}pending.current.clear();return}
   const p=pending.current.get(m.id);if(!p)return;
   if(m.type==='progress'){p.progress(String(m.message).slice(0,500));return}
   if(m.type==='result'||m.type==='error'){
    pending.current.delete(m.id);p.cleanup();
    if(m.type==='error'){p.reject(new Error(String(m.message)));return}
    const d=m.data;
    if(!d||!Array.isArray(d.players)||!d.players.length||!Array.isArray(d.scopes)||!Array.isArray(d.notes)||!['match','event','player'].includes(d.kind)){p.reject(new Error('扩展返回的数据格式无法识别。'));return}
    p.resolve(d);
   }
  };
  window.addEventListener('message',onMessage);
  send({type:'hello'});
  const timer=setInterval(()=>send({type:pending.current.size?'ping':'hello'}),15000);
  const jobs=pending.current;
  return()=>{clearInterval(timer);window.removeEventListener('message',onMessage);for(const [id,p]of jobs){send({type:'cancel',id});p.cleanup();p.reject(new Error('读取已取消。'))}jobs.clear()};
 },[]);
 function request(url:string,progress:(message:string)=>void,signal:AbortSignal):Promise<Dataset>{
  return new Promise((resolve,reject)=>{
   if(!connected){reject(new Error('未检测到扩展。请安装后在同一个 Chrome / Edge 浏览器刷新此网站。'));return}
   if(signal.aborted){reject(new Error('读取已取消。'));return}
   const id=crypto.randomUUID();
   const abort=()=>{pending.current.delete(id);send({type:'cancel',id});cleanup();reject(new Error('读取已取消。'))};
   const timer=setTimeout(()=>{pending.current.delete(id);send({type:'cancel',id});cleanup();reject(new Error('扩展读取超时，请检查 HLTV 页面后重试。'))},190000);
   const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort)};
   signal.addEventListener('abort',abort,{once:true});
   pending.current.set(id,{resolve,reject,progress,cleanup});send({type:'import',id,url});
  });
 }
 return {connected,request};
}
