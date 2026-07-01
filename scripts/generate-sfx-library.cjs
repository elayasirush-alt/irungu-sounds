#!/usr/bin/env node
/*
IRUNGU SOUNDS - Natural Common SFX Generator
Creates procedural WAV sound effects locally. No API, no internet, no copied samples.
This version keeps all original categories AND adds a large set of natural,
everyday, non-irritating sounds (rain, wind, waves, birds, footsteps, paper,
clocks, doors, typing, claps, heartbeat, breathing) using soft low-pass
filtering so textures sound organic instead of harsh synthetic noise.
*/
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const totalCount = countArg ? Math.max(1, Number(countArg.split('=')[1])) : 6000;
const sampleRate = 16000;
const sfxDir = path.join(__dirname, '..', 'public', 'sfx');
const manifestPath = path.join(sfxDir, 'sfx-manifest.json');
if (!fs.existsSync(sfxDir)) fs.mkdirSync(sfxDir, { recursive: true });

let seed = 202607;
function rand(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function noise(){ return rand()*2-1; }
function clamp(x){ return Math.max(-1, Math.min(1, x)); }
function sine(f,t){ return Math.sin(2*Math.PI*f*t); }
function nsec(d){ return Math.max(1, Math.floor(sampleRate*d)); }
function env(i,n,a=0.02,r=0.08){ const aa=Math.max(1,Math.floor(sampleRate*a)); const rr=Math.max(1,Math.floor(sampleRate*r)); if(i<aa)return i/aa; if(i>n-rr)return Math.max(0,(n-i)/rr); return 1; }

function lowpass(samples, amount=0.12, passes=2){
  let out = samples;
  for(let p=0;p<passes;p++){
    let prev = 0; const next = new Array(out.length);
    for(let i=0;i<out.length;i++){ prev = prev + amount*(out[i]-prev); next[i]=prev; }
    out = next;
  }
  return out;
}

function writeWav(filePath, samples){
  let peak=0; for(const s of samples) peak=Math.max(peak,Math.abs(s)); const gain=peak>0.92?0.82/peak:1;
  const dataSize=samples.length*2; const b=Buffer.alloc(44+dataSize);
  b.write('RIFF',0); b.writeUInt32LE(36+dataSize,4); b.write('WAVE',8); b.write('fmt ',12); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(sampleRate,24); b.writeUInt32LE(sampleRate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(dataSize,40);
  for(let i=0;i<samples.length;i++) b.writeInt16LE(Math.round(clamp(samples[i]*gain)*32767),44+i*2);
  fs.writeFileSync(filePath,b);
}
function mix(a,b,g=1){ const n=Math.max(a.length,b.length); const out=new Array(n).fill(0); for(let i=0;i<n;i++) out[i]=(a[i]||0)+(b[i]||0)*g; return out; }

function boom(i,harsh=false){ const n=nsec(0.5+(i%18)*0.022), base=38+(i%30)*2.1, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,e=Math.exp(-4.6*p); out.push((sine(base*(1-0.35*p),t)*0.8+noise()*(harsh?0.1:0.05))*e);} return lowpass(out,0.35,1); }
function hit(i,mat='generic'){ const n=nsec(0.16+(i%12)*0.015), toneBase=mat==='metal'?170:mat==='wood'?95:120, tone=toneBase+(i%30)*5, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,d=Math.exp(-9*p); out.push((noise()*0.3+sine(tone,t)*0.32+sine(tone*2,t)*0.12)*d);} return lowpass(out,0.4,1); }
function whoosh(i,rev=false,soft=false){ const n=nsec(0.3+(i%22)*0.016), start=100+(i%26)*8, end=soft?800+(i%18)*16:1200+(i%32)*20, out=[]; let prev=0; for(let k=0;k<n;k++){ let p=k/Math.max(1,n-1); const ep=p; if(rev)p=1-p; const t=k/sampleRate,e=Math.pow(Math.sin(Math.PI*ep),1.3); prev=.78*prev+.22*noise(); out.push((prev*(soft?.22:.34)+sine(start+(end-start)*p,t)*.12)*e);} return out; }
function riser(i){ const n=nsec(.5+(i%24)*.03), start=65+(i%18)*6, end=600+(i%38)*26, out=[]; for(let k=0;k<n;k++){ const p=k/Math.max(1,n-1), t=k/sampleRate, e=Math.pow(p,1.15), f=start+(end-start)*p; out.push((sine(f,t)*.2+sine(f*1.5,t)*.08+noise()*.03)*e);} return out; }
function drone(i,bright=false){ const n=nsec(.85+(i%24)*.04), root=bright?108+(i%30)*4:36+(i%38)*2.4, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,w=1+.008*sine(.22+(i%8)*.03,t), e=env(k,n,.2,.25); out.push((sine(root*w,t)*.2+sine(root*1.5*w,t)*.09+sine(root*2*w,t)*.04)*e);} return out; }
function chime(i,bright=false){ const n=nsec(.4+(i%20)*.02), root=bright?580+(i%38)*15:330+(i%30)*10, out=[]; for(let k=0;k<n;k++){ const t=k/sampleRate,p=k/n,e=Math.exp(-4.6*p); out.push((sine(root,t)*.28+sine(root*2,t)*.1+sine(root*3,t)*.04)*e);} return out; }
function clickSoft(i){ const n=nsec(.05+(i%6)*.006), out=[]; for(let k=0;k<n;k++){ const p=k/n,e=Math.exp(-14*p); out.push((noise()*.22+sine(900+(i%20)*15,k/sampleRate)*.1)*e);} return lowpass(out,0.45,1); }
function steps(i,run=false,soft=true){ const n=nsec(run?.8:1.1), out=new Array(n).fill(0), pos=run?[.06,.20,.34,.48,.62,.76]:[.08,.36,.64,.92]; for(const p0 of pos){ const st=Math.floor(p0*n), len=nsec(.06+(i%5)*.004); for(let j=0;j<len&&st+j<n;j++){ const p=j/len; out[st+j]+=(noise()*(soft?.16:.24)+sine(68+(i%24),j/sampleRate)*.1)*Math.exp(-8*p); }} return lowpass(out,0.5,1); }
function fall(i){ const n=nsec(.4+(i%16)*.02), start=500+(i%30)*15, end=90+(i%20)*4, out=[]; for(let k=0;k<n;k++){ const p=k/n,t=k/sampleRate,f=start+(end-start)*p,e=Math.exp(-3.2*p); out.push((sine(f,t)*.24+noise()*.06)*e);} return out; }

