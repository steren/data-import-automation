// This is intended to be run as a Google Apps Script

// --- CONFIGURATION ---
const CONFIGS = [
    {
        SHEET_NAME: 'SFCU Checking',
        SOURCE_FOLDER_ID: '1bjhynAfhDGYwvKVE3HOcwGP3kw___F5N',
        PROCESSED_FOLDER_ID: '1u79xcVmMHKCK8KPfNsWqNNQ4M7Fr-rXu',
        DATE_COLUMN_HEADER: 'Date',
        METADATA_ROWS_TO_SKIP: 1
    }
];

function processNewCsvFiles() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timeZone = ss.getSpreadsheetTimeZone();

    CONFIGS.forEach(config => {
        Logger.log(`--- Processing: ${config.SHEET_NAME} ---`);
        const sourceFolder = DriveApp.getFolderById(config.SOURCE_FOLDER_ID);
        const processedFolder = DriveApp.getFolderById(config.PROCESSED_FOLDER_ID);

        const files = sourceFolder.getFiles();

        while (files.hasNext()) {
            const file = files.next();
            const fileName = file.getName();

            if (file.getMimeType() === MimeType.CSV || fileName.endsWith('.csv')) {
                try {
                    Logger.log(`Processing file: ${fileName}`);
                    let csvData = Utilities.parseCsv(file.getBlob().getDataAsString());

                    // 1. Remove metadata rows
                    if (csvData.length > config.METADATA_ROWS_TO_SKIP) {
                        csvData.splice(0, config.METADATA_ROWS_TO_SKIP);
                    } else {
                        Logger.log("File too short, skipping.");
                        continue;
                    }

                    // 2. Determine Target Sheet
                    const targetSheetName = config.SHEET_NAME;

                    Logger.log(`Processing ${fileName} for Target Sheet: ${targetSheetName}`);
                    const sheet = ss.getSheetByName(targetSheetName);

                    if (!sheet) {
                        Logger.log(`Error: Sheet "${targetSheetName}" does not exist.`);
                        continue;
                    }

                    // --- 3. Get Last Date FROM THE TARGET SHEET ---
                    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                    const dateColIndex = headers.indexOf(config.DATE_COLUMN_HEADER);

                    if (dateColIndex === -1) {
                        Logger.log(`Error: Could not find column "${config.DATE_COLUMN_HEADER}" in sheet ${targetSheetName}`);
                        continue;
                    }

                    const lastRow = sheet.getLastRow();
                    let lastSheetDateValue = 0;

                    if (lastRow > 1) {
                        const cellValue = sheet.getRange(lastRow, dateColIndex + 1).getValue();
                        lastSheetDateValue = getDateInteger(cellValue, timeZone);
                    }

                    // --- 4. Filter Rows ---
                    const newRows = csvData.filter(row => {
                        const rowDateString = row[dateColIndex];
                        const rowDateValue = getDateInteger(rowDateString, timeZone);
                        return rowDateValue > lastSheetDateValue;
                    });

                    // --- 5. Write to Sheet ---
                    if (newRows.length > 0) {
                        sheet.getRange(
                            sheet.getLastRow() + 1,
                            1,
                            newRows.length,
                            newRows[0].length
                        ).setValues(newRows);
                        Logger.log(`Imported ${newRows.length} rows to ${targetSheetName}.`);
                    } else {
                        Logger.log(`No new rows found in ${fileName}.`);
                    }

                    file.moveTo(processedFolder);

                } catch (e) {
                    Logger.log(`Error processing ${fileName}: ${e.toString()}`);
                }
            }
        }
    });
}

// --- Helper Function ---
function getDateInteger(value, timeZone) {
    if (!value) return 0;
    if (value instanceof Date) {
        return parseInt(Utilities.formatDate(value, timeZone, "yyyyMMdd"));
    }
    const strVal = String(value).trim();
    // Optimization for YYYY-MM-DD to avoid timezone shifting
    if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return parseInt(strVal.replace(/-/g, ''));
    }
    const parsedDate = new Date(strVal);
    if (!isNaN(parsedDate.getTime())) {
        return parseInt(Utilities.formatDate(parsedDate, timeZone, "yyyyMMdd"));
    }
    return 0;
}
