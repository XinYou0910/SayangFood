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
    }
  });

  document.getElementById("prevDay")?.addEventListener("click", ()=>{
    state.selected.setDate(state.selected.getDate()-1);
    renderStrip(); renderDayTitle();
  });
  document.getElementById("nextDay")?.addEventListener("click", ()=>{
    state.selected.setDate(state.selected.getDate()+1);
    renderStrip(); renderDayTitle();
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
    });
  })();

  function renderMeals(){
    ["breakfast","lunch","dinner","other"].forEach(slot=>{
      const container = document.getElementById(slot + "-list");
      if (!container) return;
      const tiles = (window.demoMeals[slot] || []).map(n =>
        `<div class="meal-tile" data-name="${escapeHtml(n)}">${escapeHtml(n)}</div>`
      ).join('');
      container.innerHTML = tiles;
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

  document.addEventListener("DOMContentLoaded", () => {
    renderStrip();
    renderDayTitle();
    renderSuggestions();
    renderExpiring();
    renderMeals();
  });

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

// ------------------------ Add Meal Modal with ingredient search ------------------------

(function(){
  const modal = document.getElementById('addMealModal');
  if (!modal) return;

  const backdrop            = document.getElementById('addMealBackdrop');
  const closeBtn            = document.getElementById('addMealClose');
  const form                = document.getElementById('addMealForm');
  const mealNameInput       = document.getElementById('mealNameInput');
  const ingredientsContainer= document.getElementById('ingredientsContainer');
  const addIngredientBtn    = document.getElementById('addIngredientBtn');
  const cancelBtn           = document.getElementById('addMealCancel');
  const titleEl             = document.getElementById('addMealTitle');

  [backdrop, closeBtn, form, mealNameInput, ingredientsContainer, addIngredientBtn, cancelBtn]
    .forEach(el => { if (!el) console.warn('Add-meal script expected element missing', el); });

  // create ingredient row
  async function createIngredientRow(prefillName = '', preQty = '', preUnit = '') {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.style.position = 'relative';
    row.style.display  = 'flex';
    row.style.gap      = '8px';
    row.style.marginBottom = '8px';
    row.style.alignItems   = 'center';

    // NAME
    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    nameWrap.style.position = 'relative';

    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'ingredient-name';
    nameInput.placeholder = 'Ingredient name';
    nameInput.value       = prefillName || '';
    nameInput.style.width = '100%';
    nameInput.autocomplete = 'off';

    const hiddenId = document.createElement('input');
    hiddenId.type      = 'hidden';
    hiddenId.className = 'ingredient-item-id';

    const suggestBox = document.createElement('div');
    suggestBox.className = 'suggest-list';
    Object.assign(suggestBox.style, {
      position: 'absolute',
      left: '0',
      top: 'calc(100% + 6px)',
      zIndex: '12000',
      minWidth: '260px',
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

    // QUANTITY VALUE
    const qtyInput = document.createElement('input');
    qtyInput.type        = 'text';
    qtyInput.placeholder = 'e.g. 2';
    qtyInput.className   = 'ingredient-qty';
    qtyInput.style.width = '110px';
    qtyInput.value       = preQty || '';

    // UNIT
    const unitInput = document.createElement('input');
    unitInput.type        = 'text';
    unitInput.className   = 'ingredient-unit';
    unitInput.placeholder = 'unit (g / kg / pcs)';
    unitInput.style.width = '140px';
    unitInput.value       = preUnit || '';

    const unitDatalistId = 'unit-options-datalist';
    if (!document.getElementById(unitDatalistId)) {
      const dl = document.createElement('datalist');
      dl.id = unitDatalistId;
      ['g','kg','pcs','pack','packs','ml','l','tbsp','tsp'].forEach(u=>{
        const opt = document.createElement('option');
        opt.value = u;
        dl.appendChild(opt);
      });
      document.body.appendChild(dl);
    }
    unitInput.setAttribute('list', unitDatalistId);

    // REMOVE
    const removeBtn = document.createElement('button');
    removeBtn.type  = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className   = 'ingredient-remove';
    Object.assign(removeBtn.style, {
      border: '1px solid rgba(0,0,0,0.08)',
      background: '#fff',
      borderRadius: '6px',
      padding: '6px 8px',
      cursor: 'pointer'
    });

    row.appendChild(nameWrap);
    row.appendChild(qtyInput);
    row.appendChild(unitInput);
    row.appendChild(removeBtn);
    ingredientsContainer.appendChild(row);

    // suggestions
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
            hiddenId.value  = '';
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
              hiddenId.value  = it.item_id ?? '';

              // auto-fill quantity value and unit from DB
              if (it.quantity_value != null && it.quantity_value !== '') {
                qtyInput.value = it.quantity_value;
              } else if (it.quantity) {
                // fallback: try to parse number from "2 kg"
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
      }, 200);
    });

    document.addEventListener('click', ev => {
      if (!nameWrap.contains(ev.target)) suggestBox.style.display = 'none';
    });

    removeBtn.addEventListener('click', () => row.remove());

    return row;
  }

  // modal open/close
  let activeSlot = null;
  function slotLabel(slot){
    if (!slot) return 'Meal';
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  }

  function openModal(slot){
    activeSlot = slot || 'lunch';
    try { form.reset(); } catch(e){}
    ingredientsContainer.innerHTML = '';
    createIngredientRow(); // one blank row

    if (titleEl) {
      titleEl.textContent = `Add Meal for ${slotLabel(activeSlot)}`;
    }

    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'flex';
    setTimeout(()=>{ try{ mealNameInput.focus(); }catch(e){} }, 60);
  }

  function closeModal(){
    activeSlot = null;
    modal.setAttribute('aria-hidden','true');
    modal.style.display = 'none';
  }

  // hook plus buttons
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
    createIngredientRow();
  });

  // submit
  form?.addEventListener('submit', ev => {
    ev.preventDefault();
    const mealName = (mealNameInput.value || '').trim();
    if (!mealName) {
      alert('Please enter meal name');
      mealNameInput.focus();
      return;
    }

    const rows = Array.from(ingredientsContainer.querySelectorAll('.ingredient-row'));
    const ingredients = rows.map(row => {
      const nameInput = row.querySelector('.ingredient-name');
      if (!nameInput) return null;
      const idInput   = row.querySelector('.ingredient-item-id');
      const qtyInput  = row.querySelector('.ingredient-qty');
      const unitInput = row.querySelector('.ingredient-unit');
      return {
        name      : (nameInput.value || '').trim(),
        item_id   : idInput && idInput.value ? idInput.value : null,
        qty_value : (qtyInput && qtyInput.value ? qtyInput.value.trim() : ''),
        qty_unit  : (unitInput && unitInput.value ? unitInput.value.trim() : '')
      };
    }).filter(x => x && x.name);

    // push meal into UI store
    window.demoMeals[activeSlot] = window.demoMeals[activeSlot] || [];
    const idx = window.demoMeals[activeSlot].length;
    window.demoMeals[activeSlot].push(mealName);

    const key = `${activeSlot}__${idx}__${Date.now()}`;
    window.mealSnapshots = window.mealSnapshots || {};
    window.mealSnapshots[key] = {
      slot: activeSlot,
      index: idx,
      meal_name: mealName,
      category: '',       // no more category field
      ingredients
    };

    if (typeof window.renderMeals === 'function') {
      try { window.renderMeals(); } catch(e) { console.warn('renderMeals threw', e); }
    } else {
      const c = document.getElementById(activeSlot + '-list');
      if (c) {
        const tile = document.createElement('div');
        tile.className = 'meal-tile';
        tile.textContent = mealName;
        c.appendChild(tile);
      }
    }

    closeModal();
    console.log('[Add Meal] snapshot:', window.mealSnapshots[key]);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

})();  // end modal IIFE
