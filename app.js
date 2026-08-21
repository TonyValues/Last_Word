let currentGame = null;
let GAMES = [];
let revealed = 1;
let guesses = 0;
let finished = false;
const STATS_KEY = "the-last-word-stats";


/* =========================================
   HELPERS
========================================= */

function $(id) {
  return document.getElementById(id);
}


function normalize(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[״"']/g, "")
    .replace(/\s+/g, " ");
}


function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field.trim());
  return fields;
}


function parseGamesCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift()).map(header => header.replace(/^\uFEFF/, ""));

  return lines
    .filter(line => line.trim())
    .map(line => {
      const values = parseCsvLine(line);
      const game = Object.fromEntries(
        headers.map((header, index) => [header, values[index] || ""])
      );

      if (!game.id || !game.date || !game.words || !game.answers) {
        return null;
      }

      return {
        id: Number(game.id),
        date: game.date,
        author: game.author || "צוות המילה האחרונה",
        words: String(game.words).split("|").map(word => word.trim()).filter(Boolean),
        answers: String(game.answers).split("|").map(answer => answer.trim()).filter(Boolean),
        explanation: game.explanation
      };
    })
    .filter(Boolean);
}


function toIsoDate(dateString) {
  if (!dateString) {
    return "";
  }

  const parts = dateString.split(/[/-]/);

  if (parts.length !== 3) {
    return dateString;
  }

  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }

  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}


async function loadGames() {
  const response = await fetch("games.csv?v=3");

  if (!response.ok) {
    throw new Error(`Unable to load games.csv (${response.status})`);
  }

  GAMES = parseGamesCsv(await response.text());
}


function getStats() {
  const emptyStats = { played: 0, won: 0 };

  try {
    const savedStats = JSON.parse(localStorage.getItem(STATS_KEY));

    return savedStats
      ? { ...emptyStats, ...savedStats }
      : emptyStats;
  } catch (error) {
    return emptyStats;
  }
}


function saveStats(won) {
  const stats = getStats();

  stats.played++;

  if (won) {
    stats.won++;
  }

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    // Private browsing can disable local storage; the game still works.
  }

  renderStats();
}


function renderStats() {
  const stats = getStats();
  const playedEl = $("gamesPlayed");
  const wonEl = $("gamesWon");

  if (playedEl) playedEl.textContent = stats.played;
  if (wonEl) wonEl.textContent = stats.won;
}


