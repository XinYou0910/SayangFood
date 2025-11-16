//
// Username hydrate
//
(() => {
  const u = localStorage.getItem("user_name");
  const el = document.getElementById("username");
  if (u && el) el.textContent = u;
})();

//
// Utility helpers
//
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[m]);
}
function normalizeText(s){
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g,' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

// ------------------------ Inventory loader + filter ------------------------

let inventoryCache = null;

async function loadInventory(){
  if (inventoryCache && Array.isArray(inventoryCache)) return inventoryCache;

  const uid = window.CURRENT_USER_ID || window.loggedUserId || 0;
  console.log('[loadInventory] CURRENT_USER_ID =', uid);
  if (!uid) return [];

  try {
    // relative to /sayangfood/
    const res  = await fetch(`api/get_inventory.php?user_id=${encodeURIComponent(uid)}&_=${Date.now()}`, {
      cache: 'no-store'
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text.trim());
    } catch (e) {
      console.error('[loadInventory] JSON parse error:', e, 'raw text:', text.slice(0,200));
      return [];
    }

    // get rows from { ok:true, rows:[...] }
    let rows = [];
    if (Array.isArray(json)) {
      rows = json;
    } else if (json && Array.isArray(json.rows)) {
      rows = json.rows;
    } else {
      console.warn('[loadInventory] unexpected payload shape:', json);
      return [];
    }

    inventoryCache = rows.map(r => ({
      item_id       : r.item_id ?? r.id ?? null,
      item_name     : r.item_name ?? r.name ?? '',
      item_category : r.item_category ?? r.category ?? '',
      quantity      : r.quantity ?? '',
      quantity_value: r.quantity_value ?? null,
      quantity_unit : r.quantity_unit ?? '',
      expiry_date   : r.expiry_date ?? null,
      item_status   : r.item_status ?? '',
      storage_place : r.storage_place ?? r.storage ?? ''
    }));

    console.log('[loadInventory] rows length =', inventoryCache.length);
    console.log('[loadInventory] sample =', inventoryCache.slice(0,8));

    return inventoryCache;

  } catch (err) {
    console.error('[loadInventory] fetch error:', err);
    return [];
  }
}

/**
 * Filter inventory by search term.
 * - case-insensitive, accent-insensitive
 * - substring (typing "i" will match Rice, Onion, etc.)
 * - only items with status "Available"
 */
async function filterInventoryForQuery(term){
  const inv = await loadInventory();
  if (!inv || inv.length === 0) return [];

  const q = normalizeText(term || '');

  return inv.filter(r => {
    // Only show available items
    if (r.item_status && r.item_status.toLowerCase() !== 'available') return false;

    if (!q) return true; // if empty query, allow everything

    const name = normalizeText(r.item_name);
    return name.includes(q);
  });
}

// ------------------------ Calendar / UI core ------------------------

(function () {
  const state = { selected: new Date() };

  const suggestionsStatic = ["Fried Rice","Fried Noodle","Fried Chicken","Steam Egg","Pan Cake","Fried Vegetable"];
  const expiring = [
    {name:"Milk", qty:"500ml", left:"3 days"},
    {name:"Eggs", qty:"12 pcs", left:"2 days"},
    {name:"Spinach", qty:"0.2kg", left:"1 day"},
    {name:"Tofu", qty:"0.5kg", left:"4 days"}
  ];

  // UI meals store (names only)
  window.demoMeals = window.demoMeals || { breakfast:[], lunch:[], dinner:[], other:[] };
  window.mealSnapshots = window.mealSnapshots || {};

  function isSameDate(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function startOfWeekMon(d){ const x=new Date(d); const dow=(x.getDay()+6)%7; x.setHours(12,0,0,0); x.setDate(x.getDate()-dow); return x; }
  function fmtMonthYear(d){ return d.toLocaleString("en-GB",{month:"long",year:"numeric"}); }
  function fmtDayHeading(d){ return d.toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}); }

  function renderStrip(){
    const monthYearEl = document.getElementById("monthYear");
    const pillsRow   = document.getElementById("pillsRow");
    if (monthYearEl) monthYearEl.textContent = fmtMonthYear(state.selected);
    const start = startOfWeekMon(state.selected);
    let html = '';
    for (let i=0;i<7;i++){
      const d = new Date(start); d.setDate(start.getDate()+i);
      html += `
        <button class="pill ${isSameDate(d,state.selected)?'active':''}" data-date="${d.toISOString()}">
          <span class="wd">${d.toLocaleString("en-GB",{weekday:"short"}).toUpperCase()}</span>
          <span class="dd">${d.getDate()}</span>
        </button>`;
    }
    if (pillsRow) pillsRow.innerHTML = html;
  }

  function renderDayTitle(){
    const t = document.getElementById("dayTitle");
    if (t) t.textContent = fmtDayHeading(state.selected);
  }

  document.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (pill && pill.dataset.date) {
      state.selected = new Date(pill.dataset.date);
      renderStrip(); renderDayTitle();
      // reload saved meals for newly selected date
      if (typeof reloadMealsForCurrentDate === 'function') reloadMealsForCurrentDate();
    }
  });

  document.getElementById("prevDay")?.addEventListener("click", ()=>{
    state.selected.setDate(state.selected.getDate()-1);
    renderStrip(); renderDayTitle();
    if (typeof reloadMealsForCurrentDate === 'function') reloadMealsForCurrentDate();
  });
  document.getElementById("nextDay")?.addEventListener("click", ()=>{
    state.selected.setDate(state.selected.getDate()+1);
    renderStrip(); renderDayTitle();
    if (typeof reloadMealsForCurrentDate === 'function') reloadMealsForCurrentDate();
  });

  (function(){
    const calBtn = document.getElementById("calendarBtn");
    const jump   = document.getElementById("jumpDate");
    if (!calBtn || !jump) return;
    calBtn.addEventListener("click", ()=>{
      try { jump.showPicker?.(); } catch(_) {}
      jump.click();
    });
    jump.addEventListener("change", ()=>{
      if (!jump.value) return;
      const [y,m,d] = jump.value.split("-").map(Number);
      state.selected = new Date(y,m-1,d);
      renderStrip(); renderDayTitle();
      if (typeof reloadMealsForCurrentDate === 'function') reloadMealsForCurrentDate();
    });
  })();

  function renderMeals(){
    ["breakfast","lunch","dinner","other"].forEach(slot=>{
      const container = document.getElementById(slot + "-list");
      if (!container) return;

      const arr = window.demoMeals[slot] || [];
      const tilesHtml = arr.map(n =>
        `<div class="meal-tile" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`
      ).join('');

      container.innerHTML = tilesHtml;

      // remove previous count classes
      container.classList.remove('count-1','count-2','count-3','count-4','count-5plus');

      const count = arr.length;
      if (count === 1) container.classList.add('count-1');
      else if (count === 2) container.classList.add('count-2');
      else if (count === 3) container.classList.add('count-3');
      else if (count === 4) container.classList.add('count-4');
      else if (count >= 5) container.classList.add('count-5plus');
    });
  }

  window.addMealToSlot = function(slot, name, meta){
    slot = slot || 'lunch';
    window.demoMeals[slot] = window.demoMeals[slot] || [];
    window.demoMeals[slot].push(name);
    if (meta && meta.ingredients) {
      const idx = window.demoMeals[slot].length - 1;
      const key = `${slot}__${idx}__${Date.now()}`;
      window.mealSnapshots[key] = { slot, index: idx, meal_name: name, ingredients: meta.ingredients };
    }
    renderMeals();
  };

  function renderExpiring(){
    const tb = document.getElementById("expiringList");
    if (!tb) return;
    tb.innerHTML = expiring.map(e =>
      `<tr><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.qty)}</td><td>${escapeHtml(e.left)}</td></tr>`
    ).join('');
  }

  async function renderSuggestions(){
    const wrap = document.getElementById("suggestionTiles");
    if (!wrap) return;
    let items = suggestionsStatic;
    try {
      const resp = await fetch(`/api/get_suggestions.php?user_id=${encodeURIComponent(window.CURRENT_USER_ID || 0)}`);
      const j    = await resp.json();
      if (j && j.ok && Array.isArray(j.suggestions)) {
        items = j.suggestions.map(s => (s.recipe_name || s));
      }
    } catch(e) {}
    const firstSix = items.slice(0,6);
    wrap.innerHTML = firstSix.map(it =>
      `<div class="suggest-btn" data-name="${escapeHtml(it)}">${escapeHtml(it)}</div>`
    ).join('');
    wrap.onclick = ev => {
      const b = ev.target.closest('.suggest-btn');
      if (!b) return;
      window.demoMeals.lunch = window.demoMeals.lunch || [];
      window.demoMeals.lunch.push(b.dataset.name);
      renderMeals();
    };
  }

  // -------------------- Load saved meals for a given date --------------------
  async function loadMealsForDate(dateObj) {
    if (!dateObj) return;
    const yyyy = dateObj.toISOString().slice(0,10); // YYYY-MM-DD
    const uid = window.CURRENT_USER_ID || 0;
    if (!uid) {
      console.warn('[loadMealsForDate] no CURRENT_USER_ID set');
      return;
    }
    try {
      console.log('[loadMealsForDate] fetching meals for', yyyy, 'user', uid);
      const resp = await fetch(`api/get_meals.php?user_id=${encodeURIComponent(uid)}&date=${encodeURIComponent(yyyy)}&_=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!resp.ok) {
        console.warn('[loadMealsForDate] server returned', resp.status);
        return;
      }
      const json = await resp.json();
      console.log('[loadMealsForDate] response', json);

      if (!json || !json.ok || !Array.isArray(json.meals)) {
        console.warn('[loadMealsForDate] unexpected payload', json);
        return;
      }

      // Reset UI meal lists for this date
      window.demoMeals = { breakfast:[], lunch:[], dinner:[], other:[] };
      window.mealSnapshots = window.mealSnapshots || {};

      json.meals.forEach((m, idx) => {
        const slotKey = (m.meal_slot || '').toLowerCase();
        const slot = slotKey.startsWith('break') ? 'breakfast'
                    : slotKey.startsWith('lunc') ? 'lunch'
                    : slotKey.startsWith('dinn') ? 'dinner' : 'other';

        window.demoMeals[slot] = window.demoMeals[slot] || [];
        window.demoMeals[slot].push(m.meal_name || 'Untitled');

        // store snapshot keyed by slot + index so we can show details later
        const key = `${slot}__${window.demoMeals[slot].length - 1}__${Date.now()}_${idx}`;
        window.mealSnapshots[key] = {
          slot,
          index: window.demoMeals[slot].length - 1,
          meal_name: m.meal_name,
          remark: m.meal_remark || '',
          ingredients: (Array.isArray(m.ingredients) ? m.ingredients.map(it => ({
            name: it.item_name_snapshot || it.item_name || '',
            qty_value: it.required_qty_value ?? it.inv_quantity_value ?? null,
            qty_unit: it.required_qty_unit || it.inv_quantity_unit || '',
            qty_text: it.required_qty_text || it.inv_quantity_text || '',
            availability: it.availability || '',
            expiry_date: it.expiry_date || null,
            storage_place: it.storage_place || null
          })) : [])
        };
      });

    } catch (err) {
      console.error('[loadMealsForDate] error', err);
    }
  }

  // helper to reload for the currently selected date in state
  async function reloadMealsForCurrentDate() {
    try {
      await loadMealsForDate(state.selected);
      renderMeals();
      attachMealTileClickHandlers && attachMealTileClickHandlers();
    } catch (e) {
      console.error('[reloadMealsForCurrentDate] error', e);
    }
  }

  function attachMealTileClickHandlers() {
    // delegate clicks to document so newly-added tiles work
    document.removeEventListener('click', _mealTileClickHandler);
    document.addEventListener('click', _mealTileClickHandler);
  }
  function _mealTileClickHandler(e) {
    const tile = e.target.closest('.meal-tile');
    if (!tile) return;
    const name = tile.dataset.name || tile.textContent.trim();
    // find the snapshot (best-effort)
    let snapshot = null;
    if (window.mealSnapshots) {
      // match by name and first found
      for (const k of Object.keys(window.mealSnapshots)) {
        const s = window.mealSnapshots[k];
        if (s && s.meal_name === name) { snapshot = s; break; }
      }
    }

    // show simple details modal (client-side)
    showMealDetailModal(name, snapshot);
  }

  function showMealDetailModal(name, snapshot) {
    // ensure there is a backdrop element (reuse addMealBackdrop if present)
    let backdrop = document.getElementById('addMealBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'addMealBackdrop';
      document.body.appendChild(backdrop);
    } else if (backdrop.parentNode !== document.body) {
      document.body.appendChild(backdrop);
    }

    // style backdrop (hidden by default elsewhere)
    Object.assign(backdrop.style, {
      display: 'block',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: '11990',
      cursor: 'default'
    });

    // create dialog panel
    let dlg = document.getElementById('mealDetailDlg');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'mealDetailDlg';
      Object.assign(dlg.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '12000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto'
      });

      dlg.innerHTML = `
        <div id="mealDetailPanel" style="width:min(900px,92%); max-height:82vh; overflow:auto; background:#fff; border-radius:10px; box-shadow:0 30px 80px rgba(0,0,0,0.28); padding:22px; position:relative; font-family:inherit; z-index:12001;">
          <button id="mealDetailClose" style="position:absolute; right:14px; top:10px; border:none; background:transparent; font-size:22px; cursor:pointer;">&times;</button>
          <h2 id="mealDetailTitle" style="margin:0 0 12px 0; color:var(--primary-green); font-family:'Noto Serif', serif;"></h2>
          <div id="mealDetailBody"></div>
        </div>
      `;
      document.body.appendChild(dlg);

      // close when click on backdrop area (dlg) but not when clicking panel
      dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDetail(); });
      dlg.querySelector('#mealDetailClose').addEventListener('click', closeDetail);
    } else {
      dlg.style.display = 'flex';
    }

    // prevent background scrolling while details open
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const panel = dlg.querySelector('#mealDetailPanel');
    const titleEl = dlg.querySelector('#mealDetailTitle');
    const body = dlg.querySelector('#mealDetailBody');
    if (!body) return;

    titleEl.textContent = name || '';

    // Build content (same as previous)
    let html = '';
    const ingredients = (snapshot && Array.isArray(snapshot.ingredients)) ? snapshot.ingredients : [];
    if (ingredients.length > 0) {
      html += `<div style="margin-bottom:12px;"><strong style="display:block;margin-bottom:8px;font-size:16px;">Ingredients</strong>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; color:#3b4a43;">
              <th style="padding:8px;border-bottom:1px solid #eee; width:40%;">Item</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:12%;">Qty</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:12%;">Unit</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:18%;">Expiry Date</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:18%;">Storage</th>
            </tr>
          </thead>
          <tbody>`;

      ingredients.forEach(it => {
        const nm = escapeHtml(it.name || it.item_name_snapshot || '');
        const qty = (it.qty_value != null && it.qty_value !== '') ? escapeHtml(String(it.qty_value)) : escapeHtml(it.qty_text || '');
        const unit = escapeHtml(it.qty_unit || it.required_qty_unit || it.inv_quantity_unit || '');
        const expiry = it.expiry_date ? escapeHtml(it.expiry_date) : '<span style="color:#9aa6b2">—</span>';
        const storage = it.storage_place ? escapeHtml(it.storage_place) : '<span style="color:#9aa6b2">—</span>';
        html += `<tr>
          <td style="padding:8px;border-bottom:1px solid #f4f4f4;">${nm}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f4;">${qty}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f4;">${unit}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f4;">${expiry}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f4;">${storage}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
    } else {
      html += '<p class="muted">No ingredient details available.</p>';
    }

    if (snapshot && snapshot.remark) {
      html += `
      <div style="margin-top:18px; padding-top:12px; border-top:1px solid #e5e7eb;">
        <strong style="display:block;margin-bottom:8px;font-size:16px;">Remark</strong>
        <p style="margin:0;color:#2e3d36;">${escapeHtml(snapshot.remark)}</p>
      </div>`;
    }

    body.innerHTML = html;

    // cleanup function
    function closeDetail() {
      // remove dialog
      const existing = document.getElementById('mealDetailDlg');
      if (existing) existing.remove();

      // hide backdrop only if add-meal modal is not open
      const addMealModal = document.getElementById('addMealModal');
      const addOpen = addMealModal && addMealModal.getAttribute('aria-hidden') === 'false' && addMealModal.style.display !== 'none';
      if (!addOpen && backdrop) {
        backdrop.style.display = 'none';
        backdrop.style.background = '';
      }

      // restore scrolling
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }


  // New DOMContentLoaded that loads existing meals for today before renderMeals
  document.addEventListener("DOMContentLoaded", async () => {
    renderStrip();
    renderDayTitle();
    // load saved meals for the selected date
    await loadMealsForDate((function(){ return (new Date()); })());
    renderSuggestions();
    renderExpiring();
    renderMeals();
    attachMealTileClickHandlers();
  });

  // also ensure we reload meals whenever the strip/date changes
  // Replace existing pill click handler area or add a call there: after you set state.selected and call renderStrip/renderDayTitle, call:
  function reloadMealsForCurrentDate() {
    loadMealsForDate(state.selected).then(()=> {
      renderMeals();
      attachMealTileClickHandlers();
    });
  }

  window.collectPlanPayload = function(){
    const payload = { user_id: window.CURRENT_USER_ID || 0, meal_date: (new Date()).toISOString().slice(0,10), meals: {} };
    ['breakfast','lunch','dinner','other'].forEach(slot=>{
      const arr = (window.demoMeals[slot] || []).map((name, i) => {
        let snapshot = null;
        if (window.mealSnapshots) {
          for (const k of Object.keys(window.mealSnapshots)) {
            const s = window.mealSnapshots[k];
            if (s && s.slot === slot && s.index === i && s.meal_name === name) {
              snapshot = s; break;
            }
          }
        }
        return { name, snapshot };
      });
      payload.meals[slot] = arr;
    });
    return payload;
  };

})();

