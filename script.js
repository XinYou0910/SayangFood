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
  const field = td.getAttribute("data-field");
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

// Toggle edit mode
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
  const addRow = document.getElementById("addRow");
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

  // Insert above the Add Meal button row
  bod

function openPopup() {
  document.getElementById("popupForm").style.display = "flex";
}

function closePopup() {
  document.getElementById("popupForm").style.display = "none";
}
