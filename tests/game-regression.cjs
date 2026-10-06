// Run the actual standalone game's script with deterministic time and DOM fixtures.
// Deliberately omit animation events to reproduce the original mobile deadlock.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Browsers discard oversized custom-property values. Keep large embedded
// artwork in image declarations so it cannot silently resolve to "none".
const stylesheet = html.match(/<style>([\s\S]*?)<\/style>/)[1];
for(const [,name,value] of stylesheet.matchAll(/(--[\w-]+)\s*:\s*(url\((?:["'])?data:[\s\S]*?\))/g)){
  assert(Buffer.byteLength(value,'utf8') <= 1024*1024,
    `${name} exceeds the CSS custom-property image budget; popup artwork will disappear`);
}

function game({width=390,height=844,motion=false}={}) {
  let now=0, nextId=1;
  const timers=new Map(), frames=[], elements=new Map(), errors=[], globalListeners={};
  class Element {
    constructor(id='') {
      this.id=id;
      this.style={setProperty(k,v){this[k]=v;}};
      this.dataset={}; this.listeners={}; this.classes=new Set(); this.children=[];
      this.textContent=''; this.disabled=false; this.offsetWidth=72;
      this.classList={
        add:(...cs)=>cs.forEach(c=>this.classes.add(c)),
        remove:(...cs)=>cs.forEach(c=>this.classes.delete(c)),
        contains:c=>this.classes.has(c),
        toggle:(c,on)=>{if(on ?? !this.classes.has(c))this.classes.add(c);else this.classes.delete(c)}
      };
    }
    addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    dispatch(type,event={}) {
      for(const fn of [...(this.listeners[type]||[])]) {
        const result=fn({target:this,pointerId:1,preventDefault(){},...event});
        if(result?.then)result.catch(e=>errors.push(e));
      }
    }
    click(){if(!this.disabled)this.dispatch('click');}
    appendChild(el){this.children.push(el);el.parent=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
    getBoundingClientRect(){
      if(this.id==='app'||this.id==='gameArea')return {left:0,top:0,width,height};
      if(this.id==='dog'){const size=height<=520?118:width<=560?156:width<=900?180:220;return {left:parseFloat(this.style.left)-size/2,top:height-52-size,width:size,height:size};}
      if(this.className==='complaint'){const size=height<=520?54:width<=560?62:width<=900?68:96;return {left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0,width:size,height:size};}
      if(this.id==='bucketDock')return {left:width-130,top:height-130,width:120,height:120};
      return {left:width/2-36,top:height/2,width:72,height:48};
    }
    setAttribute(k,v){this[k]=v;}
    removeAttribute(k){delete this[k];}
    focus(){document.activeElement=this;}
    contains(el){return el===this||this.children.includes(el);}
    querySelectorAll(){return [];}
    setPointerCapture(){}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const slots=Array.from({length:5},(_,i)=>{const el=new Element();el.dataset.folder=String(i+1);return el});
  const document={getElementById:get,querySelectorAll:s=>s==='.folder-slot'?slots:[],createElement:()=>new Element(),addEventListener:(t,fn)=>(globalListeners[t] ||= []).push(fn),hidden:false,activeElement:null};
  const math=Object.create(Math);math.random=()=>.5;
  const context={document,performance:{now:()=>now},Math:math,console,innerWidth:width,matchMedia:()=>({matches:motion}),getComputedStyle:()=>({bottom:'52px'}),requestAnimationFrame:fn=>(frames.push(fn),frames.length),setTimeout:(fn,ms)=>{const id=nextId++;timers.set(id,{fn,time:now+ms});return id},clearTimeout:id=>timers.delete(id),addEventListener:(t,fn)=>(globalListeners[t] ||= []).push(fn)};
  context.window=context;
  vm.runInNewContext(code,context);
  async function advance(ms){
    const end=now+ms;
    while(now<end){
      now=Math.min(now+35,end);
      frames.splice(0).forEach(fn=>fn(now));
      for(const [id,t]of [...timers])if(t.time<=now){timers.delete(id);t.fn();}
      for(let i=0;i<4;i++)await Promise.resolve();
      if(errors.length)throw errors[0];
    }
  }
  async function until(test,description,max=12000){for(let t=0;t<max;t+=35){if(test())return;await advance(35);}assert.fail(description);}
  const dispatch=(type,event={})=>(globalListeners[type]||[]).forEach(fn=>fn({preventDefault(){},...event}));
  const open=id=>get(id).classList.contains(id==='caseModal'?'open':'show');
  const flies=()=>get('app').children.filter(el=>el.className==='flying-file');
  async function catchCase(){await until(()=>open('caseModal'),'A falling file must open a case');}
  async function start(){get('startBtn').click();await catchCase();}
  function assertClear(){assert(!open('bucketOpenOverlay'),'Folder popup remains stuck');assert.equal(flies().length,0,'Flying files must be cleaned up');}
  return {get,document,advance,until,dispatch,open,flies,catchCase,start,assertClear};
}
(async()=>{
  {
    const g=game();g.get('startBtn').click();
    g.dispatch('keydown',{key:' '});
    assert(g.get('dog').classList.contains('jumping'),'Space must start a jump');
    await g.advance(250);
    assert(parseFloat(g.get('dog').style['--jump-offset'])>80,'Jump must raise the dog');
    await g.advance(600);
    assert(!g.get('dog').classList.contains('jumping'),'Dog must land');
    assert.equal(g.get('dog').style['--jump-offset'],'0px','Dog must return to ground level');
    console.log('PASS: keyboard jump rises and returns to the ground');
  }
  for(const key of ['ArrowUp','w']){
    const g=game();g.get('startBtn').click();g.dispatch('keydown',{key});
    await g.advance(400);
    g.dispatch('keydown',{key,repeat:true});
    await g.advance(450);
    assert(!g.get('dog').classList.contains('jumping'),'Holding jump must not restart or chain jumps');
    console.log(`PASS: ${key} jumps once and ignores keyboard repeats`);
  }
  {
    const g=game();g.get('startBtn').click();
    g.get('rightBtn').dispatch('pointerdown');g.get('jumpBtn').click();
    await g.advance(140);
    assert(g.get('dog').classList.contains('jumping'),'Mobile button must jump');
    assert(parseFloat(g.get('dog').style.left)>195,'Movement must continue during a jump');
    assert(g.get('jumpBtn').disabled,'No second jump while airborne');
    g.get('rightBtn').dispatch('pointerup');
    g.get('pauseBtn').click();const offset=g.get('dog').style['--jump-offset'];
    await g.advance(500);assert.equal(g.get('dog').style['--jump-offset'],offset,'Pause must freeze a jump');
    g.get('pauseBtn').click();await g.advance(650);
    assert(!g.get('dog').classList.contains('jumping'),'Jump must land after resuming');
    assert(!g.get('jumpBtn').disabled,'Jump must become available again');
    console.log('PASS: mobile jump, simultaneous movement, no double jump, pause and resume');
  }
  {
    const grounded=game(), airborne=game();
    const nearDog=g=>g.get('gameArea').children.some(el=>el.className==='complaint' && parseFloat(el.style.top)>=480);
    for(const g of [grounded,airborne]){g.get('startBtn').click();await g.until(()=>nearDog(g),'File must approach the dog');}
    airborne.get('jumpBtn').click();
    await airborne.advance(250);await grounded.advance(250);
    assert(airborne.open('caseModal'),'Jumping must catch a higher file');
    assert(!grounded.open('caseModal'),'The same higher file must remain out of reach on the ground');
    assert(!airborne.get('dog').classList.contains('jumping'),'Opening a case must settle the dog');
    assert.equal(airborne.get('dog').style['--jump-offset'],'0px');
    airborne.dispatch('keydown',{key:' '});airborne.get('jumpBtn').click();
    assert(!airborne.get('dog').classList.contains('jumping'),'Jump is blocked while the case is open');
    airborne.get('classifyBtn').click();await airborne.until(()=>airborne.open('bucketOpenOverlay'),'Bucket must open');
    airborne.dispatch('keydown',{key:'ArrowUp'});
    assert(!airborne.get('dog').classList.contains('jumping'),'Jump is blocked while filing');
    console.log('PASS: jump catches files earlier; case and folder popups block jumping');
  }
  for(const motion of [false,true]){
    const g=game({motion});g.get('startBtn').click();g.get('jumpBtn').click();await g.advance(250);
    assert(parseFloat(g.get('dog').style['--jump-offset'])>80,'Reduced motion must retain the jump mechanic');
    assert(Number(g.get('dogShadow').style.opacity)<1,'The ground shadow must fade while airborne');
    g.dispatch('resize');assert.equal(g.get('dog').style['--jump-offset'],'0px','Resize must settle the dog');
    assert(!g.get('jumpBtn').disabled,'Resize must restore the jump control');
    g.get('jumpBtn').click();await g.advance(100);g.document.hidden=true;g.dispatch('visibilitychange');
    assert.equal(g.get('dog').style['--jump-offset'],'0px','Backgrounding must settle the dog');
    assert(g.get('jumpBtn').disabled,'Hidden tab must pause jump controls');
    console.log(`PASS: ${motion?'reduced':'normal'} motion, shadow, resize and hidden-tab jump recovery`);
  }
  {
    const g=game();await g.start();g.get('classifyBtn').click();
    await g.until(()=>g.open('bucketOpenOverlay'),'Bucket must open');
    await g.advance(12000);
    assert(g.open('bucketOpenOverlay'),'Folder popup must remain open until Continue mission is clicked');
    g.get('bucketOpenOverlay').click();g.dispatch('keydown',{key:'Escape'});
    g.document.hidden=true;g.dispatch('visibilitychange');g.document.hidden=false;g.dispatch('visibilitychange');
    assert(g.open('bucketOpenOverlay'),'Backdrop, Escape and switching tabs must not dismiss the popup');
    g.get('closeBucketBtn').click();g.assertClear();
    console.log('PASS: folder confirmation stays open until Continue mission');
  }
  for(const dimensions of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
    const g=game(dimensions);await g.start();
    g.get('classifyBtn').click();g.get('classifyBtn').click();
    await g.until(()=>g.open('bucketOpenOverlay'),'First animation must finish without transitionend');
    assert(g.get('closeBucketBtn').disabled,'Continue must wait for filing to finish');
    g.get('closeBucketBtn').click();assert(g.open('bucketOpenOverlay'),'Early taps must not interrupt filing');
    await g.until(()=>!g.get('closeBucketBtn').disabled,'Filing must finish without transitionend');
    assert.equal(g.get('bucketOpenTitle').textContent,'Case filed');
    assert(g.get('filingCaption').textContent.includes('Producto 9'),'Confirmation must show the assigned bucket');
    assert.equal(g.get('mobileBucketLabel').textContent,'Producto 9','Mobile tray must show the latest destination');
    assert(g.get('mobileBucketStatus').textContent.includes('filed'),'Mobile tray must reflect completed filing');
    assert.equal(g.get('classifiedCount').textContent,1,'Repeated clicks must file only once');
    assert.equal(g.flies().length,0,'Animation files must be cleaned up even while confirmation stays open');
    const caught=g.get('caughtCount').textContent;
    await g.advance(12000);
    assert(g.open('bucketOpenOverlay'),'Popup must remain visible indefinitely');
    assert.equal(g.get('caughtCount').textContent,caught,'Gameplay must wait for Continue mission');
    g.get('closeBucketBtn').click();g.assertClear();
    await g.catchCase();assert(g.get('caughtCount').textContent>1,'Gameplay must resume after Continue mission');
    console.log(`PASS: ${dimensions.width}×${dimensions.height} animation fallback, manual-only confirmation, readable destination and resumed gameplay`);
  }
  for(const trigger of ['backdrop','escape','hidden-tab']){
    const g=game();await g.start();g.get('classifyBtn').click();
    await g.until(()=>g.open('bucketOpenOverlay'),'Bucket popup must open');
    await g.until(()=>!g.get('closeBucketBtn').disabled,'Filing must finish');
    if(trigger==='backdrop')g.get('bucketOpenOverlay').click();
    if(trigger==='escape')g.dispatch('keydown',{key:'Escape'});
    if(trigger==='hidden-tab'){g.document.hidden=true;g.dispatch('visibilitychange');g.document.hidden=false;g.dispatch('visibilitychange');}
    await g.advance(10000);assert(g.open('bucketOpenOverlay'),`${trigger} must not dismiss confirmation`);
    g.get('closeBucketBtn').click();g.assertClear();
    await g.catchCase();assert.equal(g.get('classifiedCount').textContent,1,'Continue must preserve the filed case');
    console.log(`PASS: ${trigger} preserves popup; Continue mission closes it and resumes gameplay`);
  }
  {
    const g=game();await g.start();g.get('closeCaseBtn').click();assert(!g.open('caseModal'),'Case close button must dismiss');
    g.get('leftBtn').dispatch('pointerdown');assert(g.get('leftBtn').classList.contains('pressed'));
    g.dispatch('blur');const x=g.get('dog').style.left;await g.advance(350);assert.equal(g.get('dog').style.left,x,'Blur must release held movement');
    g.get('gameArea').dispatch('pointerdown',{clientX:270});assert.equal(g.get('dog').style.left,'270px','Dragging must position the dog');
    g.get('gameArea').dispatch('pointercancel');g.get('gameArea').dispatch('pointermove',{clientX:100});assert.equal(g.get('dog').style.left,'270px','Pointer cancel must end dragging');
    g.get('pauseBtn').click();assert.equal(g.get('pauseBtn').textContent,'Resume');assert(g.get('leftBtn').disabled);
    g.get('pauseBtn').click();assert(!g.get('leftBtn').disabled);
    g.get('gameArea').dispatch('pointerdown',{clientX:195});g.get('gameArea').dispatch('pointerup');
    await g.catchCase();g.get('classifyBtn').click();await g.until(()=>g.open('bucketOpenOverlay'),'Bucket popup must open');
    g.document.hidden=true;g.dispatch('visibilitychange');
    await g.advance(4000);assert(g.open('bucketOpenOverlay'),'Backgrounding while filing must preserve confirmation');
    assert(!g.get('closeBucketBtn').disabled,'Filing must finish in the background without trapping Continue');
    g.document.hidden=false;g.dispatch('visibilitychange');g.get('closeBucketBtn').click();g.assertClear();
    assert(!g.get('leftBtn').disabled,'Continue must resume controls after switching tabs');
    console.log('PASS: case dismissal, touch release, drag, pointer cancel, pause and hidden-tab confirmation recovery');
  }
  {
    const g=game({motion:true});await g.start();g.get('classifyBtn').click();
    await g.until(()=>g.open('bucketOpenOverlay') && !g.get('closeBucketBtn').disabled,'Reduced motion must complete filing',1000);
    await g.advance(5000);assert(g.open('bucketOpenOverlay'),'Reduced motion must still require Continue mission');
    g.get('closeBucketBtn').click();g.assertClear();
    console.log('PASS: reduced motion completes without transition events and waits for Continue');
  }
  {
    const g=game();await g.start();g.get('classifyBtn').click();await g.advance(35);
    g.flies()[0].dispatch('transitionend');await g.advance(35);
    assert(g.open('bucketOpenOverlay'),'Normal transition must advance immediately');
    await g.advance(350);g.flies()[0].dispatch('transitioncancel');await g.advance(500);
    assert(g.open('bucketOpenOverlay'),'Cancelled transition must leave confirmation open');
    assert(!g.get('closeBucketBtn').disabled,'Cancelled transition must still enable Continue mission');
    g.get('closeBucketBtn').click();g.assertClear();
    console.log('PASS: normal transition completion and cancelled transition recover cleanly');
  }
})().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1});
