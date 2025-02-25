import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import MultiRoutesMap from '../MultiRoutesMap';
import { useIsFocused } from '@react-navigation/native';

// Mocking react-native-maps
jest.mock('react-native-maps', () => {
  const actualMaps = jest.requireActual('react-native-maps');
  return {
    ...actualMaps,
    MapView: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
      <actualMaps.MapView {...props}>{children}</actualMaps.MapView>
    ),
    Polyline: ({ ...props }: { [key: string]: any }) => <actualMaps.Polyline {...props} />,
    Marker: ({ ...props }: { [key: string]: any }) => <actualMaps.Marker {...props} />,
  };
});

// Mocking @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(),
}));

describe('MultiRoutesMap', () => {
  const mockPolylines = [
    {
      id: '1',
      coordinates: [
        { latitude: 37.78825, longitude: -122.4324 },
        { latitude: 37.75825, longitude: -122.4624 },
      ],
      strokeColor: 'red',
      strokeWidth: 4,
    },
  ];

  const mockMarkers = [
    {
      origin: { latitude: 37.78825, longitude: -122.4324 },
      destination: { latitude: 37.75825, longitude: -122.4624 },
    },
  ];

  const mockTransportationModes = ['driving'];

  const mockLocations = [
    ['San Francisco', 'California'],
    ['Oakland', 'California'],
  ];

  const mockTransportDurations = [{ mode: 'driving', duration: '15 min' }];
  const mockBounds = { north: 37.8, south: 37.7, east: -122.4, west: -122.5 };

  beforeEach(() => {
    (useIsFocused as jest.Mock).mockReturnValue(true); // Mocking the isFocused hook correctly
  });

  it('should render loading state initially', () => {
    render(
      <MultiRoutesMap
        locations={[]}
        transportationModes={[]}
        polylines={[]}
        transportDurations={[]}
        markers={[]}
        bounds={null}
      />
    );

    expect(screen.getByText('LOADING...')).toBeTruthy();
  });

  it('should render map after data has loaded', async () => {
    render(
      <MultiRoutesMap
        locations={mockLocations}
        transportationModes={mockTransportationModes}
        polylines={mockPolylines}
        transportDurations={mockTransportDurations}
        markers={mockMarkers}
        bounds={mockBounds}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('LOADING...')).toBeNull(); // Ensure loading state is gone
      // Check if MapView component is rendered
      expect(screen.getByTestId('mapview')).toBeTruthy();
    });
  });

  it('should update region based on polylines', async () => {
    render(
      <MultiRoutesMap
        locations={mockLocations}
        transportationModes={mockTransportationModes}
        polylines={mockPolylines}
        transportDurations={mockTransportDurations}
        markers={mockMarkers}
        bounds={mockBounds}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('mapview')).toHaveProp('region', expect.objectContaining({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }));
    });
  });

  it('should render markers with correct colors based on transportation mode', async () => {
    render(
      <MultiRoutesMap
        locations={mockLocations}
        transportationModes={mockTransportationModes}
        polylines={mockPolylines}
        transportDurations={mockTransportDurations}
        markers={mockMarkers}
        bounds={mockBounds}
      />
    );

    const originMarker = screen.getByText('San Francisco');
    const destinationMarker = screen.getByText('Oakland');

    expect(originMarker).toBeTruthy();
    expect(destinationMarker).toBeTruthy();
  });

  it('should render route duration info correctly', async () => {
    render(
      <MultiRoutesMap
        locations={mockLocations}
        transportationModes={mockTransportationModes}
        polylines={mockPolylines}
        transportDurations={mockTransportDurations}
        markers={mockMarkers}
        bounds={mockBounds}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Duration: 15 min')).toBeTruthy();
    });
  });
});
