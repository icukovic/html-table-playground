// CONSTANTS
const TABLE_DATASET = {
    FROZEN: "data-frozen",
}

// FUNCTIONS
function throttle(fn) {
    let timeout;
    let end;
    return (waitInMs, ...args) => {
        timeout = timeout && clearTimeout(timeout);
        if (end > Date.now()) {
            timeout = setTimeout(() => fn(...args), waitInMs);
            return;
        }
        fn(...args);
        end = Date.now() + waitInMs;
    }
}

/**
 * @param {HTMLTableCellElement} tableCell
 * @param {number} width
 * @param {number?} minWidth
 */
function resizeTableCell(tableCell, width, minWidth) {
    tableCell.style.width = width + "px";

    if(minWidth !== undefined) {
        tableCell.style.minWidth = minWidth + "px";
    }
}

/**
 * @param {HTMLTableCellElement} tableCell
 * @param {string} offset
 * @param {boolean} freeze
 */
function freezeTableCell(tableCell, offset, freeze) {
    if (freeze === true) {
        tableCell.setAttribute(TABLE_DATASET.FROZEN, "");
        tableCell.style.left = offset;
    } else if (freeze === false) {
        tableCell.removeAttribute(TABLE_DATASET.FROZEN);
        tableCell.style.left = "";
    }
}

function recalculateTable(table, resetTableColumns = false, thToToggleFreeze = null) {
    console.time('recalculateTable');
    table.style.setProperty("--c-table-height", table.offsetHeight + "px");

    if (resetTableColumns) {
        const minWidth = 48;
        const width = Math.max((tableContainerWidth - 2) / ths.length, minWidth);
        for (const th of ths) {
            resizeTableCell(th, width, minWidth);
        }
    }

    let offset = 0;
    for (const i in ths) {
        const th = ths[i];
        let isFrozen = th.hasAttribute(TABLE_DATASET.FROZEN)

        if (th === thToToggleFreeze) {
            isFrozen = !isFrozen;
        } else if (!isFrozen) {
            continue;
        }

        const thWidth = th.offsetWidth;
        const leftOffset = offset + "px";
        freezeTableCell(th, leftOffset, isFrozen);
        for (const td of tdsByColumnNo[i]) {
            freezeTableCell(td, leftOffset, isFrozen);
        }
        offset += isFrozen && thWidth || 0;
    }
    console.timeEnd('recalculateTable');
}

// SETUP OF CACHED CELLS
console.time('setup');
let tableContainerWidth = 0;
const table = document.querySelector('table');
/** @type {HTMLTableCellElement[]}*/
const ths = Array.from(table.querySelectorAll('thead th'));
/** @type {Object.<String, HTMLTableCellElement[]>} */
const tdsByColumnNo = {};
for (const i in ths) {
    const nthChild = parseInt(i) + 1;
    tdsByColumnNo[i] = Array.from(table.querySelectorAll("tbody tr td:nth-child(" + nthChild + ")"));
}
console.timeEnd('setup');
console.log("No Columns: " + ths.length);
console.log("No Rows: " + tdsByColumnNo[0].length);
const noCells = (ths.length + ths.length * tdsByColumnNo[0].length);
console.log("No Cells: " + noCells);

// TABLE EVENT
const throttledRecalculateTable = throttle(recalculateTable);

const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
        switch (entry.target) {
            case table.parentElement:
                tableContainerWidth = entry.contentRect.width;
                throttledRecalculateTable(1000 / 30, table, true);
                break;
        }
    }
});
resizeObserver.observe(table.parentElement);

ths.forEach((element) => {
    element.addEventListener("dblclick", (event) => {
        throttledRecalculateTable(1000 / 30, table, false, event.currentTarget);
    });
});

let handle;
let mouseTh;

table.addEventListener("mouseup", () => {
    handle?.classList.remove("active");
    handle = undefined;
    mouseTh = undefined;
});

table.addEventListener("mouseleave", () => {
    handle?.classList.remove("active");
    handle = undefined;
    mouseTh = undefined;
});

table.addEventListener("mousemove", (event) => {
    if (!mouseTh) return;
    const mouseX = event.pageX;
    const thWidth = mouseTh.offsetWidth;
    const {x: thX} = mouseTh.getBoundingClientRect();

    const minWidth = parseFloat(getComputedStyle(mouseTh).getPropertyValue("min-width") || 0);
    const newThWidth = Math.max(mouseX - thX, minWidth);

    if(newThWidth === thWidth) return;

    const tableWidth = table.offsetWidth;
    const tableContainerWidth = table.parentElement.clientWidth;
    const nextTh = mouseTh.nextElementSibling;
    const newTableWidth = tableWidth - thWidth + newThWidth;

    if (nextTh && newTableWidth < tableContainerWidth) {
        nextTh.style.width = (nextTh.offsetWidth + tableContainerWidth - newTableWidth) + "px";
    }

    resizeTableCell(mouseTh, newThWidth);
    throttledRecalculateTable(1000 / 30, table);
});

document.querySelectorAll(".resizable_handle")
    .forEach(resizableHandle => {
        resizableHandle.addEventListener("mousedown", event => {
            handle = event.currentTarget;
            handle.classList.add("active");
            mouseTh = event.currentTarget.closest('th');
        });

        resizableHandle.addEventListener("dblclick", event => {
            event.stopPropagation();
            const th = event.currentTarget.closest('th');
            th.style.width = th.style.minWidth;
            throttledRecalculateTable(1000 / 30, table);
        });
    });

// BENCHMARKS
const th = table.querySelector('thead th');
const sample = 100;

setTimeout(() => {
    const cachedTimeLabel = `${sample} iterations through ${noCells} cached table cells`;
    console.time(cachedTimeLabel);
    for (let i = 0; i < sample; i++) {
        for (const j in ths) {
            for (const td of tdsByColumnNo[j]) {
                // td.offsetWidth;
            }
        }
    }
    console.timeEnd(cachedTimeLabel);

    const uncachedTimeLabel = `${sample} iterations through ${noCells} uncached table cells`;
    console.time(uncachedTimeLabel);
    for (let i = 0; i < sample; i++) {
        const ths = Array.from(table.querySelectorAll("thead th"));
        for (const j in ths) {
            const tds = table.querySelectorAll("tbody td:nth-child(" + j + 1 + ")");
            for (const td of tds) {
                // td.offsetWidth;
            }
        }
    }
    console.timeEnd(uncachedTimeLabel);
}, 1000)

