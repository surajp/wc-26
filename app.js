// Country flag emoji dictionary
const countryFlags = {
  'Algeria': '🇩🇿',
  'Argentina': '🇦🇷',
  'Australia': '🇦🇺',
  'Austria': '🇦🇹',
  'Belgium': '🇧🇪',
  'Bosnia & Herzegovina': '🇧🇦',
  'Brazil': '🇧🇷',
  'Canada': '🇨🇦',
  'Cape Verde': '🇨🇻',
  'Colombia': '🇨🇴',
  'Croatia': '🇭🇷',
  'Curaçao': '🇨🇼',
  'Czech Republic': '🇨🇿',
  'DR Congo': '🇨🇩',
  'Ecuador': '🇪🇨',
  'Egypt': '🇪🇬',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Ghana': '🇬🇭',
  'Haiti': '🇭🇹',
  'Iran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Ivory Coast': '🇨🇮',
  'Japan': '🇯🇵',
  'Jordan': '🇯🇴',
  'Mexico': '🇲🇽',
  'Morocco': '🇲🇦',
  'Netherlands': '🇳🇱',
  'New Zealand': '🇳🇿',
  'Norway': '🇳🇴',
  'Panama': '🇵🇦',
  'Paraguay': '🇵🇾',
  'Portugal': '🇵🇹',
  'Qatar': '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal': '🇸🇳',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Spain': '🇪🇸',
  'Sweden': '🇸🇪',
  'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳',
  'Turkey': '🇹🇷',
  'USA': '🇺🇸',
  'Uruguay': '🇺🇾',
  'Uzbekistan': '🇺🇿'
};

// State variables
let baseMatches = []; // Match list fetched from JSON
let activeMatches = []; // Matches list after applying predictions / live updates
let predictions = {}; // User predictions stored in localStorage
let predictorMode = false; // Is the user in predictor mode?
let activeTab = 'overview';
let activeStandingsTab = 'groups';

// Date/Time Parsing Helpers
function parseMatchDateTime(dateStr, timeStr) {
  // Normalize time zone offset (e.g. UTC-4 -> -04:00)
  let normalizedTime = timeStr.replace(/UTC([\+\-])(\d+)/, (match, sign, hours) => {
    return `${sign}${String(hours).padStart(2, '0')}:00`;
  });
  // Strip all whitespaces to ensure standard ISO formatting (e.g. "19:00 -04:00" -> "19:00-04:00")
  normalizedTime = normalizedTime.replace(/\s+/g, '');
  return new Date(`${dateStr}T${normalizedTime}`);
}

function getActiveLiveMatch() {
  const now = Date.now();
  // Check liveness against baseMatches (never mutated by predictions).
  // A live match is one that: has NO official score yet, started recently,
  // and hasn't exceeded its expected duration.
  const liveBase = baseMatches.find(m => {
    if (m.score) return false; // Official score recorded → finished
    const kickoffMs = parseMatchDateTime(m.date, m.time).getTime();
    if (isNaN(kickoffMs)) return false;
    const elapsedMs = now - kickoffMs;
    const isKnockout = !m.group;
    const durationMs = (isKnockout ? 135 : 120) * 60000;
    return elapsedMs >= 0 && elapsedMs <= durationMs;
  });
  if (!liveBase) return null;
  // Return the activeMatches copy so callers get any enriched fields (team resolution etc.)
  return activeMatches.find(m => m.num === liveBase.num) || liveBase;
}

function getMatchMinute(match) {
  const now = Date.now();
  const kickoffMs = parseMatchDateTime(match.date, match.time).getTime();
  const elapsedMins = Math.floor((now - kickoffMs) / 60000);
  
  if (elapsedMins < 0) return "0'";
  if (elapsedMins <= 45) return `${elapsedMins}'`;
  if (elapsedMins > 45 && elapsedMins <= 50) return "HT";
  if (elapsedMins > 50 && elapsedMins <= 95) return `${elapsedMins - 5}'`;
  
  const isKnockout = !match.group;
  if (isKnockout) {
    if (elapsedMins > 95 && elapsedMins <= 100) return "FT";
    if (elapsedMins > 100 && elapsedMins <= 115) return `ET ${elapsedMins - 100 + 90}'`;
    if (elapsedMins > 115 && elapsedMins <= 118) return "ET HT";
    if (elapsedMins > 118 && elapsedMins <= 133) return `ET ${elapsedMins - 118 + 105}'`;
    if (elapsedMins > 133) return "Pens";
  }
  return "90+'";
}

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  themeToggle: document.getElementById('theme-toggle'),
  liveIndicator: document.getElementById('live-indicator'),
  statsGoals: document.getElementById('stats-goals'),
  statsMatches: document.getElementById('stats-matches'),
  statsAvgGoals: document.getElementById('stats-avg-goals'),
  countdownTimer: document.getElementById('countdown-timer'),
  
  // Tab panels
  panels: {
    overview: document.getElementById('tab-overview'),
    standings: document.getElementById('tab-standings'),
    matches: document.getElementById('tab-matches'),
    bracket: document.getElementById('tab-bracket'),
    predictor: document.getElementById('tab-predictor')
  },
  
  // Overview Tab elements
  liveMatchBanner: document.getElementById('live-match-banner'),
  todaysMatchesHeading: document.getElementById('todays-matches-heading'),
  todaysMatchesList: document.getElementById('todays-matches-list'),
  upcomingMatchesList: document.getElementById('upcoming-matches-list'),
  recentResultsList: document.getElementById('recent-results-list'),
  
  // Standings Tab elements
  btnShowGroups: document.getElementById('btn-show-groups'),
  btnShowThirds: document.getElementById('btn-show-thirds'),
  groupsGrid: document.getElementById('groups-grid'),
  thirdsContainer: document.getElementById('thirds-container'),
  thirdsTableBody: document.getElementById('thirds-table-body'),
  
  // Matches Tab elements
  matchesList: document.getElementById('matches-list'),
  matchSearch: document.getElementById('match-search'),
  filterRound: document.getElementById('filter-round'),
  filterGroup: document.getElementById('filter-group'),
  filterStatus: document.getElementById('filter-status'),
  
  // Bracket Tab elements
  bracketContainer: document.getElementById('bracket-container'),
  
  // Predictor Tab elements
  predictorWelcome: document.querySelector('.predictor-welcome'),
  predictorWorkspace: document.getElementById('predictor-workspace'),
  btnStartPredicting: document.getElementById('btn-start-predicting'),
  btnResetPredictions: document.getElementById('btn-reset-predictions'),
  predStatCount: document.getElementById('pred-stat-count'),
  predStatChampion: document.getElementById('pred-stat-champion'),
  btnPredToBracket: document.getElementById('btn-pred-to-bracket'),
  predictorMatchesList: document.getElementById('predictor-matches-list'),
  predictorRoundTitle: document.getElementById('predictor-round-title'),
  
  // Predictor Modal elements
  predictorModal: document.getElementById('predictor-modal'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  predictionForm: document.getElementById('prediction-form'),
  modalMatchTitle: document.getElementById('modal-match-title'),
  modalMatchRound: document.getElementById('modal-match-round'),
  modalMatchNum: document.getElementById('modal-match-num'),
  modalFlag1: document.getElementById('modal-flag1'),
  modalFlag2: document.getElementById('modal-flag2'),
  modalName1: document.getElementById('modal-name1'),
  modalName2: document.getElementById('modal-name2'),
  modalScore1: document.getElementById('modal-score1'),
  modalScore2: document.getElementById('modal-score2'),
  modalKnockoutOptions: document.getElementById('modal-knockout-options'),
  modalEtPlayed: document.getElementById('modal-et-played'),
  modalEtScoresGroup: document.getElementById('modal-et-scores-group'),
  modalEtScore1: document.getElementById('modal-et-score1'),
  modalEtScore2: document.getElementById('modal-et-score2'),
  modalPPlayed: document.getElementById('modal-p-played'),
  modalPScoresGroup: document.getElementById('modal-p-scores-group'),
  btnPWinner1: document.getElementById('btn-p-winner1'),
  btnPWinner2: document.getElementById('btn-p-winner2'),
  modalPScore1: document.getElementById('modal-p-score1'),
  modalPScore2: document.getElementById('modal-p-score2'),
  
  notificationArea: document.getElementById('notification-area'),
  
  // Match Details Modal elements
  detailsModal: document.getElementById('details-modal'),
  detailsModalClose: document.getElementById('details-modal-close'),
  detailsModalContent: document.getElementById('details-modal-content')
};

// Flags helper
function getFlag(teamName) {
  if (countryFlags[teamName]) {
    return countryFlags[teamName];
  }
  if (teamName && (teamName.startsWith('W') || teamName.startsWith('Winner'))) {
    return '⚽';
  }
  if (teamName && (teamName.startsWith('L') || teamName.startsWith('Loser'))) {
    return '🏳️';
  }
  return '🏳️';
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupNavigation();
  loadSavedPredictions();
  fetchTournamentData();
  setupPredictorActions();
  setupModalActions();
  setupFilters();
  
  // Start countdown and match ticker
  updateCountdown();
  setInterval(updateCountdown, 60000);
});

