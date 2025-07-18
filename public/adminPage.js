
let adminNameValue = '';


fetch('/admin/data')
    .then(res => {
        if (!res.ok) throw new Error('Hozzáférés megtagadva vagy nem bejelentkezett');
        return res.json();
    })
    .then(data => {
        document.getElementById('ordersCount').textContent = data.orders;
        document.getElementById('usersCount').textContent = data.users;

        adminNameValue = data.adminName; // ELTÁROLJUK

        const greetingEl = document.getElementById('adminGreeting');
        if (greetingEl) {
            greetingEl.textContent = `SZIA, ${adminNameValue.toUpperCase()}!`;
        }
    })

    .catch(err => {
        console.error('Hiba az admin adatok lekérésekor:', err);
        window.location.href = '/login.html';
    });

// Megjelenítés vezérlése
const ordersLink = document.getElementById('ordersLink');
const ordersSection = document.querySelector('.orders');
const mainContent = document.querySelector('.main');
const notiContent = document.querySelector('.admin-notifications');
const newsContent = document.querySelector('.admin-news');
const homeLink = document.getElementById('homeLink');
const notiLink = document.getElementById('notiLink');
const newsLink = document.getElementById('newsLink');

ordersLink.addEventListener('click', (e) => {
    e.preventDefault();
    ordersSection.style.display = 'block';
    mainContent.style.display = 'none';
    notiContent.style.display = 'none';
    newsContent.style.display = 'none';
});

homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    ordersSection.style.display = 'none';
    mainContent.style.display = 'block';
    notiContent.style.display = 'none';
    newsContent.style.display = 'none';
});

notiLink.addEventListener('click', (e) => {
    e.preventDefault();
    ordersSection.style.display = 'none';
    mainContent.style.display = 'none';
    newsContent.style.display = 'none';
    notiContent.style.display = 'block';

    // Ez a sor csak akkor működik, ha a DOM már tartalmazza a greeting elemet
    const greetingEl = document.querySelector('.admin-notifications #adminGreeting');
    if (greetingEl) {
        greetingEl.textContent = `SZIA, ${adminNameValue.toUpperCase()}!`;
    } else {
        console.warn('Nem található greeting elem a noti részben!');
    }
});

newsLink.addEventListener('click', (e) => {
    e.preventDefault();
    ordersSection.style.display = 'none';
    mainContent.style.display = 'none';
    notiContent.style.display = 'none';
    newsContent.style.display = 'block';

    // Ez a sor csak akkor működik, ha a DOM már tartalmazza a greeting elemet
    const greetingEl = document.querySelector('.admin-news #adminGreeting');
    if (greetingEl) {
        greetingEl.textContent = `SZIA, ${adminNameValue.toUpperCase()}!`;
    } else {
        console.warn('Nem található greeting elem a noti részben!');
    }
});



