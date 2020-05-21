const path = require('path');
const { readFile, mkdirSync, writeFileSync } = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// eslint-disable-line import/no-extraneous-dependencies

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets'];
const WORKING_DIR = path.resolve('.');
const CREDENTIALS_DIR = path.join(WORKING_DIR, '.credentials/');
const SECRETS_PATH = path.join(CREDENTIALS_DIR, 'client_id.json');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'token.json');

// async version of readFile
const readFileAsync = (filePath) => { 
    return new Promise( (resolve, reject) => {
        readFile(filePath, (err, content)=> {
            if(err){
                reject(new Error(`Error in loading file: ${err}`));
            } else {
                resolve(content);
            }
        })
    })
}

const authorize = async () => {

    // get data from client_id.json
    let credentialsContent;        
    try {
        credentialsContent = await readFileAsync(SECRETS_PATH);
    } catch(err) {
        console.log('Make sure you have a .credentials/ folder at the root of your project.');
        console.log('Ensure that you have a client_id.json at .credentials/client_id.json with your client secrets for googleAuth to work');
        return console.log(err);
    }
        
    const credentials = JSON.parse(credentialsContent);
    const oauth2Client = new google.auth.OAuth2(
        credentials.web.client_id,
        credentials.web.client_secret,
        credentials.web.redirect_uris[0]
    );

    // get data from token.json
    let token;
    try {
        token = JSON.parse((await readFileAsync(TOKEN_PATH)));
    } catch (err) {
        console.log("Generating Token file...")
        token = await getNewToken(oauth2Client);
        
    }
    oauth2Client.credentials = token;

    // return auth
    return oauth2Client;
}

const authedCall = async (callback) => {

    const oauth2Client = await authorize();
    
    try{
        return await callback(oauth2Client);
    } catch (err) {
        return console.log(err);
    }
    
};

const storeToken = (token) => {
    try {
        mkdirSync(CREDENTIALS_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log(`Token stored to ${TOKEN_PATH}`);
};

const getNewToken = (oauth2Client) => {
    return new Promise( (resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        console.log(`Authorize this app by visiting this url: ${authUrl}`);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter the code from the url query string here: 127.0.0.1:XXXX/?code=', (code) => {
            rl.close();
            oauth2Client.getToken(code, (err, token) => {
                if (err) {
                    reject(new Error(`Error while trying to retrieve access token, ${err}`));
                }
                storeToken(token);
                resolve(token);
            });
        });
    })
};

module.exports = {
    authedCall,
    authorize,
    storeToken,
    getNewToken
};