// Load saved predictions from localStorage
function loadSavedPredictions() {
  const saved = localStorage.getItem('world_cup_predictions');
  if (saved) {
    predictions = JSON.parse(saved);
    predictorMode = true;
    updatePredictorUIState();
  }
}

// Save predictions
function savePredictions() {
  localStorage.setItem('world_cup_predictions', JSON.stringify(predictions));
}

// -------------------------------------------------------------
// Theme Management (Two-State System with OS preference default)
// -------------------------------------------------------------
function setupTheme() {
  // Get preferred theme from localStorage
  const localTheme = localStorage.getItem('color-scheme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme
  if (localTheme) {
    document.documentElement.setAttribute('data-theme', localTheme);
  } else {
    document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
  }

  // Toggle button click listener
  elements.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Save selection and update DOM
    localStorage.setItem('color-scheme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.querySelector('meta[name="color-scheme"]').content = newTheme;
  });

  // Listen to OS-level changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('color-scheme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

// -------------------------------------------------------------
// Data Fetch & Bracket Resolver Engine
// -------------------------------------------------------------
function fetchTournamentData() {
  const MIN_LOADER_MS = 2000;

  const dataPromise = fetch('worldcup.json')
    .then(res => res.json())
    .then(data => {
      // Ensure all matches have a unique 'num' identifier (missing for matches 1-72 in json)
      data.matches.forEach((m, idx) => {
        m.num = m.num || (idx + 1);
      });
      return data;
    });

  const timerPromise = new Promise(resolve => setTimeout(resolve, MIN_LOADER_MS));

  Promise.all([dataPromise, timerPromise])
    .then(([data]) => {
      baseMatches = data.matches;

      processAndRender();

      // Pull remote live scores immediately on load and then sync every 60s
      fetchRemoteUpdates();
      setInterval(fetchRemoteUpdates, 60000);

      // --- Animated exit sequence ---
      // Step 1: trigger ball-launch + loader fade-out animation
      elements.loading.classList.add('loader-exiting');

      // Step 2: after animation completes (700ms), hide loader entirely
      setTimeout(() => {
        elements.loading.classList.add('hidden');

        // Step 3: reveal the page content with a smooth slide-up
        const inner = document.getElementById('main-content-inner');
        if (inner) inner.classList.add('page-revealed');
      }, 700);
    })
    .catch(err => {
      console.error("Error loading tournament data", err);
      elements.loading.innerHTML = `<p style="color: var(--danger)">Error loading matches dataset. Please make sure worldcup.json exists in root.</p>`;
    });
}

async function fetchRemoteUpdates() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.matches && data.matches.length > 0) {
        // Merge scores from remote file if they are populated
        data.matches.forEach(remoteMatch => {
          const localMatch = baseMatches.find(m => m.num === remoteMatch.num);
          if (localMatch) {
            if (remoteMatch.score) {
              localMatch.score = remoteMatch.score;
            }
            if (remoteMatch.goals1) localMatch.goals1 = remoteMatch.goals1;
            if (remoteMatch.goals2) localMatch.goals2 = remoteMatch.goals2;
          }
        });
        processAndRender();
      }
    }
  } catch (e) {
    console.warn("Could not sync remote live updates, using local dataset", e);
  }
}

// Master function to compute bracket logic, standings, stats, and trigger renders
function processAndRender() {
  // 1. Merge baseline data with active predictions
  activeMatches = JSON.parse(JSON.stringify(baseMatches));
  
  // Apply user predictions
  for (const num in predictions) {
    const mIndex = activeMatches.findIndex(m => m.num === parseInt(num));
    if (mIndex !== -1) {
      const match = activeMatches[mIndex];
      
      // If the match has an actual score in baseMatches (live or completed), do not overwrite it
      const baseMatch = baseMatches.find(bm => bm.num === match.num);
      if (baseMatch && baseMatch.score && !baseMatch.isPrediction) {
        continue;
      }

      const p = predictions[num];
      match.score = {
        ft: p.ft
      };
      if (p.etPlayed) {
        match.score.et = p.et;
      }
      if (p.pPlayed) {
        match.score.p = p.p;
      }
      match.isPrediction = true;
      // Clear goals list since they are predictions
      match.goals1 = [];
      match.goals2 = [];
    }
  }

  // 2. Resolve knockout tournament progression (W{num} and L{num})
  resolveKnockoutBrackets();

  // 3. Compute stats
  calculateTournamentStats();

  // 4. Update the header live indicator text and classes
  const liveMatch = getActiveLiveMatch();
  if (liveMatch) {
    elements.liveIndicator.innerText = "● LIVE MATCH IN PROGRESS";
    elements.liveIndicator.style.backgroundColor = "var(--danger-soft)";
    elements.liveIndicator.style.color = "var(--danger)";
    elements.liveIndicator.style.borderColor = "rgba(239, 68, 68, 0.2)";
    elements.liveIndicator.style.display = "inline-flex";
  } else {
    elements.liveIndicator.style.display = "none";
  }

  // 5. Trigger UI render for active tabs
  renderTabContent();
}

// Recursive helper to get the winner of a match
function getMatchWinner(match) {
  if (!match || !match.score) return null;
  
  // Check penalties first
  if (match.score.p) {
    return match.score.p[0] > match.score.p[1] ? match.team1 : match.team2;
  }
  // Check extra time
  if (match.score.et) {
    return match.score.et[0] > match.score.et[1] ? match.team1 : match.team2;
  }
  // Check full time
  if (match.score.ft) {
    if (match.score.ft[0] > match.score.ft[1]) return match.team1;
    if (match.score.ft[0] < match.score.ft[1]) return match.team2;
    // Draw in knockout should ideally have ET/p, but fallback if not filled
    return null;
  }
  return null;
}

// Helper to get formatted score details, extra info (like AET/Pens), and winner status
function getMatchScoreInfo(m) {
  if (!m || !m.score) {
    return {
      score1: "",
      score2: "",
      winnerId: null, // 'team1', 'team2', or null
      extraInfo: "", // e.g. "AET", "Pens"
      penaltiesStr: "" // e.g. "(3-4 Pens)"
    };
  }

  let s1 = m.score.ft[0];
  let s2 = m.score.ft[1];
  let extraInfo = "";
  let penaltiesStr = "";
  let winnerId = null;

  if (m.score.et) {
    s1 = m.score.et[0];
    s2 = m.score.et[1];
    extraInfo = "AET";
  }

  if (m.score.p) {
    penaltiesStr = `(${m.score.p[0]}-${m.score.p[1]} p)`;
    extraInfo = "Pens";
  }

  const winner = getMatchWinner(m);
  const t1 = m.team1_resolved || m.team1;
  const t2 = m.team2_resolved || m.team2;
  if (winner) {
    if (winner === t1 || winner === m.team1) {
      winnerId = 'team1';
    } else if (winner === t2 || winner === m.team2) {
      winnerId = 'team2';
    }
  }

  return {
    score1: s1,
    score2: s2,
    winnerId: winnerId,
    extraInfo: extraInfo,
    penaltiesStr: penaltiesStr
  };
}

// Checks if a match is completed in real-life (or simulation) and is no longer playable/predictable
function isMatchOver(m) {
  if (!m || !m.score) return false;
  if (m.isPrediction) return false;
  
  // If the match is currently live, it is not considered over yet
  const isLive = getActiveLiveMatch()?.num === m.num;
  if (isLive) return false;
  
  return true;
}

// Formats YYYY-MM-DD date string into words (e.g. "Jul 3, 2026")
function formatDateInWords(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, monthIdx, day);
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Recursive helper to get the loser of a match
function getMatchLoser(match) {
  if (!match || !match.score) return null;
  const winner = getMatchWinner(match);
  if (!winner) return null;
  return winner === match.team1 ? match.team2 : match.team1;
}

// Recursively resolve a team string which might be a placeholder W83 or L101
function resolvePlaceholderTeam(teamString) {
  if (!teamString) return "";
  
  // If winner placeholder (e.g. W83)
  if (teamString.startsWith('W') && /^\d+$/.test(teamString.substring(1))) {
    const matchNum = parseInt(teamString.substring(1));
    const targetMatch = activeMatches.find(m => m.num === matchNum);
    const winner = getMatchWinner(targetMatch);
    if (winner) {
      return resolvePlaceholderTeam(winner); // Recurse in case that was also a placeholder
    }
    return teamString; // Undetermined winner
  }
  
  // If loser placeholder (e.g. L101)
  if (teamString.startsWith('L') && /^\d+$/.test(teamString.substring(1))) {
    const matchNum = parseInt(teamString.substring(1));
    const targetMatch = activeMatches.find(m => m.num === matchNum);
    const loser = getMatchLoser(targetMatch);
    if (loser) {
      return resolvePlaceholderTeam(loser);
    }
    return teamString;
  }
  
  return teamString;
}

