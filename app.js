// 小狐熊聖誕大尋寶 - 遊戲邏輯

// 設定 marked.js 讓所有連結都在新分頁開啟
marked.use({
    renderer: {
        link(href, title, text) {
            const titleAttr = title ? ` title="${title}"` : '';
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
    }
});

let gameData = null;
let articlesData = null;
let selectedArticles = [];
let manualSelectedIds = []; // 手動選擇的文章 ID
let currentArticleIndex = 0;
let currentQuestionIndex = 0;
let totalCorrect = 0;

// 第一關：座標尋寶
let currentTreasureIndex = 0;
let freezeTimer = null;
let gameMode = ''; // 'random' 或 'manual'

// ========== 遊玩紀錄 ==========
const STORAGE_KEY = 'christmasQuizRecords';

function loadRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveRecord(record) {
    const records = loadRecords();
    records.unshift(record); // 新紀錄放最前面
    // 只保留最近 20 筆
    if (records.length > 20) records.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function displayRecords() {
    const records = loadRecords();
    const container = document.getElementById('records-list');

    if (records.length === 0) {
        container.innerHTML = '<p class="no-records">還沒有遊玩紀錄</p>';
        return;
    }

    let html = '<table class="records-table"><thead><tr><th>時間</th><th>模式</th><th>結果</th><th>答對</th></tr></thead><tbody>';

    records.forEach(r => {
        const modeText = r.mode === 'random' ? '隨機3篇' : '手動7篇';
        const resultText = r.success ? '✅ 過關' : '❌ 失敗';
        const resultClass = r.success ? 'success' : 'fail';
        html += `<tr class="${resultClass}">
            <td>${formatDate(r.date)}</td>
            <td>${modeText}</td>
            <td>${resultText}</td>
            <td>${r.correct}/${r.total}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// 寶藏路徑：5 個座標點及其線索（第一象限 0-19）
const treasurePath = [
    { x: 0, y: 0, clue: "🎄 第一個寶藏：x = (8 + 4) ÷ 6 - 2，y = 5 × (7 - 7)" },
    { x: 5, y: 3, clue: "🎁 下一個寶藏：x = (18 - 6) ÷ 4 + 2，y = (4 + 8) ÷ 2 - 3" },
    { x: 12, y: 8, clue: "⭐ 繼續前進！x = 3 × (10 - 6) ，y = (7 + 5) × 2 ÷ 3" },
    { x: 7, y: 15, clue: "🔔 快到了！x = (25 - 4) ÷ 3，y = (6 + 9) ÷ 3 × 3" },
    { x: 18, y: 18, clue: "🎅 最後一個！x = (15 - 9) × 4 - 6，y = 72 ÷ (12 - 8)" }
];

// DOM 元素
const screens = {
    start: document.getElementById('start-screen'),
    coordinate: document.getElementById('coordinate-screen'),
    stageComplete: document.getElementById('stage-complete-screen'),
    select: document.getElementById('select-screen'),
    game: document.getElementById('game-screen'),
    fail: document.getElementById('fail-screen'),
    success: document.getElementById('success-screen')
};

const elements = {
    // 開始按鈕
    startGameBtn: document.getElementById('start-game-btn'),
    // 第一關：座標尋寶
    coordinateGrid: document.getElementById('coordinate-grid'),
    coordinateClue: document.getElementById('coordinate-clue'),
    coordinateProgress: document.getElementById('coordinate-progress'),
    freezeOverlay: document.getElementById('freeze-overlay'),
    freezeTimer: document.getElementById('freeze-timer'),
    freezeClue: document.getElementById('freeze-clue'),
    // 第二關選擇
    randomBtn: document.getElementById('random-btn'),
    manualBtn: document.getElementById('manual-btn'),
    backBtn: document.getElementById('back-btn'),
    confirmBtn: document.getElementById('confirm-btn'),
    articleList: document.getElementById('article-list'),
    selectedCount: document.getElementById('selected-count'),
    retryBtn: document.getElementById('retry-btn'),
    retryStage2Btn: document.getElementById('retry-stage2-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    toggleArticleBtn: document.getElementById('toggle-article'),
    articleTitle: document.getElementById('article-title'),
    articleContent: document.getElementById('article-content'),
    questionText: document.getElementById('question-text'),
    options: document.getElementById('options'),
    feedback: document.getElementById('feedback'),
    articleProgress: document.getElementById('article-progress'),
    questionProgress: document.getElementById('question-progress'),
    score: document.getElementById('score'),
    failInfo: document.getElementById('fail-info'),
    finalScore: document.getElementById('final-score')
};

// 載入題目資料
async function loadGameData() {
    try {
        // 載入題目
        const questionsResponse = await fetch('data/questions.json');
        gameData = await questionsResponse.json();
        console.log(`載入了 ${gameData.articles.length} 篇文章的題目`);

        // 載入文章內容
        const articlesResponse = await fetch('data/articles.json');
        articlesData = await articlesResponse.json();
        console.log(`載入了 ${articlesData.length} 篇文章內容`);
    } catch (error) {
        console.error('載入資料失敗:', error);
        alert('載入資料失敗，請重新整理頁面');
    }
}

// 切換畫面
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// ========== 第一關：座標尋寶 ==========

// 開始第一關
function startCoordinateGame() {
    currentTreasureIndex = 0;
    generateCoordinateGrid();
    updateCoordinateUI();
    showScreen('coordinate');
}

// 生成座標格子（第一象限 20x20）
function generateCoordinateGrid() {
    elements.coordinateGrid.innerHTML = '';

    // Y 軸從 19 到 0（上到下）
    for (let y = 19; y >= 0; y--) {
        // 左邊 Y 軸標籤
        const yLabel = document.createElement('div');
        yLabel.className = 'coordinate-cell axis-label';
        yLabel.textContent = y;
        elements.coordinateGrid.appendChild(yLabel);

        // 20 個格子（x 從 0 到 19）
        for (let x = 0; x <= 19; x++) {
            const cell = document.createElement('div');
            cell.className = 'coordinate-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.addEventListener('click', () => handleCellClick(x, y, cell));
            elements.coordinateGrid.appendChild(cell);
        }
    }

    // 最底下一行：空白 + X 軸標籤
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'coordinate-cell axis-label';
    elements.coordinateGrid.appendChild(emptyCorner);

    for (let x = 0; x <= 19; x++) {
        const xLabel = document.createElement('div');
        xLabel.className = 'coordinate-cell axis-label';
        xLabel.textContent = x;
        elements.coordinateGrid.appendChild(xLabel);
    }
}

// 處理格子點擊
function handleCellClick(x, y, cell) {
    // 如果已經找到的格子，不處理
    if (cell.classList.contains('found')) return;

    const target = treasurePath[currentTreasureIndex];

    if (x === target.x && y === target.y) {
        // 正確！
        cell.classList.add('found');
        cell.textContent = '🎁';
        currentTreasureIndex++;

        if (currentTreasureIndex >= treasurePath.length) {
            // 第一關完成！
            setTimeout(() => {
                showScreen('stageComplete');
            }, 800);
        } else {
            updateCoordinateUI();
        }
    } else {
        // 錯誤！冷凍 3 分鐘
        startFreeze();
    }
}

// 更新座標尋寶 UI
function updateCoordinateUI() {
    elements.coordinateClue.textContent = treasurePath[currentTreasureIndex].clue;
    elements.coordinateProgress.textContent = `進度：${currentTreasureIndex}/${treasurePath.length}`;
}

// 開始冷凍
function startFreeze() {
    let seconds = 180; // 3 分鐘
    elements.freezeOverlay.classList.remove('hidden');
    elements.freezeTimer.textContent = seconds;

    // 顯示答錯的題目
    const currentClue = treasurePath[currentTreasureIndex].clue;
    elements.freezeClue.innerHTML = `<p>題目：</p><p><strong>${currentClue}</strong></p>`;

    freezeTimer = setInterval(() => {
        seconds--;
        elements.freezeTimer.textContent = seconds;

        if (seconds <= 0) {
            clearInterval(freezeTimer);
            elements.freezeOverlay.classList.add('hidden');
        }
    }, 1000);
}

// 秘密解凍：連按 3 次 Escape 或連點 5 次畫面
let escapeCount = 0;
let escapeTimeout = null;
let tapCount = 0;
let tapTimeout = null;

// 電腦版：按 Escape 3 次
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.freezeOverlay.classList.contains('hidden')) {
        escapeCount++;

        if (escapeTimeout) clearTimeout(escapeTimeout);
        escapeTimeout = setTimeout(() => { escapeCount = 0; }, 1000);

        if (escapeCount >= 3) {
            secretUnfreeze();
            escapeCount = 0;
        }
    }
});

// 手機版：連點 5 次冷凍畫面
document.getElementById('freeze-overlay').addEventListener('click', () => {
    tapCount++;

    if (tapTimeout) clearTimeout(tapTimeout);
    tapTimeout = setTimeout(() => { tapCount = 0; }, 2000);

    if (tapCount >= 5) {
        secretUnfreeze();
        tapCount = 0;
    }
});

// 秘密解凍函式
function secretUnfreeze() {
    clearInterval(freezeTimer);
    elements.freezeOverlay.classList.add('hidden');
    console.log('🔓 管理員解凍');
}

// ========== 第二關：閱讀測驗 ==========

// 隨機選擇 3 篇文章
function selectRandomArticles() {
    const shuffled = [...gameData.articles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}

// 顯示文章選擇畫面
function showSelectScreen() {
    manualSelectedIds = [];
    elements.articleList.innerHTML = '';

    // 按日期排序（舊到新）
    const sortedArticles = [...gameData.articles].sort((a, b) => a.id.localeCompare(b.id));

    sortedArticles.forEach(article => {
        const div = document.createElement('div');
        div.className = 'article-item';
        div.dataset.id = article.id;

        // 從 id 提取日期
        const dateStr = article.id.substring(0, 10);

        div.innerHTML = `
            <div class="article-date">${dateStr}</div>
            <div class="article-name">${article.title}</div>
        `;

        div.addEventListener('click', () => toggleArticleSelection(article.id, div));
        elements.articleList.appendChild(div);
    });

    updateSelectedCount();
    showScreen('select');
}

// 切換文章選擇狀態
function toggleArticleSelection(articleId, element) {
    const index = manualSelectedIds.indexOf(articleId);

    if (index > -1) {
        // 已選擇，取消選擇
        manualSelectedIds.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // 未選擇，加入選擇（最多 7 篇）
        if (manualSelectedIds.length < 7) {
            manualSelectedIds.push(articleId);
            element.classList.add('selected');
        }
    }

    updateSelectedCount();
}

// 更新已選數量
function updateSelectedCount() {
    elements.selectedCount.textContent = manualSelectedIds.length;
    elements.confirmBtn.disabled = manualSelectedIds.length !== 7;
}

// 開始遊戲（隨機模式）
function startRandomGame() {
    gameMode = 'random';
    selectedArticles = selectRandomArticles();
    startGameCommon();
}

// 開始遊戲（手動選擇模式）
function startManualGame() {
    gameMode = 'manual';
    // 根據選擇的 ID 找到對應的文章資料
    selectedArticles = manualSelectedIds.map(id =>
        gameData.articles.find(a => a.id === id)
    );
    startGameCommon();
}

// 共用的遊戲開始邏輯
function startGameCommon() {
    currentArticleIndex = 0;
    currentQuestionIndex = 0;
    totalCorrect = 0;

    showScreen('game');
    loadArticle();
}

// 載入文章
function loadArticle() {
    const article = selectedArticles[currentArticleIndex];

    // 從 articlesData 中找到對應的文章內容
    const articleContent = articlesData.find(a => a.id === article.id);

    elements.articleTitle.textContent = article.title;

    if (articleContent && articleContent.content) {
        // 使用 marked.js 將 markdown 轉換為 HTML
        const htmlContent = marked.parse(articleContent.content);
        elements.articleContent.innerHTML = htmlContent +
            `<p style="margin-top: 20px;"><a href="${article.link}" target="_blank">📖 點此閱讀原文（含圖片）</a></p>`;
    } else {
        elements.articleContent.innerHTML = `<p><a href="${article.link}" target="_blank">📖 點此閱讀原文</a></p>`;
    }

    elements.articleContent.classList.add('hidden');
    elements.toggleArticleBtn.textContent = '展開文章 📖';

    updateProgress();
    loadQuestion();
}

// 載入題目
function loadQuestion() {
    const article = selectedArticles[currentArticleIndex];
    const question = article.questions[currentQuestionIndex];

    elements.questionText.textContent = question.question;
    elements.options.innerHTML = '';
    elements.feedback.classList.add('hidden');

    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        btn.addEventListener('click', () => handleAnswer(index));
        elements.options.appendChild(btn);
    });

    updateProgress();
}

// 處理答案
function handleAnswer(selectedIndex) {
    const article = selectedArticles[currentArticleIndex];
    const question = article.questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.answer;

    // 禁用所有選項
    const optionBtns = elements.options.querySelectorAll('.option-btn');
    optionBtns.forEach((btn, index) => {
        btn.disabled = true;
        if (index === question.answer) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && !isCorrect) {
            btn.classList.add('wrong');
        }
    });

    // 顯示回饋
    elements.feedback.classList.remove('hidden', 'correct', 'wrong');

    if (isCorrect) {
        totalCorrect++;
        elements.feedback.classList.add('correct');
        elements.feedback.textContent = '✅ 答對了！';

        setTimeout(() => {
            nextQuestion();
        }, 1000);
    } else {
        elements.feedback.classList.add('wrong');
        elements.feedback.textContent = '❌ 答錯了！';

        setTimeout(() => {
            showFailScreen(article.title, question.question, question.options[question.answer]);
        }, 1500);
    }

    updateProgress();
}

// 下一題
function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex >= 5) {
        // 完成這篇文章
        currentQuestionIndex = 0;
        currentArticleIndex++;

        if (currentArticleIndex >= selectedArticles.length) {
            // 全部完成！
            showSuccessScreen();
        } else {
            // 下一篇文章
            loadArticle();
        }
    } else {
        loadQuestion();
    }
}

// 更新進度
function updateProgress() {
    elements.articleProgress.textContent = `第 ${currentArticleIndex + 1}/${selectedArticles.length} 篇`;
    elements.questionProgress.textContent = `第 ${currentQuestionIndex + 1}/5 題`;
    elements.score.textContent = `答對：${totalCorrect} 題`;
}

// 顯示失敗畫面
function showFailScreen(articleTitle, question, correctAnswer) {
    // 儲存失敗紀錄
    const totalQuestions = selectedArticles.length * 5;
    saveRecord({
        date: new Date().toISOString(),
        mode: gameMode,
        success: false,
        correct: totalCorrect,
        total: totalQuestions
    });

    elements.failInfo.innerHTML = `
        <strong>文章：</strong>${articleTitle}<br>
        <strong>題目：</strong>${question}<br>
        <strong>正確答案：</strong>${correctAnswer}
    `;
    showScreen('fail');
}

// 顯示成功畫面
function showSuccessScreen() {
    const totalQuestions = selectedArticles.length * 5;

    // 儲存成功紀錄
    saveRecord({
        date: new Date().toISOString(),
        mode: gameMode,
        success: true,
        correct: totalCorrect,
        total: totalQuestions
    });

    elements.finalScore.textContent = `你總共答對了 ${totalCorrect}/${totalQuestions} 題！`;
    showScreen('success');
}

// 切換文章顯示
function toggleArticle() {
    const isHidden = elements.articleContent.classList.contains('hidden');
    elements.articleContent.classList.toggle('hidden');
    elements.toggleArticleBtn.textContent = isHidden ? '收合文章 📕' : '展開文章 📖';
}

// 返回開始畫面
function goToStart() {
    // 重置第一關狀態
    currentTreasureIndex = 0;
    if (freezeTimer) {
        clearInterval(freezeTimer);
        freezeTimer = null;
    }
    elements.freezeOverlay.classList.add('hidden');
    displayRecords(); // 更新紀錄顯示
    showScreen('start');
}

// 返回第一關完成畫面（從選擇文章返回，或第二關失敗重試）
function goToStageComplete() {
    showScreen('stageComplete');
}

// 從第二關重新開始（不需要重玩第一關）
function retryFromStage2() {
    displayRecords(); // 更新紀錄顯示
    showScreen('stageComplete');
}

// 事件監聽
elements.startGameBtn.addEventListener('click', startCoordinateGame);
elements.randomBtn.addEventListener('click', startRandomGame);
elements.manualBtn.addEventListener('click', showSelectScreen);
elements.backBtn.addEventListener('click', goToStageComplete);
elements.confirmBtn.addEventListener('click', startManualGame);
elements.retryBtn.addEventListener('click', goToStart);
elements.retryStage2Btn.addEventListener('click', retryFromStage2);
elements.playAgainBtn.addEventListener('click', goToStart);
elements.toggleArticleBtn.addEventListener('click', toggleArticle);

// 初始化
loadGameData();
displayRecords();
