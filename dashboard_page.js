function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('active');
}

document.addEventListener("DOMContentLoaded", () => {
  const dropdownBtn = document.querySelector(".dropdown-btn");
  const dropdownContainer = document.querySelector(".dropdown-container");

  dropdownBtn.addEventListener("click", () => {
    dropdownContainer.classList.toggle("show");
  });

  // Chart 1: Food Category Distribution
  const foodCategoryChart = new Chart(document.getElementById('foodCategoryChart'), {
    type: 'pie',
    data: {
      labels: ['Vegetables', 'Fruits', 'Grains', 'Meat', 'Dairy'],
      datasets: [{
        data: [30, 20, 15, 25, 10],
        backgroundColor: ['#4a7c59', '#f39c12', '#16a085', '#e74c3c', '#3498db'],
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });

  // Chart 2: Monthly Donation Trend
  const donationTrendChart = new Chart(document.getElementById('donationTrendChart'), {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Donations',
        data: [5, 9, 6, 12, 15, 10],
        borderColor: '#4a7c59',
        backgroundColor: 'rgba(74, 124, 89, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Chart 3: Expiry Status
  const expiryStatusChart = new Chart(document.getElementById('expiryStatusChart'), {
    type: 'bar',
    data: {
      labels: ['Fresh', 'Expiring Soon', 'Expired'],
      datasets: [{
        label: 'Items',
        data: [18, 5, 1],
        backgroundColor: ['#27ae60', '#f39c12', '#e74c3c']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
});