// Scan and update knockout matches placeholders with resolved team names
function resolveKnockoutBrackets() {
  // Knockouts occur after match 72. Sort them by number to resolve sequentially (R32 -> R16 -> QF -> SF -> Final)
  const knockouts = activeMatches.filter(m => !m.group).sort((a, b) => a.num - b.num);
  
  knockouts.forEach(match => {
    match.team1_resolved = resolvePlaceholderTeam(match.team1);
    match.team2_resolved = resolvePlaceholderTeam(match.team2);
  });
}

// Calculate total goals, played matches, average goals
function calculateTournamentStats() {
  let goals = 0;
  let played = 0;
  
  activeMatches.forEach(m => {
    if (m.score && m.score.ft) {
      played++;
      if (m.score.et) {
        goals += m.score.et[0] + m.score.et[1];
      } else {
        goals += m.score.ft[0] + m.score.ft[1];
      }
    }
  });

  elements.statsGoals.innerText = goals;
  elements.statsMatches.innerText = `${played}/104`;
  elements.statsAvgGoals.innerText = played > 0 ? (goals / played).toFixed(2) : "0.00";
}

// -------------------------------------------------------------
// Live Match Notification
// -------------------------------------------------------------
function showLiveNotification(title, message) {
  const container = elements.notificationArea;
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = `
    <div class="notification-title">🔔 ${title}</div>
    <div class="notification-body">${message}</div>
  `;
  container.appendChild(notification);
  
  // Slide out and remove
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 6000);
}

// -------------------------------------------------------------
// UI Navigation / Tab Switcher
// -------------------------------------------------------------
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate current active tab
      tabs.forEach(t => t.classList.remove('active'));
      for (const panel in elements.panels) {
        elements.panels[panel].classList.remove('active');
      }
      
      // Activate selected tab
      tab.classList.add('active');
      const target = tab.dataset.tab;
      activeTab = target;
      elements.panels[target].classList.add('active');
      
      renderTabContent();
    });
  });

  // Standings Sub-navigation
  elements.btnShowGroups.addEventListener('click', () => {
    elements.btnShowGroups.classList.add('active');
    elements.btnShowThirds.classList.remove('active');
    elements.groupsGrid.classList.remove('hidden');
    elements.thirdsContainer.classList.add('hidden');
    activeStandingsTab = 'groups';
  });

  elements.btnShowThirds.addEventListener('click', () => {
    elements.btnShowGroups.classList.remove('active');
    elements.btnShowThirds.classList.add('active');
    elements.groupsGrid.classList.add('hidden');
    elements.thirdsContainer.classList.remove('hidden');
    activeStandingsTab = 'thirds';
    renderThirdsStandings();
  });
}

function renderTabContent() {
  if (baseMatches.length === 0) return;
  
  switch(activeTab) {
    case 'overview':
      renderOverviewTab();
      break;
    case 'standings':
      if (activeStandingsTab === 'groups') {
        renderGroupsStandings();
      } else {
        renderThirdsStandings();
      }
      break;
    case 'matches':
      renderMatchesList();
      break;
    case 'bracket':
      renderTournamentBracket();
      break;
    case 'predictor':
      renderPredictorWorkspace();
      break;
  }
}

