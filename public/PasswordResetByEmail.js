// Kiolvassuk a URL-ből a token-t
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const resetButton = document.getElementById('reset-button');
const messageP = document.getElementById('message');

resetButton.addEventListener('click', async () => {
  const password = document.getElementById('password').value;
  const passwordRepeat = document.getElementById('password-repeat').value;

  if (!password || !passwordRepeat) {
    messageP.textContent = 'Kérlek töltsd ki mindkét jelszó mezőt.';
    return;
  }

  if (password !== passwordRepeat) {
    messageP.textContent = 'A két jelszó nem egyezik.';
    return;
  }

  if (!token) {
    messageP.textContent = 'Hiányzó token az URL-ben.';
    return;
  }

  try {
    const response = await fetch('/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (response.ok) {
      messageP.style.color = 'green';
      messageP.textContent = data.message || 'Sikeres jelszóváltoztatás!';
      // Opció: átirányítás bejelentkezéshez
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } else {
      messageP.style.color = 'red';
      messageP.textContent = data.error || 'Hiba történt.';
    }
  } catch (err) {
    messageP.style.color = 'red';
    messageP.textContent = 'Hálózati hiba, próbáld újra később.';
  }
});