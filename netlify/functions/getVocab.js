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

        // クエリパラメータの確認
        console.log('Query parameters:', event.queryStringParameters);

        // データベース情報を取得
        console.log('Fetching database with ID:', process.env.DATABASE_ID);
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });
        console.log('Database properties:', Object.keys(dbInfo.properties));

        // フィルター条件の構築
        const { includeTags, excludeTags } = event.queryStringParameters || {};
        let filter = undefined;

        if (includeTags || excludeTags) {
            const conditions = [];
            
            if (includeTags) {
                const tags = includeTags.split(',');
                conditions.push({
                    or: tags.map(tag => ({
                        property: 'タグ',
                        multi_select: {
                            contains: tag.trim()
                        }
                    }))
                });
            }

            if (excludeTags) {
                const tags = excludeTags.split(',');
                tags.forEach(tag => {
                    conditions.push({
                        property: 'タグ',
                        multi_select: {
                            does_not_contain: tag.trim()
                        }
                    });
                });
            }

            if (conditions.length > 0) {
                filter = {
                    and: conditions
                };
            }
        }

        console.log('Using filter:', JSON.stringify(filter, null, 2));

        // データベースからデータを取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            filter: filter
        });

        console.log('Retrieved results count:', response.results.length);
        if (response.results.length > 0) {
            console.log('First result properties:', Object.keys(response.results[0].properties));
            console.log('Sample title property:', response.results[0].properties['Aa名前']);
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
        
        // 利用可能なタグの取得
        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);

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
