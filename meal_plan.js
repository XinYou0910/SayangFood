//
// Username hydrate
//
(() => {
  const u = localStorage.getItem("user_name");
  const el = document.getElementById("username");
  if (u && el) el.textContent = u;
})();

function formatLocalDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

function normalizeUnit(u) {
  if (!u) return '';
  return String(u).toLowerCase().trim().replace(/\./g,'');
}

function convertToBase(value, unit) {
  const u = normalizeUnit(unit);
  if (value == null || value === '' || isNaN(Number(value))) return { value: null, kind: 'unknown' };
  const v = Number(value);

  // Mass units -> grams
  const massUnits = {
    'g': 1,
    'gram': 1,
    'grams': 1,
    'kg': 1000,
    'kilogram': 1000,
    'kilograms': 1000,
    'mg': 0.001
  };
  for (const key of Object.keys(massUnits)) {
    if (u === key || u === key + 's' || u === (key + '/g')) {
      return { value: v * massUnits[key], kind: 'mass' };
    }
  }
  // sometimes unit stored as 'g' or 'kg' inside longer string like 'g (packet)'
  for (const key of Object.keys(massUnits)) {
    if (u.includes(key)) return { value: v * massUnits[key], kind: 'mass' };
  }

  // Volume units -> milliliters
  const volUnits = {
    'ml': 1,
    'milliliter': 1,
    'milliliters': 1,
    'l': 1000,
    'liter': 1000,
    'litre': 1000,
    'liters': 1000,
    'litres': 1000
  };
  for (const key of Object.keys(volUnits)) {
    if (u === key || u === key + 's') return { value: v * volUnits[key], kind: 'volume' };
  }
  for (const key of Object.keys(volUnits)) {
    if (u.includes(key)) return { value: v * volUnits[key], kind: 'volume' };
  }

  // pieces / pcs / unitless counts
  const pieceKeys = ['pcs','pc','piece','pieces','unit','units'];
  if (pieceKeys.includes(u) || pieceKeys.some(k => u.includes(k))) return { value: v, kind: 'pieces' };

  // unknown unit: return raw number
  return { value: v, kind: 'unknown' };
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

  // === UPDATED renderMeals: builds tiles without inline styles,
  // sets count-* classes and toggles .slot.filled / .slot.empty ===
  function renderMeals(){
    ["breakfast","lunch","dinner","other"].forEach(slot=>{
      const container = document.getElementById(slot + "-list");
      if (!container) {
        console.warn(`[renderMeals] container #${slot}-list not found`);
        return;
      }

      // Ensure container has the meal-row base class used by CSS placement rules
      container.classList.add('meal-row');

      const arr = (window.demoMeals[slot] || []);

      // create tiles HTML using classes (no inline styles)
      const tilesHtml = arr.map((n, idx) =>
        `<div class="meal-tile" tabindex="0" role="button" data-slot="${slot}" data-index="${idx}" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`
      ).join('');

      container.innerHTML = tilesHtml || '';

      // remove any previous count classes and add the correct one
      container.classList.remove('count-1','count-2','count-3','count-4','count-5plus');
      const count = arr.length;
      if (count === 1) container.classList.add('count-1');
      else if (count === 2) container.classList.add('count-2');
      else if (count === 3) container.classList.add('count-3');
      else if (count === 4) container.classList.add('count-4');
      else if (count >= 5) container.classList.add('count-5plus');

      // update slot visual state (filled vs empty): toggle filled / empty classes
      const slotCard = container.closest('.slot');
      if (slotCard) {
        if (count > 0) {
          slotCard.classList.add('filled');
          slotCard.classList.remove('empty');
        } else {
          slotCard.classList.add('empty');
          slotCard.classList.remove('filled');
        }
      }
    });
  }

  // === end renderMeals ===

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

  // ----------------- UPDATED renderSuggestions & recipe modal flow -----------------
  async function renderSuggestions(){
    const wrap = document.getElementById("suggestionTiles");
    if (!wrap) return;

    let items = [];

    try {
      const uid = window.CURRENT_USER_ID || 0;
      const resp = await fetch(`api/get_suggestions.php?user_id=${encodeURIComponent(uid)}&_=${Date.now()}`, { cache:'no-store' });
      if (resp.ok) {
        const j = await resp.json();
        if (j && j.ok && Array.isArray(j.suggestions)) items = j.suggestions;
        else if (Array.isArray(j)) items = j;
      } else {
        console.warn('[renderSuggestions] server returned', resp.status);
      }
    } catch (e) {
      console.error('[renderSuggestions] fetch error', e);
    }

    // fallback static tiles if server returns nothing
    if (!items || items.length === 0) {
      const fallback = ["Fried Rice","Fried Noodle","Fried Chicken","Steam Egg","Pan Cake","Fried Vegetable"];
      wrap.innerHTML = fallback.map(n => `<div class="suggest-btn pending" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`).join('');
      // resolve availability quickly as 'available' (fallback)
      wrap.querySelectorAll('.suggest-btn').forEach(btn=>{
        btn.classList.remove('pending');
        btn.classList.add('available');
        btn.addEventListener('click', () => fetchAndShowRecipeByName(btn.dataset.name));
      });
      return;
    }

    // Build placeholder tiles (we'll enrich them asynchronously)
    wrap.innerHTML = items.slice(0,6).map(it =>
      `<div class="suggest-btn pending" data-recipe-id="${escapeHtml(String(it.recipe_id))}" data-name="${escapeHtml(it.recipe_name)}">${escapeHtml(it.recipe_name)}</div>`
    ).join('');

    // For each tile: fetch recipe details, compute availability, then update class/style
    const inv = await loadInventory().catch(()=>[]);
    const tiles = Array.from(wrap.querySelectorAll('.suggest-btn'));

    // helper to check recipe availability given recipe.ingredients and inventory
    function checkRecipeAvailable(ings, inventory) {
      if (!Array.isArray(ings) || ings.length === 0) return true; // no ingredients => treat as available
      function normalize(s){ return (s||'').toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

      for (const ing of ings) {
        const name = ing.ingredient_name || ing.name || '';
        if (!name) continue;
        const q = normalize(name);

        // find best match
        let matched = null;
        let bestScore = -Infinity;

        for (const it of inventory) {
          const rawName = it.item_name || '';
          const iname = normalize(rawName);
          if (!iname) continue;

          // match rules
          if (!(iname.includes(q) || q.includes(iname) || iname === q)) continue;

          // numeric value extracted
          let invValRaw = null;
          if (it.quantity_value != null && String(it.quantity_value).trim() !== '') {
            invValRaw = parseFloat(it.quantity_value);
          } else if (it.quantity && String(it.quantity).trim() !== '') {
            const m = String(it.quantity).match(/([\d.,]+)/);
            if (m) invValRaw = parseFloat(m[1].replace(/,/g,'.'));
          }

          const invUnit = (it.quantity_unit || it.qty_unit || '').toString();
          const invConv = (invValRaw != null && !isNaN(invValRaw))
            ? convertToBase(invValRaw, invUnit)
            : { value: null, kind: 'unknown' };

          // scoring → higher score = better match
          let score = 0;
          if ((it.item_status || '').toLowerCase() === 'available') score += 1000;
          if (invConv.value != null && !isNaN(invConv.value)) score += invConv.value;
          if (iname === q) score += 10;

          if (score > bestScore) {
            bestScore = score;
            matched = it;
            matched._converted = invConv;
          }
        }

        if (!matched) return false;

        // numeric comparisons with unit conversion
        const reqValRaw = (ing.qty_value != null && String(ing.qty_value).trim() !== '') ? parseFloat(ing.qty_value) : null;
        const invValRaw = (matched.quantity_value != null && String(matched.quantity_value).trim() !== '') ? parseFloat(matched.quantity_value) : null;
        const reqUnit = (ing.qty_unit || ing.qty_unit || ing.unit || '').toString();
        const invUnit = (matched.quantity_unit || matched.qty_unit || matched.unit || '').toString();

        // If both numeric and both units present, try converting
        if (reqValRaw != null && !isNaN(reqValRaw) && invValRaw != null && !isNaN(invValRaw)) {
          const reqConv = convertToBase(reqValRaw, reqUnit);
          const invConv = convertToBase(invValRaw, invUnit);

          // If both kinds are same (mass vs mass, volume vs volume, pieces) we can compare converted values
          if (reqConv.value != null && invConv.value != null && reqConv.kind === invConv.kind && reqConv.kind !== 'unknown') {
            if (invConv.value < reqConv.value) return false; // insufficient
            else continue; // sufficient for this ingredient
          }

          // If either kind is 'unknown' but numeric, do a fallback numeric compare (best-effort)
          if ((reqConv.kind === 'unknown' || invConv.kind === 'unknown')) {
            const reqNum = (reqConv && reqConv.value != null && !isNaN(reqConv.value)) ? reqConv.value : reqValRaw;
            const invNum = (invConv && invConv.value != null && !isNaN(invConv.value)) ? invConv.value : invValRaw;
            if (invNum < reqNum) return false;
            else continue;
          }

          // If kinds mismatch (e.g. mass vs volume) we can't reliably compare => assume insufficient
          return false;
        }

        // If numeric compare not possible but inventory item exists => treat as available
      }
      return true;
    }

    // For each tile, fetch the recipe details (non-blocking)
    tiles.forEach(async (tile) => {
      const rid = tile.getAttribute('data-recipe-id');
      const name = tile.getAttribute('data-name') || tile.textContent.trim();
      try {
        let recipe = null;
        if (rid) {
          const rresp = await fetch(`api/get_recipe.php?recipe_id=${encodeURIComponent(rid)}&_=${Date.now()}`, { cache:'no-store' });
          if (rresp.ok) {
            const raw = await rresp.text();
            let j = null;
            try { j = raw ? JSON.parse(raw) : null; } catch(e) { j = null; }
            recipe = j && j.ok && j.recipe ? j.recipe : (j && j.recipe ? j.recipe : null);
          }
        }
        // If fetching recipe failed, fallback to treating as unavailable (safer) OR available depending on preference.
        const ings = recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        const isAvailable = checkRecipeAvailable(ings, inv);
        tile.classList.remove('pending');
        tile.classList.add(isAvailable ? 'available' : 'unavailable');

        // clicking a tile opens recipe modal (if id exists) or fallback by name
        tile.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (rid) return fetchAndShowRecipe(rid);
          return fetchAndShowRecipeByName(name);
        });
      } catch (err) {
        console.error('[renderSuggestions] recipe check failed for', name, err);
        tile.classList.remove('pending');
        tile.classList.add('unavailable');
        tile.addEventListener('click', () => fetchAndShowRecipeByName(name));
      }
    });

    // populate full suggestions modal when present (we'll render entire list and run same availability checks)
    const allList = document.getElementById('allSuggestionsList');
    if (allList) {
      allList.innerHTML = items.map(it => `<div class="all-suggestion pending" data-recipe-id="${escapeHtml(String(it.recipe_id))}" data-name="${escapeHtml(it.recipe_name)}">${escapeHtml(it.recipe_name)}</div>`).join('');
      // fetch availability for all items
      const allTiles = Array.from(allList.querySelectorAll('.all-suggestion'));
      allTiles.forEach(async (el) => {
        const rid = el.getAttribute('data-recipe-id');
        const nm = el.getAttribute('data-name') || el.textContent.trim();
        try {
          let recipe = null;
          if (rid) {
            const rresp = await fetch(`api/get_recipe.php?recipe_id=${encodeURIComponent(rid)}&_=${Date.now()}`, { cache:'no-store' });
            if (rresp.ok) {
              const raw = await rresp.text();
              let j = null;
              try { j = raw ? JSON.parse(raw) : null; } catch(e){ j=null; }
              recipe = j && j.ok && j.recipe ? j.recipe : (j && j.recipe ? j.recipe : null);
            }
          }
          const ings = recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
          const ok = checkRecipeAvailable(ings, inv);
          el.classList.remove('pending');
          el.classList.add(ok ? 'available' : 'unavailable');
          el.addEventListener('click', () => { if (rid) fetchAndShowRecipe(rid); else fetchAndShowRecipeByName(nm); });
        } catch(e){
          el.classList.remove('pending');
          el.classList.add('unavailable');
          el.addEventListener('click', () => fetchAndShowRecipeByName(nm));
        }
      });
    }
  }

  // Hook the "..." button to show All Suggestions modal and wire modal close buttons
  (function hookSuggestionsModalControls(){
    const moreBtn = document.getElementById('moreSuggestionsBtn');
    const modal = document.getElementById('suggestionsModal');
    const closeX = document.getElementById('closeModalBtn'); // top-right X
    const footerClose = document.getElementById('modalCloseFooter');

    if (moreBtn && modal) {
      moreBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        // re-render suggestions to refresh list (availability) before showing
        try { await renderSuggestions(); } catch(e){ console.warn('renderSuggestions failed on more click', e); }
        showModal(modal);
      });
    }

    if (closeX) closeX.addEventListener('click', () => { hideModal(modal); });
    if (footerClose) footerClose.addEventListener('click', () => { hideModal(modal); });

    // close when clicking backdrop (modal already has backdrop element)
    modal?.addEventListener('click', (ev) => {
      if (ev.target === modal) hideModal(modal);
    });
  })();

  (function hookSuggestionsModalClose(){
    const suggestionsModal = document.getElementById('suggestionsModal');
    if (!suggestionsModal) return;

    // prefer existing hideModal if present
    const doHide = (modal) => {
      if (typeof hideModal === 'function') return hideModal(modal);
      // fallback
      modal.setAttribute('aria-hidden','true');
      modal.style.display = 'none';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };

    document.getElementById('closeModalBtn')?.addEventListener('click', () => doHide(suggestionsModal));
    document.getElementById('modalCloseFooter')?.addEventListener('click', () => doHide(suggestionsModal));

    // also close when backdrop clicked (close modal when clicking outside panel)
    const backdrop = suggestionsModal.querySelector('.modal-backdrop') || document.getElementById('modalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (ev) => {
        // ensure user clicked backdrop (not the panel)
        if (ev.target === backdrop) doHide(suggestionsModal);
      });
    }
  })();

  // fetch recipe details and show recipe modal
  async function fetchAndShowRecipe(recipeId){
    const modal = document.getElementById('recipeDetailModal');
    const body = document.getElementById('recipeDetailBody');
    const title = document.getElementById('recipeDetailTitle');
    if (!modal || !body || !title) {
      console.warn('[fetchAndShowRecipe] recipe modal elements missing');
      return;
    }

    title.textContent = 'Loading...';
    body.innerHTML = '<p class="muted">Loading recipe details…</p>';
    showModal(modal);

    try {
      const url = `api/get_recipe.php?recipe_id=${encodeURIComponent(recipeId)}&_=${Date.now()}`;
      console.log('[fetchAndShowRecipe] GET', url);
      const resp = await fetch(url, { cache: 'no-store' });

      const raw = await resp.text();
      console.log('[fetchAndShowRecipe] raw response:', raw.slice(0, 400));

      let j = null;
      try { j = raw ? JSON.parse(raw) : null; } catch (parseErr) {
        console.error('[fetchAndShowRecipe] JSON parse error:', parseErr);
        body.innerHTML = `<p class="muted">Server returned non-JSON response. Check browser console for raw output.</p>`;
        title.textContent = 'Error';
        return;
      }

      if (!j || !j.ok || !j.recipe) {
        console.warn('[fetchAndShowRecipe] unexpected JSON payload:', j);
        const msg = j && (j.error || j.msg || j.message) ? (j.error || j.msg || j.message) : 'No ingredient details available for this recipe.';
        body.innerHTML = `<p class="muted">${escapeHtml(String(msg))}</p>`;
        title.textContent = (j && j.recipe && j.recipe.recipe_name) ? j.recipe.recipe_name : 'Recipe';
        delete modal.dataset.currentRecipeId;
        modal.dataset.currentRecipeName = j && j.recipe && j.recipe.recipe_name ? j.recipe.recipe_name : '';
        modal.dataset.currentIngredients = JSON.stringify([]);
        return;
      }

      // load inventory to determine availability
      let inventory = [];
      try { inventory = await loadInventory(); } catch (e) { console.warn('[fetchAndShowRecipe] loadInventory failed', e); inventory = []; }

      const recipe = j.recipe;
      title.textContent = recipe.recipe_name || 'Recipe';
      const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

      // match helper (case-insensitive substring)
      function findInventoryMatch(ingredientName) {
        if (!ingredientName) return null;
        const q = normalizeText(ingredientName).replace(/[^a-z0-9\s]/g, '');
        let best = null;
        let bestScore = -Infinity;

        for (const it of inventory) {
          const rawName = it.item_name || '';
          const iname = normalizeText(rawName).replace(/[^a-z0-9\s]/g, '');
          if (!iname) continue;

          // allow substring or word intersection (Rice <> White Rice, Egg <> Eggs)
          let matchedName = false;
          if (iname.includes(q) || q.includes(iname) || iname === q) matchedName = true;
          else {
            const inWords = iname.split(/\s+/);
            const qWords = q.split(/\s+/);
            for (const w of qWords) {
              if (w.length > 1 && inWords.includes(w)) { matchedName = true; break; }
            }
          }
          if (!matchedName) continue;

          // compute numeric availability: try quantity_value first; fallback parse from quantity text
          let invValRaw = null;
          if (it.quantity_value != null && String(it.quantity_value).trim() !== '') {
            invValRaw = parseFloat(String(it.quantity_value).replace(/,/g,'.'));
          } else if (it.quantity && String(it.quantity).trim() !== '') {
            const m = String(it.quantity).match(/([\d.,]+)/);
            if (m) invValRaw = parseFloat(m[1].replace(/,/g,'.'));
          }

          const invUnit = (it.quantity_unit || it.qty_unit || '').toString();
          const invConv = (invValRaw != null && !isNaN(invValRaw)) ? convertToBase(invValRaw, invUnit) : { value: null, kind: 'unknown' };

          // scoring: prefer Available status, non-zero numeric, larger quantity, exact name match
          let score = 0;
          if ((it.item_status || '').toLowerCase() === 'available') score += 1000;
          if (invConv.value != null && !isNaN(invConv.value)) score += Math.min(invConv.value, 100000);
          if (iname === q) score += 10;

          if (score > bestScore) {
            bestScore = score;
            best = Object.assign({}, it); // clone to avoid mutating original source
            best._converted = invConv;   // attach converted quantity for later
            best._raw_quantity_value = invValRaw;
            best._raw_quantity_unit = invUnit;
          }
        }

        return best;
      }

      // availability decision — uses converted value attached by findInventoryMatch (if present)
      // returns { available: boolean, matched: inventoryRow | null }
      function checkAvailability(ing) {
        const name = ing.ingredient_name || ing.name || '';
        const matched = findInventoryMatch(name);
        if (!matched) return { available: false, matched: null };

        // request numeric
        const reqValRaw = (ing.qty_value != null && String(ing.qty_value).trim() !== '') ? parseFloat(String(ing.qty_value).replace(/,/g,'.')) : null;
        const reqUnit = (ing.qty_unit || ing.unit || '').toString();

        // prefer converted value produced during matching if available
        const invConv = (matched._converted && typeof matched._converted === 'object') ? matched._converted : (function(){
          // fallback compute from stored fields
          let fallbackInvRaw = null;
          if (matched.quantity_value != null && String(matched.quantity_value).trim() !== '') fallbackInvRaw = parseFloat(String(matched.quantity_value).replace(/,/g,'.'));
          else if (matched.quantity && String(matched.quantity).trim() !== '') {
            const m = String(matched.quantity).match(/([\d.,]+)/);
            if (m) fallbackInvRaw = parseFloat(m[1].replace(/,/g,'.'));
          }
          const fallbackUnit = (matched.quantity_unit || matched.qty_unit || '').toString();
          return (fallbackInvRaw != null && !isNaN(fallbackInvRaw)) ? convertToBase(fallbackInvRaw, fallbackUnit) : { value: null, kind: 'unknown' };
        })();

        // If both request and inventory numeric exist, compare via convertToBase for request
        if (reqValRaw != null && !isNaN(reqValRaw) && invConv.value != null && !isNaN(invConv.value)) {
          const reqConv = convertToBase(reqValRaw, reqUnit);

          // debug: uncomment to see values in console
          console.debug('[checkAvailability]', name, 'reqRaw=', reqValRaw, reqUnit, '=>', reqConv, 'invConv=', invConv, 'matchedItem=', matched.item_name);

          if (reqConv.value != null && invConv.value != null && reqConv.kind === invConv.kind && reqConv.kind !== 'unknown') {
            return { available: invConv.value >= reqConv.value, matched };
          }

          // fallback raw numeric compare if conversion unknown
          if (reqConv.kind === 'unknown' || invConv.kind === 'unknown') {
            const reqNum = (reqConv && reqConv.value != null && !isNaN(reqConv.value)) ? reqConv.value : reqValRaw;
            return { available: (invConv.value >= reqNum), matched };
          }

          // cannot compare different kinds (mass vs volume) — treat as unavailable to be safe
          return { available: false, matched };
        }

        // if numeric compare not possible but we found a matching item -> treat as available
        return { available: true, matched };
      }

      if (ings.length === 0) {
        body.innerHTML = `<p class="muted">No ingredient details available for this recipe.</p>`;
      } else {
        // header order: Item | Qty | Unit | Availability (availability on right)
        let html = `<div style="margin-bottom:12px;"><strong style="display:block;margin-bottom:8px;font-size:16px;">Ingredients</strong>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="text-align:left;color:#3b4a43;">
              <th style="padding:8px;border-bottom:1px solid #eee; width:60%;">Item</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:12%; text-align:center;">Qty</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:12%; text-align:center;">Unit</th>
              <th style="padding:8px;border-bottom:1px solid #eee; width:16%; text-align:center;">Availability</th>
            </tr></thead><tbody>`;

        ings.forEach(it => {
          const nm = escapeHtml(it.ingredient_name || it.name || '');
          // format numeric qty to 2 decimals where possible
          let qtyDisplay = '';
          if (it.qty_value != null && String(it.qty_value).trim() !== '' && !isNaN(parseFloat(it.qty_value))) {
            qtyDisplay = parseFloat(it.qty_value).toFixed(2);
          } else if (it.qty_text && String(it.qty_text).trim() !== '') {
            qtyDisplay = escapeHtml(it.qty_text);
          } else {
            qtyDisplay = '';
          }
          const unit = escapeHtml(it.qty_unit || '');

          const avail = checkAvailability(it);
          let availCell = '';
          if (avail.available) {
            // green checkbox — NOT disabled so accent-color renders; make it non-interactive
            availCell = `<div style="padding:6px; text-align:center;">
                          <input type="checkbox" checked tabindex="-1" aria-checked="true"
                                style="accent-color:var(--primary-green); transform:scale(1.45); width:18px; height:18px; pointer-events:none;">
                        </div>`;
          } else if (avail.matched) {
            // matched but insufficient quantity => red exclamation (20% larger)
            availCell = `<div style="padding:6px; text-align:center; color:#e74c3c; font-weight:800; font-size:24px; line-height:1;">!</div>`;
          } else {
            // not matched => unchecked box (non-interactive)
            availCell = `<div style="padding:6px; text-align:center;">
                          <input type="checkbox" tabindex="-1" aria-checked="false"
                                style="transform:scale(1.45); width:18px; height:18px; pointer-events:none;">
                        </div>`;
          }

          html += `<tr>
                    <td style="padding:12px 8px;border-bottom:1px solid #f4f4f4;vertical-align:middle;">${nm}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #f4f4f4;vertical-align:middle;text-align:center;">${escapeHtml(qtyDisplay)}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #f4f4f4;vertical-align:middle;text-align:center;">${unit}</td>
                    <td style="padding:8px;border-bottom:1px solid #f4f4f4;vertical-align:middle;">${availCell}</td>
                  </tr>`;
        });

        html += `</tbody></table></div>`;
        body.innerHTML = html;
      }

      // store fetched recipe on modal for the Use button
      modal.dataset.currentRecipeId = recipe.recipe_id;
      modal.dataset.currentRecipeName = recipe.recipe_name;
      modal.dataset.currentIngredients = JSON.stringify(ings);

      // center modal footer buttons and style slightly larger
      const footer = modal.querySelector('.modal-footer');
      const cancelBtn = document.getElementById('recipeDetailCancel');
      const useBtn = document.getElementById('recipeUseBtn');
      if (footer) {
        footer.style.display = 'flex';
        footer.style.justifyContent = 'center';
        footer.style.gap = '16px';
        footer.style.padding = '14px 16px';
      }
      if (cancelBtn) {
        cancelBtn.style.padding = '10px 22px';
        cancelBtn.style.border = '1px solid rgba(0,0,0,0.12)';
        cancelBtn.style.background = '#fff';
        cancelBtn.style.borderRadius = '10px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontWeight = '600';
        cancelBtn.style.fontSize = '15px';
      }
      if (useBtn) {
        useBtn.style.padding = '10px 22px';
        useBtn.style.border = 'none';
        useBtn.style.background = 'var(--primary-green)';
        useBtn.style.color = '#fff';
        useBtn.style.borderRadius = '10px';
        useBtn.style.cursor = 'pointer';
        useBtn.style.fontWeight = '700';
        useBtn.style.fontSize = '15px';
      }

    } catch (err) {
      console.error('[fetchAndShowRecipe] error', err);
      body.innerHTML = `<p class="muted">Error loading recipe details. Check console.</p>`;
      title.textContent = 'Error';
    }
  }

  // fallback: show a simple modal by name (no recipe id)
  function fetchAndShowRecipeByName(name){
    const modal = document.getElementById('recipeDetailModal');
    const body = document.getElementById('recipeDetailBody');
    const title = document.getElementById('recipeDetailTitle');
    if (!modal || !body || !title) return;
    title.textContent = name || 'Recipe';
    body.innerHTML = `<p class="muted">No stored recipe details available. You can add this manually via "Add Meal".</p>`;
    delete modal.dataset.currentRecipeId;
    modal.dataset.currentRecipeName = name || '';
    modal.dataset.currentIngredients = JSON.stringify([]);
    showModal(modal);
  }

  // generic show/hide helpers
  function showModal(modalEl){
    if (!modalEl) return;
    const backdrop = modalEl.querySelector('.modal-backdrop') || document.getElementById(modalEl.id + 'Backdrop');
    if (backdrop) backdrop.style.display = 'block';
    modalEl.setAttribute('aria-hidden','false');
    modalEl.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  function hideModal(modalEl){
    if (!modalEl) return;
    const backdrop = modalEl.querySelector('.modal-backdrop') || document.getElementById(modalEl.id + 'Backdrop');
    if (backdrop) backdrop.style.display = 'none';
    modalEl.setAttribute('aria-hidden','true');
    modalEl.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // hook recipe modal buttons (close / use / cancel)
  (function hookRecipeModalButtons(){
    const modal = document.getElementById('recipeDetailModal');
    if (!modal) return;
    document.getElementById('recipeDetailClose')?.addEventListener('click', ()=> hideModal(modal));
    document.getElementById('recipeDetailCancel')?.addEventListener('click', ()=> hideModal(modal));

    // Use button -> open choose-date-slot modal
    document.getElementById('recipeUseBtn')?.addEventListener('click', ()=> {
      if (!modal.dataset.currentRecipeId) {
        alert('Recipe not loaded.');
        return;
      }
      const chooseModal = document.getElementById('chooseDateSlotModal');
      const dateInput = document.getElementById('chooseDateSlotDate');
      try {
        const selDate = window.getSelectedDate ? window.getSelectedDate() : new Date();
        dateInput.value = formatLocalDate(selDate);
      } catch (_) {
        dateInput.value = formatLocalDate(new Date());
      }
      showModal(chooseModal);
    });

    // choose modal actions
    const chooseModal = document.getElementById('chooseDateSlotModal');
    document.getElementById('chooseDateSlotClose')?.addEventListener('click', ()=> hideModal(chooseModal));
    document.getElementById('chooseDateSlotCancel')?.addEventListener('click', ()=> hideModal(chooseModal));

    document.getElementById('chooseDateSlotConfirm')?.addEventListener('click', async ()=> {
      const recipeModal = document.getElementById('recipeDetailModal');
      const dateInput = document.getElementById('chooseDateSlotDate');
      const slotSelect = document.getElementById('chooseDateSlotSelect');
      const remarkInput = document.getElementById('chooseDateSlotRemark'); // NEW
      const dateVal = dateInput.value;
      const slotVal = slotSelect.value || 'lunch';
      const remarkVal = remarkInput ? (remarkInput.value || '') : ''; // NEW

      if (!dateVal) { alert('Please pick a date'); return; }

      const rid = recipeModal.dataset.currentRecipeId;
      const recipeName = recipeModal.dataset.currentRecipeName || 'Recipe';
      let ings = [];
      try { ings = JSON.parse(recipeModal.dataset.currentIngredients || '[]'); } catch(e) { ings = []; }

      const ingredients = ings.map(it => ({
        name: it.ingredient_name || it.name || '',
        item_id: null,
        qty_value: (it.qty_value != null ? it.qty_value : ''),
        qty_unit: it.qty_unit || '',
        qty_text: it.qty_text || ''
      }));

      const payload = {
        user_id: window.CURRENT_USER_ID || 0,
        meal_date: dateVal,
        meal_slot: slotVal,
        meal_name: recipeName,
        remark: remarkVal, // now included
        ingredients: ingredients
      };

      try {
        const resp = await fetch('api/add_meal.php', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        const raw = await resp.text();
        let j;
        try { j = raw ? JSON.parse(raw) : null; } catch(e) {
          console.error('[UseRecipe] server returned non-json:', raw);
          alert('Server error while saving recipe. Check console.');
          return;
        }
        if (!resp.ok || !j || !j.ok) {
          console.error('[UseRecipe] save failed', j);
          alert('Failed to save meal: ' + (j && (j.message || j.error) ? (j.message || j.error) : 'Unknown'));
          return;
        }

        hideModal(chooseModal);
        hideModal(recipeModal);
        alert('Recipe added to meal plan.');
        try { await reloadMealsForCurrentDate(); } catch(_) { renderMeals(); }
      } catch (err) {
        console.error('[UseRecipe] error', err);
        alert('Unable to contact server. Check console.');
      }
    });
  })();
  // ----------------- end renderSuggestions & recipe modal flow -----------------

  // -------------------- Load saved meals for a given date --------------------
  async function loadMealsForDate(dateObj) {
    if (!dateObj) return;
    const yyyy = formatLocalDate(dateObj); // new
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
    const slot = tile.dataset.slot;
    const index = tile.dataset.index != null ? Number(tile.dataset.index) : null;

    // find the snapshot (best-effort)
    let snapshot = null;
    if (window.mealSnapshots) {
      // Prefer exact match by slot+index
      for (const k of Object.keys(window.mealSnapshots)) {
        const s = window.mealSnapshots[k];
        if (!s) continue;
        if (slot != null && index != null) {
          if (s.slot === slot && Number(s.index) === index) { snapshot = s; break; }
        }
      }
      // fallback: match by name
      if (!snapshot) {
        for (const k of Object.keys(window.mealSnapshots)) {
          const s = window.mealSnapshots[k];
          if (s && s.meal_name === name) { snapshot = s; break; }
        }
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
  function reloadMealsForCurrentDate() {
    loadMealsForDate(state.selected).then(()=> {
      renderMeals();
      attachMealTileClickHandlers();
    });
  }

  window.collectPlanPayload = function(){
    const payload = { user_id: window.CURRENT_USER_ID || 0, meal_date: formatLocalDate(window.getSelectedDate ? window.getSelectedDate() : new Date()), meals: {} };
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
      // prefer the currently-selected date in the calendar if available, fall back to today
      meal_date: (function(){
        try {
          // pill.active dataset has full ISO date (we used to set data-date="${d.toISOString()}")
          const active = document.querySelector('.pill.active')?.dataset?.date;
          if (active) return formatLocalDate(new Date(active));
        } catch(_) {}
        return (new Date()).toISOString().slice(0,10);
      })(),
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

      // Always read raw text first so we can log it if JSON parse fails
      const raw = await resp.text();
      console.log('[AddMeal] HTTP', resp.status, resp.statusText, 'Content-Type:', resp.headers.get('content-type'));
      console.log('[AddMeal] RAW RESPONSE:', raw);

      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch (parseErr) {
        console.error('[AddMeal] JSON parse error:', parseErr);
        // Show raw server output to console and a friendly alert to user
        console.error('[AddMeal] Server returned invalid JSON. See RAW RESPONSE above.');
        alert('Server returned an unexpected response. Check browser console for details.');
        return;
      }

      if (!resp.ok || !json || !json.ok) {
        console.error('Save failed', json);
        alert('Failed to save meal: ' + (json && (json.message || json.error) ? (json.message || json.error) : 'Unknown error'));
        return;
      }

      // Success path — prefer a server reload, fallback to local update
      if (typeof reloadMealsForCurrentDate === 'function') {
        try {
          await reloadMealsForCurrentDate();
        } catch (e) {
          console.error('[Add Meal] reload failed', e);
          // fallback: minimal local update
          window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
          window.demoMeals[activeSlot].push(mealName);
          if (typeof renderMeals === 'function') renderMeals();
          if (typeof window.attachMealTileClickHandlers === 'function') window.attachMealTileClickHandlers();
        }
      } else {
        // existing local-only fallback
        window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
        window.demoMeals[activeSlot].push(mealName);
        if (typeof renderMeals === 'function') renderMeals();
        if (typeof window.attachMealTileClickHandlers === 'function') window.attachMealTileClickHandlers();
      }

      if (typeof inventoryCache !== 'undefined') inventoryCache = null;
      closeModal();
      alert('Meal saved successfully!');
      console.log('[Add Meal] saved:', json);
      
      // Auto-refresh page to show latest meal plan
      location.reload();

    } catch (err) {
      console.error('[Add Meal] fetch error:', err);
      alert('Unable to reach server: ' + (err && err.message ? err.message : String(err)) + '. Check console for details.');
    }
  });

  // ESC to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

  window.reloadMealsForCurrentDate = async function() {
  try {
    await loadMealsForDate(state.selected);
    renderMeals();
    attachMealTileClickHandlers && attachMealTileClickHandlers();
  } catch (e) {
    console.error('[window.reloadMealsForCurrentDate] error', e);
    throw e;
  }
};
window.attachMealTileClickHandlers = attachMealTileClickHandlers;
window.getSelectedDate = function() { return new Date(state.selected); };
})(); // end modal IIFE

(function addSlotHoverStyles(){
  const css = `
    /* slot card hover / add button (orange background, white text like date pill) */
    .slot-card { transition: transform .12s ease; }
    .slot-card h1, .slot-card h2, .slot-card h3, .slot-card h4, .slot-card .slot-title {
      transition: color .12s ease;
      color: #333 !important;
    }
    .slot-card:hover h1,
    .slot-card:hover h2,
    .slot-card:hover h3,
    .slot-card:hover h4,
    .slot-card:hover .slot-title {
      color: #f39c12 !important;
    }

    .slot-card .slot-add {
      transition: background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease;
      background: #fff;
      color: #333;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: none;
    }

    /* hover / focus state: orange background + white text */
    .slot-card .slot-add:hover,
    .slot-card:hover .slot-add,
    .slot-card .slot-add:focus {
      background: #f39c12 !important;
      color: #ffffff !important;
      border-color: #f39c12 !important;
      box-shadow: 0 8px 24px rgba(243,156,18,0.18);
    }

    /* accessibility focus ring */
    .slot-card .slot-add:focus {
      outline: none;
      box-shadow: 0 0 0 4px rgba(243,156,18,0.12);
    }

    /* meal tile hover to feel interactive */
    .meal-tile { transition: transform .08s ease, box-shadow .12s ease; cursor: pointer; }
    .meal-tile:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
  `;
  if (!document.getElementById('slot-hover-styles')) {
    const style = document.createElement('style');
    style.id = 'slot-hover-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function markSlotParents(){
    document.querySelectorAll('.slot-add').forEach(btn=>{
      let p = btn.closest('div');
      const candidate = btn.closest('div')?.querySelector('h3') ? btn.closest('div') : null;
      if (candidate) p = candidate;
      if (p) p.classList.add('slot-card');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markSlotParents);
  } else {
    markSlotParents();
  }
})();