document.addEventListener('DOMContentLoaded', () => {
    const link = document.querySelector('#ordersLink');
    if (!link) {
        console.warn('Nem található a rendelések link!');
        return;
    }

    link.addEventListener('click', async (e) => {
        e.preventDefault();

        const response = await fetch('/admin/data');
        const data = await response.json();

        const ordersContainer = document.querySelector('.orders');
        ordersContainer.innerHTML = `
    <div class="header">
        <h2 id="adminGreeting">SZIA, ${data.adminName.toUpperCase()}!</h2>
        <a class="logout" href="/logout">KIJELENTKEZÉS</a>
    </div>
    <h1>Rendelések</h1>
`;


        data.reservations.forEach(res => {
            const createdAtDate = res.createdAt ? res.createdAt.split('T')[0] : 'ismeretlen';
            const arrivalDate = res.date ? res.date.split('T')[0] : 'ismeretlen';

            // A rendelés kártya div-be betesszük az order ID-t adatként (data-id)
            const orderHTML = `
                <div class="order-card" data-id="${res.id || res._id}">
                    <div class="order-left">
                        <p><strong>Név:</strong> ${res.name}</p>
                        <p><strong>Email:</strong> ${res.email}</p>
                        <p><strong>Telefonszám:</strong> ${res.phone}</p>
                        <p><strong>Terem:</strong> ${res.roomName || 'ismeretlen'}</p>
                        <p><strong>Extra szolgáltatás:</strong> ${res.extra || 'nincs'}</p>
                        <p><strong>Ajánlatra vár:</strong> ${res.waiting ? 'igen' : 'nem'}</p>
                    </div>
                    <div class="order-right">
                        <p><strong>Foglalás dátuma:</strong> ${createdAtDate} &nbsp;&nbsp;&nbsp;
                           <strong>Érkezés dátuma:</strong> ${arrivalDate} - ${res.startTime}</p>
                        <p><strong>Foglalt idő:</strong> ${res.duration} óra &nbsp;&nbsp;&nbsp;
                           <strong>Személyek:</strong> ${res.people} fő</p>
                        <p><strong>Üzenet:</strong> ${res.message || 'nincs'}</p>
                        <div class="icons">
                            <img src="/assets/check-icon.svg" alt="Jóváhagyás" class="icon" />
                            <img src="/assets/trash-icon.svg" alt="Törlés" class="icon delete-icon" style="cursor:pointer;" />
                        </div>
                    </div>
                </div>
            `;
            ordersContainer.insertAdjacentHTML('beforeend', orderHTML);
        });

        // Törlés ikonokra kattintás kezelése (event delegation)
        ordersContainer.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete-icon')) {
                const orderCard = event.target.closest('.order-card');
                const orderId = orderCard.getAttribute('data-id');

                if (!orderId) {
                    alert('Nem található az order ID!');
                    return;
                }

                if (!confirm('Biztosan törölni szeretnéd a rendelést?')) return;

                try {
                    const deleteResponse = await fetch(`/admin/deleteOrder/${orderId}`, {
                        method: 'DELETE',
                    });

                    if (deleteResponse.ok) {
                        // Ha sikeres a törlés, eltávolítjuk a DOM-ból az adott kártyát
                        orderCard.remove();
                        alert('Rendelés sikeresen törölve.');
                    } else {
                        alert('A rendelés törlése sikertelen.');
                    }
                } catch (error) {
                    console.error('Hiba a törlés során:', error);
                    alert('Hiba történt a törlés során.');
                }
            }
        });
    });
});

let editingId = null;
let currentNewsList = [];

function openModal() {
    document.getElementById('newsModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('newsModal').style.display = 'none';
    document.getElementById('newsForm').reset();
    editingId = null;
}

function editNews(id) {
    const item = currentNewsList.find(n => n._id === id);
    if (!item) return alert('Nem található a hír.');

    editingId = id;

    document.getElementById('titleInput').value = item.title;
    document.getElementById('leftInput').value = item.leftText;
    document.getElementById('rightInput').value = item.rightText;

    openModal();
}

document.getElementById('newsForm').addEventListener('submit', async (e) => {

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length && !editingId) {
        e.preventDefault();
        alert('Kérlek tölts fel egy képet!');
        return;
    }

    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/news/${editingId}` : '/api/news';

    const res = await fetch(url, {
        method,
        body: formData,
    });

    const result = await res.json();

    if (result.success) {
        closeModal();
        fetchNews();
        alert(editingId ? 'Sikeres módosítás!' : 'Sikeres feltöltés!');
    } else {
        alert('Hiba történt a mentés során.');
    }
});

async function fetchNews() {
    const res = await fetch('/api/news');
    const news = await res.json();
    const newsArray = Array.isArray(news) ? news : [news];

    currentNewsList = newsArray;

    const container = document.getElementById('newsRows');
    container.innerHTML = '';

    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
    }

    newsArray.forEach(item => {
        const row = document.createElement('div');
        row.className = 'news-item';

        row.innerHTML = `
        <div class="title">${item.title}</div>
        <div class="right-text">${truncateText(item.rightText, 100)}</div>
        <button class="edit-btn" onclick="editNews('${item._id}')">Szerkesztés</button>
        <button class="delete-btn" onclick="deleteNews('${item._id}')">Törlés</button>
      `;

        container.appendChild(row);
    });
}

async function deleteNews(id) {
    if (!confirm("Biztosan törlöd?")) return;

    const res = await fetch('/api/news/' + id, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
        fetchNews();
        alert('Sikeres törlés');
    } else {
        alert('Hiba történt a törlés során');
    }
}

// Első betöltés
fetchNews();
