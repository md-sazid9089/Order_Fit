// Paste into the browser console (or a javascript tool) on any OrderFit page.
// Reports horizontal overflow and its widest offenders, sub-12px text, small touch targets,
// headings, alerts/status regions and unlabeled form controls. Read-only; changes nothing.
(() => {
  const de = document.documentElement;
  const all = [...document.querySelectorAll("body *")];
  const visible = (e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  const label = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className || "").split(/\s+/).slice(0, 4).join(".")}`;
  const offenders = all
    .filter((e) => visible(e) && getComputedStyle(e).position !== "fixed" && e.getBoundingClientRect().right > innerWidth + 1)
    .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
    .slice(0, 6)
    .map((e) => `${label(e)} right=${Math.round(e.getBoundingClientRect().right)}`);
  const smallText = all.filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12);
  const touch = innerWidth < 768
    ? [...document.querySelectorAll("a[href],button,input,select,textarea,[role=button]")].filter((e) => {
        if (!visible(e)) return false;
        const r = e.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).length
    : null;
  const controls = [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(visible);
  const unlabeled = controls.filter((c) => !(c.labels && c.labels.length) && !c.getAttribute("aria-label") && !c.getAttribute("aria-labelledby"));
  return {
    path: location.pathname,
    width: innerWidth,
    scrollWidth: de.scrollWidth,
    overflow: de.scrollWidth > innerWidth,
    offenders,
    smallTextCount: smallText.length,
    smallTextSamples: smallText.slice(0, 4).map((e) => `${e.textContent.trim().slice(0, 30)} (${getComputedStyle(e).fontSize})`),
    smallTouchTargets: touch,
    headings: [...document.querySelectorAll("h1,h2")].filter(visible).map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 50)}`).slice(0, 8),
    h1Count: [...document.querySelectorAll("h1")].filter(visible).length,
    alerts: [...document.querySelectorAll("[role=alert],[role=status]")].filter(visible).map((a) => a.textContent.trim().slice(0, 140)).slice(0, 5),
    controls: controls.length,
    unlabeledControls: unlabeled.length,
    unlabeledSamples: unlabeled.slice(0, 4).map(label),
    hasMain: !!document.querySelector("main"),
  };
})();
