import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const BRAND = '#1b4654';
const NOTES_KEY_PREFIX = 'digcard_ai_notes';

/* ─── Helpers ─── */
function formatRelative(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * 86400000) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateSummary(transcript) {
  if (!transcript || transcript.trim().length < 5) return null;

  const clean = transcript.trim();
  const sentences = clean
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length === 0) return null;

  // Title from the first meaningful sentence
  const first = sentences[0];
  const title =
    first.length > 60
      ? first.slice(0, 57) + '...'
      : first.charAt(0).toUpperCase() + first.slice(1);

  // Summary: combine first few sentences
  const summaryParts = sentences.slice(0, 3);
  const summary = summaryParts
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('. ') + (summaryParts.length > 0 ? '.' : '');

  // Next steps: extract action-like sentences
  const actionWords = ['follow', 'call', 'email', 'send', 'check', 'meet', 'review', 'update', 'schedule', 'confirm', 'share', 'remind', 'discuss', 'prepare', 'contact', 'setup', 'set up', 'create', 'finish', 'complete', 'ask', 'tell', 'need to', 'should', 'must', 'will'];
  const steps = sentences
    .filter((s) => actionWords.some((w) => s.toLowerCase().includes(w)))
    .slice(0, 4)
    .map((s) => `• ${s.charAt(0).toUpperCase()}${s.slice(1)}`);

  // If no action items found, create generic ones from remaining sentences
  if (steps.length === 0 && sentences.length > 1) {
    sentences.slice(1, 3).forEach((s) => {
      steps.push(`• Follow up: ${s.charAt(0).toUpperCase()}${s.slice(1)}`);
    });
  }

  return { title, summary, nextSteps: steps };
}

