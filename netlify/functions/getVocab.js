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
            database_id: process.env.DATABASE_ID,
            page_size: 100
        });

        // テキストブロックを結合する関数
        function concatenateTextBlocks(property) {
            if (!property) return '';
            
            if (property.title) {
                // タイトルプロパティの場合
                return property.title.map(block => block.plain_text || '').join('');
            } else if (property.rich_text) {
                // リッチテキストプロパティの場合
                return property.rich_text.map(block => block.plain_text || '').join('');
            }
            return '';
        }

        // データの形式を整形
        const formattedData = response.results
            .map(page => {
                try {
                    // すべてのテキストブロックを結合して取得
                    const content = concatenateTextBlocks(page.properties['内容']);
                    const supplement = concatenateTextBlocks(page.properties['補足']);

                    // データの検証
                    if (!content || !supplement) {
                        console.log('Missing content or supplement for page:', page.id);
                        return null;
                    }

                    return {
                        id: page.id,
                        url: page.url,
                        content: content.trim(),
                        supplement: supplement.trim(),
                        tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
                    };
                } catch (error) {
                    console.error('Error formatting page:', page.id, error);
                    console.error('Page properties:', JSON.stringify(page.properties, null, 2));
                    return null;
                }
            })
            .filter(item => item !== null);

        // データベース情報からタグ一覧を取得
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);

        // デバッグ情報を含めて返す
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: formattedData,
                availableTags: availableTags,
                debug: {
                    totalResults: response.results.length,
                    formattedResults: formattedData.length,
                    sampleContent: formattedData[0]?.content,
                    sampleSupplement: formattedData[0]?.supplement
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
