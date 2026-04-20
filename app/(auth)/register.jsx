import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '@/services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Error', 'Name, email, and password are required.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form);
      Alert.alert('Success', 'Account created! Please log in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Registration Failed', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const update = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          {[
            { key: 'name', placeholder: 'Full Name' },
            { key: 'email', placeholder: 'Email', keyboardType: 'email-address' },
            { key: 'company', placeholder: 'Company (optional)' },
            { key: 'password', placeholder: 'Password', secure: true },
          ].map(({ key, placeholder, keyboardType, secure }) => (
            <TextInput
              key={key}
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType={keyboardType}
              secureTextEntry={secure}
              value={form[key]}
              onChangeText={update(key)}
            />
          ))}

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#f8fafc', marginBottom: 24 },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: '#818cf8', fontSize: 14 },
});
