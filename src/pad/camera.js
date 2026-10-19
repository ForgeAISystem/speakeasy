'use strict';
// Round, always-on-top camera bubble for screen recordings. Drag it anywhere.
navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 640 }, audio: false })
  .then((stream) => {
    document.getElementById('v').srcObject = stream;
    document.getElementById('msg').remove();
  })
  .catch(() => {
    document.getElementById('msg').textContent = 'Allow SpeakEasy to use the camera in System Settings > Privacy.';
  });
