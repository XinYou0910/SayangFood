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
  fetch(`food_analytics_data.php?range=${range}`)
    .then(res => res.json())
    .then(data => {
      updateSummary(data);
      drawTrend(data.trend);
    })
    .catch(err => console.error("Error loading analytics:", err));
}

function updateSummary(data) {
  document.getElementById("total-saving").textContent = `${data.total_saved} KG`;
  document.getElementById("total-waste").textContent = `${data.total_waste} KG`;
  document.getElementById("total-donation").textContent = data.total_donation;
  document.getElementById("total-usage").textContent = `${data.total_used} KG`;
}

function drawTrend(trendData) {
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trendData.map(d => d.date),
      datasets: [
        {
          label: "Food Saved (KG)",
          data: trendData.map(d => d.saved),
          borderColor: "#4a7c59",
          fill: false,
        },
        {
          label: "Food Wasted (KG)",
          data: trendData.map(d => d.wasted),
          borderColor: "#e67e22",
          fill: false,
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
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categoryData.map(c => c.category),
      datasets: [{
        data: categoryData.map(c => c.percentage),
        backgroundColor: ["#4a7c59", "#e67e22", "#f39c12", "#6b9b7a"]
      }]
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
  fetch("food_analytics_data.php?type=trend")
    .then(res => res.json())
    .then(data => drawTrend(data.trend));
}

function showCategory() {
  document.getElementById("categoryBtn").classList.add("active");
  document.getElementById("trendBtn").classList.remove("active");
  fetch("food_analytics_data.php?type=category")
    .then(res => res.json())
    .then(data => drawCategory(data.category));
}
