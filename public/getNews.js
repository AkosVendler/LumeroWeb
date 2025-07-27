let currentNewsList = [];           // Globális tároló, hogy ne kelljen újra fetch‑elni

/* 1) Letöltés */
async function fetchNews() {
  const res  = await fetch('/api/news');
  const news = await res.json();
  currentNewsList = Array.isArray(news) ? news : [news];

  renderNews();                     // Azonnal megjelenítjük
}

/* 2) Megjelenítés (bármikor hívható) */
function renderNews() {
  const maxLen    = window.innerWidth <= 720 ? 50 : 100;
  const container = document.getElementById('newsRows');
  container.innerHTML = '';

  const truncate = (txt, len) =>
    !txt ? '' : (txt.length <= len ? txt : txt.slice(0, len) + '…');

  currentNewsList.forEach(item => {
    const row = document.createElement('div');
    row.className = 'news-item';
    row.innerHTML = `
      <div class="news-row-wrapper">
        <div class="news-row-title">${item.title}</div>
        <div></div>
        <div class="right-text">${truncate(item.rightText, maxLen)}</div>
      </div>
      <div class="date-text">${item.createdAt.split('T')[0]}</div>
      <button class="more-btn" onclick="location.href='onenews.html?id=${item._id}'">
        <img src="./assets/more.svg" alt="More"/>
      </button>
    `;
    container.appendChild(row);
  });
}

/* 3) Események */
window.addEventListener('DOMContentLoaded', fetchNews);
/*  Throttle‑olt resize: csak akkor rajzolunk újra, ha a 720-as határ átlépése indokolja  */
let lastIsMobile = window.innerWidth <= 720;
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 720;
  if (isMobile !== lastIsMobile) {
    lastIsMobile = isMobile;
    renderNews();                   // karakterlimit vált → újrarajzoljuk
  }
});