import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyManual, parseManual, restoreManual, manualDataset, MANUAL_LABEL, MANUAL_COLORS } from '../lib/manual-data.ts';

test('empty, zero and missing values remain distinct; extra metrics do not enable export', () => {
  const d=emptyManual();
  assert.deepEqual(parseManual(d).stats, {});
  Object.assign(d.values,{kpr:'0', swing:'-12.5',firepower:'100'});
  assert.equal(parseManual(d).count,1);
  assert.equal(parseManual(d).ready,false);
  assert.equal(parseManual(d).stats.kpr,0);
  assert.equal(parseManual(d).stats.surviving,undefined);
  Object.assign(d.values,{adr:'108.90',rating:'2.24'});
  assert.equal(parseManual(d).ready,true);
});
test('manual validation rejects nonfinite, malformed, negative and out-of-range values',()=>{
  for(const value of ['NaN','Infinity','1e309','0x10','abc','75%','-','1,2','-0.1']) {
    const d=emptyManual();d.values.kpr=value;assert.ok(parseManual(d).errors.kpr,value);
  }
  for(const key of ['surviving','kast','multiKillPct','firepower']){
    const d=emptyManual(); d.values[key]='100.01';assert.ok(parseManual(d).errors[key]);
    d.values[key]='0';assert.equal(parseManual(d).stats[key],0);
    d.values[key]='100';assert.equal(parseManual(d).stats[key],100);
  }
  const d=emptyManual();Object.assign(d.values,{kpr:'2',adr:'300',rating:'5',swing:'-100'});
  assert.equal(parseManual(d).ready,true);d.values.swing='101';assert.equal(parseManual(d).ready,false);
});
test('draft round trip preserves settings, invalid raw edits and all eight colors',()=>{
  for(const color of MANUAL_COLORS){
    const d=emptyManual();Object.assign(d,{name:'选手',team:'战队',scope:'自定义比赛',color,bestKeys:['rating'],ratingVersion:'3.0'});
    Object.assign(d.values,{rating:'1.32',kast:'75.5',swing:'-'});
    assert.deepEqual(restoreManual(JSON.stringify(d)),d);
  }
  assert.deepEqual(restoreManual(null),emptyManual());
  assert.throws(()=>restoreManual('{broken'));
  assert.throws(()=>restoreManual('{"version":2,"values":{}}'));
});
test('adapter marks manual origin, no profile URL and no fabricated statistics',()=>{
  const d=emptyManual();d.values.kast='75.5';const dataset=manualDataset(d);
  assert.equal(dataset.title,MANUAL_LABEL);assert.equal(dataset.sourceUrl,'');
  assert.equal(dataset.players[0].name,'自定义选手');assert.equal(dataset.players[0].profileUrl,undefined);
  assert.deepEqual(dataset.players[0].stats.manual,{kast:75.5});
  assert.equal(dataset.players[0].ratingVersion,'未标注');
});
test('restoration filters unexpected settings and creates independent drafts',()=>{
  const a=emptyManual(),b=emptyManual();a.values.kpr='3';a.bestKeys.push('kpr');
  assert.equal(b.values.kpr,'');assert.deepEqual(b.bestKeys,[]);
  const restored=restoreManual(JSON.stringify({...a,color:'url(evil)',ratingVersion:'bad',bestKeys:['kpr','unknown']}));
  assert.equal(restored.color,MANUAL_COLORS[0]);assert.equal(restored.ratingVersion,'未标注');assert.deepEqual(restored.bestKeys,['kpr']);
});
