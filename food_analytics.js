const ctx = document.getElementById("foodChart").getContext("2d");
let currentChart = null;
let lastTrendData = [];
let currentChartMode = "all";   // "all" | "saved" | "waste" | "donation"


document.addEventListener("DOMContentLoaded", () => {
  // default: last 30 days
  loadAnalytics({ range: 30 });

  document.getElementById("filterBtn").addEventListener("click", applyFilter);
  document.getElementById("applyCustomFilter").addEventListener("click", applyCustomDateFilter);
  document.getElementById("trendBtn").addEventListener("click", showTrend);
  document.getElementById("categoryBtn").addEventListener("click", showCategory);

  // === New: card click behaviour ===
  const savingCard   = document.getElementById("card-saving");
  const wasteCard    = document.getElementById("card-waste");
  const donationCard = document.getElementById("card-donation");

  if (savingCard) {
    savingCard.addEventListener("click", () => switchChartMode("saved"));
  }
  if (wasteCard) {
    wasteCard.addEventListener("click", () => switchChartMode("waste"));
  }
  if (donationCard) {
    donationCard.addEventListener("click", () => switchChartMode("donation"));
  }

  // Mark "all" (saved+waste) as initial active – use saving card as default
  setActiveCard("card-saving");
});

function setActiveCard(cardId) {
  document.querySelectorAll(".dashboard-cards .card").forEach(c => {
    c.classList.remove("card-active");
  });
  const el = document.getElementById(cardId);
  if (el) el.classList.add("card-active");
}

function switchChartMode(mode) {
  currentChartMode = mode;

  // map mode to card id
  if (mode === "saved" || mode === "all") {
    setActiveCard("card-saving");
  } else if (mode === "waste") {
    setActiveCard("card-waste");
  } else if (mode === "donation") {
    setActiveCard("card-donation");
  }

  if (lastTrendData && lastTrendData.length > 0) {
    drawTrend(lastTrendData, currentChartMode);
  }
}


// example quick filter
function applyFilter() {
  const range = parseInt(document.getElementById("filterRange").value, 10) || 30;
  loadAnalytics({ range });
}

// example custom calendar filter
function applyCustomDateFilter() {
  const startInput = document.getElementById("startDate").value;
  const endInput   = document.getElementById("endDate").value;

  if (!startInput || !endInput) {
    alert("Please select both start and end dates.");
    return;
  }
  if (startInput > endInput) {
    alert("Start date cannot be after end date.");
    return;
  }

  loadAnalytics({ startDate: startInput, endDate: endInput });
}



function loadAnalytics(options = {}) {
  const { range = 30, startDate = null, endDate = null } = options;
  console.log('Loading analytics with options:', options);

  const params = new URLSearchParams();

  if (startDate && endDate) {
    params.append('start', startDate);
    params.append('end', endDate);
  } else {
    params.append('range', range);
  }

  fetch(`food_analytics_data.php?${params.toString()}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('Analytics data received:', data); // Debugging data received

      if (data.error) {
        console.error('Server error:', data.error, data.details);
        alert('Error loading analytics: ' + data.error);
        return;
      }

            updateSummary(data);

      if (data.trend && data.trend.length > 0) {
        lastTrendData = data.trend;                 // store for later
        drawTrend(lastTrendData, currentChartMode); // draw with current mode
      } else {
        lastTrendData = [];
        console.warn('No trend data available');
      }

      // Update "Expiry soon" table (if you added this earlier)
      if (typeof updateExpirySoon === "function") {
        updateExpirySoon(data.expiry_soon || []);
      }

    })
    .catch(err => {
      console.error("Error loading analytics:", err);
      alert('Failed to load analytics data. Check console for details.');
    });
}

function updateExpirySoon(list) {
  const tbody = document.getElementById("expirySoonBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "empty-row";
    td.textContent = "No items near expiry.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  list.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>${item.quantity}</td>       <!-- 👈 uses the full string, e.g. '1 kg' -->
      <td>${item.expiry_date}</td>
    `;
    tbody.appendChild(tr);
  });
}



function updateSummary(data) {
  // Update summary cards - showing item counts, not KG
  document.getElementById("total-saving").textContent   = `${data.total_saved} Items`;
  document.getElementById("total-waste").textContent    = `${data.total_waste} Items`;
  document.getElementById("total-donation").textContent = `${data.total_donation} Items`;

  console.log('Summary updated:', {
    saved: data.total_saved,
    waste: data.total_waste,
    donation: data.total_donation
  });
}


