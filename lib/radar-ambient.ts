/** Deterministic environment motion shared by live SVG and video snapshots. */
export const ambientParticles = Array.from({length:44}, (_,i) => ({
  x:((i*173+29)%970)+15, y:((i*97+57)%900)+15,
  r:i%4===0?2.6:1.2, opacity:i%3===0?.5:.16,
}));
export function ambientParticleAt(index:number, elapsedMs:number) {
  const base=ambientParticles[index];
  const phase=index*2.399963, t=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)/1000;
  const period=12+(index%13);
  return {cx:base.x+12*(Math.sin(t*Math.PI*2/period+phase)-Math.sin(phase)),
    cy:base.y+16*(Math.sin(t*Math.PI*2/(period+3)+phase)-Math.sin(phase)),
    opacity:base.opacity*(.82+.18*Math.cos(t*Math.PI*2/(period+1)))};
}
export function ambientGlowAt(index:number, elapsedMs:number) {
  const t=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)/1000;
  const phase=index*Math.PI/2, angle=t*Math.PI*2/(24+index*6);
  const x=18*(Math.sin(angle+phase)-Math.sin(phase));
  const y=14*(Math.cos(angle+phase)-Math.cos(phase));
  const scale=1+.025*Math.sin(angle);
  const cx=index===0?760:170, cy=index===0?780:500;
  return `translate(${x} ${y}) translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
}
const lastAmbientFrame=new WeakMap<Element,number>();
export function applyRadarAmbient(svg:Element, elapsedMs:number) {
  const bucket=Math.floor(Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)/(1000/30));
  if(lastAmbientFrame.get(svg)===bucket)return;
  lastAmbientFrame.set(svg,bucket);
  svg.querySelectorAll('[data-test-particle]').forEach(node=>{
    const i=Number(node.getAttribute('data-test-particle'));if(!Number.isInteger(i)||!testParticles[i])return;
    const state=testParticleAt(i,elapsedMs);node.setAttribute('transform',state.transform);node.setAttribute('opacity',String(state.opacity));
  });
  svg.querySelectorAll('[data-test-glow]').forEach(node=>{
    const i=Number(node.getAttribute('data-test-glow'));if(Number.isInteger(i)&&i>=0&&i<3)node.setAttribute('transform',testGlowAt(i,elapsedMs));
  });
  svg.querySelectorAll('[data-ambient-particle]').forEach(node=>{
    const index=Number(node.getAttribute('data-ambient-particle'));
    if(!Number.isInteger(index)||!ambientParticles[index])return;
    const state=ambientParticleAt(index,elapsedMs);
    node.setAttribute('cx',String(state.cx));node.setAttribute('cy',String(state.cy));
    node.setAttribute('opacity',String(state.opacity));
  });
  svg.querySelectorAll('[data-ambient-glow]').forEach(node=>{
    const index=Number(node.getAttribute('data-ambient-glow'));
    if(index===0||index===1)node.setAttribute('transform',ambientGlowAt(index,elapsedMs));
  });
}

export const testParticles=Array.from({length:144},(_,i)=>({
 x:((i*317+61)%990)+5,y:((i*193+79)%950)+5,
 star:i>=120,r:i>=120?3.2+(i%4)*.7:.8+(i%5)*.27,
}));
export function testParticleAt(index:number,elapsedMs:number){
 const p=testParticles[index],t=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)/1000;
 const phase=index*2.399963,a=t*Math.PI*2/(10+index%11),b=t*Math.PI*2/(13+index%9);
 const x=p.x+24*(Math.sin(a+phase)-Math.sin(phase)),y=p.y+32*(Math.cos(b+phase)-Math.cos(phase));
 const center=Math.hypot((p.x-500)/500,(p.y-450)/480)<.55;
 const opacity=(p.star?.75:.55)*(center?.48:1)*(.65+.35*Math.sin(t*1.2+phase)**2);
 return {transform:`translate(${x} ${y})`,opacity};
}
export function testGlowAt(index:number,elapsedMs:number){
 const t=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)/1000,a=t*Math.PI*2/(18+index*4),phase=index*2;
 return `translate(${75*Math.sin(a+phase)} ${60*Math.cos(a*.8+phase)}) translate(500 480) scale(${1+.07*Math.sin(a+phase)}) translate(-500 -480)`;
}