// -------------------------------------------------------------
// 1. Overview Tab Rendering
// -------------------------------------------------------------
function renderOverviewTab() {
  // A. Live Match Banner (Only show if a match is actively happening in real-time)
  const liveMatch = getActiveLiveMatch();
  
  if (liveMatch) {
    elements.liveMatchBanner.classList.remove('hidden');
    const t1 = liveMatch.team1_resolved || liveMatch.team1;
    const t2 = liveMatch.team2_resolved || liveMatch.team2;
    const flag1 = getFlag(t1);
    const flag2 = getFlag(t2);
    const minuteStr = getMatchMinute(liveMatch);
    
    const info = getMatchScoreInfo(liveMatch);
    const sc1 = liveMatch.score ? info.score1 : 0;
    const sc2 = liveMatch.score ? info.score2 : 0;
    
    let bannerHTML = `
      <div class="live-match-header">
        <span class="live-badge-glow">LIVE</span>
        <span class="live-time">${minuteStr}</span>
        <span style="font-size: 0.8rem; color: var(--text-muted)">${liveMatch.round} • Match ${liveMatch.num}</span>
      </div>
      <div class="live-match-scores">
        <div class="live-team">
          <span class="live-flag">${flag1}</span>
          <span class="live-team-name">${t1}</span>
        </div>
        <div class="live-score-val">
          ${sc1}
        </div>
        <div class="live-vs">vs</div>
        <div class="live-score-val">
          ${sc2}
        </div>
        <div class="live-team">
          <span class="live-flag">${flag2}</span>
          <span class="live-team-name">${t2}</span>
        </div>
      </div>
    `;

    // Check and add predicted score if user has predicted it
    const pred = predictions[liveMatch.num];
    if (pred) {
      let predExtra = "";
      if (pred.etPlayed) predExtra += " (AET)";
      if (pred.pPlayed) {
        const pWinnerName = pred.p[0] > pred.p[1] ? t1 : t2;
        predExtra += ` (${pred.p[0]}-${pred.p[1]} pens · ${pWinnerName} wins)`;
      }
      bannerHTML += `
        <div class="live-prediction-summary">
          <span class="live-pred-label">🔮 Predicted Score:</span>
          <span class="live-pred-value">${pred.ft[0]} – ${pred.ft[1]}${predExtra}</span>
        </div>
      `;
    }

    // Add penalty shootout display if available
    if (liveMatch.score && liveMatch.score.p) {
      const pWinner = liveMatch.score.p[0] > liveMatch.score.p[1] ? t1 : t2;
      bannerHTML += `
        <div style="text-align: center; font-size: 0.9rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 1rem;">
          ${pWinner} won ${liveMatch.score.p[0]} - ${liveMatch.score.p[1]} on Penalties
        </div>
      `;
    }

    // Display goals if populated in the feed
    const hasGoals = (liveMatch.goals1 && liveMatch.goals1.length > 0) || (liveMatch.goals2 && liveMatch.goals2.length > 0);
    if (hasGoals) {
      bannerHTML += `
        <div class="live-match-events" style="margin-top: 10px;">
          <div class="scorer-list">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 4px;">
              <span>Goals (${t1}): ${liveMatch.goals1.map(g => `${g.name} ${g.minute}'`).join(', ') || 'None'}</span>
              <span>Goals (${t2}): ${liveMatch.goals2.map(g => `${g.name} ${g.minute}'`).join(', ') || 'None'}</span>
            </div>
          </div>
        </div>
      `;
    }
    
    elements.liveMatchBanner.innerHTML = bannerHTML;
  } else {
    elements.liveMatchBanner.innerHTML = "";
    elements.liveMatchBanner.classList.add('hidden');
  }

  // B. Today's Matches List
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const formattedToday = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (elements.todaysMatchesHeading) {
    elements.todaysMatchesHeading.textContent = `Today's Matches (${formattedToday})`;
  }

  const todaysMatches = activeMatches.filter(m => m.date === todayStr);
  
  let todaysHTML = "";
  if (todaysMatches.length > 0) {
    todaysHTML = todaysMatches.map(m => {
      const t1 = m.team1_resolved || m.team1;
      const t2 = m.team2_resolved || m.team2;
      const flag1 = getFlag(t1);
      const flag2 = getFlag(t2);
      const isMatchLive = getActiveLiveMatch()?.num === m.num;
      
      const info = getMatchScoreInfo(m);
      const sc1 = m.score ? info.score1 : "";
      const sc2 = m.score ? info.score2 : "";
      const winner1Class = info.winnerId === 'team1' ? 'winner' : '';
      const winner2Class = info.winnerId === 'team2' ? 'winner' : '';
      
      let statusText = isMatchLive ? `${getMatchMinute(m)} (LIVE)` : (m.score ? "FT" : m.time.split(" ")[0]);
      if (m.score && !isMatchLive) {
        if (info.extraInfo === "AET") statusText = "AET";
        else if (info.extraInfo === "Pens") statusText = "Pens";
      }
      
      return `
        <div class="match-row-item" onclick="openMatchDetails(event, ${m.num})">
          <div class="match-time-col">
            <span class="match-status-badge ${m.score ? 'completed' : ''}">${statusText}</span>
            <span style="font-size: 0.65rem;">Match ${m.num}</span>
          </div>
          <div class="match-teams-col">
            <div class="match-team-row ${winner1Class}">
              <div class="match-team-name-flag"><span>${flag1}</span> ${t1}</div>
              <span class="match-score-num">${sc1}</span>
            </div>
            <div class="match-team-row ${winner2Class}">
              <div class="match-team-name-flag"><span>${flag2}</span> ${t2}</div>
              <span class="match-score-num">${sc2}</span>
            </div>
            ${info.penaltiesStr ? `<div style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 600; text-align: right; margin-top: 2px;">${info.penaltiesStr}</div>` : ''}
          </div>
          <div class="match-action-col">
            ${isMatchOver(m) ? `
              ${predictions[m.num] ? `
                <span style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 600; border: 1px dashed rgba(245, 158, 11, 0.35); padding: 0.15rem 0.35rem; border-radius: var(--radius-sm)">
                  Pred: ${predictions[m.num].ft[0]}-${predictions[m.num].ft[1]}
                </span>
              ` : ''}
            ` : `
              <button class="btn-predict" onclick="openPredictor(${m.num})">
                ${predictions[m.num] ? 'Edit Pred' : 'Predict'}
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  } else {
    todaysHTML = `<p style="color: var(--text-muted); text-align: center;">No matches scheduled for today.</p>`;
  }
  elements.todaysMatchesList.innerHTML = todaysHTML;

  const upcomingMatches = activeMatches
    .filter(m => !m.score)
    .sort((a, b) => {
      const timeA = parseMatchDateTime(a.date, a.time).getTime();
      const timeB = parseMatchDateTime(b.date, b.time).getTime();
      return timeA - timeB;
    })
    .slice(0, 4);
  let upcomingHTML = "";
  if (upcomingMatches.length > 0) {
    upcomingHTML = upcomingMatches.map(m => {
      const flag1 = getFlag(m.team1_resolved);
      const flag2 = getFlag(m.team2_resolved);
      const dateFormatted = formatDateInWords(m.date);
      
      return `
        <div class="match-row-item" onclick="openMatchDetails(event, ${m.num})">
          <div class="match-time-col">
            <span>${dateFormatted}</span>
            <span style="font-size: 0.65rem;">${m.time.split(" ")[0]}</span>
          </div>
          <div class="match-teams-col">
            <div class="match-team-row">
              <div class="match-team-name-flag"><span>${flag1}</span> ${m.team1_resolved}</div>
            </div>
            <div class="match-team-row">
              <div class="match-team-name-flag"><span>${flag2}</span> ${m.team2_resolved}</div>
            </div>
          </div>
          <div class="match-action-col">
            <button class="btn-predict" onclick="openPredictor(${m.num})">Predict</button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    upcomingHTML = `<p style="color: var(--text-muted); text-align: center;">No more upcoming matches. Final is near!</p>`;
  }
  elements.upcomingMatchesList.innerHTML = upcomingHTML;

  // D. Recent Results
  // Pull 4 matches that finished recently (completed matches, sorting descending by date/num)
  const recentMatches = activeMatches.filter(m => m.score).reverse().slice(0, 4);
  let recentHTML = "";
  if (recentMatches.length > 0) {
    recentHTML = recentMatches.map(m => {
      const t1 = m.team1_resolved || m.team1;
      const t2 = m.team2_resolved || m.team2;
      const flag1 = getFlag(t1);
      const flag2 = getFlag(t2);
      const info = getMatchScoreInfo(m);
      const winner1Class = info.winnerId === 'team1' ? 'winner' : '';
      const winner2Class = info.winnerId === 'team2' ? 'winner' : '';
      
      let statusText = "FT";
      if (info.extraInfo === "AET") statusText = "AET";
      else if (info.extraInfo === "Pens") statusText = "Pens";
      
      return `
        <div class="match-row-item" onclick="openMatchDetails(event, ${m.num})">
          <div class="match-time-col">
            <span class="match-status-badge completed">${statusText}</span>
            <span style="font-size: 0.65rem;">Match ${m.num}</span>
          </div>
          <div class="match-teams-col">
            <div class="match-team-row ${winner1Class}">
              <div class="match-team-name-flag"><span>${flag1}</span> ${t1}</div>
              <span class="match-score-num">${info.score1}</span>
            </div>
            <div class="match-team-row ${winner2Class}">
              <div class="match-team-name-flag"><span>${flag2}</span> ${t2}</div>
              <span class="match-score-num">${info.score2}</span>
            </div>
            ${info.penaltiesStr ? `<div style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 600; text-align: right; margin-top: 2px;">${info.penaltiesStr}</div>` : ''}
          </div>
          ${predictions[m.num] ? `
            <div class="match-action-col">
              <span style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 600; border: 1px dashed rgba(245, 158, 11, 0.35); padding: 0.15rem 0.35rem; border-radius: var(--radius-sm)">
                Pred: ${predictions[m.num].ft[0]}-${predictions[m.num].ft[1]}
              </span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    recentHTML = `<p style="color: var(--text-muted); text-align: center;">No recent results.</p>`;
  }
  elements.recentResultsList.innerHTML = recentHTML;
}

// -------------------------------------------------------------
// 2. Standings Tab Rendering
// -------------------------------------------------------------
function calculateStandings() {
  const groups = {}; // { "Group A": [ { name, mp, w, d, l, gf, ga, gd, pts }, ... ] }
  
  // Calculate group stage matches (matches 1 to 72)
  activeMatches.forEach(m => {
    if (!m.group) return; // Ignore knockouts
    
    if (!groups[m.group]) {
      groups[m.group] = {};
    }
    
    const g = groups[m.group];
    if (!g[m.team1]) g[m.team1] = { name: m.team1, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    if (!g[m.team2]) g[m.team2] = { name: m.team2, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    
    if (m.score && m.score.ft) {
      const s1 = m.score.ft[0];
      const s2 = m.score.ft[1];
      
      const t1 = g[m.team1];
      const t2 = g[m.team2];
      
      t1.mp++;
      t2.mp++;
      t1.gf += s1;
      t1.ga += s2;
      t2.gf += s2;
      t2.ga += s1;
      
      if (s1 > s2) {
        t1.w++;
        t1.pts += 3;
        t2.l++;
      } else if (s1 < s2) {
        t2.w++;
        t2.pts += 3;
        t1.l++;
      } else {
        t1.d++;
        t2.d++;
        t1.pts += 1;
        t2.pts += 1;
      }
      
      t1.gd = t1.gf - t1.ga;
      t2.gd = t2.gf - t2.ga;
    }
  });

  // Sort groups
  const sorted = {};
  for (const groupName in groups) {
    const teams = Object.values(groups[groupName]);
    teams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
    sorted[groupName] = teams;
  }
  
  return sorted;
}

function renderGroupsStandings() {
  const sortedGroups = calculateStandings();
  let groupsHTML = "";
  
  // Sort group names alphabet (A -> L)
  const groupNames = Object.keys(sortedGroups).sort();
  
  groupNames.forEach(groupName => {
    const teams = sortedGroups[groupName];
    
    groupsHTML += `
      <div class="group-card card">
        <h4><span>${groupName}</span></h4>
        <div class="table-responsive">
          <table class="standings-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>P</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              ${teams.map((t, idx) => {
                const flag = getFlag(t.name);
                const isQualifying = idx < 2; // Top 2 qualify
                return `
                  <tr>
                    <td class="row-pos">${idx + 1}</td>
                    <td>
                      <div class="row-team">
                        <span>${flag}</span>
                        <span style="font-size: 0.8rem;">${t.name}</span>
                      </div>
                    </td>
                    <td>${t.mp}</td>
                    <td style="color: ${t.gd > 0 ? 'var(--accent-green)' : (t.gd < 0 ? 'var(--danger)' : 'var(--text-muted)')}">
                      ${t.gd > 0 ? '+' : ''}${t.gd}
                    </td>
                    <td style="font-weight: 700;">${t.pts}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  elements.groupsGrid.innerHTML = groupsHTML;
}

function renderThirdsStandings() {
  const sortedGroups = calculateStandings();
  const thirds = [];
  
  // Collect 3rd placed team from each group
  for (const groupName in sortedGroups) {
    const teams = sortedGroups[groupName];
    if (teams.length >= 3) {
      thirds.push({
        groupName: groupName,
        team: teams[2]
      });
    }
  }
  
  // Sort thirds ranking
  thirds.sort((a, b) => {
    const tA = a.team;
    const tB = b.team;
    if (tB.pts !== tA.pts) return tB.pts - tA.pts;
    if (tB.gd !== tA.gd) return tB.gd - tA.gd;
    if (tB.gf !== tA.gf) return tB.gf - tA.gf;
    return tA.name.localeCompare(tB.name);
  });
  
  let thirdsHTML = "";
  thirds.forEach((item, idx) => {
    const flag = getFlag(item.team.name);
    const isQualifying = idx < 8; // Top 8 best thirds qualify for R32
    
    thirdsHTML += `
      <tr class="${isQualifying ? 'qualifying' : ''}">
        <td class="row-pos">${idx + 1}</td>
        <td style="font-weight: 600;">${item.groupName}</td>
        <td>
          <div class="row-team">
            <span>${flag}</span>
            <span>${item.team.name}</span>
          </div>
        </td>
        <td>${item.team.mp}</td>
        <td>${item.team.w}</td>
        <td>${item.team.d}</td>
        <td>${item.team.l}</td>
        <td>${item.team.gf}</td>
        <td>${item.team.ga}</td>
        <td style="color: ${item.team.gd > 0 ? 'var(--accent-green)' : (item.team.gd < 0 ? 'var(--danger)' : 'var(--text-muted)')}">
          ${item.team.gd > 0 ? '+' : ''}${item.team.gd}
        </td>
        <td style="font-weight: 700; color: var(--text-main);">${item.team.pts}</td>
        <td>
          <span class="status-indicator ${isQualifying ? 'q' : 'el'}">
            ${isQualifying ? 'Q (R32)' : 'ELIMINATED'}
          </span>
        </td>
      </tr>
    `;
  });
  
  elements.thirdsTableBody.innerHTML = thirdsHTML;
}

// -------------------------------------------------------------
// 3. Matches & Schedule Rendering
// -------------------------------------------------------------
function setupFilters() {
  const runFilter = () => {
    renderMatchesList();
  };
  
  elements.matchSearch.addEventListener('input', runFilter);
  elements.filterRound.addEventListener('change', runFilter);
  elements.filterGroup.addEventListener('change', runFilter);
  elements.filterStatus.addEventListener('change', runFilter);
}

function renderMatchesList() {
  const searchQuery = elements.matchSearch.value.toLowerCase();
  const roundFilter = elements.filterRound.value;
  const groupFilter = elements.filterGroup.value;
  const statusFilter = elements.filterStatus.value;
  
  let filtered = activeMatches;
  
  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(m => {
      const t1 = (m.team1_resolved || m.team1 || "").toLowerCase();
      const t2 = (m.team2_resolved || m.team2 || "").toLowerCase();
      return t1.includes(searchQuery) || t2.includes(searchQuery);
    });
  }
  
  // Round filter
  if (roundFilter !== 'all') {
    filtered = filtered.filter(m => {
      const r = m.round.toLowerCase();
      if (roundFilter === 'group') return m.group;
      if (roundFilter === 'r32') return r === 'round of 32';
      if (roundFilter === 'r16') return r === 'round of 16';
      if (roundFilter === 'qf') return r === 'quarter-final';
      if (roundFilter === 'sf') return r === 'semi-final';
      if (roundFilter === 'final') return r === 'final' || r === 'match for third place';
      return true;
    });
  }
  
  // Group filter
  if (groupFilter !== 'all') {
    filtered = filtered.filter(m => m.group === groupFilter);
  }
  
  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(m => {
      if (statusFilter === 'played') return m.score;
      if (statusFilter === 'unplayed') return !m.score;
      return true;
    });
  }
  
  let matchesHTML = "";
  if (filtered.length > 0) {
    matchesHTML = filtered.map(m => {
      const flag1 = getFlag(m.team1_resolved || m.team1);
      const flag2 = getFlag(m.team2_resolved || m.team2);
      
      const t1 = m.team1_resolved || m.team1;
      const t2 = m.team2_resolved || m.team2;
      
      const info = getMatchScoreInfo(m);
      const sc1 = m.score ? info.score1 : "";
      const sc2 = m.score ? info.score2 : "";
      const winner1Class = info.winnerId === 'team1' ? 'winner' : '';
      const winner2Class = info.winnerId === 'team2' ? 'winner' : '';
      
      let pDisplay = "";
      if (info.penaltiesStr) {
        pDisplay = `<div style="font-size: 0.75rem; color: var(--accent-gold); font-weight: 600; margin-top: 2px;">
          ${info.penaltiesStr.replace('p)', 'Pens)')}
        </div>`;
      } else if (info.extraInfo === "AET") {
        pDisplay = `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
          (After Extra Time)
        </div>`;
      }
      
      let scorerDisplay = "";
      if (m.goals1 && (m.goals1.length > 0 || m.goals2.length > 0)) {
        scorerDisplay = `
          <div class="match-scorers">
            <div class="scorer-list">
              ${m.goals1.map(g => `<div>⚽ ${g.name} ${g.minute}'</div>`).join('')}
              ${m.goals2.map(g => `<div>⚽ ${g.name} ${g.minute}'</div>`).join('')}
            </div>
          </div>
        `;
      }

      let statusLabel = "FT";
      if (m.isPrediction) {
        statusLabel = "PRED";
      } else if (m.score) {
        if (info.extraInfo === "AET") statusLabel = "AET";
        else if (info.extraInfo === "Pens") statusLabel = "Pens";
      }

      return `
        <div class="match-card card ${m.isPrediction ? 'predicted-card' : ''}" onclick="openMatchDetails(event, ${m.num})">
          <div class="match-card-header">
            <span class="round-badge">${m.group || m.round}</span>
            <span style="display: flex; align-items: center;">
              ${m.isPrediction ? '<span class="prediction-tag" style="font-size: 0.6rem; padding: 0.1rem 0.35rem; margin-right: 0.4rem;">PREDICTION</span>' : ''}
              <span>Match ${m.num}</span>
            </span>
          </div>
          
          <div class="match-card-body">
            <div class="m-team-row ${winner1Class}">
              <div class="m-flag-name">
                <span class="m-flag">${flag1}</span>
                <span>${t1}</span>
              </div>
              <span class="m-score ${m.isPrediction ? 'predicted-score-value' : ''}">${sc1 !== "" ? sc1 : ""}</span>
            </div>
            
            <div class="m-team-row ${winner2Class}">
              <div class="m-flag-name">
                <span class="m-flag">${flag2}</span>
                <span>${t2}</span>
              </div>
              <span class="m-score ${m.isPrediction ? 'predicted-score-value' : ''}">${sc2 !== "" ? sc2 : ""}</span>
            </div>
            ${m.isPrediction ? `<div class="predicted-scores-sublabel">🔮 Predicted Scoreline</div>` : ''}
            ${pDisplay}
            ${scorerDisplay}
          </div>
          
          <div class="match-card-footer">
            <span>📅 ${formatDateInWords(m.date)} • ${m.time.split(" ")[0]}</span>
            <span class="ground-name" title="${m.ground}">📍 ${m.ground.split(" (")[0]}</span>
            ${!isMatchOver(m) ? `
              <button class="btn-predict" onclick="openPredictor(${m.num})">
                ${predictions[m.num] || m.isPrediction ? 'Edit Pred' : 'Predict'}
              </button>
            ` : `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${predictions[m.num] ? `
                  <span class="status-indicator" style="background: rgba(245, 158, 11, 0.12); color: var(--accent-gold); border: 1px solid rgba(245, 158, 11, 0.2); font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.4rem; border-radius: var(--radius-sm)">
                    Pred: ${predictions[m.num].ft[0]}-${predictions[m.num].ft[1]}
                  </span>
                ` : ''}
                <span class="status-indicator q" style="background: transparent; color: var(--text-muted); font-size: 0.75rem">${statusLabel}</span>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  } else {
    matchesHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        No matches match the filter criteria.
      </div>
    `;
  }
  
  elements.matchesList.innerHTML = matchesHTML;
}

// -------------------------------------------------------------
// 4. Bracket Rendering
// -------------------------------------------------------------
function renderTournamentBracket() {
  const rounds = [
    { title: 'Round of 32', key: 'Round of 32', class: 'bracket-column-r32' },
    { title: 'Round of 16', key: 'Round of 16', class: 'bracket-column-r16' },
    { title: 'Quarter-finals', key: 'Quarter-final', class: 'bracket-column-qf' },
    { title: 'Semi-finals', key: 'Semi-final', class: 'bracket-column-sf' },
    { title: 'Finals', key: 'Final', class: 'bracket-column-final' } // Special handling for final + 3rd place
  ];

  let bracketHTML = "";
  
  rounds.forEach((round, colIdx) => {
    let matchesInRound = [];
    if (round.key === 'Final') {
      // Include both Final and 3rd Place match in the finals column
      matchesInRound = activeMatches.filter(m => m.round === 'Final' || m.round === 'Match for third place').sort((a,b) => b.num - a.num); // Final first (104), 3rd place second (103)
    } else {
      matchesInRound = activeMatches.filter(m => m.round === round.key).sort((a,b) => a.num - b.num);
    }
    
    bracketHTML += `
      <div class="bracket-column ${round.class}">
        <div class="bracket-column-title">${round.title}</div>
        ${matchesInRound.map(m => {
          const t1 = m.team1_resolved || m.team1;
          const t2 = m.team2_resolved || m.team2;
          const flag1 = getFlag(t1);
          const flag2 = getFlag(t2);
          
          const info = getMatchScoreInfo(m);
          const sc1 = m.score ? info.score1 : "";
          const sc2 = m.score ? info.score2 : "";
          
          const winner1Class = info.winnerId === 'team1' ? 'winner' : '';
          const winner2Class = info.winnerId === 'team2' ? 'winner' : '';
          
          let penaltyHTML = "";
          if (info.penaltiesStr) {
            penaltyHTML = ` <span class="b-penalty">${info.penaltiesStr}</span>`;
          } else if (info.extraInfo === "AET") {
            penaltyHTML = ` <span class="b-penalty" style="color: var(--text-muted); font-size: 0.6rem;">(AET)</span>`;
          }

          const isClickable = !isMatchOver(m);
          const cursorStyle = isClickable ? 'cursor: pointer;' : '';

          return `
            <div class="bracket-match-wrapper">
              <div class="bracket-match-card ${m.isPrediction ? 'predicted-bracket-card' : ''}" style="cursor: pointer;" onclick="openMatchDetails(event, ${m.num})">
                <div class="b-match-num">
                  <span>Match ${m.num}${m.isPrediction ? ' <span class="prediction-tag" style="font-size: 0.5rem; padding: 0.05rem 0.2rem; border-radius: 2px;">PRED</span>' : ''}</span>
                  <span style="font-size: 0.6rem;">${m.round === 'Match for third place' ? '3rd Place' : formatDateInWords(m.date)}</span>
                </div>
                
                <div class="b-team ${winner1Class}">
                  <div class="b-flag-name" title="${t1}">
                    <span>${flag1}</span>
                    <span>${t1}</span>
                  </div>
                  <span class="b-score">${sc1 !== "" ? sc1 : ""}${winner1Class ? penaltyHTML : ''}</span>
                </div>
                
                <div class="b-team ${winner2Class}">
                  <div class="b-flag-name" title="${t2}">
                    <span>${flag2}</span>
                    <span>${t2}</span>
                  </div>
                  <span class="b-score">${sc2 !== "" ? sc2 : ""}${winner2Class ? penaltyHTML : ''}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  });
  
  elements.bracketContainer.innerHTML = bracketHTML;
  setupBracketDragPanning();
}

function setupBracketDragPanning() {
  const slider = document.querySelector('.bracket-viewport');
  let isDown = false;
  let startX;
  let scrollLeft;

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.style.cursor = 'grabbing';
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });
  slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.style.cursor = 'grab';
  });
  slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.style.cursor = 'grab';
  });
  slider.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5; //scroll-fast
    slider.scrollLeft = scrollLeft - walk;
  });
}

