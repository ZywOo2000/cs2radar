const channel='cs2-radar-v1';
let port;
function send(payload){window.postMessage({channel,from:'extension',...payload},location.origin)}
function connect(){
 if(port)return port;
 port=chrome.runtime.connect({name:channel});
 port.onMessage.addListener(send);
 port.onDisconnect.addListener(()=>{port=null;send({type:'disconnected'})});
 return port;
}
window.addEventListener('message',e=>{
 if(e.source!==window||e.origin!==location.origin||e.data?.channel!==channel||e.data.from!=='website')return;
 const m=e.data;
 if(!['hello','import','cancel','ping'].includes(m.type))return;
 try{connect().postMessage({type:m.type,id:m.id,url:m.url})}catch{port=null;send({type:'disconnected'})}
});
