const ctx = document.getElementById("foodChart").getContext("2d");
let currentChart = null;

// Load initial data
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
  fetch(`analytics_data.php?range=${range}`)
    .then(res => res.json())
    .then(data => {
      updateSummaryCards(data);
      drawTrendChart(data.trend);
    })
    .catch(err => console.error("Error loading analytics:", err));
}

function updateSummaryCards(data) {
  document.getElementById("total-saving").innerText = `${data.total_saved} KG`;
  document.getElementById("total-waste").innerText = `${data.total_waste} KG`;
  document.getElementById("total-donation").innerText = data.total_donation;
  document.getElementById("total-usage").innerText = `${data.total_used} KG`;
}

function drawTrendChart(trendData) {
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trendData.map(d => d.date),
      datasets: [
        {
          label: "Food Saved (KG)",
          data: trendData.map(d => d.saved),
          borderColor: "#4caf50",
          fill: false
        },
        {
          label: "Food Wasted (KG)",
          data: trendData.map(d => d.wasted),
          borderColor: "#f44336",
          fill: false
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

function drawCategoryChart(categoryData) {
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categoryData.map(d => d.category),
      datasets: [
        {
          label: "Food Category Breakdown",
          data: categoryData.map(d => d.percentage),
          backgroundColor: ["#4caf50", "#ff9800", "#2196f3", "#9c27b0"]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "right" } }
    }
  });
}

function showTrend() {
  document.getElementById("trendBtn").classList.add("active");
  document.getElementById("categoryBtn").classList.remove("active");
  fetch("analytics_data.php?type=trend")
    .then(res => res.json())
    .then(data => drawTrendChart(data.trend));
}

function showCategory() {
  document.getElementById("categoryBtn").classList.add("active");
  document.getElementById("trendBtn").classList.remove("active");
  fetch("analytics_data.php?type=category")
    .then(res => res.json())
    .then(data => drawCategoryChart(data.category));
}
