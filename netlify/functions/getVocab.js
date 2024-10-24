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

        // まずはフィルターなしで全データを取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            page_size: 100
        });

        // 生のレスポンスをログに出力
        console.log('Raw Notion Response:', JSON.stringify(response, null, 2));

        // データベースの構造を確認
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

        // シンプルにデータを整形
        const formattedData = response.results.map(page => ({
            id: page.id,
            url: page.url,
            content: page.properties['Aa名前']?.title[0]?.plain_text || '',
            supplement: page.properties['補足']?.rich_text[0]?.plain_text || '',
            tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
        })).filter(item => item.content && item.supplement);

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
