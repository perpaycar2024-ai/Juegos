/*
  Motor genérico de puntuación para el hub de juegos.
  Cada juego llama a initScorer(config) con sus propias reglas.
  config = {
    gameId: 'phase10',
    gameName: 'Phase 10',
    maxPlayers: 4,
    minPlayers: 2,
    lowWins: true,            // true = gana quien tiene MENOS puntos
    threshold: 200,           // opcional: umbral de fin de partida
    lockOnWin: false,         // true = al llegar al umbral se bloquea el juego y suena fanfarria
    trackPhases: false,       // true = añade contador de fases por jugador
    maxPhases: 10,
    phases: [],               // opcional: descripciones de cada fase, para el panel "Ver fases"
    startMelody: null,        // 'drunkenSailor' | 'casino' | null — suena al empezar partida
    winMelody: null,          // 'drunkenSailor' | 'casino' | null — suena al ganar (si no, fanfarria por defecto)
    phaseCompleteMelody: null,// 'drunkenSailor' | 'casino' | null — suena al completar la última fase
    phaseCompleteRepeat: 2,   // veces que se repite phaseCompleteMelody
    phaseAnnounceAt: null,    // opcional: número de fase para el botón "📣 Anunciar fase X"
    phaseAnnounceMessage: null, // opcional: (nombres) => texto a decir
    milestonePoints: null,    // opcional: número de puntos para un aviso de voz a mitad de partida
    milestoneMessage: null,   // opcional: (nombre) => texto a decir al llegar a milestonePoints
    negativeMessage: null     // opcional: (nombre) => texto a decir si el total baja de 0
  }
*/
function initScorer(config){
  const KEY = 'hub_' + config.gameId + '_state';
  const colors = ['red','blue','teal','yellow','purple','orange','pink','cyan'];
  let players = [];
  let locked = false;
  let phaseAnnounceTimer = null;
  let completeAnnounceTimer = null;

  function hideSetupPanels(){
    document.getElementById('setup').classList.add('hidden');
    const title = document.getElementById('pageTitle');
    if(title) title.classList.add('hidden');
    const sub = document.getElementById('pageSub');
    if(sub) sub.classList.add('hidden');
    window.scrollTo(0, 0);
  }

  function showSetupPanels(){
    document.getElementById('setup').classList.remove('hidden');
    const title = document.getElementById('pageTitle');
    if(title) title.classList.remove('hidden');
    const sub = document.getElementById('pageSub');
    if(sub) sub.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function load(){
    const saved = localStorage.getItem(KEY);
    if(saved){
      const data = JSON.parse(saved);
      players = data.players || [];
      locked = !!data.locked;
      if(players.length){
        hideSetupPanels();
        document.getElementById('toolbar').classList.remove('hidden');
        render();
        if(locked) showWinnerBanner(bestPlayer());
      }
    }
  }

  function save(){
    localStorage.setItem(KEY, JSON.stringify({players, locked}));
  }

  function buildSetupInputs(){
    const wrap = document.getElementById('setupInputs');
    wrap.innerHTML = '';
    for(let i=1;i<=config.maxPlayers;i++){
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'name'+i;
      inp.placeholder = 'Jugador ' + i + (i <= config.minPlayers ? '' : ' (opcional)');
      wrap.appendChild(inp);
    }
  }

  function renderBlocks(blocks){
    return blocks.map(b => {
      const headingHtml = b.heading ? `<h3 class="help-subhead">${b.heading}</h3>` : '';
      const linesHtml = b.lines.length > 1
        ? '<ul class="help-bullets">' + b.lines.map(l => `<li>${l}</li>`).join('') + '</ul>'
        : `<p class="help-text">${b.lines[0]}</p>`;
      return headingHtml + linesHtml;
    }).join('');
  }

  function buildHelpButton(){
    let sections = [];
    if(config.helpSections && config.helpSections.length){
      sections = config.helpSections.map(s => {
        let html = '';
        if(s.type === 'rules'){
          if(s.intro) html += `<p class="rules-note">${s.intro}</p>`;
          html += '<ul class="rules-list">' + s.items.map(r => `<li><b>${r.name}</b>: ${r.desc}</li>`).join('') + '</ul>';
          if(s.note) html += `<p class="rules-note">${s.note}</p>`;
        } else if(s.type === 'blocks'){
          html = renderBlocks(s.blocks);
        }
        return { label: s.label, title: s.title || s.label, html };
      });
    } else {
      // comportamiento anterior: fases sueltas + cartas especiales sueltas
      if(config.phases && config.phases.length){
        sections.push({
          label: '📋 Fases (' + config.phases.length + ')',
          title: '📋 Fases (' + config.phases.length + ')',
          html: '<ol class="phases-list">' + config.phases.map(p => `<li>${p}</li>`).join('') + '</ol>'
        });
      }
      if(config.rules && config.rules.length){
        let inner = '';
        if(config.rulesIntro) inner += `<p class="rules-note">${config.rulesIntro}</p>`;
        inner += '<ul class="rules-list">' + config.rules.map(r => `<li><b>${r.name}</b>: ${r.desc}</li>`).join('') + '</ul>';
        if(config.rulesNote) inner += `<p class="rules-note">${config.rulesNote}</p>`;
        sections.push({
          label: (config.rulesButtonLabel || '📖 Cartas especiales').replace(/^\W+\s*/, '📖 '),
          title: (config.rulesButtonLabel || '📖 Cartas especiales'),
          html: inner
        });
      }
    }
    if(!sections.length) return;

    const btn = document.createElement('button');
    btn.id = 'helpFab';
    btn.className = 'help-fab';
    btn.setAttribute('aria-label', 'Ver ayuda');
    btn.textContent = '❓';
    document.body.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.id = 'helpOverlay';
    overlay.className = 'help-overlay hidden';
    overlay.innerHTML = `
      <div class="help-card">
        <button class="help-close" id="helpClose" aria-label="Cerrar">✕</button>
        <div id="helpBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const helpBody = overlay.querySelector('#helpBody');

    function showMenu(){
      if(sections.length === 1){
        helpBody.innerHTML = `<h2>${sections[0].title}</h2>${sections[0].html}`;
        return;
      }
      helpBody.innerHTML = '<div class="help-menu">' + sections.map((s,i) => `<button class="btn secondary help-menu-btn" data-i="${i}">${s.label}</button>`).join('') + '</div>';
      helpBody.querySelectorAll('.help-menu-btn').forEach(b => {
        b.onclick = () => showSection(parseInt(b.dataset.i, 10));
      });
    }

    function showSection(i){
      const s = sections[i];
      const backBtn = sections.length > 1 ? '<button class="btn secondary help-back" id="helpBack">‹ Volver</button>' : '';
      helpBody.innerHTML = `${backBtn}<h2>${s.title}</h2>${s.html}`;
      if(sections.length > 1) document.getElementById('helpBack').onclick = showMenu;
    }

    btn.onclick = () => { showMenu(); overlay.classList.remove('hidden'); };
    overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.classList.add('hidden'); });
    document.getElementById('helpClose').onclick = () => overlay.classList.add('hidden');
  }

  function joinNames(names){
    if(names.length === 1) return names[0];
    return names.slice(0,-1).join(', ') + ' y ' + names[names.length-1];
  }

  function buildConfirmModal(){
    const overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay hidden';
    overlay.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-title" id="confirmTitle"></div>
        <div class="confirm-message" id="confirmMessage"></div>
        <div class="confirm-actions" id="confirmActions"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showModal(opts){
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = opts.title || '';
    document.getElementById('confirmMessage').textContent = opts.message || '';
    const actions = document.getElementById('confirmActions');
    actions.innerHTML = '';
    if(opts.cancelText){
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn secondary';
      cancelBtn.textContent = opts.cancelText;
      cancelBtn.onclick = () => overlay.classList.add('hidden');
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement('button');
    okBtn.className = 'btn';
    okBtn.textContent = opts.confirmText || 'Vale';
    okBtn.onclick = () => {
      overlay.classList.add('hidden');
      if(opts.onConfirm) opts.onConfirm();
    };
    actions.appendChild(okBtn);
    overlay.classList.remove('hidden');
  }

  function startGame(){
    players = [];
    for(let i=1;i<=config.maxPlayers;i++){
      const el = document.getElementById('name'+i);
      const val = el.value.trim();
      if(val) players.push({name: val, total: 0, history: [], phase: 1, phaseDone: false, milestoneAnnounced: false, phaseAnnounced: false, completeAnnounced: false});
    }
    if(players.length < config.minPlayers){
      showModal({
        title: 'Faltan jugadores',
        message: 'Pon al menos ' + config.minPlayers + ' nombres de jugadores.',
        confirmText: 'Vale'
      });
      return;
    }
    locked = false;
    hideSetupPanels();
    document.getElementById('toolbar').classList.remove('hidden');
    document.getElementById('winnerBanner').style.display = 'none';
    document.getElementById('winnerBanner').classList.remove('win-banner');
    save();
    render();
    playStartMelody();
  }

  function addPoints(idx){
    if(locked) return;
    const input = document.getElementById('input-'+idx);
    const val = parseInt(input.value, 10);
    if(isNaN(val)){ input.focus(); return; }
    const p = players[idx];
    const prevTotal = p.total;
    p.total += val;
    p.history.push(val);
    input.value = '';

    if(config.milestonePoints && config.milestoneMessage && prevTotal < config.milestonePoints && p.total >= config.milestonePoints && !p.milestoneAnnounced){
      p.milestoneAnnounced = true;
      speak(config.milestoneMessage(p.name));
    } else if(config.negativeMessage && prevTotal >= 0 && p.total < 0){
      speak(config.negativeMessage(p.name));
    }

    save();
    render();
    checkStatus();
  }

  function schedulePhaseAnnounce(){
    if(!config.phaseAnnounceAt) return;
    clearTimeout(phaseAnnounceTimer);
    phaseAnnounceTimer = setTimeout(() => {
      const pending = players.filter(p => p.phase === config.phaseAnnounceAt && !p.phaseDone && !p.phaseAnnounced);
      if(!pending.length) return;
      pending.forEach(p => { p.phaseAnnounced = true; });
      save();
      const names = joinNames(pending.map(p => p.name));
      const text = config.phaseAnnounceMessage
        ? config.phaseAnnounceMessage(names)
        : ('Los jugadores ' + names + ' han alcanzado la fase ' + config.phaseAnnounceAt + '.');
      speak(text);
    }, 2500);
  }

  function scheduleCompleteAnnounce(){
    clearTimeout(completeAnnounceTimer);
    completeAnnounceTimer = setTimeout(() => {
      const pending = players.filter(p => p.phaseDone && !p.completeAnnounced);
      if(!pending.length) return;
      pending.forEach(p => { p.completeAnnounced = true; });
      save();
      if(config.phaseCompleteMelody) playPhaseCompleteMelody();
      const names = joinNames(pending.map(p => p.name));
      const verb = pending.length > 1 ? 'han completado' : 'ha completado';
      const text = config.phaseCompleteMessage
        ? config.phaseCompleteMessage(names)
        : ('¡Enhorabuena, ' + names + ', ' + verb + ' la fase ' + config.maxPhases + '!');
      speak(text);
    }, 2500);
  }

  function changePhase(idx, delta){
    if(locked) return;
    const p = players[idx];
    if(delta > 0){
      if(p.phase >= config.maxPhases){
        p.phaseDone = true; // completa la última fase
        scheduleCompleteAnnounce();
      } else {
        p.phase = Math.min(config.maxPhases, (p.phase||1) + 1);
        if(p.phase === config.phaseAnnounceAt) schedulePhaseAnnounce();
      }
    } else {
      if(p.phaseDone){
        p.phaseDone = false; // deshace la finalización por error
      } else {
        p.phase = Math.max(1, (p.phase||1) - 1);
      }
    }
    save();
    render();
    checkStatus();
  }

  function resetScores(){
    showModal({
      title: '¿Reiniciar puntos?',
      message: 'Todos los totales vuelven a 0. Los nombres se mantienen.',
      confirmText: 'Sí, reiniciar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        clearTimeout(phaseAnnounceTimer);
        clearTimeout(completeAnnounceTimer);
        players.forEach(p => { p.total = 0; p.history = []; p.phase = 1; p.phaseDone = false; p.milestoneAnnounced = false; p.phaseAnnounced = false; p.completeAnnounced = false; });
        locked = false;
        document.getElementById('winnerBanner').style.display = 'none';
        document.getElementById('winnerBanner').classList.remove('win-banner');
        save();
        render();
      }
    });
  }

  function newGame(){
    showModal({
      title: '¿Nueva partida?',
      message: 'Se perderá la partida actual y podrás poner otros jugadores.',
      confirmText: 'Sí, nueva partida',
      cancelText: 'Cancelar',
      onConfirm: () => {
        clearTimeout(phaseAnnounceTimer);
        clearTimeout(completeAnnounceTimer);
        players = [];
        locked = false;
        localStorage.removeItem(KEY);
        showSetupPanels();
        document.getElementById('toolbar').classList.add('hidden');
        document.getElementById('winnerBanner').style.display = 'none';
        document.getElementById('winnerBanner').classList.remove('win-banner');
        document.getElementById('players').innerHTML = '';
        for(let i=1;i<=config.maxPlayers;i++){
          const el = document.getElementById('name'+i);
          if(el) el.value = '';
        }
      }
    });
  }

  function bestPlayer(){
    return players.reduce((a,b) => {
      if(config.lowWins) return a.total < b.total ? a : b;
      return a.total > b.total ? a : b;
    });
  }

  function speak(text){
    try{
      if(!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }catch(e){ /* si el navegador no soporta voz, no pasa nada */ }
  }

  // Mapa de notas compartido por todas las melodías
  const NOTE_FREQ = {
    A3:220.00, B3:246.94, C4:261.63, D4:293.66, E4:329.63, G4:392.00, A4:440.00,
    C5:523.25, D5:587.33, E5:659.25, G5:783.99, A5:880.00, C6:1046.50, E6:1318.51, G6:1567.98
  };

  function playMelody(melody, opts){
    opts = opts || {};
    const waveform = opts.waveform || 'triangle';
    const unit = opts.unit || 0.28;
    const repeat = opts.repeat || 1;
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for(let r = 0; r < repeat; r++){
        melody.forEach(([noteName, dur]) => {
          const freq = NOTE_FREQ[noteName];
          const len = dur * unit;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = waveform;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.9);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + len);
          t += len;
        });
      }
    }catch(e){ /* si el navegador bloquea audio, no pasa nada */ }
  }

  // "What Shall We Do with the Drunken Sailor" - melodía tradicional de dominio público
  const DRUNKEN_SAILOR_MELODY = [
    ['A4',1],['C5',1],['D4',0.5],['E4',0.5],['C5',1],['A4',1],
    ['A4',0.5],['G4',0.5],['E4',1],['E4',1],['D4',1],['C5',0.5],['D4',0.5],
    ['E4',1.5],['D4',0.5],['C5',1],['A4',1],
    ['A4',0.5],['G4',0.5],['E4',1],['E4',1],['D4',2]
  ];
  function playDrunkenSailor(repeat){
    playMelody(DRUNKEN_SAILOR_MELODY, { waveform:'square', unit:0.28, repeat: repeat||1 });
  }

  // Melodía original tipo "campanitas de máquina tragaperras", compuesta aquí, sin base en ninguna canción existente
  const CASINO_MELODY = [
    ['C5',0.25],['E5',0.25],['G5',0.25],['C6',0.25],
    ['E5',0.25],['G5',0.25],['C6',0.25],['E6',0.25],
    ['G5',0.5],['C6',0.5],['E6',1.4]
  ];
  function playCasinoMelody(repeat){
    playMelody(CASINO_MELODY, { waveform:'triangle', unit:0.2, repeat: repeat||1 });
  }

  function playStartMelody(){
    if(config.startMelody === 'drunkenSailor') playDrunkenSailor();
    else if(config.startMelody === 'casino') playCasinoMelody();
  }

  function playWinMelody(){
    if(config.winMelody === 'drunkenSailor') return playDrunkenSailor();
    if(config.winMelody === 'casino') return playCasinoMelody();
    playFanfare();
  }

  function playPhaseCompleteMelody(){
    const repeat = config.phaseCompleteRepeat || 2;
    if(config.phaseCompleteMelody === 'drunkenSailor') playDrunkenSailor(repeat);
    else if(config.phaseCompleteMelody === 'casino') playCasinoMelody(repeat);
  }

  function playFanfare(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // Do Mi Sol Do agudo
      let t = ctx.currentTime;
      notes.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
        t += 0.15;
      });
      const finalGain = ctx.createGain();
      finalGain.gain.setValueAtTime(0.0001, t);
      finalGain.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
      finalGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      finalGain.connect(ctx.destination);
      [1046.5, 1318.5, 1568.0].forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(finalGain);
        osc.start(t);
        osc.stop(t + 1.3);
      });
    }catch(e){ /* si el navegador bloquea audio, no pasa nada */ }
  }

  function showWinnerBanner(winner){
    const banner = document.getElementById('winnerBanner');
    banner.classList.add('win-banner');
    banner.style.display = 'block';
    banner.innerHTML = `<div class="win-title">🏆 ${winner.name}</div><div class="win-sub">¡gana la partida con ${winner.total} puntos!</div>`;
  }

  function declareWinner(winner){
    locked = true;
    save();
    render();
    playWinMelody();
    showWinnerBanner(winner);
  }

  function checkStatus(){
    if(locked) return;
    const banner = document.getElementById('winnerBanner');
    if(config.trackPhases && !config.lockOnWin){
      const finisher = players.find(p => p.phaseDone);
      if(finisher){
        banner.classList.remove('win-banner');
        banner.style.display = 'block';
        banner.textContent = '🏆 ' + finisher.name + ' ha completado la fase ' + config.maxPhases + '. Revisad puntos para el desempate final.';
        return;
      }
    }
    if(config.threshold){
      const someoneHitThreshold = players.some(p => p.total >= config.threshold);
      if(someoneHitThreshold){
        if(config.lockOnWin){
          declareWinner(bestPlayer());
          return;
        }
        const leader = bestPlayer();
        banner.classList.remove('win-banner');
        banner.style.display = 'block';
        banner.textContent = 'Alguien ha llegado a ' + config.threshold + '. Ahora mismo va ganando ' + leader.name + ' con ' + leader.total + ' puntos.';
        return;
      }
    }
    banner.classList.remove('win-banner');
    banner.style.display = 'none';
  }

  function render(){
    const cont = document.getElementById('players');
    cont.innerHTML = '';
    players.forEach((p, idx) => {
      const color = colors[idx % colors.length];
      const div = document.createElement('div');
      div.className = 'card';
      div.style.setProperty('--c-accent', 'var(--'+color+')');
      let phaseHtml = '';
      if(config.trackPhases && !locked){
        const label = (config.phaseLabels && config.phaseLabels[(p.phase||1)-1]) ? ' · ' + config.phaseLabels[(p.phase||1)-1] : '';
        const doneText = p.phaseDone ? ' ✓ completada' : '';
        const plusLabel = (!p.phaseDone && p.phase >= config.maxPhases) ? '✓' : '+';
        phaseHtml = `
          <div class="phase-row">
            <button class="btn small" onclick="scorerChangePhase(${idx},-1)">-</button>
            <span>F${p.phase||1}/${config.maxPhases}${label}${doneText}</span>
            <button class="btn small" onclick="scorerChangePhase(${idx},1)">${plusLabel}</button>
          </div>`;
      }
      let addrowHtml = '';
      if(!locked){
        addrowHtml = `
          <div class="addrow">
            <input type="number" inputmode="numeric" id="input-${idx}" placeholder="+/- puntos ronda">
            <button class="btn small" onclick="scorerAddPoints(${idx})">Sumar</button>
          </div>`;
      }
      div.innerHTML = `
        <div class="name">${p.name}</div>
        <div class="total">${p.total}</div>
        <div class="phase-label">puntos totales${config.lowWins ? ' (menos = mejor)' : ' (más = mejor)'}</div>
        ${phaseHtml}
        ${addrowHtml}
        <div class="history">${p.history.map(h => `<span>${h}</span>`).join('')}</div>
      `;
      cont.appendChild(div);
    });
  }

  window.scorerAddPoints = addPoints;
  window.scorerChangePhase = changePhase;
  window.scorerStart = startGame;
  window.scorerReset = resetScores;
  window.scorerNewGame = newGame;

  buildSetupInputs();
  buildHelpButton();
  buildConfirmModal();
  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('resetBtn').onclick = resetScores;
  document.getElementById('newGameBtn').onclick = newGame;
  load();
}
