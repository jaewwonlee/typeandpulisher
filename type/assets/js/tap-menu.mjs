import { SHEET_ID, parseCSV, accentInk } from './cms-data.mjs?v=6';
import { TABS, tapColor } from './site-data.mjs?v=3';

/* 모바일 두 번 탭 메뉴. 팀원이 만든 tap-menu.js를 그대로 옮기고 아래 두 가지만 더했다.
   - 메뉴 항목을 사이트 주소에 맞춤(Blog 제외, Info는 가운데 Home)
   - 원 색을 운영 시트 Info 탭의 '탭 메뉴 색'에서 읽음(글자색은 배경 밝기에 맞춰 흰색/검정) */

const COLOR_KEY = 'tap-menu-color';
function applyColor(color) {
    document.documentElement.style.setProperty('--tap-circle-color', color);
    document.documentElement.style.setProperty('--tap-circle-text-color', accentInk(color));
}

async function loadColor() {
    try { const saved = localStorage.getItem(COLOR_KEY); if (saved) applyColor(saved); } catch { /* 저장소 없이도 기본색으로 동작 */ }
    try {
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TABS.info}&_=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const rows = parseCSV(await response.text());
        const column = rows[1]?.map(h => h.trim()).indexOf('탭 메뉴 색') ?? -1;
        if (column < 0) return;
        const color = tapColor(rows.slice(2).map(r => r[column]).find(v => v && v.trim()));
        applyColor(color);
        try { localStorage.setItem(COLOR_KEY, color); } catch { /* 선택 사항 */ }
    } catch { /* 시트를 못 읽으면 마지막 색이나 기본색을 쓴다. */ }
}

