import { google } from 'googleapis';
import { processNewCsvFiles } from './import-data.js';
import CONFIGS from './config.json' with { type: 'json' };

async function main() {
	try {
		// Authentication
		// This uses Application Default Credentials (ADC) or a provided key file.
		// To use ADC, run `gcloud auth application-default login` locally.
		// To use a service account, set the GOOGLE_APPLICATION_CREDENTIALS env var
		// or uncomment and update the keyFile path below.

		const auth = new google.auth.GoogleAuth({
			// keyFile: 'service-account-key.json', 
			scopes: [
				'https://www.googleapis.com/auth/drive',
				'https://www.googleapis.com/auth/spreadsheets'
			]
		});

		const authClient = await auth.getClient();

		console.log('Authentication successful.');

		// Run the process
		await processNewCsvFiles(authClient, CONFIGS);

		console.log('Process completed successfully.');

	} catch (error) {
		console.error('An error occurred:', error);
		process.exit(1);
	}
}

main();
