import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AutocompleteTextBox from '../AutoCompleteTextBox';

// Mock the getIdToken function to return a mock ID token
jest.mock('../../scripts/getFirebaseID', () => ({
  getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
}));

describe('AutocompleteTextBox', () => {
  test('renders input field correctly', () => {
    const { getByPlaceholderText } = render(
      <AutocompleteTextBox placeholder="Search places" />
    );

    // Check if input field is rendered
    expect(getByPlaceholderText('Search places')).toBeTruthy();
  });

  test('displays address suggestions when user types', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AutocompleteTextBox placeholder="Search places" />
    );

    const input = getByPlaceholderText('Search places');
    
    // Simulate typing into the input field
    fireEvent.changeText(input, 'New York');

    // Wait for the API call to be made and the suggestions to appear
    await waitFor(() => {
      // Ensure that suggestions are displayed
      expect(queryByText('New York, NY')).toBeTruthy(); // Adjust the text as per your expected API response
    });
  });

  test('calls onPlaceSelect callback when an address is selected', async () => {
    const onPlaceSelect = jest.fn(); // Mock function

    const { getByPlaceholderText, getByText } = render(
      <AutocompleteTextBox placeholder="Search places" onPlaceSelect={onPlaceSelect} />
    );

    const input = getByPlaceholderText('Search places');
    
    // Simulate typing into the input field
    fireEvent.changeText(input, 'New York');

    // Wait for the API response and suggestions to appear
    await waitFor(() => {
      expect(getByText('New York, NY')).toBeTruthy(); // Adjust based on the API response
    });

    // Simulate selecting the first suggestion
    fireEvent.press(getByText('New York, NY'));

    // Verify that the onPlaceSelect callback was called with correct address
    expect(onPlaceSelect).toHaveBeenCalledWith({
      description: 'New York, NY',
      place_id: 'test',
    });
  });

  test('does not call onPlaceSelect if the user does not select an address', async () => {
    const onPlaceSelect = jest.fn(); // Mock function

    const { getByPlaceholderText } = render(
      <AutocompleteTextBox placeholder="Search places" onPlaceSelect={onPlaceSelect} />
    );

    const input = getByPlaceholderText('Search places');
    
    // Simulate typing into the input field
    fireEvent.changeText(input, 'New York');

    // Simulate the user not selecting any address
    fireEvent(input, 'blur');

    // Verify that onPlaceSelect is not called
    expect(onPlaceSelect).not.toHaveBeenCalled();
  });

  test('clears suggestions when the user selects an address', async () => {
    const { getByPlaceholderText, queryByText } = render(
      <AutocompleteTextBox placeholder="Search places" />
    );

    const input = getByPlaceholderText('Search places');
    
    // Simulate typing into the input field
    fireEvent.changeText(input, 'New York');

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(queryByText('New York, NY')).toBeTruthy(); // Adjust based on API response
    });

    // Query for the suggestion item
    const suggestionItem = queryByText('New York, NY');

    // Ensure the suggestion item exists
    if (suggestionItem) {
        fireEvent.press(suggestionItem);
    } else {
        throw new Error('Suggestion not found');
    }

    // Verify that suggestions are cleared
    await waitFor(() => {
      expect(queryByText('New York, NY')).toBeNull();
    });
  });

  test('resets suggestions after address selection', async () => {
    const { getByPlaceholderText, queryByText } = render(
      <AutocompleteTextBox placeholder="Search places" />
    );

    const input = getByPlaceholderText('Search places');
    
    // Simulate typing into the input field
    fireEvent.changeText(input, 'New York');

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(queryByText('New York, NY')).toBeTruthy(); // Adjust as needed
    });

    // Query for the suggestion item
    const suggestionItem = queryByText('New York, NY');

    // Ensure the suggestion item exists
    if (suggestionItem) {
        fireEvent.press(suggestionItem);
    } else {
        throw new Error('Suggestion not found');
    }

    // Verify suggestions are cleared
    await waitFor(() => {
      expect(queryByText('New York, NY')).toBeNull();
    });
  });
});
