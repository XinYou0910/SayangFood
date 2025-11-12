// Username hydrate
(() => {
  const u = localStorage.getItem("user_name");
  const el = document.getElementById("username");
  if (u && el) el.textContent = u;
})();

(function () {
  const $ = (s) => document.querySelector(s);

  // Ensure dropdown parent becomes active and the correct submenu is highlighted
  document.addEventListener("DOMContentLoaded", () => {
    const page = location.pathname.split("/").pop().toLowerCase();
    // mark the dropdown parent button active (turns green via .menu-item.active)
    if (/inventory|meal_plan|donation/.test(page)) {
      document.querySelector(".dropdown-btn")?.classList.add("active");
    }
    // highlight submenu matching current file name
    document.querySelectorAll(".submenu-item").forEach((el) => {
      const href = (el.getAttribute("onclick") || "").toLowerCase();
      if (href.includes(page)) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  });

  const state = { selected: new Date() };

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
    monthYearEl.textContent = fmtMonthYear(state.selected);

    const start = startOfWeekMon(state.selected);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    const pillHTML = (d) => `
      <button class="pill ${isSameDate(d, state.selected) ? "active" : ""}" data-date="${d.toISOString()}">
        <span class="wd">${d.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}</span>
        <span class="dd">${d.getDate()}</span>
      </button>`;

    // Build: [📅] [‹] [Mon..Sun] [›] (prev arrow already in DOM)
    let html = "";
    for (let i = 0; i < 7; i++) html += pillHTML(days[i]); // Mon..Sun
    html += `<button class="nav-arrow" id="inlineNext" aria-label="Next day">›</button>`;

    pillsRow.innerHTML = html;

    // inline next
    document.getElementById("inlineNext")?.addEventListener("click", () => {
      state.selected.setDate(state.selected.getDate() + 1);
      renderStrip();
      renderDayTitle();
    });
  }

  function renderDayTitle() {
    const t = document.getElementById("dayTitle");
    t.textContent = fmtDayHeading(state.selected);
  }

  // Click a pill to select date
  document.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (pill && pill.dataset.date) {
      state.selected = new Date(pill.dataset.date);
      renderStrip();
      renderDayTitle();
    }
  });

  // Left arrow at the bar
  document.getElementById("prevDay")?.addEventListener("click", () => {
    state.selected.setDate(state.selected.getDate() - 1);
    renderStrip();
    renderDayTitle();
  });

  // Calendar picker next to ‹
  const calBtn = document.getElementById("calendarBtn");
  const jump = document.getElementById("jumpDate");
  if (calBtn && jump) {
    calBtn.addEventListener("click", () => {
      try { jump.showPicker?.(); } catch(_) {}
      jump.click();
    });
    jump.addEventListener("change", () => {
      if (!jump.value) return;
      const [y, m, d] = jump.value.split("-").map(Number);
      state.selected = new Date(y, m - 1, d);
      renderStrip(); renderDayTitle();
    });
  }

  // Quick chips -> append bullets inside boxes
  function appendToSlot(slotId, text) {
    const el = document.getElementById(`slot-${slotId}`);
    if (!el) return;
    const sep = el.textContent.trim() ? "\n" : "";
    el.textContent = el.textContent + sep + text;
    el.focus();
  }
  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => appendToSlot(c.dataset.add, "• "));
  });

  // init
  document.addEventListener("DOMContentLoaded", () => {
    renderStrip();
    renderDayTitle();
  });
})();

// Save demo
document.getElementById("saveBtn")?.addEventListener("click", () => {
  const payload = {
    dateText: document.getElementById("dayTitle")?.textContent || "",
    breakfast: document.getElementById("slot-breakfast")?.textContent.trim() || "",
    lunch:     document.getElementById("slot-lunch")?.textContent.trim() || "",
    dinner:    document.getElementById("slot-dinner")?.textContent.trim() || "",
    other:     document.getElementById("slot-other")?.textContent.trim() || "",
  };
  console.log("Save Meal Plan:", payload);
  alert("Meal plan saved (demo). Connect this to your backend endpoint.");
});
