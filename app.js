const settings = require('./settings.json')
const express = require('express')
const app = express()
const port = 3000

const fetch = require('node-fetch');
global.fetch = fetch
global.Headers = fetch.Headers;

var activeSessionData = {};


app.get('/', (req, res) => res.send(`${temp.words}`))

app.get('/device-code', async (req, res) => {
  activeSessionData = {};

  await getYoutubeDeviceCode();  
  res.send(`<h1>${activeSessionData.device.user_code}</h1><br><br><a href='https://www.google.com/device' target=_blank>https://www.google.com/device</a>`);
})

app.get('/start-token', async (req, res) => {
  var response;

  if(activeSessionData && activeSessionData.device && activeSessionData.device.device_code) {
    var cached = {};

    if(activeSessionData && activeSessionData.token && activeSessionData.token.access_token && typeof(activeSessionData.token.access_token) === "string" ) {
      cached = activeSessionData.token;
    }
    
    await setYoutubeAccessToken();

    if (activeSessionData.token.error !== undefined) {  
      switch (activeSessionData.token.error) {
        case 'access_denied': 
          response = {
            error: 'access_denied',
            message: 'User refused access on Device Code initiation'
          };
          break;
        case 'authorization_pending': 
          response = {
            error: 'authorization_pending',
            message: 'Authorization pending for Device Code'
          };
          break;
        case 'slow_down': 
          response = {
            error: 'slow_down',
            message: 'Polling the token endpoint too often, slow down'
          };
          break;
        default:
          response = {
            error: activeSessionData.token.error,
            message: activeSessionData.token.error_description
          };
      }
  
      if(cached) {
        console.log('token exists, so restore cache');
        activeSessionData.token = cached;
        console.log(activeSessionData);
      } else {
        console.log('token doesnt exist, delete');
        activeSessionData = {};
        console.log(activeSessionData);
      }
      
    } else {
      console.log('Access Token Saved ->', activeSessionData.token.access_token);
      console.log('Refreshes in - ', convertSecondsToReadableTime(activeSessionData.token.expires_in));
      response = activeSessionData.token;
  
      setTimeout(async () => { 
        await refreshYoutubeAccessToken(); 
      }, convertSecondsToMilliseconds(activeSessionData.token.expires_in - 1));
    }  

  } else {
    response = {
      error: 'need_device_code',
      message: 'Need to get Device Code before generating tokens'
    };  
  }

  res.send(response);
})

app.get('/get-token', async (req, res) => {
  if(activeSessionData && activeSessionData.token && activeSessionData.token.access_token !== undefined) {
    res.send(activeSessionData.token);
  } else {
    res.send({
      error: 'needs_initiation',
      message: 'Need to get Device Code and Start Token before retrieving tokens'
    });
  }
})

app.get('/force-refresh', async (req, res) => {
  if (activeSessionData && activeSessionData.token && activeSessionData.token.access_token !== undefined) {
    await refreshYoutubeAccessToken();  
    res.send(activeSessionData.token);
  } else {
    res.send({
      error: 'needs_initiation',
      message: 'Need to get Device Code and Start Token before refreshing tokens'
    });
  }
})


app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))


/*
*
* Function getYoutubeDeviceCode
* @desc - get the youtube code required to retrieve access token
* @returns - Void
*
*/
async function getYoutubeDeviceCode () {    
  var myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  
  var urlencoded = new URLSearchParams();
  urlencoded.append("client_id", settings.credentials.client_id);
  urlencoded.append("scope", settings.scope);
  
  var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: urlencoded,
    redirect: 'follow'
  };
  
  await fetch("https://oauth2.googleapis.com/device/code", requestOptions)
    .then(response => response.json())
    .then(result => {
      activeSessionData['device'] = result;
    })
    .catch(error => console.log('error', error));  

}

/*
*
* Function setYoutubeAccessToken
* @desc - get the youtube code required to retrieve access token
* @returns - Void
*
*/
async function setYoutubeAccessToken () {
  if (activeSessionData && activeSessionData.device && activeSessionData.device.device_code) {
    var requestOptions = {
      method: 'POST',
    };
    
    await fetch(`https://oauth2.googleapis.com/token?client_id=${settings.credentials.client_id}&client_secret=${settings.credentials.client_secret}&device_code=${activeSessionData.device.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`, requestOptions)
    .then(response => response.json())  
    .then(result => {
        activeSessionData['token'] = result;
      })
      .catch(error => {
        console.log('error', error)
      });  

  } else {
    activeSessionData.token = { error: 'need_device_code', message: 'Need to get device code first' };
    console.log('Need to get device code first');
  }

}

/*
*
* Function refreshYoutubeAccessToken
* @desc - retrieve new access token, then wait until it expires and refresh again
* @returns - Void
*
*/
async function refreshYoutubeAccessToken () {
  var requestOptions = {
    method: 'POST',
  };
  
  await fetch(`https://oauth2.googleapis.com/token?client_id=${settings.credentials.client_id}&client_secret=${settings.credentials.client_secret}&grant_type=refresh_token&refresh_token=${activeSessionData.token.refresh_token}`, requestOptions)
    .then(response => response.json())  
    .then(result => {  
        activeSessionData.token = { ...activeSessionData.token, ...result };
    })
    .catch(error => {
      console.log('error', error)
    });

    console.log('Access Token Refreshed and Saved ->', activeSessionData.token.access_token);
    console.log('Refreshes in - ', convertSecondsToReadableTime(activeSessionData.token.expires_in));

    setTimeout(async () => { 
      await refreshYoutubeAccessToken(); 
    }, convertSecondsToMilliseconds(activeSessionData.token.expires_in - 1));
}

/*
*
* Function convertSecondsToMilliseconds
* @desc - converts seconds to milliseconds for setTimeout
* @returns - Void
*
*/
function convertSecondsToMilliseconds (seconds) {
  return seconds * 1000;
}

function convertSecondsToReadableTime (seconds) {
	let response = '';
  
  const hours = parseInt(seconds / 3600);
  seconds = seconds - (hours * 3600);
  response = hours > 0 ? `${hours} hrs ` : '';
  
  const minutes = parseInt(seconds / 60);
  seconds = seconds - (minutes * 60);
  response += `${minutes} min ${seconds} sec`;
  
  return response;
}


