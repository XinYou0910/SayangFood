//Dropdown toggle
const dropdownBtn = document.querySelector(".dropdown-btn");
const dropdownContainer = dropdownBtn.nextElementSibling;

dropdownBtn.addEventListener("click", function (e) {
  e.stopPropagation(); // prevent event bubbling
  this.classList.toggle("active");
  dropdownContainer.classList.toggle("show");
});

//Popup functions
function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}
function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}

// Donate Popup functions
function openDonatePopup() {
  document.getElementById("donatePopup").style.display = "flex";
}
function closeDonatePopup() {
  document.getElementById("donatePopup").style.display = "none";
}

function markAsUsed() {
  alert("Marked as used!");
  closeDonatePopup();
}
function planForMeal() {
  alert("Planned for meal!");
  closeDonatePopup();
}
function flagForDonation() {
  closeDonatePopup();
  document.getElementById("flagDonationPopup").style.display = "flex";
}

function closeFlagDonationPopup() {
  document.getElementById("flagDonationPopup").style.display = "none";
}

// Handle flag donation form submit
document.addEventListener("DOMContentLoaded", function() {
  var form = document.getElementById("flagDonationForm");
  if (form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      // You can process the form data here
      alert("Donation flagged!\nLocation: " + form.pickupLocation.value + "\nDate: " + form.pickupDate.value + "\nTime: " + form.pickupTime.value);
      closeFlagDonationPopup();
    });
  }
});

//Sidebar toggle
function toggleSidebar() {
  document.querySelector(".sidebar").classList.toggle("active");
}

//Highlight main navbar
const menuItems = document.querySelectorAll(".menu-item");

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    menuItems.forEach((btn) => btn.classList.remove("active"));
    item.classList.add("active");

    if (!item.classList.contains("dropdown-btn")) {
      dropdownContainer.classList.remove("show");
      dropdownBtn.classList.remove("active");
    }
  });
});

//Highlight sub navbar
const subButtons = document.querySelectorAll(".dropdown-container button");

subButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); 

    subButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

//close sub navbar when not active
document.addEventListener("click", (e) => {
  if (!dropdownContainer.contains(e.target) && !dropdownBtn.contains(e.target)) {
    dropdownContainer.classList.remove("show");
    dropdownBtn.classList.remove("active");
  }
});
