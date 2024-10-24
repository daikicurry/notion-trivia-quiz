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

        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            page_size: 100
        });

        // HTMLタグをエスケープせずに保持する関数
        function preserveTextWithTags(property) {
            if (!property) return '';
            
            if (property.title) {
                // タイトルプロパティの場合
                return property.title
                    .map(block => block.plain_text)
                    .join('')
                    .replace(/\n/g, ' '); // 改行を空白に変換
            } else if (property.rich_text) {
                // リッチテキストプロパティの場合
                return property.rich_text
                    .map(block => block.plain_text)
                    .join('')
                    .replace(/\n/g, ' '); // 改行を空白に変換
            }
            return '';
        }

        // データの形式を整形
        const formattedData = response.results
            .map(page => {
                try {
                    const content = preserveTextWithTags(page.properties['内容']);
                    const supplement = preserveTextWithTags(page.properties['補足']);

                    // データの検証
                    if (!content || !supplement) {
                        console.log('Missing content or supplement for page:', page.id);
                        return null;
                    }

                    return {
                        id: page.id,
                        url: page.url,
                        content: content,
                        supplement: supplement,
                        tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
                    };
                } catch (error) {
                    console.error('Error formatting page:', page.id, error);
                    return null;
                }
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