// -------------------------------------------------------------
// 5. Predictor Tab Workspace Rendering
// -------------------------------------------------------------
function setupPredictorActions() {
  elements.btnStartPredicting.addEventListener('click', () => {
    predictorMode = true;
    updatePredictorUIState();
    renderPredictorWorkspace();
    
    // Deactivate simulator active indicator
    elements.liveIndicator.innerText = "● PREDICTOR ACTIVE";
    elements.liveIndicator.style.backgroundColor = "var(--accent-green-soft)";
    elements.liveIndicator.style.color = "var(--accent-green)";
    elements.liveIndicator.style.borderColor = "var(--accent-green)";
    
    processAndRender();
  });

  elements.btnResetPredictions.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all your predictions and reset to defaults?")) {
      predictions = {};
      localStorage.removeItem('world_cup_predictions');
      predictorMode = false;
      
      elements.liveIndicator.innerText = "● LIVE DATA SYNCED";
      elements.liveIndicator.style.backgroundColor = "var(--accent-green-soft)";
      elements.liveIndicator.style.color = "var(--accent-green)";
      elements.liveIndicator.style.borderColor = "var(--accent-green)";
      
      updatePredictorUIState();
      processAndRender();
    }
  });

  elements.btnPredToBracket.addEventListener('click', () => {
    // Switch to bracket tab
    document.querySelector('.tab-btn[data-tab="bracket"]').click();
  });
}

