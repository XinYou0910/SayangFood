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

  // rebuild dropdown
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

  // ✅ Add user’s custom text as a new option and select it
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

  // rebuild dropdown
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

  // ✅ Add custom option
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("storagePlace");
    const newOption = document.createElement("option");
    newOption.value = customValue.trim();
    newOption.textContent = customValue.trim();
    select.appendChild(newOption);
    select.value = customValue.trim();
  }
}