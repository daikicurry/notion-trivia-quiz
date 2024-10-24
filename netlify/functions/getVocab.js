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

        // データベースからデータを取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            page_size: 100,
            filter: filter
        });

        // データの形式を整形
        const formattedData = response.results
            .map(page => {
                const content = page.properties['内容']?.title[0]?.plain_text;
                const supplement = page.properties['補足']?.rich_text[0]?.plain_text;
                const tags = page.properties['タグ']?.multi_select?.map(tag => tag.name) || [];

                if (!content || !supplement) return null;

                return {
                    id: page.id,
                    url: page.url,
                    content: content,
                    supplement: supplement,
                    tags: tags
                };
            })
            .filter(item => item !== null);

        // データベース情報からタグ一覧を取得
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

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
