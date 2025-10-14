// ----------------------
// GLOBAL EDITING SECTION
// ----------------------
let editing = false;

// Convert text cell into input/select depending on field type
function cellToInput(td) {
  const field = td.getAttribute("data-field");
  const val = td.textContent.trim();
  let html = "";

  if (field === "date") {
    html = `<input type="date" value="${val}">`;
  } else if (field === "slot") {
    const opts = ["Breakfast", "Lunch", "Dinner"]
      .map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`)
      .join("");
    html = `<select>${opts}</select>`;
  } else {
    html = `<input type="text" value="${val}" placeholder="${placeholderFor(field)}">`;
  }
  td.innerHTML = html;
}

// Convert input/select back into plain text
function inputToCell(td) {
  const input = td.querySelector("input,select");
  const val = input ? input.value.trim() : "";
  td.textContent = val;
}

// Placeholders for inputs
function placeholderFor(field) {
  return (
    {
      meal: "Meal name…",
      item: "Item name…",
      qty: "Qty",
      remark: "Remark",
    }[field] || ""
  );
}

// Toggle edit mode for weekly meal table
function toggleEdit(enable) {
  editing = enable;
  const body = document.getElementById("weekBody");
  const tds = body.querySelectorAll("td[data-field]");

  if (editing) {
    tds.forEach((td) => cellToInput(td));
    document.getElementById("editBtn").disabled = true;
  } else {
    tds.forEach((td) => inputToCell(td));
    document.getElementById("editBtn").disabled = false;
  }
}

// Accept suggestion → insert into weekly plan
function acceptSuggestion() {
  const s = document.querySelector("#suggestRow").children;
  const rowData = {
    date: s[0].textContent.trim(),
    slot: s[1].textContent.trim(),
    meal: s[2].textContent.trim(),
    item: s[3].textContent.trim(),
    qty: s[4].textContent.trim(),
    remark: s[5].textContent.trim(),
    status: "Accepted",
  };
  appendWeekRow(rowData);
  document.getElementById("suggestRow").style.opacity = 0.45;
}

// Reject suggestion → mark visually
function rejectSuggestion() {
  const chip = document.querySelector("#suggestRow .status");
  chip.className = "status";
  chip.textContent = "Rejected";
  document.getElementById("suggestRow").style.opacity = 0.35;
}

// Append a new row into the weekly table
function appendWeekRow(data) {
  const body = document.getElementById("weekBody");
  const tr = document.createElement("tr");

  function tdField(name, value) {
    const td = document.createElement("td");
    td.setAttribute("data-field", name);
    td.textContent = value || "";
    if (editing) cellToInput(td);
    return td;
  }

  tr.appendChild(tdField("date", data.date));
  tr.appendChild(tdField("slot", data.slot));
  tr.appendChild(tdField("meal", data.meal));
  tr.appendChild(tdField("item", data.item));
  tr.appendChild(tdField("qty", data.qty));
  tr.appendChild(tdField("remark", data.remark));

  const statusTd = document.createElement("td");
  if (data.status) {
    statusTd.innerHTML = `<span class="status ok">${data.status}</span>`;
  }
  tr.appendChild(statusTd);

  body.appendChild(tr);
}

// ----------------------
// POPUP FORM SECTION
// ----------------------

// Open popup
function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}

// Close popup
function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}

// ----------------------
// CATEGORY DROPDOWN INLINE SWITCH
// ----------------------
function switchCategoryInput() {
  const wrapper = document.getElementById("categoryWrapper");
  const select = document.getElementById("category");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="item_category" id="categoryInput"
            placeholder="Enter custom category" required
            onblur="restoreCategoryDropdown(this.value)">
    `;
    const input = document.getElementById("categoryInput");
    input.focus();
  }
}

function restoreCategoryDropdown(customValue) {
  const wrapper = document.getElementById("categoryWrapper");
  wrapper.innerHTML = `
    <select name="item_category" id="category" onchange="switchCategoryInput()" required>
      <option value="">-- Select Category --</option>
      <option value="Meat">Meat</option>
      <option value="Vegetable">Vegetable</option>
      <option value="Seafood">Seafood</option>
      <option value="Dairy">Dairy</option>
      <option value="Grains">Grains</option>
      <option value="Beverage">Beverage</option>
      <option value="Snacks">Snacks</option>
      <option value="Condiment">Condiment</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("category");
    const newOption = document.createElement("option");
    newOption.value = customValue.trim();
    newOption.textContent = customValue.trim();
    select.appendChild(newOption);
    select.value = customValue.trim();
  }
}

// ----------------------
// STORAGE DROPDOWN INLINE SWITCH
// ----------------------
function switchStorageInput() {
  const wrapper = document.getElementById("storageWrapper");
  const select = document.getElementById("storagePlace");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="storage_place" id="storageInput"
            placeholder="Enter custom storage place" required
            onblur="restoreStorageDropdown(this.value)">
    `;
    const input = document.getElementById("storageInput");
    input.focus();
  }
}