function naturalLoop(i,kind){
  const n = nsec(1.1 + (i%26)*.05);
  const out = []; let prev=0, crack=0, chirpLeft=0, chirpFreq=600;
  for(let k=0;k<n;k++){
    const t = k/sampleRate;
    prev = .985*prev + .015*noise();
    let s = prev;
    if(kind==='rain'){ s = prev*.55 + (rand()<.02?noise()*.3:0); }
    if(kind==='breeze'){ s = prev*(.34+.22*sine(.18+(i%6)*.02,t)); }
    if(kind==='ocean'){ s = prev*(.4+.32*Math.max(0,sine(.12+(i%5)*.015,t))); }
    if(kind==='river'){ s = prev*.42 + sine(180+(i%20)*6,t)*.02; }
    if(kind==='crowd'){ s = prev*.34 + sine(140+(i%14)*4,t)*.015 + sine(220+(i%18)*5,t)*.012; }
    if(kind==='fire'){ if(rand()<.006) crack=noise()*.5; crack*=.90; s = noise()*.10+crack; }
    if(kind==='birds'){
      s = prev*.06;
      if(chirpLeft<=0 && rand()<.01){ chirpLeft = nsec(.06+rand()*.05); chirpFreq = 1800+rand()*1400; }
      if(chirpLeft>0){ const cp = 1 - (chirpLeft/nsec(.1)); s += sine(chirpFreq*(1+.3*cp),t)*.18*Math.sin(Math.PI*Math.min(1,cp)); chirpLeft--; }
    }
    if(kind==='crickets'){
      const cyc = (t*5.2)%1;
      const gate = cyc<.18 ? Math.sin(Math.PI*(cyc/.18)) : 0;
      s = sine(2600+(i%6)*60,t)*.07*gate + prev*.03;
    }
    out.push(s*env(k,n,.15,.2));
  }
  return lowpass(out, kind==='birds'||kind==='crickets' ? 0.6 : 0.18, kind==='birds'||kind==='crickets'?1:2);
}

