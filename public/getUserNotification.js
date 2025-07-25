document.addEventListener('DOMContentLoaded', () => {
  fetch('/user/notifications', {
    credentials: 'include'
  })
    .then(res => {
      if (!res.ok) throw new Error('Hiba az értesítések lekérésénél');
      return res.json();
    })
    .then(notifications => {
      const container = document.querySelector('.account-notifications');

      // Töröljük az esetleges fix, üres értesítést
      const defaultNotification = container.querySelector('.notification');
      if (defaultNotification) defaultNotification.remove();

      // Ha nincs értesítés
      if (!Array.isArray(notifications) || notifications.length === 0) {
        const noNotif = document.createElement('p');
        noNotif.textContent = 'Nincs kapott értesítésed.';
        noNotif.classList.add('no-discount'); // opcionális class stílushoz
        container.appendChild(noNotif);
        return;
      }

      // Értesítések hozzáadása
      notifications.forEach(notification => {
        const notiDiv = document.createElement('div');
        notiDiv.classList.add('notification');

        const title = document.createElement('h2');
        title.textContent = notification.title || 'Nincs cím';

        const description = document.createElement('p');
        description.textContent = notification.description || 'Nincs leírás';

        notiDiv.appendChild(title);
        notiDiv.appendChild(description);
        container.appendChild(notiDiv);
      });
    })
    .catch(err => {
      console.error('Nem sikerült betölteni az értesítéseket:', err);
      const container = document.querySelector('.account-notifications');
      const errorMsg = document.createElement('p');
      errorMsg.textContent = 'Hiba történt az értesítések betöltésekor.';
      errorMsg.classList.add('no-notification');
      container.appendChild(errorMsg);
    });
});