/* =========================================
   DATE
========================================= */

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const parts = toIsoDate(dateString).split("-");

  if (parts.length !== 3) {
    return dateString;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


/* =========================================
   GAME DATA
========================================= */

function getAnswers(game) {

  // החדש
  if (Array.isArray(game.answers)) {
    return game.answers;
  }

  // תמיכה בקובץ הישן
  if (game.answer) {
    return [game.answer];
  }

  return [];
}


/* =========================================
   FIND TODAY'S GAME
========================================= */

function getDefaultGame() {

  if (!Array.isArray(GAMES) || GAMES.length === 0) {
    return null;
  }

  const today = getTodayString();

  console.log("Today's date:", today);
  console.log("Available games:", GAMES);


  /* -----------------------------------------
     1. Try today's game
  ----------------------------------------- */

  const todayGame = GAMES.find(
    game => game.date && toIsoDate(game.date) === today
  );

  if (todayGame) {
    console.log(
      "Today's game:",
      todayGame.id
    );

    return todayGame;
  }


  /* -----------------------------------------
     2. No game today
        Take latest previous game
  ----------------------------------------- */

  const previousGames = GAMES
    .filter(game => {
      return game.date && toIsoDate(game.date) <= today;
    })
    .sort((a, b) => {

      if (a.date && b.date) {
        return toIsoDate(b.date).localeCompare(toIsoDate(a.date));
      }

      return b.id - a.id;
    });


  if (previousGames.length > 0) {

    console.log(
      "No game today. Using latest previous game:",
      previousGames[0].id
    );

    return previousGames[0];
  }


  /* -----------------------------------------
     3. Fallback:
        Use the latest dated game that has passed.
  ----------------------------------------- */

  const fallbackGame = [...GAMES]
    .filter(game => game.date && toIsoDate(game.date) <= today)
    .sort((a, b) => toIsoDate(b.date).localeCompare(toIsoDate(a.date)))[0];

  console.log(
    "No dated games. Using latest game:",
    fallbackGame ? fallbackGame.id : "none"
  );

  return fallbackGame;
}


/* =========================================
   PREVIOUS GAMES
========================================= */

function getAvailableGames() {

  if (!Array.isArray(GAMES)) {
    return [];
  }

  const today = getTodayString();

  return [...GAMES]
    .filter(game => {
      return game.date && toIsoDate(game.date) <= today;
    })
    .sort((a, b) => {

      if (a.date && b.date) {
        return toIsoDate(b.date).localeCompare(toIsoDate(a.date));
      }

      return b.id - a.id;
    });
}


function isLatestPublishedGame(game) {
  const publishedGames = getAvailableGames();

  return publishedGames.length > 0 && publishedGames[0].id === game.id;
}


/* =========================================
   START GAME
========================================= */

function startGame(selectedGame) {

  if (!selectedGame) {
    showNoGames();
    return;
  }

  currentGame = selectedGame;

  revealed = 1;
  guesses = 0;
  finished = false;


  const intro = $("intro");
  const game = $("game");
  const result = $("result");
  const selector = $("gameSelector");


  if (intro) {
    intro.classList.add("hidden");
  }

  if (result) {
    result.classList.add("hidden");
  }

  if (selector) {
    selector.classList.add("hidden");
  }

  if (game) {
    game.classList.remove("hidden");
  }

  const quitBtn = $("quitBtn");

  if (quitBtn) {
    quitBtn.classList.toggle(
      "hidden",
      isLatestPublishedGame(currentGame)
    );
  }


  const gameNumber = $("gameNumber");

  if (gameNumber) {
    gameNumber.textContent =
      `משחק #${String(currentGame.id).padStart(3, "0")}`;
  }


  const gameDate = $("gameDate");

  if (gameDate) {
    gameDate.textContent =
      currentGame.date
        ? formatDate(currentGame.date)
        : "";
  }

  const gameAuthor = $("gameAuthor");

  if (gameAuthor) {
    gameAuthor.textContent = currentGame.author
      ? `מאת ${currentGame.author}`
      : "";
  }


  const guess = $("guess");

  if (guess) {
    guess.value = "";
  }


  const feedback = $("feedback");

  if (feedback) {
    feedback.textContent = "";
    feedback.className = "feedback";
  }


  renderWords();
  updateStats();


  if (guess) {
    guess.focus();
  }
}


/* =========================================
   WORDS
========================================= */

function renderWords() {

  const wordsEl = $("words");

  if (!wordsEl || !currentGame) {
    return;
  }

  wordsEl.innerHTML = "";


  currentGame.words.forEach((word, index) => {

    const div = document.createElement("div");

    div.className = "word";

    if (
      index ===
      currentGame.words.length - 1
    ) {
      div.classList.add("target");
    }


    if (index < revealed) {

      div.textContent = word;

    } else {

      div.textContent = "•••";
      div.classList.add("hidden-word");
    }


    wordsEl.appendChild(div);
  });


  const revealedCount =
    $("revealedCount");

  if (revealedCount) {

    revealedCount.textContent =
      `${revealed} / ${currentGame.words.length} מילים נחשפו`;
  }
}


/* =========================================
   LIVE STATS
========================================= */

function updateStats() {

  const guessesEl = $("guesses");

  if (guessesEl) {
    guessesEl.textContent = guesses;
  }
}


/* =========================================
   CHECK ANSWER
========================================= */

function isCorrectAnswer(guess) {

  if (!currentGame) {
    return false;
  }

  const answers =
    getAnswers(currentGame);

  const normalizedGuess =
    normalize(guess);


  return answers.some(answer => {

    return normalize(answer) ===
      normalizedGuess;

  });
}


/* =========================================
   SUBMIT
========================================= */

function submitGuess() {

  if (
    finished ||
    !currentGame
  ) {
    return;
  }


  const guessEl = $("guess");

  if (
    !guessEl ||
    !guessEl.value.trim()
  ) {
    return;
  }


  const guess =
    guessEl.value.trim();

  guesses++;


  /* -----------------------------------------
     CORRECT
  ----------------------------------------- */

  if (isCorrectAnswer(guess)) {

    revealed = currentGame.words.length;
    renderWords();
    updateStats();

    finish(true);

    return;
  }


  /* -----------------------------------------
     WRONG
  ----------------------------------------- */

  if (revealed < currentGame.words.length) {

    revealed++;


    const feedback =
      $("feedback");

    if (feedback) {

      feedback.textContent =
        "לא הפעם — מילה נוספת נחשפה.";

      feedback.className =
        "feedback bad";
    }


    renderWords();
    updateStats();

    guessEl.select();

  } else {
    const feedback = $("feedback");

    if (feedback) {
      feedback.textContent = isLatestPublishedGame(currentGame)
        ? "כל הרמזים נחשפו — אפשר להמשיך לנחש."
        : "כל הרמזים נחשפו — אפשר להמשיך לנחש או לוותר.";
      feedback.className = "feedback bad";
    }

    updateStats();
    guessEl.select();
  }
}


/* =========================================
   FINISH
========================================= */

function finish(won, quit = false) {

  finished = true;

  if (quit && currentGame) {
    revealed = currentGame.words.length;
    renderWords();
    updateStats();
  }


  const game = $("game");
  const result = $("result");


  if (game && !won && !quit) {
    game.classList.add("hidden");
  }

  if (result) {
    result.classList.remove("hidden");
  }


  const answerEl =
    $("answer");

  if (answerEl) {
    const shouldRevealAnswer = won || (quit && !isLatestPublishedGame(currentGame));
    answerEl.textContent = shouldRevealAnswer
      ? getAnswers(currentGame)[0] || ""
      : "התשובה תיחשף במשחק הבא";

    const explanationEl = $("answerExplanation");

    if (explanationEl) {
      explanationEl.textContent = shouldRevealAnswer
        ? currentGame.explanation || ""
        : "";
      explanationEl.classList.toggle("hidden", !shouldRevealAnswer || !currentGame.explanation);
    }
  }


  const resultIcon =
    $("resultIcon");

  if (resultIcon) {

    resultIcon.className =
      "result-icon" +
      (won ? "" : " fail");

    resultIcon.textContent =
      won ? "✓" : "!";
  }


  const resultLabel =
    $("resultLabel");

  if (resultLabel) {

    resultLabel.textContent =
      won ? "כל הכבוד!" : "כמעט!";
  }


  const resultTitle =
    $("resultTitle");

  if (resultTitle) {

    resultTitle.textContent =
      won
        ? "מצאת את המילה האחרונה"
        : "המשחק הסתיים";
  }


  saveStats(won);


  const resultText =
    $("resultText");

  if (resultText) {

    resultText.textContent =
      won
        ? `הצלחת עם ${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}.`
        : isLatestPublishedGame(currentGame)
          ? "התשובה תישמר בסוד עד לפרסום המשחק הבא."
          : "אפשר לראות את התשובה למשחק הזה למטה.";
  }
}


function shareResult() {
  if (!currentGame) return;

  const shareText = `המילה האחרונה #${String(currentGame.id).padStart(3, "0")} | ${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}`;
  const shareButton = $("shareBtn");

  if (navigator.share) {
    navigator.share({ title: "המילה האחרונה", text: shareText }).catch(() => {});
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      if (shareButton) shareButton.textContent = "התוצאה הועתקה";
    }).catch(() => {});
  }
}


