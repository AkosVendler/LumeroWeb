// Kinyeri az URL paramétert
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
  
  async function loadNews() {
    const id = getQueryParam('id');
    if (!id) {
      alert('Nem található hír ID!');
      return;
    }
  
    try {
      const res = await fetch('/api/news/' + id);
      if (!res.ok) throw new Error('Hír nem található');
  
      const data = await res.json();
  
      document.getElementById('title').textContent = data.title;
      if (data.imagePath) {
        const img = document.getElementById('image');
        img.src = data.imagePath;
        img.style.display = 'block';
        img.alt = data.title;
      }
  
      document.getElementById('leftText').textContent = data.leftText;
      document.getElementById('rightText').textContent = data.rightText;
      document.getElementById('date-text').textContent = data.createdAt.split('T')[0];
  
    } catch (err) {
      alert('Hiba történt a hír betöltésekor: ' + err.message);
    }
  }
  
  loadNews();
  