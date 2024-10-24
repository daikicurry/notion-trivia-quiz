const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    console.log('Function started');
    console.log('Query parameters:', event.queryStringParameters);

    try {
        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        console.log('Notion client initialized');

        // データベース情報を取得
        console.log('Retrieving database info...');
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });
        console.log('Database info retrieved');

        // クエリパラメータの処理
        let filter = undefined;
        const { useAllData, includeTags, excludeTags } = event.queryStringParameters || {};

        // 全データ取得モードの場合はフィルターを適用しない
        if (!useAllData && (includeTags || excludeTags)) {
            const conditions = [];
            
            if (includeTags) {
                const tags = includeTags.split(',');
                console.log('Include tags:', tags);
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
                console.log('Exclude tags:', tags);
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

        // クイズデータの取得
        console.log('Querying database...');
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            filter: filter,
            page_size: 100
        });
        console.log('Raw results count:', response.results.length);

        // データの整形
        const formattedData = response.results
            .map(page => {
                try {
                    return {
                        id: page.id,
                        url: page.url,
                        content: page.properties['Aa名前'].title[0].plain_text,
                        supplement: page.properties['補足'].rich_text[0].plain_text,
                        tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
                    };
                } catch (error) {
                    console.error('Error formatting page:', page.id, error);
                    return null;
                }
            })
            .filter(item => item && item.content && item.supplement);

        console.log('Formatted data count:', formattedData.length);

        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);
        console.log('Available tags:', availableTags);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: formattedData,
                availableTags: availableTags,
                debug: {
                    totalResults: response.results.length,
                    formattedResults: formattedData.length,
                    usedFilter: filter
                }
            })
        };

    } catch (error) {
        console.error("Error details:", error);
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
