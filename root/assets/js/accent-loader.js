
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
  }
})();

(function () {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
})();

