// Dropdown toggle
document.querySelector(".dropdown-btn").addEventListener("click", function() {
  this.classList.toggle("active");
  const dropdown = this.nextElementSibling;
  dropdown.style.display = dropdown.style.display === "flex" ? "none" : "flex";
});

// Popup functions
function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}
function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}

// Sidebar toggle (for mobile)
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('active');
}
