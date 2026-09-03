let currentGame = null;
let GAMES = [];
let revealed = 1;
let guesses = 0;
let finished = false;
let wonGame = false;
let clueOpen = false;
const GAME_STATE_KEY = "the-last-word-current-game";
const UPDATES_KEY = "the-last-word-updates-hidden";


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

      const words = String(game.words).split("|").map(word => word.trim()).filter(Boolean);
      const answers = String(game.answers).split("|").map(answer => answer.trim()).filter(Boolean);

      if (words.length === 0 || answers.length === 0) {
        return null;
      }

      return {
        id: Number(game.id),
        date: game.date,
        author: game.author || "צוות המילה האחרונה",
        words,
        answers,
        explanation: game.explanation,
        direction: game.direction || game.clueDirection || game.arrow || game.hintDirection || game.hint || "",
        arrow: game.arrow || game.hintDirection || game.direction || game.clueDirection || game.hint || ""
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


function getSavedGameState(game) {
  if (!game || !isLatestPublishedGame(game)) {
    return null;
  }

  try {
    const savedState = JSON.parse(localStorage.getItem(GAME_STATE_KEY));

    return savedState && savedState.id === game.id
      ? savedState
      : null;
  } catch (error) {
    return null;
  }
}


function saveGameState() {
  if (!currentGame || !isLatestPublishedGame(currentGame)) {
    return;
  }

  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      id: currentGame.id,
      revealed,
      guesses,
      finished,
      wonGame
    }));
  } catch (error) {
    // The game still works when storage is unavailable.
  }
}


function getDirectionInfo(game) {
  if (!game) {
    return { key: "none", symbol: "↔", label: "ללא כיוון", color: "#7a8794" };
  }

  const rawValue = String(
    game.direction ??
    game.clueDirection ??
    game.arrow ??
    game.hintDirection ??
    game.hint ??
    ""
  ).trim();

  const normalized = normalize(rawValue);

  if (!rawValue) {
    return { key: "none", symbol: "↔", label: "ללא כיוון", color: "#7a8794" };
  }

  if (["straight", "ישר", "forward", "forwards", "direct", "down", "downward", "vertical"].includes(normalized)) {
    return { key: "straight", symbol: "↓", label: "ישר", color: "#1f9d5a" };
  }

  if (["reversed", "reverse", "הפוך", "backward", "backwards", "up", "upward"].includes(normalized)) {
    return { key: "reversed", symbol: "↑", label: "הפוך", color: "#e8681b" };
  }

  if (["none", "no direction", "לא ידוע", "ללא כיוון", "nodirection", "equal", "equals", "same", "flat"].includes(normalized)) {
    return { key: "none", symbol: "↔", label: "ללא כיוון", color: "#7a8794" };
  }

  if (normalized.includes("down") || normalized.includes("straight")) {
    return { key: "straight", symbol: "↓", label: "ישר", color: "#1f9d5a" };
  }

  if (normalized.includes("reverse") || normalized.includes("reversed") || normalized.includes("up")) {
    return { key: "reversed", symbol: "↑", label: "הפוך", color: "#e8681b" };
  }

  if (normalized.includes("equal") || normalized.includes("none") || normalized.includes("no")) {
    return { key: "none", symbol: "↔", label: "ללא כיוון", color: "#7a8794" };
  }

  return { key: "none", symbol: "↔", label: "ללא כיוון", color: "#7a8794" };
}


function renderClueButton() {
  const clueToggle = $("clueToggle");
  const clueValue = $("clueValue");

  if (!clueToggle || !clueValue || !currentGame) {
    return;
  }

  const directionInfo = getDirectionInfo(currentGame);

  clueToggle.classList.toggle("is-open", clueOpen);
  clueToggle.style.background = clueOpen ? directionInfo.color : "#e2f1f0";
  clueToggle.style.borderColor = clueOpen ? directionInfo.color : "#0d5960";
  clueToggle.style.color = clueOpen ? "#ffffff" : "#0d5960";
  clueValue.textContent = clueOpen ? directionInfo.symbol : "?";
  clueToggle.setAttribute(
    "aria-label",
    clueOpen
      ? `כיוון הרמז: ${directionInfo.label}`
      : "הצג כיוון רמז"
  );
}