function updatePredictorUIState() {
  if (predictorMode) {
    elements.predictorWelcome.classList.add('hidden');
    elements.predictorWorkspace.classList.remove('hidden');
  } else {
    elements.predictorWelcome.classList.remove('hidden');
    elements.predictorWorkspace.classList.add('hidden');
  }
}

// Helper to render HTML for a predictor match card
function getPredictorMatchCardHTML(m) {
  const t1 = m.team1_resolved || m.team1;
  const t2 = m.team2_resolved || m.team2;
  const flag1 = getFlag(t1);
  const flag2 = getFlag(t2);
  
  const hasPred = !!predictions[m.num];
  const info = getMatchScoreInfo(m);
  
  const sc1 = m.score ? info.score1 : "";
  const sc2 = m.score ? info.score2 : "";
  
  const winner1Class = info.winnerId === 'team1' ? 'winner' : '';
  const winner2Class = info.winnerId === 'team2' ? 'winner' : '';
  
  let pDisplay = "";
  if (info.penaltiesStr) {
    pDisplay = `<div style="color: var(--accent-gold); font-size: 0.75rem; font-weight: 600;">
      ${info.penaltiesStr.replace('p)', 'Pens)')}
    </div>`;
  } else if (info.extraInfo === "AET") {
    pDisplay = `<div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">
      (After Extra Time)
    </div>`;
  }

  const t1Placeholder = t1.startsWith('W') || t1.startsWith('L');
  const t2Placeholder = t2.startsWith('W') || t2.startsWith('L');
  const disabledClass = (t1Placeholder || t2Placeholder) ? 'disabled' : '';

  return `
    <div class="match-card card predictor-match-card ${disabledClass} ${hasPred ? 'live-match-banner' : ''}">
      <div class="match-card-header">
        <span class="round-badge">${m.round}</span>
        <span>Match ${m.num}</span>
      </div>
      <div class="match-card-body">
        <div class="m-team-row ${winner1Class}">
          <div class="m-flag-name">
            <span class="m-flag">${flag1}</span>
            <span>${t1}</span>
          </div>
          <strong class="m-score">${sc1}</strong>
        </div>
        <div class="m-team-row ${winner2Class}">
          <div class="m-flag-name">
            <span class="m-flag">${flag2}</span>
            <span>${t2}</span>
          </div>
          <strong class="m-score">${sc2}</strong>
        </div>
        ${pDisplay}
      </div>
      <div class="match-card-footer" style="margin-top: 10px; padding-top: 10px;">
        <span style="font-size: 0.7rem; color: var(--text-muted)">${m.ground.split(" (")[0]}</span>
        ${t1Placeholder || t2Placeholder ? `
          <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Awaiting previous rounds...</span>
        ` : (isMatchOver(m) ? `
          <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Match Completed</span>
        ` : `
          <button class="btn-predict" onclick="openPredictor(${m.num})">
            ${hasPred ? 'Update Prediction' : 'Predict Score'}
          </button>
        `)}
      </div>
    </div>
  `;
}

function renderPredictorWorkspace() {
  if (!predictorMode) return;
  
  // Find all matches from Round of 32 onwards (matches 73 to 104)
  const predictorMatches = activeMatches.filter(m => m.num >= 73).sort((a,b) => a.num - b.num);
  
  // Filter which round is currently active to predict (find the first round that has unpredicted matches, or default to R32)
  const rounds = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"];
  let activeRoundIndex = 0;
  
  // Let's count how many predictions are made
  const totalPredictableCount = predictorMatches.length; // 32 knockout games
  let predictedCount = 0;
  predictorMatches.forEach(m => {
    if (predictions[m.num]) predictedCount++;
  });
  
  elements.predStatCount.innerText = `${predictedCount} / ${totalPredictableCount}`;
 
  // Find projected champion
  const finalMatch = activeMatches.find(m => m.num === 104);
  const champ = getMatchWinner(finalMatch);
  if (champ) {
    const flag = getFlag(champ);
    elements.predStatChampion.innerHTML = `${flag} ${champ}`;
  } else {
    elements.predStatChampion.innerText = "Undetermined";
  }
 
  // Determine active predicting round (default to round containing first unpredicted match)
  const firstUnpredicted = predictorMatches.find(m => !predictions[m.num]);
  if (firstUnpredicted) {
    activeRoundIndex = rounds.indexOf(firstUnpredicted.round);
    if (activeRoundIndex === -1) {
      if (firstUnpredicted.round === "Match for third place") activeRoundIndex = 4; // Finals column
      else activeRoundIndex = 0;
    }
  } else {
    activeRoundIndex = 4; // All predicted, default to Final round view
  }
 
  const activeRoundName = rounds[activeRoundIndex];
  elements.predictorRoundTitle.innerText = `${activeRoundName} Predictions`;
 
  // Render matches in active round
  let roundMatches = predictorMatches.filter(m => m.round === activeRoundName);
  if (activeRoundName === "Final") {
    // Also pull 3rd place match
    roundMatches = predictorMatches.filter(m => m.round === "Final" || m.round === "Match for third place").sort((a,b) => b.num - a.num);
  }
 
  let html = roundMatches.map(getPredictorMatchCardHTML).join('');

  // Add round selectors to sidebar or top of area
  let navigationHTML = `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 5px;">
      ${rounds.map((r, idx) => `
        <button class="sub-tab-btn ${idx === activeRoundIndex ? 'active' : ''}" onclick="switchPredictorRound(${idx})">
          ${r}
        </button>
      `).join('')}
    </div>
  `;

  elements.predictorMatchesList.innerHTML = navigationHTML + `<div class="predictor-matches-list">${html}</div>`;
}

