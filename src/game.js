
(() => {
  const app = document.getElementById('app');
  const gameArea = document.getElementById('gameArea');
  const dog = document.getElementById('dog');
  const dogShadow = document.getElementById('dogShadow');
  const bucketDock = document.getElementById('bucketDock');
  const bucketOpenOverlay = document.getElementById('bucketOpenOverlay');
  const bucketOpenCard = document.getElementById('bucketOpenCard');
  const bucketOpenTitle = document.getElementById('bucketOpenTitle');
  const bucketZoom = document.getElementById('bucketZoom');
  const mobileBucketIcon = document.getElementById('mobileBucketIcon');
  const mobileBucketLabel = document.getElementById('mobileBucketLabel');
  const mobileBucketStatus = document.getElementById('mobileBucketStatus');
  const continueBtn = document.getElementById('closeBucketBtn');
  const filingCaption = document.getElementById('filingCaption');
  const materiaContainer = document.getElementById('folderSlots');
  const materiaHeading = document.getElementById('materiaHeading');
  const folderSlots = [];
  const caseModal = document.getElementById('caseModal');
  const pauseBtn = document.getElementById('pauseBtn');
  const toast = document.getElementById('toast');
  const missionFailedOverlay = document.getElementById('missionFailedOverlay');
  const restartBtn = document.getElementById('restartBtn');
  const missedChip = document.getElementById('missedChip');
  const missLimit = 10;
  const missionGoal = 12;
  const missionCompleteOverlay = document.getElementById('missionCompleteOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const soundBtn = document.getElementById('soundBtn');
  const scoreEl = document.getElementById('scoreCount');
  const particles = new Set();
  const cosmeticTimers = new Set();
  let missionComplete = false;
  let score = 0, streak = 0, bestStreak = 0;
  let facing = 1;
  let audio = null;
  let bestScore = readSavedNumber('agent-fetch.best-score',0);
  let soundOn = readSavedNumber('agent-fetch.sound',1)!==0;

  const caughtEl = document.getElementById('caughtCount');
  const classifiedEl = document.getElementById('classifiedCount');
  const missedEl = document.getElementById('missedCount');

  let running = false;
  let missionFailed = false;
  let catchTimer = 0;
  let dockFlashTimer = 0;
  let paused = false;
  let modalOpen = false;
  let classifying = false;
  let dogX = 0;
  let dogSpeed = 500;
  let jumping = false;
  let jumpElapsed = 0;
  let jumpHeight = 0;
  let jumpOffset = 0;
  let landingTimer = 0;
  const jumpDuration = .74;
  let keys = {left:false,right:false};
  let last = performance.now();
  let spawnTimer = 0;
  let nextSpawn = 900;
  let folders = [];
  let caught = 0, classified = 0, missed = 0;
  let activeCase = null;
  let sequence = 0;
  let dragging = false;
  const pending = new Set();
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  const classifyBtn = document.getElementById('classifyBtn');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Indexed by Producto number minus one; each Producto owns its Materias.
  const materiaCounts = [1,2,10,2,1,1,2,7,6,2,2,4,6,4,1,15];

  // Artwork uses uneven row spacing; equal 4×4 cells cut off the buckets.
  // Each rectangle includes the whole numbered bucket and a little edge padding.
  const bucketSprites = [
    [34,72,300,253], [335,65,292,261], [628,65,296,261], [926,60,293,266],
    [28,348,304,259], [334,338,294,270], [629,342,297,266], [926,348,299,260],
    [28,625,301,266], [330,626,297,265], [627,628,302,263], [930,621,297,269],
    [28,908,300,267], [330,908,297,267], [628,907,300,268], [930,909,297,266]
  ];
  function readSavedNumber(key,fallback){
    try {
      const raw = window.localStorage?.getItem(key);
      const value = Number(raw);
      return raw==null || !Number.isFinite(value) || value<0 ? fallback : value;
    } catch { return fallback; }
  }
  function savePreference(key,value){
    try { window.localStorage?.setItem(key,String(value)); } catch { /* Private browsing can disable storage. */ }
  }
  function syncSoundButton(){
    soundBtn.classList.toggle('muted',!soundOn);
    soundBtn.setAttribute('aria-pressed',String(soundOn));
    soundBtn.setAttribute('aria-label',soundOn ? 'Silenciar sonido' : 'Activar sonido');
  }
  function chirp(kind){
    if(!soundOn || document.hidden) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if(!Audio) return;
    try {
      if(!audio) audio = new Audio();
      if(audio.state==='suspended') audio.resume().catch(()=>{});
      const notes = {start:[440,660],jump:[320,520],catch:[880,1174],file:[660,880,1174],miss:[190],fail:[220,165,110],win:[660,880,1320,1760]}[kind] || [440];
      const duration = kind==='fail' ? .16 : .07;
      notes.forEach((frequency,index)=>{
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const when = audio.currentTime + index*(duration+.025);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency,when);
        gain.gain.setValueAtTime(0,when);
        gain.gain.linearRampToValueAtTime(.045,when+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
        oscillator.connect(gain);gain.connect(audio.destination);
        oscillator.start(when);oscillator.stop(when+duration+.015);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      });
    } catch { /* Gameplay continues when audio is unavailable. */ }
  }
  function later(fn,ms){
    const timer=setTimeout(()=>{cosmeticTimers.delete(timer);fn();},ms);
    cosmeticTimers.add(timer);
    return timer;
  }
  function effect(el,ms){
    gameArea.appendChild(el);particles.add(el);
    later(()=>{el.remove();particles.delete(el);},ms);
  }
  function burst(x,y){
    if(reducedMotion.matches) return;
    for(let i=0;i<7;i++){
      const dot=document.createElement('span');dot.className='particle';
      dot.style.left=x+'px';dot.style.top=y+'px';
      const angle=i/7*Math.PI*2;
      dot.style.setProperty('--spark-x',Math.cos(angle)*48+'px');
      dot.style.setProperty('--spark-y',Math.sin(angle)*48-18+'px');
      effect(dot,650);
    }
  }
  function scorePop(points){
    if(reducedMotion.matches) return;
    const pop=document.createElement('span');pop.className='score-pop';pop.textContent='+'+points;
    pop.style.left=dogX+'px';
    pop.style.top=(gameArea.getBoundingClientRect().height-(parseFloat(getComputedStyle(dog).bottom)||28)-dog.getBoundingClientRect().height-jumpOffset)+'px';
    effect(pop,900);
  }
  function updateMissionHUD(){
    scoreEl.textContent=String(score).padStart(4,'0');
    const level=Math.min(4,1+Math.floor(classified/3));
    document.getElementById('rankBadge').textContent=['Recluta','Operativo','Especialista','Élite'][level-1];
    document.getElementById('stageLevel').textContent='FASE '+String(level).padStart(2,'0');
    document.getElementById('missionProgressFill').style.width=Math.min(100,classified/missionGoal*100)+'%';
    document.getElementById('missionProgress').setAttribute('aria-valuenow',String(classified));
    for(const id of ['startBest','failureBest','successBest'])document.getElementById(id).textContent=bestScore;
  }
  function addPoints(points){
    score+=points;
    if(score>bestScore){bestScore=score;savePreference('agent-fetch.best-score',bestScore);}
    updateMissionHUD();
  }
  function completeMission(){
    if(!running || missionFailed || missionComplete) return;
    addPoints(500+(missLimit-missed)*25);
    clearMissionScene();
    missionComplete=true;
    document.getElementById('successScore').textContent=score;
    document.getElementById('successClassified').textContent=classified;
    document.getElementById('successMissed').textContent=missed;
    document.getElementById('successStreak').textContent=bestStreak;
    document.getElementById('successRank').textContent=missed<=2 ? 'Rango S' : missed<=5 ? 'Rango A' : 'Rango B';
    showOverlay(missionCompleteOverlay,'show',true);
    syncControls();chirp('win');
    document.getElementById('nextMissionBtn').focus({preventScroll:true});
  }
  function setBucketSprite(el, bucket){
    const [x,y,w,h] = bucketSprites[bucket-1];
    el.style.backgroundSize = `${1254/w*100}% ${1254/h*100}%`;
    el.style.backgroundPosition = `${x/(1254-w)*100}% ${y/(1254-h)*100}%`;
    el.style.setProperty('--sprite-ratio', `${w} / ${h}`);
  }
  function resetControls(){
    keys.left = keys.right = false;
    dragging = false;
    leftBtn.classList.remove('pressed');
    rightBtn.classList.remove('pressed');
    dog.classList.remove('moving');
  }
  function canPlay(){ return running && !paused && !modalOpen && !classifying; }
  function syncControls(){
    pauseBtn.disabled = !running || modalOpen || classifying;
    leftBtn.disabled = rightBtn.disabled = !canPlay();
    jumpBtn.disabled = !canPlay() || jumping;
    pauseBtn.setAttribute('aria-pressed', String(paused));
  }
  function renderDog(size = dog.getBoundingClientRect(), bottom = parseFloat(getComputedStyle(dog).bottom) || 22){
    dog.style.left = dogX+'px';
    dog.style.setProperty('--dog-facing',String(facing));
    dog.classList.toggle('moving',canPlay() && !jumping && !dog.classList.contains('landing') && (keys.left!==keys.right || dragging));
    dog.style.setProperty('--jump-offset', jumpOffset+'px');
    const lift = jumpHeight ? jumpOffset/jumpHeight : 0;
    dogShadow.style.left = dogX+'px';
    dogShadow.style.bottom = (bottom+3)+'px';
    dogShadow.style.width = (size.width*.6)+'px';
    dogShadow.style.height = (size.height*.09)+'px';
    dogShadow.style.transform = `translateX(-50%) scale(${1-lift*.45})`;
    dogShadow.style.opacity = String(1-lift*.65);
  }
  function resetJump(){
    clearTimeout(landingTimer);
    jumping = false;
    jumpElapsed = jumpOffset = 0;
    dog.classList.remove('jumping','landing');
    renderDog();
  }
  function jump(){
    if(!canPlay() || jumping) return;
    clearTimeout(landingTimer);
    dog.classList.remove('landing');
    jumping = true;
    jumpElapsed = 0;
    const area = gameArea.getBoundingClientRect();
    jumpHeight = Math.min(160, dog.getBoundingClientRect().height*.9, area.height*.28);
    dog.classList.add('jumping');
    chirp('jump');
    syncControls();
  }
  function updateJump(dt){
    if(!jumping) return;
    jumpElapsed += dt;
    const progress = Math.min(1,jumpElapsed/jumpDuration);
    jumpOffset = 4*jumpHeight*progress*(1-progress);
    if(progress===1){
      jumping = false;
      jumpOffset = 0;
      dog.classList.remove('jumping');
      dog.classList.add('landing');
      landingTimer = setTimeout(()=>dog.classList.remove('landing'),160);
      syncControls();
    }
  }
  function showOverlay(el, name, open){
    el.classList.toggle(name, open);
    el.setAttribute('aria-hidden', String(!open));
  }
  function wait(ms){
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); pending.delete(done); resolve(); };
      const timer = setTimeout(done, ms);
      pending.add(done);
    });
  }
  function finishClassification(){
    if(!classifying || continueBtn.disabled) return;
    sequence++;
    for(const done of [...pending]) done();
    hideOpenedBucket();
    classifying = false;
    resetControls();
    syncControls();
    if(classified>=missionGoal){completeMission();return;}
    if(running) pauseBtn.focus({preventScroll:true});
    showToast(paused ? 'Misión en pausa' : 'Siguiente expediente, agente.');
  }
  function updateMissedHUD(){
    missedEl.textContent = missed;
    missedChip.classList.toggle('danger',missed>=missLimit-2);
    [...document.getElementById('lifePips').children].forEach((pip,index)=>pip.classList.toggle('lost',index<missed));
  }
  function clearMissionScene(){
    running = false;
    paused = false;
    classifying = false;
    sequence++;
    for(const done of [...pending]) done();
    for(const timer of cosmeticTimers)clearTimeout(timer);
    cosmeticTimers.clear();
    for(const particle of particles)particle.remove();
    particles.clear();
    showOverlay(pauseOverlay,'show',false);
    closeCase();
    hideOpenedBucket();
    for(const file of folders) file.el.remove();
    folders = [];
    clearTimeout(catchTimer);
    clearTimeout(dockFlashTimer);
    clearTimeout(showToast.t);
    toast.classList.remove('show');
    bucketDock.classList.remove('flash');
    dog.classList.remove('catching','hit');
    resetControls();
    resetJump();
  }
  function failMission(){
    if(missionFailed || !running) return;
    clearMissionScene();
    missionFailed = true;
    document.getElementById('failureCaught').textContent = caught;
    document.getElementById('failureClassified').textContent = classified;
    pauseBtn.textContent = 'Pausa';
    document.getElementById('failureScore').textContent=score;
    showOverlay(missionFailedOverlay,'show',true);
    syncControls();
    restartBtn.focus({preventScroll:true});
    chirp('fail');
  }
  function startMission(){
    clearMissionScene();
    missionFailed = false;
    missionComplete = false;
    score=streak=bestStreak=0;
    facing=1;
    showOverlay(missionCompleteOverlay,'show',false);
    showOverlay(missionFailedOverlay,'show',false);
    document.getElementById('startOverlay').style.display='none';
    caught = classified = missed = 0;
    caughtEl.textContent = classifiedEl.textContent = 0;
    updateMissedHUD();
    spawnTimer = 0;
    nextSpawn = 900;
    dogX = gameArea.getBoundingClientRect().width/2;
    layoutDog();
    materiaContainer.replaceChildren();
    folderSlots.length = 0;
    materiaHeading.textContent = 'Materias';
    setBucketSprite(mobileBucketIcon,1);
    mobileBucketLabel.textContent = 'Productos';
    mobileBucketStatus.textContent = '16 destinos';
    bucketDock.setAttribute('aria-label','16 Productos');
    pauseBtn.textContent = 'Pausa';
    updateMissionHUD();
    running = true;
    last = performance.now();
    syncControls();
    pauseBtn.focus({preventScroll:true});
    showToast('Operación en marcha.');
    chirp('start');
  }
  function flight(fly, destination, after){
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        pending.delete(done);
        fly.removeEventListener('transitionend', onEnd);
        fly.removeEventListener('transitioncancel', done);
        fly.remove();
        if(after) after();
        resolve();
      };
      const onEnd = e => { if(e.target === fly) done(); };
      // Background tabs, reduced motion and interrupted transitions may never
      // deliver transitionend. Gameplay must finish independently of that event.
      const timer = setTimeout(done, reducedMotion.matches ? 60 : 1000);
      pending.add(done);
      fly.addEventListener('transitionend', onEnd);
      fly.addEventListener('transitioncancel', done);
      // Commit the initial styles before starting the transition.
      void fly.offsetWidth;
      requestAnimationFrame(() => { if(!settled) destination(); });
    });
  }

  // Synthetic people and scenarios for the game; no real customer data.
  const firstNames = ["Lucía", "Mateo", "Sofía", "Hugo", "Elena", "Diego", "Valeria", "Pablo", "Daniela", "Álvaro", "Clara", "Marcos"];
  const lastNames = ["García", "López", "Martín", "Ruiz", "Torres", "Navarro", "Serrano", "Molina", "Ortega", "Vega", "Romero", "Castro"];
  const issues = [
  [
    "Cargo no reconocido",
    "La persona titular detecta un cargo de 299 € por una compra que asegura no haber realizado. Solicita que se revise la operación y se le devuelva el importe."
  ],
  [
    "Retirada de efectivo fallida",
    "Un cajero descontó 120 € del saldo, pero no entregó el efectivo. La persona titular solicita la devolución del importe y la revisión de la incidencia."
  ],
  [
    "Cargo duplicado",
    "Una compra de 46,50 € aparece cobrada dos veces en el extracto. La persona titular afirma que solo realizó una compra y solicita corregir el cargo duplicado."
  ],
  [
    "Transferencia retrasada",
    "Una transferencia de 350 € enviada hace tres días aún no aparece en la cuenta de destino. La persona titular solicita información sobre su estado."
  ],
  [
    "Comisión no reconocida",
    "Se ha aplicado una comisión de mantenimiento de 18 € que la persona titular no esperaba. Solicita conocer el motivo y que se revise el cobro."
  ],
  [
    "Tarjeta no entregada",
    "La tarjeta de sustitución no ha llegado al domicilio indicado tras dos semanas. La persona titular solicita comprobar el envío y recibir una nueva tarjeta."
  ],
  [
    "Recibo tras cancelación",
    "Se ha cobrado un recibo de 29 € después de que la persona titular cancelara la domiciliación. Solicita revisar el cargo y evitar nuevos cobros."
  ],
  [
    "Acceso a banca digital bloqueado",
    "La persona titular no puede acceder a la banca digital desde que cambió de número de teléfono. Solicita recuperar el acceso y actualizar sus datos de contacto."
  ],
  [
    "Diferencia en ingreso de efectivo",
    "La persona titular ingresó 200 € en una oficina, pero solo se reflejan 150 € en la cuenta. Conserva el justificante y solicita corregir la diferencia."
  ],
  [
    "Cálculo de intereses",
    "Los intereses abonados en la cuenta de ahorro parecen inferiores a los esperados. La persona titular solicita una explicación del cálculo y la revisión del importe."
  ],
  [
    "Seguimiento de una reclamación",
    "La persona titular presentó una reclamación por una compra de 85 € y todavía no ha recibido respuesta. Solicita una actualización sobre el estado del expediente."
  ],
  [
    "Pago de préstamo mal aplicado",
    "Una cuota de 240 € se ha aplicado a un préstamo distinto del indicado por la persona titular. Solicita corregir la asignación y revisar el saldo pendiente."
  ],
  [
    "Importe incorrecto en pago periódico",
    "Un pago periódico se ha enviado por 90 € en lugar de los 60 € configurados. La persona titular solicita revisar la orden y corregir la diferencia."
  ],
  [
    "Tarjeta rechazada en el extranjero",
    "Durante un viaje, la tarjeta ha sido rechazada en varias compras pese a disponer de saldo. La persona titular solicita revisar el motivo del rechazo."
  ],
  [
    "Error en el extracto",
    "El extracto mensual incluye una descripción incorrecta en una operación. La persona titular solicita comprobar el movimiento y emitir un extracto corregido."
  ],
  [
    "Verificación de identidad fallida",
    "La verificación digital rechaza el documento de identidad presentado por la persona titular. Solicita revisar la incidencia y disponer de otra forma de verificación."
  ]
];
  const priorities = ['Baja','Media','Alta','Urgente'];

  function rand(arr){ return arr[Math.floor(Math.random()*arr.length)] }
  function makeCase(){
    const issue = rand(issues);
    return {
      id: 'BC-' + Math.floor(10000 + Math.random()*90000),
      customer: rand(firstNames) + ' ' + rand(lastNames),
      issue: issue[0],
      priority: rand(priorities),
      summary: issue[1]
    };
  }

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(()=>{toast.classList.remove('show');toast.textContent='';},1400);
  }

  function layoutDog(){
    const area = gameArea.getBoundingClientRect();
    const dw = dog.getBoundingClientRect().width || 156;
    dogX = Math.max(dw/2, Math.min(area.width-dw/2, dogX || area.width/2));
    renderDog();
  }

  function spawnFolder(){
    if (!canPlay()) return;
    const el = document.createElement('div');
    el.className = 'complaint';
    const area = gameArea.getBoundingClientRect();
    gameArea.appendChild(el);
    const size = el.getBoundingClientRect().width;
    const x = Math.random() * Math.max(0, area.width-size-20) + 10;
    const speed = 155 + Math.random()*95 + Math.min(classified*7,84);
    const spin = (Math.random()-.5)*60;
    const item = {el, x, y:-size-10, size, speed, rot:(Math.random()-.5)*18, spin};
    el.style.left = x+'px';
    el.style.top = item.y+'px';
    el.style.transform = `rotate(${item.rot}deg)`;
    folders.push(item);
  }

  function catchFolder(item){
    const airborne=jumping;
    const points=airborne ? 100 : 50;
    const position=item.el.getBoundingClientRect();
    burst(position.left+position.width/2,position.top+position.height/2);
    addPoints(points);scorePop(points);chirp('catch');
    document.getElementById('caseReward').textContent=`+${points} PT${airborne ? ' · EN EL AIRE' : ''}`;
    caught++;
    caughtEl.textContent = caught;
    dog.classList.add('catching','hit');
    clearTimeout(catchTimer);
    catchTimer = setTimeout(()=>dog.classList.remove('catching','hit'),350);
    item.el.remove();
    folders = folders.filter(f => f !== item);
    openCase(makeCase());
  }

  function openCase(c){
    activeCase = c;
    modalOpen = true;
    document.getElementById('caseId').textContent = c.id;
    document.getElementById('customer').textContent = c.customer;
    document.getElementById('issue').textContent = c.issue;
    document.getElementById('priority').textContent = c.priority;
    document.getElementById('summary').textContent = c.summary;
    resetControls();
    resetJump();
    syncControls();
    const run=sequence;
    later(()=>{
      if(running && modalOpen && activeCase===c && run===sequence){
        showOverlay(caseModal,'open',true);
        classifyBtn.focus({preventScroll:true});
      }
    },150);
  }

  function closeCase(){
    showOverlay(caseModal, 'open', false);
    modalOpen = false;
    activeCase = null;
    resetControls();
    syncControls();
    if(running && !classifying) pauseBtn.focus({preventScroll:true});
  }

  function getBucketTarget(bucket){
    const appRect = app.getBoundingClientRect();
    const icon = mobileBucketIcon.getBoundingClientRect();
    if(icon.width && icon.height){
      return {x:icon.left-appRect.left+icon.width/2,y:icon.top-appRect.top+icon.height/2};
    }
    const dock = bucketDock.getBoundingClientRect();
    const [x,y,w,h] = bucketSprites[bucket-1];
    return {
      x: dock.left - appRect.left + (x+w/2)/1254*dock.width,
      y: dock.top - appRect.top + (y+h/2)/1254*dock.height
    };
  }


  function chooseInternalFolder(c, bucket){
    // Stable assignment within the selected Producto's configured Materias.
    const issueIndex = issues.findIndex(i => i[0] === c.issue);
    const priorityIndex = Math.max(0, priorities.indexOf(c.priority));
    return ((Math.max(0, issueIndex) + priorityIndex) % materiaCounts[bucket-1]) + 1;
  }

  function showOpenedBucket(bucket, folder){
    setBucketSprite(bucketZoom, bucket);
    const count = materiaCounts[bucket-1];
    materiaContainer.replaceChildren();
    folderSlots.length = 0;
    materiaContainer.style.setProperty('--materia-columns', Math.min(count,5));
    materiaContainer.style.setProperty('--materia-mobile-columns', Math.min(count,3));
    materiaContainer.setAttribute('aria-label', `Materias del Producto ${bucket}`);
    materiaHeading.textContent = `${count} ${count===1 ? 'Materia' : 'Materias'}`;
    for(let number=1;number<=count;number++){
      const slot = document.createElement('div');
      slot.className = 'folder-slot';
      slot.dataset.folder = String(number);
      slot.textContent = `Materia ${number}`;
      slot.setAttribute('role','listitem');
      if(number===folder) slot.setAttribute('aria-current','true');
      materiaContainer.appendChild(slot);
      folderSlots.push(slot);
    }
    bucketOpenCard.classList.remove('filed');
    filingCaption.textContent = 'Clasificando la reclamación en la Materia indicada…';
    continueBtn.disabled = true;
    continueBtn.textContent = 'Clasificando…';
    bucketOpenTitle.textContent = `Producto ${bucket}`;
    folderSlots.forEach(el => el.classList.toggle('active', Number(el.dataset.folder) === folder));
    showOverlay(bucketOpenOverlay, 'show', true);
    bucketOpenCard.classList.add('open');
    bucketOpenCard.focus({preventScroll:true});
  }

  function hideOpenedBucket(){
    bucketOpenCard.classList.remove('open');
    showOverlay(bucketOpenOverlay, 'show', false);
    folderSlots.forEach(el => el.classList.remove('active'));
  }

  function animateFileIntoFolder(bucket, folder){
    const appRect = app.getBoundingClientRect();
    const targetEl = folderSlots[folder - 1];
    targetEl.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    const targetRect = targetEl.getBoundingClientRect();
    const size = window.innerWidth <= 900 ? 70 : 88;
    const fly = document.createElement('div');
    fly.className = 'flying-file';
    fly.style.width = fly.style.height = size + 'px';
    fly.style.left = (appRect.width / 2 - size / 2) + 'px';
    fly.style.top = (appRect.height / 2 - size / 2 - 20) + 'px';
    fly.style.transform = 'scale(.95) rotate(-8deg)';
    fly.style.opacity = '1';
    app.appendChild(fly);
    return flight(fly, () => {
      fly.style.left = (targetRect.left - appRect.left + targetRect.width/2 - size/2) + 'px';
      fly.style.top = (targetRect.top - appRect.top - size*.18) + 'px';
      fly.style.transform = 'scale(.24) rotate(18deg)';
      fly.style.opacity = '.15';
    }, () => targetEl.classList.add('active'));
  }

  function animateFileToBucket(bucket, startRect){
    const appRect = app.getBoundingClientRect();
    const target = getBucketTarget(bucket);
    const size = window.innerWidth <= 900 ? 72 : 96;
    const fly = document.createElement('div');
    fly.className = 'flying-file';
    fly.style.width = fly.style.height = size + 'px';
    fly.style.left = (startRect.left - appRect.left + startRect.width/2 - size/2) + 'px';
    fly.style.top = (startRect.top - appRect.top + startRect.height/2 - size/2) + 'px';
    fly.style.transform = 'scale(1) rotate(0deg)';
    fly.style.opacity = '1';
    app.appendChild(fly);
    return flight(fly, () => {
      fly.style.left = (target.x - size/2) + 'px';
      fly.style.top = (target.y - size/2) + 'px';
      fly.style.transform = 'scale(.42) rotate(28deg)';
      fly.style.opacity = '.96';
    }, () => {
      bucketDock.classList.add('flash');
      clearTimeout(dockFlashTimer);
      dockFlashTimer = setTimeout(() => bucketDock.classList.remove('flash'), 500);
    });
  }

  async function classify(){
    if(!activeCase || classifying) return;
    classifying = true;
    const run = ++sequence;
    const caseCopy = {...activeCase};
    const startRect = classifyBtn.getBoundingClientRect();
    const bucket = 1 + Math.floor(Math.random()*materiaCounts.length);
    const folder = chooseInternalFolder(caseCopy,bucket);
    setBucketSprite(mobileBucketIcon, bucket);
    mobileBucketLabel.textContent = `Producto ${bucket}`;
    mobileBucketStatus.textContent = 'Clasificando…';
    bucketDock.setAttribute('aria-label', `Clasificando en Producto ${bucket}`);
    classified++;
    classifiedEl.textContent = classified;
    streak++;
    bestStreak=Math.max(bestStreak,streak);
    const multiplier=Math.min(4,1+Math.floor(streak/3));
    const reward=100*multiplier;
    addPoints(reward);chirp('file');
    document.getElementById('filingReward').textContent=`+${reward} PT · RACHA ${streak} · ×${multiplier}`;
    closeCase();
    try {
      await animateFileToBucket(bucket, startRect);
      if(run !== sequence) return;
      showOpenedBucket(bucket, folder);
      await wait(reducedMotion.matches ? 60 : 300);
      if(run !== sequence) return;
      await animateFileIntoFolder(bucket, folder);
      if(run !== sequence) return;
      await wait(reducedMotion.matches ? 100 : 400);
      if(run !== sequence) return;
    } finally {
      if(run === sequence){
        // Animation completes independently; confirmation belongs to the player.
        bucketOpenTitle.textContent = 'Reclamación clasificada';
        filingCaption.textContent = `${caseCopy.id} → Producto ${bucket} · Materia ${folder}`;
        bucketOpenCard.classList.add('filed');
        mobileBucketStatus.textContent = `Materia ${folder} · lista`;
        bucketDock.setAttribute('aria-label', `Última clasificación: Producto ${bucket}, Materia ${folder}`);
        continueBtn.disabled = false;
        continueBtn.textContent = classified>=missionGoal ? 'Ver resultado' : 'Continuar misión';
        if(!document.hidden) continueBtn.focus({preventScroll:true});
      }
    }
    // Keep gameplay and this dialog paused until Continue mission is clicked.
  }

  function update(dt){
    const area = gameArea.getBoundingClientRect();
    const dogRect = dog.getBoundingClientRect();
    const dogBottom = parseFloat(getComputedStyle(dog).bottom) || 22;
    updateJump(dt);
    const dir = (keys.right?1:0) - (keys.left?1:0);
    if(dir) facing=dir;
    dogX += dir * dogSpeed * dt;
    const half = dogRect.width/2;
    dogX = Math.max(half, Math.min(area.width-half, dogX));
    renderDog(dogRect,dogBottom);
    const dogTopInArea = area.height - dogBottom - dogRect.height - jumpOffset;
    const dogCatch = {
      left: dogX - dogRect.width*0.24,
      right: dogX + dogRect.width*0.24,
      top: dogTopInArea + dogRect.height*0.18,
      bottom: dogTopInArea + dogRect.height*0.72
    };

    for (const f of [...folders]){
      f.y += f.speed * dt;
      f.rot += f.spin * dt;
      f.el.style.top = f.y+'px';
      f.el.style.transform = `rotate(${f.rot}deg)`;

      const cx = f.x + f.size/2;
      const bottom = f.y + f.size;
      if (cx > dogCatch.left && cx < dogCatch.right && bottom > dogCatch.top && f.y < dogCatch.bottom){
        catchFolder(f);
        break;
      }
      if (f.y > area.height + 20){
        f.el.remove();
        folders = folders.filter(x => x !== f);
        missed++;
        streak=0;
        chirp('miss');
        updateMissedHUD();
        if(missed>=missLimit){
          failMission();
          break;
        }
      }
    }
  }

  function loop(now){
    const dt = Math.min((now-last)/1000,.035);
    last = now;
    if(running && !paused && !modalOpen && !classifying){
      spawnTimer += dt*1000;
      if(spawnTimer >= nextSpawn){
        spawnTimer = 0;
        nextSpawn = Math.max(650,1000+Math.random()*450-classified*25);
        spawnFolder();
      }
      update(dt);
    }
    requestAnimationFrame(loop);
  }

  function setKey(e,down){
    const k = e.key.toLowerCase();
    if(['arrowleft','arrowright','a','d'].includes(k) && canPlay()){
      e.preventDefault();
      if(k==='arrowleft'||k==='a') keys.left=down;
      if(k==='arrowright'||k==='d') keys.right=down;
    } else if(!down) {
      if(k==='arrowleft'||k==='a') keys.left=false;
      if(k==='arrowright'||k==='d') keys.right=false;
    }
    if(down && [' ','arrowup','w'].includes(k) && canPlay()){
      e.preventDefault();
      if(!e.repeat) jump();
    }
    if(down && k==='escape'){
      if(modalOpen || classifying) { e.preventDefault(); return; }
      if(running) togglePause();
    }
  }
  addEventListener('keydown',e=>setKey(e,true));
  addEventListener('keyup',e=>setKey(e,false));

  function hold(btn,side){
    btn.addEventListener('pointerdown', e => {
      if(!canPlay()) return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      keys[side]=true;
      btn.classList.add('pressed');
    });
    const off = () => { keys[side]=false; btn.classList.remove('pressed'); };
    ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,off));
  }
  hold(leftBtn,'left');
  hold(rightBtn,'right');

  function moveToPointer(e){
    const area = gameArea.getBoundingClientRect();
    const half = dog.getBoundingClientRect().width/2;
    const nextX=Math.max(half, Math.min(area.width-half, e.clientX-area.left));
    if(Math.abs(nextX-dogX)>1) facing=nextX>dogX ? 1 : -1;
    dogX=nextX;
    renderDog();
  }
  gameArea.addEventListener('pointerdown', e => {
    if(!canPlay()) return;
    e.preventDefault();
    gameArea.setPointerCapture(e.pointerId);
    dragging = true;
    moveToPointer(e);
  });
  gameArea.addEventListener('pointermove', e => { if(dragging && canPlay()) moveToPointer(e); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>gameArea.addEventListener(ev,()=>dragging=false));

  function skipCase(){
    if(!modalOpen) return;
    streak=0;
    closeCase();
    showToast('Caso omitido · Racha reiniciada');
  }
  function togglePause(){
    if(!running || modalOpen || classifying) return;
    paused=!paused;
    resetControls();
    pauseBtn.textContent = paused ? 'Seguir' : 'Pausa';
    showOverlay(pauseOverlay,'show',paused);
    syncControls();
    (paused ? document.getElementById('resumeBtn') : pauseBtn).focus({preventScroll:true});
  }
  document.getElementById('startBtn').addEventListener('click',()=>{
    if(!running && !missionFailed && !missionComplete) startMission();
  });
  restartBtn.addEventListener('click',()=>{
    if(missionFailed) startMission();
  });
  classifyBtn.addEventListener('click', classify);
  document.getElementById('dismissBtn').addEventListener('click',skipCase);
  document.getElementById('closeCaseBtn').addEventListener('click',skipCase);
  continueBtn.addEventListener('click',finishClassification);
  document.getElementById('nextMissionBtn').addEventListener('click',()=>{if(missionComplete) startMission();});
  document.getElementById('resumeBtn').addEventListener('click',()=>{if(paused) togglePause();});
  soundBtn.addEventListener('click',()=>{
    soundOn=!soundOn;
    savePreference('agent-fetch.sound',soundOn ? 1 : 0);
    syncSoundButton();
    if(soundOn) chirp('catch');
  });
  jumpBtn.addEventListener('click',jump);
  pauseBtn.addEventListener('click',togglePause);
  addEventListener('blur',resetControls);
  document.addEventListener('visibilitychange',()=>{
    resetControls();
    if(document.hidden){
      resetJump();
      if(running && !paused && !modalOpen && !classifying) { paused=true; pauseBtn.textContent='Seguir'; showOverlay(pauseOverlay,'show',true); syncControls(); }
    }
  });
  // Keep keyboard focus within the visible popup.
  addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const overlay = missionFailed ? missionFailedOverlay : missionComplete ? missionCompleteOverlay : paused ? pauseOverlay : modalOpen ? caseModal : bucketOpenOverlay.classList.contains('show') ? bucketOpenOverlay : !running ? document.getElementById('startOverlay') : null;
    if(!overlay) return;
    const buttons = [...overlay.querySelectorAll('button:not(:disabled)')];
    const first=buttons[0], end=buttons[buttons.length-1];
    if(!first) return;
    if(e.shiftKey && (document.activeElement===first || !overlay.contains(document.activeElement))){e.preventDefault();end.focus();}
    else if(!e.shiftKey && (document.activeElement===end || !overlay.contains(document.activeElement))){e.preventDefault();first.focus();}
  });
  setBucketSprite(mobileBucketIcon,1);
  syncSoundButton();
  updateMissionHUD();
  syncControls();
  addEventListener('resize',()=>{
    resetControls();
    resetJump();
    syncControls();
    layoutDog();
    const area = gameArea.getBoundingClientRect();
    for(const f of folders){
      f.size = f.el.getBoundingClientRect().width;
      f.x = Math.max(0,Math.min(area.width-f.size,f.x));
      f.el.style.left=f.x+'px';
    }
  });
  layoutDog();
  requestAnimationFrame(loop);
})();
