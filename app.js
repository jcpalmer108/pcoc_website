/*
* Created on May 15th, 2020
*
* PURPOSE:
* Express application that utilizes the Youtube API Limited Input Authentication
* Flow in order to save the access token that https://www.portlandchurch.org
* can call whenever the home page is loaded
*
* RESOURCES:
*   - Youtube API Oauth for Limited Inputs Docs - https://developers.google.com/youtube/v3/guides/auth/devices
*       Note: Documentation for the device_code and token endpoints called in this Express App
*   - Youtube API Livebroadcast:List Docs - https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/list
*       Note: The endpoint Squarespace will call with the retrieved access token from this Express App
*
* Copyright (c) 2020 - Jenna Palmer Applications
*/

const settings = require('./settings.json');
const express = require('express');
const app = express();
const port = 3000;

const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;

var activeSessionData = {};

/*
========================================================================================================
END POINTS
========================================================================================================
*/

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header(
    'Access-Control-Allow-Methods',
    'PUT, POST, GET, DELETE, OPTIONS',
  );
  next();
});

app.get('/', () => console.log('This is working'));

app.get('/device-code', async (req, res) => await generateDeviceCodeEndpoint(req, res));

app.get('/start-token', async (req, res) => await generateStartTokenEndpoint(req, res));

app.get('/get-token', async (req, res) => await generateGetTokenEndpoint(req, res));

app.get('/force-refresh', async (req, res) => await generateForceRefreshEndpoint(req, res));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

app.get('/test', (req, res) => {
  const temp = { "temp": "its working" };
  console.log(temp);
  res.send(temp);
});


/*
========================================================================================================
MAIN FUNCTIONS
========================================================================================================
*/

/*
* function generateDeviceCodeEndpoint
* @desc - displays the code required by the user to enter the device code approval 
*         Oauth process (https://www.google.com/device)
* @returns Void
*/
async function generateDeviceCodeEndpoint (req, res) {
  activeSessionData = {};
  await getYoutubeDeviceCode();  
  res.send(`<h1>${activeSessionData.device.user_code}</h1><br><br><a href='https://www.google.com/device' target=_blank>https://www.google.com/device</a>`);  
}


/*
* function generateStartTokenEndpoint
* @desc - Uses the saved device_code generated from the previous call to retrieve the first working
*         access token; Timer starts to countdown the lifetime of this access_token's functionality
*         then automatically calls the refresh_token function to update the token
* @returns Void
*/
async function generateStartTokenEndpoint (req, res) {
  var response;

  // if there is a device_code saved (if the /device-code endpoint has been called)
  //    then proceed with the token generating
  //    else throw error prompting user to call /device-code endpoint
  if(activeSessionData && activeSessionData.device && activeSessionData.device.device_code) {
    var cached = {};

    // if this endpoint has already been called, cache the current activeSession data
    //    so that the user sees an error that this code has already been exchanced (from the Youtube API)
    //    however, the /get-token endpoint will still return an active access_token
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
}

/*
*
* Function generateGetTokenEndpoint
* @desc - Retrieve the currently stored access token
* @returns Void
*
*/
async function generateGetTokenEndpoint (req, res) {
  if(activeSessionData && activeSessionData.token && activeSessionData.token.access_token !== undefined) {
    res.send(activeSessionData.token);
  } else {
    res.send({
      error: 'needs_initiation',
      message: 'Need to get Device Code and Start Token before retrieving tokens'
    });
  }
}

/*
*
* Function generateForceRefreshEndpoint
* @desc - Forces the refreshing of a currently active access token and saves that information; 
*         also sets a timer for the lifetime of that token & automatically refreshes that token
*         when its lifetime is expired
* @returns Void
*
*/
async function generateForceRefreshEndpoint (req, res) {
  if (activeSessionData && activeSessionData.token && activeSessionData.token.access_token !== undefined) {
    await refreshYoutubeAccessToken();  
    res.send(activeSessionData.token);
  } else {
    res.send({
      error: 'needs_initiation',
      message: 'Need to get Device Code and Start Token before refreshing tokens'
    });
  }
}

/*
========================================================================================================
HELPER FUNCTIONS
========================================================================================================
*/

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
      // sets the data retrieved from endpoint to activeSessionData.device 
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
        // sets the data retrieved from endpoint to activeSessionData.token 
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


