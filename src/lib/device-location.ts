export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function getCurrentDeviceLocation(): Promise<DeviceCoordinates> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("GPS location is not supported on this device or browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.max(0, position.coords.accuracy || 0),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission is blocked. Allow location access for Rydah in your browser or app settings, then try again."));
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error("Your device could not determine its current location. Check GPS/location services and try again."));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("Location detection timed out. Move to an area with a clearer GPS signal and try again."));
          return;
        }
        reject(new Error("Unable to get your current location."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000,
      },
    );
  });
}
