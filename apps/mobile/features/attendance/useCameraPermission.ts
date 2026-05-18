import { useCallback, useEffect, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import { Linking } from "react-native";

export interface CameraPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  isLoading: boolean;
  request: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useCameraPermission(): CameraPermissionState {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!permission || permission.granted) return;
    if (!permission.canAskAgain) return;
    if (requesting) return;
    setRequesting(true);
    void requestPermission().finally(() => setRequesting(false));
  }, [permission, requestPermission, requesting]);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      await requestPermission();
    } finally {
      setRequesting(false);
    }
  }, [requestPermission]);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  return {
    granted: permission?.granted ?? false,
    canAskAgain: permission?.canAskAgain ?? true,
    isLoading: !permission || requesting,
    request,
    openSettings,
  };
}
