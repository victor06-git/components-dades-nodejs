// Importacions
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Constants des de variables d'entorn
const IMAGES_SUBFOLDER = 'imatges/animals';
const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const OLLAMA_URL = process.env.CHAT_API_OLLAMA_URL;
const OLLAMA_MODEL = process.env.CHAT_API_OLLAMA_MODEL_VISION;

// Funció per llegir un fitxer i convertir-lo a Base64
async function imageToBase64(imagePath) {
    try {
        const data = await fs.readFile(imagePath);
        return Buffer.from(data).toString('base64');
    } catch (error) {
        console.error(`Error al llegir o convertir la imatge ${imagePath}:`, error.message);
        return null;
    }
}

// Funció per fer la petició a Ollama amb més detalls d'error
async function queryOllama(base64Image, prompt) {
    const requestBody = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        images: [base64Image],
        stream: false
    };

    try {
        console.log('Enviant petició a Ollama...');
        console.log(`URL: ${OLLAMA_URL}/generate`);
        console.log('Model:', OLLAMA_MODEL);
        
        const response = await fetch(`${OLLAMA_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
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

        return data.response;
    } catch (error) {
        console.error('Error detallat en la petició a Ollama:', error);
        console.error('Detalls adicionals:', {
            url: `${OLLAMA_URL}/generate`,
            model: OLLAMA_MODEL,
            promptLength: prompt.length,
            imageLength: base64Image.length
        });
        return null;
    }
}

// Funció principal
async function main() {
    try {
        // Validem les variables d'entorn necessàries
        if (!process.env.DATA_PATH) {
            throw new Error('La variable d\'entorn DATA_PATH no està definida.');
        }
        if (!OLLAMA_URL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_URL no està definida.');
        }
        if (!OLLAMA_MODEL) {
            throw new Error('La variable d\'entorn CHAT_API_OLLAMA_MODEL no està definida.');
        }

        const imagesFolderPath = path.join(__dirname, process.env.DATA_PATH, IMAGES_SUBFOLDER);
        try {
            await fs.access(imagesFolderPath);
        } catch (error) {
            throw new Error(`El directori d'imatges no existeix: ${imagesFolderPath}`);
        }

        const animalDirectories = await fs.readdir(imagesFolderPath);
        const results = [];

        // Iterem per cada element dins del directori d'animals
        for (const animalDir of animalDirectories) {
            // Construïm la ruta completa al directori de l'animal actual
            const animalDirPath = path.join(imagesFolderPath, animalDir);

            try {
                // Obtenim informació sobre l'element (si és directori, fitxer, etc.)
                const stats = await fs.stat(animalDirPath);
                
                // Si no és un directori, l'ignorem i continuem amb el següent
                if (!stats.isDirectory()) {
                    console.log(`S'ignora l'element no directori: ${animalDirPath}`);
                    continue;
                }
            } catch (error) {
                // Si hi ha error al obtenir la info del directori, el loguegem i continuem
                console.error(`Error al obtenir informació del directori: ${animalDirPath}`, error.message);
                continue;
            }

            // Obtenim la llista de tots els fitxers dins del directori de l'animal
            const imageFiles = await fs.readdir(animalDirPath);

            // Iterem per cada fitxer dins del directori de l'animal
            for (const imageFile of imageFiles) {
                // Construïm la ruta completa al fitxer d'imatge
                const imagePath = path.join(animalDirPath, imageFile);
                // Obtenim l'extensió del fitxer i la convertim a minúscules
                const ext = path.extname(imagePath).toLowerCase();
                
                // Si l'extensió no és d'imatge vàlida (.jpg, .png, etc), l'ignorem
                if (!IMAGE_TYPES.includes(ext)) {
                    console.log(`S'ignora fitxer no vàlid: ${imagePath}`);
                    continue;
                }

                // Convertim la imatge a format Base64 per enviar-la a Ollama
                const base64String = await imageToBase64(imagePath);

                // Si s'ha pogut convertir la imatge correctament
                if (base64String) {
                    // Loguegem informació sobre la imatge que processarem
                    console.log(`\nProcessant imatge: ${imagePath}`);
                    console.log(`Mida de la imatge en Base64: ${base64String.length} caràcters`);
                    
                                        
                    const structuredPrompt = `Provide a detailed analysis of the animal in the supplied image.
                                              Respond ONLY with valid JSON (no extra text) following this schema (Catalan keys):
                                            {
                                                "nom_comu": "",
                                                "nom_cientific": "",
                                                "taxonomia": {
                                                    "classe": "", 
                                                    "ordre": "", 
                                                    "familia": ""
                                                },
                                                "habitat": {
                                                    "tipus": [],
                                                    "regioGeografica": [],
                                                    "clima": []
                                                },
                                                "dieta": {
                                                    "tipus": "", 
                                                    "aliments_principals": []
                                                },
                                                "caracteristiques_fisiques": {
                                                    "mida": {
                                                        "altura_mitjana_cm": "",
                                                        "pes_mitja_kg": ""
                                                    },
                                                    "colors_predominants": [],
                                                    "trets_distintius": []
                                                },
                                                "estat_conservacio": {
                                                    "classificacio_IUCN": "",
                                                    "amenaces_principals": []
                                                }
                                            }

                                            Be concise and return only valid JSON that matches the schema.
                                            If a field is unknown, use an empty string or empty array. 
                                            Do NOT include any commentary or markdown.`;

                                        console.log('Prompt: (structured JSON request)');

                                        // Fem la petició a Ollama amb la imatge i el prompt estructurat
                                        const response = await queryOllama(base64String, structuredPrompt);

                                        // Processem la resposta d'Ollama: intentem parsejar JSON
                                        let analisi = null;
                                        if (response) {
                                                console.log(`\nResposta d'Ollama per ${imageFile}:`);
                                                console.log(response);

                                                // Intentem parsejar la resposta directament
                                                try {
                                                        analisi = JSON.parse(response);
                                                } catch (e) {
                                                        // Si no és JSON pur, intentem extreure el primer objecte JSON present
                                                        const firstBrace = response.indexOf('{');
                                                        const lastBrace = response.lastIndexOf('}');
                                                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                                                                const possible = response.slice(firstBrace, lastBrace + 1);
                                                                try {
                                                                        analisi = JSON.parse(possible);
                                                                } catch (e2) {
                                                                        analisi = { raw_response: response, parse_error: true };
                                                                }
                                                        } else {
                                                                analisi = { raw_response: response, parse_error: true };
                                                        }
                                                }
                                        } else {
                                                console.error(`\nNo s'ha rebut resposta vàlida per ${imageFile}`);
                                                analisi = { raw_response: null, parse_error: true };
                                        }
                    // Separador per millorar la llegibilitat del output
                    console.log('------------------------');

                    // Afegim el resultat a la llista d'anàlisis
                    results.push({
                        imatge: { nom_fitxer: imageFile },
                        analisi
                    });
                }
            }
            console.log(`\nATUREM L'EXECUCIÓ DESPRÉS D'ITERAR EL CONTINGUT DEL PRIMER DIRECTORI`);
            break; // ATUREM L'EXECUCIÓ DESPRÉS D'ITERAR EL CONTINGUT DEL PRIMER DIRECTORI
        }

        // Guardem tots els resultats en un JSON dins del directori `data`
        try {
            const outputFilePath = path.join(__dirname, process.env.DATA_PATH, 'exercici3_resposta.json');
            await fs.writeFile(outputFilePath, JSON.stringify({ analisis: results }, null, 2), 'utf-8');
            console.log(`\nResultat desat a: ${outputFilePath}`);
        } catch (writeErr) {
            console.error('Error desant el fitxer de sortida:', writeErr.message || writeErr);
        }

    } catch (error) {
        console.error('Error durant l\'execució:', error.message);
    }
}

// Executem la funció principal
main();