// GenerateItineraryScreen.tsx
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, SafeAreaView, Alert, Button, ActivityIndicator } from "react-native";
import { Picker } from '@react-native-picker/picker';
import { useRouter } from "expo-router";
import MultiRoutesMap from '../components/MultiRoutesMap';
import DirectionsList from '../components/DirectionsList';
import RouteColorCodeKey from "../components/RouteColorCodeKey";
import { calculateOptimalRoute, formatRouteInOrder } from '../scripts/optimalRoute.js';
import { calculateOptimalRouteHac } from '../scripts/hacNewOptimalRoute';
import { Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState, useEffect, useRef, SetStateAction } from "react";
import { getData } from '../scripts/localStore.js';
import { updateTrip } from '../scripts/databaseInteraction.js';
import { recalculatePaths } from '../scripts/reorderingLocations';
import { Ionicons } from '@expo/vector-icons';
import { getRoutePolylines } from "../scripts/routePolyline";
import { updateDayOrigin, addTripDatesToStartDateTime } from '../scripts/updateTransportDests.js';
import { calculateTripDates, formatSelectedDestinations, getMatchedPolylinesData, handleSameDateSelection } from '../scripts/dateDividers';
import { loadDestinations } from '../scripts/destinationLoader';
import ErrorBoundary from '../components//ErrorBoundary';
import DynamicImage from '../components/DynamicImage';

const { height } = Dimensions.get('window');