function restoreStorageDropdown(customValue) {
  const wrapper = document.getElementById("storageWrapper");
  wrapper.innerHTML = `
    <select name="storage_place" id="storagePlace" onchange="switchStorageInput()" required>
      <option value="">-- Select Storage Place --</option>
      <option value="Refrigerator">Refrigerator</option>
      <option value="Freezer">Freezer</option>
      <option value="Pantry">Pantry</option>
      <option value="Cabinet">Cabinet</option>
      <option value="Storage Box">Storage Box</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("storagePlace");
    const newOption = document.createElement("option");
    newOption.value = customValue.trim();
    newOption.textContent = customValue.trim();
    select.appendChild(newOption);
    select.value = customValue.trim();
  }
}

// ----------------------
// UNIT DROPDOWN INLINE SWITCH (for Quantity)
// ----------------------
function switchUnitInput() {
  const wrapper = document.getElementById("unitWrapper");
  const select = document.getElementById("quantityUnit");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="quantityUnit" id="quantityUnitInput"
             placeholder="Enter custom unit (e.g. bottle)" required
             onblur="restoreUnitDropdown(this.value)">
    `;
    document.getElementById("quantityUnitInput").focus();
  }
}

function restoreUnitDropdown(customValue) {
  const wrapper = document.getElementById("unitWrapper");
  wrapper.innerHTML = `
    <select id="quantityUnit" name="quantityUnit" onchange="switchUnitInput()" required>
      <option value="">-- Select Unit --</option>
      <option value="pcs">pcs</option>
      <option value="packs">packs</option>
      <option value="kg">kg</option>
      <option value="g">g</option>
      <option value="litres">litres</option>
      <option value="ml">ml</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("quantityUnit");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

// ----------------------
// BROWSE FOOD DROPDOWN (NEW VERSION)
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  const dropdownBtn =
    document.getElementById("browseToggle") ||
    document.querySelector(".dropdown-btn");
  const dropdownMenu =
    document.getElementById("dropdownMenu") ||
    document.querySelector(".dropdown-container");
  const arrow =
    document.getElementById("arrowIcon") ||
    (dropdownBtn ? dropdownBtn.querySelector(".arrow") : null);

  if (!dropdownBtn || !dropdownMenu) return;

  // Toggle open/close
  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
    if (arrow) arrow.classList.toggle("open");
  });

  // ✅ Close when clicking a submenu
  dropdownMenu.addEventListener("click", (e) => {
    const clickedItem = e.target.closest("button, a");
    if (!clickedItem) return;
    dropdownMenu.classList.remove("show");
    if (arrow) arrow.classList.remove("open");
  });

  // ✅ Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
      dropdownMenu.classList.remove("show");
      if (arrow) arrow.classList.remove("open");
    }
  });

  // ✅ Highlight current active submenu
  const currentPage = window.location.pathname.split("/").pop();
  document.querySelectorAll(".submenu-item").forEach((item) => {
    if (item.dataset.page === currentPage) item.classList.add("active");
  });
});

function changeQty(change) {
  const input = document.getElementById('quantityValue');
  let current = parseInt(input.value) || 0;
  current = Math.max(1, current + change); // prevent going below 1
  input.value = current;
}

function openEditPopup(item) {
  document.getElementById("editId").value = item.item_id;
  document.getElementById("editItemName").textContent = item.item_name;
  document.getElementById("editItemNameInput").value = item.item_name;

  // ✅ Split quantity value and unit
  const quantityParts = (item.quantity || "").split(" ");
  const quantityNumber = quantityParts[0] || "";
  const quantityUnit = quantityParts[1] || "";

  document.getElementById("editQuantityValue").value = quantityNumber;
  document.getElementById("editQuantityUnit").value = quantityUnit;

  document.getElementById("editExpiryDate").value = item.expiry_date;
  document.getElementById("editCategory").value = item.item_category;
  document.getElementById("editStorage").value = item.storage_place;
  document.getElementById("editRemark").value = item.item_remark;
  document.getElementById("editStatus").value =
    ["Available", "Used"].includes(item.item_status?.trim())
      ? item.item_status
      : "Available";

  document.getElementById("editPopup").style.display = "flex";
}

function closeEditPopup() {
  document.getElementById("editPopup").style.display = "none";
}

// ------- CATEGORY: Inline "Other" switch -------
function switchEditCategoryInput() {
  const wrapper = document.getElementById("editCategoryWrapper");
  const select = document.getElementById("editCategory");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="item_category" id="editCategoryInput"
             placeholder="Enter custom category" required
             onblur="restoreEditCategoryDropdown(this.value)">
    `;
    document.getElementById("editCategoryInput").focus();
  }
}

function restoreEditCategoryDropdown(customValue) {
  const wrapper = document.getElementById("editCategoryWrapper");
  wrapper.innerHTML = `
    <select name="item_category" id="editCategory" onchange="switchEditCategoryInput()" required>
      <option value="">-- Select Category --</option>
      <option value="Meat">Meat</option>
      <option value="Vegetable">Vegetable</option>
      <option value="Seafood">Seafood</option>
      <option value="Dairy">Dairy</option>
      <option value="Grains">Grains</option>
      <option value="Beverage">Beverage</option>
      <option value="Snacks">Snacks</option>
      <option value="Condiment">Condiment</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("editCategory");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

// ------- STORAGE: Inline "Other" switch -------
function switchEditStorageInput() {
  const wrapper = document.getElementById("editStorageWrapper");
  const select = document.getElementById("editStorage");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="storage_place" id="editStorageInput"
             placeholder="Enter custom storage place" required
             onblur="restoreEditStorageDropdown(this.value)">
    `;
    document.getElementById("editStorageInput").focus();
  }
}

function restoreEditStorageDropdown(customValue) {
  const wrapper = document.getElementById("editStorageWrapper");
  wrapper.innerHTML = `
    <select name="storage_place" id="editStorage" onchange="switchEditStorageInput()" required>
      <option value="">-- Select Storage Place --</option>
      <option value="Refrigerator">Refrigerator</option>
      <option value="Freezer">Freezer</option>
      <option value="Pantry">Pantry</option>
      <option value="Cabinet">Cabinet</option>
      <option value="Storage Box">Storage Box</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("editStorage");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

// ------- UNIT: Inline "Other" switch (for Edit Popup) -------
function switchEditUnitInput() {
  const wrapper = document.getElementById("editUnitWrapper");
  const select = document.getElementById("editQuantityUnit");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="quantityUnit" id="editQuantityUnitInput"
             placeholder="Enter custom unit (e.g. bottle)" required
             onblur="restoreEditUnitDropdown(this.value)">
    `;
    document.getElementById("editQuantityUnitInput").focus();
  }
}