function foleyNatural(i,kind){
  if(kind==='paper'){ const n=nsec(.3+(i%10)*.02), out=[]; for(let k=0;k<n;k++){ const p=k/n; out.push(noise()*.22*Math.sin(Math.PI*p)); } return lowpass(out,0.5,1); }
  if(kind==='pageturn'){ const n=nsec(.4+(i%10)*.02), out=[]; for(let k=0;k<n;k++){ const p=k/n; out.push(noise()*.2*Math.sin(Math.PI*Math.pow(p,.7))); } return lowpass(out,0.45,2); }
  if(kind==='clocktick'){ const n=nsec(.07), out=[]; for(let k=0;k<n;k++){ const p=k/n,e=Math.exp(-30*p); out.push((noise()*.18+sine(1400,k/sampleRate)*.1)*e); } return lowpass(out,0.55,1); }
  if(kind==='doorcreak'){ const n=nsec(.5+(i%14)*.03), out=[]; const f0=180+(i%10)*8; for(let k=0;k<n;k++){ const p=k/n,t=k/sampleRate,f=f0*(1+.5*Math.sin(Math.PI*p)); out.push((sine(f,t)*.14+noise()*.05)*env(k,n,.05,.2)); } return lowpass(out,0.4,1); }
  if(kind==='doorclose'){ const n=nsec(.22), out=[]; for(let k=0;k<n;k++){ const p=k/n,e=Math.exp(-10*p); out.push((noise()*.2+sine(140,k/sampleRate)*.22)*e); } return lowpass(out,0.45,1); }
  if(kind==='keyboard'){ const n=nsec(.6+(i%10)*.02), out=new Array(n).fill(0); const taps=3+(i%3); for(let tIdx=0;tIdx<taps;tIdx++){ const st=Math.floor((tIdx/taps)*n + (rand()*0.05*n)); const len=nsec(.02); for(let j=0;j<len && st+j<n;j++){ const p=j/len; out[st+j]+=noise()*.16*Math.exp(-20*p); } } return lowpass(out,0.55,1); }
  if(kind==='clap'){ const n=nsec(.12), out=[]; for(let k=0;k<n;k++){ const p=k/n,e=Math.exp(-16*p); out.push(noise()*.28*e); } return lowpass(out,0.4,1); }
  return [];
}

function bodyPulse(i,kind){
  if(kind==='heartbeat'){
    const n=nsec(1.0); const out=new Array(n).fill(0);
    const beats=[.08,.22];
    for(const b of beats){ const st=Math.floor(b*n), len=nsec(.12); for(let j=0;j<len && st+j<n;j++){ const p=j/len,t=j/sampleRate,e=Math.exp(-9*p); out[st+j]+=sine(58,t)*.3*e; } }
    return lowpass(out,0.5,1);
  }
  if(kind==='breathing'){
    const n=nsec(1.6+(i%10)*.05); const out=[];
    for(let k=0;k<n;k++){ const p=k/n, sw=Math.sin(Math.PI*p); out.push(noise()*.1*sw); }
    return lowpass(out,0.15,2);
  }
  return [];
}

