document.querySelector('.reset-button').addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim();
  
    if (!email) {
      alert('Kérlek, add meg az e-mail címed!');
      return;
    }
  
    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
  
      const data = await res.json();
  
      if (res.ok) {
        alert(data.message); // pl. "E-mail elküldve!"
      } else {
        alert(data.error || 'Hiba történt!');
      }
  
    } catch (err) {
      alert('Nem sikerült csatlakozni a szerverhez.');
    }
  });