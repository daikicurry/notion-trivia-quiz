const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    try {
        console.log('Starting Notion API request...');
        
        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        // 環境変数の確認
        console.log('DATABASE_ID:', process.env.DATABASE_ID);
        
        // データベース情報を取得
        console.log('Fetching database info...');
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });
        
        console.log('Database properties:', dbInfo.properties);

        // データベースの構造を確認
        console.log('Database structure:', {
            hasNameProperty: !!dbInfo.properties['Aa名前'],
            hasSupplementProperty: !!dbInfo.properties['補足'],
            hasTagsProperty: !!dbInfo.properties['タグ']
        });

        // タグのオプション一覧を取得
        const availableTags = dbInfo.properties['タグ']?.multi_select?.options?.map(option => option.name) || [];
        console.log('Available tags:', availableTags);

        // データベースからデータを取得
        console.log('Fetching database contents...');
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID
        });

        console.log('Total results:', response.results.length);
        if (response.results.length > 0) {
            console.log('First result properties:', response.results[0].properties);
        }

        // データの形式を整形
        const formattedData = response.results.map(page => {
            const item = {
                id: page.id,
                url: page.url,
                content: page.properties['Aa名前']?.title[0]?.plain_text || '',
                supplement: page.properties['補足']?.rich_text[0]?.plain_text || '',
                tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
            };
            console.log('Formatted item:', item);
            return item;
        }).filter(item => item.content && item.supplement);

        console.log('Final formatted data count:', formattedData.length);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                results: formattedData,
                availableTags: availableTags
            })
        };

    } catch (error) {
        console.error("Error details:", error);
        console.error("Error stack:", error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                details: error.toString(),
                stack: error.stack
            })
        };
    }
};