// ------------------------ Add Meal Modal (single header + ingredient rows) ------------------------
(function(){
  const modal = document.getElementById('addMealModal');
  if (!modal) {
    console.warn('[Add Meal Modal] addMealModal not found');
    return;
  }

  let backdrop = document.getElementById('addMealBackdrop');

  // ensure backdrop lives directly under body (so modal can sit above it)
  (function ensureBackdropAndStacking(){
    const BACKDROP_Z = 11990;
    const MODAL_Z   = 12001;

    if (!backdrop) {
      // create one if missing
      backdrop = document.createElement('div');
      backdrop.id = 'addMealBackdrop';
      document.body.appendChild(backdrop);
    } else {
      // move existing node to body root to avoid being inside modal or other container
      if (backdrop.parentNode !== document.body) document.body.appendChild(backdrop);
    }

    // basic backdrop style (hidden by default)
    Object.assign(backdrop.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: String(BACKDROP_Z),
      backdropFilter: 'none',      // remove any blur applied here
      pointerEvents: 'auto'
    });

    // ensure modal is above backdrop
    Object.assign(modal.style, {
      position: modal.style.position || 'fixed',
      inset: modal.style.inset || '0',
      display: modal.style.display || 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: String(MODAL_Z)
    });

    // Ensure modal content panel (if exists) has solid background and higher stacking
    const panel = modal.querySelector('.modal-panel') || modal.querySelector('.modal-dialog') || modal;
    if (panel) {
      panel.style.background = panel.style.background || '#fff';
      panel.style.position = panel.style.position || 'relative';
      panel.style.zIndex = String(MODAL_Z + 1);
    }
  })();

  const closeBtn = document.getElementById('addMealClose');
  const form = document.getElementById('addMealForm');
  const ingredientsContainer = form?.querySelector('.grid-form-two') || null; // where ingredient rows go
  const addIngredientBtn = document.getElementById('addIngredientBtn');
  const cancelBtn = document.getElementById('addMealCancel');
  const titleEl = document.getElementById('addMealTitle');

  if (!form || !ingredientsContainer) {
    console.warn('[Add Meal Modal] form or ingredientsContainer missing');
    return;
  }

  // create a single header row (inserted once above ingredient rows)
  function ensureIngredientHeader() {
    let header = modal.querySelector('.ingredient-header');
    if (header) return header;

    header = document.createElement('div');
    header.className = 'ingredient-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    header.style.marginBottom = '8px';
    header.style.padding = '4px 2px';

    const colNum = document.createElement('div'); // empty space for badges
    colNum.style.width = '36px';
    colNum.style.flex = '0 0 36px';
    header.appendChild(colNum);

    const colName = document.createElement('div');
    colName.className = 'col-name';
    colName.textContent = 'Ingredient name';
    header.appendChild(colName);

    const colQty = document.createElement('div');
    colQty.className = 'col-qty';
    colQty.textContent = 'Quantity value';
    header.appendChild(colQty);

    const colUnit = document.createElement('div');
    colUnit.className = 'col-unit';
    colUnit.textContent = 'Unit';
    header.appendChild(colUnit);

    // insert header at top of the ingredientsContainer's parent (we want it above the rows)
    // if grid-form-two is the container itself, put header before it
    ingredientsContainer.parentNode.insertBefore(header, ingredientsContainer);
    return header;
  }

  // create a single ingredient input row (no label row)
  async function createIngredientRow(prefillName = '', preQty = '', preUnit = '') {
    // compute current index (1-based) for the badge
    const rowCount = ingredientsContainer.querySelectorAll('.ingredient-row').length + 1;

    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '8px';
    row.style.padding = '12px 0';
    row.style.borderBottom = '1px solid rgba(0,0,0,0.06)';

    // LABEL (compact) - number + optional small heading text removed (we use shared header)
    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.alignItems = 'center';
    labelRow.style.gap = '12px';

    const numberBadge = document.createElement('span');
    numberBadge.className = 'ingredient-badge';
    numberBadge.textContent = rowCount;
    Object.assign(numberBadge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: 'var(--primary-green)',
      color: '#fff',
      fontWeight: '700',
      fontSize: '13px',
      flex: '0 0 28px'
    });

    // inputRow contains: nameWrap (relative) | qty | unit | remove
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.gap = '12px';
    inputRow.style.alignItems = 'center';
    inputRow.style.width = '100%';
    inputRow.style.boxSizing = 'border-box';

    // name wrapper (relative for suggest box)
    const nameWrap = document.createElement('div');
    nameWrap.style.position = 'relative';
    nameWrap.style.flex = '1';
    nameWrap.style.minWidth = '0';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ingredient-name';
    nameInput.placeholder = 'Ingredient name';
    nameInput.value = prefillName || '';
    nameInput.style.width = '100%';
    nameInput.style.padding = '10px 14px';
    nameInput.style.borderRadius = '8px';
    nameInput.style.border = '1px solid rgba(0,0,0,0.08)';
    nameInput.style.fontSize = '14px';
    nameInput.autocomplete = 'off';

    const hiddenId = document.createElement('input');
    hiddenId.type = 'hidden';
    hiddenId.className = 'ingredient-item-id';

    const suggestBox = document.createElement('div');
    suggestBox.className = 'suggest-list';
    Object.assign(suggestBox.style, {
      position: 'absolute',
      left: '0',
      top: 'calc(100% + 6px)',
      zIndex: '12000',
      minWidth: '280px',
      maxHeight: '220px',
      overflow: 'auto',
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: '8px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      display: 'none',
      padding: '6px'
    });

    nameWrap.appendChild(nameInput);
    nameWrap.appendChild(hiddenId);
    nameWrap.appendChild(suggestBox);

    // qty input
    const qtyInput = document.createElement('input');
    qtyInput.type = 'text';
    qtyInput.placeholder = 'e.g. 2';
    qtyInput.className = 'ingredient-qty';
    qtyInput.style.width = '120px';
    qtyInput.style.padding = '10px 14px';
    qtyInput.style.borderRadius = '8px';
    qtyInput.style.border = '1px solid rgba(0,0,0,0.08)';
    qtyInput.style.fontSize = '14px';
    qtyInput.value = preQty || '';

    // unit input
    const unitInput = document.createElement('input');
    unitInput.type = 'text';
    unitInput.className = 'ingredient-unit';
    unitInput.placeholder = 'unit (g / kg / pcs)';
    unitInput.style.width = '140px';
    unitInput.style.padding = '10px 14px';
    unitInput.style.borderRadius = '8px';
    unitInput.style.border = '1px solid rgba(0,0,0,0.08)';
    unitInput.style.fontSize = '14px';
    unitInput.value = preUnit || '';

    // remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ingredient-remove';
    removeBtn.textContent = '✕';
    Object.assign(removeBtn.style, {
      border: '1px solid rgba(0,0,0,0.08)',
      background: '#fff',
      borderRadius: '6px',
      padding: '10px 8px',
      cursor: 'pointer',
      fontSize: '16px',
      flex: '0 0 40px'
    });

    // assemble inputRow
    inputRow.appendChild(nameWrap);
    inputRow.appendChild(qtyInput);
    inputRow.appendChild(unitInput);
    inputRow.appendChild(removeBtn);

    // assemble labelRow (badge + inputRow)
    labelRow.appendChild(numberBadge);
    labelRow.appendChild(inputRow);

    row.appendChild(labelRow);
    // append row to container
    ingredientsContainer.appendChild(row);

    // attach suggestion behaviour to nameInput
    let suggTimeout = null;
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      hiddenId.value = '';
      if (suggTimeout) clearTimeout(suggTimeout);
      if (!v) {
        suggestBox.style.display = 'none';
        suggestBox.innerHTML = '';
        return;
      }
      suggTimeout = setTimeout(async () => {
        const items = await filterInventoryForQuery(v);
        suggestBox.innerHTML = '';
        if (!items || items.length === 0) {
          const useRow = document.createElement('div');
          useRow.className = 'suggest-item';
          useRow.style.padding = '8px';
          useRow.style.cursor = 'pointer';
          useRow.textContent = `Use: "${v}" (not in inventory)`;
          useRow.addEventListener('click', () => {
            nameInput.value = v;
            hiddenId.value = '';
            suggestBox.style.display = 'none';
          });
          suggestBox.appendChild(useRow);
        } else {
          items.slice(0,40).forEach(it => {
            const el = document.createElement('div');
            el.className = 'suggest-item';
            el.style.padding = '8px';
            el.style.borderBottom = '1px solid rgba(0,0,0,0.03)';
            el.style.cursor = 'pointer';

            const qtyStr = (it.quantity_value != null && it.quantity_value !== '')
              ? `${it.quantity_value} ${it.quantity_unit || ''}`.trim()
              : (it.quantity || '');

            const metaParts = [];
            if (qtyStr) metaParts.push(qtyStr);
            if (it.item_status) metaParts.push(it.item_status);
            if (it.storage_place) metaParts.push(it.storage_place);

            el.innerHTML =
              `<strong>${escapeHtml(it.item_name)}</strong>` +
              (metaParts.length
                ? ` <small style="color:#666"> · ${escapeHtml(metaParts.join(' · '))}</small>`
                : '');

            el.addEventListener('click', () => {
              nameInput.value = it.item_name;
              hiddenId.value = it.item_id ?? '';

              if (it.quantity_value != null && it.quantity_value !== '') {
                qtyInput.value = it.quantity_value;
              } else if (it.quantity) {
                const m = String(it.quantity).match(/([\d.]+)/);
                if (m) qtyInput.value = m[1];
              }
              if (it.quantity_unit) {
                unitInput.value = it.quantity_unit;
              } else if (it.quantity) {
                const m2 = String(it.quantity).replace(/[\d.\s]/g,'').trim();
                if (m2) unitInput.value = m2;
              }

              suggestBox.style.display = 'none';
            });
            suggestBox.appendChild(el);
          });
        }
        suggestBox.style.display = 'block';
      }, 180);
    });

    document.addEventListener('click', ev => {
      if (!nameWrap.contains(ev.target)) suggestBox.style.display = 'none';
    });

    removeBtn.addEventListener('click', () => {
      row.remove();
      // renumber remaining badges
      Array.from(ingredientsContainer.querySelectorAll('.ingredient-row')).forEach((r, i) => {
        const b = r.querySelector('.ingredient-badge');
        if (b) b.textContent = (i + 1);
      });
    });

    return row;
  }

  // modal open/close logic
  let activeSlot = null;
  function slotLabel(slot){
    if (!slot) return 'Meal';
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  }

  function openModal(slot){
    activeSlot = slot || 'lunch';
    try { form.reset(); } catch(e){}
    // clear existing ingredient rows and ensure header
    const existingHeader = modal.querySelector('.ingredient-header');
    if (existingHeader) existingHeader.remove();
    ingredientsContainer.innerHTML = '';
    ensureIngredientHeader();
    createIngredientRow();
    if (titleEl) titleEl.textContent = `Add Meal for ${slotLabel(activeSlot)}`;

    // show dark backdrop
    if (backdrop) {
      backdrop.style.display = 'block';
      backdrop.style.position = 'fixed';
      backdrop.style.inset = '0';
      backdrop.style.background = 'rgba(0,0,0,0.45)'; // darker overlay
      backdrop.style.zIndex = '11990';
    }

    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'flex';
    modal.style.zIndex = '12000';

    // prevent background scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    activeSlot = null;
    modal.setAttribute('aria-hidden','true');
    modal.style.display = 'none';

    // hide backdrop
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.style.background = ''; // reset if needed
    }

    // restore scrolling
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // hook plus buttons in meal slots
  document.addEventListener('click', ev => {
    const b = ev.target.closest('.slot-add');
    if (!b) return;
    ev.preventDefault();
    openModal(b.dataset.slot || 'lunch');
  });

  backdrop?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', e => { e.preventDefault(); closeModal(); });

  addIngredientBtn?.addEventListener('click', e => {
    e.preventDefault();
    // ensure header exists (if not created for some reason)
    ensureIngredientHeader();
    createIngredientRow();
  });

  // submit form (same behavior as your previous code)
  form.addEventListener('submit', async ev => {
    ev.preventDefault();

    const mealNameInput = form.querySelector('input[name="meal_name"]');
    const mealName = (mealNameInput?.value || '').trim();

    if (!mealName) {
      alert('Please enter meal name');
      mealNameInput?.focus();
      return;
    }

    // collect ingredient rows
    const rows = Array.from(ingredientsContainer.querySelectorAll('.ingredient-row'));
    const ingredients = rows.map(row => {
      const nameInput = row.querySelector('.ingredient-name');
      if (!nameInput) return null;
      const idInput = row.querySelector('.ingredient-item-id');
      const qtyInput = row.querySelector('.ingredient-qty');
      const unitInput = row.querySelector('.ingredient-unit');
      return {
        name: (nameInput.value || '').trim(),
        item_id: idInput?.value || null,
        qty_value: (qtyInput?.value || '').trim(),
        qty_unit: (unitInput?.value || '').trim()
      };
    }).filter(x => x && x.name);

    const remarkInput = form.querySelector('textarea[name="meal_remark"]');
    const remark = (remarkInput?.value || '').trim();

    const payload = {
      user_id: window.CURRENT_USER_ID || 0,
      meal_date: (new Date()).toISOString().slice(0,10),
      meal_slot: activeSlot || 'lunch',
      meal_name: mealName,
      remark: remark,
      ingredients: ingredients
    };

    try {
      const resp = await fetch('api/add_meal.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();

      if (!resp.ok || !json.ok) {
        console.error('Save failed', json);
        alert('Failed to save meal: ' + (json.message || 'Unknown error'));
        return;
      }

      // reload meals for the current date from server (preferred)
      if (typeof reloadMealsForCurrentDate === 'function') {
        await loadMealsForDate(new Date()); // ensure current date is reloaded
        renderMeals();
        attachMealTileClickHandlers();
      } else {
        // fallback local update
        window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
        window.demoMeals[activeSlot].push(mealName);
        if (typeof window.renderMeals === 'function') window.renderMeals();
      }

      // clear cache if any
      if (typeof inventoryCache !== 'undefined') inventoryCache = null;
      closeModal();
      alert('Meal saved successfully!');
      console.log('[Add Meal] saved:', json);

    } catch (err) {
      console.error('[Add Meal] error:', err);
      alert('Unable to reach server. Check console for details.');
    }
  });

  // ESC to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

})(); // end modal IIFE
  // end modal IIFE