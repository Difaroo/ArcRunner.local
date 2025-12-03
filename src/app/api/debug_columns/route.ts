import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function GET() {
    try {
        const sheets = await getGoogleSheetsClient();

        const ranges = [
            'CLIPS!1:1',
            'LIBRARY!1:1',
            'SERIES!1:1',
            'SERIES!A2:E5' // Sample data
        ];

        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges,
        });

        const result = {
            clipsHeader: response.data.valueRanges?.[0].values?.[0],
            libraryHeader: response.data.valueRanges?.[1].values?.[0],
            seriesHeader: response.data.valueRanges?.[2].values?.[0],
            seriesData: response.data.valueRanges?.[3].values,
        };

        return NextResponse.json(result);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
