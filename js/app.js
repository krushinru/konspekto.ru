document.addEventListener('DOMContentLoaded', function () {
  var timerElement = document.getElementById('timer');
  var startButton = document.getElementById('startButton');
  var resetButton = document.getElementById('resetButton');
  var copyButton = document.getElementById('copyButton');
  var notesTextArea = document.getElementById('notes');
  var modeSelect = document.getElementById('modeSelect');
  var youtubeLink = document.getElementById('youtubeLink');
  var transcript = document.getElementById('transcript');
  var insertTranscriptBtn = document.getElementById('insertTranscriptBtn');
  var transcriptSearch = document.getElementById('transcriptSearch');
  var transcriptLang = document.getElementById('transcriptLang');

  var startTime;
  var interval;
  var isTimerRunning = false;
  var player;
  var isVideoSync = false;
  var transcriptLines = [];
  var selectedText = '';
  var selectedTime = '00:00:00';
  var currentTranscriptHighlight = null;

  // === Инициализация YouTube IFrame API ===
  window.onYouTubeIframeAPIReady = function () {
    // Инициализация произойдёт после установки videoId
  };

  // === Обработчики событий YouTube ===
  function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
      isVideoSync = true;
      if (!isTimerRunning) {
        startTimer();
      }
    } else {
      isVideoSync = false;
      if (isTimerRunning) {
        pauseTimer();
      }
    }
  }

  function onPlayerReady(event) {
  const videoId = player.getVideoData().video_id;
  loadSubtitleLanguages(videoId);
}

  function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

transcriptLang.addEventListener('change', function () {
  const videoId = player?.getVideoData()?.video_id;
  if (videoId && this.value) {
    loadSubtitles(videoId, this.value);
  }
});

// === Загрузка субтитров на выбранном языке ===
function loadSubtitles(videoId, lang = 'ru') {
  transcript.innerHTML = '<p class="text-muted"><small>Загрузка субтитров...</small></p>';
  transcriptLines = [];
  selectedText = '';
  insertTranscriptBtn.style.display = 'none';

  const subtitleUrl = `https://video.google.com/timedtext?lang=${lang}&v=${videoId}`;

  fetch(subtitleUrl)
    .then(response => {
      if (response.status === 404) throw new Error('Субтитры не найдены');
      return response.text();
    })
    .then(str => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(str, 'text/xml');
      const parserError = xml.querySelector('parsererror');
      if (parserError) {
        throw new Error('Ошибка парсинга XML');
      }

      const texts = xml.querySelectorAll('text');
      if (texts.length === 0) {
        transcript.innerHTML = '<p class="text-muted"><small>Нет текста в субтитрах.</small></p>';
        return;
      }

      transcript.innerHTML = '';
      transcriptLines = [];

      texts.forEach(el => {
        const start = parseFloat(el.getAttribute('start'));
        const dur = parseFloat(el.getAttribute('dur') || 0);
        const text = decodeHtmlEntities(el.textContent).trim(); // Декодируем HTML-сущности
        if (!text) return;

        const hours = Math.floor(start / 3600);
        const minutes = Math.floor((start % 3600) / 60);
        const seconds = Math.floor(start % 60);
        const timeStr = [hours, minutes, seconds]
          .map(v => v < 10 ? '0' + v : v)
          .join(':');

        const p = document.createElement('p');
        p.textContent = text;
        p.dataset.time = timeStr;
        p.dataset.seconds = start;
        transcript.appendChild(p);
        transcriptLines.push({ time: timeStr, text: text, seconds: start });
      });

      if (player) {
        highlightCurrentTranscript(player.getCurrentTime());
      }
    })
    .catch(err => {
      console.warn('Ошибка загрузки субтитров:', err);
      transcript.innerHTML = '<p class="text-muted"><small>Не удалось загрузить субтитры.</small></p>';
    });
}