// Global scope switcher called from onclick attribute
window.switchPredictorRound = function(idx) {
  const rounds = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"];
  const activeRoundName = rounds[idx];
  elements.predictorRoundTitle.innerText = `${activeRoundName} Predictions`;
  
  // Rerender with custom active round index forced
  const predictorMatches = activeMatches.filter(m => m.num >= 73).sort((a,b) => a.num - b.num);
  let roundMatches = predictorMatches.filter(m => m.round === activeRoundName);
  if (activeRoundName === "Final") {
    roundMatches = predictorMatches.filter(m => m.round === "Final" || m.round === "Match for third place").sort((a,b) => b.num - a.num);
  }

  let html = roundMatches.map(getPredictorMatchCardHTML).join('');

  // Rerender round navigation buttons
  let navigationHTML = `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 5px;">
      ${rounds.map((r, rIdx) => `
        <button class="sub-tab-btn ${rIdx === idx ? 'active' : ''}" onclick="switchPredictorRound(${rIdx})">
          ${r}
        </button>
      `).join('')}
    </div>
  `;

  elements.predictorMatchesList.innerHTML = navigationHTML + `<div class="predictor-matches-list">${html}</div>`;
}

// -------------------------------------------------------------
// Score Prediction Modal Management
// -------------------------------------------------------------
window.openPredictor = function(matchNum) {
  const match = activeMatches.find(m => m.num === matchNum);
  if (!match) return;

  const t1 = match.team1_resolved || match.team1;
  const t2 = match.team2_resolved || match.team2;

  // Set modal details
  elements.modalMatchNum.value = matchNum;
  elements.modalMatchTitle.innerText = `${t1} vs ${t2}`;
  elements.modalMatchRound.innerText = match.round;
  elements.modalFlag1.innerText = getFlag(t1);
  elements.modalFlag2.innerText = getFlag(t2);
  elements.modalName1.innerText = t1;
  elements.modalName2.innerText = t2;
  elements.btnPWinner1.innerText = t1;
  elements.btnPWinner2.innerText = t2;

  // Show actual score banner if the base match has a real result
  const baseMatch = baseMatches.find(m => m.num === matchNum);
  const actualScoreBanner = document.getElementById('modal-actual-score');
  if (baseMatch && baseMatch.score && baseMatch.score.ft && !baseMatch.isPrediction) {
    const info = getMatchScoreInfo(baseMatch);
    let extraStr = '';
    if (baseMatch.score.et) extraStr += ' (AET)';
    if (baseMatch.score.p) {
      const pw = baseMatch.score.p[0] > baseMatch.score.p[1] ? t1 : t2;
      extraStr += ` · ${baseMatch.score.p[0]}-${baseMatch.score.p[1]} pens (${pw} wins)`;
    }
    actualScoreBanner.innerHTML = `
      <div class="actual-score-row">
        <span class="actual-score-label">⚽ Actual</span>
        <span class="actual-score-value">${info.score1} – ${info.score2}${extraStr}</span>
      </div>`;
    actualScoreBanner.classList.remove('hidden');
  } else {
    actualScoreBanner.innerHTML = '';
    actualScoreBanner.classList.add('hidden');
  }

  // Show / hide Remove Prediction button
  const removeBtn = document.getElementById('modal-remove-pred');
  if (predictions[matchNum]) {
    removeBtn.classList.remove('hidden');
  } else {
    removeBtn.classList.add('hidden');
  }

  // Initialize input fields based on existing prediction or base match score
  const pred = predictions[matchNum];
  const score = pred ? pred : match.score;
  
  if (score && score.ft) {
    elements.modalScore1.value = score.ft[0];
    elements.modalScore2.value = score.ft[1];
  } else {
    elements.modalScore1.value = "";
    elements.modalScore2.value = "";
  }

  // Knockout details (Draw tiebreaker)
  const isKnockout = !match.group;
  if (isKnockout) {
    elements.modalKnockoutOptions.classList.remove('hidden');
    
    const etPlayed = pred ? pred.etPlayed : (match.score && match.score.et ? true : false);
    const pPlayed = pred ? pred.pPlayed : (match.score && match.score.p ? true : false);
    
    elements.modalEtPlayed.checked = etPlayed;
    elements.modalPPlayed.checked = pPlayed;
    
    if (etPlayed && score.et) {
      elements.modalEtScore1.value = score.et[0];
      elements.modalEtScore2.value = score.et[1];
      elements.modalEtScoresGroup.classList.remove('hidden');
    } else {
      elements.modalEtScore1.value = "";
      elements.modalEtScore2.value = "";
      elements.modalEtScoresGroup.classList.add('hidden');
    }
    
    if (pPlayed && score.p) {
      elements.modalPScore1.value = score.p[0];
      elements.modalPScore2.value = score.p[1];
      elements.modalPScoresGroup.classList.remove('hidden');
      
      if (score.p[0] > score.p[1]) {
        elements.btnPWinner1.classList.add('active');
        elements.btnPWinner2.classList.remove('active');
      } else {
        elements.btnPWinner2.classList.add('active');
        elements.btnPWinner1.classList.remove('active');
      }
    } else {
      elements.modalPScore1.value = "";
      elements.modalPScore2.value = "";
      elements.modalPScoresGroup.classList.add('hidden');
      elements.btnPWinner1.classList.remove('active');
      elements.btnPWinner2.classList.remove('active');
    }
  } else {
    elements.modalKnockoutOptions.classList.add('hidden');
  }

  // Auto-manage visibility based on score equality
  setupModalScoreWatcher(isKnockout);

  // Show modal
  elements.predictorModal.classList.add('active');
};

function setupModalScoreWatcher(isKnockout) {
  const checkDraw = () => {
    if (!isKnockout) return;
    
    const sc1 = parseInt(elements.modalScore1.value);
    const sc2 = parseInt(elements.modalScore2.value);
    
    if (!isNaN(sc1) && !isNaN(sc2) && sc1 === sc2) {
      // Force tiebreaker inputs visible
      elements.modalEtPlayed.checked = true;
      elements.modalEtScoresGroup.classList.remove('hidden');
      elements.modalPPlayed.checked = true;
      elements.modalPScoresGroup.classList.remove('hidden');
    }
  };

  elements.modalScore1.addEventListener('input', checkDraw);
  elements.modalScore2.addEventListener('input', checkDraw);

  elements.modalEtPlayed.addEventListener('change', (e) => {
    if (e.target.checked) {
      elements.modalEtScoresGroup.classList.remove('hidden');
    } else {
      elements.modalEtScoresGroup.classList.add('hidden');
    }
  });

  elements.modalPPlayed.addEventListener('change', (e) => {
    if (e.target.checked) {
      elements.modalPScoresGroup.classList.remove('hidden');
    } else {
      elements.modalPScoresGroup.classList.add('hidden');
      elements.btnPWinner1.classList.remove('active');
      elements.btnPWinner2.classList.remove('active');
    }
  });
}

window.removePrediction = function(matchNum) {
  delete predictions[matchNum];
  savePredictions();
  // If no predictions remain, exit predictor mode
  if (Object.keys(predictions).length === 0) {
    predictorMode = false;
    updatePredictorUIState();
  }
  elements.predictorModal.classList.remove('active');
  processAndRender();
  showNotification('Prediction Removed', `Prediction for Match ${matchNum} has been cleared.`);
};

window.openPredictorFromDetails = function(matchNum) {
  closeDetailsModal();
  openPredictor(matchNum);
};

window.closeDetailsModal = function() {
  elements.detailsModal.classList.remove('active');
};

