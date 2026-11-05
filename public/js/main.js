/**
 * MAIN.JS - Game Bootstrap, Lobby, Room Joining, and UI Controls
 */
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameContainer = document.getElementById('game-container');
  const gameCanvas = document.getElementById('game-canvas');
  const playerNameInput = document.getElementById('player-name');
  const roomCodeInput = document.getElementById('room-code');
  const startBtn = document.getElementById('btn-start');
  const practiceBtn = document.getElementById('btn-practice');
  const copyInviteBtn = document.getElementById('btn-copy-invite');
  const toggleBotsBtn = document.getElementById('btn-toggle-bots');
  const colorPickerContainer = document.getElementById('color-picker');
  const pingDisplay = document.getElementById('hud-ping');
  const roomDisplay = document.getElementById('hud-room-code');
  const chatBox = document.getElementById('chat-container');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatInputEl = document.getElementById('chat-input');
  const toastEl = document.getElementById('toast');

  let selectedColor = GameConfig.PLAYER_COLORS[0];
  let currentGame = null;
  let network = new NetworkManager();

  // 1. Check URL parameters for Room Code
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    roomCodeInput.value = roomParam.trim().toUpperCase();
  }

  // 2. Setup Color Selector
  GameConfig.PLAYER_COLORS.forEach((col, idx) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (idx === 0 ? ' selected' : '');
    swatch.style.backgroundColor = col.primary;
    swatch.title = col.name;
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = col;
    });
    colorPickerContainer.appendChild(swatch);
  });

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2500);
  }

  // 3. Start Multiplayer Game
  function launchGame(isOffline = false) {
    const playerName = (playerNameInput.value.trim() || 'Operator_' + Math.floor(Math.random() * 900 + 100));
    const roomCode = (roomCodeInput.value.trim().toUpperCase() || 'HQ_MAIN');

    lobbyScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    // Instances
    const gameMap = new GameMap();
    const raycaster = new Raycaster();
    const spriteRenderer = new SpriteRenderer();
    const soundManager = new SoundManager();
    soundManager.init();
    const particleSystem = new ParticleSystem();

    const localPlayer = new Player(
      'player_' + Math.floor(Math.random() * 10000),
      playerName,
      selectedColor,
      GameConfig,
      WeaponManager
    );

    currentGame = new Game(
      gameCanvas,
      GameConfig,
      gameMap,
      raycaster,
      spriteRenderer,
      soundManager,
      particleSystem,
      network
    );

    if (isOffline) {
      network.enableOfflineMode();
      roomDisplay.textContent = 'OFFLINE PRACTICE';
      pingDisplay.textContent = 'OFFLINE';
      currentGame.start(localPlayer);
      showToast('Offline Combat Simulation Active');
    } else {
      roomDisplay.textContent = `ROOM: ${roomCode}`;
      network.init(roomCode, playerName, selectedColor, (info) => {
        localPlayer.id = info.playerId;
        currentGame.start(localPlayer);
        showToast(`Connected to Room: ${roomCode}`);
      });
    }

    // Ping update loop
    setInterval(() => {
      if (network.connected) {
        pingDisplay.textContent = `PING: ${network.ping}ms`;
        pingDisplay.style.color = network.ping < 60 ? '#4ade80' : (network.ping < 120 ? '#facc15' : '#f87171');
      }
    }, 1000);
  }

  startBtn.addEventListener('click', () => launchGame(false));
  practiceBtn.addEventListener('click', () => launchGame(true));

  // Copy Room Invite Link
  copyInviteBtn.addEventListener('click', () => {
    const room = roomCodeInput.value.trim().toUpperCase() || (network ? network.roomId : 'HQ_MAIN');
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      showToast('Room Invite Link Copied to Clipboard!');
    }).catch(() => {
      showToast('Invite URL: ' + inviteUrl);
    });
  });

  // Toggle Bots
  toggleBotsBtn.addEventListener('click', () => {
    if (network.isOfflineMode && currentGame) {
      if (currentGame.localBots.length > 0) {
        currentGame.localBots = [];
        showToast('Local Bots Removed');
      } else {
        currentGame.spawnOfflineBots(4);
        showToast('4 Local Tactical Bots Added');
      }
    } else {
      network.toggleBots();
      showToast('Toggled Bots on Server');
    }
  });

  // Chat handling
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      if (document.activeElement === chatInputEl) {
        const text = chatInputEl.value;
        if (text.trim() !== '') {
          network.sendChat(text);
          chatInputEl.value = '';
        }
        chatInputEl.blur();
        gameCanvas.focus();
      } else {
        chatInputEl.focus();
      }
    } else if (e.code === 'Escape' && document.activeElement === chatInputEl) {
      chatInputEl.blur();
      gameCanvas.focus();
    }
  });

  network.onChatEvent = (msg) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `<span class="chat-sender">${escapeHtml(msg.sender)}:</span> ${escapeHtml(msg.text)}`;
    chatMessagesEl.appendChild(msgEl);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
