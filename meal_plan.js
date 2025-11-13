// Username hydrate
(() => {
  const u = localStorage.getItem("user_name");
  const el = document.getElementById("username");
  if (u && el) el.textContent = u;
})();

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = { selected: new Date() };

  // track last-targeted slot for suggestions (default 'lunch')
  let lastTargetSlot = "lunch";

  const isSameDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const startOfWeekMon = (d) => {
    const x = new Date(d);
    const dow = (x.getDay() + 6) % 7; // Monday=0
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() - dow);
    return x;
  };

  const fmtMonthYear = (d) =>
    d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const fmtDayHeading = (d) =>
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  function renderStrip() {
    const monthYearEl = $("#monthYear");
    const pillsRow = $("#pillsRow");
    if (monthYearEl) monthYearEl.textContent = fmtMonthYear(state.selected);

    const start = startOfWeekMon(state.selected);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    const pillHTML = (d) => ` 
      <button class="pill ${isSameDate(d,state.selected) ? 'active' : ''}" data-date="${d.toISOString()}">
        <span class="wd">${d.toLocaleString("en-GB",{weekday:"short"}).toUpperCase()}</span>
        <span class="dd">${d.getDate()}</span>
      </button>`;

    let html = "";
    for (let i = 0; i < 7; i++) html += pillHTML(days[i]);
    if (pillsRow) pillsRow.innerHTML = html;
  }

  function renderDayTitle() {
    const t = document.getElementById("dayTitle");
    if (t) t.textContent = fmtDayHeading(state.selected);
  }

  // click pill
  document.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (pill && pill.dataset.date) {
      state.selected = new Date(pill.dataset.date);
      renderStrip(); renderDayTitle();
    }
  });

  // arrows
  document.getElementById("prevDay")?.addEventListener("click", () => {
    state.selected.setDate(state.selected.getDate() - 1);
    renderStrip(); renderDayTitle();
  });
  document.getElementById("nextDay")?.addEventListener("click", () => {
    state.selected.setDate(state.selected.getDate() + 1);
    renderStrip(); renderDayTitle();
  });

  // calendar
  const calBtn = document.getElementById("calendarBtn");
  const jump = document.getElementById("jumpDate");
  if (calBtn && jump) {
    calBtn.addEventListener("click", () => {
      try { jump.showPicker?.(); } catch(_) {}
      jump.click();
    });
    jump.addEventListener("change", () => {
      if (!jump.value) return;
      const [y,m,d] = jump.value.split("-").map(Number);
      state.selected = new Date(y,m-1,d);
      renderStrip(); renderDayTitle();
    });
  }

  // demo data (you'll replace this with backend)
  const suggestions = ["Fried Rice","Fried Noodle","Fried Chicken","Steam Egg","Pan Cake","Fried Vegetable","Sambal","Roti Canai","Nasi Lemak","Mee Goreng","Fish Curry","Stir Fry Veg","Tofu Curry","Porridge"];
  const expiring = [
    {name:"Milk", qty:"500ml", left:"3 days"},
    {name:"Eggs", qty:"12 pcs", left:"2 days"},
    {name:"Spinach", qty:"0.2kg", left:"1 day"},
    {name:"Tofu", qty:"0.5kg", left:"4 days"}
  ];

  // demo meal store
  const demoMeals = {
    breakfast: ["Cereal","Milk"],
    lunch: ["Fried Rice"],
    dinner: ["Salad","Chicken Soup"],
    other: []
  };

  function renderSuggestions() {
    const wrap = document.getElementById("suggestionTiles");
    if (!wrap) return;
    // show first up-to-6 suggestions inside the card
    const firstSix = suggestions.slice(0,6);
    wrap.innerHTML = firstSix.map(s => `<div class="suggest-btn" data-name="${s}">${s}</div>`).join("");

    // clicking suggestion in the card adds to lastTargetSlot (or lunch default)
    wrap.addEventListener("click", (ev)=>{
      const b = ev.target.closest(".suggest-btn");
      if (!b) return;
      addMealToSlot(lastTargetSlot || "lunch", b.dataset.name);
    });
  }

  function renderExpiring() {
    const tb = document.getElementById("expiringList");
    if (!tb) return;
    tb.innerHTML = expiring.map(e=>`<tr><td>${e.name}</td><td>${e.qty}</td><td>${e.left}</td></tr>`).join("");
  }

  // render meal tiles into each slot
  function renderMeals() {
    ["breakfast","lunch","dinner","other"].forEach(slot=>{
      const container = document.getElementById(slot+"-list");
      if (!container) return;
      const tiles = (demoMeals[slot]||[]).map(m => `<div class="meal-tile">${escapeHtml(m)}</div>`).join("");
      container.innerHTML = tiles;
    });
  }

  // helper: escape minimal HTML
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }

  // add meal
  function addMealToSlot(slot, name="New Item"){
    demoMeals[slot] = demoMeals[slot] || [];
    demoMeals[slot].push(name);
    renderMeals();
    // optionally scroll to show new tile
    const cont = document.getElementById(slot+"-list");
    if (cont) cont.scrollTop = cont.scrollHeight;
  }

  // wire + buttons (delegated) — also set lastTargetSlot when user clicks add
  document.addEventListener("click", (e)=>{
    const addBtn = e.target.closest(".slot-add");
    if (addBtn) {
      const slot = addBtn.dataset.slot;
      lastTargetSlot = slot || lastTargetSlot;
      addMealToSlot(slot, "New Item");
      return;
    }
    // clicking a suggestion tile inside the suggestions-card handled in renderSuggestions
  });

  /* ---------- Modal: open / close / populate ---------- */
  const moreBtn = document.getElementById("moreSuggestionsBtn");
  const modal = document.getElementById("suggestionsModal");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalCloseFooter = document.getElementById("modalCloseFooter");
  const allList = document.getElementById("allSuggestionsList");

  function openModal(){
    if (!modal) return;
    modal.setAttribute("aria-hidden","false");
    // populate list
    if (allList) {
      allList.innerHTML = suggestions.map(s => `<div class="all-suggestion" data-name="${s}">${escapeHtml(s)}</div>`).join("");
    }
    // focus for accessibility
    closeModalBtn?.focus();
  }

  function closeModal(){
    if (!modal) return;
    modal.setAttribute("aria-hidden","true");
  }

  // open when clicking dots
  moreBtn?.addEventListener("click", ()=>{
    openModal();
  });

  // click backdrop or close buttons to close
  modalBackdrop?.addEventListener("click", closeModal);
  closeModalBtn?.addEventListener("click", closeModal);
  modalCloseFooter?.addEventListener("click", closeModal);

  // delegate clicks inside modal: clicking suggestion adds to lastTargetSlot and closes modal
  allList?.addEventListener("click", (ev)=>{
    const t = ev.target.closest(".all-suggestion");
    if (!t) return;
    const name = t.dataset.name;
    addMealToSlot(lastTargetSlot || "lunch", name);
    closeModal();
  });

  // keyboard: Esc to close modal
  document.addEventListener("keydown", (ev)=>{
    if (ev.key === "Escape") {
      const hidden = modal?.getAttribute("aria-hidden");
      if (hidden === "false") closeModal();
    }
  });

  // Save handler removed earlier — no save

  // Initial render on DOM ready
  document.addEventListener("DOMContentLoaded", ()=>{
    renderStrip();
    renderDayTitle();
    renderSuggestions();
    renderExpiring();
    renderMeals();
  });

})();
