const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: ""
        };
    }

    try {
        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        // データベース情報を取得
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

        // クエリパラメータの処理
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

        // クイズデータの取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            filter: filter,
            page_size: 100
        });

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
                    console.error('Error formatting page:', error);
                    return null;
                }
            })
            .filter(item => item && item.content && item.supplement);

        // タグ一覧の取得
        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: formattedData,
                availableTags: availableTags,
                debug: {
                    totalResults: response.results.length,
                    formattedResults: formattedData.length
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
                details: error.toString()
            })
        };
    }
};
