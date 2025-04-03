import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatusSuccess } from 'expo-av';

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
const AppContext = createContext<any>(null);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [showSurahs, setShowSurahs] = useState(false);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    fetchSurahs();
  }, []);

  // Fetch all Surahs
  const fetchSurahs = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      const json = await response.json();
      if (json.code === 200) setSurahs(json.data);
    } catch (error) {
      console.error("Error fetching Surahs:", error);
    }
    setLoading(false);
  };

  // Fetch Ayahs for selected Surah
  const fetchAyahs = async (surahNumber: number) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const json = await response.json();
      if (json.code === 200) setSelectedSurah(json.data);
    } catch (error) {
      console.error("Error fetching Ayahs:", error);
    }
    setLoading(false);
  };

  // Play Ayah audio
  const playAudio = async (ayah: Ayah) => {
    if (sound) await sound.unloadAsync();

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3` }
      );
      setSound(newSound);
      setSelectedAyah(ayah); // Highlight the playing ayah
      await newSound.playAsync();

      // Auto-play next Ayah when the current one finishes
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status && (status as AVPlaybackStatusSuccess).didJustFinish) {
          if (selectedSurah) {
            const currentIndex = selectedSurah.ayahs.findIndex(a => a.number === ayah.number);
            const nextAyah = selectedSurah.ayahs[currentIndex + 1];
            if (nextAyah) await playAudio(nextAyah);
          }
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  // Stop & unload audio
  const handleBackPress = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setSelectedSurah(null);
  };

  return (
    <AppContext.Provider value={{
      currentTime, showSurahs, surahs, selectedSurah, loading, selectedAyah, sound,
      setShowSurahs, fetchSurahs, fetchAyahs, playAudio, handleBackPress
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
  const { showSurahs, surahs, selectedSurah, loading, fetchAyahs, playAudio, handleBackPress, setShowSurahs, selectedAyah } = useAppContext();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Home Screen Button */}
      {!showSurahs && (
        <TouchableOpacity style={styles.button} onPress={() => setShowSurahs(true)}>
          <Text style={styles.buttonText}>Read Quran</Text>
        </TouchableOpacity>
      )}

      {/* Loading Indicator */}
      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {/* Surah List */}
      {showSurahs && !selectedSurah && (
        <FlatList
          data={surahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.surahItem} onPress={() => fetchAyahs(item.number)}>
              <Text style={styles.surahName}>{item.englishName} ({item.name})</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Ayah List */}
      {selectedSurah && (
        <View style={styles.surahContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.buttonText}>← Back</Text>
          </TouchableOpacity>
          <FlatList
            data={selectedSurah.ayahs}
            keyExtractor={(ayah) => ayah.number.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => playAudio(item)}>
                <Text style={[styles.ayahText, selectedAyah?.number === item.number && styles.highlightAyah]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            )}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
  surahItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  surahName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  surahContainer: {
    width: screenWidth * 0.9,
    alignItems: 'center',
  },
  backButton: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#dc3545',
    borderRadius: 5,
  },
  ayahText: {
    fontSize: 18,
    textAlign: 'right',
    padding: 5,
  },
  highlightAyah: {
    backgroundColor: '#f0e68c',
  },
});

