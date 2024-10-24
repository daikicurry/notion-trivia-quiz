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

        // データの形式を整形（文字列の正規化を追加）
        const formattedData = response.results
            .map(page => {
                try {
                    // 問題文と補足の取得と正規化
                    const contentProp = page.properties['内容']?.title[0]?.plain_text || '';
                    const supplementProp = page.properties['補足']?.rich_text[0]?.plain_text || '';

                    // 文字列の正規化処理
                    const content = contentProp.trim().replace(/^\[|\]$/g, '');
                    const supplement = supplementProp.trim().replace(/^\[|\]$/g, '');

                    // 両方のプロパティが存在する場合のみ有効なデータとして扱う
                    if (!content || !supplement) {
                        console.log('Skipping entry due to missing content or supplement:', {
                            id: page.id,
                            hasContent: !!content,
                            hasSupplement: !!supplement
                        });
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
