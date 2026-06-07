const LEVELS = {
  beginner: { label: "初级", rows: 9, cols: 9, mines: 10 },
  intermediate: { label: "中级", rows: 16, cols: 16, mines: 40 },
  expert: { label: "高级", rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.getElementById("board");
const mineCounterEl = document.getElementById("mineCounter");
const timerEl = document.getElementById("timer");
const resetButton = document.getElementById("resetButton");
const statusEl = document.getElementById("status");
const menuButtons = [...document.querySelectorAll(".menu-item")];

let levelName = "beginner";
let level = LEVELS[levelName];
let cells = [];
let firstClick = true;
let gameOver = false;
let openCount = 0;
let flags = 0;
let seconds = 0;
let timerId = null;
let leftDown = false;
let rightDown = false;
let chordIndex = null;
let chordUsed = false;

function formatNumber(value) {
  const bounded = Math.max(-99, Math.min(999, value));
  const sign = bounded < 0 ? "-" : "";
  return `${sign}${String(Math.abs(bounded)).padStart(3 - sign.length, "0")}`;
}

function indexOf(row, col) {
  return row * level.cols + col;
}

function neighbors(row, col) {
  const list = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols) {
        list.push(indexOf(nr, nc));
      }
    }
  }
  return list;
}

function startTimer() {
  if (timerId) return;
  timerId = window.setInterval(() => {
    seconds = Math.min(999, seconds + 1);
    timerEl.textContent = formatNumber(seconds);
  }, 1000);
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = null;
}

function setFace(face) {
  resetButton.className = `face face-${face}`;
}

function updateMineCounter() {
  mineCounterEl.textContent = formatNumber(level.mines - flags);
}

function updateMenu() {
  menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.level === levelName);
  });
}

function resetInteractionState() {
  leftDown = false;
  rightDown = false;
  chordIndex = null;
  chordUsed = false;
  clearPeek();
  if (!gameOver) setFace("smile");
}

function syncMouseButtons(buttons) {
  leftDown = (buttons & 1) !== 0;
  rightDown = (buttons & 2) !== 0;
}

function resetGame(nextLevelName = levelName) {
  levelName = nextLevelName;
  level = LEVELS[levelName];
  cells = [];
  firstClick = true;
  gameOver = false;
  openCount = 0;
  flags = 0;
  seconds = 0;
  leftDown = false;
  rightDown = false;
  chordIndex = null;
  chordUsed = false;
  stopTimer();
  setFace("smile");
  updateMineCounter();
  timerEl.textContent = "000";
  statusEl.textContent = `${level.label}：${level.cols} x ${level.rows}，${level.mines} 个雷`;
  updateMenu();

  boardEl.style.setProperty("--cols", level.cols);
  boardEl.style.setProperty("--rows", level.rows);
  boardEl.innerHTML = "";

  for (let row = 0; row < level.rows; row += 1) {
    for (let col = 0; col < level.cols; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.setAttribute("aria-label", `第 ${row + 1} 行，第 ${col + 1} 列`);
      button.addEventListener("click", (event) => {
        if (chordUsed) {
          event.preventDefault();
          chordUsed = false;
          return;
        }
        openCell(indexOf(row, col));
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });
      button.addEventListener("mousedown", (event) => {
        handleCellMouseDown(event, indexOf(row, col));
      });
      button.addEventListener("mouseenter", (event) => {
        handleCellMouseEnter(event, indexOf(row, col));
      });
      button.addEventListener("mouseup", () => {
        if (!gameOver && !leftDown && !rightDown) setFace("smile");
      });
      cells.push({
        row,
        col,
        el: button,
        mine: false,
        count: 0,
        open: false,
        mark: "",
      });
      boardEl.appendChild(button);
    }
  }
}

function handleCellMouseDown(event, index) {
  if (gameOver) return;

  syncMouseButtons(event.buttons);

  if (leftDown && rightDown) {
    event.preventDefault();
    beginChord(index);
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    markCell(index);
    return;
  }

  if (event.button === 0) setFace("ooh");
}

function handleCellMouseEnter(event, index) {
  syncMouseButtons(event.buttons);
  if (gameOver || !leftDown || !rightDown) return;

  const cell = cells[index];
  clearPeek();

  if (!cell.open || cell.count === 0) {
    chordIndex = null;
    return;
  }

  beginChord(index);
}

function beginChord(index) {
  const cell = cells[index];
  if (!cell.open || cell.count === 0) return;

  clearPeek();
  chordIndex = index;
  chordUsed = true;
  setFace("ooh");
  neighbors(cell.row, cell.col).forEach((nextIndex) => {
    const next = cells[nextIndex];
    if (!next.open && next.mark !== "flag") {
      next.el.classList.add("peek");
    }
  });
}

