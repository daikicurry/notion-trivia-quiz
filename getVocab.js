const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    try {
        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        // クエリパラメータからフィルター条件を取得
        const { includeTags, excludeTags } = event.queryStringParameters || {};
        let filter = {};

        if (includeTags || excludeTags) {
            const conditions = [];
            
            if (includeTags) {
                const tags = includeTags.split(',');
                conditions.push({
                    and: tags.map(tag => ({
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

            filter = {
                and: conditions
            };
        }

        // 利用可能なタグの一覧を取得
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });
        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);

        // データベースからデータを取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            filter: filter
        });

        // データの形式を整形
        const formattedData = response.results.map(page => ({
            id: page.id,
            url: page.url,
            content: page.properties['内容']?.rich_text[0]?.plain_text || '',
            supplement: page.properties['補足']?.rich_text[0]?.plain_text || '',
            tags: page.properties['タグ']?.multi_select.map(tag => tag.name) || []
        })).filter(item => item.content && item.supplement);

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