function toggleClue() {
  if (!currentGame) {
    return;
  }

  clueOpen = !clueOpen;
  renderClueButton();
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

  /* -----------------------------------------
     1. Try today's game
  ----------------------------------------- */

  const todayGame = GAMES.find(
    game => game.date && toIsoDate(game.date) === today
  );

  if (todayGame) {
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

    return previousGames[0];
  }


  /* -----------------------------------------
     3. Fallback:
        Use the latest dated game that has passed.
  ----------------------------------------- */

  const fallbackGame = [...GAMES]
    .filter(game => game.date && toIsoDate(game.date) <= today)
    .sort((a, b) => toIsoDate(b.date).localeCompare(toIsoDate(a.date)))[0];

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

  const savedState = getSavedGameState(selectedGame);
  revealed = savedState?.revealed || 1;
  guesses = savedState?.guesses || 0;
  finished = savedState?.finished || false;
  wonGame = savedState?.wonGame || false;
  clueOpen = false;


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
  updateGuessCount();
  renderClueButton();

  if (finished) {
    finish(wonGame, !wonGame);
    return;
  }

  saveGameState();


  if (game) {
    window.setTimeout(() => {
      game.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
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

    if (index < revealed) {

      div.textContent = word;
      if (index === revealed - 1) {
        div.classList.add("word-revealed");
      }

    } else {

      div.textContent = "•••";
      div.classList.add("hidden-word");
    }


    wordsEl.appendChild(div);
  });

  const answerDiv = document.createElement("div");
  answerDiv.className = "word target-answer";
  const revealAnswer = wonGame || (finished && !isLatestPublishedGame(currentGame));
  answerDiv.textContent = revealAnswer ? getAnswers(currentGame)[0] || "" : "???";
  if (revealAnswer && finished) {
    answerDiv.classList.add("word-revealed");
  }
  if (!revealAnswer) {
    answerDiv.classList.add("hidden-word");
  }
  wordsEl.appendChild(answerDiv);


  const revealedCount =
    $("revealedCount");

  if (revealedCount) {

    const totalItems = currentGame.words.length + 1;
    const revealedItems = finished
      ? totalItems
      : revealed;

    revealedCount.textContent =
      `${revealedItems} / ${totalItems} מילים נחשפו`;
  }
}


/* =========================================
   LIVE STATS
========================================= */

function updateGuessCount() {

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
  saveGameState();


  /* -----------------------------------------
     CORRECT
  ----------------------------------------- */

  if (isCorrectAnswer(guess)) {

    revealed = currentGame.words.length;
    renderWords();
    updateGuessCount();

    finish(true);

    return;
  }


  /* -----------------------------------------
     WRONG
  ----------------------------------------- */

  if (revealed < currentGame.words.length) {

    revealed++;
    saveGameState();


    const feedback =
      $("feedback");

    if (feedback) {

      feedback.textContent =
        "לא הפעם — מילה נוספת נחשפה.";

      feedback.className =
        "feedback bad";
    }


    renderWords();
    updateGuessCount();

    if (window.innerWidth <= 760) {
      window.setTimeout(() => {
        const game = $("game");

        if (!game) {
          return;
        }

        game.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 0);
    }

    guessEl.select();

  } else {
    const feedback = $("feedback");

    if (feedback) {
      feedback.textContent = isLatestPublishedGame(currentGame)
        ? "כל הרמזים נחשפו — אפשר להמשיך לנחש."
        : "כל הרמזים נחשפו — אפשר להמשיך לנחש או לוותר.";
      feedback.className = "feedback bad";
    }

    updateGuessCount();

    if (window.innerWidth <= 760 && feedback) {
      window.setTimeout(() => {
        feedback.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 0);
    }

    guessEl.select();
  }
}


/* =========================================
   FINISH
========================================= */

function finish(won, quit = false) {

  finished = true;
  wonGame = won;
  saveGameState();

  if (won && currentGame) {
    revealed = currentGame.words.length;
    renderWords();
    updateGuessCount();
  }

  if (quit && currentGame) {
    revealed = currentGame.words.length;
    renderWords();
    updateGuessCount();
  }


  const game = $("game");
  const result = $("result");


  if (game && !won) {
    game.classList.add("hidden");
  }

  if (result) {
    result.classList.remove("hidden");

    const againBtn = $("againBtn");
    if (againBtn) {
      againBtn.classList.toggle("hidden", isLatestPublishedGame(currentGame));
    }

    const resultTitle = $("resultTitle");
    if (resultTitle) {
      resultTitle.focus();
    }

    if (won || quit) {
      window.setTimeout(() => {
        window.scrollTo({
          top: Math.max(0, result.offsetTop - 12),
          behavior: "smooth",
        });
      }, 0);
    }
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


  const resultText =
    $("resultText");

  if (resultText) {

    resultText.textContent =
      won
        ? `הצלחת עם ${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}.`
        : isLatestPublishedGame(currentGame)
          ? "התשובה תישמר בסוד עד לפרסום המשחק הבא."
          : "התשובה למשחק הזה היא";
  }
}


async function shareResult() {
  if (!currentGame) return;

  const shareButton = $("shareBtn");
  const shareText = wonGame
    ? `ניחשתי את המילה האחרונה ב-${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}! 🎯🔥 תנסו לנצח אותי 😎`
    : "ויתרתי על המשחק של המילה האחרונה. תצליחו לפתור אותו? 🤔";
  const resultTitle = wonGame ? "הצלחתי!" : "ויתרתי...";
  const resultText = wonGame
    ? `ניחשתי את המילה האחרונה ב-${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}!`
    : "ויתרתי, תצליחו לפתור אותו?";

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    fallbackTextShare(shareText, shareButton);
    return;
  }

  ctx.fillStyle = "#eef2f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#dfeef0");
  gradient.addColorStop(1, "#f7fafc");
  ctx.fillStyle = gradient;
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.fillStyle = "#0d5960";
  ctx.font = "700 52px 'Segoe UI', Arial";
  ctx.textAlign = "center";
  ctx.fillText("המילה האחרונה", canvas.width / 2, 160);

  ctx.fillStyle = "#17212b";
  ctx.font = "700 72px 'Segoe UI', Arial";
  ctx.fillText(resultTitle, canvas.width / 2, 260);

  ctx.fillStyle = "#65717b";
  ctx.font = "500 32px 'Segoe UI', Arial";
  ctx.fillText(resultText, canvas.width / 2, 330);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#dce3e8";
  ctx.lineWidth = 2;
  const cardX = 120;
  const cardY = 430;
  const cardW = canvas.width - 240;
  const cardH = 420;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = "#0d5960";
  ctx.font = "700 34px 'Segoe UI', Arial";
  ctx.fillText(`משחק #${String(currentGame.id).padStart(3, "0")}`, canvas.width / 2, 510);

  ctx.fillStyle = "#17212b";
  ctx.font = "700 32px 'Segoe UI', Arial";
  ctx.fillText("הרמזים", canvas.width / 2, 565);

  const visibleWords = currentGame.words.map((word, index) =>
    index < revealed ? word : "•••"
  );
  ctx.font = "700 28px 'Segoe UI', Arial";
  visibleWords.forEach((word, index) => {
    ctx.fillText(word, canvas.width / 2, 610 + index * 42);
  });

  const shareAnswer = wonGame || !isLatestPublishedGame(currentGame)
    ? getAnswers(currentGame)[0] || ""
    : "???";
  ctx.fillStyle = "#9a6b00";
  ctx.font = "700 32px 'Segoe UI', Arial";
  ctx.fillText(shareAnswer, canvas.width / 2, 820);

  ctx.fillStyle = "#0d5960";
  ctx.font = "700 28px 'Segoe UI', Arial";
  ctx.fillText(wonGame ? "ניצחון" : "ויתור", canvas.width / 2, 1030);

  ctx.fillStyle = "#17212b";
  ctx.font = "700 30px 'Segoe UI', Arial";
  ctx.fillText(`${guesses} ${guesses === 1 ? "ניחוש" : "ניחושים"}`, canvas.width / 2, 1085);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

  if (!blob) {
    fallbackTextShare(shareText, shareButton);
    return;
  }

  const file = new File([blob], "last-word-result.png", { type: "image/png" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "המילה האחרונה",
        text: shareText,
        files: [file]
      });
      return;
    } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
    }
  }

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "last-word-result.png";
  downloadLink.click();

  const whatsappText = encodeURIComponent(`${shareText}\n${window.location.href}`);
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");

  if (shareButton) {
    shareButton.textContent = "התוצאה נשלחה";
    window.setTimeout(() => {
      shareButton.textContent = "שתף תוצאה";
    }, 1800);
  }
}

