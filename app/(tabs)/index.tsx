import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatus } from 'expo-av';

const screenWidth = Dimensions.get('window').width;

// Interfaces for Surahs & Ayahs
interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface SurahData {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
  ayahs: Ayah[];
}

// Context for global state
interface AppContextType {
  showSurahs: boolean;
  surahs: Surah[];
  selectedSurah: SurahData | null;
  loading: boolean;
  selectedAyah: Ayah | null;
  sound: Audio.Sound | null;
  setShowSurahs: (show: boolean) => void;
  fetchAyahs: (surahNumber: number) => Promise<void>;
  playAudio: (ayah: Ayah) => Promise<void>;
  handleBackPress: () => Promise<void>;
  fetchNextSurah: () => Promise<void>;
  fetchPreviousSurah: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showSurahs, setShowSurahs] = useState(false);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    // Initialize audio mode when component mounts
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });

    fetchSurahs();

    return () => {
      // Clean up sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Fetch all Surahs
  const fetchSurahs = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      const json = await response.json();
      if (json.code === 200) {
        setSurahs(json.data);
      } else {
        console.error("Failed to fetch surahs:", json);
      }
    } catch (error) {
      console.error("Error fetching Surahs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Ayahs for selected Surah
  const fetchAyahs = async (surahNumber: number) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const json = await response.json();
      if (json.code === 200) {
        setSelectedSurah(json.data);
      } else {
        console.error("Failed to fetch ayahs:", json);
      }
    } catch (error) {
      console.error("Error fetching Ayahs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Play Ayah audio
  const playAudio = async (ayah: Ayah) => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3` },
        { shouldPlay: true }
      );

      setSound(newSound);
      setSelectedAyah(ayah);

      newSound.setOnPlaybackStatusUpdate(async (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          if (selectedSurah) {
            const currentIndex = selectedSurah.ayahs.findIndex(a => a.number === ayah.number);
            const nextAyah = selectedSurah.ayahs[currentIndex + 1];
            if (nextAyah) {
              await playAudio(nextAyah);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  // Stop & unload audio
  const handleBackPress = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      setSelectedAyah(null);
      setSelectedSurah(null);
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  };

  // Fetch next Surah (Infinite scroll feature)
  const fetchNextSurah = async () => {
    if (selectedSurah?.number) {
      const nextSurahNumber = selectedSurah.number === 114 ? 1 : selectedSurah.number + 1;
      await fetchAyahs(nextSurahNumber); // Get the next Surah
    }
  };

  // Fetch previous Surah (Pull-to-refresh functionality)
  const fetchPreviousSurah = async () => {
    if (selectedSurah?.number && selectedSurah.number > 1) {
      await fetchAyahs(selectedSurah.number - 1); // Get the previous Surah
    }
  };

  return (
    <AppContext.Provider value={{
      showSurahs,
      surahs,
      selectedSurah,
      loading,
      selectedAyah,
      sound,
      setShowSurahs,
      fetchAyahs,
      playAudio,
      handleBackPress,
      fetchNextSurah,
      fetchPreviousSurah,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export default function App() {
  return (
    <AppProvider>
      <QuranAppContent />
    </AppProvider>
  );
}

// UI for Quran App
function QuranAppContent() {
  const { 
    showSurahs, 
    surahs, 
    selectedSurah, 
    loading, 
    fetchAyahs, 
    playAudio, 
    handleBackPress, 
    setShowSurahs, 
    selectedAyah, 
    fetchNextSurah, 
    fetchPreviousSurah 
  } = useAppContext();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Home Screen Button */}
      {!showSurahs && !selectedSurah && (
        <TouchableOpacity style={styles.button} onPress={() => setShowSurahs(true)}>
          <Text style={styles.buttonText}>Read Quran</Text>
        </TouchableOpacity>
      )}

      {/* Loading Indicator */}
      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {/* Surah List */}
      {showSurahs && !selectedSurah && !loading && (
        <FlatList
          data={surahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.surahItem} 
              onPress={() => fetchAyahs(item.number)}
            >
              <Text style={styles.surahName}>
                {item.englishName} ({item.name})
              </Text>
              <Text style={styles.surahDetails}>
                {item.englishNameTranslation} - {item.numberOfAyahs} verses
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Ayah List */}
      {selectedSurah && !loading && (
        <View style={styles.surahContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.buttonText}>← Back</Text>
          </TouchableOpacity>
          
          <View style={styles.surahHeader}>
            <Text style={styles.surahTitle}>
              {selectedSurah.englishName} ({selectedSurah.name})
            </Text>
            <Text style={styles.surahSubtitle}>
              {selectedSurah.englishNameTranslation}
            </Text>
          </View>
          
          <FlatList
            data={selectedSurah.ayahs}
            keyExtractor={(ayah) => ayah.number.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => playAudio(item)}>
                <View style={styles.ayahContainer}>
                  <Text style={styles.ayahNumber}>{item.numberInSurah}.</Text>
                  <Text style={[styles.ayahText, selectedAyah?.number === item.number && styles.highlightAyah]}>
                    {item.text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchPreviousSurah}
                title="Pull to load previous Surah"
              />
            }
            onEndReached={fetchNextSurah} // Load next Surah on scroll
            onEndReachedThreshold={0.5} // Trigger when scrolling near the end
          />
        </View>
      )}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  button: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  surahItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  surahName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  surahDetails: {
    fontSize: 14,
    color: '#777',
  },
  surahContainer: {
    flex: 1,
    padding: 10,
  },
  surahHeader: {
    marginBottom: 15,
  },
  surahTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  surahSubtitle: {
    fontSize: 16,
    color: '#777',
  },
  backButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  ayahContainer: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  ayahNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  ayahText: {
    fontSize: 16,
    marginLeft: 10,
  },
  highlightAyah: {
    backgroundColor: '#ffeb3b',
  },
});
