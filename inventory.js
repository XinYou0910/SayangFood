// -----------------------------
// Sidebar Dropdown Toggle
// -----------------------------
const dropdownBtn = document.querySelector(".dropdown-btn");
const dropdownContainer = dropdownBtn.nextElementSibling;

dropdownBtn.addEventListener("click", function (e) {
  e.stopPropagation(); // Prevent event bubbling
  this.classList.toggle("active");
  dropdownContainer.classList.toggle("show");
});

// -----------------------------
// Sidebar Toggle (Hamburger Menu)
// -----------------------------
function toggleSidebar() {
  document.querySelector(".sidebar").classList.toggle("active");
}

// -----------------------------
// Popup Form
// -----------------------------
function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}

function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}

// -----------------------------
// Highlight Active Main Menu
// -----------------------------
const menuItems = document.querySelectorAll(".menu-item");

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    // Remove active class from all main menu items
    menuItems.forEach((btn) => btn.classList.remove("active"));
    item.classList.add("active");

    // If it's not a dropdown button, close the dropdown
    if (!item.classList.contains("dropdown-btn")) {
      dropdownContainer.classList.remove("show");
      dropdownBtn.classList.remove("active");
    }
  });
});

// -----------------------------
// Highlight Active Submenu
// -----------------------------
const subButtons = document.querySelectorAll(".dropdown-container button");

subButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent event bubbling

    // Remove active from all sub-buttons
    subButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// -----------------------------
// Close Submenu if Clicking Outside
// -----------------------------
document.addEventListener("click", (e) => {
  if (!dropdownContainer.contains(e.target) && !dropdownBtn.contains(e.target)) {
    dropdownContainer.classList.remove("show");
    dropdownBtn.classList.remove("active");
  }
});

// -----------------------------
// Optional: Set Home as Active on Page Load
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  const homeBtn = document.querySelector(".menu-item[onclick*='dashboard_page.html']");
  if (homeBtn) {
    homeBtn.classList.add("active");
  }
});
