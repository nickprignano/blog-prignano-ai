// The theme follows the system setting until the reader picks one with the
// toggle; their pick is remembered in this browser.
const root = document.documentElement;
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

const current = () => root.dataset.theme ?? (systemDark.matches ? "dark" : "light");

for (const button of document.querySelectorAll<HTMLButtonElement>(".theme-toggle")) {
  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows can block storage; the toggle still works for this page.
    }
  });
}
