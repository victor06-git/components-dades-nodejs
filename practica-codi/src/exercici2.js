// Importacions
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Constants
const DATA_SUBFOLDER = 'steamreviews';
const CSV_GAMES_FILE_NAME = 'games.csv';
const CSV_REVIEWS_FILE_NAME = 'reviews.csv';

// Funció per llegir el CSV de forma asíncrona
async function readCSV(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Funció per fer la petició a Ollama amb més detalls d'error
async function analyzeSentiment(text) {
    try {
        console.log('Enviant petició a Ollama...');
        console.log('Model:', process.env.CHAT_API_OLLAMA_MODEL_TEXT);
        
        const response = await fetch(`${process.env.CHAT_API_OLLAMA_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: process.env.CHAT_API_OLLAMA_MODEL_TEXT,
                prompt: `Analyze the sentiment of this text and respond with only one word (positive/negative/neutral): "${text}"`,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Depuració de la resposta
        console.log('Resposta completa d\'Ollama:', JSON.stringify(data, null, 2));
        
        // Verificar si tenim una resposta vàlida
        if (!data || !data.response) {
            throw new Error('La resposta d\'Ollama no té el format esperat');
        }

        return data.response.trim().toLowerCase();
    } catch (error) {
        console.error('Error detallat en la petició a Ollama:', error);
        console.error('Detalls adicionals:', {
            url: `${process.env.CHAT_API_OLLAMA_URL}/generate`,
            model: process.env.CHAT_API_OLLAMA_MODEL_TEXT,
            promptLength: text.length
        });
        return 'error';
    }
}

async function main() {
    try {
        // Obtenim la ruta del directori de dades
        const dataPath = process.env.DATA_PATH;

        // Validem les variables d'entorn necessàries
        if (!dataPath) {
            throw new Error('La variable d\'entorn DATA_PATH no està definida');
        }
        if (!process.env.CHAT_API_OLLAMA_URL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_URL no està definida');
        }
        if (!process.env.CHAT_API_OLLAMA_MODEL_TEXT) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_MODEL_TEXT no està definida');
        }

        // Construïm les rutes completes als fitxers CSV
        const gamesFilePath = path.join(__dirname, dataPath, DATA_SUBFOLDER, CSV_GAMES_FILE_NAME);
        const reviewsFilePath = path.join(__dirname, dataPath, DATA_SUBFOLDER, CSV_REVIEWS_FILE_NAME);

        // Validem si els fitxers existeixen
        if (!fs.existsSync(gamesFilePath) || !fs.existsSync(reviewsFilePath)) {
            throw new Error('Algun dels fitxers CSV no existeix');
        }

        // Llegim els CSVs
        const games = await readCSV(gamesFilePath);
        const reviews = await readCSV(reviewsFilePath);

        // Iterem pels jocs
        console.log('\n=== Llista de Jocs ===');
        for (const game of games) {
            console.log(`Codi: ${game.appid}, Nom: ${game.name}`);
        }

        // Processem els dos primers jocs i, per cada joc, les dues primeres reviews
        console.log('\n=== Anàlisi de Sentiment per Joc (2 jocs x 2 reviews) ===');

        const output = {
            timestamp: new Date().toISOString(),
            games: []
        };

        const gamesToProcess = games.slice(0, 2);

        for (const game of gamesToProcess) {
            console.log(`\nProcessant joc: ${game.appid} - ${game.name}`);

            // Filtrar reviews que pertanyen a aquest joc (només camps habituals)
            const gameReviews = reviews.filter(r => {
                return (r.app_id && r.app_id === game.appid) || (r.appid && r.appid === game.appid) || (r.app_id && r.app_id === String(game.appid));
            });

            const reviewsForGame = gameReviews.slice(0, 2);

            const statistics = { positive: 0, negative: 0, neutral: 0, error: 0 };

            for (const review of reviewsForGame) {
                try {
                    console.log(`Processant review: ${review.id || review.review_id || 'unknown'}`);
                    const content = review.content || review.review || review.text || '';
                    const sentiment = await analyzeSentiment(content);
                    console.log(`Sentiment (Ollama): ${sentiment}`);

                    if (sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral') {
                        statistics[sentiment]++;
                    } else {
                        statistics.error++;
                    }
                } catch (err) {
                    console.error('Error processant review:', err.message || err);
                    statistics.error++;
                }
            }

            output.games.push({
                appid: game.appid,
                name: game.name,
                statistics
            });
        }

        // Guardem el resultat en data/exercici2_resposta.json (ruta basada en DATA_PATH)
        const outputFilePath = path.join(__dirname, dataPath, 'exercici2_resposta.json');
        fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2), 'utf-8');
        console.log(`\nResultat desat a: ${outputFilePath}`);
     } catch (error) {
        console.error('Error durant l\'execució:', error.message);
    }
}

// Executem la funció principal
main();
