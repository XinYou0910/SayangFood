const ctx = document.getElementById("foodChart").getContext("2d");
let currentChart = null;

document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  document.getElementById("filterBtn").addEventListener("click", applyFilter);
  document.getElementById("trendBtn").addEventListener("click", showTrend);
  document.getElementById("categoryBtn").addEventListener("click", showCategory);
});

function applyFilter() {
  const range = document.getElementById("filterRange").value;
  loadAnalytics(range);
}

function loadAnalytics(range = 30) {
  console.log('Loading analytics with range:', range);
  
  fetch(`food_analytics_data.php?range=${range}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('Analytics data received:', data);
      
      // Check for errors in response
      if (data.error) {
        console.error('Server error:', data.error, data.details);
        alert('Error loading analytics: ' + data.error);
        return;
      }
      
      updateSummary(data);
      
      // Load trend and separate visual reports by default
      if (data.trend && data.trend.length > 0) {
        drawTrend(data.trend);
        // additional visual reports (separate, not mixed)
        drawDonationChart(data.trend);
        drawUsageChart(data.trend);
        // attach download buttons after charts are drawn
        attachDownloadButtons();
      } else {
        console.warn('No trend data available');
        showNoDataMessage();
      }
    })
    .catch(err => {
      console.error("Error loading analytics:", err);
      alert('Failed to load analytics data. Check console for details.');
    });
}

function updateSummary(data) {
  // Update summary cards - showing item counts, not KG
  document.getElementById("total-saving").textContent = `${data.total_saved} Items`;
  document.getElementById("total-waste").textContent = `${data.total_waste} Items`;
  document.getElementById("total-donation").textContent = `${data.total_donation} Items`;
  document.getElementById("total-usage").textContent = `${data.total_used} Items`;
  
  console.log('Summary updated:', {
    saved: data.total_saved,
    waste: data.total_waste,
    donation: data.total_donation,
    used: data.total_used
  });
}

function drawTrend(trendData) {
  const trendCtx = document.getElementById("foodChart").getContext("2d");

  if (trendChart) trendChart.destroy();

  // Original trend chart: saved & wasted as lines
  trendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: trendData.map(d => d.date),
      datasets: [
        {
          label: 'Food Saved',
          data: trendData.map(d => d.saved || 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Food Wasted',
          data: trendData.map(d => d.wasted || 0),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Restore original chart title
  const titleEl = document.getElementById('chartTitle');
  if (titleEl) titleEl.textContent = 'Food Trend';
  // Small delayed update helps Chart.js recompute sizes when fonts or layout
  // finish loading (fixes the 'invisible / squashed' render seen after refresh).
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
        backgroundColor: 'rgba(59,130,246,0.9)',
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

// Draw a usage chart (line) as a separate full-size report
let usageChart = null;
function drawUsageChart(trendData) {
  const ctx = document.getElementById('usageChart').getContext('2d');
  if (usageChart) usageChart.destroy();

  usageChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.map(d => d.date),
      datasets: [{
        label: 'Total Food Usage',
        data: trendData.map(d => d.used || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
  setTimeout(() => { try { usageChart.resize(); usageChart.update(); } catch(e){} }, 150);
}

function drawCategory(categoryData) {
  console.log('Drawing category chart:', categoryData);
  const categoryCtx = document.getElementById("categoryChart").getContext("2d");

  // Destroy previous chart if exists
  if (categoryChart) categoryChart.destroy();

  if (!categoryData || categoryData.length === 0) {
    showNoDataMessage(categoryCtx);
    return;
  }

  // Color palette
  const colors = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
  ];

  // Resize the canvas smaller (optional: adjust CSS instead if preferred)
  categoryCtx.canvas.height = 550; // smaller height
  categoryCtx.canvas.width = 550;  // smaller width

  // Create the chart
  // default to percentage values; drawCategoryFiltered will map to desired metric
  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: categoryData.map(c => c.category),
      datasets: [{
        data: categoryData.map(c => c.percentage),
        backgroundColor: colors.slice(0, categoryData.length),
        borderColor: "#fff",
        borderWidth: 2
      }]
    },
    options: {
      cutout: "60%", // slightly smaller inner hole
      responsive: true, // use canvas size defined above
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // hide default legend
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed}%`
          }
        }
      }
    }
  });
  setTimeout(() => { try { categoryChart.resize(); categoryChart.update(); } catch(e){} }, 150);

  // Generate custom legend
  const legendContainer = document.getElementById("foodLegend");
  legendContainer.innerHTML = "";

  categoryData.forEach((item, i) => {
    legendContainer.innerHTML += `
      <div class="legend-item" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="legend-color" style="width:16px;height:16px;border-radius:4px;background-color:${colors[i]}"></div>
          <span class="legend-label">${item.category}</span>
        </div>
        <span class="legend-value">${item.percentage}% (${item.count})</span>
      </div>
    `;
  });
}

