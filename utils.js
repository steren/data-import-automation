export function getDateInteger(value) {
    if (!value) return 0;
    const strVal = String(value).trim();

    // Optimization for YYYY-MM-DD
    if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return parseInt(strVal.replace(/-/g, ''));
    }

    const parsedDate = new Date(strVal);
    if (!isNaN(parsedDate.getTime())) {
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        return parseInt(`${yyyy}${mm}${dd}`);
    }
    return 0;
}

export function getColumnLetter(colIndex) {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}
