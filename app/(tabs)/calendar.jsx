import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND = '#1b4654';
const CALENDAR_STORAGE_KEY = 'digcard_events';

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = daysInMonth(date);
  const result = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    result.push(null);
  }
  // Days of month
  for (let i = 1; i <= days; i++) {
    result.push(new Date(year, month, i));
  }
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ─── Event Detail Modal ─── */
function EventModal({ event, onClose, onDelete, onSave }) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [time, setTime] = useState(event?.time || '09:00');
  const [isNew, setIsNew] = useState(!event?.id);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title.');
      return;
    }
    onSave({ ...event, title, description, time, id: event?.id || Date.now().toString() });
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={BRAND} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{isNew ? 'New Event' : 'Edit Event'}</Text>
          <TouchableOpacity onPress={handleSave} hitSlop={12}>
            <Ionicons name="checkmark" size={24} color={BRAND} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Event title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#CCC"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Time</Text>
            <View style={styles.timeInputWrap}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="HH:MM"
                value={time}
                onChangeText={setTime}
                placeholderTextColor="#CCC"
              />
              <Ionicons name="time-outline" size={20} color={BRAND} style={{ marginLeft: 10 }} />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Event details"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholderTextColor="#CCC"
            />
          </View>

          {!isNew && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      onDelete(event.id);
                      onClose();
                    },
                  },
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#E34B4B" />
              <Text style={styles.deleteBtnText}>Delete Event</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Load events from storage
  useEffect(() => {
    AsyncStorage.getItem(CALENDAR_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setEvents(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

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

  const saveEvent = async (event) => {
    const dateKey = formatDate(selectedDate);
    const updatedEvents = {
      ...events,
      [dateKey]: events[dateKey] ? events[dateKey].map((e) => e.id === event.id ? event : e) : [event],
    };
    setEvents(updatedEvents);
    await AsyncStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(updatedEvents));
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const deleteEvent = async (eventId) => {
    const dateKey = formatDate(selectedDate);
    const updatedEvents = {
      ...events,
      [dateKey]: (events[dateKey] || []).filter((e) => e.id !== eventId),
    };
    setEvents(updatedEvents);
    await AsyncStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(updatedEvents));
  };

  const monthDays = getMonthDays(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayEvents = selectedDate ? (events[formatDate(selectedDate)] || []) : [];

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 6 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Calendar</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={10}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Month header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={BRAND} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            hitSlop={10}
          >
            <Ionicons name="chevron-forward" size={24} color={BRAND} />
          </TouchableOpacity>
        </View>

        {/* Day names */}
        <View style={styles.weekDays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.weekDayText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {monthDays.map((date, index) => {
            const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate);
            const isToday = date && formatDate(date) === formatDate(today);
            const dateKey = date ? formatDate(date) : null;
            const dayEventCount = dateKey ? (events[dateKey] || []).length : 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && styles.dayCellToday,
                  !date && styles.dayCellEmpty,
                ]}
                onPress={() => date && setSelectedDate(date)}
                disabled={!date}
              >
                {date && (
                  <>
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {date.getDate()}
                    </Text>
                    {dayEventCount > 0 && (
                      <View
                        style={[
                          styles.eventDot,
                          isSelected && styles.eventDotSelected,
                          isToday && styles.eventDotToday,
                        ]}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        {selectedDate && (
          <View style={styles.eventsSection}>
            <View style={styles.eventsSectionHeader}>
              <Text style={styles.eventsSectionTitle}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedEvent(null);
                  setShowEventModal(true);
                }}
                hitSlop={10}
              >
                <Ionicons name="add-circle" size={28} color={BRAND} />
              </TouchableOpacity>
            </View>

            {dayEvents.length === 0 ? (
              <View style={styles.emptyEvents}>
                <Ionicons name="calendar-outline" size={40} color="#CCC" />
                <Text style={styles.emptyText}>No events scheduled</Text>
              </View>
            ) : (
              <FlatList
                data={dayEvents}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.eventItem}
                    onPress={() => {
                      setSelectedEvent(item);
                      setShowEventModal(true);
                    }}
                  >
                    <View style={styles.eventTime}>
                      <Text style={styles.eventTimeText}>{item.time}</Text>
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      {item.description && (
                        <Text style={styles.eventDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </View>

      {/* Event modal */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          onClose={() => setShowEventModal(false)}
          onDelete={deleteEvent}
          onSave={saveEvent}
        />
      )}
    </View>
  );
}

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
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: '#666',
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 4,
    position: 'relative',
  },
  dayCellEmpty: { opacity: 0 },
  dayCellSelected: { backgroundColor: BRAND },
  dayCellToday: { borderWidth: 2, borderColor: BRAND },
  dayText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  dayTextSelected: { color: '#fff' },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BRAND,
    position: 'absolute',
    bottom: 4,
  },
  eventDotSelected: { backgroundColor: '#fff' },
  eventDotToday: { backgroundColor: BRAND },
  eventsSection: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20 },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  eventsSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  emptyEvents: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: { fontSize: 14, color: '#999', marginTop: 10 },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F5F6F8',
    marginBottom: 10,
  },
  eventTime: {
    minWidth: 50,
    marginRight: 12,
  },
  eventTimeText: { fontSize: 13, fontWeight: '700', color: BRAND },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  eventDesc: { fontSize: 12, color: '#999' },
  modalSafe: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: BRAND },
  modalContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A1A',
  },
  timeInputWrap: { flexDirection: 'row', alignItems: 'center' },
  textArea: { height: 100, textAlignVertical: 'top' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FFE8E8',
    marginTop: 20,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#E34B4B', marginLeft: 8 },
});
