let foodCategoryChartInstance;
let expiryStatusChartInstance;
let donationTrendChartInstance;

document.addEventListener("DOMContentLoaded", () => {
  const dropdownBtn = document.querySelector(".dropdown-btn");
  const dropdownContainer = document.querySelector(".dropdown-container");

  dropdownBtn.addEventListener("click", () => {
    dropdownContainer.classList.toggle("show");
  });

  function fetchDashboardData() {
    fetch("get_dashboard_data.php")
      .then(response => response.json())
      .then(data => {
        // Update Cards
        document.getElementById("totalFoodItems").textContent = data.totalFoodItems;
        document.getElementById("expiringSoon").textContent = data.expiringSoon;
        document.getElementById("donationsMade").textContent = data.donationsMade;

        // Food Category Chart
        if (foodCategoryChartInstance) foodCategoryChartInstance.destroy();
        foodCategoryChartInstance = new Chart(
          document.getElementById("foodCategoryChart"),
          {
            type: "pie",
            data: {
              labels: Object.keys(data.foodCategory),
              datasets: [{
                data: Object.values(data.foodCategory),
                backgroundColor: ['#4a7c59', '#f39c12', '#16a085', '#e74c3c', '#3498db']
              }]
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } } }
          }
        );

        // Expiry Status Chart
        if (expiryStatusChartInstance) expiryStatusChartInstance.destroy();
        expiryStatusChartInstance = new Chart(
          document.getElementById("expiryStatusChart"),
          {
            type: "bar",
            data: {
              labels: ["Fresh", "Expiring Soon", "Expired"],
              datasets: [{
                data: [
                  data.expiryStatus.fresh,
                  data.expiryStatus.expiring_soon,
                  data.expiryStatus.expired
                ],
                backgroundColor: ["#27ae60", "#f39c12", "#e74c3c"]
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } }
            }
          }
        );

        // Monthly Donation Trend
        if (donationTrendChartInstance) donationTrendChartInstance.destroy();
        donationTrendChartInstance = new Chart(
          document.getElementById("donationTrendChart"),
          {
            type: "line",
            data: {
              labels: Object.keys(data.monthlyTrend),
              datasets: [{
                label: "Items by Month",
                data: Object.values(data.monthlyTrend),
                borderColor: "#4a7c59",
                backgroundColor: "rgba(74, 124, 89, 0.2)",
                fill: true,
                tension: 0.3
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } }
            }
          }
        );

      })
      .catch(err => console.error("Error fetching data:", err));
  }

  fetchDashboardData();
  // Optional: refresh periodically
  // setInterval(fetchDashboardData, 60000);
});