const GenerateItineraryScreen = () => {
    const router = useRouter();
    const navigation = useNavigation();

    const defaultMode : string = "DRIVING";

    // Tracks if map is loading
    const [isLoading, setIsLoading] = useState(true);  

    // Routes
    const [polylinesData, setPolylinesData] = useState<any[]>([]);
    const [transportDurations, setTransportDurations] = useState<any[]>([]);
    const [markers, setMarkers] = useState<any[]>([]);
    const [bounds, setBounds] = useState<any>({});
    const [allRoutesData, setAllRoutesData] = useState<any[]>([]);
    const [toSaveData, setToSaveData] = useState<any[]>([]);
    const [daysDictionary, setDaysDictionary] = useState<any[]>();

    type Place = {
        alias: string;
        address: string;
        priority: number;
        mode: string;
        transportToNext: string;
        transportDuration: number;
        startDateTime: Date;
        duration: number;
        notes: string;
        dayOrigin: boolean;
        cost: number;
        picture: string;
    };

    type PolylinePlace = Place & {
        duration: any;
        coordinates: any;
        id: string;
        strokeColor: string;
        strokeWidth: number;
    }


    const [origin, setOrigin] = useState<{ name: string; address: string; duration: number; priority: number}>();
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [tripDates, setTripDates] = useState<Date[]>([])

    // Initial empties
    const [destinations, setDestinations] = useState<Record<string, Place>>({});
    const [groupedDestinations, setGroupedDestinations] = useState<Place[][]>([]);
    const [grouped2DDestinations, setGrouped2DDestinations] = useState<Place[][]>([]);
    const [optimalRoute, setOptimalRoute] = useState<any[][]>([]);
    const [resultRoute, setResultRoute] = useState<any[][]>([]);
    const [frontendOptimalRoute, setFrontendOptimalRoute] = useState<any[][]>([]);
    const [transportationModes, setTransportationModes] = useState<string[]>([]);

    const [timeChecked, setTimeChecked] = useState<boolean>(false);
    const [changedModeOfTransport, setChangedModeOfTransport] = useState<boolean>(false);

    // For GI to see whether to optimize or not
    const [optimizeCheck, setOptimizeCheck] = useState(false);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
  
        timeoutRef.current = setTimeout(() => {
            if (isLoading) {
                console.log("Timeout after 60 seconds");
                failedPopup();
            }
        }, 60 * 1000); // 60 seconds
    };
  
    useEffect(() => {
        if (isLoading) {
            startTimer();
        }
  
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
  
    // Watch isLoading changes
    useEffect(() => {
        if (isLoading) {
            // Restart timer if it turns true
            startTimer();
        } else if (timeoutRef.current) {
            // Cancel timer if it turns false
            clearTimeout(timeoutRef.current);
        }
    }, [isLoading]);

    // Pop-Up for Priority 
    const confirmAction = () => {
        return new Promise((resolve, reject) => {
            Alert.alert(
                "Confirm Action",
                "Amount of locations exceeded available time.\nRemove lowest priority locations?",
                [
                    {
                        text: "Cancel",
                        onPress: () => resolve(false),
                        style: "cancel",
                    },
                    {
                        text: "OK",
                        onPress: () => resolve(true),
                    },
                ],
                { cancelable: false }
            );
        });
    }; 

    // Extract transportation mode
    useEffect(() => {
        if (Object.keys(destinations).length > 1) {
            // Get transportation modes for all but the last destination
            const modes = Object.values(destinations)
                .map(destination => destination.mode || defaultMode);

            setTransportationModes(modes);
            console.log("Transport Modes", transportationModes);
        }
    }, [destinations]);

    // Fetch destinations on mount
    useEffect(() => {
        console.log("On GenerateItineraryScreen");
        const fetchDestinations = async () => {
            const loadedDestinations = await loadDestinations(setDestinations, setStartDate, setEndDate, setTransportationModes, setOrigin, setOptimizeCheck);
            console.log("Loaded Destinations:", loadedDestinations);
            console.log("Do we optimize? The answer is:", optimizeCheck);
            setDestinations(loadedDestinations); // Update state with loaded destinations
        };

        fetchDestinations();
    }, []);

    // Helper function to reorder destinations based on orderedLocations
    const reorderDestinations = (orderedLocations: any[]) => {
        //console.log("DestDest:", destinations);

        const orderedDestinations = orderedLocations.map(location => {
            // location is an alias
            // Find the destination object where the alias matches
            const destination = Object.values(destinations).find(dest => dest.alias === location);

            //console.log("DestLoc:", destination); 
            return destination; 
        });

        //console.log("OrDest:", orderedDestinations);
        return orderedDestinations;
    };

    const saveOrderedDestinations = async (orderedDestinations: any) => {
        try {
            const tripID = "currentTrip";
            //await storeData(tripID, orderedDestinations);
            const currentTripID = await getData(tripID);
            if (!currentTripID) {
                console.log(" no tripid");
                throw new Error("Fail trip save");
            }
            console.log("currentTripID:", currentTripID);

            // Overrride/replace destinations with orderedDestinations
            // updateTrip with that new variable
            if(typeof currentTripID === 'number') {
                // It's just the trip ID
                const tripToStore = await getData(currentTripID.toString());
                console.log("tripToStore Upon Load", tripToStore);
                if (Object.keys(orderedDestinations).length != 0) {
                    tripToStore.destinations = orderedDestinations;
                    console.log("tripToStore After Replacing Destinations:", tripToStore);
                    const succeededToSave = await updateTrip(currentTripID, tripToStore);
                    if (succeededToSave) {
                        console.log("GI: Managed to save trip to the database");
                    } else {
                        console.log("GI: FAILED to save trip to the database");
                    }
                    // Update for the ScrollList
                    setResultRoute(orderedDestinations);
                    console.log("ResultRoute: ", resultRoute);
                    setFrontendOptimalRoute(optimalRoute);
                    setIsLoading(false);
                }
            }
        } catch (error) {
            console.error("Error saving ordered destinations:", error);
        }
    };

    const prevOptimalRouteRef = useRef<any[][]>([]);

    useEffect(() => {
        if (Object.keys(destinations).length > 0 && origin) {
            // This should only run twice max:
            // - 1. Upon load
            // - 2. After removing places with priority if not enough time
            const fetchOptimalRoute = async () => {

                try {
                    const destinationArray = Object.values(destinations);
                    console.log("Pre DestArray:", origin);
                    const simplifiedDestinations = destinationArray
                        .filter(destination => destination.alias !== origin.name)  // Exclude origin
                        .map(destination => ({
                            name: destination.alias,
                            address: destination.address,
                            duration: destination.duration,
                            priority: destination.priority
                        }));
                    // TODO: Remove Origin from simplifiedDestinations (multi days will divide so different format)
                    console.log("Simplified Destinations Array:", simplifiedDestinations);

                    console.log("Current Origin (GI):", origin);

                    const mode = 'DRIVING';

                    // Optimized trip or not is checked here
                    let result;
                    console.log("Do we optimize (checked again)? The answer is:", optimizeCheck);
                    if (optimizeCheck) {
                        // Calculate the number of days
                        let numberOfDays;
                        try {
                        if (startDate && endDate) {
                            const actualEndDate = new Date(endDate);
                            const actualStartDate = new Date(startDate);
                            numberOfDays = (actualEndDate.getTime() - actualStartDate.getTime()) / (1000 * 3600 * 24);
                        } else {
                            numberOfDays = 7; // Default 7 days
                        }
                        } catch (error) {
                        console.log("Error in Date", error);
                        }
                        console.log("Number of days calculated.");
                        result = await calculateOptimalRouteHac(simplifiedDestinations, origin, mode, numberOfDays);
                    } else {
                        // No optimize
                        result = formatRouteInOrder(simplifiedDestinations, origin);
                    }
                    
                    // Check if the result is different from the previous optimal route
                    if (JSON.stringify(result) !== JSON.stringify(prevOptimalRouteRef.current)) {
                        setOptimalRoute(result);
                        // Update ref to current optimal route
                        prevOptimalRouteRef.current = result;
                    }
                } catch (error) {
                    console.error("Failed to get optimal route:", error);
                    failedPopup();
                }
            };

            try {
                fetchOptimalRoute();
            } catch (error) {
                // TODO: Alert the user there was an error and go back to AED
                console.log("Error when trying to fetch optimal route: ", error);
                failedPopup();
            }
           
        }
    }, [destinations, origin]);

    // Pop-Up for when something Fails
    const failedPopup = () => {
        Alert.alert(
            "Error Occured",
            "Sorry. Something wrong occured and can't proceed.\nGoing back to the previous screen.\n\nPlease make sure your trip does not require oversea travels.",
            [
                {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                },
            ],
            { cancelable: false }
        );
    }; 

    // Pop-Up for when transport change fails
    const failedTransportPopup = () => {
        Alert.alert(
            "Warning",
            "Changing mode of transport would make travel time exceed available time in the day",
            [
                {
                    text: "OK",
                },
            ],
            { cancelable: false }
        );
    }; 

    useEffect(() => {
        console.log("Calling Pulled-out fetchPolylinesAndDurations");
        const fetchPolylinesAndDurations = async () => {
          await getRoutePolylines({
            optimalRoute,
            transportationModes,
            startDate,
            endDate,
            destinations,
            groupedDestinations,
            grouped2DDestinations,
            setAllRoutesData,
            setPolylinesData,
            setTransportDurations,
            setMarkers,
            setBounds,
            setGroupedDestinations,
            setGrouped2DDestinations,
            setTimeChecked,
            setDestinations,
            confirmAction,
            failedTransportPopup,
            setChangedModeOfTransport,
            setToSaveData,
            reorderDestinations,
            navigation,
            timeChecked,
            changedModeOfTransport,
            setDaysDictionary
          });
        };
        
        fetchPolylinesAndDurations();
      }, [optimalRoute, transportationModes]);

    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
    const [transportationText, setTransportationText] = useState("driving");

    useEffect(() => {
        console.log("Updated grouped2DDestinations:", grouped2DDestinations);

        // SAVING
        let updatedDests = updateDayOrigin(toSaveData, grouped2DDestinations);
        updatedDests = addTripDatesToStartDateTime(updatedDests, tripDates);
        //console.log("newDests:", newDests);
        console.log("upDests:", updatedDests);
        saveOrderedDestinations(updatedDests);

    }, [toSaveData]);    

    const handlePress = (destination: string) => {
        setSelectedDestination(prev => prev === destination ? null : destination);
    };

    const handleModeChange = (selectedMode: string, destinationIndex: number) => {
        setIsLoading(true);
        setChangedModeOfTransport(true);
        console.log("What happens to transportationModes:", transportationModes);

        // Check if the selected mode is the same as the current mode at the destinationIndex
        const previousMode = transportationModes[destinationIndex];
        if (previousMode === selectedMode) {
            console.log("Mode is the same, no update needed.");
            setIsLoading(false);
            return;
        }
    
        const updatedTransportationModes = [...transportationModes];
        updatedTransportationModes[destinationIndex] = selectedMode;
    
        // Update the state with the new array for transportation modes
        setTransportationModes(updatedTransportationModes);
        setTransportationText(selectedMode);
    
        console.log("What happens to transportationModes 2:", updatedTransportationModes);
    };
    
    const reviewItinerary = () => {
        router.push("/ReviewItineraryScreen");
    };


    const formatDate = (date: Date) => {
        if (isNaN(date.getTime())) {
            console.error("Invalid Date passed to formatDate:", date);
            return "Invalid Date"; // Return a fallback value for invalid dates
        }
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    };

    // Used to calculate Dates
    useEffect(() => {
        console.log("Calculating dates in GI");

        const tempDates = calculateTripDates(startDate, endDate);
        setTripDates(tempDates);
        
        console.log("Trip Dates:", tempDates);

        // endDate is set after startDate so use endDate for this useEffect
    }, [endDate]);    

    const handleDatePress = (index: SetStateAction<number | null>) => {
        // Check if the same day index is selected again
        const isSameDateSelected = handleSameDateSelection(index, selectedDayIndex, setSelectedDayIndex, setPolylinesData, allRoutesData);
        if (isSameDateSelected) {
            return;
        }
    
        // Update the selected day index
        setSelectedDayIndex(index);
        console.log("Selected day index", index);
    
        // Get the destinations for this specific day
        const selectedDestinations = groupedDestinations[index];
        console.log("Selected Dests Date:", selectedDestinations);
    
        // Guard against undefined or empty array
        if (!selectedDestinations || selectedDestinations.length === 0) {
            console.warn("No destinations available for this day!");
            return;
        }
    
        // Convert the selectedDestinations into an object with numeric keys
        const formattedDestinations = formatSelectedDestinations(selectedDestinations);
        console.log("Formatted Destinations (Date):", formattedDestinations);
    
        // Get the matched polyline data
        const matchedPolylinesData = getMatchedPolylinesData(grouped2DDestinations, index, formattedDestinations);
    
        // After processing all destinations, update the polyline data
        if (matchedPolylinesData.length > 0) {
            // Remove the last one since that shows route to next day (not necessary right now)
            matchedPolylinesData.pop();
    
            console.log("Updating global polylines data:", matchedPolylinesData);
            setPolylinesData(matchedPolylinesData); // Update the global polyline data
        } else {
            console.warn("No polyline data to update.");
        }
      };
    
    // Function to move the destination up or down
    const moveDestination = async (routeGroupIndex: number, destinationIndex: number, direction: string) => {
        setIsLoading(true);
        const newResultRoute = [...resultRoute];

        // For multiple days, routeGroupIndex needs to help calculate the actual destination index
        /** Get the number of locations per index (by subtracting the end from start)
         *  Calculate index from that
         */
        if (routeGroupIndex !== 0 && daysDictionary) {
            console.log("Days Dictionary ALL:", daysDictionary);
            let currentIndex = 0;
            let previousEndTarget = 0;
            let startTarget = daysDictionary[0];
            // We add the total index count of each day before the current one we're trying to move
            for (let i = 0; i < routeGroupIndex; i++) {
                console.log("Round ", i);
                console.log("Days Dictionary is currently:", previousEndTarget);
                const difference = parseInt(startTarget) - previousEndTarget;
                console.log("Start target:", typeof startTarget);
                console.log("previousEndTarget:", typeof previousEndTarget);
                console.log("difference:", difference);
                currentIndex = currentIndex + difference; // EndIndex - StartIndex
                // TODO: Update so that i goes to the next daysDictionary since that's the endpoint
                previousEndTarget = startTarget;
                startTarget = daysDictionary[startTarget];
                console.log("Current calculated index is ", currentIndex);
            }
            // Add current index to get where it would be converted from the routeGroupIndex (total indices before + current group's index)
            currentIndex = currentIndex + destinationIndex;
            console.log("Current calculated index after adding final is ", currentIndex);
            destinationIndex = currentIndex;
            console.log("Calculated index is ", destinationIndex);
        }
        
    
        // Ensure destinationIndex is valid
        if (destinationIndex < 0 || destinationIndex >= newResultRoute.length) return;
    
        let newIndex = destinationIndex;
    
        if (direction === 'up' && destinationIndex > 0) {
            // Move the destination up
            const [moved] = newResultRoute.splice(destinationIndex, 1);
            newIndex = destinationIndex - 1;
            newResultRoute.splice(newIndex, 0, moved);
        } else if (direction === 'down' && destinationIndex < newResultRoute.length - 1) {
            // Move the destination down
            const [moved] = newResultRoute.splice(destinationIndex, 1);
            newIndex = destinationIndex + 1;
            newResultRoute.splice(newIndex, 0, moved);
        } else {
            return;
        }
    
        // Determine the range of affected destinations (since we have prev, current, next locations)
        const start = Math.max(0, newIndex - 2);
        const end = Math.min(newResultRoute.length, newIndex + 1); // non-inclusive
    
        const affectedSlice = newResultRoute.slice(start, end);
    
        try {
            // Recalculate only the affected locations (to save API calls)
            const recalculatedSlice = await recalculatePaths(affectedSlice);
    
            // Replace the affected section in newResultRoute
            for (let i = start, j = 0; i < end; i++, j++) {
                newResultRoute[i] = {
                    ...newResultRoute[i],
                    ...recalculatedSlice[j]
                };
            }

            // Save
            const newDatesDestinations = addTripDatesToStartDateTime(newResultRoute, tripDates);
            setToSaveData(newDatesDestinations);
            console.log("newResultRoute:", newResultRoute)

            // Update the frontend map
            const simplifiedDestinations = newResultRoute
                        .filter(destination => destination.alias !== origin.name)  // Exclude origin
                        .map(destination => ({
                            name: destination.alias,
                            address: destination.address,
                            duration: destination.duration,
                            priority: destination.priority
                        }));
            const newRouteOrderedArray = formatRouteInOrder(simplifiedDestinations, origin);
            console.log("newRouteOrderedArray:", newRouteOrderedArray);
            setFrontendOptimalRoute(newRouteOrderedArray);
        } catch (error) {
            console.error("Error recalculating paths or saving data:", error);
        }
        setIsLoading(false);
    };    

    // Catches ALL errors
    useEffect(() => {
        // Global error handler for uncaught errors
        const errorHandler = (error: any, isFatal: boolean | undefined) => {
            // Ensure isFatal is always a boolean
            const fatal = isFatal ?? false; 
            console.log('Caught global error:', error);
            if (fatal) {
                console.log('Fatal error:', error);
            }
          };
    
        ErrorUtils.setGlobalHandler(errorHandler);
    
        return () => {
            // Cleanup when unmounded
            ErrorUtils.setGlobalHandler(() => {});
        };
      }, []);

    return (
        <ErrorBoundary onError={failedPopup}>
        <View style={styles.container}>    
            {isLoading ? (
                    // Show loading spinner while data is being fetched
                    <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />
                ) : (
                    // Once loading is done, show the content
                    <View></View>
            )}

            {!isLoading && (
                <SafeAreaView style={{ flex: 1 }}>
                    {frontendOptimalRoute.length > 0 &&
                         Array.isArray(polylinesData) &&
                         polylinesData.length > 0 &&
                         polylinesData.every(polyline => 
                             polyline && Array.isArray(polyline.coordinates) && polyline.coordinates.length > 0
                         ) ? (
                        <MultiRoutesMap
                            locations={frontendOptimalRoute}
                            transportationModes={transportationModes}
                            polylines={polylinesData}
                            transportDurations={transportDurations}
                            markers={markers}
                            bounds={bounds}
                        />
                    ) : (
                        <>
                            {/* Backup if no route is found */}
                            {console.log("PolylinesData:", polylinesData)}
                            <Text style={styles.currentLocationText}>No routes found for this day.</Text>
                        </>
                    )}
                </SafeAreaView>
            )}

            <SafeAreaView>

                <ScrollView
                    contentContainerStyle={styles.scrollViewContainer}
                    style={styles.scrollView}
                    nestedScrollEnabled={true}
                >
                    {resultRoute.reduce((acc, destination) => {
                        // If it's a new day (dayOrigin is true), start a new group
                        if (destination.dayOrigin) {
                            // If the last group is not empty, push it to the accumulator and start a new group
                            if (acc.length > 0 && acc[acc.length - 1].length > 0) {
                                acc.push([]); // Start a new group
                            }
                        }

                        // Add the destination to the current group
                        if (acc.length === 0) {
                            acc.push([destination]); // Start with the first destination of the group
                        } else {
                            acc[acc.length - 1].push(destination); // Add destination to the current group
                        }

                        return acc;
                    }, []).map((routeGroup, routeGroupIndex) => {
                        const destinationGroupKey = `group-${routeGroupIndex}`;
                        let dateForThisGroup;

                        console.log('routeGroup:', routeGroup);
                        console.log('routeGroupIndex:', routeGroupIndex);

                        // Calculate the date for the group 
                        try {
                            if (routeGroupIndex === 0) {
                                dateForThisGroup = tripDates[0];
                            } else {
                                dateForThisGroup = tripDates[routeGroupIndex];
                            }
                        } catch (error) {
                            console.log("Error in calculating group date:", error);
                            dateForThisGroup = new Date(); // Fallback to current date
                        }

                        console.log('Date for this group:', dateForThisGroup);
                        const isSelected = selectedDayIndex === routeGroupIndex;

                        return (
                            <View key={destinationGroupKey}>
                                {/* Date Header */}
                                {routeGroup.length > 0 && (routeGroupIndex === 0 || routeGroup[0].dayOrigin) ? (
                                    <TouchableOpacity
                                        onPress={() => handleDatePress(routeGroupIndex)}
                                        style={[styles.dateHeader, isSelected && styles.selectedDateHeader]}
                                    >
                                        <Text style={[styles.dateText, isSelected && styles.selectedDateText]}>
                                            {formatDate(dateForThisGroup)}
                                        </Text>
                                        <Ionicons
                                            name={isSelected ? "chevron-up" : "chevron-down"}
                                            size={18}
                                            color="#000"
                                        />
                                    </TouchableOpacity>
                                ) : null}

                                {/* Loop through each destination in the current routeGroup */}
                                {routeGroup && routeGroup.length > 0 && routeGroup.map((destination: { alias: any; address: any; duration: any; priority: any; picture: { url: string; }; mode: string; transportDuration: any; }, destinationIndex: number) => {
                                    const destinationKey = `${destinationGroupKey}-${destinationIndex}`;  // Unique key for each destination
                                    const destinationName = destination.alias;
                                    const destinationAddress = destination.address;
                                    const destinationDuration = destination.duration;
                                    const destinationPriority = destination.priority;
                                    const destinationImageUri = destination.picture?.url || '';
                                    const destinationTransportMode = destination.mode || defaultMode;
                                    const destinationTransportDuration = destination.transportDuration;

                                    // Determine if it's the last destination in the current routeGroup
                                    const isLastDestination = destinationIndex === routeGroup.length - 1;

                                    return (
                                        <View key={destinationKey}>
                                            <TouchableOpacity 
                                                style={styles.destinationElement} 
                                                onPress={() => handlePress(destinationKey)}  // Update selectedDestination on click
                                            >
                                                <View style={styles.backgroundContainer}>
                                                    <View style={styles.backgroundOverlay}></View>
                                                </View>

                                                <View style={styles.destinationContainer}>
                                                    <DynamicImage placeName={destinationName} containerStyle={styles.destinationImage} imageStyle={styles.destinationImage} />
                                                    <View style={styles.destinationLabel}>
                                                        <Text style={styles.destinationName}>{destinationName}</Text>
                                                        <Text style={styles.destinationDetails}>
                                                            Duration: {Math.floor(destinationDuration / 60)} hrs {destinationDuration % 60} mins | Priority: {destinationPriority}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>

                                            {/* Conditional rendering of additional info */}
                                            {selectedDestination === destinationKey && (
                                                <View style={styles.additionalInfo}>
                                                    {/* Show transport mode */}
                                                    <Text style={styles.additionalText}>
                                                        Transport Mode: {isLastDestination ? "None" : destinationTransportMode.charAt(0).toUpperCase() + destinationTransportMode.slice(1).toLowerCase()}
                                                    </Text>

                                                    {/* Dropdown for picking transport mode */}
                                                    {!isLastDestination && (
                                                        isLoading ? (
                                                            <Text style={styles.additionalText}>
                                                                Loading new transport route...
                                                            </Text>
                                                        ) : (
                                                            <Picker
                                                                selectedValue={destinationTransportMode}
                                                                onValueChange={(mode: string) => handleModeChange(mode, destinationIndex)}
                                                            >
                                                                <Picker.Item label="Driving" value="driving" />
                                                                <Picker.Item label="Walking" value="walking" />
                                                                <Picker.Item label="Bicycling" value="bicycling" />
                                                                <Picker.Item label="Transit" value="transit" />
                                                            </Picker>
                                                        )
                                                    )}

                                                    {/* Show transport duration */}
                                                    <Text style={styles.additionalText}>
                                                        Duration: {isLastDestination ? "None" : destinationTransportDuration}
                                                    </Text>

                                                    {/* Directions */}
                                                    <View style={{ maxHeight: 300 }}> 
                                                        <ScrollView nestedScrollEnabled={true}>
                                                            <DirectionsList
                                                                origin={routeGroup[destinationIndex]?.address} 
                                                                destination={routeGroup[destinationIndex + 1]?.address || "Unknown Destination"}
                                                                mode={destinationTransportMode}
                                                            />
                                                        </ScrollView>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Move buttons */}
                                            <View style={styles.buttonContainer}>

                                                {/* If it's the first location in any other day, show only the down button */}
                                                {(routeGroupIndex !== 0 && destinationIndex === 0 ) || (routeGroupIndex === 0 && destinationIndex === 1) && (
                                                    <TouchableOpacity
                                                        onPress={() => moveDestination(routeGroupIndex, destinationIndex, 'down')}
                                                        style={styles.moveButton}
                                                        disabled={isLoading}
                                                    >
                                                        <Ionicons name="arrow-down" size={20} color="#000" />
                                                    </TouchableOpacity>
                                                )}

                                                {/* If it's the last location in any day, show only the up button */}
                                                {!(destinationIndex === 0 && destinationIndex === routeGroup.length - 1) && destinationIndex !== 0 && destinationIndex !== routeGroup.length - 1 && !(routeGroupIndex === 0 && destinationIndex === 1) && (
                                                    <TouchableOpacity
                                                        onPress={() => moveDestination(routeGroupIndex, destinationIndex, 'up')}
                                                        style={styles.moveButton}
                                                        disabled={isLoading}
                                                    >
                                                        <Ionicons name="arrow-up" size={20} color="#000" />
                                                    </TouchableOpacity>
                                                )}

                                                {/* All other locations have both up and down buttons */}
                                                {destinationIndex !== 0 && destinationIndex !== routeGroup.length - 1 && !(routeGroupIndex === 0 && destinationIndex === 1) && (
                                                    <>
                                                        <TouchableOpacity
                                                            onPress={() => moveDestination(routeGroupIndex, destinationIndex, 'down')}
                                                            style={styles.moveButton}
                                                            disabled={isLoading}
                                                        >
                                                            <Ionicons name="arrow-down" size={20} color="#000" />
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                                {/* Backup if no routes found */}
                                {(!routeGroup || routeGroup.length === 0) && (
                                    <Text style={styles.currentLocationText}>No routes found.</Text>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            </SafeAreaView>

            {/* The color code key for routes */}
            <RouteColorCodeKey />

            {/* "Review Itinerary" button */}
            <TouchableOpacity
                style={[styles.reviewItineraryButton, isLoading && styles.disabledButton]}  // Apply styles to disable button
                onPress={reviewItinerary}
                disabled={isLoading}  // Disable the button when map is loading
            >
                <Text style={styles.buttonText}>Review Itinerary</Text>
            </TouchableOpacity>
        </View>
        </ErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        height: "70%",
    },

    headerContainer: {
        position: "absolute",
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        width: "100%",
    },

    headerText: {
        color: 'white',
        fontSize: 25,
        fontWeight: 'bold',
    },

    notificationButton: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10,
    },

    searchSection: {
        flexDirection: "row",
        marginVertical: 20,
        marginTop: 15,
        paddingHorizontal: 20,
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },

    searchBar: {
        flex: 1,
        flexDirection: "row",
        backgroundColor: "white",
        padding: 10,
        borderRadius: 10,
    },

    backgroundImage: {
        width: "100%",
        height: 150,
        borderRadius: 10,
        resizeMode: "cover",
        position: "relative",
    },

    backgroundImageOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        width: "100%",
        height: "100%",
        borderRadius: 10,
    },

    currentLocationText: {
        position: "absolute",
        bottom: 10,
    },

    // ==== DESTINATION ELEMENT ==== //
    homeSection: {
        backgroundColor: "#F4F4F4",
        borderRadius: 10,
        height: "100%",
        top: -10,
    },

    tripButton: {
        padding: 10,
        backgroundColor: "#24a6ad",
        borderRadius: 10,
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },

    tripButtons: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        padding: 5,
    },

    recommendBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },

    recommendBtnText: {
        marginLeft: 5,
        color: "black",
    },

    activeRecommendBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#24a6ad",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },

    recommendBtnTextActive: {
        marginLeft: 5,
        color: "white",
    },

    recommendDest: {
        backgroundColor: "white",
        padding: 10,
        height: 250,
        borderRadius: 10,
        width: 300,
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },

    destImage: {
        borderRadius: 10,
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    saveIconWrapper: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "rgba(36,166, 173, 0.8)",
        borderRadius: 20, 
        padding: 15,
    },

    destImageWrapper: {
        position: "relative", 
        borderRadius: 10,
        width: "100%",
        height: "70%",
    },

    destTextWrapper: {
        flex: 1,
        flexDirection: "column",
        marginTop: 5,
    },

    navBar: {
        flexDirection: "row",
        backgroundColor: "white",
        justifyContent: "space-between",
        alignItems: "center",
        height: "8%",
        shadowColor: "#333333",
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },

    destinationElement: {
        width: "100%",
        height: 75,
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        padding: 5,
        position: "relative",
    },

    destinationImage: {
        height: 70,
        width: 70,
        borderRadius: 10,
    },

    destinationContainer: {
        flexDirection: "row",
        justifyContent: "center",
    },

    destinationLabel: {
        flexDirection: "column",
        marginLeft: 10,
        justifyContent: "center",
    },

    destinationName: {
        color: "white",
        fontSize: 22,
        fontWeight: "bold",
    },

    destinationDetails: {
        color: "white",
        fontSize: 18,
    },

    backgroundContainer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 10,
        overflow: "hidden",
    },

    backgroundOverlay: {
        flex: 1,
        backgroundColor: "#24a6ad",
        borderRadius: 10,
    },

    // ==== SCROLL WINDOW FOR DESTINATIONS ==== //
    scrollViewContainer: {
        flexGrow: 1,
        alignItems: "center",
        paddingLeft: 10,
        paddingRight: 10,
        borderWidth: 2,
        borderRadius: 10,
        borderColor: "white",
    },

    scrollView: {
        maxHeight: height * 0.45,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 10,
    },

    // ==== GENERATE PLAN BUTTON ==== //
    reviewItineraryButton: {
        backgroundColor: "#24a6ad",
        paddingVertical: 10,
        paddingHorizontal: 40,
        borderRadius: 15,
        marginTop: 20,
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        alignSelf: "center",
        marginBottom: 10,
    },

    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
        marginLeft: 20,
        marginRight: 20,
    },


    dateHeader: {
        flexDirection: "row",
        marginTop: 10,
        backgroundColor: "gray",
        color: "white",
        width: "100%",
    },

    dateText: {
        color: "white",
        marginLeft: 20,
        marginTop: 10,
        marginBottom: 10,
        fontSize: 18,
    },
    selectedDateHeader: {
        backgroundColor: '#dcdcdc',
    },
    selectedDateText: {
            color: '#007aff',
    },

    additionalInfo: {
        marginTop: 10,
        backgroundColor: "#f0f0f0",
        padding: 10,
        borderRadius: 5,
    },

    additionalText: {
        fontSize: 16,
        color: "#333",
    },
    disabledButton: {
        backgroundColor: '#cccccc',
    },

    // Pop-Up
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
        alignItems: 'center',
    },
    modalText: {
        fontSize: 16,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    moveButton: {
        padding: 5,
        backgroundColor: "rgba(36,166, 173, 0.8)",
        borderRadius: 5,
        marginHorizontal: 5,
    },
});

export default GenerateItineraryScreen;
