const express = require('express');
const axios = require('axios'); // For making API calls
const app = express();
const port = 3000;
const GOOGLE_API_KEY = 'AIzaSyANe_6bk7NDht5ECPAtRQ1VZARSHBMlUTI';
const admin = require('firebase-admin');

// Middleware to parse JSON bodies (if needed for POST/PUT requests)
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(require('./admin.json'))
});

// Middleware to verify firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split(' ')[1];

  try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken; // Attach the user info to the request
      next(); // Proceed to the next middleware or route handler
  } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return res.status(403).json({ error: 'Forbidden' });
  }
};

// Autocomplete endpoint
app.get('/api/autocomplete', verifyFirebaseToken, async (req, res) => {
  try {
      // External API URL
      const apiUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

      // Get the 'input' parameter from the client request
      const input = req.query.input;
      if (!input) {
          return res.status(400).json({ error: 'Missing required parameter: input' });
      }

      // Make the API request
      const response = await axios.get(apiUrl, {
          params: {
              input: input,
              key: GOOGLE_API_KEY, // API Key
          },
      });
      // Return the API's response to the client
      res.status(response.status).json(response.data);
  } catch (error) {
      console.error('Error in autocomplete API proxy:', error.message);
      res.status(error.response?.status || 500).json({
          error: 'Failed to fetch autocomplete data',
          details: error.message,
      });
  }
});

// Route Endpoint
app.get('/api/route', verifyFirebaseToken, async (req, res) => {
    console.log("route called");
    try {
        // Get parameters from the client request
        const { origin, destination, mode } = req.query;

        // Validate required parameters
        if (!origin || !destination || !mode) {
            return res.status(400).json({ error: 'Missing required parameters: origin, destination, or mode' });
        }

        // Google Directions API URL
        const apiUrl = 'https://maps.googleapis.com/maps/api/directions/json';

        // Make the API request
        const response = await axios.get(apiUrl, {
            params: {
                origin,              // Origin in "latitude,longitude" format
                destination,         // Destination in "latitude,longitude" format
                mode,                // Mode of transportation (driving, walking, etc.)
                alternatives: true,  // Request alternative routes
                key: GOOGLE_API_KEY, // Your Google API key
            },
        });

        // Send back the response from Google Directions API to the client
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching directions:', error.message);
        res.status(500).json({ error: 'An error occurred while fetching directions' });
    }
});

// Status endpoint
app.get('/api/serverstatus', (req, res) => {
    res.json({ message: 'Server is Running' });
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
