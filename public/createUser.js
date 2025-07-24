document.getElementById("registerButton").addEventListener("click", async (e) => {
    e.preventDefault();
    await register();
  });
  
  async function register() {
    const email = document.getElementById('email').value;
    const fullname = document.getElementById('name').value;
    const password = document.getElementById('pass').value;
    const isCookieAllowed = document.getElementById('cookie').checked;
    const isNotiAllowed = document.getElementById('market').checked;
  
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            email,
            fullname,
            password,
            isNotiAllowed, 
            isCookieAllowed, }),
      });
  
      const data = await res.json();
  
      if (res.ok) {
        alert("Sikeres regisztráció!");
        window.location.href = "/login.html"; // vagy közvetlen bejelentkezés
      } else {
        alert(`Hiba: ${data.error}`);
      }
    } catch (error) {
      console.error('Fetch hiba:', error);
      alert('Nem sikerült kapcsolódni a szerverhez.');
    }
  }
  