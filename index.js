const path = require('path');
const fs = require('fs');
const readline = require('readline');
const request = require('request');
const { createWriteStream } = require('fs');
const Stream = require('stream');
const { authedCall } = require('./googleAuth');
const { google } = require('googleapis');
const sheets = google.sheets('v4');

// const { readFileSync, writeFileSync } = require('fs');
// const { sync: globSync } = require('glob');
// const { sync: mkdirpSync } = require('mkdirp');

const csv = require('csvtojson');
const getCsvParser = () => csv({ noheader: false, flatKeys: true });


const copyMessagesFromV2ToV3 = (v2Fr, v3IDs) => {
    return new Promise( (resolve, reject)=> {
        let result = {}
        const v2FrIDs = Object.keys(v2Fr);
        const v2FrMessages = Object.values(v2Fr);
    
        for(let i = 0; i < v3IDs.length; i++){
            let found = false
            
            for(let j=0; j< v2FrIDs.length; j++){
                if(v3IDs[i]==v2FrIDs[j]){
                    result[v2FrIDs[j]] = v2FrMessages[j];
                    found = true
                }
            }
            if(!found)
                result[v3IDs[i]] = "";
            
        }
        resolve(result);
    })
    
}

const arrayToFile = (v2Fr, v3IDs, filePath) => {
    const writable = createWriteStream(filePath, {flags:'w'})
    const readable = new Stream.Readable();
    readable._read = () => {

        const v2FrIDs = Object.keys(v2Fr);
        const v2FrMessages = Object.values(v2Fr);

        for(let i = 0; i < v3IDs.length; i++){
            let found = false
            
            for(let j=0; j< v2FrIDs.length; j++){
                if(v3IDs[i]==v2FrIDs[j]){
                    readable.push(`${v2FrIDs[j]}\t${v2FrMessages[j]}\n`)
                    found = true
                }
            }
            if(!found)
            readable.push(`${v3IDs[i]}\n`)
            
        }
        readable.push(null) // to end the stream
    }
    readable.pipe(writable);
    console.log(`Writing Done: ${filePath}`);
}

async function processLineByLine() {
    const fileStream = fs.createReadStream('v3IDs.txt');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    let result = []
    for await (const line of rl) {
        // Each line in input.txt will be successively available here as `line`.
        result.push(line)
    }
    return result
}


const fetchRemoteMessages = async (fetchUrl) => {
    try {
        return await new Promise((resolve, reject) => {
            const fetch = request.get(fetchUrl);
            fetch
                .on('response', ({ statusCode, statusMessage }) => {
                    statusCode === 200
                        ? resolve(fetch)
                        : reject(statusMessage);
                });
        });
    } catch (error) {
        console.error(`\nUnable to fetch from ${fetchUrl}`);
        throw error;
    }
};
const getLangMessages = async ( sheetUrl ) => {

    try {
        const langMessages = {};
        const messageStream = await fetchRemoteMessages(sheetUrl);
        // console.log(messageStream)
        return await new Promise((resolve, reject) =>
            getCsvParser().fromStream(messageStream)
                .on('json', json => {
                    langMessages[json.id] = json['fr']})
                .on('done', error => error ? reject(error) : resolve(langMessages))
        );
    } catch (error) {
        console.error(error);
        throw error;
    }
};




// Push all of a lang's strings to the appropriate spreadsheet
const pushLangValues = (langMessages, authClient) => {
    return new Promise( (resolve, reject) => {
        console.log(langMessages)
        try {
                sheets.spreadsheets.values.batchUpdateByDataFilter({
                        spreadsheetId: '15AZzkMx_6gHr4wLYriOZV88J26AezmrZIOf3TlfSzOk',
                        resource: {
                            valueInputOption: 'RAW',
                            data: [ {
                                dataFilter: {
                                    gridRange: {
                                        sheetId: '92181266',
                                        startRowIndex: 1,
                                        startColumnIndex: 0,
                                        endColumnIndex: 2
                                    }
                                },
                                majorDimension: 'ROWS',
                                values: Object.entries(langMessages)
                            } ]
                        },
                        auth: authClient
                    }),
                
                resolve("done")
        } catch (error) {
            console.error(error);
            reject(error)
        }

    })
    
};

const authedPushLangValues = async (langMessages) => {
    await authedCall( async (auth)=>{
        await pushLangValues(langMessages, auth);
    })
}

const urlForV2Fr = `https://docs.google.com/spreadsheets/d/1R64JAfkY_oFEN1ayYsGVBbOVD8a8QUz--QuojZMYp8I/export?format=csv&gid=1036589945`;

const run = async () =>{
    const v2Fr = await getLangMessages(urlForV2Fr);
    console.log("v2Fr length", Object.keys(v2Fr).length);
    const v3IDs = await processLineByLine();
    console.log("v3Fr length", v3IDs.length);
    const result = await copyMessagesFromV2ToV3(v2Fr, v3IDs)
    await authedPushLangValues(result);
}

run();




