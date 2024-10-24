<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>雑学クイズ</title>
    <style>
        .quiz-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .quiz-display {
            margin: 20px 0;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 5px;
            min-height: 100px;
            background-color: #f8f9fa;
        }
        .tag-filter {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            background-color: #fff;
        }
        .tag-sections {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .tag-section {
            padding: 10px;
        }
        .tag-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 8px;
        }
        .tag-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
        }
        .all-data-button {
            width: 100%;
            margin: 10px 0;
            padding: 10px;
            background-color: #198754;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        .button-container {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .control-button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background-color: #0d6efd;
            color: white;
            cursor: pointer;
        }
        .control-button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        .selected-tags {
            margin-top: 10px;
            font-size: 0.9em;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="quiz-container">
        <h1>雑学クイズ</h1>
        
        <div class="tag-filter">
            <button onclick="fetchAllData()" class="all-data-button">
                データベース全体から出題
            </button>
            <div class="tag-sections">
                <div class="tag-section">
                    <h3>含めるタグ</h3>
                    <div id="includeTagList" class="tag-list"></div>
                </div>
                <div class="tag-section">
                    <h3>除外するタグ</h3>
                    <div id="excludeTagList" class="tag-list"></div>
                </div>
            </div>
            <div class="selected-tags">
                <div id="selectedIncludeTags"></div>
                <div id="selectedExcludeTags"></div>
            </div>
        </div>

        <div id="quizDisplay" class="quiz-display">
            スタートボタンを押してください
        </div>

        <div class="button-container">
            <button id="startButton" class="control-button">スタート</button>
            <button id="showSupplementButton" class="control-button" disabled>補足を表示</button>
            <button id="showNotionButton" class="control-button" disabled>Notionで開く</button>
            <button id="nextButton" class="control-button" disabled>次の問題</button>
        </div>
    </div>

    <script>
        let quizData = [];
        let currentQuiz = null;
        let supplementShown = false;
        const includedTags = new Set();
        const excludedTags = new Set();
        let isUsingAllData = false;

        async function fetchQuizData(useAllData = false) {
            try {
                const queryParams = new URLSearchParams();
                if (!useAllData) {
                    if (includedTags.size > 0) {
                        queryParams.set('includeTags', Array.from(includedTags).join(','));
                    }
                    if (excludedTags.size > 0) {
                        queryParams.set('excludeTags', Array.from(excludedTags).join(','));
                    }
                }

                const response = await fetch(`/.netlify/functions/getVocab?${queryParams.toString()}`);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }

                quizData = data.results;
                
                // 初回のみタグ一覧を初期化
                if (!document.querySelector('#includeTagList').children.length) {
                    initializeTagLists(data.availableTags);
                }

                updateSelectedTagsDisplay();
                return data.results;
            } catch (error) {
                console.error('Error fetching quiz data:', error);
                return [];
            }
        }

        async function fetchAllData() {
            isUsingAllData = true;
            includedTags.clear();
            excludedTags.clear();
            updateCheckboxes();
            const data = await fetchQuizData(true);
            if (data.length > 0) {
                startQuiz();
            }
        }

        function initializeTagLists(tags) {
            const includeList = document.getElementById('includeTagList');
            const excludeList = document.getElementById('excludeTagList');
            
            tags.forEach(tag => {
                // 含めるタグのチェックボックス
                const includeLabel = document.createElement('label');
                includeLabel.className = 'tag-checkbox';
                includeLabel.innerHTML = `
                    <input type="checkbox" data-tag="${tag}" onchange="handleTagChange('${tag}', this.checked, false)">
                    <span>${tag}</span>
                `;
                includeList.appendChild(includeLabel);

                // 除外するタグのチェックボックス
                const excludeLabel = document.createElement('label');
                excludeLabel.className = 'tag-checkbox';
                excludeLabel.innerHTML = `
                    <input type="checkbox" data-tag="${tag}" onchange="handleTagChange('${tag}', this.checked, true)">
                    <span>${tag}</span>
                `;
                excludeList.appendChild(excludeLabel);
            });
        }

        function updateCheckboxes() {
            document.querySelectorAll('.tag-checkbox input').forEach(checkbox => {
                const tag = checkbox.dataset.tag;
                const isExclude = checkbox.parentElement.parentElement.id === 'excludeTagList';
                checkbox.checked = isExclude ? excludedTags.has(tag) : includedTags.has(tag);
            });
        }

        function handleTagChange(tag, checked, isExclude) {
            isUsingAllData = false;
            const targetSet = isExclude ? excludedTags : includedTags;
            const oppositeSet = isExclude ? includedTags : excludedTags;
            
            if (checked) {
                targetSet.add(tag);
                oppositeSet.delete(tag);
                // 反対側のチェックボックスの状態を更新
                const oppositeSelector = `#${isExclude ? 'includeTagList' : 'excludeTagList'} input[data-tag="${tag}"]`;
                const oppositeCheckbox = document.querySelector(oppositeSelector);
                if (oppositeCheckbox) oppositeCheckbox.checked = false;
            } else {
                targetSet.delete(tag);
            }

            updateSelectedTagsDisplay();
            fetchQuizData();
        }

        function updateSelectedTagsDisplay() {
            document.getElementById('selectedIncludeTags').textContent = 
                `含めるタグ: ${includedTags.size > 0 ? Array.from(includedTags).join(', ') : 'なし'}`;
            document.getElementById('selectedExcludeTags').textContent = 
                `除外するタグ: ${excludedTags.size > 0 ? Array.from(excludedTags).join(', ') : 'なし'}`;
        }

        async function startQuiz() {
            const data = await fetchQuizData(isUsingAllData);
            if (data.length === 0) {
                document.getElementById('quizDisplay').textContent = '条件に一致するクイズデータがありません';
                updateButtons('no-data');
                return;
            }

            currentQuiz = getRandomQuiz();
            if (currentQuiz) {
                document.getElementById('quizDisplay').textContent = currentQuiz.content;
                supplementShown = false;
                updateButtons('quiz');
            }
        }

        function getRandomQuiz() {
            if (quizData.length === 0) return null;
            const randomIndex = Math.floor(Math.random() * quizData.length);
            return quizData[randomIndex];
        }

        function updateButtons(state) {
            document.getElementById('startButton').disabled = state === 'quiz';
            document.getElementById('showSupplementButton').disabled = state !== 'quiz' || supplementShown;
            document.getElementById('showNotionButton').disabled = state !== 'quiz';
            document.getElementById('nextButton').disabled = state !== 'quiz';
        }

        function showSupplement() {
            if (currentQuiz) {
                document.getElementById('quizDisplay').innerHTML = 
                    `<div>${currentQuiz.content}</div>
                     <hr>
                     <div>${currentQuiz.supplement}</div>`;
                supplementShown = true;
                updateButtons('quiz');
            }
        }

        function openInNotion() {
            if (currentQuiz) {
                window.open(currentQuiz.url, '_blank');
            }
        }

        // イベントリスナーの設定
        document.getElementById('startButton').onclick = startQuiz;
        document.getElementById('showSupplementButton').onclick = showSupplement;
        document.getElementById('showNotionButton').onclick = openInNotion;
        document.getElementById('nextButton').onclick = startQuiz;

        // 初期データの読み込み
        fetchQuizData(true);
    </script>
</body>
</html>
