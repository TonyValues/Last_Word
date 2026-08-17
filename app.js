let currentGame = null;
let revealed = 1;
let mistakes = 0;
let finished = false;

const $ = id => document.getElementById(id);

const intro = $("intro");
const game = $("game");
const result = $("result");

const wordsEl = $("words");
const guessEl = $("guess");
const feedback = $("feedback");

const gameList = $("gameList");
const gameSelector = $("gameSelector");
const statsSection = $("statsSection");


function normalize(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[״"']/g, "")
    .replace(/\s+/g, " ");
}


/* =========================
   DATE
========================= */

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================
   GAME SELECTION
========================= */

// מחזיר את המשחק של היום.
// אם אין משחק היום - מחזיר את המשחק האחרון שכבר פורסם.
function getDefaultGame() {

  const today = getTodayString();

  // קודם כל מנסים למצוא משחק של היום
  const todayGame = GAMES.find(
    game => game.date === today
  );

  if (todayGame) {
    return todayGame;
  }

  // אם אין משחק היום,
  // מוצאים את המשחק האחרון שהתאריך שלו כבר עבר
  const previousGames = GAMES
    .filter(game => game.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return previousGames.length > 0
    ? previousGames[0]
    : null;
}


function getGameById(id) {
  return GAMES.find(
    game => game.id === Number(id)
  ) || null;
}


function getAvailableGames() {

  const today = getTodayString();

  return GAMES
    .filter(game => game.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
}


/* =========================
   GAME LIST
========================= */

function formatDate(dateString) {

  const [year, month, day] =
    dateString.split("-");

  return `${day}/${month}/${year}`;
}


function renderGameList() {

  gameList.innerHTML = "";

  const games = getAvailableGames();

  games.forEach(gameItem => {

    const button =
      document.createElement("button");

    button.className =
      "game-list-item";

    const isToday =
      gameItem.date === getTodayString();

    button.innerHTML = `
      <span>
        <strong>
          משחק #${String(gameItem.id).padStart(3, "0")}
        </strong>

        <small>
          ${isToday
            ? "היום"
            : formatDate(gameItem.date)}
        </small>
      </span>

      <span>
        ${isToday ? "←" : ""}
      </span>
    `;

    button.addEventListener(
      "click",
      () => {

        startGame(gameItem);

        gameSelector.classList.add("hidden");

      }
    );

    gameList.appendChild(button);
  });
}


/* =========================
   START GAME
========================= */

function startGame(selectedGame) {

  if (!selectedGame) {
    showNoGame();
    return;
  }

  currentGame = selectedGame;

  revealed = 1;
  mistakes = 0;
  finished = false;

  intro.classList.add("hidden");
  result.classList.add("hidden");
  game.classList.remove("hidden");

  if (statsSection) {
    statsSection.classList.add("hidden");
  }

  $("gameNumber").textContent =
    `משחק #${String(currentGame.id).padStart(3, "0")}`;

  $("gameDate").textContent =
    formatDate(currentGame.date);

  guessEl.value = "";

  feedback.textContent = "";
  feedback.className = "feedback";

  renderWords();
  updateStats();

  guessEl.focus();
}


/* =========================
   WORDS
========================= */

function renderWords() {

  wordsEl.innerHTML = "";

  currentGame.words.forEach(
    (word, i) => {

      const div =
        document.createElement("div");

      div.className =
        "word" +
        (
          i === currentGame.words.length - 1
            ? " target"
            : ""
        );

      if (i < revealed) {

        div.textContent = word;

      } else {

        div.textContent = "•••";

        div.classList.add(
          "hidden-word"
        );
      }

      wordsEl.appendChild(div);
    }
  );

  $("revealedCount").textContent =
    `${revealed} / ${currentGame.words.length} מילים נחשפו`;
}


/* =========================
   SCORE
========================= */

function updateStats() {

  $("mistakes").textContent =
    mistakes;

  $("score").textContent =
    Math.max(
      0,
      100 - mistakes * 15
    );
}


/* =========================
   ANSWERS
========================= */

function isCorrectAnswer(guess) {

  const normalizedGuess =
    normalize(guess);

  return currentGame.answers.some(
    answer =>
      normalize(answer) === normalizedGuess
  );
}


/* =========================
   SUBMIT GUESS
========================= */

function submitGuess() {

  if (
    finished ||
    !guessEl.value.trim()
  ) {
    return;
  }

  const guess =
    guessEl.value;

  if (isCorrectAnswer(guess)) {

    finish(true);

    return;
  }

  mistakes++;

  if (
    revealed <
    currentGame.words.length
  ) {

    revealed++;

    feedback.textContent =
      "לא הפעם — מילה נוספת נחשפה.";

    feedback.className =
      "feedback bad";

    renderWords();
    updateStats();

  } else {

    finish(false);

    return;
  }

  guessEl.select();
}


/* =========================
   FINISH
========================= */

function finish(won) {

  finished = true;

  game.classList.add("hidden");
  result.classList.remove("hidden");

  $("answer").textContent =
    currentGame.answers.join(" / ");

  $("resultIcon").className =
    "result-icon" +
    (won ? "" : " fail");

  $("resultIcon").textContent =
    won ? "✓" : "!";

  $("resultLabel").textContent =
    won ? "כל הכבוד!" : "כמעט!";

  $("resultTitle").textContent =
    won
      ? "מצאת את המילה האחרונה"
      : "נגמרו הרמזים";

  const score =
    Math.max(
      0,
      100 - mistakes * 15
    );

  $("resultText").textContent =
    won
      ? `הצלחת עם ${mistakes} ${
          mistakes === 1
            ? "טעות"
            : "טעויות"
        } וקיבלת ${score} נקודות.`
      : "כל המילים נחשפו, ועכשיו אפשר לראות את התשובה.";

  renderGameStats();
}


/* =========================
   STATISTICS
========================= */

function renderGameStats() {

  if (!statsSection) {
    return;
  }

  statsSection.classList.remove(
    "hidden"
  );

  $("playersCount").textContent =
    "—";

  $("successRate").textContent =
    "—";

  $("commonMistakes").innerHTML =
    "<li>הסטטיסטיקות יתווספו בהמשך</li>";
}


/* =========================
   NO GAME
========================= */

function showNoGame() {

  intro.classList.remove(
    "hidden"
  );

  game.classList.add(
    "hidden"
  );

  result.classList.add(
    "hidden"
  );

  $("introTitle").textContent =
    "אין עדיין משחקים";

  $("introText").textContent =
    "עדיין לא נוסף משחק למאגר המשחקים.";

  $("startBtn").disabled = true;
}


/* =========================
   GAME SELECTOR
========================= */

function toggleGameSelector() {

  gameSelector.classList.toggle(
    "hidden"
  );
}


/* =========================
   EVENTS
========================= */

$("startBtn").addEventListener(
  "click",
  () => {

    const selectedGame =
      getDefaultGame();

    startGame(selectedGame);
  }
);


$("againBtn").addEventListener(
  "click",
  () => {

    const selectedGame =
      getDefaultGame();

    startGame(selectedGame);
  }
);


$("newGameBtn").addEventListener(
  "click",
  toggleGameSelector
);


$("guessBtn").addEventListener(
  "click",
  submitGuess
);


guessEl.addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {
      submitGuess();
    }
  }
);


/* =========================
   INITIALIZE
========================= */

renderGameList();

const defaultGame =
  getDefaultGame();

if (defaultGame) {

  // מציגים את המשחק שייפתח
  $("gameNumber").textContent =
    `משחק #${String(defaultGame.id).padStart(3, "0")}`;

  $("gameDate").textContent =
    formatDate(defaultGame.date);

} else {

  showNoGame();
}