// === Загрузка списка доступных языков субтитров ===
function loadSubtitleLanguages(videoId) {
  const captionsUrl = `https://video.google.com/timedtext?type=list&v=${videoId}`;

  fetch(capsionsUrl)
    .then(response => response.text())
    .then(str => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(str, 'text/xml');
      const tracks = xml.querySelectorAll('track');

      const languages = [];

      tracks.forEach(track => {
        const langCode = track.getAttribute('lang_code');
        const langName = track.getAttribute('name') || langCode.toUpperCase();
        languages.push({ code: langCode, name: langName });
      });

      // Сортировка: сначала русский, английский, потом остальные
      languages.sort((a, b) => {
        if (a.code === 'ru') return -1;
        if (b.code === 'ru') return 1;
        if (a.code === 'en') return -1;
        if (b.code === 'en') return 1;
        return a.name.localeCompare(b.name);
      });

      // Заполняем select
      transcriptLang.innerHTML = '<option value="" selected>Автовыбор (ru)</option>';
      languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        transcriptLang.appendChild(option);
      });

      // Автоматически загружаем русские субтитры, если есть
      const hasRu = languages.some(l => l.code === 'ru');
      loadSubtitles(videoId, hasRu ? 'ru' : languages[0]?.code || 'en');
    })
    .catch(err => {
      console.warn('Не удалось загрузить список языков:', err);
      transcriptLang.innerHTML = '<option value="ru">Русский (резерв)</option>';
      transcriptLang.value = 'ru';
      loadSubtitles(videoId, 'ru');
    });
}


  // === Обновление таймера ===
  function updateTimer() {
    if (!isVideoSync) {
      var now = new Date();
      var elapsedTime = new Date(now - startTime);
      var hours = String(elapsedTime.getUTCHours()).padStart(2, '0');
      var minutes = String(elapsedTime.getUTCMinutes()).padStart(2, '0');
      var seconds = String(elapsedTime.getUTCSeconds()).padStart(2, '0');
      timerElement.textContent = hours + ':' + minutes + ':' + seconds;
    } else {
      if (player && player.getCurrentTime) {
        var currentTime = Math.floor(player.getCurrentTime());
        updateServiceTimer(currentTime);
        highlightCurrentTranscript(currentTime);
      }
    }
  }

  function updateServiceTimer(currentTime) {
    var hours = Math.floor(currentTime / 3600);
    var minutes = Math.floor((currentTime % 3600) / 60);
    var seconds = currentTime % 60;
    timerElement.textContent =
      (hours < 10 ? "0" : "") + hours + ":" +
      (minutes < 10 ? "0" : "") + minutes + ":" +
      (seconds < 10 ? "0" : "") + seconds;
  }

  // === Управление таймером ===
  function startTimer() {
    startTime = new Date();
    interval = setInterval(updateTimer, 1000);
    startButton.textContent = 'Пауза';
    notesTextArea.disabled = false;
    isTimerRunning = true;
    resetButton.style.display = 'inline-block';
    modeSelect.disabled = true;
    if (modeSelect.value === 'timecode' && notesTextArea.value === '') {
      notesTextArea.value = '00:00:00 - ';
      notesTextArea.selectionStart = notesTextArea.selectionEnd = '00:00:00 - '.length;
    }
  }

  function pauseTimer() {
    clearInterval(interval);
    startButton.textContent = 'Старт';
    isTimerRunning = false;
  }

  function resetTimer() {
    clearInterval(interval);
    timerElement.textContent = '00:00:00';
    notesTextArea.value = '';
    notesTextArea.disabled = true;
    startButton.textContent = 'Старт';
    isTimerRunning = false;
    resetButton.style.display = 'none';
    startTime = undefined;
    modeSelect.disabled = false;
    transcriptLang.innerHTML = '<option value="">Автовыбор языка</option>';
    transcriptLines = [];
    selectedText = '';
    insertTranscriptBtn.style.display = 'none';
    if (currentTranscriptHighlight) {
      currentTranscriptHighlight.style.background = '';
      currentTranscriptHighlight = null;
    }
    if (player) {
      player.stopVideo();
    }
  }

  // === Кнопки ===
  startButton.addEventListener('click', function () {
    if (!isTimerRunning) {
      startTimer();
      if (player) {
        player.playVideo();
      }
    } else {
      pauseTimer();
      if (player) {
        player.pauseVideo();
      }
    }
  });

  resetButton.addEventListener('click', resetTimer);

  // === Поле YouTube ссылки ===
  youtubeLink.addEventListener('change', function () {
    var videoId = extractVideoID(youtubeLink.value);
    if (videoId) {
      if (player) {
        player.loadVideoById(videoId);
      } else {
        player = new YT.Player('player', {
          width: '100%',
          height: '240px',
          videoId: videoId,
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        });
      }
    }
  });

  function extractVideoID(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
  }

  // === Поиск по расшифровке ===
  transcriptSearch.addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const items = transcript.querySelectorAll('p');
    items.forEach(p => {
      if (query === '' || p.textContent.toLowerCase().includes(query)) {
        p.style.display = '';
      } else {
        p.style.display = 'none';
      }
    });
  });

  // === Выделение текста в расшифровке ===
  transcript.addEventListener('mouseup', function (e) {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      selectedText = selection.toString();

      let target = e.target;
      while (target && target !== transcript) {
        if (target.tagName === 'P' && target.dataset.time) {
          selectedTime = target.dataset.time;
          break;
        }
        target = target.parentElement;
      }

      insertTranscriptBtn.style.display = 'inline-block';
    } else {
      insertTranscriptBtn.style.display = 'none';
    }
  });

  // === Вставка выделенного текста ===
  insertTranscriptBtn.addEventListener('click', function () {
    if (!selectedText) return;

    const line = `\n${selectedTime} - ${selectedText.trim()}`;
    const cursorPos = notesTextArea.selectionStart;
    const textBefore = notesTextArea.value.substring(0, cursorPos);
    const textAfter = notesTextArea.value.substring(cursorPos);

    notesTextArea.value = textBefore + line + textAfter;
    notesTextArea.selectionStart = notesTextArea.selectionEnd = cursorPos + line.length;

    selectedText = '';
    insertTranscriptBtn.style.display = 'none';
    notesTextArea.focus();
  });

  // === Подсветка текущего фрагмента в расшифровке ===