(function () {
    "use strict";

    // Mobile/coarse-pointer only. The desktop interaction can be implemented
    // separately without this script consuming mouse clicks.
    const isMobilePointer = window.matchMedia("(pointer: coarse)").matches;
    if (!isMobilePointer || !window.PointerEvent) return;

    const SETTINGS = {
        doubleTapDelay: 320,
        maxTapDuration: 280,
        tapMoveTolerance: 12,
        singleTapLifetime: 1100,
        menuRadius: 112,
        edgePadding: 8,
        samePointDistance: 32,
        exitDuration: 340
    };

    // 가운데 Home(/)이 Info 페이지라서 주변 원은 세 개만 둔다.
    const MENU_ITEMS = [
        { label: "Type", href: "/type/" },
        { label: "Archive", href: "/archive/" },
        { label: "Publish", href: "/publish/" }
    ];

    const MENU_ANGLES = [-90, 30, 150];

    const layer = document.createElement("div");
    layer.className = "tap-menu-layer";
    layer.setAttribute("aria-live", "polite");
    document.body.appendChild(layer);

    let firstTap = null;
    let firstCircle = null;
    let singleTapTimer = null;
    let menuIsOpen = false;
    let gesture = null;

    function beginGesture(event) {
        if (event.pointerType === "mouse" || !event.isPrimary) return;
        gesture = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startedAt: performance.now(),
            moved: false
        };
    }

    function trackGesture(event) {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const distance = Math.hypot(
            event.clientX - gesture.x,
            event.clientY - gesture.y
        );
        if (distance > SETTINGS.tapMoveTolerance) gesture.moved = true;
    }

    function finishGesture(event) {
        if (!gesture || gesture.pointerId !== event.pointerId) return false;
        const duration = performance.now() - gesture.startedAt;
        const isTap = !gesture.moved && duration <= SETTINGS.maxTapDuration;
        gesture = null;
        return isTap;
    }

    function setPosition(element, x, y) {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }

    function makeCircle(className, label, x, y, href) {
        const element = document.createElement(href ? "a" : "button");
        element.className = `tap-circle ${className}`;
        element.textContent = label;
        setPosition(element, x, y);

        if (href) {
            element.href = href;
            element.setAttribute("aria-label", `${label} 페이지로 이동`);
        } else {
            element.type = "button";
        }

        layer.appendChild(element);
        requestAnimationFrame(() => element.classList.add("is-visible"));
        return element;
    }

    function removeCircle(element) {
        if (!element || !element.isConnected) return;
        // Entrance is staggered, but every circle must leave at once.
        element.style.animationDelay = "0ms";
        element.classList.remove("is-visible");
        element.classList.add("is-leaving");
        window.setTimeout(() => element.remove(), SETTINGS.exitDuration);
    }

    function closeAll() {
        window.clearTimeout(singleTapTimer);
        layer.querySelectorAll(".tap-circle").forEach(removeCircle);
        firstTap = null;
        firstCircle = null;
        menuIsOpen = false;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function shuffled(items) {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
        }
        return result;
    }

    function satellitePosition(centerX, centerY, angle, size) {
        const radians = angle * Math.PI / 180;
        const rawX = centerX + Math.cos(radians) * SETTINGS.menuRadius;
        const rawY = centerY + Math.sin(radians) * SETTINGS.menuRadius;
        const half = size / 2;

        // Keep every link reachable even when the second tap is near an edge.
        return {
            x: clamp(rawX, half + SETTINGS.edgePadding, innerWidth - half - SETTINGS.edgePadding),
            y: clamp(rawY, half + SETTINGS.edgePadding, innerHeight - half - SETTINGS.edgePadding)
        };
    }

    function openMenu(x, y) {
        window.clearTimeout(singleTapTimer);
        const originalFirstTap = firstTap;
        removeCircle(firstCircle);
        firstCircle = null;
        firstTap = null;
        menuIsOpen = true;

        const main = makeCircle("tap-circle--main", "Home", x, y, "/");
        main.style.animationDelay = "20ms";

        shuffled(MENU_ITEMS).forEach((item, index) => {
            const position = satellitePosition(x, y, MENU_ANGLES[index], 68);
            const circle = makeCircle("tap-circle--item", item.label, position.x, position.y, item.href);
            circle.style.animationDelay = `${55 + index * 30}ms`;
        });

        const tapDistance = originalFirstTap
            ? Math.hypot(x - originalFirstTap.x, y - originalFirstTap.y)
            : 0;
        const closePosition = originalFirstTap && tapDistance > SETTINGS.samePointDistance
            ? { x: originalFirstTap.x, y: originalFirstTap.y }
            : satellitePosition(x, y, -150, 48);
        const closeButton = makeCircle("tap-circle--close", "×", closePosition.x, closePosition.y);
        closeButton.setAttribute("aria-label", "메뉴 닫기");
        closeButton.style.animationDelay = "210ms";
        closeButton.addEventListener("pointerup", (event) => {
            event.stopPropagation();
            closeAll();
        });
    }

    function showFirstCircle(x, y, time) {
        firstTap = { x, y, time };
        firstCircle = makeCircle("tap-circle--first", "", x, y);
        firstCircle.setAttribute("aria-label", "첫 번째 터치");
        firstCircle.addEventListener("pointerup", (event) => {
            event.stopPropagation();
            if (!finishGesture(event)) return;
            const now = performance.now();
            if (firstTap && now - firstTap.time <= SETTINGS.doubleTapDelay) {
                openMenu(event.clientX, event.clientY);
            } else {
                closeAll();
            }
        });

        singleTapTimer = window.setTimeout(closeAll, SETTINGS.singleTapLifetime);
    }

    document.addEventListener("pointerdown", beginGesture, { passive: true });
    document.addEventListener("pointermove", trackGesture, { passive: true });
    document.addEventListener("pointercancel", () => {
        gesture = null;
    }, { passive: true });

    document.addEventListener("pointerup", (event) => {
        if (event.pointerType === "mouse" || !event.isPrimary) return;
        if (!finishGesture(event)) return;

        // Preserve normal taps on the site's existing links and controls.
        if (event.target.closest("a, button, input, select, textarea, label, [contenteditable], [data-tap-menu-ignore]")) return;

        if (menuIsOpen) {
            closeAll();
            return;
        }

        const now = performance.now();
        if (firstTap && now - firstTap.time <= SETTINGS.doubleTapDelay) {
            openMenu(event.clientX, event.clientY);
            return;
        }

        closeAll();
        showFirstCircle(event.clientX, event.clientY, now);
    }, { passive: true });

    // Orientation changes can leave circles outside the new viewport.
    window.addEventListener("orientationchange", closeAll, { passive: true });

    void loadColor();
})();