const sfxTypes = [
 ['cinematic-whoosh','Cinematic Whoosh',['cinematic whoosh','transition'],i=>whoosh(i)],
 ['soft-whoosh','Soft Whoosh',['soft whoosh','gentle transition'],i=>whoosh(i,false,true)],
 ['deep-whoosh','Deep Whoosh',['deep whoosh','heavy transition'],i=>whoosh(i+5)],
 ['reverse-whoosh','Reverse Whoosh',['reverse whoosh','swell'],i=>whoosh(i,true)],
 ['camera-transition','Camera Transition',['camera transition','swipe'],i=>whoosh(i+9,false,true)],
 ['clean-sweep','Clean Sweep',['clean sweep','wipe'],i=>whoosh(i+13,false,true)],
 ['cinematic-hit','Cinematic Hit',['cinematic hit','impact'],i=>hit(i)],
 ['trailer-hit','Trailer Hit',['trailer hit','boom'],i=>boom(i)],
 ['soft-impact','Soft Impact',['soft impact','gentle hit'],i=>hit(i+3)],
 ['low-impact','Low Impact',['low impact','soft thud'],i=>boom(i+4)],
 ['riser','Riser',['riser','build up'],i=>riser(i)],
 ['tension-riser','Tension Riser',['tension riser','suspense'],i=>mix(riser(i),drone(i),.3)],
 ['dark-drone','Dark Drone',['dark drone','mystery'],i=>drone(i)],
 ['warm-atmosphere','Warm Atmosphere',['warm atmosphere','ambience'],i=>drone(i+10,true)],
 ['nature-ambience','Nature Ambience',['nature ambience','outdoors'],i=>naturalLoop(i,'breeze')],
 ['water-ambience','Water Ambience',['water ambience','stream'],i=>naturalLoop(i,'river')],
 ['fire-ambience','Fire Ambience',['fire ambience','crackle'],i=>naturalLoop(i,'fire')],
 ['crowd-ambience','Crowd Ambience',['crowd ambience','people'],i=>naturalLoop(i,'crowd')],
 ['footsteps-movement','Footsteps Movement',['footsteps','walking'],i=>steps(i)],
 ['soft-ui-click','Soft UI Click',['soft click','ui'],i=>clickSoft(i)],
 ['soft-notification','Soft Notification',['soft notification','alert'],i=>chime(i)],
 ['documentary-sting','Documentary Sting',['documentary sting','reveal'],i=>mix(hit(i),riser(i),.4)],
 ['cinematic-pulse','Cinematic Pulse',['cinematic pulse','heartbeat pulse'],i=>drone(i+15)],
 ['animal-wildlife','Animal Wildlife',['animal','wildlife'],i=>naturalLoop(i,'birds')],
 ['fall','Fall',['fall','drop'],i=>fall(i)],

 ['light-rain','Light Rain',['rain','soft rain','weather'],i=>naturalLoop(i,'rain')],
 ['soft-breeze','Soft Breeze',['wind','breeze','air'],i=>naturalLoop(i,'breeze')],
 ['ocean-waves','Ocean Waves',['ocean','waves','beach'],i=>naturalLoop(i,'ocean')],
 ['river-stream','River Stream',['river','stream','creek'],i=>naturalLoop(i,'river')],
 ['birds-chirping','Birds Chirping',['birds','chirping','morning'],i=>naturalLoop(i,'birds')],
 ['crickets-night','Crickets Night',['crickets','night','evening'],i=>naturalLoop(i,'crickets')],
 ['crowd-murmur','Crowd Murmur',['crowd','murmur','people talking'],i=>naturalLoop(i,'crowd')],
 ['fireplace-crackle','Fireplace Crackle',['fireplace','crackle','cozy'],i=>naturalLoop(i,'fire')],
 ['paper-rustle','Paper Rustle',['paper','rustle','documents'],i=>foleyNatural(i,'paper')],
 ['page-turn','Page Turn',['page turn','book','reading'],i=>foleyNatural(i,'pageturn')],
 ['clock-tick','Clock Tick',['clock','tick','time'],i=>foleyNatural(i,'clocktick')],
 ['door-creak','Door Creak',['door','creak','open'],i=>foleyNatural(i,'doorcreak')],
 ['door-close','Door Close',['door','close','shut'],i=>foleyNatural(i,'doorclose')],
 ['keyboard-typing','Keyboard Typing',['keyboard','typing','office'],i=>foleyNatural(i,'keyboard')],
 ['soft-clap','Soft Clap',['clap','applause','soft'],i=>foleyNatural(i,'clap')],
 ['heartbeat-soft','Heartbeat Soft',['heartbeat','pulse','calm'],i=>bodyPulse(i,'heartbeat')],
 ['calm-breathing','Calm Breathing',['breathing','calm','relax'],i=>bodyPulse(i,'breathing')],
];

const manifest=[]; const perType=Math.ceil(totalCount/sfxTypes.length); let created=0;
console.log(`Generating ${totalCount} SFX (${sfxTypes.length} categories, ~${perType} each) into ${sfxDir}`);
for(const [slug,label,tags,fn] of sfxTypes){
  for(let i=0;i<perType && created<totalCount;i++){
    const file = `${slug}-${String(i+1).padStart(5,'0')}.wav`;
    writeWav(path.join(sfxDir,file), fn(i+created));
    manifest.push({ id:`${slug}-${String(i+1).padStart(5,'0')}`, name:`${label} ${String(i+1).padStart(5,'0')}`, file, category:label, tags });
    created++;
    if(created%1000===0) console.log(`Created ${created}/${totalCount}`);
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2));
console.log(`Done. ${created} natural, common, non-irritating SFX created across ${sfxTypes.length} categories.`);