/* =========================================
   GAME LIST
========================================= */

function renderGameList() {

  const gameList =
    $("gameList");

  if (!gameList) {
    return;
  }


  gameList.innerHTML = "";


  const games =
    getAvailableGames();


  games.forEach(gameItem => {

    const button =
      document.createElement("button");

    button.className =
      "game-list-item";


    const isToday =
      gameItem.date ===
      getTodayString();


    const dateText =
      gameItem.date
        ? formatDate(gameItem.date)
        : "";


    button.innerHTML = `
      <span>
        <strong>
          משחק #${String(gameItem.id).padStart(3, "0")}
        </strong>

        <small>
          ${isToday ? "היום" : dateText}
        </small>
      </span>

      <span>
        ${isToday ? "←" : ""}
      </span>
    `;


    button.addEventListener(
      "click",
      () => startGame(gameItem)
    );


    gameList.appendChild(button);
  });
}


/* =========================================
   GAME SELECTOR
========================================= */

function toggleGameSelector() {

  const selector =
    $("gameSelector");

  if (!selector) {
    return;
  }

  selector.classList.toggle("hidden");
}


/* =========================================
   NO GAMES
========================================= */

function showNoGames() {

  const intro = $("intro");
  const game = $("game");
  const result = $("result");


  if (intro) {
    intro.classList.remove("hidden");
  }

  if (game) {
    game.classList.add("hidden");
  }

  if (result) {
    result.classList.add("hidden");
  }


  const title =
    $("introTitle");

  const text =
    $("introText");


  if (title) {
    title.textContent =
      "אין עדיין משחקים";
  }


  if (text) {
    text.textContent =
      "עדיין לא נוסף משחק למאגר המשחקים.";
  }
}


