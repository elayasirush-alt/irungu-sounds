#!/usr/bin/env node
/*
Huge SFX Library Generator
Creates procedural WAV sound effects locally. No API, no internet, no copied samples.
Examples:
  npm run generate:sfx:10k
  npm run generate:sfx:50k
  npm run generate:sfx:100k
Start with 10,000 first. 100,000 files can take time and disk space.
*/
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const totalCount = countArg ? Math.max(1, Number(countArg.split('=')[1])) : 10000;
const sampleRate = 16000;
const sfxDir = path.join(__dirname, '..', 'public', 'sfx');
const manifestPath = path.join(sfxDir, 'sfx-manifest.json');
const nichePath = path.join(sfxDir, 'niche-profiles.json');
if (!fs.existsSync(sfxDir)) fs.mkdirSync(sfxDir, { recursive: true });
let seed = 202607;
function rand(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function noise(){ return rand()*2-1; }
function clamp(x){ return Math.max(-1, Math.min(1, x)); }
function sine(f,t){ return Math.sin(2*Math.PI*f*t); }
function nsec(d){ return Math.max(1, Math.floor(sampleRate*d)); }
function env(i,n,a=0.02,r=0.08){ const aa=Math.max(1,Math.floor(sampleRate*a)); const rr=Math.max(1,Math.floor(sampleRate*r)); if(i<aa)return i/aa; if(i>n-rr)return Math.max(0,(n-i)/rr); return 1; }
function writeWav(filePath, samples){
  let peak=0; for(const s of samples) peak=Math.max(peak,Math.abs(s)); const gain=peak>0.96?0.9/peak:1;
  const dataSize=samples.length*2; const b=Buffer.alloc(44+dataSize);
  b.write('RIFF',0); b.writeUInt32LE(36+dataSize,4); b.write('WAVE',8); b.write('fmt ',12); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(sampleRate,24); b.writeUInt32LE(sampleRate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(dataSize,40);
  for(let i=0;i<samples.length;i++) b.writeInt16LE(Math.round(clamp(samples[i]*gain)*32767),44+i*2);
  fs.writeFileSync(filePath,b);
}
function mix(a,b,g=1){ const n=Math.max(a.length,b.length); const out=new Array(n).fill(0); for(let i=0;i<n;i++) out[i]=(a[i]||0)+(b[i]||0)*g; return out; }
function boom(i,harsh=false){ const n=nsec(0.55+(i%20)*0.025), base=35+(i%35)*2.4, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,e=Math.exp(-4.2*p); out.push((sine(base*(1-0.4*p),t)*0.9+noise()*(harsh?0.18:0.07))*e);} return out; }
function hit(i,mat='generic'){ const n=nsec(0.20+(i%15)*0.018), toneBase=mat==='metal'?180:mat==='wood'?90:mat==='glass'?650:120, tone=toneBase+(i%40)*7, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,d=mat==='glass'?Math.exp(-5*p):Math.exp(-9*p); out.push((noise()*0.45+sine(tone,t)*0.36+sine(tone*2.07,t)*0.16)*d);} return out; }
function whoosh(i,rev=false,soft=false){ const n=nsec(0.32+(i%25)*0.018), start=100+(i%30)*9, end=soft?900+(i%20)*18:1500+(i%40)*25, out=[]; let prev=0; for(let k=0;k<n;k++){ let p=k/Math.max(1,n-1); const ep=p; if(rev)p=1-p; const t=k/sampleRate,e=Math.pow(Math.sin(Math.PI*ep),1.3); prev=.74*prev+.26*noise(); out.push((prev*(soft?.28:.42)+sine(start+(end-start)*p,t)*.16)*e);} return out; }
function riser(i){ const n=nsec(.55+(i%28)*.035), start=60+(i%20)*7, end=700+(i%45)*34, out=[]; for(let k=0;k<n;k++){ const p=k/Math.max(1,n-1), t=k/sampleRate, e=Math.pow(p,1.15), f=start+(end-start)*p; out.push((sine(f,t)*.25+sine(f*1.51,t)*.11+noise()*.05)*e);} return out; }
function drone(i,bright=false){ const n=nsec(.9+(i%28)*.045), root=bright?110+(i%35)*5:35+(i%45)*3, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,w=1+.01*sine(.25+(i%9)*.04,t), e=env(k,n,.2,.25); out.push((sine(root*w,t)*.24+sine(root*1.5*w,t)*.12+sine(root*2.01*w,t)*.06)*e);} return out; }
function beep(i,urgent=false){ const n=nsec(.18+(i%14)*.018), f1=urgent?650+(i%35)*25:450+(i%40)*16, f2=urgent?430+(i%25)*15:350+(i%20)*12, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate, seg=Math.floor(t/.09)%2, gate=(t%.12)<.08?1:0; out.push(sine(seg===0?f1:f2,t)*.42*gate*env(k,n,.005,.03));} return out; }
function glitch(i){ const n=nsec(.16+(i%18)*.018), freqs=[160,220,330,440,660,880,990], f=freqs[i%freqs.length], out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate, gate=Math.floor(t*(22+(i%20)))%3!==0?1:.15, bit=noise()>0?1:-1; out.push((sine(f*(1+.5*sine(12+(i%10),t)),t)*.22+bit*.13+noise()*.08)*gate*env(k,n,.005,.04));} return out; }
function atmos(i,type){ const n=nsec(1+(i%30)*.04), out=[]; let prev=0, crack=0; for(let k=0;k<n;k++){ const t=k/sampleRate; prev=.985*prev+.015*noise(); let s=prev; if(type==='water')s=prev*.25+sine(220+(i%20)*9,t)*.04; if(type==='wind')s=prev*(.42+.3*sine(.35,t)); if(type==='fire'){ if(rand()<.008)crack=noise()*.7; crack*=.90; s=noise()*.14+crack; } if(type==='rain')s=noise()*.18+(rand()<.03?noise()*.5:0); if(type==='radio')s=noise()*.22+sine(120+(i%20)*12,t)*.08; out.push(s*env(k,n,.08,.15));} return out; }
function steps(i,run=false){ const n=nsec(run?.85:1.2), out=new Array(n).fill(0), pos=run?[.06,.20,.34,.48,.62,.76]:[.08,.36,.64,.92]; for(const p0 of pos){ const st=Math.floor(p0*n), len=nsec(.06+(i%6)*.005); for(let j=0;j<len&&st+j<n;j++){ const p=j/len; out[st+j]+=(noise()*.26+sine(70+(i%30),j/sampleRate)*.16)*Math.exp(-7*p); }} return out; }
function machine(i,engine=false){ const n=nsec(.65+(i%18)*.03), out=[], base=engine?55+(i%35)*3:85+(i%45)*4; for(let k=0;k<n;k++){ const t=k/sampleRate, rate=5+(i%14), gate=.35+.65*((sine(rate,t)+1)/2); out.push((sine(base,t)*.3+sine(base*2,t)*.13+noise()*.08)*gate*env(k,n,.03,.08)); } return out; }
function chime(i,bright=false){ const n=nsec(.45+(i%25)*.025), root=bright?620+(i%45)*18:350+(i%35)*12, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,e=Math.exp(-4.8*p); out.push((sine(root,t)*.34+sine(root*2.01,t)*.14+sine(root*3.03,t)*.07)*e);} return out; }
const sfxTypes = [
 ['whoosh','Whoosh',['transition','fast','movement'],i=>whoosh(i)], ['fast-whoosh','Fast Whoosh',['fast','swipe','motion'],i=>whoosh(i)], ['soft-whoosh','Soft Whoosh',['soft','gentle','transition'],i=>whoosh(i,false,true)], ['reverse-whoosh','Reverse Whoosh',['reverse','swell','pullback'],i=>whoosh(i,true)],
 ['cinematic-boom','Cinematic Boom',['boom','impact','deep'],i=>boom(i)], ['sub-boom','Sub Boom',['sub','bass','shock'],i=>boom(i+10)], ['explosion-boom','Explosion Boom',['explosion','blast','destroy'],i=>boom(i,true)], ['impact-hit','Impact Hit',['impact','hit','slam'],i=>hit(i)], ['metal-hit','Metal Hit',['metal','hit','industrial'],i=>hit(i,'metal')], ['wood-hit','Wood Hit',['wood','hit','foley'],i=>hit(i,'wood')], ['glass-hit','Glass Hit',['glass','sharp','hit'],i=>hit(i,'glass')],
 ['riser','Riser',['rise','build','suspense'],i=>riser(i)], ['tension-rise','Tension Rise',['tension','approach','build'],i=>mix(riser(i),drone(i),.35)], ['dark-drone','Dark Drone',['dark','mystery','fear'],i=>drone(i)], ['mystery-drone','Mystery Drone',['mystery','hidden','secret'],i=>drone(i+8)], ['space-ambient','Space Ambient',['space','cosmic','planet'],i=>drone(i,true)], ['luxury-pad','Luxury Pad',['luxury','premium','clean'],i=>drone(i+25,true)],
 ['alarm','Alarm',['alarm','warning','danger'],i=>beep(i,true)], ['warning-beep','Warning Beep',['warning','alert','beep'],i=>beep(i,true)], ['data-beep','Data Beep',['data','computer','signal'],i=>beep(i)], ['radar-ping','Radar Ping',['radar','scanner','signal'],i=>chime(i,true)], ['glitch','Glitch',['glitch','digital','error'],i=>glitch(i)], ['digital-error','Digital Error',['error','tech','system'],i=>mix(glitch(i),beep(i),.35)], ['radio-static','Radio Static',['radio','static','signal'],i=>atmos(i,'radio')], ['electric-zap','Electric Zap',['electric','zap','energy'],i=>mix(glitch(i),hit(i,'glass'),.45)],
 ['wind','Wind',['wind','air','atmosphere'],i=>atmos(i,'wind')], ['water','Water',['water','river','ocean'],i=>atmos(i,'water')], ['rain','Rain',['rain','storm','weather'],i=>atmos(i,'rain')], ['fire','Fire',['fire','flame','burn'],i=>atmos(i,'fire')], ['footsteps','Footsteps',['footsteps','walking','approach'],i=>steps(i)], ['running-steps','Running Steps',['running','chase','steps'],i=>steps(i,true)], ['machine','Machine',['machine','mechanical','industrial'],i=>machine(i)], ['engine','Engine',['engine','car','vehicle'],i=>machine(i,true)], ['soft-chime','Soft Chime',['chime','reveal','soft'],i=>chime(i)], ['success-chime','Success Chime',['success','positive','money'],i=>chime(i,true)], ['cinematic-sting','Cinematic Sting',['sting','shock','reveal'],i=>mix(hit(i),riser(i),.55)]
];
const manifest=[]; const perType=Math.ceil(totalCount/sfxTypes.length); let created=0;
console.log(`Generating ${totalCount} SFX into ${sfxDir}`);
for(const [slug,label,tags,fn] of sfxTypes){ for(let i=0;i<perType && created<totalCount;i++){ const file=`${slug}-${String(i+1).padStart(5,'0')}.wav`; writeWav(path.join(sfxDir,file),fn(i+created)); manifest.push({id:`${slug}-${String(i+1).padStart(5,'0')}`,name:`${label} ${String(i+1).padStart(5,'0')}`,file,category:label,tags}); created++; if(created%1000===0) console.log(`Created ${created}/${totalCount}`); }}
fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2));
const niches={
 'Space Documentary':{description:'Cosmic, mysterious, cinematic, not too noisy.',energy:.82,sfxMaster:32,voiceVolume:100,preferredCategories:['Space Ambient','Dark Drone','Mystery Drone','Riser','Cinematic Boom','Soft Whoosh','Reverse Whoosh','Radar Ping','Data Beep']},
 'Mystery / Horror':{description:'Dark tension, heartbeat, sudden stings.',energy:.9,sfxMaster:36,voiceVolume:100,preferredCategories:['Dark Drone','Mystery Drone','Cinematic Sting','Reverse Whoosh','Tension Rise','Radio Static']},
 'History Documentary':{description:'Serious documentary accents, subtle transitions.',energy:.72,sfxMaster:28,voiceVolume:100,preferredCategories:['Dark Drone','Soft Whoosh','Wind','Cinematic Boom','Riser','Impact Hit']},
 'Business / Wealth':{description:'Clean, modern, money and data cues.',energy:.7,sfxMaster:26,voiceVolume:100,preferredCategories:['Success Chime','Data Beep','Soft Chime','Soft Whoosh','Luxury Pad']},
 'Cars / Engineering':{description:'Mechanical, engine, metal, impact.',energy:.86,sfxMaster:34,voiceVolume:100,preferredCategories:['Engine','Machine','Metal Hit','Impact Hit','Fast Whoosh']},
 'Nature / Wildlife':{description:'Atmospheric nature cues with water, wind, rain, and fire.',energy:.68,sfxMaster:28,voiceVolume:100,preferredCategories:['Wind','Water','Rain','Fire','Soft Whoosh']},
 'News / Crime':{description:'Tense, urgent, alert-like documentary effects.',energy:.82,sfxMaster:32,voiceVolume:100,preferredCategories:['Alarm','Warning Beep','Dark Drone','Tension Rise','Cinematic Sting','Radio Static','Data Beep']},
 'Motivation':{description:'Clean rises, hits, positive chimes.',energy:.78,sfxMaster:28,voiceVolume:100,preferredCategories:['Riser','Soft Chime','Success Chime','Whoosh','Cinematic Boom','Luxury Pad']},
 'Tech / AI':{description:'Digital, data, glitch, scanning sounds.',energy:.78,sfxMaster:30,voiceVolume:100,preferredCategories:['Data Beep','Radar Ping','Glitch','Digital Error','Soft Whoosh']},
 'War / Action':{description:'High-impact, tense, heavy cinematic accents.',energy:.94,sfxMaster:38,voiceVolume:100,preferredCategories:['Explosion Boom','Impact Hit','Cinematic Boom','Alarm','Fast Whoosh']}
};
fs.writeFileSync(nichePath, JSON.stringify(niches,null,2));
console.log('Done. Restart the app after generating a large library.');
