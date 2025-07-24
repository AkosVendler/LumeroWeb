document.addEventListener('DOMContentLoaded', () => {
    fetch('/user/discounts', {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Nem sikerült lekérni a kedvezményeket');
        return res.json();
      })
      .then(discounts => {
        const rewardsContainer = document.getElementById('rewards');
  
        if (!discounts || discounts.length === 0) {
          const noDiscount = document.createElement('p');
          noDiscount.textContent = 'Jelenleg nincs aktív kedvezmény.';
          noDiscount.classList.add('no-discount'); // ha szeretnél rá stílust
          rewardsContainer.appendChild(noDiscount);
          return;
        }

        discounts.forEach(discount => {
          const discountDiv = document.createElement('div');
          discountDiv.classList.add('discount');
  
          discountDiv.innerHTML = `
            <div class="discount-image">
              <p>${discount.percent}%</p>
            </div>
            <div class="discount-text">
              <h2 id="discount-header"><span>${discount.percent}</span>% kedvezmény a következő vásárlásodra</h2>
              <p id="discount-description">Használd a következő kódot a fizetésnél hogy aktiváld a kedvezményt. Kód: <span>${discount.code}</span> Érvényesség: <span>${discount.validUntil}</span></p>
            </div>
          `;
  
          rewardsContainer.appendChild(discountDiv);
        });
      })
      .catch(err => {
        console.error('Nem sikerült betölteni a kedvezményeket:', err);
      });
  });
  