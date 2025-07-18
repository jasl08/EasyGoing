import React, { useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import axios from 'axios';
import { getIdToken } from '@/scripts/getFirebaseID';
import { auth } from '@/firebaseConfig';

type Coordinates = {
    latitude: number;
    longitude: number;
};

type Place = {
    description: string;
    place_id: string;
};

export const getCoordinates = async (description: string): Promise<Coordinates | null> => {
    const idToken = await getIdToken(auth)
    try {
        const response = await axios.get(`https://ezgoing.app/api/geocode?address=${encodeURIComponent(description)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`, // Include the ID token in the header
            },
        });
        const result = response.data.results[0];

        if (result && result.geometry && result.geometry.location) {
            return {
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting coordinates:", error);
        return null;
    }
};

const HomeScreen = () => {
    const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);

    const handlePlaceSelect = async (place: Place): Promise<void> => {
        const description = place.description;

        try {
            const coordinates = await getCoordinates(description);

            console.log("Selected place:", description);
            console.log("Selected place coords:", coordinates);

            if (coordinates) {
                setSelectedCoordinates(coordinates);
            } else {
                console.log("No coordinates found for the selected place.");
            }
        } catch (error) {
            console.error("Error while fetching coordinates (Geo):", error);
        }
    };

    return (
        <View style={styles.container}>
            <Button title="Select Place" onPress={() => handlePlaceSelect({ description: 'New York', place_id: '123' })} />
            {selectedCoordinates && (
                <Text>
                    Selected Coordinates: {selectedCoordinates.latitude}, {selectedCoordinates.longitude}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default HomeScreen;