// Category filtering helpers
let _lastCategoryData = null;
function renderCategoryWithFilters() {
  if (!_lastCategoryData) return;
  const search = (document.getElementById('categorySearch')?.value || '').trim().toLowerCase();
  const topN = parseInt(document.getElementById('topN')?.value || '0', 10);
  const metric = document.getElementById('categoryMetric')?.value || 'percentage';

  let data = _lastCategoryData.slice();
  if (search) {
    data = data.filter(d => (d.category || '').toLowerCase().includes(search));
  }
  // sort by metric descending
  data.sort((a,b) => (b[metric] || 0) - (a[metric] || 0));
  if (topN > 0) data = data.slice(0, topN);

  // prepare values depending on metric
  const values = data.map(d => metric === 'count' ? d.count : d.percentage);
  const labels = data.map(d => d.category);

  // update chart dataset
  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = values;
    // update colors if needed
    categoryChart.data.datasets[0].backgroundColor = categoryChart.data.datasets[0].backgroundColor.slice(0, labels.length);
    categoryChart.update();
  }

  // update custom legend
  const legendContainer = document.getElementById("foodLegend");
  legendContainer.innerHTML = '';
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
  data.forEach((item, i) => {
    const displayValue = metric === 'count' ? item.count : item.percentage + '%';
    legendContainer.innerHTML += `
      <div class="legend-item" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="legend-color" style="width:16px;height:16px;border-radius:4px;background-color:${colors[i % colors.length]}"></div>
          <span class="legend-label">${item.category}</span>
        </div>
        <span class="legend-value">${displayValue}</span>
      </div>
    `;
  });
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
          _lastCategoryData = data.category.map(d => ({ ...d }));
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
  document.getElementById("trendSection").style.display = "block";
  document.getElementById("categorySection").style.display = "none";
  // Charts may render incorrectly if their canvas was previously hidden or the
  // layout changed (this happens on refresh or when navigating back). Resize
  // and update charts after a short delay to allow layout to settle.
  setTimeout(() => {
    try {
      if (trendChart) { trendChart.resize(); trendChart.update(); }
      if (donationChart) { donationChart.resize(); donationChart.update(); }
      if (usageChart) { usageChart.resize(); usageChart.update(); }
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
    if (usageChart) usageChart.resize();
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
        if (usageChart) { usageChart.resize(); usageChart.update(); }
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
      if (usageChart) { usageChart.resize(); usageChart.update(); }
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

// Attach download handlers for each chart toolbar button
function attachDownloadButtons() {
  const trendBtn = document.getElementById('downloadTrendBtn');
  const donationBtn = document.getElementById('downloadDonationBtn');
  const usageBtn = document.getElementById('downloadUsageBtn');

  if (trendBtn) {
    trendBtn.onclick = () => downloadChartImage(trendChart, 'food_trend.png');
  }
  if (donationBtn) {
    donationBtn.onclick = () => downloadChartImage(donationChart, 'total_donations.png');
  }
  if (usageBtn) {
    usageBtn.onclick = () => downloadChartImage(usageChart, 'total_usage.png');
  }
}

function downloadChartImage(chartInstance, filename) {
  if (!chartInstance) { alert('Chart is not ready yet'); return; }
  try {
    const url = chartInstance.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to download chart image', err);
    alert('Failed to download image');
  }
}