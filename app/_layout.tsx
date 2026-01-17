// MUST be imported first to provide crypto polyfill for nanoid
import 'react-native-get-random-values';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Preload images
const preloadImages = async () => {
  const images = [
    require('@/assets/images/bg.png'),
    require('@/assets/images/bg_pc.png'),
  ];
  
  const cacheImages = images.map((image) => {
    return Asset.fromModule(image).downloadAsync();
  });
  
  return Promise.all(cacheImages);
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await preloadImages();
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          presentation: 'card',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Say It' }} />
        <Stack.Screen name="lobby" options={{ title: 'Lobby' }} />
        <Stack.Screen name="round" options={{ title: 'Round' }} />
        <Stack.Screen name="reveal" options={{ title: 'Reveal' }} />
        <Stack.Screen name="summary" options={{ title: 'Summary' }} />
      </Stack>
      <StatusBar style="light" translucent={true} />
    </ThemeProvider>
  );
}
