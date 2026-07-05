/*
  Motor genérico de puntuación para el hub de juegos.
  Cada juego llama a initScorer(config) con sus propias reglas.
  config = {
    gameId: 'phase10',        // clave única para guardar en localStorage
    gameName: 'Phase 10',
    maxPlayers: 4,
    minPlayers: 2,
    lowWins: true,            // true = gana quien tiene MENOS puntos
    threshold: 200,           // opcional: aviso cuando alguien llega a este total
    trackPhases: false,       // true = añade contador de fases (1-10) por jugador
    maxPhases: 10
  }
*/
function initScorer(config){
  const KEY = 'hub_' + config.gameId + '_state';
  const colors = ['red','blue','teal','yellow','purple','orange','pink','cyan'];
  let players = [];

  function load(){
    const saved = localStorage.getItem(KEY);
    if(saved){
      players = JSON.parse(saved);
      if(players.length){
        document.getElementById('setup').classList.add('hidden');
        document.getElementById('toolbar').classList.remove('hidden');
        render();
      }
    }
  }

  function save(){
    localStorage.setItem(KEY, JSON.stringify(players));
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

  function startGame(){
    players = [];
    for(let i=1;i<=config.maxPlayers;i++){
      const el = document.getElementById('name'+i);
      const val = el.value.trim();
      if(val) players.push({name: val, total: 0, history: [], phase: 1});
    }
    if(players.length < config.minPlayers){
      alert('Pon al menos ' + config.minPlayers + ' nombres de jugadores.');
      return;
    }
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('toolbar').classList.remove('hidden');
    document.getElementById('winnerBanner').style.display = 'none';
    save();
    render();
  }

  function addPoints(idx){
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
    const p = players[idx];
    p.phase = Math.max(1, Math.min(config.maxPhases, (p.phase||1) + delta));
    save();
    render();
    checkStatus();
  }

  function resetScores(){
    if(!confirm('¿Reiniciar los puntos de todos a 0? Se mantienen los nombres.')) return;
    players.forEach(p => { p.total = 0; p.history = []; p.phase = 1; });
    document.getElementById('winnerBanner').style.display = 'none';
    save();
    render();
  }

  function newGame(){
    if(!confirm('¿Empezar una partida nueva con otros jugadores?')) return;
    players = [];
    localStorage.removeItem(KEY);
    document.getElementById('setup').classList.remove('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('winnerBanner').style.display = 'none';
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

  function checkStatus(){
    const banner = document.getElementById('winnerBanner');
    if(config.trackPhases){
      const finisher = players.find(p => p.phase >= config.maxPhases);
      if(finisher){
        banner.style.display = 'block';
        banner.textContent = '🏆 ' + finisher.name + ' ha completado la fase ' + config.maxPhases + '. Revisad puntos para el desempate final.';
        return;
      }
    }
    if(config.threshold){
      const anyHigh = players.some(p => config.lowWins ? p.total >= config.threshold : false);
      if(anyHigh){
        const leader = bestPlayer();
        banner.style.display = 'block';
        banner.textContent = 'Alguien ha llegado a ' + config.threshold + '+. Ahora mismo va ganando ' + leader.name + ' con ' + leader.total + ' puntos.';
        return;
      }
    }
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
      if(config.trackPhases){
        phaseHtml = `
          <div class="phase-row">
            <button class="btn small" onclick="scorerChangePhase(${idx},-1)">-</button>
            <span>Fase ${p.phase||1}/${config.maxPhases}</span>
            <button class="btn small" onclick="scorerChangePhase(${idx},1)">+</button>
          </div>`;
      }
      div.innerHTML = `
        <div class="name">${p.name}</div>
        <div class="total">${p.total}</div>
        <div class="phase-label">puntos totales${config.lowWins ? ' (menos = mejor)' : ' (más = mejor)'}</div>
        ${phaseHtml}
        <div class="addrow">
          <input type="number" inputmode="numeric" id="input-${idx}" placeholder="+ puntos ronda">
          <button class="btn small" onclick="scorerAddPoints(${idx})">Sumar</button>
        </div>
        <div class="history">${p.history.map(h => `<span>${h}</span>`).join('')}</div>
      `;
      cont.appendChild(div);
    });
  }

  // expone funciones para los onclick inline
  window.scorerAddPoints = addPoints;
  window.scorerChangePhase = changePhase;
  window.scorerStart = startGame;
  window.scorerReset = resetScores;
  window.scorerNewGame = newGame;

  buildSetupInputs();
  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('resetBtn').onclick = resetScores;
  document.getElementById('newGameBtn').onclick = newGame;
  load();
}
