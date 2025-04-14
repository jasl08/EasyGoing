import axios from 'axios';
import {getIdToken} from '../scripts/getFirebaseID'
import { auth } from '@/firebaseConfig';

// Distance Matrix API
async function getDistanceMatrix(origin, destinations, mode) {
    const url = 'https://ezgoing.app/api/distancematrix';
    // Log the destinations array converted to a string
    const destinationsStr = destinations.map(d => d.address).join('|'); // Between each destination, add this symbol
    console.log("DestStr:", destinationsStr);

    const originFull = origin.name + ", " + origin.address;
    console.log("Origin OptimalRoute:", originFull);

    // Construct the full URL for the API call
    const fullUrl = `${url}?origins=${encodeURIComponent(originFull)}&destinations=${encodeURIComponent(destinationsStr)}&mode=${mode}`;
    console.log('Request URL:', fullUrl);

    let response;
    const idToken = await getIdToken(auth);
    try {
        // Call the API and log the response
        console.log("Sending request to API...");
        response = await axios.get(fullUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`, // Include the ID token in the header
            },
        });
        console.log('API Response:', response.data);
    } catch (error) {
        console.error('Error in API call:', error);

        if (error.response) {
            console.error('Response Error:', error.response.data);
            console.error('Response Status:', error.response.status);
        } else if (error.request) {
            console.error('Request Error:', error.request);
        } else {
            console.error('Error Message:', error.message);
        }
    }

    // Check if the response has the expected structure
    if (!response || !response.data || !response.data.rows || !response.data.rows[0].elements) {
        console.error("Invalid response structure:", response);
        throw new Error("Invalid API response structure");
    }

    // Get the response data and log the rows and elements
    const data = response.data;
    console.log("Response Data:", data);

    // Map the distances and durations for each destination
    const distances = data.rows[0].elements.map((element, index) => {
        console.log(`Processing destination ${index + 1}: ${destinations[index].name}`);

        const distanceData = {
            destinationAddress: data.destination_addresses[index], // address
            originalLocationName: destinations[index].name, // location name
            duration: destinations[index].duration, // location duration
            priority: destinations[index].priority, // location priority
            distance: element.distance.value,  // in meters
            transportDuration: element.duration.value,  // in seconds (transport)
        };

        console.log("Distance Data:", distanceData);

        return distanceData;
    });

    // Return the distances array
    console.log("Distances List:", distances);
    return distances;
}

// Optimal Route Main Function
export async function calculateOptimalRoute(locations, origin, mode) {
    try {
        const allLocations = [origin, ...locations];
        const distanceMatrix = await getFullDistanceMatrix(allLocations, mode);

        // Start at the Origin
        let route = [0];
        const n = allLocations.length;
        const unvisited = new Set([...Array(n).keys()].slice(1)); // skip origin

        // Nearest Neighbor to Get Initial Route
        let currentIndex = 0;
        while (unvisited.size > 0) {
            let nextIndex = null;
            let minDistance = Infinity;

            for (let i of unvisited) {
                const dist = distanceMatrix[currentIndex][i].distance;
                if (dist < minDistance) {
                    minDistance = dist;
                    nextIndex = i;
                }
            }

            if (nextIndex !== null) {
                route.push(nextIndex);
                unvisited.delete(nextIndex);
                currentIndex = nextIndex;
            }
        }

        // 2-opt Optimization to Improve the Route
        route = optimize2Opt(route, distanceMatrix);

        // Format the final route
        const optimalRoute = [];
        for (let i = 0; i < route.length - 1; i++) {
            const from = allLocations[route[i]];
            const to = allLocations[route[i + 1]];
            const matrixEntry = distanceMatrix[route[i]][route[i + 1]];
            optimalRoute.push([
                [from.name, from.address, matrixEntry.duration, from.priority],
                [to.name, to.address, matrixEntry.duration, to.priority]
            ]);
        }

        return optimalRoute;
    } catch (error) {
        console.log("Error in calculateOptimalRoute:", error);
        throw new Error(error);
    }
}

// Fetch full distance matrix for all locations
async function getFullDistanceMatrix(locations, mode) {
    const matrix = [];
    for (let i = 0; i < locations.length; i++) {
        const row = await getDistanceMatrix(locations[i], locations, mode);
        matrix.push(row);
    }
    return matrix;
}

// 2-Opt Optimization: Swaps segments to reduce route length
function optimize2Opt(route, matrix) {
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 1; i < route.length - 2; i++) {
            for (let j = i + 1; j < route.length - 1; j++) {
                const newRoute = route.slice();
                // Swap two edges
                newRoute.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());

                const oldDist = getTotalDistance(route, matrix);
                const newDist = getTotalDistance(newRoute, matrix);

                if (newDist < oldDist) {
                    route = newRoute;
                    improved = true;
                }
            }
        }
    }
    return route;
}

// Calculate total route distance
function getTotalDistance(route, matrix) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        total += matrix[route[i]][route[i + 1]].distance;
    }
    return total;
}


// EXAMPLE USAGE (comment out when using this script)
// For the two below, we will use the nameToCoords to convert
/*
const origin = 'Tokyo International Airport, Tokyo';
let locations = ['Tokyo Tower, Tokyo', 'Shibuya Crossing, Tokyo', 'Kyoto Station, Kyoto'];  // List of destinations

// Calculate the optimal route
calculateOptimalRoute(locations, origin).then((optimalRoute) => {
    console.log('Optimal Route:');
    optimalRoute.forEach(([origin, destination]) => {
        // Use the data from optimalRoute as we wish. For example:
        console.log(`From ${origin} to ${destination}`);
    });
}).catch((error) => {
    console.error('Error calculating the optimal route:', error);
});
*/

export function formatRouteInOrder(locations, origin) {
    try {
        const orderedRoute = [];
        let currentOrigin = origin;

        locations.forEach((location) => {
            orderedRoute.push([
                [currentOrigin.name, currentOrigin.address, currentOrigin.duration, currentOrigin.priority],
                [location.name, location.address, location.duration, location.priority]
            ]);
            
            currentOrigin = location; // Update origin to last visited location
        });

        return orderedRoute;
    } catch (error) {
        console.log("Error occurred in formatRouteInOrder: ", error);
        throw new Error(error);
    }
}
