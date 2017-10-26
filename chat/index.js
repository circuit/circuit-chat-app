const hyperHTML = require('hyperhtml');
const ipcRenderer = require('electron').ipcRenderer;

let name = 'unknown';
let convId;
let status;
let conversation;

function render(tag) {
  tag`
    <div>
      <h2>${name}</h2>
      <p>convId=${conversation.convId}</p>
      <button onclick="call()">Call</button>
      <p>Status: ${status}</p>
    </div>
  `;
}

function call() {
  status = 'calling';
  ipcRenderer.send('call', conversation.peerUser.userId);
  render(hyperHTML(document.querySelector('#app')));
}

ipcRenderer.on('conversation', function (e, conv) {
  conversation = conv;
  name = conv.peerUser.displayName;
  render(hyperHTML(document.querySelector('#app')));
});