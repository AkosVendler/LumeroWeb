document.getElementById("button").addEventListener("click", (e) => {
    e.preventDefault();

    login(); // 🔥 ez eddig hiányzott
});

// Például a login oldal betöltésekor:
fetch('/autologin', { credentials: 'include' })
  .then(res => {
    if (res.ok) return;
    throw new Error('Nem bejelentkezett');
  })
  .then(data => {
    // Átirányítás a fiókoldalra
    window.location.href = '/useraccount.html'; // vagy ahova szeretnéd
  })
  .catch(err => {
   
    // Itt marad a login oldalon
  });


async function login() {
    const email = document.getElementById('name').value;
    const password = document.getElementById('pass').value;

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.isAdmin) {
          window.location.href = '/admin';
        } else {
          window.location.href = '/useraccount';
        }
      } else {
        alert(`Hiba: ${data.error}`);
      }
    } catch (error) {
      console.error('Fetch hiba:', error);
      alert('Nem sikerült kapcsolódni a szerverhez.');
    }
  }