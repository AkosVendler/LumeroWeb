document.getElementById('change-password-btn').addEventListener('click', async () => {
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const feedback = document.getElementById('feedback');

    if (!oldPassword || !newPassword || !confirmPassword) {
      feedback.textContent = 'Kérlek tölts ki minden mezőt!';
      feedback.style.color = 'red';
      return;
    }

    if (newPassword !== confirmPassword) {
      feedback.textContent = 'Az új jelszavak nem egyeznek!';
      feedback.style.color = 'red';
      return;
    }

    try {
      const res = await fetch('/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        feedback.textContent = 'Jelszó sikeresen megváltoztatva!';
        feedback.style.color = 'green';

        // Mezők törlése
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
      } else {
        feedback.textContent = data.error || 'Hiba történt.';
        feedback.style.color = 'red';
      }
    } catch (err) {
      feedback.textContent = 'Hálózati hiba.';
      feedback.style.color = 'red';
    }
  });