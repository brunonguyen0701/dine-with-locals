import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, Autocomplete } from '@react-google-maps/api';
import { Listing } from '../../../../shared/types/Listing';
import { Request } from '../../../../shared/types/Request';

interface PlacesMapProps {
  listings?: Listing[];
  requests?: Request[];
  onListingClick?: (listing: Listing) => void;
  onRequestClick?: (request: Request) => void;
  selectedListing?: Listing | null;
  selectedRequest?: Request | null;
  userCoordinates?: google.maps.LatLngLiteral | null;
  onLocationChange?: (coordinates: google.maps.LatLngLiteral) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px', // Fixed height for the map
};

const PlacesMap: React.FC<PlacesMapProps> = ({
  listings = [],
  requests = [],
  onListingClick,
  onRequestClick,
  selectedListing,
  selectedRequest,
  userCoordinates,
  onLocationChange,
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const defaultCenter: google.maps.LatLngLiteral = {
    lat: 41.881563,
    lng: -87.649869,
  }; // Default to Chicago if not provided

  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(
    userCoordinates ?? defaultCenter,
  );
  const [markers, setMarkers] = useState<Array<google.maps.Marker>>([]);
  const [searchMarker, setSearchMarker] = useState<google.maps.Marker | null>(
    null,
  );
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedPlaceDetails, setSelectedPlaceDetails] =
    useState<google.maps.places.PlaceResult | null>(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState<boolean>(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);

    // Add click listener for POIs (Points of Interest) like restaurants
    map.addListener('click', (event: any) => {
      // Check if the click was on a POI
      if (event.placeId) {
        // Prevent the default info window from showing
        event.stop();

        // Get place details using the place ID
        const service = new google.maps.places.PlacesService(map);
        service.getDetails(
          {
            placeId: event.placeId,
            fields: [
              'name',
              'formatted_address',
              'opening_hours',
              'formatted_phone_number',
              'rating',
              'reviews',
              'website',
              'price_level',
              'photos',
              'types',
              'business_status',
            ],
          },
          (result, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              result
            ) {
              setSelectedPlaceDetails(result);
              setShowPlaceDetails(true);
            }
          },
        );
      }
    });
  }, []);

  // Function to get detailed place information
  const getPlaceDetails = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!map || !place.place_id) return;

      const service = new google.maps.places.PlacesService(map);

      service.getDetails(
        {
          placeId: place.place_id,
          fields: [
            'name',
            'formatted_address',
            'opening_hours',
            'formatted_phone_number',
            'rating',
            'reviews',
            'website',
            'price_level',
            'photos',
            'types',
            'business_status',
          ],
        },
        (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result) {
            setSelectedPlaceDetails(result);
            setShowPlaceDetails(true);
          }
        },
      );
    },
    [map],
  );

  // Update map center when userCoordinates change
  useEffect(() => {
    if (userCoordinates && !hasSearched) {
      console.log('Updating map center to user coordinates:', userCoordinates);
      setMapCenter(userCoordinates);
      if (map) {
        map.setCenter(userCoordinates);
        map.setZoom(12); // Set a reasonable zoom level for user location
      }
    }
  }, [userCoordinates, map, hasSearched]);

  const onAutocompleteLoad = useCallback(
    (autocomplete: google.maps.places.Autocomplete) => {
      autocompleteRef.current = autocomplete;
    },
    [],
  );

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current && map) {
      const place = autocompleteRef.current.getPlace();

      if (place.geometry && place.geometry.location) {
        const newCenter = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setMapCenter(newCenter);
        map.setCenter(newCenter);
        map.setZoom(16); // Higher zoom level for better detail of searched location

        // Mark that a search has been performed
        setHasSearched(true);

        // Remove existing search marker
        if (searchMarker) {
          searchMarker.setMap(null);
        }

        // Create a distinctive search marker with yellow styling (same icon as listings/requests)
        const searchMarkerIcon = {
          path: 'M12 0C7.58 0 4 3.58 4 8c0 1.4.5 3.3 1.4 4.9.9 1.7 2 3.2 3 4.3.7.8 1.5 1.5 1.9 2 .1.1.2.2.4.3.2.1.2.2.3.3.2.2.6.2.8 0 .1-.1.1-.1.3-.3.1-.1.3-.2.4-.3.4-.4 1.2-1.1 1.9-2 1-1.1 2.1-2.6 3-4.3.9-1.6 1.4-3.5 1.4-4.9 0-4.42-3.58-8-8-8zm0 11.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 4.5 12 4.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z',
          fillColor: '#fbbf24', // Bright yellow (amber-400)
          fillOpacity: 1,
          strokeWeight: 0, // Same as listing/request markers
          rotation: 0,
          scale: 2, // Larger than regular markers for distinction
          anchor: new google.maps.Point(12, 24),
          labelOrigin: new google.maps.Point(12, 8),
        };

        // Create the search marker with enhanced styling
        const newSearchMarker = new google.maps.Marker({
          map,
          position: newCenter,
          title: `📍 ${place.name || 'Searched Location'} - Click to see details`,
          icon: searchMarkerIcon,
          animation: google.maps.Animation.DROP, // Nice drop animation
          zIndex: 1000, // Ensure it appears above other markers
        });

        // Add click listener to search marker to show place details
        newSearchMarker.addListener('click', () => {
          getPlaceDetails(place);
        });

        setSearchMarker(newSearchMarker);

        // Notify parent component about location change
        if (onLocationChange) {
          onLocationChange(newCenter);
        }
      }
    }
  }, [map, onLocationChange, searchMarker]);

  // Create markers when listings or map changes
  useEffect(() => {
    if (!map || !window.google) {
      return;
    }

    // Clean up old markers
    markers.forEach((marker) => {
      marker.setMap(null);
    });

    // Create new markers
    const newMarkers: Array<google.maps.Marker> = [];

    // Create SVG icon for the markers
    const createMarkerIcon = (isSelected: boolean) => {
      const color = isSelected ? '#e53935' : '#0f766e'; // Coral-500 for selected, teal for regular

      // SVG path for a location pin that looks like the image
      const svgMarker = {
        path: 'M12 0C7.58 0 4 3.58 4 8c0 1.4.5 3.3 1.4 4.9.9 1.7 2 3.2 3 4.3.7.8 1.5 1.5 1.9 2 .1.1.2.2.4.3.2.1.2.2.3.3.2.2.6.2.8 0 .1-.1.1-.1.3-.3.1-.1.3-.2.4-.3.4-.4 1.2-1.1 1.9-2 1-1.1 2.1-2.6 3-4.3.9-1.6 1.4-3.5 1.4-4.9 0-4.42-3.58-8-8-8zm0 11.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 4.5 12 4.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z',
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 0,
        rotation: 0,
        scale: 1.5,
        anchor: new google.maps.Point(12, 24),
        labelOrigin: new google.maps.Point(12, 8),
      };

      return svgMarker;
    };

    for (const listing of listings) {
      try {
        const isSelected = listing._id === selectedListing?._id;
        const icon = createMarkerIcon(isSelected);

        // Assume API returns populated location data with coordinates
        // If locationId is populated, it should have coordinates property
        const locationData =
          typeof listing.locationId === 'object' ? listing.locationId : null;
        let position = null;

        // Handle different possible coordinate structures
        if (locationData?.coordinates) {
          const coords = locationData.coordinates;

          // Check if coordinates is an object with lat/lng properties
          if (
            typeof coords.lat === 'number' &&
            typeof coords.lng === 'number'
          ) {
            position = {
              lat: coords.lat,
              lng: coords.lng,
            };
          }
          // Check if coordinates is an array [lng, lat] (GeoJSON format)
          else if (
            Array.isArray(coords) &&
            coords.length >= 2 &&
            typeof coords[0] === 'number' &&
            typeof coords[1] === 'number'
          ) {
            position = {
              lat: coords[1], // latitude
              lng: coords[0], // longitude
            };
          }
        }

        if (!position) {
          console.warn(
            `Listing ${listing.title} doesn't have valid coordinates:`,
            locationData,
          );
          continue;
        }

        // Create the marker
        const marker = new google.maps.Marker({
          map,
          position: position,
          title: listing.title,
          icon: icon,
          animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
          zIndex: isSelected ? 100 : 10, // Selected markers show on top
        });

        // Add click event listener
        marker.addListener('click', () => {
          if (onListingClick) {
            onListingClick(listing);
          }
        });

        newMarkers.push(marker);
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    }

    // Create markers for requests
    for (const request of requests) {
      try {
        const isSelected = request._id === selectedRequest?._id;
        const icon = createMarkerIcon(isSelected);

        // Handle request location data similar to listings
        const locationData =
          typeof request.locationId === 'object' ? request.locationId : null;
        let position = null;

        if (locationData?.coordinates) {
          const coords = locationData.coordinates;

          if (
            typeof coords.lat === 'number' &&
            typeof coords.lng === 'number'
          ) {
            position = {
              lat: coords.lat,
              lng: coords.lng,
            };
          } else if (
            Array.isArray(coords) &&
            coords.length >= 2 &&
            typeof coords[0] === 'number' &&
            typeof coords[1] === 'number'
          ) {
            position = {
              lat: coords[1], // latitude
              lng: coords[0], // longitude
            };
          }
        }

        if (!position) {
          console.warn(
            `Request ${request.title} doesn't have valid coordinates:`,
            locationData,
          );
          continue;
        }

        // Create the marker
        const marker = new google.maps.Marker({
          map,
          position: position,
          title: request.title,
          icon: icon,
          animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
          zIndex: isSelected ? 100 : 10, // Selected markers show on top
        });

        // Add click event listener
        marker.addListener('click', () => {
          if (onRequestClick) {
            onRequestClick(request);
          }
        });

        newMarkers.push(marker);
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    }

    setMarkers(newMarkers);

    return () => {
      newMarkers.forEach((marker) => {
        marker.setMap(null);
      });
    };
  }, [
    map,
    listings,
    requests,
    onListingClick,
    onRequestClick,
    selectedListing,
    selectedRequest,
  ]);

  // Cleanup search marker when component unmounts
  useEffect(() => {
    return () => {
      if (searchMarker) {
        searchMarker.setMap(null);
      }
    };
  }, [searchMarker]);

  // Center map on selected listing or request
  useEffect(() => {
    if (map && (selectedListing || selectedRequest)) {
      const selectedItem = selectedListing || selectedRequest;
      if (!selectedItem) return;

      // Use same coordinate extraction logic as markers
      const locationData =
        typeof selectedItem.locationId === 'object'
          ? selectedItem.locationId
          : null;
      let position = null;

      // Handle different possible coordinate structures
      if (locationData?.coordinates) {
        const coords = locationData.coordinates;

        // Check if coordinates is an object with lat/lng properties
        if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          position = {
            lat: coords.lat,
            lng: coords.lng,
          };
        }
        // Check if coordinates is an array [lng, lat] (GeoJSON format)
        else if (
          Array.isArray(coords) &&
          coords.length >= 2 &&
          typeof coords[0] === 'number' &&
          typeof coords[1] === 'number'
        ) {
          position = {
            lat: coords[1], // latitude
            lng: coords[0], // longitude
          };
        }
      }

      if (position) {
        map.panTo(position);
        map.setZoom(15);
      }
    }
  }, [map, selectedListing, selectedRequest]);

  // Add a slight delay to ensure Google Maps API initializes properly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map && window.google) {
        // Force a re-render of markers
        setMarkers([]);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [map, listings, requests]);
  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 left-4 z-10 w-80 md:w-96">
        <Autocomplete
          onLoad={onAutocompleteLoad}
          onPlaceChanged={onPlaceChanged}
          restrictions={{ country: 'us' }}
        >
          <div className="relative">
            <input
              type="text"
              placeholder="Search for a location..."
              className="w-full p-3 rounded-lg shadow-lg border border-brand-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-coral-500 bg-white text-brand-stone-800"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-coral-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </Autocomplete>
      </div>

      {selectedListing && (
        <div className="absolute bottom-4 left-4 z-10 w-80 md:w-96 bg-white rounded-lg shadow-lg p-4 border-l-4 border-brand-coral-500 animate-in fade-in duration-300">
          <h3 className="font-bold text-lg text-brand-stone-800">
            {selectedListing.title}
          </h3>
          <p className="text-sm text-brand-stone-600 mb-2">
            {selectedListing.userId.firstName} {selectedListing.userId.lastName}{' '}
            •{' '}
            {selectedListing.category.charAt(0).toUpperCase() +
              selectedListing.category.slice(1)}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {selectedListing.numGuests && (
                <span className="text-sm text-brand-stone-600">
                  Up to {selectedListing.numGuests} guests
                </span>
              )}
            </div>
          </div>
          {selectedListing.description && (
            <p className="text-sm text-brand-stone-600 mt-2 line-clamp-2">
              {selectedListing.description}
            </p>
          )}
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: false,
          clickableIcons: true, // Enable clicking on POIs like restaurants
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi.business',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }],
            },
            // {
            //   featureType: 'water',
            //   elementType: 'geometry',
            //   stylers: [{ color: '#e9e9e9' }],
            // },
            {
              featureType: 'water',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#9e9e9e' }],
            },
          ],
        }}
      />

      {/* Place Details Modal */}
      {showPlaceDetails && selectedPlaceDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-brand-stone-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-brand-stone-800">
                {selectedPlaceDetails.name}
              </h2>
              <button
                onClick={() => setShowPlaceDetails(false)}
                className="p-2 hover:bg-brand-stone-100 rounded-full transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                  📍 Address
                </h3>
                <p className="text-brand-stone-600">
                  {selectedPlaceDetails.formatted_address}
                </p>
              </div>

              {/* Rating */}
              {selectedPlaceDetails.rating && (
                <div>
                  <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                    ⭐ Rating
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-brand-coral-500">
                      {selectedPlaceDetails.rating}
                    </span>
                    <span className="text-brand-stone-600">/ 5.0</span>
                  </div>
                </div>
              )}

              {/* Opening Hours */}
              {selectedPlaceDetails.opening_hours && (
                <div>
                  <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                    🕒 Opening Hours
                  </h3>
                  <div className="space-y-1">
                    {selectedPlaceDetails.opening_hours.weekday_text?.map(
                      (day, index) => (
                        <p key={index} className="text-brand-stone-600 text-sm">
                          {day}
                        </p>
                      ),
                    )}
                  </div>
                  {selectedPlaceDetails.opening_hours.isOpen?.() && (
                    <p className="mt-2 text-sm font-medium text-green-600">
                      Currently Open
                    </p>
                  )}
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPlaceDetails.formatted_phone_number && (
                  <div>
                    <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                      📞 Phone
                    </h3>
                    <a
                      href={`tel:${selectedPlaceDetails.formatted_phone_number}`}
                      className="text-brand-coral-500 hover:text-brand-coral-600 transition-colors"
                    >
                      {selectedPlaceDetails.formatted_phone_number}
                    </a>
                  </div>
                )}

                {selectedPlaceDetails.website && (
                  <div>
                    <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                      🌐 Website
                    </h3>
                    <a
                      href={selectedPlaceDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-coral-500 hover:text-brand-coral-600 transition-colors"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>

              {/* Business Status */}
              {selectedPlaceDetails.business_status && (
                <div>
                  <h3 className="text-lg font-semibold text-brand-stone-800 mb-2">
                    🏪 Status
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedPlaceDetails.business_status === 'OPERATIONAL'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedPlaceDetails.business_status === 'OPERATIONAL'
                      ? 'Open'
                      : 'Closed'}
                  </span>
                </div>
              )}

              {/* Reviews */}
              {selectedPlaceDetails.reviews &&
                selectedPlaceDetails.reviews.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-brand-stone-800 mb-4">
                      💬 Recent Reviews
                    </h3>
                    <div className="space-y-4">
                      {selectedPlaceDetails.reviews
                        .slice(0, 3)
                        .map((review, index) => (
                          <div
                            key={index}
                            className="border border-brand-stone-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-brand-stone-800">
                                  {review.author_name}
                                </span>
                                <div className="flex items-center">
                                  <span className="text-yellow-500">
                                    {'⭐'.repeat(review.rating || 1)}
                                  </span>
                                </div>
                              </div>
                              <span className="text-sm text-brand-stone-500">
                                {review.relative_time_description}
                              </span>
                            </div>
                            <p className="text-brand-stone-600 text-sm leading-relaxed">
                              {review.text}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacesMap;
