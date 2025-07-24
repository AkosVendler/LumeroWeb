document.addEventListener("DOMContentLoaded", () => {
    const messageInput = document.querySelector(".textarea-message");
    const charCount = document.getElementById("char-count");
  
    messageInput.addEventListener("input", () => {
      charCount.textContent = `${messageInput.value.length}/200`;
    });
  
    const form = document.getElementById("bookingForm");
  
    form.addEventListener("submit", function (e) {
      const requiredFields = form.querySelectorAll("[required]");
      let valid = true;
  
      requiredFields.forEach((field) => {
        if (
          (field.type === "checkbox" && !field.checked) ||
          (field.type !== "checkbox" && !field.value.trim())
        ) {
          field.style.border = "1px solid red";
          valid = false;
        } else {
          field.style.border = "1px solid #999";
        }
      });
  
      if (!valid) {
        e.preventDefault();
        alert("Please fill in all required fields correctly.");
      }
    });
  });
  