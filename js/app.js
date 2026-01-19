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
    loadSubtitles(player.getVideoData().video_id);
  }

  // === Загрузка субтитров с YouTube ===
  function loadSubtitles(videoId) {
    transcript.innerHTML = '<p class="text-muted"><small>Загрузка субтитров...</small></p>';
    transcriptLines = [];
    selectedText = '';
    insertTranscriptBtn.style.display = 'none';

    const subtitleUrl = `https://video.google.com/timedtext?lang=ru&v=${videoId}`;

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
          transcript.innerHTML = '<p class="text-muted"><small>Нет доступных субтитров.</small></p>';
          return;
        }

        transcript.innerHTML = '';
        transcriptLines = [];

        texts.forEach(el => {
          const start = parseFloat(el.getAttribute('start'));
          const dur = parseFloat(el.getAttribute('dur') || 0);
          const text = el.textContent.trim();
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

        highlightCurrentTranscript(player.getCurrentTime());
      })
      .catch(err => {
        console.warn('Субтитры недоступны:', err);
        transcript.innerHTML = '<p class="text-muted"><small>Субтитры недоступны для этого видео.</small></p>';
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
    if (!currentTime && currentTime !== 0) return;

    if (currentTranscriptHighlight) {
      currentTranscriptHighlight.style.background = '';
    }

    const line = [...transcriptLines]
      .reverse()
      .find(l => l.seconds <= currentTime);

    if (line) {
      const p = [...transcript.querySelectorAll('p')]
        .find(el => el.dataset.time === line.time && parseFloat(el.dataset.seconds) === line.seconds);

      if (p) {
        p.style.background = '#e0f7fa';
        currentTranscriptHighlight = p;

        // Прокрутка, но не слишком часто
        if (!isInViewport(p)) {
          p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