function fallbackTextShare(shareText, shareButton) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      if (shareButton) shareButton.textContent = "התוצאה הועתקה";
      window.setTimeout(() => {
        if (shareButton) shareButton.textContent = "שתף תוצאה";
      }, 1800);
    }).catch(() => {
      openWhatsAppShare(shareText, shareButton);
    });
    return;
  }

  openWhatsAppShare(shareText, shareButton);
}

function openWhatsAppShare(shareText, shareButton) {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");

  if (shareButton) {
    shareButton.textContent = "פתח WhatsApp";
    window.setTimeout(() => {
      if (shareButton) shareButton.textContent = "שתף תוצאה";
    }, 1800);
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


    const isToday = toIsoDate(gameItem.date) === getTodayString();


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


function showLoadError() {
  const intro = $("intro");
  const game = $("game");
  const result = $("result");
  const title = $("introTitle");
  const text = $("introText");
  const startBtn = $("startBtn");
  const retryBtn = $("retryBtn");

  if (intro) intro.classList.remove("hidden");
  if (game) game.classList.add("hidden");
  if (result) result.classList.add("hidden");
  if (title) title.textContent = "לא הצלחנו לטעון את המשחק";
  if (text) text.textContent = "בדקו את החיבור ונסו שוב.";
  if (startBtn) startBtn.classList.add("hidden");
  if (retryBtn) {
    retryBtn.classList.remove("hidden");
    retryBtn.onclick = startApplication;
  }
}


/* =========================================
   INITIALIZATION
========================================= */

function initialize() {
  const defaultGame =
    getDefaultGame();


  renderGameList();
  renderClueButton();


  /* -----------------------------------------
     BUTTONS
  ----------------------------------------- */

  const startBtn =
    $("startBtn");

  const retryBtn = $("retryBtn");
  if (retryBtn) {
    retryBtn.classList.add("hidden");
    retryBtn.onclick = startApplication;
  }
  if (startBtn) startBtn.classList.remove("hidden");

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


  const instructionsDialog = $("instructionsDialog");
  const instructionsBtn = $("instructionsBtn");
  const closeInstructionsBtn = $("closeInstructionsBtn");
  const instructionsDoneBtn = $("instructionsDoneBtn");

  if (instructionsDialog && instructionsBtn) {
    instructionsBtn.addEventListener("click", () => instructionsDialog.showModal());

    [closeInstructionsBtn, instructionsDoneBtn].forEach(button => {
      if (button) {
        button.addEventListener("click", () => instructionsDialog.close());
      }
    });

    instructionsDialog.addEventListener("click", event => {
      if (event.target === instructionsDialog) {
        instructionsDialog.close();
      }
    });
  }


  const updatesDialog = $("updatesDialog");
  const closeUpdatesBtn = $("closeUpdatesBtn");
  const updatesDoneBtn = $("updatesDoneBtn");

  function dismissUpdatesDialog() {
    if (updatesDialog) {
      updatesDialog.close();
    }

    try {
      sessionStorage.setItem(UPDATES_KEY, "1");
    } catch (error) {
      // Private browsing can disable session storage; the popup may reappear, but the app still works.
    }
  }

  if (updatesDialog) {
    try {
      const hidden = sessionStorage.getItem(UPDATES_KEY) === "1";
      if (!hidden) {
        updatesDialog.showModal();
      }
    } catch (error) {
      updatesDialog.showModal();
    }

    [closeUpdatesBtn, updatesDoneBtn].forEach(button => {
      if (button) {
        button.addEventListener("click", dismissUpdatesDialog);
      }
    });

    updatesDialog.addEventListener("click", event => {
      if (event.target === updatesDialog) {
        dismissUpdatesDialog();
      }
    });
  }


  const clueToggle = $("clueToggle");

  if (clueToggle) {
    clueToggle.addEventListener("click", toggleClue);
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

  const suggestionForm = $("suggestionForm");
  const suggestionNotice = $("suggestionNotice");

  if (suggestionForm && suggestionNotice) {
    suggestionForm.addEventListener("submit", () => {
      suggestionNotice.textContent = "ההצעה נשלחה, תודה!";
      suggestionNotice.classList.add("visible");
      window.setTimeout(() => suggestionNotice.classList.remove("visible"), 5000);
    });
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
    showLoadError();
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