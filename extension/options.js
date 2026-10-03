const $ = (id) => document.getElementById(id);
chrome.storage.sync.get({ username: '', apiUrl: 'http://localhost:4000', apiKey: '' }).then((c) => {
  $('username').value = c.username;
  $('apiUrl').value = c.apiUrl;
  $('apiKey').value = c.apiKey;
});
$('save').addEventListener('click', async () => {
  await chrome.storage.sync.set({
    username: $('username').value.trim(),
    apiUrl: $('apiUrl').value.trim(),
    apiKey: $('apiKey').value.trim()
  });
  $('status').textContent = 'Saved';
  setTimeout(() => ($('status').textContent = ''), 1500);
});
