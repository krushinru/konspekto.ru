document.addEventListener('DOMContentLoaded', function () {
  var timerElement = document.getElementById('timer');
  var startButton = document.getElementById('startButton');
  var resetButton = document.getElementById('resetButton');
  var copyButton = document.getElementById('copyButton');
  var notesTextArea = document.getElementById('notes');
  var modeSelect = document.getElementById('modeSelect');
  var youtubeLink = document.getElementById('youtubeLink'); // Поле для ввода ссылки на YouTube
  var startTime;
  var interval;
  var isTimerRunning = false;
  var player; // YouTube плеер
  var isVideoSync = false; // Флаг для синхронизации с видео

  function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
      isVideoSync = true; // Включаем синхронизацию при воспроизведении
      if (!isTimerRunning) {
        startTimer();
      }
    } else {
      isVideoSync = false; // Выключаем синхронизацию, если видео не воспроизводится
      if (isTimerRunning) {
        pauseTimer();
      }
    }
  }

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
      }
    }
  }

  function startTimer() {
    startTime = new Date();
    interval = setInterval(updateTimer, 1000);
    startButton.textContent = 'Пауза';
    notesTextArea.disabled = false;
    isTimerRunning = true;
    resetButton.style.display = 'inline-block';
    modeSelect.disabled = true;
    if (modeSelect.value === 'timecode' && notesTextArea.value === '') {
        notesTextArea.value = '00:00:00 - ' + notesTextArea.value;
        // Устанавливаем позицию курсора непосредственно после начального таймкода
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
    if (player) {
      player.stopVideo();
    }
  }

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

  function onPlayerReady(event) {
    // Плеер готов
  }

  function updateServiceTimer(currentTime) {
    var hours = Math.floor(currentTime / 3600);
    var minutes = Math.floor((currentTime % 3600) / 60);
    var seconds = currentTime % 60;
    timerElement.textContent = 
      (hours < 10 ? "0" : "") + hours + ":" +
      (minutes < 10 ? "0" : "") + minutes + ":" +
      (seconds  < 10 ? "0" : "") + seconds;
  }

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
        var newPos = cursorPos + (currentTime + " - ").length + 1; // Позиция после " - " и перехода на новую строку
        notesTextArea.selectionStart = notesTextArea.selectionEnd = newPos;
      } else if (modeSelect.value === 'timecode') {
        notesTextArea.value = textBeforeCursor + newLineAndTimecode + textAfterCursor;
        notesTextArea.selectionStart = notesTextArea.selectionEnd = cursorPos + newLineAndTimecode.length;
      }
    }
  });
});