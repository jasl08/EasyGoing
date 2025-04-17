import { getDistanceMatrix } from './optimalRoute.js';

// EXAMPLE USAGE
// const route = await calculateOptimalRoute(locations, origin, "driving", days);

// New Optimal Route Main Function (Centerted Around HAC)
export async function calculateOptimalRouteHac(locations, origin, mode, numDays = 7) {
    try {
        const allLocations = [...locations];
        const coords = allLocations.map(loc => [loc.latitude, loc.longitude]);
        const originCoord = [origin.latitude, origin.longitude];

        // Step 1: Cluster into numDays using HAC (Complete Linkage)
        const clusteredGroups = clusterLocationsHAC(coords, numDays);

        // Step 2: Map cluster indexes to original locations
        const clusters = Array.from({ length: numDays }, () => []);
        for (let i = 0; i < clusteredGroups.length; i++) {
            const groupIndex = clusteredGroups[i];
            clusters[groupIndex].push(allLocations[i]);
        }

        // Step 3: Order clusters by distance to origin
        const clusterCentroids = clusters.map(group => getCentroid(group));
        const orderedClusterIndexes = orderClustersByProximity(clusterCentroids, originCoord);

        // Step 4: Optimize route within each cluster
        const fullOptimalRoute = [];
        let currentOrigin = origin;

        for (const clusterIndex of orderedClusterIndexes) {
            const group = clusters[clusterIndex];
            const subRoute = await runNearestNeighbor(group, currentOrigin, mode);

            fullOptimalRoute.push(...subRoute);

            // Set origin for next day to last destination
            const lastDest = subRoute[subRoute.length - 1][1];
            currentOrigin = { name: lastDest[0], address: lastDest[1] };
        }

        return fullOptimalRoute;
    } catch (error) {
        console.error("Error in calculateOptimalRoute:", error);
        throw new Error(error);
    }
}

function manhattanDistance(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function clusterLocationsHAC(points, numClusters) {
    const clusters = points.map((point, index) => [index]);

    function getMaxDistance(c1, c2) {
        let maxDist = -Infinity;
        for (let i of c1) {
            for (let j of c2) {
                const dist = manhattanDistance(points[i], points[j]);
                if (dist > maxDist) maxDist = dist;
            }
        }
        return maxDist;
    }

    while (clusters.length > numClusters) {
        let minDist = Infinity;
        let mergeA = 0;
        let mergeB = 1;

        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const dist = getMaxDistance(clusters[i], clusters[j]);
                if (dist < minDist) {
                    minDist = dist;
                    mergeA = i;
                    mergeB = j;
                }
            }
        }

        // Merge clusters
        clusters[mergeA] = [...clusters[mergeA], ...clusters[mergeB]];
        clusters.splice(mergeB, 1);
    }

    // Assign each point to its final cluster index
    const clusterAssignments = Array(points.length).fill(0);
    clusters.forEach((group, index) => {
        group.forEach(i => {
            clusterAssignments[i] = index;
        });
    });

    return clusterAssignments;
}

function getCentroid(locations) {
    const sum = locations.reduce((acc, loc) => {
        acc[0] += loc.latitude;
        acc[1] += loc.longitude;
        return acc;
    }, [0, 0]);

    return [sum[0] / locations.length, sum[1] / locations.length];
}

function orderClustersByProximity(centroids, originCoord) {
    const indexes = centroids.map((_, i) => i);
    indexes.sort((a, b) =>
        manhattanDistance(originCoord, centroids[a]) - manhattanDistance(originCoord, centroids[b])
    );
    return indexes;
}

async function runNearestNeighbor(locations, origin, mode) {
    const remaining = [...locations];
    const route = [];
    let currentOrigin = origin;

    while (remaining.length > 0) {
        const distancesList = await getDistanceMatrix(currentOrigin, remaining, mode);
        const destination = distancesList.reduce((prev, curr) =>
            prev.distance < curr.distance ? prev : curr
        );

        route.push([
            [currentOrigin.name, currentOrigin.address, currentOrigin.duration, currentOrigin.priority],
            [destination.originalLocationName, destination.destinationAddress, destination.duration, destination.priority]
        ]);

        const destIndex = remaining.findIndex(loc => loc.name === destination.originalLocationName);
        currentOrigin = remaining.splice(destIndex, 1)[0]; // Update origin to the selected destination
    }

    return route;
}