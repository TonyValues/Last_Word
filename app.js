let currentGame = null;
let revealed = 1;
let mistakes = 0;
let finished = false;


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

  const parts = dateString.split("-");

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
    game => game.date === today
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
      return game.date && game.date <= today;
    })
    .sort((a, b) => {

      if (a.date && b.date) {
        return b.date.localeCompare(a.date);
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
        If dates are missing completely,
        use the highest ID.
  ----------------------------------------- */

  const fallbackGame = [...GAMES]
    .sort((a, b) => b.id - a.id)[0];

  console.log(
    "No dated games. Using latest game:",
    fallbackGame.id
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

      // משחקים ללא תאריך עדיין יוצגו
      if (!game.date) {
        return true;
      }

      return game.date <= today;
    })
    .sort((a, b) => {

      if (a.date && b.date) {
        return b.date.localeCompare(a.date);
      }

      return b.id - a.id;
    });
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
  mistakes = 0;
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

  const mistakesEl = $("mistakes");
  const scoreEl = $("score");


  if (mistakesEl) {
    mistakesEl.textContent = mistakes;
  }


  if (scoreEl) {

    scoreEl.textContent =
      Math.max(
        0,
        100 - mistakes * 15
      );
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


  /* -----------------------------------------
     CORRECT
  ----------------------------------------- */

  if (isCorrectAnswer(guess)) {

    finish(true);

    return;
  }


  /* -----------------------------------------
     WRONG
  ----------------------------------------- */

  mistakes++;


  if (
    revealed <
    currentGame.words.length
  ) {

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

    finish(false);
  }
}


/* =========================================
   FINISH
========================================= */

function finish(won) {

  finished = true;


  const game = $("game");
  const result = $("result");


  if (game) {
    game.classList.add("hidden");
  }

  if (result) {
    result.classList.remove("hidden");
  }


  const answers =
    getAnswers(currentGame);


  const answerEl =
    $("answer");

  if (answerEl) {

    answerEl.textContent =
      answers.join(" / ");
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
        : "נגמרו הרמזים";
  }


  const score =
    Math.max(
      0,
      100 - mistakes * 15
    );


  const resultText =
    $("resultText");

  if (resultText) {

    resultText.textContent =
      won
        ? `הצלחת עם ${mistakes} ${
            mistakes === 1
              ? "טעות"
              : "טעויות"
          } וקיבלת ${score} נקודות.`
        : "כל המילים נחשפו, ועכשיו אפשר לראות את התשובה.";
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

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

} else {

  initialize();
}