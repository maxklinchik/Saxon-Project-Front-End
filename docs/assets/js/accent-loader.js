
(function () {
  const saved = localStorage.getItem("accentColor");
  if (saved) {
    document.documentElement.style.setProperty("--accent-color", saved);
  }
})();

(function () {
  const saved = localStorage.getItem("mainColor");
  if (saved) {
    document.documentElement.style.setProperty("--main-color", saved);
    
    // Check if color is light and set text color accordingly
    const isLightColor = (hex) => {
      const c = hex.replace('#', '');
      const r = parseInt(c.substr(0, 2), 16);
      const g = parseInt(c.substr(2, 2), 16);
      const b = parseInt(c.substr(4, 2), 16);
      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    };
    
    if (isLightColor(saved)) {
      document.documentElement.style.setProperty("--sidebar-text-color", "#000000");
      document.documentElement.classList.add('light-sidebar');
    } else {
      document.documentElement.style.setProperty("--sidebar-text-color", "#ffffff");
      document.documentElement.classList.remove('light-sidebar');
    }
  }
})();

(function () {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
})();

// Team logo loader - updates navbar logo on page load
document.addEventListener('DOMContentLoaded', function() {
  const savedLogo = localStorage.getItem('teamLogo');
  if (savedLogo) {
    // Find logo images in the navbar
    const logoImgs = document.querySelectorAll('.navbar .logo img');
    logoImgs.forEach(img => {
      // Determine the relative path based on current page depth
      const currentPath = window.location.pathname;
      let basePath = '';
      
      if (currentPath.includes('/pages/')) {
        // We're in a subdirectory of pages
        basePath = '../../assets/images/Team Logos/';
      } else {
        // We're at root level (index.html)
        basePath = 'assets/images/Team Logos/';
      }
      
      img.src = basePath + savedLogo;
    });
  }
});
