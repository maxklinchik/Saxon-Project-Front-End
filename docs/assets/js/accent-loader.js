
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
      const c = hex.replace('#', '').trim();
      if (c.length < 6) return false;
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
  
  // Also check accent color for readability
  const accentColor = localStorage.getItem("accentColor");
  if (accentColor) {
    const isLightAccent = (hex) => {
      const c = hex.replace('#', '').trim();
      if (c.length < 6) return false;
      const r = parseInt(c.substr(0, 2), 16);
      const g = parseInt(c.substr(2, 2), 16);
      const b = parseInt(c.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    };
    
    // If accent is light, set accent text to dark
    if (isLightAccent(accentColor)) {
      document.documentElement.style.setProperty("--accent-text-color", "#000000");
    } else {
      document.documentElement.style.setProperty("--accent-text-color", "#ffffff");
    }
  }

  const buttonColor = accentColor || saved;
  if (buttonColor) {
    const c = buttonColor.replace('#', '').trim();
    if (c.length >= 6) {
      const r = parseInt(c.substr(0, 2), 16);
      const g = parseInt(c.substr(2, 2), 16);
      const b = parseInt(c.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      if (luminance > 0.85) {
        document.documentElement.style.setProperty("--button-border-color", "rgba(0, 0, 0, 0.45)");
        document.documentElement.style.setProperty("--button-shadow-color", "rgba(0, 0, 0, 0.28)");
      } else if (luminance > 0.65) {
        document.documentElement.style.setProperty("--button-border-color", "rgba(0, 0, 0, 0.32)");
        document.documentElement.style.setProperty("--button-shadow-color", "rgba(0, 0, 0, 0.22)");
      } else {
        document.documentElement.style.setProperty("--button-border-color", "rgba(0, 0, 0, 0.22)");
        document.documentElement.style.setProperty("--button-shadow-color", "rgba(0, 0, 0, 0.16)");
      }
    }
  }
})();

(function () {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
})();

(function () {
  const simpleUi = localStorage.getItem("simpleUi") === "true";
  document.documentElement.setAttribute("data-ui", simpleUi ? "simple" : "cartoon");
})();

// Team logo loader - updates navbar logo on page load
document.addEventListener('DOMContentLoaded', function() {
  const savedLogo = localStorage.getItem('teamLogo');
  if (savedLogo) {
    const logoImgs = document.querySelectorAll('.navbar .logo img, [data-team-logo]');
    logoImgs.forEach(img => {
      const currentPath = window.location.pathname;
      let basePath = '';

      if (currentPath.includes('/pages/')) {
        basePath = '../../assets/images/Team Logos/';
      } else {
        basePath = 'assets/images/Team Logos/';
      }

      img.src = basePath + savedLogo;
    });
  }
});