/* ═══════════════ Note Detail Modal ═══════════════ */
function NoteDetailModal({ note, onClose }) {
  const [tab, setTab] = useState('summary');
  if (!note) return null;
  const ai = note.ai;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={det.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header */}
        <View style={det.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={BRAND} />
          </TouchableOpacity>
          <View style={det.headerRight}>
            <TouchableOpacity
              style={det.iconBtn}
              onPress={() => {
                const text = note.transcript || ai?.summary || '';
                if (text) {
                  import('expo-clipboard').then((Clipboard) =>
                    Clipboard.setStringAsync(text).then(() =>
                      Alert.alert('Copied', 'Note copied to clipboard.')
                    )
                  );
                }
              }}
            >
              <Ionicons name="copy-outline" size={22} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity
              style={det.iconBtn}
              onPress={() => {
                import('react-native').then(({ Share }) =>
                  Share.share({ message: note.transcript || ai?.summary || '' })
                );
              }}
            >
              <Ionicons name="share-outline" size={22} color={BRAND} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={det.scroll}>
          <Text style={det.title}>{note.title}</Text>
          <Text style={det.meta}>
            {new Date(note.createdAt).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {note.duration ? `  •  ${formatDuration(note.duration)}` : ''}
          </Text>

          {/* Tab switcher */}
          <View style={det.tabs}>
            <TouchableOpacity
              style={[det.tabBtn, tab === 'summary' && det.tabBtnActive]}
              onPress={() => setTab('summary')}
            >
              <Text style={[det.tabText, tab === 'summary' && det.tabTextActive]}>
                Summary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[det.tabBtn, tab === 'transcript' && det.tabBtnActive]}
              onPress={() => setTab('transcript')}
            >
              <Text style={[det.tabText, tab === 'transcript' && det.tabTextActive]}>
                Transcript
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {tab === 'summary' ? (
            <View style={det.content}>
              {ai ? (
                <>
                  <View style={det.summaryCard}>
                    <View style={det.summaryBadge}>
                      <Ionicons name="sparkles" size={14} color={BRAND} />
                      <Text style={det.summaryBadgeText}>AI Summary</Text>
                    </View>
                    <Text style={det.summaryText}>{ai.summary}</Text>
                  </View>

                  {ai.nextSteps?.length > 0 && (
                    <View style={det.stepsCard}>
                      <Text style={det.stepsTitle}>Next Steps</Text>
                      {ai.nextSteps.map((step, i) => (
                        <Text key={i} style={det.stepText}>{step}</Text>
                      ))}
                    </View>
                  )}

                  <View style={det.feedbackRow}>
                    <Text style={det.feedbackQ}>Was this summary helpful?</Text>
                    <View style={det.feedbackBtns}>
                      <TouchableOpacity style={det.thumbBtn}>
                        <Ionicons name="thumbs-up-outline" size={20} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity style={det.thumbBtn}>
                        <Ionicons name="thumbs-down-outline" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={det.emptyCard}>
                  <Ionicons name="alert-circle-outline" size={32} color="#CCC" />
                  <Text style={det.noSpeech}>
                    No clear speech was detected in this recording.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={det.content}>
              {note.transcript ? (
                <View style={det.transcriptCard}>
                  <Text style={det.transcriptText}>{note.transcript}</Text>
                </View>
              ) : (
                <View style={det.emptyCard}>
                  <Ionicons name="document-text-outline" size={32} color="#CCC" />
                  <Text style={det.noSpeech}>No transcript available.</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════ Recording Modal ═══════════════ */
let ExpoSpeechRecognitionModule = null;
try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule?.ExpoSpeechRecognitionModule || null;
} catch {}

function RecordingModal({ onSave, onClose }) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [segments, setSegments] = useState([]);
  const [status, setStatus] = useState('starting'); // 'starting' | 'listening' | 'paused' | 'fallback' | 'processing'
  const [ending, setEnding] = useState(false);

  const timerRef = useRef(null);
  const segmentsRef = useRef([]);
  const activeRef = useRef(true);
  const pausedRef = useRef(false);
  const scrollRef = useRef(null);
  const liveTextRef = useRef('');
  const finalizeResolveRef = useRef(null);
  const lastFinalRef = useRef('');
  const expoListenersRef = useRef([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  const clearExpoListeners = () => {
    expoListenersRef.current.forEach((sub) => {
      try { sub?.remove?.(); } catch {}
    });
    expoListenersRef.current = [];
  };

  const pushFinalSegment = (text) => {
    const value = (text || '').trim();
    if (!value || value === lastFinalRef.current) return;
    segmentsRef.current = [...segmentsRef.current, value];
    lastFinalRef.current = value;
    setSegments([...segmentsRef.current]);
    setLiveText('');
    liveTextRef.current = '';
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
  };

  const startPulse = () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const startVoice = async () => {
    if (!ExpoSpeechRecognitionModule) {
      setStatus('fallback');
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission?.granted) {
        setStatus('fallback');
        return;
      }

      clearExpoListeners();

      expoListenersRef.current.push(
        ExpoSpeechRecognitionModule.addListener('start', () => {
          setStatus('listening');
          startPulse();
        })
      );

      expoListenersRef.current.push(
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const text = (event?.results?.[0]?.transcript || '').trim();
          if (!text) return;

          if (event?.isFinal) {
            pushFinalSegment(text);
            if (finalizeResolveRef.current) {
              const resolve = finalizeResolveRef.current;
              finalizeResolveRef.current = null;
              resolve();
            }
          } else {
            setLiveText(text);
            liveTextRef.current = text;
            setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
          }
        })
      );

      expoListenersRef.current.push(
        ExpoSpeechRecognitionModule.addListener('nomatch', () => {
          if (finalizeResolveRef.current) {
            const resolve = finalizeResolveRef.current;
            finalizeResolveRef.current = null;
            resolve();
          }
        })
      );

      expoListenersRef.current.push(
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          const code = event?.error;
          if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'language-not-supported') {
            setStatus('fallback');
          }
          if (finalizeResolveRef.current && (code === 'no-speech' || code === 'speech-timeout')) {
            const resolve = finalizeResolveRef.current;
            finalizeResolveRef.current = null;
            resolve();
          }
        })
      );

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
          EXTRA_PARTIAL_RESULTS: true,
        },
      });
      setStatus('listening');
    } catch {
      setStatus('fallback');
    }
  };

  useEffect(() => {
    startPulse();

    if (!ExpoSpeechRecognitionModule) {
      setStatus('fallback');
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => {
        clearInterval(timerRef.current);
        stopPulse();
      };
    }

    startVoice();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      activeRef.current = false;
      clearInterval(timerRef.current);
      stopPulse();
      clearExpoListeners();
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  const togglePause = async () => {
    if (ending) return;
    if (paused) {
      pausedRef.current = false;
      setPaused(false);
      setStatus('listening');
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      startPulse();
      await startVoice();
    } else {
      pausedRef.current = true;
      setPaused(true);
      setStatus('paused');
      clearInterval(timerRef.current);
      stopPulse();
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
    }
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    setStatus('processing');
    activeRef.current = false;
    pausedRef.current = true;
    clearInterval(timerRef.current);
    stopPulse();

    // Wait briefly for final speech result after stop() before destroy().
    const waitForFinal = new Promise((resolve) => {
      finalizeResolveRef.current = resolve;
      setTimeout(() => {
        if (finalizeResolveRef.current) {
          finalizeResolveRef.current = null;
          resolve();
        }
      }, 700);
    });

    try { ExpoSpeechRecognitionModule?.stop(); } catch {}
    await waitForFinal;
    clearExpoListeners();
    try { ExpoSpeechRecognitionModule?.abort(); } catch {}

    // Include any partial text that was showing but not yet confirmed
    const pending = liveTextRef.current.trim();
    if (pending) {
      segmentsRef.current = [...segmentsRef.current, pending];
    }
    const voiceTranscript = segmentsRef.current.join(' ').trim();
    await new Promise((r) => setTimeout(r, 350));
    await onSave({ transcript: voiceTranscript, duration: elapsed });
  };

  const isFallback = status === 'fallback';
  const isListening = status === 'listening';
  const hasText = segments.length > 0 || liveText.length > 0;

  const statusLabel = status === 'starting' ? 'Preparing microphone...'
    : status === 'listening' ? 'Recording in progress...'
    : status === 'paused' ? 'Paused'
    : status === 'processing' ? 'Generating summary...'
    : 'Speech recognition unavailable on this device';

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={handleEnd}>
      <SafeAreaView style={rc.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header */}
        <View style={rc.header}>
          <TouchableOpacity onPress={handleEnd} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Mic + title */}
        <View style={rc.topArea}>
          <Animated.View style={[rc.micRing, paused && rc.micRingPaused, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="mic" size={38} color={paused ? '#AAA' : '#222'} />
          </Animated.View>
          <Text style={rc.noteTitle}>New note</Text>
          <View style={rc.statusRow}>
            {isListening && !paused && <View style={rc.redDot} />}
            <Text style={[rc.statusLabel, paused && rc.statusLabelPaused]}>{statusLabel}</Text>
          </View>
        </View>

          {/* Live transcript */}
        <ScrollView
          ref={scrollRef}
          style={rc.transcriptScroll}
          contentContainerStyle={rc.transcriptContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Voice transcript (shown when not in fallback) */}
          {!isFallback && (
            <>
              {hasText ? (
                <>
                  {segments.map((seg, i) => (
                    <Text key={i} style={rc.segmentText}>
                      <Text style={rc.speakerLabel}>Speaker A: </Text>{seg}
                    </Text>
                  ))}
                  {liveText ? (
                    <Text style={rc.liveText}>
                      <Text style={rc.speakerLabel}>Speaker A: </Text>
                      <Text style={rc.partialText}>{liveText}</Text>
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={rc.emptyHint}>
                  {status === 'starting'
                    ? 'Preparing microphone...'
                    : paused
                    ? 'Recording paused'
                    : status === 'fallback'
                    ? 'Speech recognition is not available. Please use a development build.'
                    : 'Start speaking — your words will appear here'}
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {/* Controls */}
        <View style={rc.controls}>
          <TouchableOpacity style={rc.pauseBtn} onPress={togglePause} disabled={ending}>
            <Ionicons name={paused ? 'play' : 'pause'} size={18} color="#555" />
            <Text style={rc.pauseBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <View style={rc.timerWrap}>
            <Ionicons name="bar-chart" size={15} color="#E34B4B" />
            <Text style={rc.timerText}>{formatDuration(elapsed)}</Text>
          </View>
          <TouchableOpacity style={rc.endBtn} onPress={handleEnd} disabled={ending}>
            {ending ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="stop-circle" size={18} color="#fff" style={{ marginRight: 5 }} />
            )}
            <Text style={rc.endBtnText}>{ending ? 'Processing...' : 'End'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════════════════════ Main Screen ═══════════════════════════════ */
export default function AiNotetakerScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const router = useRouter();
  // Per-user storage key so each person\'s notes are isolated
  const notesKey = `${NOTES_KEY_PREFIX}_${user?.id || 'guest'}`;
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [recording, setRecording] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  useEffect(() => {
    AsyncStorage.getItem(notesKey).then((raw) => {
      if (raw) {
        try { setNotes(JSON.parse(raw)); } catch {}
      }
    });
  }, [notesKey]);

  const saveNotes = useCallback(async (updated) => {
    setNotes(updated);
    await AsyncStorage.setItem(notesKey, JSON.stringify(updated));
  }, [notesKey]);

  const handleSaveRecording = useCallback(
    async ({ transcript, duration }) => {
      setRecording(false);

      const ai = generateSummary(transcript);
      const note = {
        id: Date.now().toString(),
        title: ai?.title || (transcript ? transcript.slice(0, 50) : 'No speech detected'),
        status: 'done',
        createdAt: new Date().toISOString(),
        transcript: transcript || null,
        ai,
        duration,
      };

      const updated = [note, ...notes];
      await saveNotes(updated);
    },
    [notes, saveNotes]
  );

  const handleDeleteNote = (id) => {
    Alert.alert('Delete Note', 'Delete this note permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => saveNotes(notes.filter((n) => n.id !== id)),
      },
    ]);
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 6 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="mic" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>AI Notetaker</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={10}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color="#999" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#BBB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="mic-outline" size={48} color={BRAND} />
            </View>
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySub}>
              Tap the button below to start recording.{'\n'}
              Your speech will be transcribed in real time.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.noteItem}
            onPress={() => item.status === 'done' && setSelectedNote(item)}
            activeOpacity={0.7}
          >
            <View style={styles.noteHeader}>
              <Text style={styles.noteTime}>{formatRelative(item.createdAt)}</Text>
              <View style={styles.noteHeaderRight}>
                {item.duration ? (
                  <Text style={styles.noteDuration}>{formatDuration(item.duration)}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleDeleteNote(item.id)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash" size={18} color="#E34B4B" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
            {item.transcript ? (
              <Text style={styles.notePreview} numberOfLines={2}>
                {item.transcript}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              {item.status === 'processing' ? (
                <View style={styles.badge}>
                  <ActivityIndicator size={10} color="#888" style={{ marginRight: 4 }} />
                  <Text style={styles.badgeText}>Processing</Text>
                </View>
              ) : item.ai ? (
                <View style={[styles.badge, styles.badgeAI]}>
                  <Ionicons name="sparkles" size={12} color={BRAND} style={{ marginRight: 5 }} />
                  <Text style={styles.badgeAIText}>AI Summary</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={24} color={BRAND} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.recordBtn} onPress={() => setRecording(true)} activeOpacity={0.85}>
            <Ionicons name="mic" size={22} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.recordBtnText}>Record Note</Text>
          </TouchableOpacity>
          <View style={{ width: 48 }} /> 
        </View>
      </View>

      {/* Recording modal */}
      {recording && (
        <RecordingModal
          onSave={handleSaveRecording}
          onClose={() => setRecording(false)}
        />
      )}

      {/* Note detail modal */}
      {selectedNote && (
        <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
    </View>
  );
}

/* ═══════════════════════════ Main Styles ═══════════════════════════ */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: BRAND,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1A1A1A' },
  list: { paddingBottom: 150 },
  noteItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  noteHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteDuration: { fontSize: 12, color: '#999', fontWeight: '500' },
  deleteBtn: { padding: 4 },
  noteTime: { fontSize: 13, color: '#999', fontWeight: '500' },
  noteTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 6, lineHeight: 24 },
  notePreview: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 11, color: '#888' },
  badgeAI: { backgroundColor: '#E8F4F1' },
  badgeAIText: { fontSize: 12, color: BRAND, fontWeight: '700' },
  separator: { height: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDF5F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#999', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#BBB', textAlign: 'center', lineHeight: 21 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingBottom: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 15,
  },
  editBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F7F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  recordBtn: {
    backgroundColor: BRAND,
    borderRadius: 30,
    paddingHorizontal: 35,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});

/* ═══════════════════════════ Note Detail Styles ═══════════════════════════ */
const det = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 4, lineHeight: 30 },
  meta: { fontSize: 12, color: '#999', marginBottom: 20 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F3F5',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, color: '#999', fontWeight: '600' },
  tabTextActive: { color: BRAND },
  content: {},
  summaryCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 5,
  },
  summaryBadgeText: { fontSize: 12, fontWeight: '700', color: BRAND },
  summaryText: { fontSize: 15, color: '#333', lineHeight: 23 },
  stepsCard: {
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  stepsTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  stepText: { fontSize: 14, color: '#444', lineHeight: 24 },
  feedbackRow: { alignItems: 'center', marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  feedbackQ: { fontSize: 13, color: '#999', marginBottom: 10 },
  feedbackBtns: { flexDirection: 'row', gap: 16 },
  thumbBtn: { backgroundColor: '#F2F2F2', borderRadius: 24, padding: 10 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  noSpeech: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 22 },
  transcriptCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    padding: 16,
  },
  transcriptText: { fontSize: 15, color: '#333', lineHeight: 24 },
});

/* ═══════════════════════════ Recording Modal Styles ═══════════════════════════ */
const rc = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topArea: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  micRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  micRingPaused: { backgroundColor: '#F5F5F5' },
  noteTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E34B4B' },
  statusLabel: { fontSize: 14, color: '#555' },
  statusLabelPaused: { color: '#AAA' },
  transcriptScroll: { flex: 1, marginHorizontal: 20 },
  transcriptContent: { paddingBottom: 24, minHeight: 80 },
  segmentText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 14,
  },
  speakerLabel: { fontWeight: '700', color: '#111' },
  liveText: { fontSize: 15, lineHeight: 24, marginBottom: 14 },
  partialText: { color: '#999', fontStyle: 'italic' },
  emptyHint: {
    fontSize: 14,
    color: '#BBB',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  inputHint: { fontSize: 13, color: '#999', marginBottom: 10 },
  noteInput: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 24,
    minHeight: 150,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  pauseBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E34B4B',
    fontVariant: ['tabular-nums'],
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  endBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
