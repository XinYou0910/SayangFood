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
  console.log('Drawing trend chart with data:', trendData);
  
  if (currentChart) {
    currentChart.destroy();
  }
  
  currentChart = new Chart(ctx, {
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
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: "#059669",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2
        },
        {
          label: "Food Wasted",
          data: trendData.map(d => d.wasted),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: "#dc2626",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 3.5,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: { 
        legend: { 
          position: "top",
          align: 'start',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 10,
            font: {
              size: 11,
              weight: '500'
            },
            boxWidth: 8,
            boxHeight: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 8,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          titleFont: {
            size: 12,
            weight: 'bold'
          },
          bodyFont: {
            size: 11
          },
          bodySpacing: 4,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y} items`;
            }
          }
        }
      },
      layout: {
        padding: {
          top: 5,
          bottom: 5,
          left: 10,
          right: 10
        }
      },
      scales: { 
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 9
            },
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15
          }
        },
        y: { 
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: {
              size: 9
            },
            padding: 5
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          }
        }
      }
    }
  });
}

function drawCategory(categoryData) {
  console.log('Drawing category chart with data:', categoryData);
  
  if (currentChart) {
    currentChart.destroy();
  }
  
  if (!categoryData || categoryData.length === 0) {
    showNoDataMessage();
    return;
  }
  
  // Modern color palette
  const colors = [
    '#10b981', // Green
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16'  // Lime
  ];
  
  // Create gradient colors
  const gradients = colors.map(color => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + 'cc'); // Add transparency
    return gradient;
  });
  
  // Use a square aspect ratio for doughnut and let Chart.js maintain sizing
  currentChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categoryData.map(c => c.category),
      datasets: [{
        data: categoryData.map(c => c.count),
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: '65%',
      plugins: { 
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 25,           // reduce padding between legend items and chart
            boxWidth: 10,         // smaller legend box
            boxHeight: 10,
            font: {
              size: 15,          // slightly smaller legend text
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 8,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          titleFont: {
            size: 20,
            weight: 'bold'
          },
          bodyFont: {
            size: 11
          },
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.parsed;
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${context.label}: ${value} items (${percentage}%)`;
            }
          }
        },
      },
      layout: {
        padding: {
          right: 100,
          top: 6,
          bottom: 6
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true
      }
    }
  });
  
  // Draw center total label for doughnut
  const total = categoryData.reduce((s, c) => s + (c.count || 0), 0);
  if (total > 0) {
    // Add a lightweight plugin to render center text
    const centerPlugin = {
      id: 'doughnutCenterText',
      beforeDraw: (chart) => {
        const width = chart.width,
              height = chart.height,
              ctxc = chart.ctx;
        ctxc.restore();
        const fontSize = Math.min(height / 12, 18);
        ctxc.font = `bold ${fontSize}px Arial`;
        ctxc.fillStyle = '#374151';
        ctxc.textBaseline = 'middle';

        const text = `${total} items`;
        const textX = Math.round((width - ctxc.measureText(text).width) / 2);
        const textY = height / 2;
        ctxc.fillText(text, textX, textY);
        ctxc.save();
      }
    };

    // Register plugin for this chart instance only
    currentChart.config.plugins = currentChart.config.plugins || [];
    currentChart.config.plugins.push(centerPlugin);
    currentChart.update();
  }
}

function showTrend() {
  console.log('Switching to trend view');
  document.getElementById("trendBtn").classList.add("active");
  document.getElementById("categoryBtn").classList.remove("active");

  // 🟢 Update title
  document.getElementById("chartTitle").textContent = "Food Trend (Saved vs Wasted Items)";

  const range = document.getElementById("filterRange").value;
  fetch(`food_analytics_data.php?range=${range}`)
    .then(res => res.json())
    .then(data => {
      if (data.trend && data.trend.length > 0) {
        drawTrend(data.trend);
      } else {
        showNoDataMessage();
      }
    })
    .catch(err => console.error("Error loading trend:", err));
}

function showCategory() {
  console.log('Switching to category view');
  document.getElementById("categoryBtn").classList.add("active");
  document.getElementById("trendBtn").classList.remove("active");

  // 🟣 Update title
  document.getElementById("chartTitle").textContent = "Food Category Breakdown";

  const range = document.getElementById("filterRange").value;
  fetch(`food_analytics_data.php?range=${range}`)
    .then(res => res.json())
    .then(data => {
      if (data.category && data.category.length > 0) {
        drawCategory(data.category);
      } else {
        showNoDataMessage();
      }
    })
    .catch(err => console.error("Error loading category:", err));
}

function showNoDataMessage() {
  if (currentChart) {
    currentChart.destroy();
  }
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('No data available for the selected period', ctx.canvas.width / 2, ctx.canvas.height / 2);
}