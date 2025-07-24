document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('calendarModal');
    const openBtn = document.getElementById('openCalendarBtn');
    const closeBtn = modal.querySelector('.close');
    const cal = modal.querySelector('.custom-calendar');
    const dateInput = document.getElementById('date');
    const timeSelect = document.querySelector('.select-start-time');
    const roomTypeSelect = document.getElementById("roomtype");

    let bookings = {};
    const fullSlotsPerDay = 9;
    const d = new Date();
    let month = d.getMonth();
    let year = d.getFullYear();
    let currentYear = year;
    let currentMonth = month;

    async function loadData() {
        const selectedRoom = roomTypeSelect.value;
        console.log(selectedRoom);
        if (!selectedRoom) {
            console.log("Nincs kiválasztva szoba, nem töltjük be a foglalásokat.");
            return;
        }

        const res = await fetch(`/api/bookings?room=${selectedRoom}`);
        bookings = await res.json();
        renderCalendar();
    }

    openBtn.addEventListener('click', () => {
        console.log("Kattintás, roomTypeSelect.value:", roomTypeSelect.value);
        if (!roomTypeSelect.value) {
            alert("Kérlek, először válassz szobát.");
            return;
        }
        modal.classList.add('open');
        loadData();
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
    });

    window.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('open');
    });

    function renderCalendar() {
        cal.innerHTML = '';

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const offset = (firstDay + 6) % 7;
        const dayNames = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V'];
        const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

        document.getElementById('calendarMonth').textContent = `${currentYear}. ${monthNames[currentMonth]}`;

        dayNames.forEach(name => {
            const label = document.createElement('div');
            label.textContent = name;
            label.className = 'calendar-day-name';
            cal.appendChild(label);
        });

        for (let i = 0; i < offset; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-empty';
            cal.appendChild(empty);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const day = document.createElement('div');
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            day.className = 'calendar-day';
            day.textContent = d;

            const dot = document.createElement('div');
            dot.className = 'dot';

            const thisDate = new Date(currentYear, currentMonth, d);
            thisDate.setHours(0, 0, 0, 0);

            const booked = bookings.dates?.[dateStr] || [];

            const hasEndAt17 = booked.some(b => b.endTime === "17:00");

            if (hasEndAt17) {
                dot.classList.add('red');
            } else if (!booked.length) {
                dot.classList.add('green');
            } else {
                dot.classList.add('yellow');
            }


            day.append(dot);
            cal.append(day);

            if (thisDate < today) {
                day.classList.add('disabled');
                day.style.color = '#999';
            } else {
                day.addEventListener('click', () => {
                    cal.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                    day.classList.add('selected');
                    dateInput.value = dateStr;
                    openBtn.textContent = dateStr;
                    timeSelect.disabled = false;
                    updateTimeOptions(dateStr);
                });
            }
        }

    }

    function updateTimeOptions(dateStr) {
        timeSelect.innerHTML = '<option value="">Válassz érkezési időt</option>';

        const booked = bookings.dates?.[dateStr] || [];


        const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

        hours.forEach(t => {
            // Ne jelenjen meg, ha bármelyik foglalás endTime-ja megegyezik ezzel az időponttal
            const isEndTime = booked.some(b => b.endTime === t);
            if (isEndTime) return;

            const [hour, minute] = t.split(':').map(Number);
            const currentTime = new Date(0, 0, 0, hour, minute);

            const overlaps = booked.some(b => {
                const [startH, startM] = b.startTime.split(':').map(Number);
                const [endH, endM] = b.endTime.split(':').map(Number);

                const start = new Date(0, 0, 0, startH, startM);
                const end = new Date(0, 0, 0, endH, endM);

                return currentTime >= start && currentTime < end;
            });

            if (!overlaps) {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                timeSelect.append(opt);
            }
        });
    }


    document.getElementById('prevMonth').addEventListener('click', () => {
        if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
        } else {
            currentMonth--;
        }
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
        } else {
            currentMonth++;
        }
        renderCalendar();
    });
});

const form = document.getElementById("bookingForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        fullname: document.getElementById("fullname").value,
        roomtype: document.getElementById("roomtype").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
        date: document.getElementById("date").value,
        startTime: document.getElementById("startTime").value,
        duration: document.getElementById("time").value,
        people: document.getElementById("people").value,
        message: document.getElementById("message").value,
        decoration: document.querySelector(".checkbox-date-3").checked,
        catering: document.querySelector(".checkbox-date-1").checked,
        organization: document.querySelector(".checkbox-date-2").checked,
        customCheckbox: document.querySelector(".checkbox-custom").checked,
    };

    try {
        const res = await fetch("/api/reserv", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const result = await res.json();

        // 🔔 Ha backend visszadobja, hogy nincs userId
        if (result.warning) {
            const proceed = confirm(result.message);
            if (!proceed) return;

            // Ha mégis folytatja, újrapostoljuk
            const res2 = await fetch("/api/reserv", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...data, force: true }), // akár külön flag is mehet
            });

            const result2 = await res2.json();

            if (!res2.ok) throw new Error(result2.error || "Ismeretlen hiba");

            alert("Foglalás sikeres!");
            return;
        }

        if (!res.ok) throw new Error(result.error || "Ismeretlen hiba");
        alert("Foglalás sikeres!");
    } catch (err) {
        alert("Hiba történt: " + err.message);
        console.error(err);
    }
});