window.openMatchDetails = function(event, matchNum) {
  // If the user clicked on a button inside the card/row, don't open details
  if (event && event.target.closest('button')) {
    return;
  }

  const m = activeMatches.find(x => x.num === matchNum);
  if (!m) return;

  const t1 = m.team1_resolved || m.team1;
  const t2 = m.team2_resolved || m.team2;
  const flag1 = getFlag(t1);
  const flag2 = getFlag(t2);
  const info = getMatchScoreInfo(m);
  const sc1 = info.score1;
  const sc2 = info.score2;

  // Build timeline
  const goals1 = m.goals1 || [];
  const goals2 = m.goals2 || [];
  
  function parseMinute(minStr) {
    if (typeof minStr === 'number') return minStr;
    if (!minStr) return 0;
    const parts = minStr.split('+');
    return parts.reduce((acc, p) => acc + parseInt(p, 10), 0);
  }

  const events = [];
  goals1.forEach(g => {
    events.push({ team: 1, name: g.name, minute: g.minute, parsedMin: parseMinute(g.minute), penalty: g.penalty, owngoal: g.owngoal });
  });
  goals2.forEach(g => {
    events.push({ team: 2, name: g.name, minute: g.minute, parsedMin: parseMinute(g.minute), penalty: g.penalty, owngoal: g.owngoal });
  });
  events.sort((a, b) => a.parsedMin - b.parsedMin);

  let timelineHTML = "";
  if (events.length > 0) {
    timelineHTML = `<div class="details-timeline">`;
    events.forEach(e => {
      const typeStr = e.penalty ? ' (PEN)' : (e.owngoal ? ' (OG)' : '');
      const icon = e.owngoal ? '❌' : '⚽';
      if (e.team === 1) {
        timelineHTML += `
          <div class="timeline-row">
            <div class="timeline-left"><strong>${e.name}</strong>${typeStr} ${icon}</div>
            <div class="timeline-center">${e.minute}'</div>
            <div class="timeline-right"></div>
          </div>
        `;
      } else {
        timelineHTML += `
          <div class="timeline-row">
            <div class="timeline-left"></div>
            <div class="timeline-center">${e.minute}'</div>
            <div class="timeline-right">${icon} <strong>${e.name}</strong>${typeStr}</div>
          </div>
        `;
      }
    });
    timelineHTML += `</div>`;
  } else {
    timelineHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">No goals recorded in this match.</div>`;
  }

  // Prediction HTML
  let predictionHTML = "";
  if (predictions[m.num]) {
    const p = predictions[m.num];
    let pExtra = "";
    if (p.etPlayed) pExtra += " AET";
    if (p.pPlayed) {
      const pWinner = p.p[0] > p.p[1] ? t1 : t2;
      pExtra += ` (${p.p[0]}-${p.p[1]} p - Winner: ${pWinner})`;
    }
    predictionHTML = `
      <hr class="details-divider">
      <div class="details-section prediction-summary-card">
        <h3 class="details-section-title" style="color: var(--accent-green)">Your Prediction</h3>
        <div class="prediction-details-compare">
          <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${flag1} ${t1} ${p.ft[0]} - ${p.ft[1]} ${flag2} ${t2}</span>
          ${pExtra ? `<span style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 600; display: block; margin-top: 4px;">${pExtra}</span>` : ''}
        </div>
      </div>
    `;
  }

  const modalHTML = `
    <div class="match-details-header">
      <span class="round-badge">${m.group || m.round}</span>
      <span class="match-num-badge">Match ${m.num}</span>
    </div>

    <div class="details-teams-score-row">
      <div class="details-team-col">
        <span class="details-team-flag">${flag1}</span>
        <span class="details-team-name">${t1}</span>
      </div>
      
      <div class="details-score-col">
        <div class="details-score-nums">
          ${m.score ? `
            <span class="details-score-val ${m.score.ft[0] < m.score.ft[1] ? 'loser-score' : ''}">${sc1}</span>
            <span class="details-score-dash">-</span>
            <span class="details-score-val ${m.score.ft[1] < m.score.ft[0] ? 'loser-score' : ''}">${sc2}</span>
          ` : `
            <span class="details-score-vs">VS</span>
          `}
        </div>
        ${info.extraInfo ? `<span class="details-score-extra">${info.extraInfo}</span>` : ''}
        ${info.penaltiesStr ? `<span class="details-score-pens">${info.penaltiesStr}</span>` : ''}
      </div>

      <div class="details-team-col">
        <span class="details-team-flag">${flag2}</span>
        <span class="details-team-name">${t2}</span>
      </div>
    </div>

    <hr class="details-divider">

    <div class="details-section">
      <h3 class="details-section-title">Match Timeline</h3>
      ${timelineHTML}
    </div>

    <hr class="details-divider">

    <div class="details-section">
      <h3 class="details-section-title">Match Information</h3>
      <div class="details-info-grid">
        <div class="info-item">
          <span class="info-label">Date</span>
          <span class="info-value">📅 ${formatDateInWords(m.date)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Time</span>
          <span class="info-value">⏰ ${m.time}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Stadium</span>
          <span class="info-value">📍 ${m.ground}</span>
        </div>
        <div class="info-item">
          <span class="info-label">City</span>
          <span class="info-value">🏙️ ${m.city || 'Host City'}</span>
        </div>
      </div>
    </div>

    ${predictionHTML}

    <div class="details-modal-footer">
      ${!isMatchOver(m) ? `
        <button class="btn btn-primary" onclick="openPredictorFromDetails(${m.num})">
          ${predictions[m.num] ? 'Edit Prediction' : 'Predict Score'}
        </button>
      ` : ''}
      <button class="btn btn-secondary" onclick="closeDetailsModal()">Close</button>
    </div>
  `;

  elements.detailsModalContent.innerHTML = modalHTML;
  elements.detailsModal.classList.add('active');
};

function setupModalActions() {
  const close = () => {
    elements.predictorModal.classList.remove('active');
  };

  const closeDetails = () => {
    elements.detailsModal.classList.remove('active');
  };

  elements.modalClose.addEventListener('click', close);
  elements.modalCancel.addEventListener('click', close);
  
  elements.detailsModalClose.addEventListener('click', closeDetails);
  elements.detailsModal.addEventListener('click', (e) => {
    if (e.target === elements.detailsModal) {
      closeDetails();
    }
  });

  elements.predictorModal.addEventListener('click', (e) => {
    if (e.target === elements.predictorModal) {
      close();
    }
  });
  
  // Penalty winner toggle buttons
  elements.btnPWinner1.addEventListener('click', () => {
    elements.btnPWinner1.classList.add('active');
    elements.btnPWinner2.classList.remove('active');
    elements.modalPScore1.value = "5";
    elements.modalPScore2.value = "4";
  });

  elements.btnPWinner2.addEventListener('click', () => {
    elements.btnPWinner2.classList.add('active');
    elements.btnPWinner1.classList.remove('active');
    elements.modalPScore1.value = "4";
    elements.modalPScore2.value = "5";
  });

  // Submit Prediction Form
  elements.predictionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const matchNum = parseInt(elements.modalMatchNum.value);
    const score1 = parseInt(elements.modalScore1.value);
    const score2 = parseInt(elements.modalScore2.value);
    
    const match = activeMatches.find(m => m.num === matchNum);
    const isKnockout = !match.group;

    const prediction = {
      ft: [score1, score2],
      etPlayed: false,
      pPlayed: false
    };

    if (isKnockout) {
      if (score1 === score2) {
        // Must resolve tiebreaker
        const etPlayed = elements.modalEtPlayed.checked;
        const pPlayed = elements.modalPPlayed.checked;
        
        if (etPlayed) {
          const et1 = parseInt(elements.modalEtScore1.value) || 0;
          const et2 = parseInt(elements.modalEtScore2.value) || 0;
          prediction.etPlayed = true;
          prediction.et = [et1, et2];
          
          if (et1 === et2) {
            // Force penalties if still draw
            prediction.pPlayed = true;
            const pWinner = elements.btnPWinner1.classList.contains('active') ? 1 : (elements.btnPWinner2.classList.contains('active') ? 2 : null);
            if (!pWinner) {
              alert("Matches in knockout rounds cannot end in a draw. Please select a penalty shootout winner.");
              return;
            }
            const p1 = parseInt(elements.modalPScore1.value) || (pWinner === 1 ? 5 : 4);
            const p2 = parseInt(elements.modalPScore2.value) || (pWinner === 2 ? 5 : 4);
            prediction.p = [p1, p2];
          }
        } else if (pPlayed) {
          prediction.pPlayed = true;
          const pWinner = elements.btnPWinner1.classList.contains('active') ? 1 : (elements.btnPWinner2.classList.contains('active') ? 2 : null);
          if (!pWinner) {
            alert("Please select a penalty shootout winner.");
            return;
          }
          const p1 = parseInt(elements.modalPScore1.value) || (pWinner === 1 ? 5 : 4);
          const p2 = parseInt(elements.modalPScore2.value) || (pWinner === 2 ? 5 : 4);
          prediction.p = [p1, p2];
        } else {
          // If equal and no tiebreaker checked, enforce it
          alert("Knockout stage games must have a winner. Please enable Extra Time or Penalties.");
          return;
        }
      } else {
        // Standard full time winner
        const etPlayed = elements.modalEtPlayed.checked;
        if (etPlayed) {
          prediction.etPlayed = true;
          prediction.et = [parseInt(elements.modalEtScore1.value) || score1, parseInt(elements.modalEtScore2.value) || score2];
        }
      }
    }

    // Save predictions state
    predictions[matchNum] = prediction;
    savePredictions();
    
    // Switch live indicator to predictor if not already
    predictorMode = true;
    updatePredictorUIState();
    
    elements.liveIndicator.innerText = "● PREDICTOR ACTIVE";
    elements.liveIndicator.style.backgroundColor = "var(--accent-green-soft)";
    elements.liveIndicator.style.color = "var(--accent-green)";
    elements.liveIndicator.style.borderColor = "var(--accent-green)";
    
    close();
    processAndRender();
    showNotification("Prediction Saved", `Match ${matchNum} prediction saved successfully!`);
  });
}

// -------------------------------------------------------------
// Live Countdown Display
// -------------------------------------------------------------
function updateCountdown() {
  // World Cup 2026 Final date: July 19, 2026 15:00 UTC-4 (MetLife Stadium)
  const finalDate = new Date("2026-07-19T15:00:00-04:00").getTime();
  const now = new Date().getTime();
  const diff = finalDate - now;

  if (diff <= 0) {
    elements.countdownTimer.innerText = "Final Finished!";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  elements.countdownTimer.innerText = `${days}d ${hours}h ${minutes}m`;
}

function showNotification(title, message) {
  const container = elements.notificationArea;
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-body">${message}</div>
  `;
  container.appendChild(notification);
  
  // Slide out and remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}
