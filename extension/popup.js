const list = document.getElementById('list');
document.getElementById('opts').onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
chrome.storage.sync.get({ username: '' }).then(({ username }) => {
  document.getElementById('username').textContent = `Username: ${username || 'Not set'}`;
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

chrome.runtime.sendMessage({ type: 'LIST_BIDS' }, (res) => {
  if (!res || !res.ok) return (list.textContent = (res && res.error) || 'Could not reach the API');
  if (!res.bids.length) return (list.textContent = 'Nothing saved yet. Press Ctrl + . on a job page.');
  list.innerHTML = res.bids.map((b) => `
    <div class="bid">
      <b>${esc(b.jobTitle)}</b>
      <span class="meta">${esc(b.companyName)} · ${esc(b.location || b.locationType || b.workMethod)} · ${esc(b.salary || 'n/a')} · ${esc(b.platform)}</span>
    </div>`).join('');
});
