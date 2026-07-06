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
    phases: []                // opcional: descripciones de cada fase, para el panel "Ver fases"
  }
*/
function initScorer(config){
  const KEY = 'hub_' + config.gameId + '_state';
  const colors = ['red','blue','teal','yellow','purple','orange','pink','cyan'];
  let players = [];
  let locked = false;

  function load(){
    const saved = localStorage.getItem(KEY);
    if(saved){
      const data = JSON.parse(saved);
      players = data.players || [];
      locked = !!data.locked;
      if(players.length){
        document.getElementById('setup').classList.add('hidden');
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

  function buildPhasesPanel(){
    if(!config.phases || !config.phases.length) return;
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '460px';
    wrap.style.margin = '0 auto 16px';
    wrap.innerHTML = `
      <button class="btn secondary" id="phasesToggle" style="width:100%">📋 Ver las ${config.phases.length} fases</button>
      <div id="phasesPanel" class="phases-panel hidden"></div>
    `;
    const setupEl = document.getElementById('setup');
    setupEl.parentNode.insertBefore(wrap, setupEl);
    const list = document.createElement('ol');
    list.className = 'phases-list';
    config.phases.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      list.appendChild(li);
    });
    document.getElementById('phasesPanel').appendChild(list);
    document.getElementById('phasesToggle').onclick = () => {
      document.getElementById('phasesPanel').classList.toggle('hidden');
    };
  }

  function buildRulesPanel(){
    if(!config.rules || !config.rules.length) return;
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '460px';
    wrap.style.margin = '0 auto 16px';
    wrap.innerHTML = `
      <button class="btn secondary" id="rulesToggle" style="width:100%">${config.rulesButtonLabel || '📖 Ver reglas de cartas especiales'}</button>
      <div id="rulesPanel" class="phases-panel hidden"></div>
    `;
    const setupEl = document.getElementById('setup');
    setupEl.parentNode.insertBefore(wrap, setupEl);
    const panel = document.getElementById('rulesPanel');
    if(config.rulesIntro){
      const introEl = document.createElement('p');
      introEl.className = 'rules-note';
      introEl.textContent = config.rulesIntro;
      panel.appendChild(introEl);
    }
    const list = document.createElement('ul');
    list.className = 'rules-list';
    config.rules.forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `<b>${r.name}</b>: ${r.desc}`;
      list.appendChild(li);
    });
    panel.appendChild(list);
    if(config.rulesNote){
      const noteEl = document.createElement('p');
      noteEl.className = 'rules-note';
      noteEl.textContent = config.rulesNote;
      panel.appendChild(noteEl);
    }
    document.getElementById('rulesToggle').onclick = () => {
      panel.classList.toggle('hidden');
    };
  }

  function startGame(){
    players = [];
    for(let i=1;i<=config.maxPlayers;i++){
      const el = document.getElementById('name'+i);
      const val = el.value.trim();
      if(val) players.push({name: val, total: 0, history: [], phase: 1, phaseDone: false});
    }
    if(players.length < config.minPlayers){
      alert('Pon al menos ' + config.minPlayers + ' nombres de jugadores.');
      return;
    }
    locked = false;
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('toolbar').classList.remove('hidden');
    document.getElementById('winnerBanner').style.display = 'none';
    document.getElementById('winnerBanner').classList.remove('win-banner');
    save();
    render();
  }

  function addPoints(idx){
    if(locked) return;
    const input = document.getElementById('input-'+idx);
    const val = parseInt(input.value, 10);
    if(isNaN(val)){ input.focus(); return; }
    players[idx].total += val;
    players[idx].history.push(val);
    input.value = '';
    save();
    render();
    checkStatus();
  }

  function changePhase(idx, delta){
    if(locked) return;
    const p = players[idx];
    if(delta > 0){
      if(p.phase >= config.maxPhases){
        p.phaseDone = true; // completa la última fase
      } else {
        p.phase = Math.min(config.maxPhases, (p.phase||1) + 1);
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
    if(!confirm('¿Reiniciar los puntos de todos a 0? Se mantienen los nombres.')) return;
    players.forEach(p => { p.total = 0; p.history = []; p.phase = 1; p.phaseDone = false; });
    locked = false;
    document.getElementById('winnerBanner').style.display = 'none';
    document.getElementById('winnerBanner').classList.remove('win-banner');
    save();
    render();
  }

  function newGame(){
    if(!confirm('¿Empezar una partida nueva con otros jugadores?')) return;
    players = [];
    locked = false;
    localStorage.removeItem(KEY);
    document.getElementById('setup').classList.remove('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('winnerBanner').style.display = 'none';
    document.getElementById('winnerBanner').classList.remove('win-banner');
    document.getElementById('players').innerHTML = '';
    for(let i=1;i<=config.maxPlayers;i++){
      const el = document.getElementById('name'+i);
      if(el) el.value = '';
    }
  }

  function bestPlayer(){
    return players.reduce((a,b) => {
      if(config.lowWins) return a.total < b.total ? a : b;
      return a.total > b.total ? a : b;
    });
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
    playFanfare();
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
  buildPhasesPanel();
  buildRulesPanel();
  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('resetBtn').onclick = resetScores;
  document.getElementById('newGameBtn').onclick = newGame;
  load();
}
