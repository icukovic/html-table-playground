// CONSTANTS
const TABLE_DATASET = {
    FROZEN: "data-frozen",
}

// FUNCTIONS
/**
 * @param {function(any): any} fn Any function that will be throttled
 * @param {number} waitInMs Time in ms for which function will not be instantly .
 * @return {function(any): any} Throttled function
 */
function throttle(fn, waitInMs) {
    let timeout;
    let end;

    return (...args) => {
        timeout = timeout && clearTimeout(timeout);
        if (end > Date.now()) {
            timeout = setTimeout(() => fn(...args), waitInMs);
            return;
        }

        const value = fn(...args);
        end = Date.now() + waitInMs;
        return value
    }
}

/**
 * Returns number of table columns.
 * @param tableElement
 * @return {number}
 */
function noTableColumns(tableElement) {
    return tableElement.rows.item(0).cells.length;
}

function* iterateCellsByColumn(tableElement, colIndex) {
    for (const row of tableElement.rows) {
        yield row.cells.item(colIndex);
    }
}

function* iterateCellsByRow(tableElement, rowIndex) {
    for (const cell of tableElement.rows.item(rowIndex).cells) {
        yield cell;
    }
}

/**
 * @param {HTMLTableCellElement} tableCell
 * @param {number} width
 * @param {number?} minWidth
 */
function resizeTableCell(tableCell, width, minWidth) {
    tableCell.style.width = width + "px";

    if (minWidth !== undefined) {
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

/**
 * @typedef {object} TableRecalculateOptions
 * @property {boolean?} resetColumnWidths If true resets all column width to same minimal value
 * @property {number?} toggleColumnFreeze Freeze or unfreeze cells for given column index
 */

/**
 * @typedef RecalculateTableFn
 * @param {HTMLTableElement} table
 * @param {TableRecalculateOptions?} options
 */
function recalculateTable(table, options) {
    console.time('recalculateTable');
    table.style.setProperty("--c-table-height", table.offsetHeight + "px");

    if (options?.resetColumnWidths === true) {
        const noColumns = noTableColumns(table.tHead);
        const minWidth = 48;
        const width = Math.max(tableContainerWidth / noColumns, minWidth);
        for (const th of iterateCellsByRow(table.tHead, 0)) {
            resizeTableCell(th, width, minWidth);
        }
    }

    // Recalculates Frozen Column Offset
    let offset = 0;
    for (const th of iterateCellsByRow(table.tHead, 0)) {
        const column = th.cellIndex;
        const toggleCell = column === options?.toggleColumnFreeze;
        let isCellFrozen = th.hasAttribute(TABLE_DATASET.FROZEN);

        if (toggleCell) {
            isCellFrozen = !isCellFrozen
        } else if (!isCellFrozen) {
            continue;
        }

        const thWidth = th.offsetWidth;
        for (const cell of iterateCellsByColumn(table, column)) {
            freezeTableCell(cell, offset + "px", isCellFrozen);
        }
        offset += thWidth;
    }

    console.timeEnd('recalculateTable');
}

// SETUP OF CACHED CELLS
console.time('setup');
let tableContainerWidth = 0;
const table = document.querySelector('table');

console.timeEnd('setup');
const ths = table.tHead.rows.item(0).cells
const noColumns = ths.length;
console.log("No Columns: " + noColumns)
const noRows = table.rows.length;
console.log("No Rows: " + noRows);
const noCells = noRows * noColumns;
console.log("No Cells: " + noCells);

// TABLE EVENT
/** @type {RecalculateTableFn} */
const throttledRecalculateTable = throttle(recalculateTable, 1000 / 30);

const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
        switch (entry.target) {
            case table.parentElement:
                tableContainerWidth = entry.contentRect.width;
                throttledRecalculateTable(table, {
                    resetColumnWidths: true
                });
                break;
        }
    }
});
resizeObserver.observe(table.parentElement);

for (const th of ths) {
    th.addEventListener("dblclick", (event) => {
        throttledRecalculateTable(table, {
            toggleColumnFreeze: event.currentTarget.cellIndex
        });
    });
}

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

    if (newThWidth === thWidth) return;

    const tableWidth = table.offsetWidth;
    const tableContainerWidth = table.parentElement.clientWidth;
    const nextTh = mouseTh.nextElementSibling;
    const newTableWidth = tableWidth - thWidth + newThWidth;

    if (nextTh && newTableWidth < tableContainerWidth) {
        nextTh.style.width = (nextTh.offsetWidth + tableContainerWidth - newTableWidth) + "px";
    }

    resizeTableCell(mouseTh, newThWidth);
    throttledRecalculateTable(table);
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
            throttledRecalculateTable(table);
        });
    });

// BENCHMARKS
const sample = 1000;

setTimeout(() => {
    const cachedTimeLabel = `${sample} iterations through ${noCells} table cells`;
    let count = 0;
    console.time(cachedTimeLabel);
    for (const th of iterateCellsByRow(table.tHead, 0)) {
        count++;
        for (const cell of iterateCellsByColumn(table.tBodies.item(0), th.cellIndex)) {
            count++;
        }
    }
    console.timeEnd(cachedTimeLabel);
}, 1000)
