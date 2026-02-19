/** Initializes the bottom panel: clicking the handle toggles the table body. */
export function initPanel() {
  const panel  = document.getElementById('panel');
  const handle = document.getElementById('panel-handle');

  handle.addEventListener('click', e => {
    // Don't collapse when the user clicks the input or download button
    if (e.target.closest('input, button')) return;
    panel.classList.toggle('collapsed');
  });
}

/** Shows or hides the status indicator. Pass null/undefined to hide. */
export function setStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg ?? '';
  el.classList.toggle('visible', Boolean(msg));
}
