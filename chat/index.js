
const {bind:hyper, wire} = require('hyperhtml');
const ipcRenderer = require('electron').ipcRenderer;

let status;
let conversation;
let newMessage;
let model = {};

const EventListener = {
  handleEvent: e => model[e.target.name] = e.target.value
}

function updateApp() {
  hyper(document.querySelector('#app'))`
  <div>
    <h2>${conversation.peerUser.displayName}</h2>
    <p>convId=${conversation.convId}</p>
    <input name="content" value="${newMessage}" oninput=${EventListener} placeholder="Enter Message">
    <button onclick="${send}">Send</button>
    <p>Status: ${status}</p>
  </div>`;
}

function send(e) {
  status = 'message sent';
  ipcRenderer.send('send-message', {
    convId: conversation.convId,
    content: model.content
  });
  updateApp();
}

ipcRenderer.on('conversation', function (e, conv) {
  conversation = conv;
  updateApp();
});