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
      
      // Load trend by default
      if (data.trend && data.trend.length > 0) {
        drawTrend(data.trend);
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

  trendChart = new Chart(trendCtx, {
    type: "line",
    data: {
      labels: trendData.map(d => d.date),
      datasets: [
        {
          label: "Food Saved",
          data: trendData.map(d => d.saved),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4
        },
        {
          label: "Food Wasted",
          data: trendData.map(d => d.wasted),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });
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
        <span class="legend-value">${item.percentage}%</span>
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
          drawCategory(data.category);
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
}

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