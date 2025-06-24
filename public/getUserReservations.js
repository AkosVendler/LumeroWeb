async function loadReservations() {
    try {
      const res = await fetch('/user/reservations');
      if (!res.ok) {
        const error = await res.json();
        console.error('Hiba:', error.error);
        return;
      }

      const reservations = await res.json();
      const container = document.getElementById('reservations');

      reservations.forEach(r => {
        const p = document.createElement('p');
        p.className = 'reservation';
        p.textContent = `${r.room} – ${r.date} • ${r.startTime} (${r.duration} óra) – ${r.people} fő`;
        container.appendChild(p);
      });
    } catch (err) {
      console.error('Hálózati hiba:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadReservations);