import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import OpenAI from "openai"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

import "dotenv/config"

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

const {
    ASTRADB_DB_NAMESPACE,
    ASTRADB_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env

// Validate required environment variables
if (!ASTRADB_DB_NAMESPACE || !ASTRADB_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !OPENAI_API_KEY) {
    throw new Error("Missing required environment variables. Check your .env file.")
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
})

const f1Data = [
    'https://en.wikipedia.org/wiki/2024–25_Premier_League',
    // 'https://understat.com/league/EPL',
    // 'https://understat.com/team/Liverpool/2024',
    // 'https://understat.com/team/Arsenal/2024',
    // 'https://understat.com/team/Manchester United/2024',
    // 'https://understat.com/team/Fulham/2024',
    // 'https://understat.com/team/Ipswich/2024',
    // 'https://understat.com/team/Liverpool/2024',
    // 'https://understat.com/team/Wolverhampton_Wanderers/2024',
    // 'https://understat.com/team/Everton/2024',
    // 'https://understat.com/team/Brighton/2024',
    // 'https://understat.com/team/Newcastle_United/2024',
    // 'https://understat.com/team/Southampton/2024',
    // 'https://understat.com/team/Nottingham Forest/2024',
    // 'https://understat.com/team/Bournemouth/2024',
    // 'https://understat.com/team/West_Ham/2024',
    // 'https://understat.com/team/Aston_Villa/2024',
    // 'https://understat.com/team/Brentford/2024',
    // 'https://understat.com/team/Crystal_Palace/2024',
    // 'https://understat.com/team/Chelsea/2024',
    // 'https://understat.com/team/Manchester_City/2024',
    // 'https://understat.com/team/Leicester/2024',
    // 'https://understat.com/team/Tottenham/2024',

    'https://www.premierleague.com/latest-player-injuries',
    'https://www.premierleague.com/transfers',
    'https://www.premierleague.com/stats',

    'https://www.premierleague.com/stats/top/players/goals',

    'https://www.premierleague.com/stats/top/clubs/wins', // general team stats
    'https://www.premierleague.com/stats/top/clubs/losses',
    'https://www.premierleague.com/stats/top/clubs/goals',
    
    'https://www.premierleague.com/stats/top/clubs/ontarget_scoring_att', // team attack stats
    // 'https://www.premierleague.com/stats/top/clubs/att_ibox_goal',
    // 'https://www.premierleague.com/stats/top/clubs/att_obox_goal',
    // 'https://www.premierleague.com/stats/top/clubs/goal_fastbreak',
    
    'https://www.premierleague.com/stats/top/clubs/clean_sheet', // defensive stats
    'https://www.premierleague.com/stats/top/clubs/goals_conceded',
    // 'https://www.premierleague.com/stats/top/clubs/last_man_tackle',
    // 'https://www.premierleague.com/stats/top/players/aerial_won', //good

    'https://www.premierleague.com/stats/top/clubs/total_through_ball', // team play
    'https://www.premierleague.com/stats/top/clubs/total_cross',

    'https://www.premierleague.com/stats/top/players/clean_sheet?po=GOALKEEPER',
    'https://www.premierleague.com/stats/top/players/goals_conceded?po=GOALKEEPER',
    'https://www.premierleague.com/stats/top/players/penalty_save?po=GOALKEEPER',

    'https://www.premierleague.com/stats/top/players/error_lead_to_goal', //bad

    'https://www.premierleague.com/fixtures',
    
    // 'https://theanalyst.com/competition/premier-league/stats',
    // 'https://theanalyst.com/competition/premier-league/stats?utm_source=website&utm_medium=topbanner&utm_campaign=embed',

    // 'https://www.skysports.com/premier-league-news',
    // 'https://www.skysports.com/football/transfer-deals',

    // 'https://fbref.com/en/comps/9/Premier-League-Stats#all_stats_squads_gca',
    // 'https://fbref.com/en/comps/9/Premier-League-Stats#all_stats_squads_defense',
    // 'https://www.nytimes.com/athletic/football/'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRADB_DB_NAMESPACE })

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    const res =await db.createCollection(ASTRADB_DB_COLLECTION,{
        vector: {
            dimension: 1536,
            metric: similarityMetric
        }
    })
    console.log(res)
}

const loadSampleData = async () => {
    const collection = await db.collection(ASTRADB_DB_COLLECTION)
    for await (const url of f1Data) {
        console.log(`Processing: ${url}`)
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await (const chunk of chunks) {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
                encoding_format: "float"
            })

            const vector = embedding.data[0].embedding

            const res = await collection.insertOne({
                $vector: vector,
                text: chunk
            })
            console.log(res)
        }
    }
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, "")
}


createCollection().then(() => loadSampleData())
// min 52 
