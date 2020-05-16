# PCOC Access Token Retrieval API

The following express application is to be utilized by the squarespace website https://www.portlandchurch.org in order to provide the website with an active access_token, for the jcpalmer108 Youtube account, in order to properly query youtube to get information on whether or not it is currently live. 

## Getting Started

### File Structure

#### Squarespace Folder - home.html, custom.css

This folder contains all of the current custom code added into squarespace. Once the API endpoint works, this is the code that will be changed in order to call the Oauth protected endpoint with live data.

#### Settings File - settings.json

This file contains the Authorization client_ID and client_Secret created through the Youtube Credentials Console.

    Credentials - client_id and client secret for Limited Input Oauth Flow (type Other)
    Scope - scope of the permissions given to this set of credentials (endpoints authorized by these credentials to view)

Documentation: https://developers.google.com/youtube/v3/live/registering_an_application 

#### App File - app.js

This file is the entire Express application and contains all of the helper functions for the endpoints.

### Deployment

To run the application, run the following code in the root directory: 
```
node app.js
```

or

```
nodemon app.js
```

## Additional Information

If you'd like to see the javascript that will be calling this file, check the `squarespace/home.html` file in this project. That is the code is a copy of what is currently in squarespace. 