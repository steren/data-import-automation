import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import { getDateInteger, getColumnLetter } from './utils.js';
/**
 * Processes new CSV files from Google Drive and imports them into Google Sheets.
 * @param {Object} auth - The authenticated Google OAuth2 client or JWT client.
 * @param {Array} configs - Configuration object array.
 */
export async function processNewCsvFiles(auth, configs) {
	const drive = google.drive({ version: 'v3', auth });
	const sheets = google.sheets({ version: 'v4', auth });

	for (const config of configs) {
		console.log(`--- Processing: ${config.SHEET_NAME} ---`);

		// List files in source folder
		let files = [];
		try {
			const res = await drive.files.list({
				q: `'${config.SOURCE_FOLDER_ID}' in parents and trashed = false`,
				fields: 'files(id, name, mimeType)'
			});
			files = res.data.files;
		} catch (e) {
			console.error(`Error listing files: ${e.message}`);
			continue;
		}

		for (const file of files) {
			// Check for CSV mime type or extension
			if (file.mimeType === 'text/csv' || file.name.endsWith('.csv')) {
				try {
					console.log(`Processing file: ${file.name}`);

					// Get file content
					const fileContent = await drive.files.get({
						fileId: file.id,
						alt: 'media'
					});

					let csvData = parse(fileContent.data, {
						relax_column_count: true,
						skip_empty_lines: true
					});

					// 1. Remove metadata rows
					if (csvData.length > config.METADATA_ROWS_TO_SKIP) {
						csvData.splice(0, config.METADATA_ROWS_TO_SKIP);
					} else {
						console.log("File too short, skipping.");
						continue;
					}

					// 2. Determine Target Sheet
					const targetSheetName = config.SHEET_NAME;
					console.log(`Processing ${file.name} for Target Sheet: ${targetSheetName}`);

					// 3. Get Last Date FROM THE TARGET SHEET
					// First, find the sheet to ensure it exists
					const spreadsheet = await sheets.spreadsheets.get({
						spreadsheetId: config.SPREADSHEET_ID
					});

					const sheet = spreadsheet.data.sheets.find(s => s.properties.title === targetSheetName);
					if (!sheet) {
						console.log(`Error: Sheet "${targetSheetName}" does not exist.`);
						continue;
					}

					// Read headers (assuming row 1)
					const headerRange = `${targetSheetName}!A1:Z1`;
					const headerRes = await sheets.spreadsheets.values.get({
						spreadsheetId: config.SPREADSHEET_ID,
						range: headerRange
					});

					const headers = headerRes.data.values ? headerRes.data.values[0] : [];
					const dateColIndex = headers.indexOf(config.DATE_COLUMN_HEADER);

					if (dateColIndex === -1) {
						console.log(`Error: Could not find column "${config.DATE_COLUMN_HEADER}" in sheet ${targetSheetName}`);
						continue;
					}

					// Get last row date
					// We fetch the specific column data to find the last row with data
					const colLetter = getColumnLetter(dateColIndex + 1);
					const dateColRange = `${targetSheetName}!${colLetter}:${colLetter}`;
					const dateColRes = await sheets.spreadsheets.values.get({
						spreadsheetId: config.SPREADSHEET_ID,
						range: dateColRange
					});

					const dateValues = dateColRes.data.values;
					let lastSheetDateValue = 0;

					if (dateValues && dateValues.length > 1) {
						// The last value in the column
						const lastDateVal = dateValues[dateValues.length - 1][0];
						lastSheetDateValue = getDateInteger(lastDateVal);
					}

					// 4. Filter Rows
					const newRows = csvData.filter(row => {
						const rowDateString = row[dateColIndex];
						const rowDateValue = getDateInteger(rowDateString);
						return rowDateValue > lastSheetDateValue;
					});

					// 5. Write to Sheet
					if (newRows.length > 0) {
						await sheets.spreadsheets.values.append({
							spreadsheetId: config.SPREADSHEET_ID,
							range: targetSheetName,
							valueInputOption: 'USER_ENTERED',
							requestBody: {
								values: newRows
							}
						});
						console.log(`Imported ${newRows.length} rows to ${targetSheetName}.`);
					} else {
						console.log(`No new rows found in ${file.name}.`);
					}

					// Move file to processed folder
					// Drive API v3 uses addParents and removeParents
					await drive.files.update({
						fileId: file.id,
						addParents: config.PROCESSED_FOLDER_ID,
						removeParents: config.SOURCE_FOLDER_ID,
						fields: 'id, parents'
					});

				} catch (e) {
					console.log(`Error processing ${file.name}: ${e.toString()}`);
				}
			}
		}
	}
}

