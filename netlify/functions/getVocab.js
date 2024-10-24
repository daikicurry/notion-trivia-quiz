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

        // 基本的なデータ取得（フィルターなし）
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            page_size: 100  // 取得するページ数を増やす
        });

        console.log('Total results:', response.results.length);

        // データの形式を整形
        const formattedData = response.results
            .map(page => {
                const content = page.properties['Aa名前']?.title[0]?.plain_text;
                const supplement = page.properties['補足']?.rich_text[0]?.plain_text;
                const tags = page.properties['タグ']?.multi_select?.map(tag => tag.name) || [];

                return {
                    id: page.id,
                    url: page.url,
                    content: content,
                    supplement: supplement,
                    tags: tags
                };
            })
            .filter(item => item.content && item.supplement);

        // データベース情報からタグ一覧を取得
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);

        // レスポンスにデバッグ情報を含める
        const responseBody = {
            results: formattedData,
            availableTags: availableTags,
            debug: {
                totalResults: response.results.length,
                formattedResults: formattedData.length,
                sampleTags: formattedData.length > 0 ? formattedData[0].tags : []
            }
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseBody)
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
