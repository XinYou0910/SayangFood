// Username hydrate
(function(){
  const u = localStorage.getItem("user_name");
  const el = document.getElementById("username");
  if (u && el) el.textContent = u;
})();

(function() {
  function attachFallback() {
    const btn = document.getElementById('weeklyAddMealTop');
    const modal = document.getElementById('addCalendarMealModal');

    if (!btn) return;
    if (btn._mealPlanFallbackAttached) return;
    btn._mealPlanFallbackAttached = true;

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (modal) {
        if (typeof showModal === 'function') {
          try { showModal(modal); } catch (err) { modal.style.display='flex'; }
        } else {
          modal.style.display = 'flex';
        }
      }
    }, { passive: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachFallback);
  else attachFallback();
})();

// ====== Utilities ======
function formatLocalDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

  return { value: v, kind: 'unknown' };
}

// === safe stub to avoid "attachMealTileClickHandlers is not defined" errors ===
if (typeof window.attachMealTileClickHandlers === 'undefined') {
  window.attachMealTileClickHandlers = function() {
    // placeholder: real implementation will be assigned later
    // keep this tolerant if the real handler isn't ready yet
    try {
      // try to call the real implementation if already present
      if (typeof window.__real_attachMealTileClickHandlers === 'function') {
        return window.__real_attachMealTileClickHandlers();
      }
    } catch(_) {}
  };
}

// ------------------------ Inventory loader + filter ------------------------

let inventoryCache = null;

