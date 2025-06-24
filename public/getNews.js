async function fetchNews() {
    const res = await fetch('/api/news');
    const news = await res.json();
    const newsArray = Array.isArray(news) ? news : [news];

    currentNewsList = newsArray;

    const container = document.getElementById('newsRows');
    container.innerHTML = '';

    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
    }

    newsArray.forEach(item => {
        const row = document.createElement('div');
        row.className = 'news-item';

        row.innerHTML = `
        <div class="news-row-title">${item.title}</div>
        <div class="right-text">${truncateText(item.rightText, 100)}</div>
        <div class="date-text">${item.createdAt.split('T')[0]}</div>
        <button class="more-btn" onclick="location.href='onenews.html?id=${item._id}'"><img src="./assets/more.svg"/></button>
      `;

        container.appendChild(row);
    });
}
window.addEventListener('DOMContentLoaded', fetchNews);  