function drawTrend(trendData, mode = "all") {
  const trendCtx = document.getElementById("foodChart").getContext("2d");

  if (trendChart) trendChart.destroy();

  const labels = trendData.map(d => d.date);

  // Build datasets based on mode
  const datasets = [];
  const savedData   = trendData.map(d => d.saved   || 0);
  const wastedData  = trendData.map(d => d.wasted  || 0);
  const donatedData = trendData.map(d => d.donated || 0);

  if (mode === "all") {
    datasets.push(
        {
      label: 'Food Saved',
      data: savedData,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 5,        // was 3
      pointHoverRadius: 8,   // bigger on hover
      pointHitRadius: 14     // big invisible hit area
    },
    {
      label: 'Food Wasted',
      data: wastedData,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHitRadius: 14
    }

    );
  } else if (mode === "saved") {
    datasets.push({
      label: 'Food Saved',
      data: savedData,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3
    });
  } else if (mode === "waste") {
    datasets.push({
      label: 'Food Wasted',
      data: wastedData,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3
    });
    } else if (mode === "donation") {
      datasets.push({
        label: 'Donations',
        data: donatedData,
        borderColor: '#1d4ed8',              // darker border
        backgroundColor: 'rgba(37,99,235,0.6)', // much darker fill
        fill: true,
        tension: 0.4,
        pointRadius: 3
      });
    }


  // Choose chart type (keep donations as bar if you prefer)
  const chartType = mode === "donation" ? 'bar' : 'line';

trendChart = new Chart(trendCtx, {
  type: chartType,
  data: {
    labels,
    datasets
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,

    // 👇 makes it easy to hover anywhere vertically on that date
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || '';
            const value = ctx.parsed.y ?? ctx.parsed;
            return `${label}: ${value} items`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  }
});


  // Update title + subtitle
  const titleEl = document.getElementById('chartTitle');
  const subEl   = document.getElementById('chartSubtitle');

  if (titleEl && subEl) {
    if (mode === "saved") {
      titleEl.textContent = 'Saved Food Trend';
      subEl.textContent   = 'Daily food saved for selected range';
    } else if (mode === "waste") {
      titleEl.textContent = 'Food Waste Trend';
      subEl.textContent   = 'Daily food wasted for selected range';
    } else if (mode === "donation") {
      titleEl.textContent = 'Donation Trend';
      subEl.textContent   = 'Daily donations for selected range';
    } else { // "all"
      titleEl.textContent = 'Visual Report';
      subEl.textContent   = 'Daily saved vs wasted items';
    }
  }

  setTimeout(() => { try { trendChart.resize(); trendChart.update(); } catch(e){} }, 150);
}


