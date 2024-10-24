const { Client } = require("@notionhq/client");

exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    console.log('Function started');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        const notion = new Client({
            auth: process.env.NOTION_API_TOKEN
        });

        console.log('Notion client initialized');
        console.log('Database ID:', process.env.DATABASE_ID);

        // まずデータベースの情報を取得
        console.log('Retrieving database info...');
        try {
            const dbInfo = await notion.databases.retrieve({
                database_id: process.env.DATABASE_ID
            });
            console.log('Database properties:', Object.keys(dbInfo.properties));
            console.log('タグ property:', dbInfo.properties['タグ']);
        } catch (dbError) {
            console.error('Error retrieving database:', dbError);
            throw dbError;
        }

        // クエリパラメータの確認
        const { useAllData, includeTags, excludeTags } = event.queryStringParameters || {};
        console.log('Query parameters:', { useAllData, includeTags, excludeTags });

        let filter = undefined;

        // フィルター条件の構築（全データモードでない場合のみ）
        if (useAllData !== 'true' && (includeTags || excludeTags)) {
            const conditions = [];
            
            if (includeTags) {
                const tags = includeTags.split(',');
                console.log('Include tags:', tags);
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
                console.log('Exclude tags:', tags);
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

        console.log('Final filter:', JSON.stringify(filter, null, 2));

        // データベースからデータを取得
        console.log('Querying database...');
        const queryParams = {
            database_id: process.env.DATABASE_ID,
            page_size: 100
        };
        if (filter) {
            queryParams.filter = filter;
        }

        try {
            const response = await notion.databases.query(queryParams);
            console.log('Query response:', {
                total: response.results.length,
                sample: response.results[0] ? {
                    id: response.results[0].id,
                    properties: Object.keys(response.results[0].properties)
                } : null
            });

            // データの整形
            const formattedData = response.results
                .map(page => {
                    try {
                        const formatted = {
                            id: page.id,
                            url: page.url,
                            content: page.properties['Aa名前']?.title[0]?.plain_text,
                            supplement: page.properties['補足']?.rich_text[0]?.plain_text,
                            tags: page.properties['タグ']?.multi_select?.map(tag => tag.name) || []
                        };
                        console.log('Formatted page:', formatted);
                        return formatted;
                    } catch (error) {
                        console.error('Error formatting page:', page.id, error);
                        return null;
                    }
                })
                .filter(item => item && item.content && item.supplement);

            console.log('Final formatted data count:', formattedData.length);

            // 利用可能なタグの取得
            const availableTags = response.results.reduce((tags, page) => {
                const pageTags = page.properties['タグ']?.multi_select?.map(tag => tag.name) || [];
                pageTags.forEach(tag => tags.add(tag));
                return tags;
            }, new Set());

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    results: formattedData,
                    availableTags: Array.from(availableTags),
                    debug: {
                        totalResults: response.results.length,
                        formattedResults: formattedData.length,
                        filter: filter,
                        sampleTags: formattedData[0]?.tags || []
                    }
                })
            };

        } catch (queryError) {
            console.error('Error querying database:', queryError);
            throw queryError;
        }

    } catch (error) {
        console.error("Error details:", error);
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