function restoreEditUnitDropdown(customValue) {
  const wrapper = document.getElementById("editUnitWrapper");
  wrapper.innerHTML = `
    <select id="editQuantityUnit" name="quantityUnit" onchange="switchEditUnitInput()" required>
      <option value="">-- Select Unit --</option>
      <option value="pcs">pcs</option>
      <option value="packs">packs</option>
      <option value="kg">kg</option>
      <option value="g">g</option>
      <option value="litres">litres</option>
      <option value="ml">ml</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("editQuantityUnit");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

function openDonatePopup(item) {
  const status = item.item_status?.trim().toLowerCase();

  if (status === "used" || status === "expired" || status === "planned for meal") {
    Swal.fire({
      icon: "warning",
      title: "Cannot Donate",
      text: `This item cannot be donated because it is marked as "${item.item_status}".`,
      confirmButtonColor: "#4a7c59",
      confirmButtonText: "OK"
    });
    return; // Stop further execution
  }

  // Proceed with donation if Available
  document.getElementById("donateItemId").value = item.item_id;
  document.getElementById("donateItemName").textContent = item.item_name;
  document.getElementById("donateQuantity").textContent = item.quantity;
  document.getElementById("donateExpiry").textContent = item.expiry_date;
  document.getElementById("donatePopup").style.display = "flex";
}

function closeDonatePopup() {
  document.getElementById("donatePopup").style.display = "none";
}

function toggleDropdown() {
  const dropdown = document.getElementById("dropdownMenu");
  const arrow = document.getElementById("arrowIcon");

  if (dropdown.style.display === "flex") {
    dropdown.style.display = "none";
    arrow.style.transform = "rotate(0deg)";
  } else {
    dropdown.style.display = "flex";
    arrow.style.transform = "rotate(180deg)";
  }
}

function showCannotDonateMessage() {
  Swal.fire({
    icon: "warning",
    title: "Donation Not Allowed",
    text: "This item cannot be donated because it is marked as 'Used' or 'Expired'.",
    confirmButtonColor: "#4a7c59",
    confirmButtonText: "OK"
  });
}

// --- Open the View Popup ---
function openViewPopup(item) {
  // Fill all fields
  document.getElementById("viewItemName").textContent = item.item_name;
  const [qty, unit] = (item.quantity || "").split(" ");
  document.getElementById("viewQuantity").value = qty || "";
  document.getElementById("viewUnit").value = unit || "";
  document.getElementById("viewExpiryDate").value = item.expiry_date;
  document.getElementById("viewCategory").value = item.item_category;
  document.getElementById("viewStorage").value = item.storage_place;
  document.getElementById("viewRemark").value = item.item_remark;
  document.getElementById("viewStatus").value = item.item_status;

  // Disable Donate if expired or planned for meal
  const donateBtn = document.getElementById("viewDonateBtn");
  const status = item.item_status.toLowerCase();
  if (status === "expired" || status === "planned for meal") {
    donateBtn.classList.add("disabled");
    donateBtn.disabled = true;
  } else {
    donateBtn.classList.remove("disabled");
    donateBtn.disabled = false;
  }

  window.currentViewItem = item; // keep global reference
  document.getElementById("viewPopup").style.display = "flex";
}

function closeViewPopup() {
  document.getElementById("viewPopup").style.display = "none";
}

// --- Toggle Meal Status ---
function toggleMealStatus() {
  const item = window.currentViewItem;
  if (!item) return;

  const statusInput = document.getElementById("viewStatus");
  const mealBtn = document.getElementById("viewMealBtn");

  if (item.item_status.toLowerCase() === "planned for meal") {
    const today = new Date();
    const expiry = new Date(item.expiry_date);
    item.item_status = expiry < today ? "Expired" : "Available";
    mealBtn.classList.remove("active");
  } else {
    item.item_status = "Planned for Meal";
    mealBtn.classList.add("active");
  }

  statusInput.value = item.item_status;

  // Save to DB (async update)
  fetch("update_status.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `item_id=${item.item_id}&item_status=${encodeURIComponent(item.item_status)}`
  });

  Swal.fire({
    icon: "success",
    title: "Status Updated!",
    text: `Item marked as "${item.item_status}"`,
    timer: 1500,
    showConfirmButton: false
  });
}

// --- Confirm Donation ---
function confirmDonation() {
  const item = window.currentViewItem;
  if (!item) return;

  Swal.fire({
    title: "Confirm Donation?",
    text: `This item "${item.item_name}" will be moved to donation list.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#e67e22",
    cancelButtonColor: "#7f8c8d",
    confirmButtonText: "Yes, donate it"
  }).then((result) => {
    if (result.isConfirmed) {
      // ✅ Create a hidden POST form and submit it
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "donate_food.php";

      const idInput = document.createElement("input");
      idInput.type = "hidden";
      idInput.name = "item_id";
      idInput.value = item.item_id;
      form.appendChild(idInput);

      const pickupInput = document.createElement("input");
      pickupInput.type = "hidden";
      pickupInput.name = "pickup_location";
      pickupInput.value = "User Home"; // or set dynamically
      form.appendChild(pickupInput);

      const remarkInput = document.createElement("input");
      remarkInput.type = "hidden";
      remarkInput.name = "donation_remark";
      remarkInput.value = "Donated via system";
      form.appendChild(remarkInput);

      document.body.appendChild(form);
      form.submit();
    }
  });
}

// --- Open Edit Popup from View ---
function openEditFromView() {
  closeViewPopup();
  if (window.currentViewItem) {
    openEditPopup(window.currentViewItem);
  }
}

function closePopup() {
  document.getElementById('popupForm').style.display = 'none';
}

function openFilterPopup() {
  document.getElementById('filterPopup').style.display = 'block';
}
function closeFilterPopup() {
  document.getElementById('filterPopup').style.display = 'none';
}

function openSortPopup() {
  document.getElementById('sortPopup').style.display = 'block';
}
function closeSortPopup() {
  document.getElementById('sortPopup').style.display = 'none';
}