// Draw a donation chart (bar) as a separate full-size report
let donationChart = null;
function drawDonationChart(trendData) {
  const ctx = document.getElementById('donationChart').getContext('2d');
  if (donationChart) donationChart.destroy();

  donationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trendData.map(d => d.date),
      datasets: [{
        label: 'Total Donation',
        data: trendData.map(d => d.donated || 0),
        backgroundColor: 'rgba(10, 96, 235, 0.9)',
        borderColor: '#2563eb',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
  setTimeout(() => { try { donationChart.resize(); donationChart.update(); } catch(e){} }, 150);
}



function drawCategory(categoryData, metric = "percentage") {
  const categoryCtx = document.getElementById("categoryChart").getContext("2d");

  // Destroy previous chart if exists
  if (categoryChart) categoryChart.destroy();

  if (!categoryData || categoryData.length === 0) {
    showNoDataMessage(categoryCtx);
    return;
  }

  // Define a lighter color palette without opacity
  const palette = [
    '#a7f3d0', '#93c5fd', '#fbbf24', '#f87171',
    '#d6b3f1', '#f472b6', '#22d3ee', '#a3e635', '#fd9e2a'
  ];

  // Assign color per category (keeps consistent color across filters/search)
  categoryData.forEach((item, i) => {
    if (!categoryColorMap[item.category]) {
      categoryColorMap[item.category] = palette[i % palette.length];
    }
  });

  const colors = categoryData.map(c => categoryColorMap[c.category]);

  // Set fixed chart canvas size (keeps donut stable)
  categoryCtx.canvas.height = 550;
  categoryCtx.canvas.width = 550;

  // Create solid color slices (no opacity or gradients)
  const backgroundColors = colors; // Directly using solid colors without opacity

  // Select data metric for the chart
  const chartValues = metric === "percentage"
    ? categoryData.map(c => c.percentage)
    : categoryData.map(c => c.count);

  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: categoryData.map(c => c.category),
      datasets: [{
        data: chartValues,
        backgroundColor: backgroundColors, // Solid colors for slices
        borderColor: "#fff", // Solid border color
        borderWidth: 2 // Thicker border for better separation
      }]
    },
    options: {
      cutout: "60%",
      responsive: true,
      maintainAspectRatio: false,
      rotation: -0.5 * Math.PI, // Tilt the chart slightly to give it a 3D effect
      plugins: { legend: { display: false } },
      animation: {
        duration: 1000,  // Smooth animation duration
        easing: 'easeOutBounce'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label;
            const value = metric === "percentage"
              ? `${context.parsed}%`
              : `${context.parsed} items`;
            return `${label}: ${value}`;
          }
        }
      },
      elements: {
        arc: {
          borderWidth: 5,  // Increase border width to create a thicker slice look
          borderColor: 'rgba(255, 255, 255, 0.8)'  // White border for better separation
        }
      }
    }
  });

  // Add a shadow effect on the chart container for a 3D feel
  categoryCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  categoryCtx.shadowBlur = 15;
  categoryCtx.shadowOffsetX = 5;
  categoryCtx.shadowOffsetY = 5;

  // Build custom legend with hover and active state
  const legendContainer = document.getElementById("foodLegend");
  legendContainer.innerHTML = "";

  categoryData.forEach((item, i) => {
    const color = colors[i];
    const legendItem = document.createElement("div");
    legendItem.classList.add("legend-item");
    legendItem.style.display = "flex";
    legendItem.style.justifyContent = "space-between";
    legendItem.style.alignItems = "center";
    legendItem.style.marginBottom = "6px";
    legendItem.style.cursor = "pointer";
    legendItem.style.transition = "opacity 0.3s, transform 0.3s";

    const valueDisplay = metric === "percentage"
      ? `${item.percentage}%`
      : `${item.count} items`;

    legendItem.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="legend-color"
             style="width:16px;height:16px;border-radius:4px;background-color:${color}"></div>
        <span class="legend-label">${item.category}</span>
      </div>
      <span class="legend-value">${valueDisplay}</span>
    `;

    // Hover effect (increase opacity and cursor change)
    legendItem.addEventListener('mouseenter', () => {
      legendItem.style.opacity = '1';
      legendItem.style.transform = 'scale(1.1)';
    });
    legendItem.addEventListener('mouseleave', () => {
      const dataObj = _lastCategoryData.find(d => d.category === item.category);
      legendItem.style.opacity = dataObj.hidden ? '0.4' : '1';
      legendItem.style.transform = 'scale(1)';
    });

    // Toggle visibility on click
    legendItem.addEventListener("click", () => {
      const category = item.category;
      const dataIndex = categoryChart.data.labels.indexOf(category);
      if (dataIndex !== -1) {
        const dataset = categoryChart.data.datasets[0];
        const dataObj = _lastCategoryData.find(d => d.category === category);
        dataObj.hidden = !dataObj.hidden;

        // Hide the data slice visually
        dataset.data[dataIndex] = dataObj.hidden
          ? NaN
          : (metric === "percentage" ? dataObj.percentage : dataObj.count);

        legendItem.style.opacity = dataObj.hidden ? "0.4" : "1";
        legendItem.style.transform = dataObj.hidden ? "scale(0.95)" : "scale(1)";
        categoryChart.update();
      }
    });

    legendContainer.appendChild(legendItem);
  });
}

// --- CATEGORY FILTER LOGIC FIX ---
function renderCategoryWithFilters() {
  if (!_allCategoryData || _allCategoryData.length === 0) return;

  const search = document.getElementById("categorySearch")?.value?.toLowerCase() || "";
  const topNValue = document.getElementById("topN")?.value?.toLowerCase() || "all";
  const metric = document.getElementById("categoryMetric")?.value || "percentage";

  // Start from full dataset each time
  let filtered = _allCategoryData.filter(c =>
    c.category.toLowerCase().includes(search)
  );

  // Sort descending by selected metric
  filtered.sort((a, b) => (b[metric] || 0) - (a[metric] || 0));

  // Handle topN filter (skip slicing for "all")
  if (topNValue !== "all") {
    const topN = parseInt(topNValue, 10);
    if (!isNaN(topN)) filtered = filtered.slice(0, topN);
  }

  // Redraw the chart with consistent colors
  drawCategory(filtered, metric);

  // Update label text
  const labelEl = document.getElementById("categoryLabel");
  if (labelEl) {
    labelEl.textContent =
      metric === "percentage" ? "Category by Percentage" : "Category by Count";
  }
}

function showCategory() {
  console.log("Switching to category view");
  document.getElementById("categoryBtn").classList.add("active");
  document.getElementById("trendBtn").classList.remove("active");
  document.getElementById("trendSection").style.display = "none";
  document.getElementById("categorySection").style.display = "flex";

  const range = document.getElementById("filterRange").value;

  // Force redraw after unhide (helps with invisible chart)
  setTimeout(() => {
    fetch(`food_analytics_data.php?range=${range}`)
      .then(res => res.json())
      .then(data => {
        if (data.category && data.category.length > 0) {
          // cache for filtering
          _allCategoryData = data.category.map(d => ({ ...d }));
          _lastCategoryData = [..._allCategoryData];
          drawCategory(_lastCategoryData);
          // set default filters UI values if present
          document.getElementById('topN').value = '5';
          document.getElementById('categoryMetric').value = 'percentage';

          // wire filter apply button
          const applyBtn = document.getElementById('applyCategoryFilter');
          if (applyBtn) {
            applyBtn.onclick = () => renderCategoryWithFilters();
          }

          // also wire quick input triggers
          const searchInput = document.getElementById('categorySearch');
          if (searchInput) {
            let t;
            searchInput.oninput = () => { clearTimeout(t); t = setTimeout(renderCategoryWithFilters, 300); };
          }

          renderCategoryWithFilters();
        } else {
          const ctx = document.getElementById("categoryChart").getContext("2d");
          showNoDataMessage(ctx);
        }
      })
      .catch(err => console.error("Error loading category:", err));
  }, 100);
}

function showTrend() {
  console.log("Switching to trend view");
  document.getElementById("trendBtn").classList.add("active");
  document.getElementById("categoryBtn").classList.remove("active");

  const trendSection = document.getElementById("trendSection");
  const categorySection = document.getElementById("categorySection");

  trendSection.style.display = "grid";   // 👈 was "block"
  categorySection.style.display = "none";

  setTimeout(() => {
    try {
      if (trendChart) { trendChart.resize(); trendChart.update(); }
      if (donationChart) { donationChart.resize(); donationChart.update(); }
      if (categoryChart) { categoryChart.resize(); categoryChart.update(); }
    } catch (err) {
      console.warn('Error resizing charts on showTrend:', err);
    }
  }, 120);
}

// Ensure charts respond when the window size changes (helps when user resizes
// the browser or returns from another page). This also helps after refresh.
window.addEventListener('resize', () => {
  try {
    if (trendChart) trendChart.resize();
    if (donationChart) donationChart.resize();
    if (categoryChart) categoryChart.resize();
  } catch (e) {
    // non-fatal
  }
});

// Also re-run resize/update when fonts are ready and on full window load.
// Some browsers (and Google Fonts) load after DOMContentLoaded causing Chart.js
// to measure before final font metrics are available which leads to the
// compressed/squashed rendering you reported.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    setTimeout(() => {
      try {
        if (trendChart) { trendChart.resize(); trendChart.update(); }
        if (donationChart) { donationChart.resize(); donationChart.update(); }
        if (categoryChart) { categoryChart.resize(); categoryChart.update(); }
      } catch (e) {}
    }, 120);
  }).catch(() => {});
}

window.addEventListener('load', () => {
  // final safety resize after everything (images, fonts, assets) finished
  setTimeout(() => {
    try {
      if (trendChart) { trendChart.resize(); trendChart.update(); }
      if (donationChart) { donationChart.resize(); donationChart.update(); }
      if (categoryChart) { categoryChart.resize(); categoryChart.update(); }
    } catch (e) {}
  }, 200);
});

function showNoDataMessage(context) {
  const canvas = context.canvas;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.font = "14px Poppins";
  context.fillStyle = "#666";
  context.textAlign = "center";
  context.fillText("No data available for the selected period", width / 2, height / 2);
}
let trendChart = null;
let categoryChart = null;
let _allCategoryData = [];
const categoryColorMap = {};

