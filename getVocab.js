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

        // データベースからデータを取得
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID
        });

        // データの形式を整形（Notionの実際の構造に合わせる）
        const formattedData = response.results.map(page => ({
            english: page.properties['名前']?.title[0]?.plain_text || '',
            japanese: page.properties['日本語訳']?.rich_text[0]?.plain_text || ''
        })).filter(item => item.english && item.japanese); // 空のエントリを除外

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ results: formattedData })
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
