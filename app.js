let currentGame;
let revealed = 1;
let mistakes = 0;
let finished = false;

const $ = id => document.getElementById(id);
const intro = $("intro"), game = $("game"), result = $("result");
const wordsEl = $("words"), guessEl = $("guess"), feedback = $("feedback");

function normalize(s){
  return s.trim().toLowerCase().replace(/[״"']/g,"").replace(/\s+/g," ");
}
function chooseGame(){
  return GAMES[Math.floor(Math.random()*GAMES.length)];
}
function startGame(){
  currentGame = chooseGame();
  revealed = 1; mistakes = 0; finished = false;
  intro.classList.add("hidden"); result.classList.add("hidden"); game.classList.remove("hidden");
  $("gameNumber").textContent = `משחק #${String(currentGame.id).padStart(3,"0")}`;
  guessEl.value = ""; feedback.textContent = ""; feedback.className = "feedback";
  renderWords(); updateStats(); guessEl.focus();
}
function renderWords(){
  wordsEl.innerHTML = "";
  currentGame.words.forEach((word,i)=>{
    const div = document.createElement("div");
    div.className = "word" + (i===currentGame.words.length-1 ? " target" : "");
    if(i < revealed) div.textContent = word;
    else { div.textContent = "•••"; div.classList.add("hidden-word"); }
    wordsEl.appendChild(div);
  });
  $("revealedCount").textContent = `${revealed} / ${currentGame.words.length} מילים נחשפו`;
}
function updateStats(){
  $("mistakes").textContent = mistakes;
  $("score").textContent = Math.max(0, 100 - mistakes * 15);
}
function submitGuess(){
  if(finished || !guessEl.value.trim()) return;
  if(normalize(guessEl.value) === normalize(currentGame.answer)){
    finish(true); return;
  }
  mistakes++;
  if(revealed < currentGame.words.length){
    revealed++;
    feedback.textContent = "לא הפעם — מילה נוספת נחשפה.";
    feedback.className = "feedback bad";
    renderWords(); updateStats();
  } else {
    finish(false); return;
  }
  guessEl.select();
}
function finish(won){
  finished = true;
  game.classList.add("hidden"); result.classList.remove("hidden");
  $("answer").textContent = currentGame.answer;
  $("resultIcon").className = "result-icon" + (won ? "" : " fail");
  $("resultIcon").textContent = won ? "✓" : "!";
  $("resultLabel").textContent = won ? "כל הכבוד!" : "כמעט!";
  $("resultTitle").textContent = won ? "מצאת את המילה האחרונה" : "נגמרו הרמזים";
  $("resultText").textContent = won
    ? `הצלחת עם ${mistakes} ${mistakes===1?"טעות":"טעויות"} וקיבלת ${Math.max(0,100-mistakes*15)} נקודות.`
    : "כל המילים נחשפו, ועכשיו אפשר לראות את התשובה.";
}
$("startBtn").addEventListener("click", startGame);
$("againBtn").addEventListener("click", startGame);
$("newGameBtn").addEventListener("click", startGame);
$("guessBtn").addEventListener("click", submitGuess);
guessEl.addEventListener("keydown", e => { if(e.key === "Enter") submitGuess(); });