function finishChord() {
  if (gameOver || chordIndex === null) return;

  const index = chordIndex;
  chordIndex = null;
  clearPeek();
  chordOpen(index);
}

function clearPeek() {
  cells.forEach((cell) => cell.el.classList.remove("peek"));
}

function placeMines(safeIndex) {
  const safeCell = cells[safeIndex];
  const safe = new Set([safeIndex, ...neighbors(safeCell.row, safeCell.col)]);
  const candidates = cells.map((_, index) => index).filter((index) => !safe.has(index));

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  candidates.slice(0, level.mines).forEach((index) => {
    cells[index].mine = true;
  });

  cells.forEach((cell) => {
    cell.count = neighbors(cell.row, cell.col).filter((index) => cells[index].mine).length;
  });
}

function renderCell(cell) {
  cell.el.className = "cell";
  cell.el.textContent = "";

  if (cell.open) {
    cell.el.classList.add("open");
    if (cell.mine) {
      cell.el.classList.add("mine");
      return;
    }
    if (cell.count > 0) {
      cell.el.textContent = cell.count;
      cell.el.classList.add(`n${cell.count}`);
    }
    return;
  }

  if (cell.mark === "flag") {
    cell.el.classList.add("flagged");
  } else if (cell.mark === "question") {
    cell.el.textContent = "?";
    cell.el.classList.add("question");
  }
}

function markCell(index) {
  if (gameOver) return;
  const cell = cells[index];
  if (cell.open) return;

  if (cell.mark === "") {
    cell.mark = "flag";
    flags += 1;
  } else if (cell.mark === "flag") {
    cell.mark = "question";
    flags -= 1;
  } else {
    cell.mark = "";
  }

  renderCell(cell);
  updateMineCounter();
}

function openCell(index) {
  if (gameOver) return;
  const cell = cells[index];
  if (cell.mark === "flag") return;

  if (firstClick) {
    placeMines(index);
    firstClick = false;
    startTimer();
  }

  if (cell.open) {
    chordOpen(index);
    return;
  }

  reveal(index);
  checkWin();
}

function reveal(startIndex) {
  const queue = [startIndex];

  while (queue.length) {
    const index = queue.shift();
    const cell = cells[index];
    if (cell.open || cell.mark === "flag") continue;

    cell.open = true;
    cell.mark = "";
    openCount += 1;
    renderCell(cell);

    if (cell.mine) {
      lose(index);
      return;
    }

    if (cell.count === 0) {
      neighbors(cell.row, cell.col).forEach((nextIndex) => {
        const next = cells[nextIndex];
        if (!next.open && next.mark !== "flag") queue.push(nextIndex);
      });
    }
  }
}

function chordOpen(index) {
  const cell = cells[index];
  if (!cell.open || cell.count === 0) return;

  const around = neighbors(cell.row, cell.col);
  const flagCount = around.filter((nextIndex) => cells[nextIndex].mark === "flag").length;
  if (flagCount !== cell.count) return;

  around.forEach((nextIndex) => {
    const next = cells[nextIndex];
    if (!next.open && next.mark !== "flag") reveal(nextIndex);
  });
  checkWin();
}

function lose(hitIndex) {
  gameOver = true;
  stopTimer();
  setFace("dead");
  statusEl.textContent = "踩到地雷了。";

  cells.forEach((cell, index) => {
    if (cell.mine) {
      cell.open = true;
      renderCell(cell);
    }
    if (cell.mark === "flag" && !cell.mine) {
      cell.el.classList.add("open");
      cell.el.classList.add("bad-flag");
    }
    if (index === hitIndex) {
      cell.el.classList.add("mine-hit");
    }
  });
}

function checkWin() {
  if (gameOver) return;
  if (openCount !== level.rows * level.cols - level.mines) return;

  gameOver = true;
  stopTimer();
  setFace("win");
  flags = level.mines;
  cells.forEach((cell) => {
    if (cell.mine && cell.mark !== "flag") {
      cell.mark = "flag";
      renderCell(cell);
    }
  });
  updateMineCounter();
  statusEl.textContent = `完成，用时 ${seconds} 秒`;
}

resetButton.addEventListener("click", () => resetGame());

menuButtons.forEach((button) => {
  button.addEventListener("click", () => resetGame(button.dataset.level));
});

document.addEventListener("mouseleave", () => {
  resetInteractionState();
});

document.addEventListener("mouseup", (event) => {
  syncMouseButtons(event.buttons);

  if (!leftDown && !rightDown) {
    finishChord();
    if (!gameOver) setFace("smile");
  }
});

window.addEventListener("blur", resetInteractionState);

resetGame();
