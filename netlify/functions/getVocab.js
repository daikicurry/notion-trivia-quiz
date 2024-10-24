const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    try {
        console.log('Handler started');
        console.log('NOTION_API_TOKEN exists:', !!process.env.NOTION_API_TOKEN);
        console.log('DATABASE_ID:', process.env.DATABASE_ID);

        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        // まず、フィルターなしで全データを取得
        console.log('Querying database...');
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID
        });

        console.log('Total results:', response.results.length);
        
        // 最初のレコードの構造を確認
        if (response.results.length > 0) {
            const firstPage = response.results[0];
            console.log('First page ID:', firstPage.id);
            console.log('First page URL:', firstPage.url);
            console.log('Properties available:', Object.keys(firstPage.properties));
            console.log('Aa名前 property:', firstPage.properties['Aa名前']);
            console.log('補足 property:', firstPage.properties['補足']);
            console.log('タグ property:', firstPage.properties['タグ']);
        }

        // シンプルにデータを整形
        const formattedData = response.results
            .map(page => {
                try {
                    return {
                        id: page.id,
                        url: page.url,
                        content: page.properties['Aa名前']?.title[0]?.plain_text || '',
                        supplement: page.properties['補足']?.rich_text[0]?.plain_text || '',
                        tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
                    };
                } catch (error) {
                    console.error('Error formatting page:', page.id, error);
                    return null;
                }
            })
            .filter(item => item && item.content && item.supplement);

        console.log('Formatted data count:', formattedData.length);
        if (formattedData.length > 0) {
            console.log('Sample formatted data:', formattedData[0]);
        }

        // データベース情報を取得してタグ一覧を取得
        console.log('Retrieving database info...');
        const dbInfo = await notion.databases.retrieve({
            database_id: process.env.DATABASE_ID
        });

        const availableTags = dbInfo.properties['タグ'].multi_select.options.map(option => option.name);
        console.log('Available tags:', availableTags);

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
        console.error("Error stack:", error.stack);
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