async function loadInventory(){
  if (inventoryCache && Array.isArray(inventoryCache)) return inventoryCache;

  const uid = window.CURRENT_USER_ID || window.loggedUserId || 0;
  console.log('[loadInventory] CURRENT_USER_ID =', uid);
  if (!uid) return [];

  try {
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
 */
async function filterInventoryForQuery(term){
  const inv = await loadInventory();
  if (!inv || inv.length === 0) return [];

  const q = normalizeText(term || '');

  return inv.filter(r => {
    if (r.item_status && r.item_status.toLowerCase() !== 'available') return false;
    if (!q) return true;
    const name = normalizeText(r.item_name);
    return name.includes(q);
  });
}

// ------------------------ Calendar / UI core ------------------------

(function () {
  const state = { selected: new Date() };

  const suggestionsStatic = ["Fried Rice","Fried Noodle","Fried Chicken","Steam Egg","Pan Cake","Fried Vegetable"];
  // expiry items will now be loaded from food_analytics_data.php

  // UI meals store (names only)
  window.demoMeals = window.demoMeals || { breakfast:[], lunch:[], dinner:[], snacks:[] };
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

  // === renderMeals ===
  function renderMeals(){
    ["breakfast","lunch","dinner","snacks"].forEach(slot=>{
      const container = document.getElementById(slot + "-list");
      if (!container) {
        console.warn(`[renderMeals] container #${slot}-list not found`);
        return;
      }

      container.classList.add('meal-row');

      const arr = (window.demoMeals[slot] || []);

      const tilesHtml = arr.map((n, idx) =>
        `<div class="meal-tile" tabindex="0" role="button" data-slot="${slot}" data-index="${idx}" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`
      ).join('');

      container.innerHTML = tilesHtml || '';

      container.classList.remove('count-1','count-2','count-3','count-4','count-5plus');
      const count = arr.length;
      if (count === 1) container.classList.add('count-1');
      else if (count === 2) container.classList.add('count-2');
      else if (count === 3) container.classList.add('count-3');
      else if (count === 4) container.classList.add('count-4');
      else if (count >= 5) container.classList.add('count-5plus');

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

  async function renderExpiring() {
    const tb = document.getElementById("expiringList");
    if (!tb) return;

    // show a temporary loading row
    tb.innerHTML = `
      <tr>
        <td colspan="3" class="empty-row">Loading items near expiry…</td>
      </tr>
    `;

    let list = [];
    try {
      // same source as food analytics – adjust path if needed
      const res  = await fetch(`food_analytics_data.php?range=30`, { cache: "no-store" });
      const data = await res.json();
      list = Array.isArray(data.expiry_soon) ? data.expiry_soon : [];
    } catch (err) {
      console.error("[meal_plan] failed to load expiry_soon:", err);
    }

    // no data case
    if (!list || list.length === 0) {
      tb.innerHTML = `
        <tr>
          <td colspan="3" class="empty-row">No items near expiry.</td>
        </tr>
      `;
      return;
    }

    // helper to compute "X day(s)" from expiry_date
    const todayMs = (new Date()).setHours(0,0,0,0);

    tb.innerHTML = list.map(item => {
      const name  = escapeHtml(item.item_name || "");
      const qty   = escapeHtml(item.quantity || "");        // e.g. "1 kg"
      const exp   = item.expiry_date ? new Date(item.expiry_date) : null;

      let daysLeftLabel = "-";
      if (exp && !isNaN(exp)) {
        const diffDays = Math.max(0, Math.round((exp.setHours(0,0,0,0) - todayMs) / 86400000));
        if (diffDays === 0) daysLeftLabel = "Today";
        else if (diffDays === 1) daysLeftLabel = "1 day";
        else daysLeftLabel = `${diffDays} days`;
      }

      return `
        <tr>
          <td>${name}</td>
          <td>${qty}</td>
          <td>${daysLeftLabel}</td>
        </tr>
      `;
    }).join("");
  }

  // ----------------- renderSuggestions & recipe modal flow -----------------
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

    if (!items || items.length === 0) {
      const fallback = ["Fried Rice","Fried Noodle","Fried Chicken","Steam Egg","Pan Cake","Fried Vegetable"];
      wrap.innerHTML = fallback.map(n => `<div class="suggest-btn pending" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`).join('');
      wrap.querySelectorAll('.suggest-btn').forEach(btn=>{
        btn.classList.remove('pending');
        btn.classList.add('available');
        btn.addEventListener('click', () => fetchAndShowRecipeByName(btn.dataset.name));
      });
      return;
    }

    wrap.innerHTML = items.slice(0,6).map(it =>
      `<div class="suggest-btn pending" data-recipe-id="${escapeHtml(String(it.recipe_id))}" data-name="${escapeHtml(it.recipe_name)}">${escapeHtml(it.recipe_name)}</div>`
    ).join('');

    const inv = await loadInventory().catch(()=>[]);
    const tiles = Array.from(wrap.querySelectorAll('.suggest-btn'));

    function checkRecipeAvailable(ings, inventory) {
      if (!Array.isArray(ings) || ings.length === 0) return true;
      function normalize(s){ return (s||'').toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

      for (const ing of ings) {
        const name = ing.ingredient_name || ing.name || '';
        if (!name) continue;
        const q = normalize(name);

        let matched = null;
        let bestScore = -Infinity;

        for (const it of inventory) {
          const rawName = it.item_name || '';
          const iname = normalize(rawName);
          if (!iname) continue;

          if (!(iname.includes(q) || q.includes(iname) || iname === q)) continue;

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

        const reqValRaw = (ing.qty_value != null && String(ing.qty_value).trim() !== '') ? parseFloat(ing.qty_value) : null;
        const invValRaw = (matched.quantity_value != null && String(matched.quantity_value).trim() !== '') ? parseFloat(matched.quantity_value) : null;
        const reqUnit = (ing.qty_unit || ing.unit || '').toString();
        const invUnit = (matched.quantity_unit || matched.qty_unit || matched.unit || '').toString();

        if (reqValRaw != null && !isNaN(reqValRaw) && invValRaw != null && !isNaN(invValRaw)) {
          const reqConv = convertToBase(reqValRaw, reqUnit);
          const invConv = convertToBase(invValRaw, invUnit);

          if (reqConv.value != null && invConv.value != null && reqConv.kind === invConv.kind && reqConv.kind !== 'unknown') {
            if (invConv.value < reqConv.value) return false;
            else continue;
          }

          if ((reqConv.kind === 'unknown' || invConv.kind === 'unknown')) {
            const reqNum = (reqConv && reqConv.value != null && !isNaN(reqConv.value)) ? reqConv.value : reqValRaw;
            const invNum = (invConv && invConv.value != null && !isNaN(invConv.value)) ? invConv.value : invValRaw;
            if (invNum < reqNum) return false;
            else continue;
          }

          return false;
        }

      }
      return true;
    }

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
        const ings = recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        const isAvailable = checkRecipeAvailable(ings, inv);
        tile.classList.remove('pending');
        tile.classList.add(isAvailable ? 'available' : 'unavailable');

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

    const allList = document.getElementById('allSuggestionsList');
    if (allList) {
      allList.innerHTML = items.map(it => `<div class="all-suggestion pending" data-recipe-id="${escapeHtml(String(it.recipe_id))}" data-name="${escapeHtml(it.recipe_name)}">${escapeHtml(it.recipe_name)}</div>`).join('');
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

  (function hookSuggestionsModalControls(){
    const moreBtn = document.getElementById('moreSuggestionsBtn');
    const modal = document.getElementById('suggestionsModal');
    const closeX = document.getElementById('closeModalBtn'); // top-right X
    const footerClose = document.getElementById('modalCloseFooter');

    if (moreBtn && modal) {
      moreBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try { await renderSuggestions(); } catch(e){ console.warn('renderSuggestions failed on more click', e); }
        showModal(modal);
      });
    }

    if (closeX) closeX.addEventListener('click', () => { hideModal(modal); });
    if (footerClose) footerClose.addEventListener('click', () => { hideModal(modal); });

    modal?.addEventListener('click', (ev) => {
      if (ev.target === modal) hideModal(modal);
    });
  })();

  (function hookSuggestionsModalClose(){
    const suggestionsModal = document.getElementById('suggestionsModal');
    if (!suggestionsModal) return;
    const doHide = (modal) => {
      if (typeof hideModal === 'function') return hideModal(modal);
      modal.setAttribute('aria-hidden','true');
      modal.style.display = 'none';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };

    document.getElementById('closeModalBtn')?.addEventListener('click', () => doHide(suggestionsModal));
    document.getElementById('modalCloseFooter')?.addEventListener('click', () => doHide(suggestionsModal));

    const backdrop = suggestionsModal.querySelector('.modal-backdrop') || document.getElementById('modalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (ev) => {
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

      let inventory = [];
      try { inventory = await loadInventory(); } catch (e) { console.warn('[fetchAndShowRecipe] loadInventory failed', e); inventory = []; }

      const recipe = j.recipe;
      title.textContent = recipe.recipe_name || 'Recipe';
      const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

      function findInventoryMatch(ingredientName) {
        if (!ingredientName) return null;
        const q = normalizeText(ingredientName).replace(/[^a-z0-9\s]/g, '');
        let best = null;
        let bestScore = -Infinity;

        for (const it of inventory) {
          const rawName = it.item_name || '';
          const iname = normalizeText(rawName).replace(/[^a-z0-9\s]/g, '');
          if (!iname) continue;

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

          let invValRaw = null;
          if (it.quantity_value != null && String(it.quantity_value).trim() !== '') {
            invValRaw = parseFloat(String(it.quantity_value).replace(/,/g,'.'));
          } else if (it.quantity && String(it.quantity).trim() !== '') {
            const m = String(it.quantity).match(/([\d.,]+)/);
            if (m) invValRaw = parseFloat(m[1].replace(/,/g,'.'));
          }

          const invUnit = (it.quantity_unit || it.qty_unit || '').toString();
          const invConv = (invValRaw != null && !isNaN(invValRaw)) ? convertToBase(invValRaw, invUnit) : { value: null, kind: 'unknown' };

          let score = 0;
          if ((it.item_status || '').toLowerCase() === 'available') score += 1000;
          if (invConv.value != null && !isNaN(invConv.value)) score += Math.min(invConv.value, 100000);
          if (iname === q) score += 10;

          if (score > bestScore) {
            bestScore = score;
            best = Object.assign({}, it);
            best._converted = invConv;
            best._raw_quantity_value = invValRaw;
            best._raw_quantity_unit = invUnit;
          }
        }

        return best;
      }

      function checkAvailability(ing) {
        const name = ing.ingredient_name || ing.name || '';
        const matched = findInventoryMatch(name);
        if (!matched) return { available: false, matched: null };

        const reqValRaw = (ing.qty_value != null && String(ing.qty_value).trim() !== '') ? parseFloat(String(ing.qty_value).replace(/,/g,'.')) : null;
        const reqUnit = (ing.qty_unit || ing.unit || '').toString();

        const invConv = (matched._converted && typeof matched._converted === 'object') ? matched._converted : (function(){
          let fallbackInvRaw = null;
          if (matched.quantity_value != null && String(matched.quantity_value).trim() !== '') fallbackInvRaw = parseFloat(String(matched.quantity_value).replace(/,/g,'.'));
          else if (matched.quantity && String(matched.quantity).trim() !== '') {
            const m = String(matched.quantity).match(/([\d.,]+)/);
            if (m) fallbackInvRaw = parseFloat(m[1].replace(/,/g,'.'));
          }
          const fallbackUnit = (matched.quantity_unit || matched.qty_unit || '').toString();
          return (fallbackInvRaw != null && !isNaN(fallbackInvRaw)) ? convertToBase(fallbackInvRaw, fallbackUnit) : { value: null, kind: 'unknown' };
        })();

        if (reqValRaw != null && !isNaN(reqValRaw) && invConv.value != null && !isNaN(invConv.value)) {
          const reqConv = convertToBase(reqValRaw, reqUnit);

          console.debug('[checkAvailability]', name, 'reqRaw=', reqValRaw, reqUnit, '=>', reqConv, 'invConv=', invConv, 'matchedItem=', matched.item_name);

          if (reqConv.value != null && invConv.value != null && reqConv.kind === invConv.kind && reqConv.kind !== 'unknown') {
            return { available: invConv.value >= reqConv.value, matched };
          }

          if (reqConv.kind === 'unknown' || invConv.kind === 'unknown') {
            const reqNum = (reqConv && reqConv.value != null && !isNaN(reqConv.value)) ? reqConv.value : reqValRaw;
            return { available: (invConv.value >= reqNum), matched };
          }

          return { available: false, matched };
        }

        return { available: true, matched };
      }

      if (ings.length === 0) {
        body.innerHTML = `<p class="muted">No ingredient details available for this recipe.</p>`;
      } else {
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
            availCell = `<div style="padding:6px; text-align:center;">
                          <input type="checkbox" checked tabindex="-1" aria-checked="true"
                                style="accent-color:var(--primary-green); transform:scale(1.45); width:18px; height:18px; pointer-events:none;">
                        </div>`;
          } else if (avail.matched) {
            availCell = `<div style="padding:6px; text-align:center; color:#e74c3c; font-weight:800; font-size:24px; line-height:1;">!</div>`;
          } else {
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

      modal.dataset.currentRecipeId = recipe.recipe_id;
      modal.dataset.currentRecipeName = recipe.recipe_name;
      modal.dataset.currentIngredients = JSON.stringify(ings);

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

  // show modal (robust backdrop + z-index management)
  function showModal(modalEl) {
    if (!modalEl) return;

    // ensure modal is attached to body so it escapes any stacking contexts
    try { if (modalEl.parentNode !== document.body) document.body.appendChild(modalEl); } catch (e){}

    // panel (actual visual dialog) inside the modal container
    const panel = modalEl.querySelector('.modal-panel') || modalEl.querySelector('.modal-dialog') || modalEl;

    // single global backdrop id used across modals
    const BACKDROP_ID = 'global-modal-backdrop';
    let backdrop = document.getElementById(BACKDROP_ID);

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      document.body.appendChild(backdrop);
    } else if (backdrop.parentNode !== document.body) {
      document.body.appendChild(backdrop);
    }

    // Ensure backdrop sits before modal in DOM so panel can be higher
    try { if (backdrop.nextSibling !== modalEl) document.body.insertBefore(backdrop, modalEl); } catch(e){}

    // z-index ordering (backdrop < modal container < panel)
    // Keep these modest (not near 2147483647) to avoid platform edge cases
    const BACKDROP_Z = 11990;
    const MODAL_Z    = 12000;
    const PANEL_Z    = 12010;

    // style backdrop
    Object.assign(backdrop.style, {
      display: 'block',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      pointerEvents: 'auto',
      zIndex: String(BACKDROP_Z)
    });

    // show/position modal container
    try {
      modalEl.style.display = 'flex';
      modalEl.style.alignItems = modalEl.style.alignItems || 'center';
      modalEl.style.justifyContent = modalEl.style.justifyContent || 'center';
      modalEl.style.position = 'fixed';
      modalEl.style.inset = '0';
      modalEl.style.zIndex = String(MODAL_Z);
      modalEl.setAttribute('aria-hidden', 'false');
      modalEl.style.pointerEvents = 'auto';
    } catch (e){}

    // ensure panel is above modal container & backdrop
    if (panel) {
      try {
        // if panel is not already a child of body, leave it — we control z-indexs
        panel.style.position = panel.style.position || 'relative';
        panel.style.zIndex = String(PANEL_Z);
        panel.style.pointerEvents = 'auto';
      } catch(e){}
    }

    // lock background scroll while modal open
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // backdrop click closes modal but won't block panel because panel z-index is higher
    backdrop.onclick = function(ev) {
      if (!panel) {
        hideModal(modalEl);
        return;
      }
      const rect = panel.getBoundingClientRect();
      if (!(ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom)) {
        hideModal(modalEl);
      }
    };
  }

  function hideModal(modalEl) {
    if (!modalEl) return;

    try {
      modalEl.style.display = 'none';
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.style.pointerEvents = 'none';
    } catch(e){}

    const backdrop = document.getElementById('global-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.onclick = null;
      backdrop.style.pointerEvents = 'none';
    }

    // restore page scroll
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  window.showModal = showModal;
  window.hideModal = hideModal;

  (function hookRecipeModalButtons(){
    const modal = document.getElementById('recipeDetailModal');
    if (!modal) return;
    document.getElementById('recipeDetailClose')?.addEventListener('click', ()=> hideModal(modal));
    document.getElementById('recipeDetailCancel')?.addEventListener('click', ()=> hideModal(modal));

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
      hideModal(modal);
      showModal(chooseModal);
    });

    const chooseModal = document.getElementById('chooseDateSlotModal');
    document.getElementById('chooseDateSlotClose')?.addEventListener('click', ()=> hideModal(chooseModal));
    document.getElementById('chooseDateSlotCancel')?.addEventListener('click', ()=> hideModal(chooseModal));

    document.getElementById('chooseDateSlotConfirm')?.addEventListener('click', async ()=> {
      const recipeModal = document.getElementById('recipeDetailModal');
      const dateInput = document.getElementById('chooseDateSlotDate');
      const slotSelect = document.getElementById('chooseDateSlotSelect');
      const remarkInput = document.getElementById('chooseDateSlotRemark');
      const dateVal = dateInput.value;
      const slotVal = slotSelect.value || 'lunch';
      const remarkVal = remarkInput ? (remarkInput.value || '') : '';

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
        remark: remarkVal,
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
    const yyyy = formatLocalDate(dateObj);
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

      window.demoMeals = { breakfast:[], lunch:[], dinner:[], snacks:[] };
      // Clear snapshots for the new date so old snapshots from other dates won't interfere
      window.mealSnapshots = {};

      json.meals.forEach((m, idx) => {
        const slotKey = (m.meal_slot || '').toLowerCase();
        const slot = slotKey.startsWith('break') ? 'breakfast'
                    : slotKey.startsWith('lunc') ? 'lunch'
                    : slotKey.startsWith('dinn') ? 'dinner' : 'snacks';

        window.demoMeals[slot] = window.demoMeals[slot] || [];
        window.demoMeals[slot].push(m.meal_name || 'Untitled');

        const key = `${slot}__${window.demoMeals[slot].length - 1}__${Date.now()}_${idx}`;
        window.mealSnapshots[key] = {
          slot,
          index: window.demoMeals[slot].length - 1,
          meal_date: yyyy,               // EXPLICIT date scoping
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

  async function reloadMealsForCurrentDate() {
    try {
      await loadMealsForDate(state.selected);
      renderMeals();
      attachMealTileClickHandlers && attachMealTileClickHandlers();
    } catch (e) {
      console.error('[reloadMealsForCurrentDate] error', e);
    }
  }

  // -------------------- meal-tile click handler (replace existing ones) --------------------
  function attachMealTileClickHandlers() {
    // remove previous to avoid duplicate handlers
    document.removeEventListener('click', _mealTileClickHandler, true);
    // use capture phase so we get the event before other delegated listeners
    document.addEventListener('click', _mealTileClickHandler, true);
  }

  function _mealTileClickHandler(e) {
    // match both the normal page tiles and weekly calendar tiles
    const tile = e.target.closest('.meal-tile, .week-meal-tile');
    if (!tile) return;

    // prevent other delegated click handlers (e.g. suggestion/recipe handlers) from running
    e.stopPropagation();
    // prevent default in case tile is inside an <a> or button
    if (e.cancelable) e.preventDefault();

    const name = tile.dataset.name || tile.textContent.trim();
    const slot = tile.dataset.slot;
    const index = tile.dataset.index != null ? Number(tile.dataset.index) : null;

    // find snapshot if available AND matching the currently selected date
    let snapshot = null;
    const selectedDateStr = (function() {
      try { return formatLocalDate(state.selected); } catch(_) { return formatLocalDate(new Date()); }
    })();

    if (window.mealSnapshots) {
      // prefer exact slot+index+date match
      for (const k of Object.keys(window.mealSnapshots)) {
        const s = window.mealSnapshots[k];
        if (!s) continue;
        if (slot != null && index != null && s.slot === slot && Number(s.index) === index && s.meal_date === selectedDateStr) {
          snapshot = s;
          break;
        }
      }

      // fallback: name match but still require the same date to avoid cross-date collisions
      if (!snapshot) {
        for (const k of Object.keys(window.mealSnapshots)) {
          const s = window.mealSnapshots[k];
          if (!s) continue;
          if (s.meal_name === name && s.meal_date === selectedDateStr) { snapshot = s; break; }
        }
      }
    }

    // show meal detail dialog (your existing function)
    showMealDetailModal(name, snapshot);
  }

  function showMealDetailModal(name, snapshot) {
    let backdrop = document.getElementById('addMealBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'addMealBackdrop';
      document.body.appendChild(backdrop);
    } else if (backdrop.parentNode !== document.body) {
      document.body.appendChild(backdrop);
    }
    Object.assign(backdrop.style, {
      display: 'block',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: '11990',
      cursor: 'default'
    });

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

      dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDetail(); });
      dlg.querySelector('#mealDetailClose').addEventListener('click', closeDetail);
    } else {
      dlg.style.display = 'flex';
    }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const panel = dlg.querySelector('#mealDetailPanel');
    const titleEl = dlg.querySelector('#mealDetailTitle');
    const body = dlg.querySelector('#mealDetailBody');
    if (!body) return;

    titleEl.textContent = name || '';

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

    function closeDetail() {
      const existing = document.getElementById('mealDetailDlg');
      if (existing) existing.remove();

      // hide any global backdrops that may have been created
      const globalBackdrop = document.getElementById('global-modal-backdrop');
      if (globalBackdrop) {
        globalBackdrop.style.display = 'none';
        globalBackdrop.onclick = null;
        // optionally remove from DOM to avoid conflicts:
        // globalBackdrop.remove();
      }

      const addMealBackdropEl = document.getElementById('addMealBackdrop');
      if (addMealBackdropEl) {
        // only hide it if the addMealModal is not open
        const addMealModal = document.getElementById('addMealModal');
        const addOpen = addMealModal && addMealModal.getAttribute('aria-hidden') === 'false' && addMealModal.style.display !== 'none';
        if (!addOpen) {
          addMealBackdropEl.style.display = 'none';
          addMealBackdropEl.style.background = '';
          addMealBackdropEl.onclick = null;
        }
      }

      // Also hide any modal backdrops that are direct children (fallback)
      document.querySelectorAll('.modal-backdrop').forEach(b => {
        try { b.style.display = 'none'; b.onclick = null; } catch(e){}
      });

      // ensure scrolling is restored
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }

  // New DOMContentLoaded that loads existing meals for today before renderMeals
  document.addEventListener("DOMContentLoaded", async () => {
    renderStrip();
    renderDayTitle();
    await loadMealsForDate((function(){ return (new Date()); })());
    renderSuggestions();
    renderExpiring();
    renderMeals();
    attachMealTileClickHandlers();
  });

  window.collectPlanPayload = function(){
    const payload = { user_id: window.CURRENT_USER_ID || 0, meal_date: formatLocalDate(window.getSelectedDate ? window.getSelectedDate() : new Date()), meals: {} };
    ['breakfast','lunch','dinner','snacks'].forEach(slot=>{
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

})(); // end main IIFE

// ------------------------ Add Meal Modal (single header + ingredient rows) ------------------------
(function(){
  const modal = document.getElementById('addMealModal');
  if (!modal) {
    console.warn('[Add Meal Modal] addMealModal not found');
    return;
  }

  let backdrop = document.getElementById('addMealBackdrop');

  (function ensureBackdropAndStacking(){
    const BACKDROP_Z = 11990;
    const MODAL_Z   = 12001;

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'addMealBackdrop';
      document.body.appendChild(backdrop);
    } else {
      if (backdrop.parentNode !== document.body) document.body.appendChild(backdrop);
    }

    Object.assign(backdrop.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: String(BACKDROP_Z),
      backdropFilter: 'none',
      pointerEvents: 'auto'
    });

    Object.assign(modal.style, {
      position: modal.style.position || 'fixed',
      inset: modal.style.inset || '0',
      display: modal.style.display || 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: String(MODAL_Z)
    });

    const panel = modal.querySelector('.modal-panel') || modal.querySelector('.modal-dialog') || modal;
    if (panel) {
      panel.style.background = panel.style.background || '#fff';
      panel.style.position = panel.style.position || 'relative';
      panel.style.zIndex = String(MODAL_Z + 1);
    }
  })();

  const closeBtn = document.getElementById('addMealClose');
  const form = document.getElementById('addMealForm');
  const ingredientsContainer = form?.querySelector('.grid-form-two') || null;
  const addIngredientBtn = document.getElementById('addIngredientBtn');
  const cancelBtn = document.getElementById('addMealCancel');
  const titleEl = document.getElementById('addMealTitle');

  if (!form || !ingredientsContainer) {
    console.warn('[Add Meal Modal] form or ingredientsContainer missing');
    return;
  }

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

    const colNum = document.createElement('div');
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

    ingredientsContainer.parentNode.insertBefore(header, ingredientsContainer);
    return header;
  }

  async function createIngredientRow(prefillName = '', preQty = '', preUnit = '') {
    const rowCount = ingredientsContainer.querySelectorAll('.ingredient-row').length + 1;

    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '8px';
    row.style.padding = '12px 0';
    row.style.borderBottom = '1px solid rgba(0,0,0,0.06)';

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

    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.gap = '12px';
    inputRow.style.alignItems = 'center';
    inputRow.style.width = '100%';
    inputRow.style.boxSizing = 'border-box';

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

    inputRow.appendChild(nameWrap);
    inputRow.appendChild(qtyInput);
    inputRow.appendChild(unitInput);
    inputRow.appendChild(removeBtn);

    labelRow.appendChild(numberBadge);
    labelRow.appendChild(inputRow);

    row.appendChild(labelRow);
    ingredientsContainer.appendChild(row);

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
    const existingHeader = modal.querySelector('.ingredient-header');
    if (existingHeader) existingHeader.remove();
    ingredientsContainer.innerHTML = '';
    ensureIngredientHeader();
    createIngredientRow();
    if (titleEl) titleEl.textContent = `Add Meal for ${slotLabel(activeSlot)}`;

    // Use the shared showModal which manages the global backdrop & z-index stack
    if (typeof showModal === 'function') {
      showModal(modal);
    } else {
      // legacy fallback (kept for safety)
      if (backdrop) {
        backdrop.style.display = 'block';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'rgba(0,0,0,0.45)';
        backdrop.style.zIndex = '11990';
      }

      modal.setAttribute('aria-hidden','false');
      modal.style.display = 'flex';
      modal.style.zIndex = '12000';

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(){
    // Use shared hideModal if available so stacked z-indexes are recomputed
    if (typeof hideModal === 'function') {
      hideModal(modal);
    } else {
      activeSlot = null;
      modal.setAttribute('aria-hidden','true');
      modal.style.display = 'none';

      if (backdrop) {
        backdrop.style.transition = 'background 180ms ease, opacity 180ms ease, backdrop-filter 180ms ease';
        backdrop.style.background = 'rgba(0,0,0,0.0)';
        backdrop.style.backdropFilter = 'blur(0px)';
        backdrop.style.opacity = '0';
        setTimeout(() => {
          try { backdrop.style.display = 'none'; backdrop.onclick = null; } catch(e){}
        }, 200);
      }

      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }

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
    ensureIngredientHeader();
    createIngredientRow();
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();

    const mealNameInput = form.querySelector('input[name="meal_name"]');
    const mealName = (mealNameInput?.value || '').trim();

    if (!mealName) {
      alert('Please enter meal name');
      mealNameInput?.focus();
      return;
    }

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
      meal_date: (function(){
        try {
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

      const raw = await resp.text();
      console.log('[AddMeal] HTTP', resp.status, resp.statusText, 'Content-Type:', resp.headers.get('content-type'));
      console.log('[AddMeal] RAW RESPONSE:', raw);

      let json;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch (parseErr) {
        console.error('[AddMeal] JSON parse error:', parseErr);
        console.error('[AddMeal] Server returned invalid JSON. See RAW RESPONSE above.');
        alert('Server returned an unexpected response. Check browser console for details.');
        return;
      }

      if (!resp.ok || !json || !json.ok) {
        console.error('Save failed', json);
        alert('Failed to save meal: ' + (json && (json.message || json.error) ? (json.message || json.error) : 'Unknown error'));
        return;
      }

      if (typeof reloadMealsForCurrentDate === 'function') {
        try {
          await reloadMealsForCurrentDate();
        } catch (e) {
          console.error('[Add Meal] reload failed', e);
          window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
          window.demoMeals[activeSlot].push(mealName);
          if (typeof renderMeals === 'function') renderMeals();
          if (typeof window.attachMealTileClickHandlers === 'function') window.attachMealTileClickHandlers();
        }
      } else {
        window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
        window.demoMeals[activeSlot].push(mealName);
        if (typeof renderMeals === 'function') renderMeals();
        if (typeof window.attachMealTileClickHandlers === 'function') window.attachMealTileClickHandlers();
      }

      if (typeof inventoryCache !== 'undefined') inventoryCache = null;
      closeModal();
      alert('Meal saved successfully!');
      console.log('[Add Meal] saved:', json);

      location.reload();

    } catch (err) {
      console.error('[Add Meal] fetch error:', err);
      alert('Unable to reach server: ' + (err && err.message ? err.message : String(err)) + '. Check console for details.');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

  // re-export commonly used functions
  window.reloadMealsForCurrentDate = async function() {
    try {
      // try to call the main reload if present in global scope (it is defined above)
      if (typeof window.__internal_reload === 'function') {
        await window.__internal_reload();
      } else {
        // fallback to calling the earlier defined function (we defined reloadMealsForCurrentDate in main scope)
        if (typeof reloadMealsForCurrentDate === 'function') await reloadMealsForCurrentDate();
      }
    } catch (e) {
      console.error('[window.reloadMealsForCurrentDate] error', e);
      throw e;
    }
  };
  window.__real_attachMealTileClickHandlers = attachMealTileClickHandlers;
  window.attachMealTileClickHandlers = window.__real_attachMealTileClickHandlers;
  window.getSelectedDate = function() { 
    try {
      // try to read the pill.active dataset
      const active = document.querySelector('.pill.active')?.dataset?.date;
      if (active) return new Date(active);
    } catch (_) {}
    return new Date();
  };
})(); // end add-meal modal IIFE

// ----------------- friendly hover styles injection -----------------
(function addSlotHoverStyles(){
  const css = `
    .slot-card { transition: transform .12s ease; }
    .slot-card h1, .slot-card h2, .slot-card h3, .slot-card h4, .slot-card .slot-title {
      transition: color .12s ease;
      color: #333 !important;
    }
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
    .slot-card .slot-add:hover,
    .slot-card:hover .slot-add,
    .slot-card .slot-add:focus {
      background: #f39c12 !important;
      color: #ffffff !important;
      border-color: #f39c12 !important;
      box-shadow: 0 8px 24px rgba(243,156,18,0.18);
    }
    .slot-card .slot-add:focus {
      outline: none;
      box-shadow: 0 0 0 4px rgba(243,156,18,0.12);
    }
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
      const candidate = btn.closest('div')?.querySelector('h3') ? btn.closest('div') : null;
      if (candidate) candidate.classList.add('slot-card');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markSlotParents);
  } else {
    markSlotParents();
  }
})();

/// ------------------------ WEEKLY CALENDAR MODAL BEHAVIOR (REPLACEMENT) ------------------------
(function () {
  const modal = document.getElementById('weeklyCalendarModal');
  const tableBody = document.getElementById('weekCalendarBody');
  const tableEl = document.getElementById('weekCalendarTable');
  const rangeLabel = document.getElementById('weekRangeLabel');
  const prevBtn = document.getElementById('weekPrev');
  const nextBtn = document.getElementById('weekNext');
  const closeX = document.getElementById('weeklyCalendarClose');
  const addBtnTop = document.getElementById('weeklyAddMealTop');
  const calendarBtn = document.getElementById('calendarBtn');

  if (!modal || !tableBody || !rangeLabel || !tableEl) {
    console.warn('[WeeklyCalendar] Required elements missing');
    return;
  }

  // ---- helpers ----
  function startOfWeekMon(d) {
    const x = new Date(d);
    const dow = (x.getDay() + 6) % 7;
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() - dow);
    return x;
  }
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function fmtRangeLabel(start) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} — ${end.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`;
  }

  // Monday of current week
  let weekStart = startOfWeekMon(new Date());

  // fetch meals for a single date (calls your backend)
  async function fetchMealsForDate(dateStr) {
    try {
      const uid = window.CURRENT_USER_ID || 0;
      const resp = await fetch(`api/get_meals.php?user_id=${encodeURIComponent(uid)}&date=${encodeURIComponent(dateStr)}&_=${Date.now()}`, { cache:'no-store' });
      if (!resp.ok) return [];
      const j = await resp.json();
      if (!j || !j.ok || !Array.isArray(j.meals)) return [];
      return j.meals;
    } catch (e) {
      console.warn('[fetchMealsForDate]', e);
      return [];
    }
  }

  // normalize slot string -> one of breakfast,lunch,dinner,snacks
  function normalizeSlot(slot) {
    if (!slot) return 'snacks';
    const s = String(slot).toLowerCase();
    if (s.startsWith('break')) return 'breakfast';
    if (s.startsWith('lunc')) return 'lunch';
    if (s.startsWith('dinn')) return 'dinner';
    return 'snacks';
  }

  // build a day row DOM from the day's meals
  function buildRowForDate(d, mealsForThisDate) {
    const tr = document.createElement('tr');

    // Day cell
    const dayTd = document.createElement('td');
    dayTd.style.padding = '10px';
    dayTd.style.verticalAlign = 'middle';
    dayTd.style.textAlign = 'left';
    dayTd.innerHTML = `<strong>${d.toLocaleDateString('en-GB',{weekday:'long'})}</strong>`;
    tr.appendChild(dayTd);

    // prepare arrays grouped by slot (do not mutate global state)
    const groups = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    (mealsForThisDate || []).forEach(m => {
      const slot = normalizeSlot(m.meal_slot);
      groups[slot].push({
        name: m.meal_name || 'Untitled',
        remark: m.meal_remark || '',
        raw: m
      });
    });

    // helper to create a td with centered column content and equal spacing
    function makeSlotTd(items) {
      const td = document.createElement('td');
      td.style.verticalAlign = 'middle';
      td.style.textAlign = 'center';
      td.style.padding = '8px';

      const wrap = document.createElement('div');

      // make layout responsive: row when multiple tiles, column when single/none
      wrap.style.display = 'flex';
      wrap.style.flexDirection = (items && items.length > 1) ? 'row' : 'column';
      wrap.style.flexWrap = 'wrap';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = (items && items.length > 1) ? 'flex-start' : 'center';
      wrap.style.gap = '10px';
      wrap.style.minHeight = '46px';
      wrap.style.padding = '6px';

      if (!items || items.length === 0) {
        // invisible spacer so empty cells keep height and center alignment
        const spacer = document.createElement('div');
        spacer.style.height = '6px';
        spacer.style.opacity = '0';
        wrap.appendChild(spacer);
      } else {
        items.forEach((it, idx) => {
          const tile = document.createElement('div');
          tile.className = 'week-meal-tile';
          tile.setAttribute('role', 'button');
          tile.setAttribute('tabindex', '0');
          tile.textContent = it.name;

          // make tiles inline-flex so they look nice in a horizontal row
          tile.style.display = 'inline-flex';
          tile.style.alignItems = 'center';
          tile.style.justifyContent = 'center';
          tile.style.margin = '6px 8px'; // small margin around each tile

          tile.addEventListener('click', () => {
            // If we have the raw meal data from the weekly fetch, build a lightweight snapshot
            // so the detail modal can render ingredients and remark immediately.
            let snapshot = null;

            if (it && it.raw) {
              snapshot = {
                // unify field names used by showMealDetailModal
                ingredients: Array.isArray(it.raw.ingredients) ? it.raw.ingredients.map(ing => ({
                  // normalize to what showMealDetailModal expects: name, qty_value, qty_unit, qty_text, expiry_date, storage_place
                  name: ing.item_name_snapshot ?? ing.item_name ?? ing.name ?? ing.ingredient_name ?? '',
                  qty_value: ing.required_qty_value ?? ing.qty_value ?? ing.qty ?? '',
                  qty_unit: ing.required_qty_unit ?? ing.qty_unit ?? ing.unit ?? '',
                  qty_text: ing.required_qty_text ?? ing.qty_text ?? '',
                  expiry_date: ing.expiry_date ?? null,
                  storage_place: ing.storage_place ?? null
                })) : [],
                remark: it.raw.meal_remark ?? it.raw.remark ?? ''
              };
              showMealDetailModal(it.name, snapshot);
              return;
            }

            // fallback to existing snapshot lookup (keeps behavior for tiles loaded from current day)
            if (window.mealSnapshots) {
              for (const k of Object.keys(window.mealSnapshots)) {
                const s = window.mealSnapshots[k];
                if (!s) continue;
                if (s.meal_name === it.name) { snapshot = s; break; }
              }
            }
            showMealDetailModal(it.name, snapshot);
          });
          tile.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tile.click(); } });

          wrap.appendChild(tile);
        });
      }

      td.appendChild(wrap);
      return td;
    }

    tr.appendChild(makeSlotTd(groups.breakfast));
    tr.appendChild(makeSlotTd(groups.lunch));
    tr.appendChild(makeSlotTd(groups.dinner));
    tr.appendChild(makeSlotTd(groups.snacks));

    return tr;
  }

  // recalc tbody height and set each row height equally (removes blank gap)
  function recalcTbodyAndRowHeights() {
    try {
      const thead = tableEl.querySelector('thead');
      const tbody = tableEl.querySelector('tbody');
      const wrapper = modal.querySelector('.week-table-wrap') || tableEl.parentElement;
      if (!thead || !tbody || !wrapper) return;

      // Remove any inline styles previously applied by JS so the CSS table rules take over.
      tbody.style.display = '';
      tbody.style.height = '';
      tbody.style.overflow = '';

      // Make each row a proper table-row and clear forced heights/widths.
      Array.from(tbody.querySelectorAll('tr')).forEach(r => {
        r.style.display = '';
        r.style.width = '';
        r.style.height = '';
      });

      // Nothing else — let CSS control equal row heights.
    } catch (e) {
      console.warn('[recalcTbodyAndRowHeights] error', e);
    }
  }

  // render the whole week: fetch meals per day and append rows
  async function renderWeek() {
    rangeLabel.textContent = fmtRangeLabel(weekStart);
    tableBody.innerHTML = '';

    // compute dates for the week
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      d.setHours(12, 0, 0, 0);
      dates.push(d);
    }

    // fetch all days in parallel (but keep order)
    const promises = dates.map(d => fetchMealsForDate(isoDate(d)));
    const results = await Promise.all(promises);

    for (let i = 0; i < dates.length; i++) {
      const row = buildRowForDate(dates[i], results[i]);
      tableBody.appendChild(row);
    }

    // ensure layout + heights correct after DOM insertion
    // small timeout lets the browser compute sizes
    setTimeout(recalcTbodyAndRowHeights, 30);
  }

  // show / hide modal helpers (use existing showModal/hideModal if present)
  function openWeeklyModal() {
    if (typeof showModal === 'function') {
      showModal(modal);
    } else {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    // render after shown so measurements are correct
    setTimeout(() => renderWeek().catch(console.warn), 40);
  }
  function closeWeeklyModal() {
    if (typeof hideModal === 'function') {
      hideModal(modal);
    } else {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }

  // wire buttons
  if (calendarBtn) calendarBtn.addEventListener('click', (e) => { e.preventDefault(); openWeeklyModal(); });
  prevBtn?.addEventListener('click', () => { weekStart.setDate(weekStart.getDate() - 7); renderWeek(); });
  nextBtn?.addEventListener('click', () => { weekStart.setDate(weekStart.getDate() + 7); renderWeek(); });
  closeX?.addEventListener('click', closeWeeklyModal);
  addBtnTop?.addEventListener('click', () => {
    const chooseModal = document.getElementById('chooseDateSlotModal');
    const dateInput = document.getElementById('chooseDateSlotDate');
    if (dateInput) dateInput.value = isoDate(weekStart);
    if (typeof showModal === 'function') showModal(chooseModal);
  });

  // when window resizes, recompute heights if modal is visible
  window.addEventListener('resize', () => { if (modal && modal.style.display !== 'none') recalcTbodyAndRowHeights(); });

  // expose renderWeek if other code wants it
  window.renderWeek = renderWeek;
})();

function fixIngredientModalZ() {
  const weekly = document.getElementById("weeklyCalendarModal");
  const ingModal = document.getElementById("recipeDetailModal");
  if (!ingModal) return;

  // move modal to body to escape parent stacking contexts
  if (ingModal.parentNode !== document.body) {
    try { document.body.appendChild(ingModal); } catch (e) { /* ignore */ }
  }

  // ensure modal uses the shared modal stacking (same numbers as showModal)
  const BACKDROP_ID = 'global-modal-backdrop';
  const BACKDROP_Z = 11990;
  const MODAL_Z    = 12000;
  const PANEL_Z    = 12010;

  // find or create the global backdrop
  let backdrop = document.getElementById(BACKDROP_ID);
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    document.body.appendChild(backdrop);
  } else if (backdrop.parentNode !== document.body) {
    try { document.body.appendChild(backdrop); } catch(e){}
  }

  try {
    Object.assign(backdrop.style, {
      display: 'block',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: String(BACKDROP_Z),
      pointerEvents: 'auto'
    });
  } catch (e){}

  try {
    // make the modal container visible and positioned like other modals
    Object.assign(ingModal.style, {
      display: 'flex',
      position: 'fixed',
      inset: '0',
      zIndex: String(MODAL_Z),
      pointerEvents: 'auto'
    });
    ingModal.setAttribute('aria-hidden','false');
  } catch (e){}

  try {
    const panel = ingModal.querySelector('.modal-panel') || ingModal.querySelector('.modal-dialog') || ingModal;
    if (panel) {
      panel.style.position = panel.style.position || 'relative';
      panel.style.zIndex = String(PANEL_Z);
      panel.style.pointerEvents = 'auto';
    }
  } catch (e){}

  // if weekly calendar exists, ensure it sits below normal modals
  if (weekly) {
    try {
      const current = Number(weekly.style.zIndex) || 0;
      if (!current || current > 8000) weekly.style.zIndex = '8000';
    } catch (e) {}
  }
}

document.getElementById("weeklyAddMealTop").addEventListener("click", () => {
  showModal(document.getElementById("addCalendarMealModal"));
});

const addCalendarMealModal = document.getElementById("addCalendarMealModal");

document.getElementById("addCalendarMealClose").onclick = () => hideModal(addCalendarMealModal);
document.getElementById("addCalendarMealCancel").onclick = () => hideModal(addCalendarMealModal);
document.getElementById("addCalendarMealBackdrop").onclick = () => hideModal(addCalendarMealModal);

document.getElementById("calAddIngredientBtn").addEventListener("click", () => {
  const wrap = document.getElementById("calIngredientsContainer");

  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
      <div style="display:flex; gap:12px; margin-bottom:8px;">
        <span style="background:#4a7c59; color:#fff; width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:700;">${wrap.children.length + 1}</span>
        <input class="ingredient-name" placeholder="Ingredient name">
        <input class="ingredient-qty" placeholder="Qty">
        <input class="ingredient-unit" placeholder="Unit">
        <button class="ingredient-remove" style="border:1px solid #ccc; border-radius:8px;">×</button>
      </div>
  `;

  row.querySelector(".ingredient-remove").onclick = () => {
    row.remove();
  };

  wrap.appendChild(row);
});

(function wireWeeklyAddToNewModal() {
  const calBtn = document.getElementById('weeklyAddMealTop'); // calendar modal "Add a Meal" button
  const newModal = document.getElementById('addCalendarMealModal');
  const weeklyModal = document.getElementById('weeklyCalendarModal');

  if (!calBtn || !newModal) return;

  // Move modal to body so it escapes any parent stacking contexts.
  if (newModal.parentNode !== document.body) {
    try { document.body.appendChild(newModal); } catch (e) { /* ignore */ }
  }

  // Make sure the modal panel is above other modals created by showModal
  const panel = newModal.querySelector('.modal-panel') || newModal;
  Object.assign(newModal.style, { position: 'fixed', inset: '0', display: newModal.style.display || 'none' });
  if (panel) {
    panel.style.position = panel.style.position || 'relative';
    // pick numbers clearly above your calendar modal (calendar uses ~8000) and your normal modals (12000)
    panel.style.zIndex = '12510';
    newModal.style.zIndex = '12500';
  }

  // Ensure the global backdrop will be used (hide any internal backdrop element if present)
  const internalBackdrop = document.getElementById('addCalendarMealBackdrop');
  if (internalBackdrop) internalBackdrop.style.display = 'none';

  // Add a capture-phase handler that blocks other handlers on this element,
  // and then shows our modal. stopImmediatePropagation prevents other listeners on same target.
  calBtn.addEventListener('click', function weeklyAddHandler(evt) {
    try {
      evt.stopImmediatePropagation(); // stop other handlers attached to same element
      evt.preventDefault();
    } catch (e) {}

    // optionally keep weekly modal visible underneath: do NOT hide it
    // if you prefer to hide calendar when opening this modal, uncomment next line:
    // if (typeof hideModal === 'function' && weeklyModal) hideModal(weeklyModal);

    // ensure new modal attached to body and show it using your existing showModal helper
    try {
      if (newModal.parentNode !== document.body) document.body.appendChild(newModal);
      // ensure global showModal is used (it will create or reuse global-modal-backdrop)
      if (typeof showModal === 'function') {
        showModal(newModal);
      } else {
        newModal.style.display = 'flex';
        newModal.setAttribute('aria-hidden','false');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      }
    } catch (e) {
      console.error('[weeklyAddHandler] show failed', e);
    }
  }, /* useCapture = */ true);

  // Add close hooks (if you didn't already)
  document.getElementById("addCalendarMealClose")?.addEventListener("click", () => {
    if (typeof hideModal === 'function') hideModal(newModal); else newModal.style.display='none';
  });
  document.getElementById("addCalendarMealCancel")?.addEventListener("click", () => {
    if (typeof hideModal === 'function') hideModal(newModal); else newModal.style.display='none';
  });
})();

(function ensureAddCalendarModalOnTop() {
  const weekModal = document.getElementById('weeklyCalendarModal');
  const calAddBtn = document.getElementById('weeklyAddMealTop'); // calendar's "Add a Meal" button
  const newModal = document.getElementById('addCalendarMealModal');
  if (!calAddBtn || !newModal) return;

  // Move modal container and its panel to body to escape stacking contexts
  function moveToBody(el) {
    if (!el) return;
    try {
      if (el.parentNode !== document.body) document.body.appendChild(el);
    } catch (e) { /* ignore */ }
  }

  moveToBody(newModal);
  const panel = newModal.querySelector('.modal-panel') || newModal;

  // Helper to set z-index ordering for global backdrop, modal container, and panel
  function setModalZIndexes(opts = {}) {
    const BACKDROP_ID = 'global-modal-backdrop';
    const BACKDROP_Z = opts.backdropZ ?? 12490;
    const MODAL_Z    = opts.modalZ ?? 12500;
    const PANEL_Z    = opts.panelZ ?? 12510;

    // ensure a single global backdrop exists and sits under modal container
    let backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      document.body.appendChild(backdrop);
    } else if (backdrop.parentNode !== document.body) {
      try { document.body.appendChild(backdrop); } catch(e) {}
    }

    Object.assign(backdrop.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: String(BACKDROP_Z),
      pointerEvents: 'auto'
    });

    // modal container
    try {
      Object.assign(newModal.style, {
        display: newModal.style.display || 'none',
        position: 'fixed',
        inset: '0',
        zIndex: String(MODAL_Z),
        pointerEvents: 'auto'
      });
    } catch(e){}

    // panel (actual dialog box)
    if (panel) {
      try {
        panel.style.position = panel.style.position || 'relative';
        panel.style.zIndex = String(PANEL_Z);
        panel.style.pointerEvents = 'auto';
      } catch(e){}
    }

    // nudge weekly modal (if present) to a lower stacking context to be safe
    if (weekModal) {
      try {
        // if weekly modal panel has very high z, make it lower than our backdrop
        const weekPanel = weekModal.querySelector('.modal-panel') || weekModal;
        if (weekPanel) {
          weekPanel.style.zIndex = String(Math.max(8000, BACKDROP_Z - 100));
        }
        weekModal.style.zIndex = String(Math.max(8000, BACKDROP_Z - 200));
      } catch(e){}
    }
  }

  // initialize z-index scheme
  setModalZIndexes();

  // When opening the add-calendar modal, ensure it is attached to body and visible above weekly modal.
  function openAddCalendarModal() {
    try {
      moveToBody(newModal);
      // ensure global backdrop is present and visible
      const bd = document.getElementById('global-modal-backdrop');
      if (bd) bd.style.display = 'block';

      // show using centralized showModal if available (keeps behavior consistent)
      if (typeof showModal === 'function') {
        showModal(newModal);
      } else {
        newModal.style.display = 'flex';
        newModal.setAttribute('aria-hidden','false');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      }

      // small timeout to allow showModal to create/attach nodes then force z-index (robust)
      setTimeout(() => {
        setModalZIndexes();
        // ensure panel is at very high z if something else still overlaps
        try {
          const PANEL_Z_OVERRIDE = 2147483500; // extremely high to beat any stubborn stacking contexts
          if (panel) panel.style.zIndex = String(PANEL_Z_OVERRIDE);
          // keep backdrop slightly below panel
          const bd2 = document.getElementById('global-modal-backdrop');
          if (bd2) bd2.style.zIndex = String(PANEL_Z_OVERRIDE - 20);
        } catch(e){}
      }, 25);

    } catch (e) {
      console.error('[openAddCalendarModal] error', e);
    }
  }

  // Add capture-phase click handler on the calendar's Add button to block other handlers and open our modal
  calAddBtn.addEventListener('click', function handler(ev) {
    try {
      ev.stopImmediatePropagation();
      ev.preventDefault();
    } catch (e){}

    openAddCalendarModal();
  }, true /* capture */);

  // Close hooks: prefer hideModal so backdrop is handled consistently
  document.getElementById('addCalendarMealClose')?.addEventListener('click', () => {
    if (typeof hideModal === 'function') hideModal(newModal);
    else newModal.style.display = 'none';
  });
  document.getElementById('addCalendarMealCancel')?.addEventListener('click', () => {
    if (typeof hideModal === 'function') hideModal(newModal);
    else newModal.style.display = 'none';
  });

  // Also ensure if the calendar modal is programmatically closed while ours is open we re-assert z-order
  const observer = new MutationObserver(() => {
    setModalZIndexes();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
    // stop observing after 20s to avoid long-lived observers
    setTimeout(() => observer.disconnect(), 20000);
  } catch (e) {}
})();

(function wireAddCalendarSaveRobust_PHPIDs() {
  const SAVE_HANDLER_ID = 'addCalendarMealSubmit';
  const MODAL_ID = 'addCalendarMealModal';
  const ENDPOINT = 'api/save_meal_plan.php'; // <- change to 'api/save_meal_plan.php' if that's where your file lives
  const MAX_RETRIES = 8;
  const RETRY_MS = 180;

  function findModal(retries = 0) {
    const m = document.getElementById(MODAL_ID);
    if (m) return Promise.resolve(m);
    if (retries >= MAX_RETRIES) return Promise.resolve(null);
    return new Promise(resolve => setTimeout(() => resolve(findModal(retries + 1)), RETRY_MS));
  }

  async function init() {
    const modal = await findModal();
    if (!modal) {
      console.warn('[AddCalendarSave] modal not found (id=' + MODAL_ID + ')');
      return;
    }

    const saveBtn = document.getElementById(SAVE_HANDLER_ID) || modal.querySelector('#' + SAVE_HANDLER_ID);
    if (!saveBtn) {
      console.warn('[AddCalendarSave] save button not found inside modal (id=' + SAVE_HANDLER_ID + ')');
      return;
    }

    try {
      const newBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    } catch (e) {}

    const finalBtn = document.getElementById(SAVE_HANDLER_ID) || modal.querySelector('#' + SAVE_HANDLER_ID);

    finalBtn.addEventListener('click', async function onSave(evt) {
      try { evt.preventDefault(); } catch (_) {}
      const btn = this;
      const origText = btn.textContent || 'Add';
      try { btn.disabled = true; btn.textContent = 'Saving...'; } catch (e) {}

      try {
        const modalNow = document.getElementById(MODAL_ID);
        if (!modalNow) { alert('Internal: modal not found'); return; }

        const date = (modalNow.querySelector('#calMealDate')?.value || '').trim();
        const slotRaw = (modalNow.querySelector('#calMealSlot')?.value || 'lunch').trim();
        const mealName = (modalNow.querySelector('input[name="meal_name"]')?.value || '').trim();
        const remark = (modalNow.querySelector('textarea[name="meal_remark"]')?.value || '').trim();
        const uid = window.CURRENT_USER_ID || window.loggedUserId || 0;

        if (!uid || Number(uid) <= 0) { alert('Cannot save: user not logged in (user id missing).'); return; }
        if (!date) { alert('Please select a date'); return; }
        if (!mealName) { alert('Please enter meal name'); return; }

        const ingWrap = modalNow.querySelector('#calIngredientsContainer');
        const ingRows = ingWrap ? Array.from(ingWrap.children).filter(n => n) : [];
        const ingredients = ingRows.map(r => {
          const name = (r.querySelector('.ingredient-name')?.value || r.querySelector('input[type="text"]')?.value || '').trim();
          const qty  = (r.querySelector('.ingredient-qty')?.value || r.querySelector('input[placeholder="Qty"]')?.value || '').trim();
          const unit = (r.querySelector('.ingredient-unit')?.value || r.querySelector('input[placeholder="Unit"]')?.value || '').trim();
          return name ? { name, qty_value: qty, qty_unit: unit } : null;
        }).filter(x => x);

        const payload = {
          user_id: Number(uid),
          meal_date: date,
          meal_slot: slotRaw,
          meal_name: mealName,
          remark: remark,
          ingredients: ingredients
        };

        console.log('[AddCalendarSave] payload', payload);

        // build form data
        const formData = new FormData();
        formData.append('user_id', String(payload.user_id));
        formData.append('meal_date', String(payload.meal_date));
        formData.append('meal_slot', String(payload.meal_slot));
        formData.append('meal_name', String(payload.meal_name));
        formData.append('meal_remark', String(payload.remark || ''));
        formData.append('ingredients', JSON.stringify(payload.ingredients || []));

        const resp = await fetch(ENDPOINT, { method: 'POST', body: formData });

        const raw = await resp.text();
        console.log('[AddCalendarSave] HTTP', resp.status, resp.statusText, 'raw len', raw ? raw.length : 0);
        console.debug('[AddCalendarSave] RAW RESPONSE >>>', raw);

        let j = null;
        try { j = raw ? JSON.parse(raw) : null; }
        catch (parseErr) {
          console.error('[AddCalendarSave] JSON parse error:', parseErr, raw.slice(0,1000));
          alert('Server returned non-JSON response. See console for raw response.');
          return;
        }

        if (!resp.ok || !j || !j.ok) {
          alert('Failed to save meal: ' + (j && (j.message || j.error) ? (j.message || j.error) : 'Unknown server error. See console.'));
          console.error('[AddCalendarSave] server error', j);
          return;
        }

        // success: hide modal and refresh UI
        try { 
          try { if (typeof hideModal === 'function') hideModal(modalNow); } catch(_) {}
          try { modalNow.style.display = 'none'; modalNow.setAttribute('aria-hidden','true'); } catch(_) {}
          try { 
            const tryIds = ['addCalendarClose','addCalendarMealClose','addCalendarCancel','addCalendarCloseBtn'];
            for (const id of tryIds) {
              const b = document.getElementById(id);
              if (b && b.offsetParent !== null) { b.click(); break; }
            }
          } catch(_) {}
        } catch(e) { console.warn('[AddCalendarSave] close modal fallback error', e); }

        function normDate(d) {
          if (!d) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
          if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(d)) {
            const parts = d.split(/[-\/]/);
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          }
          const dt = new Date(d);
          if (!isNaN(dt)) return dt.toISOString().slice(0,10);
          return d;
        }

        const savedDate = normDate(payload.meal_date || '');
        console.log('[AddCalendarSave] savedDate ->', savedDate, 'payload:', payload);

        try {
          // set page-level selected date so day view knows what to show
          if (typeof window.setMealDate === 'function') {
            try { window.setMealDate(savedDate); console.log('[AddCalendarSave] called setMealDate'); } catch(e) { console.warn(e); }
          } else if (typeof window.setSelectedDate === 'function') {
            try { window.setSelectedDate(savedDate); console.log('[AddCalendarSave] called setSelectedDate'); } catch(e) { console.warn(e); }
          } else {
            const jump = document.getElementById('jumpDate');
            if (jump) {
              try { jump.value = savedDate; jump.dispatchEvent(new Event('change')); console.log('[AddCalendarSave] set #jumpDate'); } catch(e) { console.warn(e); }
            }
          }
        } catch(e){ console.warn('[AddCalendarSave] set date error', e); }

        // Reload day-slot lists (await so UI updates)
        try {
          if (typeof reloadMealsForCurrentDate === 'function') {
            await reloadMealsForCurrentDate(savedDate);
            console.log('[AddCalendarSave] reloadMealsForCurrentDate completed for', savedDate);
          } else {
            console.warn('[AddCalendarSave] reloadMealsForCurrentDate not available');
          }
        } catch(e) {
          console.warn('[AddCalendarSave] reloadMealsForCurrentDate error', e);
        }

        // Refresh weekly calendar (try a list of likely functions)
        try {
          const weeklyFns = ['renderWeek','renderWeeklyCalendar','renderWeeklyView','renderWeekCalendar','drawWeeklyCalendar'];
          for (const fnName of weeklyFns) {
            try {
              const fn = window[fnName];
              if (typeof fn === 'function') { try { fn(); console.log('[AddCalendarSave] called weekly render', fnName); } catch(e){ console.warn('[AddCalendarSave] error calling', fnName, e); } }
            } catch(e){}
          }
          // event for any other listeners
          try { document.dispatchEvent(new CustomEvent('mealSaved', { detail: payload })); console.log('[AddCalendarSave] dispatched mealSaved'); } catch(_) {}
        } catch(e) { console.warn('[AddCalendarSave] weekly refresh error', e); }

        alert('Meal saved successfully!');
      } catch (err) {
        console.error('[AddCalendarSave] error', err);
        alert('Error while saving. See console.');
      } finally {
        try { btn.disabled = false; btn.textContent = origText; } catch(e){}
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init().catch(e=>console.error(e)); });
  } else {
    init().catch(e=>console.error(e));
  }
})();

async function reloadMealsForCurrentDate(dateStr) {
  try {
    // Determine date to load: explicit param, or page selected date function, or today
    let dateToUse = dateStr || (typeof window.getSelectedDate === 'function' ? window.getSelectedDate() : null);
    if (!dateToUse) {
      const jump = document.getElementById('jumpDate');
      if (jump && jump.value) dateToUse = jump.value;
      else dateToUse = new Date().toISOString().slice(0,10);
    }
    // endpoints to try (first that returns ok JSON will be used)
    const tryUrls = ['api/get_meals.php?date=' + encodeURIComponent(dateToUse), 'get_meals.php?date=' + encodeURIComponent(dateToUse)];

    let resp = null, raw = null, json = null;
    for (const u of tryUrls) {
      try {
        resp = await fetch(u, { cache: 'no-store' });
        raw = await resp.text();
        // try parse JSON, if parse fails continue to next url
        try { json = raw ? JSON.parse(raw) : null; } catch(e) { json = null; }
        if (resp.ok && json && Array.isArray(json)) break;
      } catch (e) {
        // network error - try next URL
        json = null;
      }
    }

    if (!json || !Array.isArray(json)) {
      console.warn('[reloadMealsForCurrentDate] No JSON array returned from get_meals endpoints. Raw response:', raw);
      return;
    }

    // normalize list by slot
    const slots = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    json.forEach(m => {
      // adapt to your API shape:
      // expected minimal: m.meal_slot (e.g. 'breakfast'), m.meal_name, m.meal_id, m.remark, m.items (optional)
      const slot = (m.meal_slot || m.slot || '').toLowerCase();
      const s = slots[slot] || slots['breakfast']; // fallback if unknown
      s.push(m);
    });

    // containers
    const containerMap = {
      breakfast: document.getElementById('breakfast-list'),
      lunch: document.getElementById('lunch-list'),
      dinner: document.getElementById('dinner-list'),
      snacks: document.getElementById('snacks-list')
    };

    // helper to create a meal node
    function createMealCard(meal) {
      const wrapper = document.createElement('div');
      wrapper.className = 'meal-card';
      // basic style (optional) - you can remove or replace with your classes
      wrapper.style.padding = '8px 10px';
      wrapper.style.marginBottom = '8px';
      wrapper.style.borderRadius = '8px';
      wrapper.style.background = '#fff';
      wrapper.style.boxShadow = '0 1px 0 rgba(0,0,0,0.03)';

      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = meal.meal_name || meal.name || 'Unnamed meal';
      wrapper.appendChild(title);

      if (meal.remark) {
        const r = document.createElement('div');
        r.style.fontSize = '12px';
        r.style.color = '#666';
        r.textContent = meal.remark;
        wrapper.appendChild(r);
      }

      // optional: show ingredients if present
      const items = meal.items || meal.ingredients || [];
      if (Array.isArray(items) && items.length) {
        const ul = document.createElement('ul');
        ul.style.margin = '6px 0 0 0';
        ul.style.paddingLeft = '18px';
        ul.style.fontSize = '13px';
        items.slice(0,5).forEach(it => {
          const li = document.createElement('li');
          // attempt to display "name (qty unit)" in reasonable ways
          const nm = it.name || it.item_name_snapshot || it.item || '';
          const qv = it.qty_value || it.required_qty_value || it.qty || '';
          const qu = it.qty_unit || it.required_qty_unit || it.unit || '';
          li.textContent = nm + (qv ? ` — ${qv}${qu ? ' ' + qu : ''}` : '');
          ul.appendChild(li);
        });
        wrapper.appendChild(ul);
      }

      return wrapper;
    }

    // clear and render
    Object.keys(containerMap).forEach(k => {
      const el = containerMap[k];
      if (!el) return;
      el.innerHTML = ''; // clear
      (slots[k] || []).forEach(meal => {
        el.appendChild(createMealCard(meal));
      });
    });

    console.log('[reloadMealsForCurrentDate] rendered date', dateToUse);
  } catch (err) {
    console.error('[reloadMealsForCurrentDate] error', err);
  }
}