/* =========================================
   INITIALIZATION
========================================= */

function initialize() {

  console.log(
    "================================="
  );

  console.log(
    "THE LAST WORD - STARTING"
  );

  console.log(
    "Today:",
    getTodayString()
  );

  console.log(
    "Games:",
    GAMES
  );


  const defaultGame =
    getDefaultGame();


  console.log(
    "Selected game:",
    defaultGame
  );


  renderGameList();
  renderStats();


  /* -----------------------------------------
     BUTTONS
  ----------------------------------------- */

  const startBtn =
    $("startBtn");

  if (startBtn) {

    startBtn.addEventListener(
      "click",
      () => {

        const selected =
          getDefaultGame();

        startGame(selected);
      }
    );
  }


  const againBtn =
    $("againBtn");

  if (againBtn) {

    againBtn.addEventListener(
      "click",
      () => {

        const selected =
          getDefaultGame();

        startGame(selected);
      }
    );
  }


  const newGameBtn =
    $("newGameBtn");

  if (newGameBtn) {

    newGameBtn.addEventListener(
      "click",
      toggleGameSelector
    );
  }


  const guessBtn =
    $("guessBtn");

  if (guessBtn) {

    guessBtn.addEventListener(
      "click",
      submitGuess
    );
  }


  const guess =
    $("guess");

  const shareBtn = $("shareBtn");

  if (shareBtn) {
    shareBtn.addEventListener("click", shareResult);
  }

  const quitBtn = $("quitBtn");

  if (quitBtn) {
    quitBtn.addEventListener("click", () => finish(false, true));
  }

  if (guess) {

    guess.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          submitGuess();
        }

      }
    );
  }


  /* -----------------------------------------
     SHOW DEFAULT GAME INFORMATION
  ----------------------------------------- */

  if (defaultGame) {

    const gameNumber =
      $("gameNumber");

    if (gameNumber) {

      gameNumber.textContent =
        `משחק #${String(defaultGame.id).padStart(3, "0")}`;
    }


    const gameDate =
      $("gameDate");

    if (gameDate) {

      gameDate.textContent =
        defaultGame.date
          ? formatDate(defaultGame.date)
          : "";
    }

  } else {

    showNoGames();
  }


  console.log(
    "Initialization complete."
  );
}


/* =========================================
   RUN
========================================= */

async function startApplication() {
  try {
    await loadGames();
    initialize();
  } catch (error) {
    console.error(error);
    showNoGames();
  }
}


if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    startApplication
  );

} else {

  startApplication();
}