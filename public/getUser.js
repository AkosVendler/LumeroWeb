fetch('/user', {
  credentials: 'include'
})
  .then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  })
  .then(user => {
    document.getElementById("user-name").textContent = `${user.fullname}`;

    const checkbox = document.getElementById("notifications");

// Alapértelmezett állapot beállítása
checkbox.checked = user.isNotiAllowed === true;

// Esemény figyelő
checkbox.addEventListener("change", async () => {
  const isAllowed = checkbox.checked;

  try {
    const response = await fetch("/api/update-notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isNotiAllowed: isAllowed }),
    });

    if (!response.ok) throw new Error("Hiba a frissítés során");
    console.log("Sikeres frissítés");
  } catch (err) {
    console.error("Hiba:", err.message);
  }
});

    

  })
  .catch(err => {
    //console.error('Hiba a /user lekérésnél:', err); // 🔥 Itt látod végre mi történt
    window.location.href = "/login.html"; // ide térj vissza, ha tényleg jogos
  });