function highlightCurrentTranscript(currentTime) {
  if (currentTime === undefined || currentTime === null || transcriptLines.length === 0) return;

  const line = transcriptLines
    .slice()
    .reverse()
    .find(l => l.seconds <= currentTime);

  if (line) {
    const p = [...transcript.querySelectorAll('p')]
      .find(el => 
        el.dataset.time === line.time && 
        Math.abs(parseFloat(el.dataset.seconds) - line.seconds) < 0.1
      );

    if (p) {
      if (currentTranscriptHighlight && currentTranscriptHighlight !== p) {
        currentTranscriptHighlight.style.background = '';
      }
      p.style.background = '#e0f7fa';
      currentTranscriptHighlight = p;

      if (!isInViewport(p)) {
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } else {
    if (currentTranscriptHighlight) {
      currentTranscriptHighlight.style.background = '';
      currentTranscriptHighlight = null;
    }
  }
}


  // Проверка видимости элемента
  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    const container = transcript.getBoundingClientRect();
    return (
      rect.top >= container.top &&
      rect.bottom <= container.bottom
    );
  }

  // === Обработка Enter в textarea ===
  notesTextArea.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      var currentTime = timerElement.textContent;
      var cursorPos = notesTextArea.selectionStart;
      var textBeforeCursor = notesTextArea.value.substring(0, cursorPos);
      var lastNewLine = textBeforeCursor.lastIndexOf('\n');
      var textAfterCursor = notesTextArea.value.substring(cursorPos);
      var newLineAndTimecode = "\n" + currentTime + " - ";

      if (modeSelect.value === 'note') {
        var startOfLine = lastNewLine > -1 ? lastNewLine + 1 : 0;
        notesTextArea.value = textBeforeCursor.substring(0, startOfLine) + currentTime + " - " + textBeforeCursor.substring(startOfLine) + "\n" + textAfterCursor;
        var newPos = cursorPos + (currentTime + " - ").length + 1;
        notesTextArea.selectionStart = notesTextArea.selectionEnd = newPos;
      } else if (modeSelect.value === 'timecode') {
        notesTextArea.value = textBeforeCursor + newLineAndTimecode + textAfterCursor;
        notesTextArea.selectionStart = notesTextArea.selectionEnd = cursorPos + newLineAndTimecode.length;
      }
    }
  });
});
