function updateCommands() {
  const owner = document.getElementById('ownerInput').value.trim() || '<owner>';
  const repo = document.getElementById('repoInput').value.trim() || '<repo>';
  const httpsCmd = `git clone https://github.com/${owner}/${repo}.git`;
  const sshCmd = `git clone git@github.com:${owner}/${repo}.git`;
  document.getElementById('httpsCmd').textContent = httpsCmd;
  document.getElementById('sshCmd').textContent = sshCmd;
}

function bindCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const selector = btn.getAttribute('data-copy');
      const el = document.querySelector(selector);
      const text = el ? el.textContent : '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制'), 1200);
      } catch (e) {
        console.error('复制失败', e);
        btn.textContent = '复制失败';
        setTimeout(() => (btn.textContent = '复制'), 1200);
      }
    });
  });
}

function main() {
  const ownerInput = document.getElementById('ownerInput');
  const repoInput = document.getElementById('repoInput');
  ownerInput.addEventListener('input', updateCommands);
  repoInput.addEventListener('input', updateCommands);
  updateCommands();
  bindCopyButtons();
}

document.addEventListener('DOMContentLoaded', main);