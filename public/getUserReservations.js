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

    if (!reservations || reservations.length === 0) {
      const noReservations = document.createElement('p');
      noReservations.textContent = 'Jelenleg nincs aktív foglalásod.';
      noReservations.classList.add('no-discount'); // ha szeretnél rá stílust
      container.appendChild(noReservations); // <-- EZT javítottuk
      return;
    }

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
